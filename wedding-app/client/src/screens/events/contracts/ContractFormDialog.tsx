import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';

const CLAUSES = {
  forceMajeure: 'Force majeure: Neither party is liable for delays caused by events beyond reasonable control, including severe weather, acts of God, or government restrictions.',
  cancellation: 'Cancellation: Client cancellation, date changes, and retainer treatment follow the venue policy documented in this agreement.',
  insurance: 'Insurance: Vendors must provide active certificates of insurance and name the venue as additional insured when required.',
  payment: 'Payment schedule: Deposit, interim installments, and final balance must be paid by the dates listed in the payment milestone schedule.',
};

const TEMPLATES = {
  venue: `Venue Agreement\n\n{{payment}}\n\n{{cancellation}}\n\n{{forceMajeure}}`,
  vendor: `Vendor Contract Packet\n\n{{insurance}}\n\n{{payment}}\n\n{{forceMajeure}}`,
  couple: `Couple Planning Agreement\n\n{{payment}}\n\n{{cancellation}}`,
};

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  recipientName: z.string().min(1, 'Recipient Name is required'),
  recipientEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  amountStr: z.string().optional(),
  template: z.enum(['venue', 'vendor', 'couple']).optional(),
  content: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: FormValues) => void;
}

function renderTemplate(template: keyof typeof TEMPLATES) {
  return TEMPLATES[template]
    .replace('{{forceMajeure}}', CLAUSES.forceMajeure)
    .replace('{{cancellation}}', CLAUSES.cancellation)
    .replace('{{insurance}}', CLAUSES.insurance)
    .replace('{{payment}}', CLAUSES.payment);
}

export function ContractFormDialog({ open, onOpenChange, onSave }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', recipientName: '', recipientEmail: '', amountStr: '', template: 'venue', content: renderTemplate('venue') },
  });

  const onSubmit = (data: FormValues) => {
    onSave(data);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contract Template Wizard</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg border border-brand/20 bg-brand-soft/20 p-3 text-xs text-fg-muted">
              <strong className="text-fg">Clause library:</strong> force majeure, cancellation, insurance, and payment schedule clauses can be inserted from templates and edited before sending.
            </div>

            <FormField control={form.control} name="template" render={({ field }) => (
              <FormItem>
                <FormLabel>Template</FormLabel>
                <FormControl>
                  <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" value={field.value} onChange={(e) => { field.onChange(e.target.value); form.setValue('content', renderTemplate(e.target.value as keyof typeof TEMPLATES)); }}>
                    <option value="venue">Venue agreement</option>
                    <option value="vendor">Vendor contract packet</option>
                    <option value="couple">Couple planning agreement</option>
                  </select>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Document Title *</FormLabel><FormControl><Input placeholder="e.g. Venue Agreement" {...field} autoFocus /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="recipientName" render={({ field }) => (
              <FormItem><FormLabel>Primary Signer Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="recipientEmail" render={({ field }) => (
                <FormItem><FormLabel>Signer Email</FormLabel><FormControl><Input type="email" placeholder="john@doe.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="amountStr" render={({ field }) => (
                <FormItem><FormLabel>Contract Value</FormLabel><FormControl><Input placeholder="$0.00" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem><FormLabel>Contract Content</FormLabel><FormControl><textarea className="min-h-48 w-full rounded-md border border-border bg-surface p-3 text-sm" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="pt-4 mt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Draft Document</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
