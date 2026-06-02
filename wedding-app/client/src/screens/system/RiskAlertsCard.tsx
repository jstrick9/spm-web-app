/**
 * RiskAlertsCard — org-wide "events needing attention" for the Intelligence
 * dashboard. Lists the riskiest live events (lowest health first) with their
 * top alerts, each deep-linking into the relevant event tab.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, AlertOctagon, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { sdk } from '../../sdk';
import type { RiskSeverity } from '../../sdk/intelligence';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';

interface Props { orgId: string }

const SEV_ICON: Record<RiskSeverity, { Icon: typeof Info; cls: string }> = {
  critical: { Icon: AlertOctagon, cls: 'text-danger' },
  warning:  { Icon: AlertTriangle, cls: 'text-warning' },
  info:     { Icon: Info, cls: 'text-info' },
};

function healthCls(score: number): string {
  return score >= 85 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger';
}

export function RiskAlertsCard({ orgId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['risk-alerts', orgId],
    queryFn: () => sdk.risk.forOrg(orgId),
    staleTime: 60_000,
  });
  const events = data?.events ?? [];

  if (isLoading || events.length === 0) return null; // quiet when all healthy

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" /> Events Needing Attention
          <Badge variant="warning" className="text-[10px]">{events.length}</Badge>
        </CardTitle>
        <CardDescription>Proactive risk flags across your active events — riskiest first</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.slice(0, 6).map((ev) => (
          <div key={ev.eventId} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <a href={`#/events/${ev.eventId}`} className="font-medium hover:underline inline-flex items-center gap-1">
                {ev.eventTitle}
                <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" />
              </a>
              <div className="flex items-center gap-2 shrink-0">
                {ev.daysUntil != null && ev.daysUntil >= 0 && (
                  <span className="text-xs text-fg-subtle">{ev.daysUntil}d</span>
                )}
                <span className={`text-sm font-bold tabular-nums ${healthCls(ev.healthScore)}`} title="Health score">{ev.healthScore}</span>
              </div>
            </div>
            <ul className="space-y-1">
              {ev.alerts.slice(0, 3).map((a) => {
                const sev = SEV_ICON[a.severity] ?? SEV_ICON.info;
                const Icon = sev.Icon;
                return (
                  <li key={a.id} className="flex items-start gap-2 text-xs">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${sev.cls}`} />
                    <a href={a.href} className="hover:underline">
                      <span className="font-medium">{a.title}.</span>{' '}
                      <span className="text-fg-muted">{a.detail}</span>
                    </a>
                  </li>
                );
              })}
              {ev.alerts.length > 3 && (
                <li className="text-[11px] text-fg-subtle pl-5">+{ev.alerts.length - 3} more</li>
              )}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
