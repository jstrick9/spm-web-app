/**
 * AccessDenied — RBAC permission gate fallback UI.
 *
 * Shown when a user navigates to a route or tab their role does not permit.
 * Matches the platform design system (Radix + Tailwind tokens).
 * Does NOT redirect — just informs with an actionable message.
 *
 * Usage:
 *   if (!can('analytics.view')) return <AccessDenied feature="Intelligence" />;
 *   // or inside a tab panel:
 *   {can('finance.view') ? <BudgetTab /> : <AccessDenied />}
 */
import { ShieldOff } from 'lucide-react';

interface Props {
  /** Human-readable feature name, e.g. "Budget" or "Intelligence". */
  feature?: string;
  /** Optional extra CSS classes for sizing control from parent. */
  className?: string;
}

export function AccessDenied({ feature, className }: Props) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-border',
        'bg-surface-1 p-10 text-center',
        className ?? 'min-h-[240px]',
      ].join(' ')}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2"
        aria-hidden="true"
      >
        <ShieldOff className="h-6 w-6 text-fg-muted" />
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-fg">
          {feature ? `${feature} — Access Restricted` : 'Access Restricted'}
        </p>
        <p className="max-w-sm text-sm text-fg-muted">
          Your current role does not have permission to view this
          {feature ? ` (${feature})` : ' section'}. Contact your venue
          administrator to request access.
        </p>
      </div>
    </div>
  );
}
