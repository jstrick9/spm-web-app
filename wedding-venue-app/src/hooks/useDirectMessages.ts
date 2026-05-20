import { useEffect, useMemo, useState } from 'react';
import type { DirectMessage, MessageRole } from '../models/DirectMessage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { STORAGE_VERSIONS } from '../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from '../utils/storage';

const STORAGE_KEY = STORAGE_KEYS.DIRECT_MESSAGES;
const STORAGE_VERSION = STORAGE_VERSIONS.DIRECT_MESSAGES;

type SendMessagePayload = {
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: MessageRole;
  message: string;
};

function loadStoredMessages(): DirectMessage[] {
  return loadVersionedStorage<DirectMessage[]>({
    key: STORAGE_KEY,
    defaultValue: [],
    currentVersion: STORAGE_VERSION,
    migrations: {
      0: (input) => (Array.isArray(input) ? (input as DirectMessage[]) : []),
    },
    normalize: (value) => (Array.isArray(value) ? value : []),
  });
}

export function useDirectMessages() {
  const [messages, setMessages] = useState<DirectMessage[]>(() => loadStoredMessages());

  useEffect(() => {
    saveVersionedStorage(STORAGE_KEY, STORAGE_VERSION, messages);
  }, [messages]);

  const sendMessage = (payload: SendMessagePayload) => {
    const text = payload.message.trim();
    if (!text) return;

    const recipientRole: MessageRole =
      payload.senderRole === 'admin' ? 'master' : 'admin';

    const next: DirectMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      threadId: payload.threadId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      senderRole: payload.senderRole,
      recipientRole,
      message: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, next]);
  };

  const getThreadMessages = (threadId: string): DirectMessage[] => {
    return messages
      .filter((m) => m.threadId === threadId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  };

  const unreadCountForRole = (threadId: string, role: MessageRole): number => {
    return messages.filter(
      (m) => m.threadId === threadId && m.recipientRole === role,
    ).length;
  };

  return useMemo(
    () => ({
      messages,
      sendMessage,
      getThreadMessages,
      unreadCountForRole,
    }),
    [messages],
  );
}