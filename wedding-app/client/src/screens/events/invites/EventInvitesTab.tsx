/**
 * EventInvitesTab — Phase 24: wired to real invite_tracking backend.
 *
 * "Send to Guests" now calls POST /api/events/:eventId/invite-tracking/send
 * and the tracking view reads real status from the server.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, LayoutTemplate, Send, Eye, Type, Image as ImageIcon, MapPin, Calendar as CalIcon, ChevronUp, ChevronDown, Trash2, Download } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import { DataTable, type Column } from '../../../ui/DataTable';
import { StatCard } from '../../../ui/StatCard';
import { cn } from '../../../ui/lib/cn';
import { LifecycleEmailsPanel } from './LifecycleEmailsPanel';

interface Props { eventId: string }

type BlockType = 'text' | 'image' | 'button' | 'map' | 'schedule';
type TemplateType = 'formal' | 'modern' | 'garden';

interface Block { id: string; type: BlockType; content: string }

export function EventInvitesTab({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState<'builder' | 'tracking'>('builder');

  // Builder state
  const [template, setTemplate] = useState<TemplateType>('formal');
  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'text', content: 'You are joyfully invited to the wedding of' },
    { id: '2', type: 'text', content: 'Sarah & James' },
    { id: '3', type: 'button', content: 'RSVP Now' },
  ]);

  // ── Real data ─────────────────────────────────────────
  const { data: guestsData } = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => sdk.guests.list(eventId),
  });
  const guests = guestsData?.guests || [];

  const { data: trackingData } = useQuery({
    queryKey: ['invite-tracking', eventId],
    queryFn: () => sdk.inviteTracking.list(eventId),
  });
  const statusMap = trackingData?.statusMap || {};
  const counts = trackingData?.counts || { notSent: 0, sent: 0, opened: 0, bounced: 0 };

  // ── Send to all guests (server call) ──────────────────
  const sendMutation = useMutation({
    mutationFn: () => sdk.inviteTracking.bulkSend(eventId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invite-tracking', eventId] });
      toast({ title: 'Invitations Sent!', description: `Dispatched to ${res.sent} guests.`, variant: 'success' });
      setView('tracking');
    },
    onError: () => toast({ title: 'Send failed', variant: 'destructive' }),
  });

  // ── Builder helpers ───────────────────────────────────
  const handleAddBlock = (type: BlockType) => {
    const defaults: Record<BlockType, string> = {
      text: 'Enter text here...', image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80',
      button: 'RSVP Now', map: '123 Venue Street, City, ST 12345', schedule: 'Ceremony: 4:00 PM\nReception: 6:00 PM',
    };
    setBlocks([...blocks, { id: Date.now().toString(), type, content: defaults[type] }]);
  };
  const updateBlock = (id: string, content: string) => setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  const moveBlock = (i: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? i - 1 : i + 1;
    if (t < 0 || t >= blocks.length) return;
    const nb = [...blocks]; [nb[i], nb[t]] = [nb[t], nb[i]]; setBlocks(nb);
  };
  const removeBlock = (id: string) => setBlocks(blocks.filter(b => b.id !== id));

  const handleSaveHtml = () => {
    const htmlContent = `<!DOCTYPE html><html><head><title>Wedding Invitation</title>
      <style>body{font-family:${template === 'formal' ? 'Georgia,serif' : template === 'modern' ? 'Helvetica,sans-serif' : 'Palatino,serif'};text-align:center;background:${template === 'garden' ? '#fdfbf7' : '#fff'};padding:40px;}.container{max-width:600px;margin:0 auto;padding:40px;}.btn{display:inline-block;padding:12px 24px;background:#be185d;color:white;text-decoration:none;border-radius:4px;margin:20px 0;}img{max-width:100%;border-radius:8px;margin:20px 0;}</style>
      </head><body><div class="container">
      ${blocks.map(b => {
        if (b.type === 'text') return `<p style="font-size:18px;margin:10px 0;">${b.content.replace(/\n/g, '<br/>')}</p>`;
        if (b.type === 'image') return `<img src="${b.content}" alt="" />`;
        if (b.type === 'button') return `<a href="#" class="btn">${b.content}</a>`;
        if (b.type === 'map') return `<p>📍 <a href="https://maps.google.com/?q=${encodeURIComponent(b.content)}">${b.content}</a></p>`;
        if (b.type === 'schedule') return `<div style="margin:20px 0;padding:20px;background:rgba(0,0,0,0.05);border-radius:8px;"><strong>Schedule</strong><br/><br/>${b.content.replace(/\n/g, '<br/>')}</div>`;
        return '';
      }).join('\n')}</div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `invitation_${template}.html`; a.click(); URL.revokeObjectURL(a.href);
    toast({ title: 'HTML Exported', variant: 'success' });
  };

  // ── Tracking table columns ────────────────────────────
  const columns: Column<typeof guests[0]>[] = [
    { id: 'name', header: 'Guest Name', cell: (g) => <span className="font-medium">{g.full_name}</span> },
    { id: 'email', header: 'Email', cell: (g) => <span className="text-fg-muted">{g.email || '—'}</span> },
    { id: 'status', header: 'Invite Status', cell: (g) => {
      const s = statusMap[g.id];
      if (!s || s === 'not_sent') return <Badge variant="outline" className="text-[10px]">Not Sent</Badge>;
      if (s === 'opened') return <Badge variant="success" className="text-[10px]">Opened</Badge>;
      if (s === 'bounced') return <Badge variant="danger" className="text-[10px]">Bounced</Badge>;
      return <Badge variant="brand" className="text-[10px]">Sent</Badge>;
    }},
    { id: 'rsvp', header: 'RSVP', cell: (g) => (
      <Badge variant={g.rsvp_status === 'attending' ? 'success' : g.rsvp_status === 'declined' ? 'danger' : 'outline'} className="text-[10px] uppercase">{g.rsvp_status}</Badge>
    )},
    { id: 'link', header: 'Unique Link', cell: (g) => (
      <Button variant="ghost" size="xs" className="h-6" onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/#/portal/${eventId}?guest=${g.id}`);
        toast({ title: 'Link copied' });
      }}>Copy Link</Button>
    )},
  ];

  const totalSent = counts.sent + counts.opened + counts.bounced;
  const openRate = totalSent > 0 ? Math.round((counts.opened / totalSent) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* View toggle + actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div className="flex bg-surface-2 p-1 rounded-md">
          <button onClick={() => setView('builder')} className={cn("px-4 py-1.5 text-sm font-medium rounded transition-colors", view === 'builder' ? "bg-surface shadow-sm text-fg" : "text-fg-muted hover:text-fg")}>Design Invitation</button>
          <button onClick={() => setView('tracking')} className={cn("px-4 py-1.5 text-sm font-medium rounded transition-colors", view === 'tracking' ? "bg-surface shadow-sm text-fg" : "text-fg-muted hover:text-fg")}>Track Opens & Sends</button>
        </div>
        {view === 'builder' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveHtml}><Download className="w-4 h-4 mr-1" /> Export HTML</Button>
            <Button size="sm" onClick={() => sendMutation.mutate()} isLoading={sendMutation.isPending}>
              <Send className="w-4 h-4 mr-1" /> Send to Guests
            </Button>
          </div>
        )}
      </div>

      {/* BUILDER VIEW */}
      {view === 'builder' && (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 h-auto lg:h-[650px]">
          {/* Tools Panel */}
          <Card className="w-full lg:w-80 flex flex-col shrink-0 overflow-y-auto max-h-[300px] lg:max-h-none">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-brand" /> Editor Tools</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-fg-subtle">1. Select Theme</Label>
                <div className="grid grid-cols-3 gap-1 sm:gap-2">
                  {(['formal', 'modern', 'garden'] as const).map(t => (
                    <button key={t} onClick={() => setTemplate(t)} className={cn("p-2 text-xs capitalize rounded border text-center transition-colors", template === t ? "border-brand bg-brand-soft text-brand-strong font-medium" : "border-border bg-surface text-fg-muted hover:bg-surface-2")}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label className="mb-2 block text-xs uppercase tracking-wider text-fg-subtle">2. Add Content Blocks</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddBlock('text')}><Type className="w-3 h-3 mr-2" /> Text</Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddBlock('image')}><ImageIcon className="w-3 h-3 mr-2" /> Image</Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddBlock('button')}><Mail className="w-3 h-3 mr-2" /> Button</Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAddBlock('map')}><MapPin className="w-3 h-3 mr-2" /> Map Link</Button>
                  <Button variant="outline" size="sm" className="justify-start col-span-2" onClick={() => handleAddBlock('schedule')}><CalIcon className="w-3 h-3 mr-2" /> Schedule</Button>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="mb-2 block text-xs uppercase tracking-wider text-fg-subtle">3. Edit Blocks</Label>
                {blocks.map((block, i) => (
                  <div key={block.id} className="p-3 bg-surface-2 rounded border border-border space-y-2">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className="text-[10px] uppercase bg-surface">{block.type}</Badge>
                      <div className="flex gap-1">
                        <button onClick={() => moveBlock(i, 'up')} disabled={i === 0} className="p-1 hover:bg-surface rounded text-fg-muted disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                        <button onClick={() => moveBlock(i, 'down')} disabled={i === blocks.length - 1} className="p-1 hover:bg-surface rounded text-fg-muted disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                        <button onClick={() => removeBlock(block.id)} className="p-1 hover:bg-danger/10 hover:text-danger rounded text-fg-muted"><Trash2 className="w-3 h-3" /><span className="sr-only">Remove block</span></button>
                      </div>
                    </div>
                    {block.type === 'text' || block.type === 'schedule' ? (
                      <textarea className="w-full text-sm p-2 rounded border border-border bg-surface min-h-[60px]" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} />
                    ) : (
                      <Input className="h-8 text-sm" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <div className="flex-1 bg-surface-2 border border-border rounded-lg flex items-center justify-center p-4 overflow-y-auto">
            <div className={cn("w-full max-w-lg min-h-[500px] shadow-2xl transition-all duration-500 overflow-hidden relative",
              template === 'formal' ? "bg-white font-serif text-center border-[8px] border-double border-gray-200 p-12 text-gray-900" :
              template === 'modern' ? "bg-zinc-900 font-sans text-left p-10 text-white rounded-xl" :
              "bg-paper font-serif text-center border-4 border-paper-border p-10 text-[#2c3e2e]"
            )}>
              <div className="relative z-10 flex flex-col gap-6">
                {blocks.map((block) => {
                  if (block.type === 'text') return <div key={block.id} className="text-lg leading-relaxed whitespace-pre-wrap">{block.content}</div>;
                  if (block.type === 'image') return <img key={block.id} src={block.content} alt="" className="w-full rounded-md object-cover shadow-sm" />;
                  if (block.type === 'button') return <div key={block.id} className={cn("pt-4", template === 'modern' && "text-left")}><span className={cn("inline-block px-8 py-3 font-medium tracking-wider text-sm cursor-pointer", template === 'modern' ? "bg-white text-black rounded-full" : template === 'garden' ? "bg-[#2c3e2e] text-white rounded-md" : "bg-black text-white uppercase")}>{block.content}</span></div>;
                  if (block.type === 'map') return <div key={block.id} className="py-2 border-y border-current/20 flex flex-col items-center gap-2"><MapPin className="w-5 h-5 opacity-70" /><span className="text-sm font-medium">{block.content}</span></div>;
                  if (block.type === 'schedule') return <div key={block.id} className="bg-current/5 p-6 rounded-md"><h4 className="text-sm uppercase tracking-widest font-bold mb-4 opacity-70">Schedule</h4><div className="text-sm leading-loose whitespace-pre-wrap">{block.content}</div></div>;
                  return null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRACKING VIEW */}
      {view === 'tracking' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Guests" value={guests.length} />
            <StatCard label="Invites Sent" value={totalSent} />
            <StatCard label="Opened" value={counts.opened} />
            <StatCard label="Open Rate" value={totalSent > 0 ? `${openRate}%` : '—'} />
          </div>
          <Card>
            <DataTable data={guests} columns={columns} getRowKey={g => g.id} emptyMessage="No guests found to track." />
          </Card>
        </div>
      )}

      {/* Automated lifecycle emails (RSVP reminders, thank-yous, save-the-dates) */}
      <LifecycleEmailsPanel eventId={eventId} />
    </div>
  );
}
