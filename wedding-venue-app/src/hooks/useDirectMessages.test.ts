import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDirectMessages } from './useDirectMessages';

describe('useDirectMessages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads legacy raw messages and rewrites them as versioned storage', () => {
    localStorage.setItem(
      'spm_direct_messages_v1',
      JSON.stringify([
        {
          id: 'm1',
          threadId: 'thread-1',
          senderId: 'u1',
          senderName: 'Jane',
          senderRole: 'admin',
          recipientRole: 'master',
          message: 'Hello',
          createdAt: new Date().toISOString(),
        },
      ]),
    );

    const { result } = renderHook(() => useDirectMessages());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.getThreadMessages('thread-1')).toHaveLength(1);

    const stored = JSON.parse(localStorage.getItem('spm_direct_messages_v1') || 'null');
    expect(stored.version).toBe(1);
    expect(stored.data).toHaveLength(1);
  });

  it('sendMessage appends and persists a new message', async () => {
    const { result } = renderHook(() => useDirectMessages());

    act(() => {
      result.current.sendMessage({
        threadId: 'thread-2',
        senderId: 'u2',
        senderName: 'Mark',
        senderRole: 'master',
        message: 'New message',
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.getThreadMessages('thread-2')).toHaveLength(1);
    expect(result.current.unreadCountForRole('thread-2', 'admin')).toBe(1);

    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem('spm_direct_messages_v1') || 'null',
      );
      expect(stored.version).toBe(1);
      expect(stored.data).toHaveLength(1);
      expect(stored.data[0].message).toBe('New message');
    });
  });

  it('ignores blank messages', () => {
    const { result } = renderHook(() => useDirectMessages());

    act(() => {
      result.current.sendMessage({
        threadId: 'thread-3',
        senderId: 'u3',
        senderName: 'Alex',
        senderRole: 'admin',
        message: '   ',
      });
    });

    expect(result.current.messages).toHaveLength(0);
  });
});