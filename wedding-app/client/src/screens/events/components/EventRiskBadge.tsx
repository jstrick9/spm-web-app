/**
 * EventRiskBadge — compact risk indicator for EventsList Kanban cards
 * and table rows.
 *
 * Reads from the org-level risk query (cached) so it does NOT fire a
 * separate API call per event card. Zero performance overhead at scale.
 *
 * Modes:
 *   compact  — colored dot only (for Kanban cards, small spaces)
 *   default  — badge with icon + text (for table rows, detail headers)
 *
 * Permission: reports.view (returns null silently if not permitted)
 */
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Badge } from '../../../ui/Badge';
import { usePermission } from '../../../lib/usePermission';

type RiskLevel = 'high' | 'medium' | 'low';

interface Props {
  eventId: string;
  orgId: string;
  compact?: boolean;
  className?: string;
}

const RISK_CONFIG: Record<RiskLevel, {
  variant: 'danger' | 'warning' | 'success';
  label: string;
  dotColor: string;
  Icon: typeof CheckCircle2;
}> = {
  high: {
    variant: 'danger',
    label: 'At Risk',
    dotColor: 'bg-danger',
    Icon: AlertTriangle,
  },
  medium: {
    variant: 'warning',
    label: 'Watch',
    dotColor: 'bg-warning',
    Icon: Eye,
  },
  low: {
    variant: 'success',
    label: 'On Track',
    dotColor: 'bg-success',
    Icon: CheckCircle2,
  },
};

export function EventRiskBadge({ eventId, orgId, compact = false, className }: Props) {
  const canViewAnalytics = usePermission('reports.view');

  // Never render if user doesn't have analytics permission
  if (!canViewAnalytics) return null;

  const { data } = useQuery({
    queryKey: ['risk-alerts', orgId],
    queryFn: () => sdk.risk.forOrg(orgId),
    staleTime: 60_000,
    // Don't trigger a loading state here — badge is supplementary info
    placeholderData: (prev) => prev,
  });

  const eventRisk = data?.events?.find((e) => e.eventId === eventId);
  if (!eventRisk) return null;

  const level: RiskLevel =
    eventRisk.healthScore >= 85
      ? 'low'
      : eventRisk.healthScore >= 60
        ? 'medium'
        : 'high';

  const config = RISK_CONFIG[level];
  const { Icon } = config;

  if (compact) {
    return (
      <span
        className={[
          'inline-block w-2 h-2 rounded-full shrink-0',
          config.dotColor,
          className ?? '',
        ].join(' ')}
        title={`Risk: ${config.label} (score ${eventRisk.healthScore})`}
        aria-label={`Event risk level: ${config.label}`}
        role="img"
      />
    );
  }

  return (
    <Badge
      variant={config.variant}
      className={['gap-1 text-[11px]', className ?? ''].join(' ')}
      aria-label={`Risk level: ${config.label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
