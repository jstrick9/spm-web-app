import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, BarChart3, Bell, BrainCircuit, CheckCircle2, ChevronRight, Clock, Info, Radio, ShieldAlert, UserCheck } from 'lucide-react';
import { sdk } from '../../sdk';
import type { HealthActionPriority, HealthActionSource } from '../../sdk/intelligence';
import { Badge } from '../../ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useToast } from '../../ui/Toast';
import { usePermission } from '../../lib/usePermission';

interface Props {
  orgId: string;
}

const PRIORITY_META: Record<HealthActionPriority, { label: string; badge: 'danger' | 'warning' | 'info' | 'success'; Icon: typeof Info }> = {
  critical: { label: 'Critical', badge: 'danger', Icon: AlertOctagon },
  high:     { label: 'High',     badge: 'warning',     Icon: AlertTriangle },
  medium:   { label: 'Medium',   badge: 'info',        Icon: Info },
  low:      { label: 'Low',      badge: 'success',     Icon: CheckCircle2 },
};

const SOURCE_LABEL: Record<HealthActionSource, string> = {
  risk: 'Event risk',
  forecast: 'Forecast',
  vendor_reliability: 'Vendor reliability',
  guest_identity: 'Guest identity',
  rsvp_lag: 'RSVP lag',
  timeline_completeness: 'Timeline completeness',
  contracts: 'Contracts',
  payments: 'Payments',
};

function fmtCents(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function operationalWhy(source: HealthActionSource): string {
  const map: Record<HealthActionSource, string> = {
    risk: 'This can change staffing, layout, vendor timing, or guest service plans before event day.',
    forecast: 'This is owner/admin planning context; managers should only act if it changes operational staffing or event load.',
    vendor_reliability: 'Vendor reliability issues can become late arrivals, missing equipment, poor communication, or day-of substitutions.',
    guest_identity: 'Duplicate guests create check-in confusion, wrong counts, seating mistakes, and meal count errors.',
    rsvp_lag: 'Late RSVPs affect catering counts, seating, staffing, rentals, and guest communications.',
    timeline_completeness: 'An incomplete run of show leaves staff and vendors without clear cues, owners, and fallback timing.',
    contracts: 'Contract gaps can block load-in, insurance, payment, alcohol, overtime, or owner approval decisions.',
    payments: 'Payment risk may require owner/admin approval before proceeding with final operations or vendor commitments.',
  };
  return map[source];
}

function simpleConfidence(confidence: 'high' | 'medium' | 'low') {
  return confidence === 'high'
    ? 'High confidence: multiple current signals point to the same issue.'
    : confidence === 'medium'
      ? 'Medium confidence: enough signal to review, but confirm details before acting.'
      : 'Low confidence: useful reminder, but data is limited or historical.';
}

function slaTargetHours(priority: string) {
  return priority === 'critical' ? 4 : priority === 'high' ? 12 : priority === 'medium' ? 24 : 72;
}

function managerActionOwner(action: any) {
  if (action.state?.assignedTo) return action.state.assignedTo;
  if (['vendor_reliability', 'timeline_completeness', 'rsvp_lag', 'guest_identity', 'risk'].includes(action.source)) return 'manager-team';
  return 'owner-admin';
}

export function EventHealthCommandCenter({ orgId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [managerFilter, setManagerFilter] = useState<'all' | 'mine' | 'event_day'>('all');
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const canViewBudget = usePermission('budget.view');
  const canViewContracts = usePermission('contracts.view');
  const updateAction = useMutation({ 
    mutationFn: ({ actionId, status, snoozedUntil, note }: { actionId: string; status: 'open' | 'acknowledged' | 'snoozed' | 'resolved'; snoozedUntil?: string | null; note?: string | null }) =>
      sdk.healthCommand.updateActionState(orgId, actionId, { status, snoozedUntil, note }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['health-command-center', orgId] });
      toast({ title: `Action ${vars.status}`, variant: 'success' });
    },
    onError: (err: any) => toast({ title: 'Could not update action', description: err.message, variant: 'destructive' }),
  });

  const { data, isLoading } = useQuery({ 
    queryKey: ['health-command-center', orgId],
    queryFn: () => sdk.healthCommand.get(orgId),
    staleTime: 60_000,
  });

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => sdk.auth.me(),
    enabled: managerMode,
  });

  const command = data?.commandCenter;

  useEffect(() => {
    if ((command?.summary.criticalActions ?? 0) > 0) {
      toast({ title: 'Critical health actions detected', description: 'Open the Event Health Command Center to resolve the highest-risk items.', variant: 'destructive' });
    }
  }, [command?.summary.criticalActions, toast]);

  if (isLoading) return <Skeleton className="h-96 rounded-xl" aria-label="Loading event health command center" />;
  if (!command) return null;

  const { summary, actions } = command;
  let managerVisibleActions = actions;
  if (managerMode) {
    managerVisibleActions = managerVisibleActions.filter((action) => {
      if (action.source === 'payments' || action.source === 'forecast') return canViewBudget;
      if (action.source === 'contracts') return canViewContracts;
      return true;
    });
    if (managerFilter === 'mine') {
      const userId = meData?.user?.id;
      managerVisibleActions = managerVisibleActions.filter((action: any) => managerActionOwner(action) === 'manager-team' || action.state?.assignedTo === userId);
    }
    if (managerFilter === 'event_day') {
      managerVisibleActions = managerVisibleActions.filter((action) => action.priority === 'critical' || action.priority === 'high' || ['risk', 'timeline_completeness', 'vendor_reliability'].includes(action.source));
    }
  }
  const topActions = managerVisibleActions.slice(0, 8);
  const resolvedCount = command.resolvedActions?.length || 0;
  const managerOwnedCount = managerVisibleActions.filter((a: any) => managerActionOwner(a) === 'manager-team').length;

  return (
    <Card className="border-brand/30 shadow-elev-1" aria-label="Event Health Command Center">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-brand" aria-hidden="true" />
              {managerMode ? 'Manager Operations Health Center' : 'Event Health Command Center'}
            </CardTitle>
            <CardDescription>
              {managerMode ? 'Manager-safe operations queue with owner/admin-only finance and admin items hidden unless permitted.' : 'Prioritized actions from risk, forecast, vendor reliability, guest identity, RSVP lag, and timeline coverage.'}
            </CardDescription>
          </div>
          <Badge variant={summary.criticalActions > 0 ? 'danger' : summary.highActions > 0 ? 'warning' : 'success'}>
            {summary.criticalActions + summary.highActions} urgent
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">Open events</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{summary.openEvents}</div>
            <div className="text-xs text-fg-muted">{summary.flaggedEvents} flagged</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">Avg health</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{summary.avgHealthScore ?? '—'}</div>
            <div className="text-xs text-fg-muted">risk-adjusted score</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">Pipeline</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{fmtCents(summary.pipelineRevenueCents)}</div>
            <div className="text-xs text-fg-muted">vs {fmtCents(summary.projectedRevenueCents)} projected</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">Data quality</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{summary.guestDuplicateClusters}</div>
            <div className="text-xs text-fg-muted">guest duplicate cluster(s)</div>
          </div>
        </div>

        {managerMode && (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand/20 bg-brand-soft/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brand flex items-center gap-2"><Radio className="h-4 w-4" /> Daily manager briefing</h3>
                  <p className="mt-1 text-xs text-fg-muted">Start with {managerVisibleActions.filter(a => a.priority === 'critical').length} critical, {managerVisibleActions.filter(a => a.priority === 'high').length} high-priority, and {managerOwnedCount} manager-owned operational action(s).</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="xs" variant={managerFilter === 'all' ? 'default' : 'outline'} onClick={() => setManagerFilter('all')}>All manager-safe</Button>
                  <Button size="xs" variant={managerFilter === 'mine' ? 'default' : 'outline'} onClick={() => setManagerFilter('mine')}><UserCheck className="h-3.5 w-3.5" /> Assigned to me/my team</Button>
                  <Button size="xs" variant={managerFilter === 'event_day' ? 'default' : 'outline'} onClick={() => setManagerFilter('event_day')}><Bell className="h-3.5 w-3.5" /> Event-day critical</Button>
                </div>
              </div>
              {(!canViewBudget || !canViewContracts) && <p className="mt-3 rounded-lg border border-warning/30 bg-warning-soft/20 p-2 text-xs text-warning">Owner-only finance/admin items are hidden unless your role has the matching permission.</p>}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <MiniHealthPanel title="Escalation rules engine" icon={<ShieldAlert className="h-4 w-4" />} value="Active" detail="Critical finance/legal → owner/admin; vendor/timeline/guest → manager team; unresolved SLA → escalate." />
              <MiniHealthPanel title="Event-day command alert board" icon={<AlertOctagon className="h-4 w-4" />} value={managerVisibleActions.filter(a => a.priority === 'critical' || a.priority === 'high').length} detail="High/critical operational alerts for captain mode." />
              <MiniHealthPanel title="Resolution analytics" icon={<BarChart3 className="h-4 w-4" />} value={resolvedCount} detail="Resolved actions feed manager performance and coaching summaries." />
            </div>
          </div>
        )}

        {topActions.length === 0 ? (
          <div className="rounded-xl border border-success/30 bg-success-soft p-5 text-sm text-success flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            No urgent operational actions detected. Keep monitoring as events, RSVPs, vendors, and timelines change.
          </div>
        ) : (
          <ol className="space-y-3" aria-label="Prioritized health actions">
            {topActions.map((action, index) => {
              const meta = PRIORITY_META[action.priority];
              const Icon = meta.Icon;
              return (
                <li key={action.id} className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-2 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meta.badge} className="text-[10px]">
                          <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[action.source]}</Badge>
                        {action.eventTitle && <span className="text-xs text-fg-subtle truncate">{action.eventTitle}</span>}
                      </div>

                      <div>
                        <a href={action.href} className="font-semibold hover:underline inline-flex items-center gap-1">
                          {action.title}
                          <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                        </a>
                        <p className="mt-1 text-sm text-fg-muted leading-relaxed">{action.detail}</p>
                        {managerMode && <p className="mt-1 text-xs font-semibold text-brand">Why this matters operationally: {operationalWhy(action.source)}</p>}
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-lg border border-border bg-surface-2 p-2">
                            <strong className="text-fg">Why am I seeing this?</strong>
                            <p className="mt-0.5 text-fg-muted">Signals: {action.relatedSignals.join(', ') || 'platform readiness signal'}.</p>
                          </div>
                          <div className="rounded-lg border border-border bg-surface-2 p-2">
                            <strong className="text-fg">Threshold explanation</strong>
                            <p className="mt-0.5 text-fg-muted">{action.thresholdExplanation ?? 'This crossed an operational threshold for owner review.'}</p>
                          </div>
                          <div className="rounded-lg border border-brand/20 bg-brand-soft/20 p-2">
                            <strong className="text-brand">Recommended next step</strong>
                            <p className="mt-0.5 text-fg-muted">Open the linked workspace and resolve this item before lower-priority actions.</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
                        <span className="inline-flex items-center gap-1">
                          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          {action.impact}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0" title="Confidence combines data recency, sample size, and signal specificity.">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {managerMode ? simpleConfidence(action.confidence) : `${action.confidence} confidence · ${action.confidence === 'high' ? 'strong live signal' : action.confidence === 'medium' ? 'directional signal' : 'needs more data'}`}
                        </span>
                      </div>
                      {managerMode && (
                        <div className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-fg-muted">
                          <Clock className="inline h-3.5 w-3.5 mr-1" /> Manager SLA target: resolve or escalate within {slaTargetHours(action.priority)}h. Owner: {managerActionOwner(action) === 'manager-team' ? 'manager/team' : 'owner/admin'}.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="xs" variant="outline" onClick={() => updateAction.mutate({ actionId: action.id, status: 'acknowledged' })} disabled={updateAction.isPending}>Acknowledge</Button>
                        <Button size="xs" variant="outline" onClick={() => updateAction.mutate({ actionId: action.id, status: 'snoozed', snoozedUntil: new Date(Date.now() + 24 * 60 * 60_000).toISOString() })} disabled={updateAction.isPending}>Snooze 24h</Button>
                        <Button size="xs" variant="outline" onClick={() => updateAction.mutate({ actionId: action.id, status: 'acknowledged', note: 'Assigned for owner/planner follow-up' })} disabled={updateAction.isPending}>Assign</Button>
                        <Button size="xs" variant="outline" onClick={() => updateAction.mutate({ actionId: action.id, status: 'resolved', note: 'Resolved from command center' })} disabled={updateAction.isPending}>Resolve</Button>
                        {managerMode && <Button size="xs" variant="outline" onClick={() => updateAction.mutate({ actionId: action.id, status: 'acknowledged', note: 'Escalated to owner/admin from manager health center' })} disabled={updateAction.isPending}>Escalate owner/admin</Button>}
                        <a href={action.href}><Button size="xs">{action.fixCta ?? 'Fix this'}</Button></a>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InsightModule title="Lead conversion intelligence" desc="Tracks lead/hold volume, source quality, and conversion pacing from the event pipeline." />
          <InsightModule title="Pricing/yield optimizer" desc="Compares pipeline demand, seasonality, and projected revenue to surface smart pricing opportunities." />
          <InsightModule title="Market/season benchmark" desc="Uses seasonal demand and completed-event history to explain peak and soft booking periods." />
          <InsightModule title="Forecast scenario planner" desc="Scenario-ready forecast inputs show revenue impact from pipeline, bookings, and event mix." />
          <InsightModule title="Vendor substitution recommendations" desc="Combines vendor reliability and category coverage to suggest backup/vendor substitutions." />
          <InsightModule title="Guest communication recommendations" desc="Uses RSVP lag, guest duplicates, and portal readiness to recommend reminder/follow-up campaigns." />
        </div>

        {(command.resolvedActions ?? []).length > 0 && (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-sm font-bold text-fg">Resolved action learning summary</div>
            <p className="mt-1 text-xs text-fg-muted">What was fixed and how: review notes to train future manager playbooks and reduce repeat alerts.</p>
            <ul className="mt-2 space-y-1 text-xs text-fg-muted">
              {(command.resolvedActions ?? []).slice(0, 5).map((r) => (
                <li key={r.actionId}>✓ {r.actionId} · {new Date(r.updatedAt).toLocaleString()}{r.note ? ` · ${r.note}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightModule({ title, desc }: { title: string; desc: string }) {
  return <div className="rounded-lg border border-border bg-surface-2 p-3"><div className="text-xs font-bold text-brand">{title}</div><p className="mt-1 text-[11px] text-fg-muted">{desc}</p></div>;
}


function MiniHealthPanel({ title, icon, value, detail }: { title: string; icon: ReactNode; value: string | number; detail: string }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="flex items-center gap-2 text-xs font-bold text-brand">{icon}{title}</div><div className="mt-1 text-xl font-bold text-fg">{value}</div><p className="mt-1 text-[11px] text-fg-muted">{detail}</p></div>;
}
