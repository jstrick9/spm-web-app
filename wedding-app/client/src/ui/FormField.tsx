/**
 * FormField — shared label + control + hint/error wrapper.
 *
 * Guarantees every form control gets an accessible name by construction:
 * the label is wired to the control via htmlFor/id, required fields get a
 * visible marker plus aria-required, and validation messages are announced
 * via aria-describedby + aria-invalid.
 *
 *   <FormField label="Venue name" htmlFor="venue-name" required error={error}>
 *     <Input id="venue-name" value={...} onChange={...} />
 *   </FormField>
 */
import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface FormFieldProps {
  /** Visible label text. */
  label: ReactNode;
  /** The id of the control this label belongs to. */
  htmlFor: string;
  /** Marks the field required in the label and sets aria-required on the control. */
  required?: boolean;
  /** Validation message — renders in a tone that matches `tone` and wires aria-describedby. */
  error?: string | null;
  /** Helper text shown under the control. */
  hint?: ReactNode;
  /** Renders the error with the danger palette (default) or neutral. */
  tone?: 'danger' | 'neutral';
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, required, error, hint, tone = 'danger', className, children }: FormFieldProps) {
  const descriptionId = error || hint ? `${htmlFor}-description` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {required && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={descriptionId} role="alert" className={cn('text-xs', tone === 'danger' ? 'text-danger' : 'text-fg-muted')}>
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
