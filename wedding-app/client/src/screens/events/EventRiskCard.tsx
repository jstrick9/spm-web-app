/**
 * EventRiskCard — proactive "event health" panel for the Event Detail overview.
 *
 * Reads GET /api/events/:id/risk-alerts and shows a health score + a
 * severity-coded list of risks (RSVP behind, unsigned contracts, budget
 * overrun, balance due, missing vendors/timeline, over-capacity). Each alert
 * deep-links to the tab where it can be fixed. Renders nothing when healthy.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { sdk } from '../../sdk';
import type { RiskSeverity } from '../../sdk/intelligence';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';

interface Props { eventId: string }

const SEV: Record<RiskSeverity, { variant: 'danger' | 'warning' | 'info'; Icon: typeof Info; ring: string }> = {
  critical: { variant: 'danger', Icon: AlertOctagon, ring: 'border-l-danger' },
  warning:  { variant: 'warning', Icon: AlertTriangle, ring: 'border-l-warning' },
  info:     { variant: 'info', Icon: Info, ring: 'border-l-info' },
};

function healthTone(score: number): { label: string; cls: string } {
  if (score >= 85) return { label: 'Healthy', cls: 'text-success' };
  if (score >= 60) return { label: 'Needs attention', cls: 'text-warning' };
  return { label: 'At risk', cls: 'text-danger' };
}

export function EventRiskCard({ eventId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['event-risk', eventId],
    queryFn: () => sdk.risk.forEvent(eventId),
    staleTime: 60_000,
  });
  const risk = data?.risk;

  if (isLoading || !risk) return null;
  const alerts = risk.alerts ?? [];

  // Healthy + nothing to flag → show a quiet "all clear" only if there is a date.
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div>
            <div className="text-sm font-medium">No risks detected</div>
            <div className="text-xs text-fg-muted">This event looks on track.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tone = healthTone(risk.healthScore);

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" /> Event Health
            </CardTitle>
            <CardDescription>
              {alerts.length} risk{alerts.length === 1 ? '' : 's'} detected
              {risk.daysUntil != null && risk.daysUntil >= 0 ? ` · ${risk.daysUntil} day(s) to go` : ''}
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold tabular-nums ${tone.cls}`}>{risk.healthScore}</div>
            <div className={`text-[10px] uppercase tracking-wide ${tone.cls}`}>{tone.label}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => {
          const sev = SEV[a.severity] ?? SEV.info;
          const Icon = sev.Icon;
          return (
            <a
              key={a.id}
              href={a.href}
              className={`flex items-start gap-3 p-3 rounded-md border-l-4 ${sev.ring} bg-surface-2/40 hover:bg-surface-2 transition-colors`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-danger' : a.severity === 'warning' ? 'text-warning' : 'text-info'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{a.title}</span>
                  <Badge variant={sev.variant} className="text-[10px] capitalize">{a.severity}</Badge>
                </div>
                <p className="text-xs text-fg-muted mt-0.5">{a.detail}</p>
                <p className="text-[11px] text-fg-subtle mt-1">
                  <strong>Why am I seeing this?</strong> This event health alert is based on live planning data. <strong>Recommended next step:</strong> open this linked tab and resolve the underlying setup gap.
                </p>
              </div>
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}
