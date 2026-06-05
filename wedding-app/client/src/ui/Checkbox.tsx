/**
 * Checkbox — accessible checkbox built on Radix Checkbox.
 *
 *   <Checkbox checked={value} onCheckedChange={setValue} />
 *
 * Supports the tri-state `indeterminate` ('mixed' in ARIA terms) so the
 * select-all checkbox can show "some, not all" rows are selected.
 */
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from './lib/cn';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-border bg-surface relative',
      'transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-brand-fg',
      'data-[state=indeterminate]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:text-brand-fg',
      'before:content-[\'\'] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {/* Radix passes data-state=indeterminate when checked === 'indeterminate' */}
      {props.checked === 'indeterminate'
        ? <Minus className="h-3 w-3" strokeWidth={3} />
        : <Check className="h-3 w-3" strokeWidth={3} />}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';
