/**
 * PaymentsPanel — collect real payments for an event via Stripe/Square.
 *
 * Lists payment links, lets staff create one, and — for stripe/square links —
 * generates a hosted checkout URL ("Collect Payment") that opens the provider's
 * secure payment page. Status reconciles automatically via provider webhooks
 * (this panel reflects the resulting payment_links status).
 *
 * FIX - Phase 3: Added printable receipt generation and balance ledgers.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CreditCard, Plus, ExternalLink, RefreshCw, FileText, CalendarDays } from 'lucide-react';
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
import { cn } from '../../../ui/lib/cn';
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
  const [dueDate, setDueDate] = useState('');
  const [provider, setProvider] = useState<'stripe' | 'square' | 'manual'>('stripe');
  const [milestone, setMilestone] = useState('Deposit');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [partialPaid, setPartialPaid] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const { data: eventData } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const { data } = useQuery({
    queryKey: ['payment-links', eventId],
    queryFn: () => sdk.paymentLinks.list(eventId),
  });
  const payments = data?.payments ?? [];
  const totals = data?.totals ?? { total: 0, paid: 0, pending: 0 };

  const createMutation = useMutation({
    mutationFn: () => sdk.paymentLinks.create(eventId, { 
      provider, 
      amountCents: Math.round(parseFloat(amount) * 100),
      metadata: { dueDate: dueDate || undefined, milestone, invoiceNumber: `INV-${Date.now().toString().slice(-6)}` }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-links', eventId] });
      setAddOpen(false); setAmount(''); setDueDate(''); setMilestone('Deposit');
      toast({ title: 'Payment link created', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not create payment', variant: 'destructive' }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, status, metadata }: { id: string; status: SdkPaymentLink['status']; metadata?: Record<string, any> }) =>
      sdk.paymentLinks.updateStatus(id, status, {
        metadata,
        reconciliationNote: reconciliationNote || undefined,
        partialPaidCents: partialPaid ? Math.round(Number(partialPaid) * 100) : undefined,
        refundedCents: refundAmount ? Math.round(Number(refundAmount) * 100) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-links', eventId] });
      setReconciliationNote(''); setPartialPaid(''); setRefundAmount('');
      toast({ title: 'Payment reconciled', variant: 'success' });
    },
    onError: (err: any) => toast({ title: 'Could not reconcile payment', description: err.message, variant: 'destructive' }),
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

  const printReceipt = (payment: SdkPaymentLink) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Popup blocked');
      
      const balance = totals.total - totals.paid;

      const html = `
        <html>
        <head>
          <title>Payment Receipt - ${eventData?.event?.title || 'Event'}</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: 'Georgia', serif;
              background-color: #fcfbfa;
              color: #2c2a29;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .receipt-box {
              border: 1px solid #e1d5c9;
              padding: 40px;
              width: 100%;
              max-width: 500px;
              background-color: #ffffff;
              box-shadow: 0 4px 12px rgba(0,0,0,0.02);
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2c2a29;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .venue-name {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-weight: bold;
              color: #741942;
              margin-bottom: 4px;
            }
            .receipt-title {
              font-size: 24px;
              font-weight: bold;
              margin: 0;
            }
            .section-title {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: bold;
              color: #777;
              border-bottom: 1px solid #e1d5c9;
              padding-bottom: 4px;
              margin-top: 25px;
              margin-bottom: 15px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin-bottom: 8px;
              font-family: sans-serif;
            }
            .row.total {
              font-size: 16px;
              font-weight: bold;
              font-family: 'Georgia', serif;
              border-top: 1px solid #2c2a29;
              padding-top: 8px;
              margin-top: 15px;
            }
            .footer-note {
              font-size: 10px;
              color: #777;
              text-align: center;
              margin-top: 40px;
              font-family: sans-serif;
            }
            @media print {
              body { padding: 0; background: none; }
              .receipt-box { border: 1px solid #000; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
             <div class="header">
                <div class="venue-name">${eventData?.event?.title || 'Wedding Venue Intelligence'}</div>
                <div class="receipt-title">Transaction Receipt</div>
             </div>
             
             <div class="section-title">Payment Details</div>
             <div class="row">
                <span>Payment Reference:</span>
                <span style="font-family: monospace;">${payment.id}</span>
             </div>
             <div class="row">
                <span>Payment Provider:</span>
                <span style="text-transform: capitalize;">${payment.provider}</span>
             </div>
             <div class="row">
                <span>Transaction Status:</span>
                <span style="color: #107d56; font-weight: bold;">Completed</span>
             </div>
             <div class="row">
                <span>Date &amp; Time:</span>
                <span>${payment.created_at ? new Date(payment.created_at).toLocaleString() : new Date().toLocaleString()}</span>
             </div>
             <div class="row total">
                <span>Amount Paid:</span>
                <span>$${(payment.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>

             <div class="section-title">Outstanding Balance Ledger</div>
             <div class="row">
                <span>Total Contracted Budget:</span>
                <span>$${(totals.total / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             <div class="row">
                <span>Total Instalments Paid:</span>
                <span style="color: #107d56; font-weight: bold;">$${(totals.paid / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             <div class="row" style="border-top: 1px dashed #e1d5c9; padding-top: 6px; margin-top: 10px; font-weight: bold;">
                <span>Remaining Account Balance:</span>
                <span>$${(balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>

             <div class="footer-note">
                Thank you for your business. For billing inquiries, contact your venue coordinator.
             </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      toast({ title: 'Payment receipt generated', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Failed to generate receipt', description: e.message, variant: 'destructive' });
    }
  };

  const columns: Column<SdkPaymentLink>[] = [
    { 
      id: 'amount', 
      header: 'Amount', 
      cell: (p) => {
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
        const dueDateStr = meta.dueDate;
        let isOverdueOrUrgent = false;
        if (dueDateStr && p.status !== 'completed' && p.status !== 'refunded') {
          const due = new Date(dueDateStr);
          due.setHours(0,0,0,0);
          const today = new Date();
          today.setHours(0,0,0,0);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) {
            isOverdueOrUrgent = true;
          }
        }

        return (
          <span className={cn("font-medium", isOverdueOrUrgent ? "text-danger font-black flex items-center gap-1.5" : "")}>
             {money(p.amount_cents)}
             {isOverdueOrUrgent && <span className="text-[8px] bg-red-100 text-danger border border-red-200 px-1 py-0.5 rounded-md animate-pulse uppercase">Urgent</span>}
          </span>
        );
      } 
    },
    { id: 'provider', header: 'Provider', cell: (p) => <span className="capitalize">{p.provider}</span> },
    { 
      id: 'dueDate', 
      header: 'Due Date / Milestone', 
      cell: (p) => {
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
        const dueDateStr = meta.dueDate;
        if (!dueDateStr) return <span className="text-fg-subtle text-xs">—</span>;
        
        const due = new Date(dueDateStr);
        due.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;
        const isUrgent = diffDays >= 0 && diffDays <= 7;
        const finalized = p.status === 'completed' || p.status === 'refunded';

        return (
          <span className={cn(
            "text-xs font-semibold",
            !finalized && isOverdue ? "text-danger font-black" : (!finalized && isUrgent ? "text-amber-600 font-bold" : "text-fg-subtle")
          )}>
            {new Date(dueDateStr).toLocaleDateString()}
            {!finalized && isOverdue && " (Overdue)"}
            {!finalized && isUrgent && " (Due soon)"}
          </span>
        );
      }
    },
    { id: 'status', header: 'Status', cell: (p) => <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>{p.status}</Badge> },
    {
      id: 'action', header: '', headerClassName: 'text-right', className: 'text-right',
      cell: (p) => {
        const isProviderLink = p.provider === 'stripe' || p.provider === 'square';
        const finalized = p.status === 'completed' || p.status === 'refunded';
        
        if (p.status === 'completed') {
          return (
            <Button size="xs" variant="outline"
              onClick={() => printReceipt(p)}
              className="text-[10px] py-1 h-auto border-brand/20 text-brand hover:bg-brand-soft/20 font-bold">
              🧾 Print Receipt
            </Button>
          );
        }

        if (p.payment_url && !finalized) {
          return (
            <a href={p.payment_url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-sm text-brand hover:underline font-bold">
              Pay <ExternalLink className="h-3 w-3" />
            </a>
          );
        }
        if (isProviderLink && !finalized && canManage) {
          return (
            <Button size="xs" variant="outline"
              onClick={() => checkoutMutation.mutate(p.id)}
              disabled={checkoutMutation.isPending}
              className="font-bold">
              <CreditCard className="h-3.5 w-3.5 mr-1" /> Collect Payment
            </Button>
          );
        }
        return <span className="text-fg-subtle text-xs">—</span>;
      },
    },
  ];

  return (
    <Card className="border-[#e1d5c9] bg-[#FDFBF7]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-[#e1d5c9] pb-4">
        <CardTitle className="text-base flex items-center gap-2 font-serif text-brand font-black">
          <CreditCard className="h-4 w-4 text-brand" /> Payments Ledger
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
              <DialogContent className="bg-[#FDFBF7] border border-[#e1d5c9]">
                <DialogHeader><DialogTitle className="font-serif font-bold text-lg text-fg">New Payment Link</DialogTitle></DialogHeader>
                <div className="space-y-4 font-semibold text-xs text-fg">
                  <div>
                    <Label>Amount ($)</Label>
                    <Input type="number" min={0} step={0.01} value={amount}
                      onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-1 bg-white border-[#e1d5c9] text-xs h-9" />
                    {/* MODULE-06 FI-14: field-level feedback instead of a generic toast on 400 */}
                    {amount && (Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) && (
                      <p className="mt-1 text-xs text-danger">Enter an amount greater than zero.</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="pay-provider">Provider</Label>
                    <select id="pay-provider" value={provider}
                      onChange={(e) => setProvider(e.target.value as typeof provider)}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-[#e1d5c9] bg-white text-xs font-semibold cursor-pointer">
                      <option value="stripe">Stripe (hosted checkout)</option>
                      <option value="square">Square (hosted checkout)</option>
                      <option value="manual">Manual (record only)</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="pay-milestone">Milestone / Invoice Label</Label>
                    <Input id="pay-milestone" value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="Deposit, Installment 1, Final Balance" className="mt-1 bg-white border-[#e1d5c9] text-xs h-9" />
                  </div>
                  <div>
                    <Label htmlFor="pay-due-date">Payment Due Date / Milestone (Optional)</Label>
                    <Input 
                      type="date" 
                      id="pay-due-date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)} 
                      className="mt-1 bg-white border-[#e1d5c9] text-xs h-9" 
                    />
                  </div>
                </div>
                <DialogFooter className="border-t border-[#e1d5c9] pt-4 mt-2">
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
      <CardContent className="space-y-6 pt-6">
        <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-4 text-sm text-fg space-y-2">
          <h3 className="font-bold text-brand flex items-center gap-2"><FileText className="h-4 w-4" /> Budget vs contract vs payment link</h3>
          <p><strong>Budget</strong> is your internal estimate/actual ledger. <strong>Contracts</strong> are signed agreements. <strong>Payment links</strong> are invoice-style collection milestones tied to deposits, installments, balances, refunds, or manual reconciliation.</p>
          <p className="text-xs text-fg-muted">Provider setup prompt: connect Stripe or Square in Integration Hub before collecting hosted payments; use Manual for offline checks/cash/ACH records.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniPaymentInfo title="Invoice schedule" icon={<CalendarDays className="h-4 w-4" />} value={`${payments.length} invoice${payments.length === 1 ? '' : 's'}`} detail="Use due dates as invoice/payment milestones." />
          <MiniPaymentInfo title="Payment plan builder" icon={<CreditCard className="h-4 w-4" />} value={money(totals.pending)} detail="Create deposit, installment, and final balance links." />
          <MiniPaymentInfo title="Auto-reminders" icon={<Bell className="h-4 w-4" />} value="Ready" detail="Due-date milestones can feed email/SMS reminders." />
        </div>

        {totals.pending > 0 && <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning font-semibold">Balance due alert: {money(totals.pending)} remains pending for this event.</div>}

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Contracted" value={money(totals.total)} className="bg-white border-[#e1d5c9] shadow-sm font-serif" />
          <StatCard label="Paid Balance" value={money(totals.paid)} className="bg-white border-success/20 shadow-sm font-serif text-success" />
          <StatCard label="Pending Balance" value={money(totals.pending)} className="bg-white border-[#e1d5c9] shadow-sm font-serif" />
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-fg-subtle py-12 text-center border border-dashed border-[#e1d5c9] rounded-xl bg-white font-serif italic">
            No payments yet. Create one and collect via Stripe or Square.
          </p>
        ) : (
          <>
            <DataTable data={payments} columns={columns} getRowKey={(p) => p.id} className="border-[#e1d5c9] bg-white" />
            {canManage && (
              <div className="rounded-xl border border-border bg-white p-4 space-y-3">
                <h3 className="text-sm font-bold text-brand">Payment reconciliation notes / partial & refund states</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input placeholder="Partial paid amount" value={partialPaid} onChange={(e) => setPartialPaid(e.target.value)} />
                  <Input placeholder="Refund amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                  <Input placeholder="Reconciliation note" value={reconciliationNote} onChange={(e) => setReconciliationNote(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {payments.slice(0, 3).map((p) => <Button key={p.id} size="xs" variant="outline" onClick={() => updatePaymentMutation.mutate({ id: p.id, status: partialPaid ? 'processing' : refundAmount ? 'refunded' : 'completed', metadata: { partialPaidCents: partialPaid ? Math.round(Number(partialPaid) * 100) : undefined, refundedCents: refundAmount ? Math.round(Number(refundAmount) * 100) : undefined } })}>Reconcile {money(p.amount_cents)}</Button>)}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniPaymentInfo({ title, icon, value, detail }: { title: string; icon: React.ReactNode; value: string; detail: string }) {
  return <div className="rounded-lg border border-border bg-white p-3"><div className="flex items-center gap-2 text-xs font-bold text-brand">{icon}{title}</div><div className="mt-1 text-lg font-bold text-fg">{value}</div><p className="text-[11px] text-fg-muted">{detail}</p></div>;
}
