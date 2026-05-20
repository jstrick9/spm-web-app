import React, { useMemo, useState } from 'react';
import type { MessageRole } from '../models/DirectMessage';
import { useDirectMessages } from '../hooks/useDirectMessages';

interface DirectMessagePanelProps {
  title?: string;
  threadId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: MessageRole;
  className?: string;
}

const formatTimestamp = (iso: string) => {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const DirectMessagePanel: React.FC<DirectMessagePanelProps> = ({
  title = 'Direct Messages',
  threadId,
  currentUserId,
  currentUserName,
  currentUserRole,
  className = '',
}) => {
  const { getThreadMessages, sendMessage } = useDirectMessages();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const threadMessages = useMemo(() => getThreadMessages(threadId), [getThreadMessages, threadId]);

  const onSend = () => {
    if (!draft.trim()) {
      setError('Please type a message before sending.');
      return;
    }
    sendMessage({
      threadId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      message: draft,
    });
    setDraft('');
    setError('');
  };

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
          {threadMessages.length} messages
        </span>
      </div>

      <div className="h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
        {threadMessages.length === 0 ? (
          <p className="text-sm text-gray-600">No messages yet. Start the conversation.</p>
        ) : (
          <ul className="space-y-3">
            {threadMessages.map((m) => {
              const mine = m.senderId === currentUserId;
              return (
                <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                      mine
                        ? 'bg-[#4A1942] text-white'
                        : 'border border-gray-200 bg-white text-gray-900'
                    }`}
                  >
                    <div className={`mb-1 text-xs ${mine ? 'text-white/80' : 'text-gray-500'}`}>
                      {m.senderName} • {formatTimestamp(m.createdAt)}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <label htmlFor={`dm-input-${threadId}`} className="mb-1 block text-sm font-medium text-gray-700">
          Type a message
        </label>
        <div className="flex gap-2">
          <input
            id={`dm-input-${threadId}`}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Write your message..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#4A1942] focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20"
          />
          <button
            type="button"
            onClick={onSend}
            className="rounded-md bg-[#4A1942] px-4 py-2 text-sm font-medium text-white hover:bg-[#3b1435]"
          >
            Send
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
};
