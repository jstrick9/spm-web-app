export type MessageRole = 'admin' | 'master';

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: MessageRole;
  recipientRole: MessageRole;
  message: string;
  createdAt: string;
}

export const buildMessageThreadId = (eventName: string, masterUserId: string): string => {
  const safeEvent = (eventName || 'general').trim().toLowerCase().replace(/\s+/g, '-');
  return `thread:${safeEvent}:${masterUserId}`;
};
