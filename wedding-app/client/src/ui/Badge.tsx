import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from './lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:   'bg-surface-2 text-fg-muted border border-border',
        brand:     'bg-brand-soft text-brand-strong',
        accent:    'bg-accent-soft text-brand-strong',
        success:   'bg-success-soft text-success',
        warning:   'bg-warning-soft text-warning',
        danger:    'bg-danger-soft text-danger',
        info:      'bg-info-soft text-info',
        outline:   'border border-border text-fg-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
