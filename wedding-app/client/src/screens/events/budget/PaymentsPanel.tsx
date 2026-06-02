/**
 * PaymentsPanel — collect real payments for an event via Stripe/Square.
 *
 * Lists payment links, lets staff create one, and — for stripe/square links —
 * generates a hosted checkout URL ("Collect Payment") that opens the provider's
 * secure payment page. Status reconciles automatically via provider webhooks
 * (this panel reflects the resulting payment_links status).
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, ExternalLink, RefreshCw } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkPaymentLink } from '../../../sdk/intelligence';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { StatCard } from '../../../ui/StatCard';
import { DataTable, type Column } from '../../../ui/DataTable';
import { useToast } from '../../../ui/Toast';
import { usePermission } from '../../../lib/usePermission';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../../ui/Dialog';

interface Props { eventId: string }

const STATUS_VARIANT: Record<SdkPaymentLink['status'], 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  completed: 'success', processing: 'info', pending: 'warning', failed: 'danger', refunded: 'default',
};

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function PaymentsPanel({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('budget.manage');
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState<'stripe' | 'square' | 'manual'>('stripe');

  const { data } = useQuery({
    queryKey: ['payment-links', eventId],
    queryFn: () => sdk.paymentLinks.list(eventId),
  });
  const payments = data?.payments ?? [];
  const totals = data?.totals ?? { total: 0, paid: 0, pending: 0 };

  const createMutation = useMutation({
    mutationFn: () => sdk.paymentLinks.create(eventId, { provider, amountCents: Math.round(parseFloat(amount) * 100) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-links', eventId] });
      setAddOpen(false); setAmount('');
      toast({ title: 'Payment link created', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not create payment', variant: 'destructive' }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (id: string) => sdk.paymentLinks.checkout(id),
    onSuccess: ({ checkoutUrl }) => {
      qc.invalidateQueries({ queryKey: ['payment-links', eventId] });
      // Open the provider's hosted checkout in a new tab.
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      toast({ title: 'Checkout ready', description: 'Opened the secure payment page in a new tab.', variant: 'success' });
    },
    onError: (err: any) => {
      const code = err?.body?.error ?? err?.message ?? '';
      const msg = code === 'not-connected'
        ? 'Connect Stripe or Square in the Integration Hub first.'
        : code === 'provider-unsupported'
          ? 'Manual links have no hosted checkout. Use Stripe or Square.'
          : 'Could not create checkout.';
      toast({ title: 'Checkout unavailable', description: msg, variant: 'destructive' });
    },
  });

  const columns: Column<SdkPaymentLink>[] = [
    { id: 'amount', header: 'Amount', cell: (p) => <span className="font-medium">{money(p.amount_cents)}</span> },
    { id: 'provider', header: 'Provider', cell: (p) => <span className="capitalize">{p.provider}</span> },
    { id: 'status', header: 'Status', cell: (p) => <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>{p.status}</Badge> },
    {
      id: 'action', header: '', headerClassName: 'text-right', className: 'text-right',
      cell: (p) => {
        const isProviderLink = p.provider === 'stripe' || p.provider === 'square';
        const finalized = p.status === 'completed' || p.status === 'refunded';
        if (p.payment_url && !finalized) {
          return (
            <a href={p.payment_url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
              Pay <ExternalLink className="h-3 w-3" />
            </a>
          );
        }
        if (isProviderLink && !finalized && canManage) {
          return (
            <Button size="xs" variant="outline"
              onClick={() => checkoutMutation.mutate(p.id)}
              disabled={checkoutMutation.isPending}>
              <CreditCard className="h-3.5 w-3.5 mr-1" /> Collect Payment
            </Button>
          );
        }
        return <span className="text-fg-subtle text-xs">—</span>;
      },
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-brand" /> Payments
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Refresh payments"
            onClick={() => qc.invalidateQueries({ queryKey: ['payment-links', eventId] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canManage && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Payment</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Amount ($)</Label>
                    <Input type="number" min={0} step={0.01} value={amount}
                      onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="pay-provider">Provider</Label>
                    <select id="pay-provider" value={provider}
                      onChange={(e) => setProvider(e.target.value as typeof provider)}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-surface text-sm">
                      <option value="stripe">Stripe (hosted checkout)</option>
                      <option value="square">Square (hosted checkout)</option>
                      <option value="manual">Manual (record only)</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!amount || parseFloat(amount) <= 0 || createMutation.isPending}
                    isLoading={createMutation.isPending}
                  >Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={money(totals.total)} />
          <StatCard label="Paid" value={money(totals.paid)} />
          <StatCard label="Pending" value={money(totals.pending)} />
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-fg-muted py-6 text-center border border-dashed border-border rounded-md">
            No payments yet. Create one and collect via Stripe or Square.
          </p>
        ) : (
          <DataTable data={payments} columns={columns} getRowKey={(p) => p.id} />
        )}
      </CardContent>
    </Card>
  );
}
