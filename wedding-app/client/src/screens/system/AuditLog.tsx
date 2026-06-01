/**
 * AuditLog — View all organization activity.
 *
 * Shows a reverse-chronological feed of every action:
 * event creates, guest changes, RSVP submissions, login/logout,
 * contract signatures, settings changes, etc.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, Filter, User, Clock, Shield } from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkAuditLog } from '../../sdk/audit';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
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
  'org.branding.update': { label: 'Branding Updated',  color: 'info',    icon: '🎨' },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: 'default', icon: '📋' };
}

export function AuditLog({ orgId }: Props) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', orgId, actionFilter],
    queryFn: () => sdk.audit.list(orgId, {
      limit: 200,
      action: actionFilter ?? undefined,
    }),
  });

  const logs = data?.logs ?? [];

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!debouncedSearch) return logs;
    const q = debouncedSearch.toLowerCase();
    return logs.filter(l =>
      l.action.toLowerCase().includes(q) ||
      (l.actor_label ?? '').toLowerCase().includes(q) ||
      (l.target_type ?? '').toLowerCase().includes(q)
    );
  }, [logs, debouncedSearch]);

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
