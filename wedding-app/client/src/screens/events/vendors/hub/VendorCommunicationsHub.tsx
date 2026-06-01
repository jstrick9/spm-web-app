/**
 * VendorCommunicationsHub — Phase 22: wired to server messages API.
 *
 * Now uses GET/POST /api/messages/:threadId for real persistence
 * instead of hardcoded mock messages.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareQuote, Send, Search, Bell, Megaphone, FileText, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { sdk } from '../../../../sdk';
import { api } from '../../../../sdk/client';
import { Card } from '../../../../ui/Card';
import { Button } from '../../../../ui/Button';
import { Input } from '../../../../ui/Input';
import { Badge } from '../../../../ui/Badge';
import { cn } from '../../../../ui/lib/cn';
import { useToast } from '../../../../ui/Toast';

interface Props {
  eventId: string;
  organizationId: string;
}

interface Message {
  id: string;
  body: string;
  sender: 'venue' | 'vendor';
  time: string;
}

export function VendorCommunicationsHub({ eventId, organizationId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [messageMode, setMessageMode] = useState<'direct' | 'broadcast'>('direct');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendors', eventId],
    queryFn: () => sdk.vendors.list(organizationId, { eventId }),
  });

  const vendors = vendorData?.vendors || [];

  useEffect(() => {
    if (vendors.length > 0 && !activeVendorId) setActiveVendorId(vendors[0].id);
  }, [vendors, activeVendorId]);

  // Load messages from server when vendor changes
  const threadId = activeVendorId ? `vendor:${eventId}:${activeVendorId}` : null;

  const loadMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      const res: any = await api.get(`/api/messages/${encodeURIComponent(threadId)}`);
      const serverMsgs: Message[] = (res.messages ?? []).map((m: any) => ({
        id: m.id,
        body: m.body,
        sender: m.sender_role === 'vendor' ? 'vendor' : 'venue',
        time: m.created_at,
      }));
      setMessages(serverMsgs);
    } catch {
      setMessages([]);
    }
  }, [threadId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
  }, [messages]);

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.category && v.category.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (messageMode === 'broadcast') {
      // Send to all vendor threads
      for (const v of vendors) {
        const tid = `vendor:${eventId}:${v.id}`;
        try {
          await api.post(`/api/messages/${encodeURIComponent(tid)}`, { body: input.trim(), senderRole: 'venue' });
        } catch {}
      }
      toast({ title: 'Broadcast Sent', description: `Message delivered to ${vendors.length} vendors.`, variant: 'success' });
      setInput('');
      return;
    }

    if (!threadId) return;

    // Optimistic update
    const optimistic: Message = { id: `opt-${Date.now()}`, body: input.trim(), sender: 'venue', time: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setInput('');

    try {
      await api.post(`/api/messages/${encodeURIComponent(threadId)}`, { body: optimistic.body, senderRole: 'venue' });
      await loadMessages(); // Refresh from server
    } catch {
      toast({ title: 'Message failed', variant: 'destructive' });
    }
  };

  const insertTemplate = (text: string) => setInput(text);

  if (vendorLoading) return <div className="animate-pulse p-8 bg-surface-2 rounded text-center">Loading hub...</div>;

  return (
    <div className="flex flex-col lg:flex-row h-[400px] sm:h-[650px] border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
      {/* Left Panel: Vendor List */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border max-h-[200px] lg:max-h-none bg-surface-2/30 flex flex-col shrink-0">
        <div className="p-4 border-b border-border bg-surface">
          <h3 className="font-semibold text-fg flex items-center gap-2 mb-3">
            <MessageSquareQuote className="w-4 h-4 text-brand" /> Communications Hub
          </h3>
          <Input startSlot={<Search className="w-4 h-4 text-fg-muted" />} placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="bg-surface-2" />
        </div>

        <div className="p-2 border-b border-border bg-surface-2/50 flex gap-2">
          <Button variant={messageMode === 'direct' ? 'secondary' : 'ghost'} size="sm" className={cn("flex-1 text-xs", messageMode === 'direct' && "bg-white shadow-sm")} onClick={() => setMessageMode('direct')}>Direct Msg</Button>
          <Button variant={messageMode === 'broadcast' ? 'secondary' : 'ghost'} size="sm" className={cn("flex-1 text-xs", messageMode === 'broadcast' && "bg-white shadow-sm")} onClick={() => setMessageMode('broadcast')}>Broadcast <Megaphone className="w-3 h-3 ml-1" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredVendors.map(v => (
            <button key={v.id} onClick={() => { setActiveVendorId(v.id); setMessageMode('direct'); }}
              className={cn("w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors",
                activeVendorId === v.id && messageMode === 'direct' ? "bg-brand text-brand-fg shadow-md" : "hover:bg-surface-2 text-fg")}>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{v.name}</div>
                <div className={cn("text-[10px] uppercase tracking-wider truncate mt-0.5", activeVendorId === v.id && messageMode === 'direct' ? "text-brand-fg/80" : "text-fg-subtle")}>{v.category}</div>
              </div>
              {activeVendorId === v.id && messageMode === 'direct' && <ChevronRight className="w-4 h-4 shrink-0" />}
            </button>
          ))}
          {filteredVendors.length === 0 && <div className="text-center text-xs text-fg-muted py-8">No vendors found.</div>}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col bg-surface min-w-0">
        {messageMode === 'broadcast' ? (
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-border bg-brand-soft/20 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center text-brand shrink-0"><Megaphone className="w-6 h-6" /></div>
              <div>
                <h2 className="text-xl font-semibold text-fg">Broadcast Announcement</h2>
                <p className="text-sm text-fg-muted mt-1">Send a mass message to all {vendors.length} vendors.</p>
              </div>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-center items-center opacity-50"><MessageSquareQuote className="w-16 h-16 text-fg-subtle mb-4" /><p>Replies will open in Direct Message threads.</p></div>
          </div>
        ) : activeVendorId ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-border bg-surface flex justify-between items-center shadow-sm z-10">
              <div>
                <div className="font-semibold text-fg">{vendors.find(v => v.id === activeVendorId)?.name}</div>
                <div className="text-xs text-success flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> External Portal Active</div>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-2/20">
              {messages.length === 0 && <div className="text-center text-fg-muted text-sm py-12">No messages yet. Start the conversation!</div>}
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.sender === 'venue' ? "ml-auto items-end" : "mr-auto items-start")}>
                  <div className={cn("px-4 py-2.5 rounded-2xl text-sm shadow-sm", msg.sender === 'venue' ? "bg-brand text-brand-fg rounded-br-sm" : "bg-white border border-border text-fg rounded-bl-sm")}>{msg.body}</div>
                  <div className="text-[10px] text-fg-subtle mt-1.5 px-1">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-fg-muted">Select a vendor to message</div>
        )}

        {/* Input + Templates */}
        <div className="p-4 bg-surface border-t border-border">
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            <Button variant="outline" size="xs" className="text-[10px] shrink-0 h-6" onClick={() => insertTemplate("Please upload your Certificate of Insurance (COI) via the portal.")}><FileText className="w-3 h-3 mr-1" /> Request COI</Button>
            <Button variant="outline" size="xs" className="text-[10px] shrink-0 h-6" onClick={() => insertTemplate("Just confirming your load-in time for the event. Please verify.")}><Clock className="w-3 h-3 mr-1" /> Confirm Load-in</Button>
            <Button variant="outline" size="xs" className="text-[10px] shrink-0 h-6" onClick={() => insertTemplate("Please check in at the front desk upon arrival.")}><Bell className="w-3 h-3 mr-1" /> Arrival Instructions</Button>
          </div>
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder={messageMode === 'broadcast' ? "Type broadcast..." : "Type message..."} className="flex-1 bg-surface-2 min-h-[44px]" />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled={!input.trim()}><Send className="w-4 h-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
