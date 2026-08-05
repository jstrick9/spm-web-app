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
import { Badge } from '../../../ui/Badge';
import { Bell, CheckCircle2, Clock, MessageSquare, Send, ShieldAlert, Smile, Users, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../../ui/lib/cn';
import { SdkUser } from '../../../sdk/types';
import { getMessages, saveMessage, ChatMessage } from '../../../lib/db/chatDB';
import { EmojiPicker } from '../../../ui/EmojiPicker';
import { api, getToken } from '../../../sdk/client';
import { usePrompt } from '../../../ui/usePrompt';

interface Props {
  eventId: string;
  currentUser: SdkUser;
  /** The sender's role label for server-side thread attribution. */
  senderRole?: string;
}

const CATEGORIES = ['general', 'layout', 'logistics', 'vendors', 'urgent'] as const;
type Category = typeof CATEGORIES[number];

export function ChatSystem({ eventId, currentUser, senderRole = 'staff' }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [showEmoji, setShowEmoji] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'staff' | 'vendors' | 'guests' | 'all'>('staff');
  const [broadcastChannel, setBroadcastChannel] = useState<'in_app' | 'sms' | 'email' | 'all'>('in_app');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'fyi' | 'action_needed' | 'urgent' | 'owner_escalation'>('action_needed');
  const [quietHoursOverride, setQuietHoursOverride] = useState(false);
  const [communicationAudit, setCommunicationAudit] = useState<any[]>([]);
  const [broadcastRecipients, setBroadcastRecipients] = useState<any[]>([]);
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
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';

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
        senderName: m.sender_role ? m.sender_role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'User',
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

  const loadCommunicationAudit = useCallback(async () => {
    try {
      const res: any = await api.get(`/api/events/${eventId}/communications`);
      setCommunicationAudit(res.communications?.broadcasts || []);
      setBroadcastRecipients(res.communications?.recipients || []);
    } catch { /* ignore when not permitted/offline */ }
  }, [eventId]);

  useEffect(() => {
    let mounted = true;
    loadMessages(() => mounted);
    if (managerMode) void loadCommunicationAudit();
    return () => { mounted = false; };
  }, [loadMessages, loadCommunicationAudit, managerMode]);

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
              senderRole,
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
        senderRole,
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

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    const sensitive = broadcastSeverity === 'urgent' || broadcastSeverity === 'owner_escalation' || broadcastChannel === 'sms' || broadcastChannel === 'all';
    if (managerMode && sensitive && !(await askConfirm({ title: 'Sensitive manager broadcast?', description: 'This may notify staff/vendors/guests and will be audit logged.', destructive: true }))) return;
    const payload = { title: broadcastTitle.trim(), body: broadcastBody.trim(), audience: broadcastAudience, channel: broadcastChannel, severity: broadcastSeverity, quietHoursOverride, approvalRequired: broadcastSeverity === 'owner_escalation' };
    try {
      const res: any = await api.post(`/api/events/${eventId}/communications/broadcast`, payload);
      setCommunicationAudit(prev => [res.broadcast, ...prev]);
      setBroadcastRecipients(prev => [...(res.recipients || []), ...prev]);
      setBroadcastTitle(''); setBroadcastBody(''); setQuietHoursOverride(false);
      setActiveCategory('urgent');
      await loadMessages();
      await loadCommunicationAudit();
    } catch {
      const localAudit = { id: `local-broadcast-${Date.now()}`, ...payload, recipient_count: 0, delivery_status: 'queued', created_at: new Date().toISOString(), approval_required: payload.approvalRequired ? 1 : 0, quiet_hours_override: quietHoursOverride ? 1 : 0 };
      setCommunicationAudit(prev => [localAudit, ...prev]);
      await saveMessage({ id: localAudit.id, eventId, threadId: 'urgent', senderId: currentUser.id, senderName: currentUser.fullName || 'Manager', body: `[${broadcastSeverity.toUpperCase()}] ${broadcastTitle}
${broadcastBody}`, createdAt: localAudit.created_at, isOwn: true, synced: false });
      setServerOnline(false);
    }
  };

  // Filter messages for current thread
  const threadMessages = messages.filter(m => m.threadId === activeCategory);

  return (
    <Card className="flex flex-col h-[400px] sm:h-[600px] border border-paper-border bg-paper shadow-lg">
      {promptNode}
      <CardHeader className="py-3.5 px-5 border-b border-paper-border bg-paper flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-serif font-bold text-fg flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand" />
          Event Communications &amp; Direct Messaging
          {serverOnline ? (
            <Wifi className="w-3.5 h-3.5 text-success animate-pulse" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-warning animate-bounce" />
          )}
        </CardTitle>
        <div className="flex gap-1.5 bg-paper p-1 rounded-xl border border-paper-border shadow-xs">
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

      {managerMode && (
        <div className="border-b border-paper-border bg-white/70 p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-border bg-paper p-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-sm font-bold text-brand flex items-center gap-2"><Bell className="h-4 w-4" /> Operations broadcast composer</h3><p className="text-xs text-fg-muted">Staff/vendor SMS/email/in-app workflow with severity, quiet hours, and approval rules.</p></div>
                <Badge variant={broadcastSeverity === 'urgent' || broadcastSeverity === 'owner_escalation' ? 'danger' : broadcastSeverity === 'action_needed' ? 'warning' : 'outline'}>{broadcastSeverity.replace('_', ' ')}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <select value={broadcastSeverity} onChange={(e) => setBroadcastSeverity(e.target.value as any)} className="rounded-md border border-border bg-surface px-2 py-2 text-xs"><option value="fyi">FYI</option><option value="action_needed">Action needed</option><option value="urgent">Urgent</option><option value="owner_escalation">Owner escalation</option></select>
                <select value={broadcastAudience} onChange={(e) => setBroadcastAudience(e.target.value as any)} className="rounded-md border border-border bg-surface px-2 py-2 text-xs"><option value="staff">Staff</option><option value="vendors">Vendors</option><option value="guests">Guests</option><option value="all">All</option></select>
                <select value={broadcastChannel} onChange={(e) => setBroadcastChannel(e.target.value as any)} className="rounded-md border border-border bg-surface px-2 py-2 text-xs"><option value="in_app">In-app</option><option value="sms">SMS</option><option value="email">Email</option><option value="all">All channels</option></select>
                <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-2 text-xs font-bold"><input type="checkbox" checked={quietHoursOverride} onChange={(e) => setQuietHoursOverride(e.target.checked)} /> Event-day override</label>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_auto]"><Input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Broadcast title" /><Input value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="Message template or custom broadcast body" /><Button disabled={!broadcastTitle.trim() || !broadcastBody.trim()} onClick={sendBroadcast}><Send className="h-4 w-4" /> Broadcast</Button></div>
              <div className="flex flex-wrap gap-2 text-xs"><Button size="xs" variant="outline" onClick={() => { setBroadcastTitle('Vendor load-in update'); setBroadcastBody('Please confirm arrival status and use the marked load-in route.'); setBroadcastAudience('vendors'); setBroadcastChannel('sms'); }}>Vendor load-in</Button><Button size="xs" variant="outline" onClick={() => { setBroadcastTitle('Staff standby'); setBroadcastBody('All staff please stand by for the next timeline cue.'); setBroadcastAudience('staff'); setBroadcastChannel('in_app'); }}>Staff standby</Button><Button size="xs" variant="outline" onClick={() => { setBroadcastTitle('Urgent owner escalation'); setBroadcastBody('Owner/admin approval is needed before proceeding.'); setBroadcastSeverity('owner_escalation'); setBroadcastAudience('all'); }}>Owner escalation</Button></div>
            </div>
            <div className="rounded-xl border border-border bg-paper p-3">
              <h3 className="text-sm font-bold text-brand flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Communication approval rules</h3>
              <div className="mt-3 space-y-2 text-xs text-fg-muted"><div><strong>FYI:</strong> no approval required.</div><div><strong>Action needed:</strong> manager can send to staff/vendors.</div><div><strong>Urgent:</strong> event-day override can bypass quiet hours.</div><div><strong>Owner escalation:</strong> queued for owner/admin approval visibility.</div></div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-3"><h3 className="text-xs font-bold text-brand flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Delivery status center</h3><div className="mt-2 space-y-2">{communicationAudit.slice(0, 4).map((entry) => <div key={entry.id} className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><div className="flex justify-between gap-2"><strong>{entry.title}</strong><Badge variant={entry.delivery_status === 'sent' ? 'success' : entry.delivery_status === 'failed' ? 'danger' : 'warning'}>{entry.delivery_status}</Badge></div><div className="text-fg-muted">{entry.audience} · {entry.channel} · {entry.recipient_count || 0} recipient(s)</div></div>)}{communicationAudit.length === 0 && <p className="text-xs text-fg-muted">No broadcasts logged yet.</p>}</div></div>
            <div className="rounded-xl border border-border bg-surface p-3"><h3 className="text-xs font-bold text-brand flex items-center gap-2"><Users className="h-4 w-4" /> Who received this?</h3><div className="mt-2 space-y-2">{broadcastRecipients.slice(0, 5).map((recipient) => <div key={recipient.id || `${recipient.recipientLabel}-${recipient.channel}`} className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><strong>{recipient.recipient_label || recipient.recipientLabel}</strong><div className="text-fg-muted">{recipient.recipient_type || recipient.recipientType} · {recipient.channel} · {recipient.status || 'queued'}</div></div>)}{broadcastRecipients.length === 0 && <p className="text-xs text-fg-muted">Recipients appear after the first broadcast. Use this for “who received this?” visibility.</p>}</div></div>
          </div>
        </div>
      )}

      <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-paper/30">
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
                  : "bg-white border border-paper-border text-fg rounded-bl-sm"
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

        <div className="p-3 border-t border-paper-border bg-paper relative">
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
              className="flex-1 rounded-full bg-white border border-paper-border h-9 text-xs"
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
