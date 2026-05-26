/**
 * Button — the workhorse. shadcn-style: composed via CVA variants.
 *
 *   <Button>Default</Button>                          // brand fill
 *   <Button variant="secondary">Secondary</Button>    // neutral fill
 *   <Button variant="outline">Outline</Button>
 *   <Button variant="ghost">Ghost</Button>
 *   <Button variant="destructive">Delete</Button>
 *   <Button size="sm" />  // 'xs' | 'sm' | 'md' | 'lg' | 'icon'
 *   <Button isLoading>Saving…</Button>
 *   <Button asChild><a href="/x">Link as button</a></Button>
 */
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './lib/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md text-sm font-medium',
    'transition-[background-color,color,box-shadow] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default:     'bg-brand text-brand-fg hover:bg-brand-strong shadow-card',
        secondary:   'bg-surface-2 text-fg hover:bg-border',
        outline:     'border border-border bg-surface text-fg hover:bg-surface-2',
        ghost:       'text-fg hover:bg-surface-2',
        link:        'text-brand underline-offset-4 hover:underline',
        destructive: 'bg-danger text-white hover:bg-danger/90',
        accent:      'bg-accent text-brand-strong hover:opacity-90 shadow-card',
      },
      size: {
        xs:   'h-7 px-2.5 text-xs',
        sm:   'h-8 px-3 text-sm',
        md:   'h-10 px-4 text-sm',
        lg:   'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, isLoading, disabled, children, ...props }, ref) => {
    // When asChild is true, Radix Slot requires EXACTLY ONE React child.
    // So we can't inject a spinner alongside the user's child element.
    // Caller is responsible for any loading affordance in that case.
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
