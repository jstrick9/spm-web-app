/**
 * StatCard — the core "intelligence" KPI primitive.
 *
 * Phase 33 changes:
 *   • Added role="status" + aria-live="polite" on the value node so screen
 *     readers announce KPI updates without requiring user interaction.
 *   • Added aria-label combining label + value for concise SR output.
 *   • Added optional `loading` prop that renders a Skeleton instead of the
 *     value — prevents "—" flash before data arrives.
 *   • Trend icon now has aria-hidden="true" (decorative beside text).
 *   • No visual change whatsoever — same pixel output, better semantics.
 */
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './lib/cn';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  /** When true, renders a skeleton shimmer instead of the value. */
  loading?: boolean;
  /** Trend vs previous period. Positive = up. */
  trend?: { value: number; direction: 'up' | 'down' | 'flat'; isGood?: boolean };
  /** External benchmark (e.g. industry average). */
  benchmark?: { label: ReactNode; value: ReactNode };
  /** Optional right-rail slot (e.g. a Sparkline). */
  rightSlot?: ReactNode;
  className?: string;
  /** Accessible label override. Defaults to "${label}: ${value}". */
  ariaLabel?: string;
}

export function StatCard({
  label,
  value,
  description,
  loading = false,
  trend,
  benchmark,
  rightSlot,
  className,
  ariaLabel,
}: StatCardProps) {
  const TrendIcon =
    trend?.direction === 'up'
      ? ArrowUpRight
      : trend?.direction === 'down'
        ? ArrowDownRight
        : Minus;

  // isGood defaults to: 'up' is good. Invert for metrics like churn rate.
  const good = trend?.isGood ?? trend?.direction === 'up';
  const trendColor = !trend
    ? ''
    : trend.direction === 'flat'
      ? 'text-fg-subtle'
      : good
        ? 'text-success'
        : 'text-danger';

  // Build a concise accessible label for the whole card.
  const computedAriaLabel =
    ariaLabel ??
    (typeof label === 'string' && (typeof value === 'string' || typeof value === 'number')
      ? `${label}: ${value}`
      : undefined);

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Label */}
          <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
            {label}
          </div>

          {/* Value — role="status" makes SR announce changes politely */}
          <div
            className="mt-2 text-3xl font-semibold leading-tight text-fg"
            role="status"
            aria-live="polite"
            aria-label={computedAriaLabel}
            aria-atomic="true"
          >
            {loading ? (
              <Skeleton className="h-9 w-24" aria-label="Loading value" />
            ) : (
              value
            )}
          </div>

          {description && (
            <div className="mt-1 text-sm text-fg-muted">{description}</div>
          )}

          {(trend || benchmark) && !loading && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-medium',
                    trendColor,
                  )}
                >
                  <TrendIcon
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
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
