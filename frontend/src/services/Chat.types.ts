/** Mirrors backend ChatMessageDto (modules/chat/chat.types.ts). */
export interface ChatMessage {
  id: string;
  bookingId: string;
  senderRole: "customer" | "partner";
  /** Not used by the UI: the realtime copy always says false, so bubbles are aligned by senderRole. */
  mine: boolean;
  text: string;
  attachments: Array<{ url: string; kind: "image" }>;
  createdAt: string;
}

export interface ChatPage {
  messages: ChatMessage[];
  nextCursor: string | null;
}

/** Realtime event the backend emits to the booking room after a message is stored. */
export const NEW_MESSAGE_EVENT = "partner:new_message";
