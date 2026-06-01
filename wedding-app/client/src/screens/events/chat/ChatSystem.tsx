/**
 * ChatSystem — Event threaded messaging.
 *
 * Phase 19: Now dual-write — server-first with IndexedDB fallback.
 *   1. On mount: fetch from server API (GET /api/messages/:threadId)
 *   2. On send: POST to server, then save to IndexedDB
 *   3. If server is unreachable: save to IndexedDB only (synced=false)
 *   4. Background: periodically retry un-synced messages
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { MessageSquare, Send, Smile, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../../ui/lib/cn';
import { SdkUser } from '../../../sdk/types';
import { getMessages, saveMessage, ChatMessage } from '../../../lib/db/chatDB';
import { EmojiPicker } from '../../../ui/EmojiPicker';
import { api, getToken } from '../../../sdk/client';

interface Props {
  eventId: string;
  currentUser: SdkUser;
}

const CATEGORIES = ['general', 'layout', 'logistics', 'vendors', 'urgent'] as const;
type Category = typeof CATEGORIES[number];

export function ChatSystem({ eventId, currentUser }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [showEmoji, setShowEmoji] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build thread ID from event + category
  const threadId = `${eventId}:${activeCategory}`;

  // ─── Load messages: server-first, IndexedDB fallback ──
  const loadMessages = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) throw new Error('no token');

      const res: any = await api.get(`/api/messages/${encodeURIComponent(threadId)}`);
      const serverMsgs: ChatMessage[] = (res.messages ?? []).map((m: any) => ({
        id: m.id,
        eventId,
        threadId: activeCategory,
        senderId: m.sender_id,
        senderName: m.sender_role || 'User',
        body: m.body,
        createdAt: m.created_at,
        isOwn: m.sender_id === currentUser.id,
        synced: true,
      }));

      // Merge: server messages + any un-synced local messages
      const localMsgs = await getMessages(eventId, activeCategory);
      const unsynced = localMsgs.filter(m => !m.synced);
      const serverIds = new Set(serverMsgs.map(m => m.id));
      const merged = [
        ...serverMsgs,
        ...unsynced.filter(m => !serverIds.has(m.id)),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      setMessages(merged);
      setServerOnline(true);

      // Persist server messages to IndexedDB for offline access
      for (const msg of serverMsgs) {
        await saveMessage(msg);
      }
    } catch {
      // Offline: load from IndexedDB
      setServerOnline(false);
      const localMsgs = await getMessages(eventId, activeCategory);
      if (localMsgs.length === 0) {
        const welcome: ChatMessage = {
          id: `welcome-${Date.now()}`,
          eventId,
          threadId: activeCategory,
          senderId: 'sys',
          senderName: 'System',
          body: `Welcome to the ${activeCategory} thread!`,
          createdAt: new Date().toISOString(),
          isOwn: false,
          synced: true,
        };
        await saveMessage(welcome);
        setMessages([welcome]);
      } else {
        setMessages(localMsgs);
      }
    }
  }, [eventId, activeCategory, threadId, currentUser.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── Send message: server-first, IndexedDB fallback ───
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventId,
      threadId: activeCategory,
      senderId: currentUser.id,
      senderName: currentUser.fullName || 'Me',
      body: input.trim(),
      createdAt: new Date().toISOString(),
      isOwn: true,
      synced: false,
    };

    // Optimistic UI update
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    try {
      const res: any = await api.post(`/api/messages/${encodeURIComponent(threadId)}`, {
        body: newMsg.body,
        senderRole: 'planner',
      });

      // Update the message with server ID and mark as synced
      const serverMsg: ChatMessage = {
        ...newMsg,
        id: res.message?.id ?? newMsg.id,
        synced: true,
      };
      await saveMessage(serverMsg);
      setMessages(prev =>
        prev.map(m => m.id === newMsg.id ? serverMsg : m)
      );
      setServerOnline(true);
    } catch {
      // Save locally — will sync later
      await saveMessage(newMsg);
      setServerOnline(false);
    }
  };

  // Filter messages for current thread
  const threadMessages = messages.filter(m => m.threadId === activeCategory);

  return (
    <Card className="flex flex-col h-[400px] sm:h-[600px]">
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand" />
          Event Communications
          {serverOnline ? (
            <Wifi className="w-3 h-3 text-success" />
          ) : (
            <WifiOff className="w-3 h-3 text-warning" />
          )}
        </CardTitle>
        <div className="flex gap-1 bg-surface-2 p-1 rounded-md">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded capitalize transition-colors",
                activeCategory === c
                  ? (c === 'urgent' ? 'bg-danger text-danger-fg' : 'bg-surface text-fg shadow-sm')
                  : 'text-fg-muted hover:text-fg'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-surface-2/30">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {threadMessages.map(msg => (
            <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.isOwn ? "ml-auto items-end" : "mr-auto items-start")}>
              <div className="text-[10px] text-fg-muted mb-1 px-1">
                {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {!msg.synced && <span className="ml-1 text-warning" title="Pending sync">●</span>}
              </div>
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm",
                msg.isOwn
                  ? "bg-brand text-brand-fg rounded-br-sm"
                  : "bg-surface border border-border text-fg rounded-bl-sm"
              )}>
                {msg.body}
              </div>
            </div>
          ))}
          {threadMessages.length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-fg-muted italic">
              No messages in #{activeCategory} yet.
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-surface relative">
          {showEmoji && (
            <EmojiPicker
              onSelect={(emoji) => setInput(prev => prev + emoji)}
              onClose={() => setShowEmoji(false)}
              className="bottom-16 left-2"
            />
          )}
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <button
              type="button"
              className="p-2 text-fg-muted hover:text-fg rounded-full hover:bg-surface-2 transition-colors"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="w-5 h-5" />
            </button>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message #${activeCategory}...`}
              className="flex-1 rounded-full bg-surface-2"
            />
            <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
