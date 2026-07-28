/**
 * NotificationCenter — Phase 20: SSE-driven real-time notifications.
 *
 * Instead of hardcoded mock notifications, this now:
 *   1. Listens to SSE events via useSSE
 *   2. Accumulates recent events as notifications
 *   3. Shows unread count badge
 *   4. Click to navigate to relevant page
 *   5. Persists read state in localStorage
 */
import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, ExternalLink, SlidersHorizontal, ShieldAlert } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { cn } from '../../ui/lib/cn';
import { useRouter } from '../../lib/router';
import type { SSEEvent } from '../../sdk/sse';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  linkUrl?: string;
  severity?: 'fyi' | 'action_needed' | 'urgent' | 'owner_escalation';
}

const EVENT_META: Record<string, { title: string; message: (p: any) => string; linkUrl?: (p: any) => string }> = {
  'guest.created':   { title: 'New Guest Added',        message: (p) => `${p.name || 'A guest'} was added.`,     linkUrl: (p) => `/events/${p.eventId}?tab=guests` },
  'guest.updated':   { title: 'Guest Updated',          message: () => 'A guest record was updated.',            linkUrl: (p) => `/events/${p.eventId}?tab=guests` },
  'rsvp.submitted':  { title: 'New RSVP',               message: (p) => `RSVP ${p.attending ? 'accepted' : 'declined'}.`, linkUrl: (p) => `/events/${p.eventId}?tab=guests` },
  'event.created':   { title: 'New Event Created',       message: (p) => `"${p.title || 'New event'}" was created.`, linkUrl: (p) => `/events/${p.eventId}` },
  'event.updated':   { title: 'Event Updated',           message: (p) => `"${p.title || 'An event'}" was modified.`, linkUrl: (p) => `/events/${p.eventId}` },
  'budget.updated':  { title: 'Budget Changed',          message: () => 'A budget item was updated.',             linkUrl: (p) => `/events/${p.eventId}?tab=budget` },
  'layout.comment.resolved': { title: 'Layout Comment Resolved', message: () => 'A venue manager resolved a comment on your layout.', linkUrl: (p) => `/events/${p.eventId}?tab=layout` },
  'layout.reopen.accepted': { title: 'Layout Reopened', message: () => 'The venue created a new editable proposal draft from the approved layout.', linkUrl: (p) => `/events/${p.eventId}?tab=layout` },
  'layout.reopen.requested': { title: 'Layout Reopen Requested', message: () => 'A planner or couple requested changes to an approved layout.', linkUrl: (p) => `/events/${p.eventId}?tab=layout` },
  'layout.review.decided': { title: 'Venue Layout Decision', message: (p) => `Your layout was ${p.decision === 'changes_requested' ? 'returned for changes' : p.decision}. Open the revision review for details.`, linkUrl: (p) => `/events/${p.eventId}?tab=layout` },
  'webhook.test':    { title: 'Webhook Test',            message: () => 'A test webhook was dispatched.',         linkUrl: () => '/system/integrations' },
};

function severityFor(type: string): Notification['severity'] {
  if (/critical|incident|payment|contract|health|error|failed/i.test(type)) return 'urgent';
  if (/vendor|timeline|rsvp|guest|staff/i.test(type)) return 'action_needed';
  if (/owner|admin|approval/i.test(type)) return 'owner_escalation';
  return 'fyi';
}

const STORAGE_KEY = 'wvi_notifications_read';

function getReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveReadIds(ids: Set<string>) {
  // Keep last 100 to prevent unbounded growth
  const arr = Array.from(ids).slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [managerPreset, setManagerPreset] = useState(() => localStorage.getItem('wvi_manager_notification_preset') || 'balanced');
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const { navigate } = useRouter();

  // Listen for SSE events from the useSSE hook in useRealtimeInvalidation
  // We use a global event listener approach
  const handleSSEEvent = useCallback((event: CustomEvent<SSEEvent>) => {
    const e = event.detail;
    const meta = EVENT_META[e.type];
    if (!meta) return; // Ignore unknown event types

    const notif: Notification = {
      id: `sse-${e.id}`,
      type: e.type,
      title: meta.title,
      message: meta.message(e.payload),
      read: readIds.has(`sse-${e.id}`),
      timestamp: e.timestamp,
      linkUrl: meta.linkUrl?.(e.payload),
      severity: severityFor(e.type),
    };

    setNotifications(prev => {
      const existing = prev.find(n => n.id === notif.id);
      if (existing) return prev;
      return [notif, ...prev].slice(0, 50); // Keep last 50
    });
  }, [readIds]);

  useEffect(() => {
    window.addEventListener('wvi:sse-event', handleSSEEvent as EventListener);
    return () => window.removeEventListener('wvi:sse-event', handleSSEEvent as EventListener);
  }, [handleSSEEvent]);

  useEffect(() => {
    try { localStorage.setItem('wvi_manager_notification_preset', managerPreset); } catch {}
  }, [managerPreset]);

  const visibleNotifications = managerMode && managerPreset === 'urgent_only' ? notifications.filter(n => n.severity === 'urgent' || n.severity === 'owner_escalation') : notifications;
  const unreadCount = visibleNotifications.filter(n => !n.read && !readIds.has(n.id)).length;

  function markRead(id: string) {
    const newIds = new Set(readIds);
    newIds.add(id);
    setReadIds(newIds);
    saveReadIds(newIds);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    const newIds = new Set(readIds);
    visibleNotifications.forEach(n => newIds.add(n.id));
    setReadIds(newIds);
    saveReadIds(newIds);
    setNotifications(prev => prev.map(n => visibleNotifications.some(v => v.id === n.id) ? { ...n, read: true } : n));
  }

  function handleClick(notif: Notification) {
    markRead(notif.id);
    if (notif.linkUrl) {
      navigate(notif.linkUrl);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white" aria-live="polite" role="status">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-surface shadow-elev-2 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/50">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-brand hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {managerMode && (
              <div className="border-b border-border bg-brand-soft/10 p-3 text-xs">
                <div className="mb-2 flex items-center gap-2 font-bold text-brand"><SlidersHorizontal className="h-3.5 w-3.5" /> Manager notification center</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ['balanced', 'Balanced'],
                    ['urgent_only', 'Urgent only'],
                    ['event_day', 'Event-day'],
                  ].map(([id, label]) => <button key={id} onClick={() => setManagerPreset(id)} className={cn('rounded-md border px-2 py-1 font-semibold', managerPreset === id ? 'border-brand bg-brand text-brand-fg' : 'border-border bg-surface text-fg-muted')}>{label}</button>)}
                </div>
                <p className="mt-2 text-fg-muted"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" /> Severity levels: FYI · action needed · urgent · owner escalation. Quiet hours can be overridden for event-day urgent alerts.</p>
              </div>
            )}

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {visibleNotifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-fg-muted">
                  <Bell className="h-6 w-6 mx-auto mb-2 text-fg-subtle" />
                  No notifications yet.
                  <p className="text-xs mt-1">Activity from your team will appear here in real time.</p>
                </div>
              ) : (
                visibleNotifications.map(notif => {
                  const isUnread = !notif.read && !readIds.has(notif.id);
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-surface-2/50 transition-colors",
                        isUnread && "bg-brand/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {isUnread && (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-brand shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1"><p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>
                            {notif.title}
                          </p>{notif.severity && <Badge variant={notif.severity === 'urgent' || notif.severity === 'owner_escalation' ? 'danger' : notif.severity === 'action_needed' ? 'warning' : 'outline'} className="text-[9px]">{notif.severity.replace('_', ' ')}</Badge>}</div>
                          <p className="text-xs text-fg-muted mt-0.5 truncate">{notif.message}</p>
                          <p className="text-[10px] text-fg-subtle mt-1">
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {notif.linkUrl && (
                          <ExternalLink className="h-3 w-3 text-fg-subtle shrink-0 mt-1" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
