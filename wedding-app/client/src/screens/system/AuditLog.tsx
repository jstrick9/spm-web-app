/**
 * AuditLog — View all organization activity.
 *
 * Shows a reverse-chronological feed of every action:
 * event creates, guest changes, RSVP submissions, login/logout,
 * contract signatures, settings changes, etc.
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, Filter, User, Clock, Shield, KeyRound, TabletSmartphone, UserCog, AlertTriangle } from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkAuditLog } from '../../sdk/audit';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Skeleton } from '../../ui/Skeleton';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

interface Props { orgId: string }

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  'event.create':       { label: 'Event Created',       color: 'success', icon: '📅' },
  'event.update':       { label: 'Event Updated',       color: 'info',    icon: '✏️' },
  'event.delete':       { label: 'Event Deleted',       color: 'danger',  icon: '🗑️' },
  'guest.create':       { label: 'Guest Added',         color: 'success', icon: '👤' },
  'rsvp.submit':        { label: 'RSVP Submitted',      color: 'brand',   icon: '💌' },
  'contract.create':    { label: 'Contract Created',    color: 'success', icon: '📝' },
  'contract.signed':    { label: 'Contract Signed',     color: 'success', icon: '✅' },
  'vendor.create':      { label: 'Vendor Added',        color: 'info',    icon: '🏢' },
  'budget.create':      { label: 'Budget Item Added',   color: 'info',    icon: '💰' },
  'webhook.create':     { label: 'Webhook Created',     color: 'info',    icon: '🔗' },
  'webhook.delete':     { label: 'Webhook Deleted',     color: 'danger',  icon: '🔗' },
  'user.login':         { label: 'User Login',          color: 'default', icon: '🔑' },
  'user.logout':        { label: 'User Logout',         color: 'default', icon: '🚪' },
  'user.password.change': { label: 'Password Changed', color: 'warning', icon: '🔒' },
  'user.password.reset.request': { label: 'Password Reset Requested', color: 'warning', icon: '📧' },
  'user.password.reset.complete': { label: 'Password Reset Completed', color: 'success', icon: '🔐' },
  'member.invite.pending_user': { label: 'Team Invite Sent', color: 'info', icon: '✉️' },
  'member.invite.existing_user': { label: 'Team Member Added', color: 'success', icon: '👥' },
  'org.branding.update': { label: 'Branding Updated',  color: 'info',    icon: '🎨' },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: 'default', icon: '📋' };
}

function renderAuditDetails(log: SdkAuditLog) {
  if (!log.details || log.details === '{}') return null;
  try {
    const details = JSON.parse(log.details);
    if (log.action === 'user.password.reset.request') {
      return <div className="mt-2 rounded bg-surface-2 px-2 py-1 text-xs text-fg-muted">Delivery: <strong>{details.delivery}</strong>{details.queued !== undefined ? ` • queued: ${String(details.queued)}` : ''}{details.error ? ` • ${details.error}` : ''}</div>;
    }
    if (log.action.startsWith('member.invite')) {
      const delivery = details.delivery;
      return <div className="mt-2 rounded bg-surface-2 px-2 py-1 text-xs text-fg-muted">Invite: <strong>{details.email}</strong>{details.roleKey ? ` • role: ${details.roleKey}` : ''}{delivery?.channel ? ` • delivery: ${delivery.channel}` : ''}</div>;
    }
  } catch { /* ignore malformed details */ }
  return null;
}

export function AuditLog({ orgId }: Props) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [before, setBefore] = useState<string | undefined>(undefined);
  const [managerAuditFilter, setManagerAuditFilter] = useState<'all' | 'manager_ops' | 'pii' | 'approvals' | 'communications'>('all');
  const currentUserQuery = useQuery({ queryKey: ['me', 'audit-role'], queryFn: () => sdk.auth.me(), staleTime: 60_000 });
  const managerMode = currentUserQuery.data ? (currentUserQuery.data.memberships?.some((membership: any) => membership.organizationId === orgId && String(membership.roleKey).toLowerCase() === 'manager') ?? false) : (typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager');
  const debouncedSearch = useDebouncedValue(search, 250);
  // A new search starts from the newest page.
  useEffect(() => { setBefore(undefined); }, [debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', orgId, actionFilter, before, debouncedSearch],
    queryFn: () => sdk.audit.list(orgId, {
      limit: 200,
      action: actionFilter ?? undefined,
      before,
      actorEmail: debouncedSearch.includes('@') ? debouncedSearch : undefined,
    }),
  });

  const logs = data?.logs ?? [];

  // Client-side search filter
  const filtered = useMemo(() => {
    let out = logs;
    if (managerAuditFilter !== 'all') {
      out = out.filter((log) => {
        const haystack = `${log.action} ${log.target_type || ''} ${log.details || ''}`.toLowerCase();
        if (managerAuditFilter === 'manager_ops') return /guest|vendor|staff|timeline|layout|portal|checkin|communication|broadcast|health/.test(haystack);
        if (managerAuditFilter === 'pii') return /guest|rsvp|portal|contact|email|phone|pii/.test(haystack);
        if (managerAuditFilter === 'approvals') return /approval|approved|rejected|owner|delegated|portalchange|go_no_go/.test(haystack);
        if (managerAuditFilter === 'communications') return /message|broadcast|communication|email|sms|invite|notification/.test(haystack);
        return true;
      });
    }
    if (!debouncedSearch) return out;
    const q = debouncedSearch.toLowerCase();
    return out.filter(l =>
      l.action.toLowerCase().includes(q) ||
      (l.actor_label ?? '').toLowerCase().includes(q) ||
      (l.target_type ?? '').toLowerCase().includes(q)
    );
  }, [logs, debouncedSearch, managerAuditFilter]);

  // Extract unique action types for filter chips
  const actionTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const l of logs) {
      types.set(l.action, (types.get(l.action) ?? 0) + 1);
    }
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [logs]);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="A chronological record of all actions taken in your organization."
      />
      <PageBody className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
            <Input placeholder="Search actions, users…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 sm:pb-0 sm:overflow-visible">
            <button
              onClick={() => setActionFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                ${!actionFilter ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'}`}
            >
              All ({logs.length})
            </button>
            {actionTypes.map(([action, count]) => {
              const meta = getActionMeta(action);
              return (
                <button
                  key={action}
                  onClick={() => setActionFilter(actionFilter === action ? null : action)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                    ${actionFilter === action ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'}`}
                >
                  {meta.icon} {meta.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {managerMode && (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-brand/20 bg-brand-soft/5">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4 text-brand" /> Manager permission policy template</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-xs text-fg-muted">
                <div className="grid gap-2 sm:grid-cols-2">
                  <SecurityPolicyItem label="Can run operations" detail="events, guests, vendors, timeline, layout review, staff, check-in, messages, reports" />
                  <SecurityPolicyItem label="Must escalate owner/admin" detail="billing, destructive restores, role changes, provider credentials, legal/finance approvals" />
                  <SecurityPolicyItem label="Per-event manager access scope" detail="Managers should only access assigned event workspaces and relevant PII for operational purposes." />
                  <SecurityPolicyItem label="Delegated approval workflow" detail="Manager requests → owner/admin review → approved/rejected/resolved audit trail." />
                </div>
              </CardContent>
            </Card>
            <Card className="border-warning/30 bg-warning-soft/20">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TabletSmartphone className="h-4 w-4 text-warning" /> Shared tablet/kiosk session security</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs text-fg-muted">
                <p><strong>Use kiosk/shared tablet mode only on trusted devices.</strong> Sign out after check-in, keep device passcode enabled, avoid saving passwords, and keep guest/vendor PII out of screenshots.</p>
                <p><KeyRound className="inline h-3.5 w-3.5 mr-1" /> If a device is lost, owner/admin should revoke sessions and rotate shared credentials immediately.</p>
                <p><AlertTriangle className="inline h-3.5 w-3.5 mr-1" /> Sensitive manager actions require confirmation: broadcasts, portal toggles, approvals, exports, and bulk guest/contact operations.</p>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-brand" /> Manager audit filters & PII access report</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'All activity'],
                    ['manager_ops', 'Manager operations'],
                    ['pii', 'PII access'],
                    ['approvals', 'Approvals / delegation'],
                    ['communications', 'Messages / broadcasts'],
                  ] as const).map(([id, label]) => <button key={id} onClick={() => setManagerAuditFilter(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${managerAuditFilter === id ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-fg-muted'}`}>{label}</button>)}
                </div>
                <div className="grid gap-2 sm:grid-cols-4 text-xs">
                  <SecurityPolicyItem label="PII events" detail={`${logs.filter(l => /guest|rsvp|portal|contact|email|phone/i.test(`${l.action} ${l.target_type} ${l.details}`)).length} matching audit record(s)`} />
                  <SecurityPolicyItem label="Approvals" detail={`${logs.filter(l => /approval|approved|rejected|delegated/i.test(`${l.action} ${l.details}`)).length} approval-related record(s)`} />
                  <SecurityPolicyItem label="Messages" detail={`${logs.filter(l => /message|broadcast|communication|invite|email|sms/i.test(`${l.action} ${l.details}`)).length} communication record(s)`} />
                  <SecurityPolicyItem label="Current filter" detail={`${filtered.length} visible record(s)`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pager (UX-08: server-side paging via nextBefore) */}
        {!isLoading && data && data.total > data.logs.length && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-xs text-fg-muted">
              Showing {data.logs.length} of {data.total} record(s)
              {actionFilter ? ` for ${getActionMeta(actionFilter).label}` : ''}
            </p>
            <div className="flex gap-2">
              <Button size="xs" variant="outline" disabled={!before} onClick={() => setBefore(undefined)}>Newest</Button>
              <Button size="xs" variant="outline" disabled={!data.nextBefore} onClick={() => setBefore(data.nextBefore)}>Older</Button>
            </div>
          </div>
        )}

        {/* Log entries */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-fg-muted text-sm">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-fg-subtle" />
              {search || actionFilter ? 'No logs match your filters.' : 'No activity recorded yet.'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {filtered.map(log => {
                const meta = getActionMeta(log.action);
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/30 transition-colors">
                    <span className="text-lg mt-0.5 shrink-0" aria-hidden>{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-fg">{meta.label}</span>
                        {log.target_type && (
                          <Badge variant="outline" className="text-[10px]">{log.target_type}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-fg-muted">
                        {log.actor_label && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {log.actor_label}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(log.created_at).toLocaleString()}
                        </span>
                        {log.ip && (
                          <span className="text-fg-subtle">{log.ip}</span>
                        )}
                      </div>
                      {renderAuditDetails(log)}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}


function SecurityPolicyItem({ label, detail }: { label: string; detail: string }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-xs font-bold text-fg">{label}</div><p className="mt-1 text-[11px] text-fg-muted">{detail}</p></div>;
}
