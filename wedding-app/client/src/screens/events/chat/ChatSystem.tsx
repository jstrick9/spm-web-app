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
// (mountedRef below guards async setState after unmount)
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
  // True while the component is mounted. Async handlers (load + send) consult
  // this before calling setState so a network/IndexedDB op that resolves after
  // unmount can't trigger "setState on unmounted component" (which surfaces as
  // "window is not defined" under jsdom teardown in the test suite).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Build thread ID from event + category
  const threadId = `${eventId}:${activeCategory}`;

  // ─── Load messages: server-first, IndexedDB fallback ──
  // `isMounted` lets the caller (the effect below) cancel state updates after
  // unmount. Without it, the async IndexedDB/network work can resolve after the
  // component is gone — leaking a React "setState on unmounted component" and,
  // under jsdom teardown, throwing "window is not defined".
  const loadMessages = useCallback(async (isMounted: () => boolean = () => true) => {
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

      // Persist server messages to IndexedDB for offline access first, then
      // commit state only if still mounted.
      for (const msg of serverMsgs) {
        await saveMessage(msg);
      }
      if (!isMounted()) return;
      setMessages(merged);
      setServerOnline(true);
    } catch {
      // Offline: load from IndexedDB
      const localMsgs = await getMessages(eventId, activeCategory);
      if (!isMounted()) return;
      setServerOnline(false);
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
        if (!isMounted()) return;
        setMessages([welcome]);
      } else {
        setMessages(localMsgs);
      }
    }
  }, [eventId, activeCategory, threadId, currentUser.id]);

  useEffect(() => {
    let mounted = true;
    loadMessages(() => mounted);
    return () => { mounted = false; };
  }, [loadMessages]);

  // ─── Background Sync Loop for Unsynced Messages (N12 fix) ───
  useEffect(() => {
    let active = true;
    
    const syncUnsyncedMessages = async () => {
      try {
        const localMsgs = await getMessages(eventId, activeCategory);
        const unsynced = localMsgs.filter(m => !m.synced);
        if (unsynced.length === 0) return;

        for (const msg of unsynced) {
          try {
            const res: any = await api.post(`/api/messages/${encodeURIComponent(eventId + ':' + msg.threadId)}`, {
              body: msg.body,
              senderRole: 'planner',
            });
            const syncedMsg = {
              ...msg,
              id: res.message?.id ?? msg.id,
              synced: true,
            };
            await saveMessage(syncedMsg);
            
            if (active) {
              setMessages(prev => prev.map(m => m.id === msg.id ? syncedMsg : m));
            }
          } catch {
            // Keep as unsynced, retry next interval
          }
        }
      } catch {}
    };

    const interval = setInterval(() => {
      if (serverOnline) {
        syncUnsyncedMessages();
      }
    }, 15000); // retry every 15s

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [eventId, activeCategory, serverOnline]);

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
      if (!mountedRef.current) return;
      setMessages(prev =>
        prev.map(m => m.id === newMsg.id ? serverMsg : m)
      );
      setServerOnline(true);
    } catch {
      // Save locally — will sync later
      await saveMessage(newMsg);
      if (!mountedRef.current) return;
      setServerOnline(false);
    }
  };

  // Filter messages for current thread
  const threadMessages = messages.filter(m => m.threadId === activeCategory);

  return (
    <Card className="flex flex-col h-[400px] sm:h-[600px] border border-[#e1d5c9] bg-[#FDFBF7] shadow-lg">
      <CardHeader className="py-3.5 px-5 border-b border-[#e1d5c9] bg-[#FDFBF7] flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-serif font-bold text-fg flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand" />
          Event Communications &amp; Direct Messaging
          {serverOnline ? (
            <Wifi className="w-3.5 h-3.5 text-success animate-pulse" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-warning animate-bounce" />
          )}
        </CardTitle>
        <div className="flex gap-1.5 bg-[#FDFBF7] p-1 rounded-xl border border-[#e1d5c9] shadow-xs">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all duration-150",
                activeCategory === c
                  ? (c === 'urgent' ? 'bg-danger text-danger-fg font-bold' : 'bg-brand text-brand-fg font-bold shadow-sm')
                  : 'text-fg-subtle hover:text-fg hover:bg-brand-soft/20'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-[#FDFBF7]/30">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {threadMessages.map(msg => (
            <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.isOwn ? "ml-auto items-end" : "mr-auto items-start")}>
              <div className="text-[10px] text-fg-subtle mb-1 px-1 font-bold">
                {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {!msg.synced && <span className="ml-1 text-warning" title="Pending sync">●</span>}
              </div>
              <div className={cn(
                "px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold shadow-xs",
                msg.isOwn
                  ? "bg-brand text-brand-fg rounded-br-sm font-bold"
                  : "bg-white border border-[#e1d5c9] text-fg rounded-bl-sm"
              )}>
                {msg.body}
              </div>
            </div>
          ))}
          {threadMessages.length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-fg-subtle italic font-serif">
              No messages in #{activeCategory} yet.
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#e1d5c9] bg-[#FDFBF7] relative">
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
              className="p-2 text-fg-muted hover:text-fg rounded-full hover:bg-brand-soft/20 transition-all duration-150"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="w-5 h-5 text-brand" />
            </button>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message #${activeCategory}...`}
              className="flex-1 rounded-full bg-white border border-[#e1d5c9] h-9 text-xs"
            />
            <Button type="submit" size="icon" className="rounded-full shrink-0 h-9 w-9" disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
