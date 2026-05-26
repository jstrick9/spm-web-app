/**
 * Form primitives bridging react-hook-form + our design tokens.
 * Mirrors the shadcn/ui Form API:
 *
 *   <Form {...form}>
 *     <FormField name="email" render={({ field }) => (
 *       <FormItem>
 *         <FormLabel>Email</FormLabel>
 *         <FormControl><Input {...field} /></FormControl>
 *         <FormDescription>We never share.</FormDescription>
 *         <FormMessage />
 *       </FormItem>
 *     )} />
 *   </Form>
 */
import {
  createContext, forwardRef, useContext, useId,
  type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes,
} from 'react';
import {
  Controller, FormProvider, useFormContext,
  type ControllerProps, type FieldPath, type FieldValues,
} from 'react-hook-form';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import { Label } from './Label';
import { cn } from './lib/cn';

export const Form = FormProvider;

interface FormFieldCtx { name: string }
const FormFieldContext = createContext<FormFieldCtx | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

interface FormItemCtx { id: string }
const FormItemContext = createContext<FormItemCtx | null>(null);

export function useFormField() {
  const fieldCtx = useContext(FormFieldContext);
  const itemCtx = useContext(FormItemContext);
  const formCtx = useFormContext();

  if (!fieldCtx) throw new Error('useFormField inside <FormField>');
  const fieldState = formCtx.getFieldState(fieldCtx.name, formCtx.formState);
  const id = itemCtx?.id ?? '';
  return {
    id,
    name: fieldCtx.name,
    formItemId:        `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId:     `${id}-form-item-message`,
    ...fieldState,
  };
}

export const FormItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = 'FormItem';

export const FormLabel = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return (
    <Label
      ref={ref}
      className={cn(error && 'text-danger', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

export const FormControl = forwardRef<
  ElementRef<typeof Slot>,
  ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

export const FormDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();
    return (
      <p ref={ref} id={formDescriptionId} className={cn('text-xs text-fg-subtle', className)} {...props} />
    );
  },
);
FormDescription.displayName = 'FormDescription';

export const FormMessage = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error.message ?? '') : children;
    if (!body) return null;
    return (
      <p
        ref={ref}
        id={formMessageId}
        className={cn('text-xs text-danger', className)}
        role="alert"
        {...props}
      >
        {body}
      </p>
    );
  },
);
FormMessage.displayName = 'FormMessage';
