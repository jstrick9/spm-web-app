/**
 * usePrompt / useConfirm — promise-based in-app dialogs that replace native
 * `window.prompt()` / `window.confirm()` everywhere in the product.
 *
 * Native browser prompts are inconsistent with the design system, block the
 * page, and feel broken on mobile. These hooks render a proper Dialog
 * (autofocus, Enter submits, Escape cancels, required-field validation) and
 * resolve a promise, so call sites keep their natural async shape:
 *
 *   const { ask, askConfirm, promptNode } = usePrompt();
 *   const note = await ask({ title: 'Add a note', label: 'Note', required: true });
 *   if (note) …
 *   if (await askConfirm({ title: 'Delete?', destructive: true })) …
 *
 * Multi-field forms are supported for cases where a single prompt was never
 * enough (e.g. day-of contact configuration):
 *
 *   const values = await askForm({
 *     title: 'Day-of contact',
 *     fields: [
 *       { key: 'name', label: 'Name', required: true, defaultValue: current.name },
 *       { key: 'phone', label: 'Phone', defaultValue: current.phone },
 *     ],
 *   });
 */
import { useCallback, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './Dialog';
import { Button } from './Button';
import { Input } from './Input';
import { FormField } from './FormField';

export interface PromptField {
  key: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}

export interface PromptOptions {
  title: string;
  description?: string;
  /** Single-field mode (shorthand for ask()). */
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface PromptFormOptions {
  title: string;
  description?: string;
  fields: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PromptState extends PromptOptions {
  resolve: (value: string | null) => void;
}
interface PromptFormState extends PromptFormOptions {
  resolve: (value: Record<string, string> | null) => void;
}
interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

function PromptDialog({ state, onClose }: { state: PromptState; onClose: (value: string | null) => void }) {
  const [value, setValue] = useState(state.defaultValue ?? '');
  const [touched, setTouched] = useState(false);
  const invalid = !!state.required && value.trim().length === 0;

  const submit = () => {
    if (invalid) { setTouched(true); return; }
    onClose(value.trim());
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(null); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && <DialogDescription>{state.description}</DialogDescription>}
        </DialogHeader>
        {state.label && (
          <FormField label={state.label} htmlFor="prompt-field" required={state.required} error={touched && invalid ? 'This field is required.' : null}>
            {state.multiline ? (
              <textarea
                id="prompt-field"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={state.placeholder}
                autoFocus
                aria-required={state.required}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            ) : (
              <Input
                id="prompt-field"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={state.placeholder}
                autoFocus
                aria-required={state.required}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              />
            )}
          </FormField>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(null)}>{state.cancelLabel ?? 'Cancel'}</Button>
          <Button onClick={submit}>{state.confirmLabel ?? 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptFormDialog({ state, onClose }: { state: PromptFormState; onClose: (value: Record<string, string> | null) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(state.fields.map((f) => [f.key, f.defaultValue ?? ''])),
  );
  const [touched, setTouched] = useState(false);
  const invalid = state.fields.some((f) => f.required && !String(values[f.key] ?? '').trim());

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (invalid) { setTouched(true); return; }
    onClose(Object.fromEntries(state.fields.map((f) => [f.key, String(values[f.key] ?? '').trim()])));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(null); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && <DialogDescription>{state.description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          {state.fields.map((field, index) => (
            <FormField
              key={field.key}
              label={field.label}
              htmlFor={`prompt-${field.key}`}
              required={field.required}
              error={touched && invalid && field.required && !String(values[field.key] ?? '').trim() ? 'This field is required.' : null}
            >
              {field.multiline ? (
                <textarea
                  id={`prompt-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  autoFocus={index === 0}
                  aria-required={field.required}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                />
              ) : (
                <Input
                  id={`prompt-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  autoFocus={index === 0}
                  aria-required={field.required}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                />
              )}
            </FormField>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(null)}>{state.cancelLabel ?? 'Cancel'}</Button>
          <Button onClick={submit}>{state.confirmLabel ?? 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: (value: boolean) => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && <DialogDescription>{state.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>{state.cancelLabel ?? 'Cancel'}</Button>
          <Button variant={state.destructive ? 'destructive' : 'default'} onClick={() => onClose(true)}>
            {state.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function usePrompt() {
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [form, setForm] = useState<PromptFormState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const ask = useCallback((options: PromptOptions) =>
    new Promise<string | null>((resolve) => setPrompt({ ...options, resolve })), []);

  const askForm = useCallback((options: PromptFormOptions) =>
    new Promise<Record<string, string> | null>((resolve) => setForm({ ...options, resolve })), []);

  const askConfirm = useCallback((options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setConfirm({ ...options, resolve })), []);

  const promptNode = (
    <>
      {prompt && <PromptDialog state={prompt} onClose={(value) => { setPrompt(null); prompt.resolve(value); }} />}
      {form && <PromptFormDialog state={form} onClose={(value) => { setForm(null); form.resolve(value); }} />}
      {confirm && <ConfirmDialog state={confirm} onClose={(value) => { setConfirm(null); confirm.resolve(value); }} />}
    </>
  );

  return { ask, askForm, askConfirm, promptNode };
}
