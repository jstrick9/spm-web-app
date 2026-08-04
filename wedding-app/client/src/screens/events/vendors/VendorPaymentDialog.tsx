import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { useToast } from '../../../ui/Toast';
import { vendorsSdk } from '../../../sdk/vendors';
import { Trash2 } from 'lucide-react';

const paymentSchema = z.object({
  amountStr: z.string().min(1, 'Amount is required'),
  paidAt: z.string().min(1, 'Date is required'),
  method: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof paymentSchema>;

const formatCurrency = (val: string) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  eventId: string;
}

export function VendorPaymentDialog({ open, onOpenChange, vendorId, vendorName, eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amountStr: '',
      paidAt: new Date().toISOString().split('T')[0],
      method: '',
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const parsed = parseFloat(values.amountStr.replace(/[^0-9.]/g, ''));
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('Please enter a valid positive amount.');
      }
      return vendorsSdk.addPayment(vendorId, {
        amountCents: Math.round(parsed * 100),
        paidAt: values.paidAt,
        method: values.method,
        notes: values.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors', eventId] });
      qc.invalidateQueries({ queryKey: ['vendorPayments', vendorId] });
      toast({ title: 'Payment recorded', variant: 'success' });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: 'Failed to record payment', description: e.message, variant: 'destructive' });
    }
  });

  const paymentsQuery = useQuery({
    queryKey: ['vendorPayments', vendorId],
    queryFn: () => vendorsSdk.listPayments(vendorId),
    enabled: open,
  });

  const deletePayment = useMutation({
    mutationFn: (paymentId: string) => vendorsSdk.deletePayment(vendorId, paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors', eventId] });
      qc.invalidateQueries({ queryKey: ['vendorPayments', vendorId] });
      toast({ title: 'Payment removed', description: 'The running paid total was adjusted.', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Could not remove payment', description: e.message, variant: 'destructive' }),
  });

  const payments = (paymentsQuery.data as { payments?: Array<{ id: string; amount_cents: number; paid_at: string; method?: string | null; notes?: string | null }> } | undefined)?.payments ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Payment for {vendorName}</DialogTitle>
        </DialogHeader>

        {payments.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-2/60 p-3 space-y-1.5">
            <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">
              Payment history ({payments.length})
            </div>
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="font-semibold">
                  ${(p.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-fg-muted font-normal">
                    {" "}· {new Date(p.paid_at).toLocaleDateString()}
                    {p.method ? ` · ${p.method}` : ""}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Remove this payment and adjust the paid total?')) {
                      deletePayment.mutate(p.id);
                    }
                  }}
                  className="text-danger hover:underline inline-flex items-center gap-0.5"
                  aria-label={`Remove payment ${(p.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amountStr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="$0.00" 
                        {...field} 
                        onChange={(e) => {
                          const formatted = formatCurrency(e.target.value);
                          field.onChange(formatted);
                        }}
                        autoFocus 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paidAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Paid *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <FormControl><Input placeholder="e.g. Check, Wire, Credit Card" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / Notes</FormLabel>
                  <FormControl><Input placeholder="Check #1234" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 mt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
