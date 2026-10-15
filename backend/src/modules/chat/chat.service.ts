import { ERROR_CODES } from "../../constants/errorCodes";
import { Errors } from "../../utils/errors";
import { emitToBooking } from "../../sockets";
import type { MessageSenderRole } from "../../models/Message";
import {
  chatRepository,
  type ChatBookingDoc,
  type MessageDoc,
} from "./chat.repository";
import {
  NEW_MESSAGE_EVENT,
  type ChatMessageDto,
  type ChatPage,
} from "./chat.types";
import type { ListQuery, SendBody } from "./chat.validation";

export interface Actor {
  sub: string;
  role: string;
}

/** Chat is read-only once a booking is over (or never got a partner). */
const CLOSED_STATUSES = new Set([
  "cancelled_by_customer",
  "cancelled_by_partner",
  "cancelled_by_admin",
  "no_show",
  "rated",
]);

/** Swappable in tests; realtime must never make a stored message fail. */
export const chatNotifier = {
  newMessage(bookingId: string, message: ChatMessageDto): void {
    try {
      // `mine` is per-recipient, so the broadcast copy never claims ownership.
      emitToBooking(bookingId, NEW_MESSAGE_EVENT, { ...message, mine: false });
    } catch {
      /* sockets not initialised (tests / scripts); the message is already persisted */
    }
  },
};

const toDto = (m: MessageDoc, viewerId: string): ChatMessageDto => ({
  id: m._id.toString(),
  bookingId: m.bookingId.toString(),
  senderRole: m.senderRole,
  mine: m.senderId.toString() === viewerId,
  text: m.text ?? "",
  attachments: (m.attachments ?? []).map((a) => ({
    url: a.url,
    kind: "image" as const,
  })),
  createdAt: m.createdAt.toISOString(),
});

/**
 * Membership check shared by list and send:
 * customer = the booking's customer, partner = the assigned partner, admin = read-only on any booking.
 * 404 when the booking does not exist, 403 when it exists but is not the caller's.
 */
async function authorize(
  actor: Actor,
  bookingId: string,
): Promise<{ booking: ChatBookingDoc; senderRole: MessageSenderRole | null }> {
  const booking = await chatRepository.findBooking(bookingId);
  if (!booking)
    throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Booking not found");

  if (actor.role === "admin") return { booking, senderRole: null };
  if (actor.role === "customer") {
    if (booking.customerId.toString() !== actor.sub) throw Errors.notOwner();
    return { booking, senderRole: "customer" };
  }
  if (actor.role === "partner") {
    const partner = await chatRepository.findPartnerByUserId(actor.sub);
    if (
      !partner ||
      !booking.partnerId ||
      booking.partnerId.toString() !== partner._id.toString()
    )
      throw Errors.notOwner();
    return { booking, senderRole: "partner" };
  }
  throw Errors.forbidden();
}

export const chatService = {
  async list(
    actor: Actor,
    bookingId: string,
    query: ListQuery,
  ): Promise<ChatPage> {
    await authorize(actor, bookingId);
    const rows = await chatRepository.listMessages(
      bookingId,
      query.limit,
      query.before,
    );
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      // Returned oldest -> newest so the UI can render the page as-is.
      messages: page.map((m) => toDto(m, actor.sub)).reverse(),
      nextCursor: hasMore ? page[page.length - 1]._id.toString() : null,
    };
  },

  async send(
    actor: Actor,
    bookingId: string,
    body: SendBody,
  ): Promise<ChatMessageDto> {
    const { booking, senderRole } = await authorize(actor, bookingId);
    if (!senderRole)
      throw Errors.forbidden("Admins can read but not send chat messages");
    if (!booking.partnerId)
      throw Errors.conflict(
        ERROR_CODES.CONFLICT,
        "Chat opens once a partner is assigned",
      );
    if (CLOSED_STATUSES.has(booking.status))
      throw Errors.conflict(
        ERROR_CODES.CONFLICT,
        "This booking is closed for new messages",
      );

    const saved = await chatRepository.createMessage({
      bookingId: booking._id,
      customerId: booking.customerId,
      partnerId: booking.partnerId,
      senderId: actor.sub,
      senderRole,
      text: body.text ?? "",
      attachments: (body.attachments ?? []).map((a) => ({
        url: a.url,
        kind: "image" as const,
      })),
    });
    const dto = toDto(saved, actor.sub);
    chatNotifier.newMessage(bookingId, dto);
    return dto;
  },
};
