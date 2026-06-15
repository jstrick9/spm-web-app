/**
 * AccessDenied — RBAC permission gate fallback UI.
 *
 * Shown when a user navigates to a route or tab their role does not permit.
 * Matches the platform design system (Radix + Tailwind tokens).
 * Does NOT redirect — just informs with an actionable message.
 *
 * Usage:
 *   if (!can('reports.view')) return <AccessDenied feature="Intelligence" />;
 *   // or inside a tab panel:
 *   {can('finance.view') ? <BudgetTab /> : <AccessDenied />}
 */
import { ShieldOff, HelpCircle } from 'lucide-react';

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
          {feature ? ` (${feature})` : ' section'}. This usually means the action is owner/admin-only,
          outside your event scope, or contains sensitive finance, admin, integration, or PII controls.
        </p>
        <div className="mt-3 max-w-md rounded-lg border border-border bg-surface-2 p-3 text-left text-xs text-fg-muted">
          <div className="mb-1 flex items-center gap-1 font-bold text-fg"><HelpCircle className="h-3.5 w-3.5" /> Why can’t I access this?</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>Venue managers can run operations but may not change owner/admin policy.</li>
            <li>Some actions require delegated approval before they affect guests, vendors, payments, contracts, or integrations.</li>
            <li>Contact your venue administrator. Escalate with the event, action, reason, and urgency so an owner/admin can approve or adjust your role.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
