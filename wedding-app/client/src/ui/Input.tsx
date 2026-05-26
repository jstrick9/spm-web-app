/**
 * Input — text input. Use with <Label> + <FormField>.
 * Includes icon slot via a sibling element pattern.
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  startSlot?: ReactNode;
  endSlot?: ReactNode;
  /** Error state — visually highlights the border. Pair with FormField for the message. */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', startSlot, endSlot, invalid, ...props }, ref) => {
    if (startSlot || endSlot) {
      return (
        <div
          className={cn(
            'flex h-10 w-full items-center rounded-md border bg-surface text-sm transition-colors',
            'focus-within:ring-2 focus-within:ring-brand focus-within:border-brand',
            invalid ? 'border-danger' : 'border-border',
            className,
          )}
        >
          {startSlot && <span className="pl-3 text-fg-subtle">{startSlot}</span>}
          <input
            ref={ref}
            type={type}
            className="flex-1 bg-transparent px-3 outline-none placeholder:text-fg-subtle disabled:opacity-50"
            aria-invalid={invalid || undefined}
            {...props}
          />
          {endSlot && <span className="pr-3 text-fg-subtle">{endSlot}</span>}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm',
          'transition-colors placeholder:text-fg-subtle',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-danger' : 'border-border',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
