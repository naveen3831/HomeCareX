import type { MessageSenderRole } from '../../models/Message';

export interface ChatMessageDto {
  id: string;
  bookingId: string;
  senderRole: MessageSenderRole;
  /** True when the signed-in user sent it, so the UI can align bubbles without exposing user ids. */
  mine: boolean;
  text: string;
  attachments: Array<{ url: string; kind: 'image' }>;
  createdAt: string;
}

export interface ChatPage {
  messages: ChatMessageDto[];
  /** Pass as `before` to load older messages; null when there are no more. */
  nextCursor: string | null;
}

/** Realtime event name, emitted to the `booking:<id>` room after a message is stored. */
export const NEW_MESSAGE_EVENT = 'partner:new_message';