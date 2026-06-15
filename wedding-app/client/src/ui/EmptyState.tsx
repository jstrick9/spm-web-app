import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  recommendedNextStep?: ReactNode;
  className?: string;
}

/**
 * EmptyState — used wherever a list has nothing in it. Drives the
 * "first guest", "first event", "first vendor" prompts.
 */
export function EmptyState({ icon, title, description, action, recommendedNextStep, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {recommendedNextStep && (
        <div className="mt-1 max-w-md rounded-lg border border-brand/20 bg-brand-soft/20 px-3 py-2 text-xs text-brand">
          <strong>Recommended next step:</strong> {recommendedNextStep}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
