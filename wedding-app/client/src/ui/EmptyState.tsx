import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState — used wherever a list has nothing in it. Drives the
 * "first guest", "first event", "first vendor" prompts.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
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
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
