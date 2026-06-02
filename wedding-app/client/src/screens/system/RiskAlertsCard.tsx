/**
 * RiskAlertsCard — org-wide "events needing attention" for the Intelligence
 * dashboard. Lists the riskiest live events (lowest health score first) with
 * their top alerts, each deep-linking into the relevant event tab.
 *
 * FIXES APPLIED:
 *   N3 — RBAC: analytics.view permission checked before rendering.
 *   UX — Returns null silently when all events are healthy (quiet by design).
 *   UX — aria-labels on all icon-only elements for WCAG 2.1 AA compliance.
 *   UX — Focus-visible ring on event links for keyboard navigation.
 *   UX — Badge count limited with aria-label for screen readers.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, AlertOctagon, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { sdk } from '../../sdk';
import type { RiskSeverity } from '../../sdk/intelligence';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { usePermission } from '../../lib/usePermission';

interface Props {
  orgId: string;
}

const SEV_ICON: Record<RiskSeverity, { Icon: typeof Info; cls: string; label: string }> = {
  critical: { Icon: AlertOctagon, cls: 'text-danger', label: 'Critical alert' },
  warning: { Icon: AlertTriangle, cls: 'text-warning', label: 'Warning' },
  info: { Icon: Info, cls: 'text-info', label: 'Info' },
};

function healthCls(score: number): string {
  return score >= 85 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger';
}

function healthLabel(score: number): string {
  return score >= 85 ? 'Healthy' : score >= 60 ? 'Needs attention' : 'At risk';
}

export function RiskAlertsCard({ orgId }: Props) {
  // N3 fix: respect analytics.view permission
  const canViewAnalytics = usePermission('analytics.view');
  if (!canViewAnalytics) return null;

  const { data, isLoading } = useQuery({
    queryKey: ['risk-alerts', orgId],
    queryFn: () => sdk.risk.forOrg(orgId),
    staleTime: 60_000, // 1 min — risk changes as staff take action
  });

  if (isLoading) {
    return <Skeleton className="h-36 rounded-xl" aria-label="Loading risk alerts" />;
  }

  const events = data?.events ?? [];
  // Return null quietly when there are no flagged events — no visual noise
  if (events.length === 0) return null;

  return (
    <Card
      className="border-warning/30"
      aria-label={`Events needing attention: ${events.length} flagged`}
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
          Events Needing Attention
          <Badge
            variant="warning"
            className="text-[10px]"
            aria-label={`${events.length} events flagged`}
          >
            {events.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Proactive risk flags across your active events — riskiest first
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {events.slice(0, 6).map((ev) => (
          <div
            key={ev.eventId}
            className="rounded-lg border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
          >
            {/* Event header row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <a
                href={`#/events/${ev.eventId}`}
                className="font-medium hover:underline inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded"
                aria-label={`View event: ${ev.eventTitle}`}
              >
                {ev.eventTitle}
                <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
              </a>

              <div className="flex items-center gap-2 shrink-0">
                {ev.daysUntil != null && ev.daysUntil >= 0 && (
                  <span
                    className="text-xs text-fg-subtle"
                    aria-label={`${ev.daysUntil} days until event`}
                  >
                    {ev.daysUntil}d
                  </span>
                )}
                <span
                  className={`text-sm font-bold tabular-nums ${healthCls(ev.healthScore)}`}
                  title={`Health score: ${ev.healthScore}/100 — ${healthLabel(ev.healthScore)}`}
                  aria-label={`Health score ${ev.healthScore} out of 100`}
                >
                  {ev.healthScore}
                </span>
              </div>
            </div>

            {/* Alert list */}
            <ul className="space-y-1" aria-label={`Alerts for ${ev.eventTitle}`}>
              {ev.alerts.slice(0, 3).map((a) => {
                const sev = SEV_ICON[a.severity] ?? SEV_ICON.info;
                const Icon = sev.Icon;
                return (
                  <li key={a.id} className="flex items-start gap-2 text-xs">
                    <Icon
                      className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${sev.cls}`}
                      aria-label={sev.label}
                    />
                    <a
                      href={a.href}
                      className="hover:underline focus-visible:ring-1 focus-visible:ring-brand focus-visible:outline-none rounded"
                    >
                      <span className="font-medium">{a.title}.</span>{' '}
                      <span className="text-fg-muted">{a.detail}</span>
                    </a>
                  </li>
                );
              })}
              {ev.alerts.length > 3 && (
                <li
                  className="text-[11px] text-fg-subtle pl-5"
                  aria-label={`${ev.alerts.length - 3} more alerts`}
                >
                  +{ev.alerts.length - 3} more
                </li>
              )}
            </ul>
          </div>
        ))}

        {events.length > 6 && (
          <p className="text-xs text-fg-subtle text-center pt-1">
            Showing 6 of {events.length} flagged events.{' '}
            <a href="#/events" className="text-brand hover:underline">
              View all events →
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
