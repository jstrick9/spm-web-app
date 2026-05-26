/**
 * `cn` — the universal className combinator used by every shadcn-style
 * component. Wraps clsx (concat) + tailwind-merge (dedupe conflicting
 * Tailwind classes like 'p-2 p-4' → 'p-4').
 *
 *   <button className={cn("px-4 py-2", isLoading && "opacity-50", className)}>
 *
 * tailwind-merge knows about all default Tailwind classes; since we use
 * v4 with a custom @theme, our brand utilities (bg-brand, text-fg-muted)
 * are passed through unchanged.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
