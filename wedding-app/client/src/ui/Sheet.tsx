/**
 * Sheet — slide-over panel (a drawer that slides in from the right).
 *
 * Built on Radix Dialog with custom positioning so we get the same
 * focus-trap / Esc / overlay behavior as <Dialog> but a panel instead of
 * a centered modal.
 *
 *   <Sheet open={open} onOpenChange={setOpen}>
 *     <SheetContent side="right" width="lg">
 *       <SheetHeader>
 *         <SheetTitle>Guest detail</SheetTitle>
 *       </SheetHeader>
 *       ...
 *     </SheetContent>
 *   </Sheet>
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import {
  forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes,
} from 'react';
import { cn } from './lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const SheetOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

const sheetVariants = cva(
  [
    'fixed z-50 gap-4 bg-surface shadow-elev-2 transition ease-in-out',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'duration-300',
  ].join(' '),
  {
    variants: {
      side: {
        right:  'inset-y-0 right-0 h-full border-l border-border data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
        left:   'inset-y-0 left-0  h-full border-r border-border data-[state=open]:slide-in-from-left  data-[state=closed]:slide-out-to-left',
        top:    'inset-x-0 top-0     w-full border-b border-border data-[state=open]:slide-in-from-top    data-[state=closed]:slide-out-to-top',
        bottom: 'inset-x-0 bottom-0  w-full border-t border-border data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
      },
      width: {
        sm: 'sm:max-w-sm w-full',
        md: 'sm:max-w-md w-full',
        lg: 'sm:max-w-lg w-full',
        xl: 'sm:max-w-xl w-full',
        '2xl': 'sm:max-w-2xl w-full',
        full: 'w-full',
      },
    },
    defaultVariants: { side: 'right', width: 'lg' },
  },
);

export interface SheetContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showClose?: boolean;
}

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, side, width, showClose = true, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side, width }), 'flex flex-col', className)}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-4 border-b border-border', className)} {...props} />;
}

export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto p-6', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 px-6 py-4 border-t border-border sm:flex-row sm:justify-end', className)} {...props} />;
}

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-tight', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-fg-muted', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';
