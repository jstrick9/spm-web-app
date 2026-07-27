/**
 * Toast — non-blocking ephemeral notifications.
 *
 * Usage: mount <ToastProvider /> at the app root, then anywhere in the
 * tree call `useToast()`:
 *
 *   const { toast } = useToast();
 *   toast({ title: 'Saved', description: 'Your changes are live.' });
 *   toast({ title: 'Whoops', description: e.message, variant: 'destructive' });
 *
 * Built on Radix Toast for a11y (announces to screen readers via
 * aria-live), with auto-dismiss + swipe-to-dismiss.
 */
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import {
  createContext, forwardRef, useCallback, useContext, useState,
  type ComponentPropsWithoutRef, type ElementRef, type ReactNode,
} from 'react';
import { cn } from './lib/cn';

const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden',
    'rounded-card border p-4 pr-8 shadow-elev-1',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[state=open]:slide-in-from-right-full',
    'data-[state=closed]:slide-out-to-right-full',
  ].join(' '),
  {
    variants: {
      variant: {
        default:     'border-border bg-surface text-fg',
        success:     'border-success/20 bg-success-soft text-success',
        destructive: 'border-danger/20 bg-danger-soft text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: VariantProps<typeof toastVariants>['variant'];
  durationMs?: number;
}

interface ToastCtx {
  toast: (t: Omit<ToastData, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastData[]>([]);

  const toast = useCallback((t: Omit<ToastData, 'id'>) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev, { id, durationMs: 1000, ...t }]);
  }, []);
  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.durationMs}
            className={cn(toastVariants({ variant: t.variant }))}
            onOpenChange={(open) => { if (!open) dismiss(t.id); }}
          >
            <div className="flex-1 min-w-0">
              {t.title && (
                <ToastPrimitive.Title className="text-sm font-semibold leading-snug">
                  {t.title}
                </ToastPrimitive.Title>
              )}
              {t.description && (
                <ToastPrimitive.Description className="mt-1 text-sm opacity-90 break-words">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="absolute right-2 top-2 rounded-sm opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          className={cn(
            'fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2',
            'sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto',
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

export const Toast = forwardRef<
  ElementRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
));
Toast.displayName = 'Toast';
