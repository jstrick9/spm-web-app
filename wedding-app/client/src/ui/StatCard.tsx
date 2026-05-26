/**
 * StatCard — the core "intelligence" primitive. A single KPI with:
 *   - value (big, prominent)
 *   - label (small, muted)
 *   - optional trend indicator (% change vs previous period)
 *   - optional sparkline (mini chart)
 *   - optional benchmark ("vs industry 22%")
 *
 *   <StatCard
 *     label="Booking conversion"
 *     value="34%"
 *     trend={{ value: 12, direction: 'up' }}
 *     benchmark={{ label: 'Industry avg', value: '22%' }}
 *   />
 *
 * Dashboard-aesthetic by default; venue-owner-facing surfaces.
 */
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './lib/cn';
import { Card } from './Card';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  /** Trend vs previous period. Positive = up. */
  trend?: { value: number; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  /** External benchmark (e.g. industry average). */
  benchmark?: { label: ReactNode; value: ReactNode };
  /** Optional 'right rail' (e.g. a sparkline). */
  rightSlot?: ReactNode;
  className?: string;
}

export function StatCard({
  label, value, description, trend, benchmark, rightSlot, className,
}: StatCardProps) {
  const TrendIcon = trend?.direction === 'up'
    ? ArrowUpRight
    : trend?.direction === 'down'
      ? ArrowDownRight
      : Minus;
  // isGood defaults to: 'up' is good. Toggle for things like 'churn rate'.
  const good = trend?.isGood ?? trend?.direction === 'up';
  const trendColor = !trend
    ? ''
    : trend.direction === 'flat'
      ? 'text-fg-subtle'
      : good ? 'text-success' : 'text-danger';

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold leading-tight text-fg">
            {value}
          </div>
          {description && (
            <div className="mt-1 text-sm text-fg-muted">{description}</div>
          )}
          {(trend || benchmark) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {trend && (
                <span className={cn('inline-flex items-center gap-1 font-medium', trendColor)}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  {Math.abs(trend.value)}%
                  <span className="font-normal text-fg-subtle">vs last period</span>
                </span>
              )}
              {benchmark && (
                <span className="inline-flex items-center gap-1 text-fg-subtle">
                  <span>{benchmark.label}:</span>
                  <span className="font-medium text-fg-muted">{benchmark.value}</span>
                </span>
              )}
            </div>
          )}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </Card>
  );
}
