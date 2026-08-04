/**
 * EventBudgetTab — Phase 20: wired to real budget_items backend.
 *
 * Features:
 *   - KPI tiles: Planned / Actual / Paid / Remaining
 *   - DataTable with inline editing support
 *   - Add budget item dialog
 *   - Real CRUD via sdk.budget.*
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Plus, Trash2, Loader2, AlertTriangle, LockKeyhole, ShieldAlert, Scale } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkBudgetItem } from '../../../sdk/budget';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { StatCard } from '../../../ui/StatCard';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';
import { usePrompt } from '../../../ui/usePrompt';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../../ui/Dialog';
import { PaymentsPanel } from './PaymentsPanel';
import { usePermission } from '../../../lib/usePermission';

interface Props {
  eventId: string;
  organizationId: string;
}

function fmt(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function EventBudgetTab({ eventId, organizationId }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('budget.manage');
  const canViewBudget = usePermission('budget.view');
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['budget', eventId],
    queryFn: () => sdk.budget.list(eventId),
    enabled: canViewBudget,
  });

  const { data: eventData } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const { data: contractsData } = useQuery({
    queryKey: ['contracts', eventId],
    queryFn: () => sdk.contracts.list(eventId),
    enabled: managerMode || canManage,
  });

  const { data: financialLegalData } = useQuery({
    queryKey: ['financial-legal', eventId],
    queryFn: () => sdk.contracts.financialLegal(eventId),
    enabled: managerMode || canManage,
  });

  // Custom Budget Goal & Fee Projections States (Phase 6)
  const [taxRate, setTaxRate] = useState(8.25);
  const [serviceCharge, setServiceCharge] = useState(20);
  const [cateringCostPerGuest, setCateringCostPerGuest] = useState(75);

  const items = data?.items ?? [];
  const totals = data?.totals ?? { planned: 0, actual: 0, paid: 0 };
  const remaining = totals.actual - totals.paid;
  const contracts = contractsData?.contracts ?? [];
  const unsignedContracts = contracts.filter(c => c.status !== 'signed' && c.status !== 'expired').length;
  const expiredContracts = contracts.filter(c => c.status === 'expired').length;
  const eventMetadata = (() => { try { return typeof eventData?.event?.metadata === 'string' ? JSON.parse(eventData.event.metadata || '{}') : (eventData?.event?.metadata || {}); } catch { return {}; } })();
  const financialEscalations = financialLegalData?.financialLegal.escalations || (Array.isArray(eventMetadata.financialLegalEscalations) ? eventMetadata.financialLegalEscalations : []);
  const paymentDueRisk = financialLegalData?.financialLegal.paymentDueRisk || { overdue: 0, dueSoon: 0, pendingCents: 0 };
  const variancePct = totals.planned > 0
    ? Math.round(((totals.actual - totals.planned) / totals.planned) * 100)
    : 0;

  const guestCount = eventData?.event?.guest_count || 100;

  const projections = useMemo(() => {
    const baseBudget = totals.actual / 100;
    const variableCatering = guestCount * cateringCostPerGuest;
    const subtotal = baseBudget + variableCatering;
    const taxes = subtotal * (taxRate / 100);
    const serviceFees = subtotal * (serviceCharge / 100);
    const projectedTotal = subtotal + taxes + serviceFees;

    return {
      baseBudget,
      variableCatering,
      subtotal,
      taxes,
      serviceFees,
      projectedTotal
    };
  }, [totals.actual, guestCount, cateringCostPerGuest, taxRate, serviceCharge]);

  const escalateFinancialRisk = useMutation({
    mutationFn: (label: string) => sdk.contracts.createFinancialLegalEscalation(eventId, { sourceType: 'payment', label, severity: 'warning' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      toast({ title: 'Financial risk escalated', variant: 'success' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.budget.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget', eventId] });
      toast({ title: 'Item removed', variant: 'success' });
    },
  });

  if (!canViewBudget) {
    return <Card className="border-warning/30 bg-warning-soft/20"><CardContent className="p-5 text-sm text-warning space-y-2"><h2 className="font-bold flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Financial visibility limited</h2><p>You do not have budget visibility for this event. As a manager, use Contracts for operational obligations and escalate finance questions to the owner/admin.</p></CardContent></Card>;
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-48" /></div>;
  }

  return (
    <div className="space-y-6">
      {promptNode}
      <Card className="border-brand/20 bg-brand-soft/20">
        <CardContent className="p-4 text-sm text-fg-muted space-y-2">
          <h2 className="font-bold text-brand">First-time owner guide: budget vs contract vs payment link</h2>
          <p><strong>Budget</strong> tracks planned/actual internal costs. <strong>Contracts</strong> are signed legal commitments. <strong>Payment links</strong> are invoice/payment milestones used to collect deposits, installments, final balances, refunds, and reconciliation notes.</p>
          {remaining > 0 && <div className="rounded border border-warning/30 bg-warning-soft p-2 text-warning font-semibold">Balance due alert: {fmt(remaining)} remains unpaid on the event budget.</div>}
        </CardContent>
      </Card>

      {(managerMode || !canManage) && (
        <ManagerSafeFinancialRiskCard
          canManage={canManage}
          remaining={remaining}
          variancePct={variancePct}
          unsignedContracts={unsignedContracts}
          expiredContracts={expiredContracts}
          escalationCount={financialEscalations.filter((e: any) => e.status === 'open').length}
          paymentDueRisk={paymentDueRisk}
          onEscalate={() => escalateFinancialRisk.mutate(remaining > 0 ? 'Payment balance/risk needs owner review before event operations proceed.' : 'Contract/payment issue needs owner review.')}
        />
      )}

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <StatCard label="Total Planned" value={canManage ? fmt(totals.planned) : 'Limited'} />
        <StatCard
          label="Total Actual"
          value={canManage ? fmt(totals.actual) : 'Limited'}
          description={variancePct !== 0
            ? `${variancePct > 0 ? '+' : ''}${variancePct}% vs planned`
            : undefined}
        />
        <StatCard label="Total Paid" value={canManage ? fmt(totals.paid) : 'Limited'} />
        <StatCard
          label="Remaining"
          value={canManage ? fmt(remaining) : (remaining > 0 ? 'Balance risk' : 'No balance risk')}
          description={remaining > 0 ? 'still due' : remaining === 0 ? 'fully paid' : undefined}
        />
      </div>

      {/* Brand New: Budget Goal Tracker & Payment Calculator Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Left Card: Circular Progress Ring & Goal Tracking */}
         <Card className="border-paper-border bg-paper shadow-sm flex flex-col sm:flex-row items-center justify-between p-6 gap-6 rounded-2xl relative overflow-hidden">
            <div className="space-y-2 flex-1 z-10">
               <h3 className="font-serif font-black text-sm text-brand flex items-center gap-1.5">
                  🎨 Budget Allocation Goal
               </h3>
               <p className="text-xs text-fg-subtle font-semibold">
                  Visual progress of payments paid against actual vendor contract totals.
               </p>
               
               <div className="pt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-fg-subtle leading-normal">
                  <div className="bg-white p-2.5 rounded-xl border border-paper-border shadow-xs">
                     <span className="text-[10px] block uppercase font-bold">Actual Total</span>
                     <span className="text-sm font-black text-fg font-serif">{fmt(totals.actual)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-paper-border shadow-xs">
                     <span className="text-[10px] block uppercase font-bold text-success">Paid Balance</span>
                     <span className="text-sm font-black text-success font-serif">{fmt(totals.paid)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-paper-border shadow-xs col-span-2">
                     <span className="text-[10px] block uppercase font-bold text-brand">Pending Balances</span>
                     <span className="text-sm font-black text-brand font-serif">{fmt(remaining)}</span>
                  </div>
               </div>
            </div>

            {/* Circular Progress Ring */}
            <div className="relative flex items-center justify-center shrink-0 z-10">
               {(() => {
                  const paidPct = totals.actual > 0 ? Math.round((totals.paid / totals.actual) * 100) : 0;
                  const strokeDashoffset = 251.2 - (251.2 * Math.min(paidPct, 100)) / 100;
                  
                  return (
                     <>
                        <svg className="w-32 h-32 transform -rotate-90">
                           <circle 
                             cx="64" cy="64" r="40" 
                             stroke="#e1d5c9" strokeWidth="8" 
                             fill="transparent" 
                           />
                           <circle 
                             cx="64" cy="64" r="40" 
                             stroke="#be185d" strokeWidth="8" 
                             fill="transparent"
                             strokeDasharray="251.2"
                             strokeDashoffset={strokeDashoffset}
                             strokeLinecap="round"
                             className="transition-all duration-500 ease-in-out"
                           />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                           <span className="text-lg font-black text-brand font-serif">{paidPct}%</span>
                           <span className="text-[8px] uppercase tracking-wider text-fg-subtle font-bold">Paid</span>
                        </div>
                     </>
                  );
               })()}
            </div>
         </Card>

         {/* Right Card: Taxes, Gratuity & Variable Guest Calculator */}
         <Card className="border-paper-border bg-paper shadow-sm p-6 rounded-2xl space-y-4">
            <div className="pb-2 border-b border-paper-border/50 flex justify-between items-center">
               <div>
                  <h3 className="font-serif font-black text-sm text-brand">
                     📈 Fees &amp; Catering Calculator
                  </h3>
                  <p className="text-[10px] text-fg-subtle">Project taxes, gratuity charges, and guest-count-dependent catering budgets.</p>
               </div>
               <Badge variant="outline" className="bg-paper text-brand border-paper-border font-black text-[10px] py-0.5 px-2">
                  {guestCount} Guests
               </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs font-semibold text-fg">
               <div>
                  <Label className="text-[9px] uppercase font-bold text-fg-subtle">Catering / Guest ($)</Label>
                  <Input 
                     type="number" 
                     value={cateringCostPerGuest} 
                     onChange={(e) => setCateringCostPerGuest(parseFloat(e.target.value) || 0)} 
                     className="mt-1 bg-white border-paper-border text-xs h-8"
                  />
               </div>
               <div>
                  <Label className="text-[9px] uppercase font-bold text-fg-subtle">Tax Rate (%)</Label>
                  <Input 
                     type="number" 
                     step={0.01} 
                     value={taxRate} 
                     onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} 
                     className="mt-1 bg-white border-paper-border text-xs h-8"
                  />
               </div>
               <div>
                  <Label className="text-[9px] uppercase font-bold text-fg-subtle">Gratuity / Service (%)</Label>
                  <Input 
                     type="number" 
                     value={serviceCharge} 
                     onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)} 
                     className="mt-1 bg-white border-paper-border text-xs h-8"
                  />
               </div>
            </div>

            {/* Calculations Output */}
            <div className="bg-white p-3 rounded-xl border border-paper-border text-xs font-semibold text-fg-subtle leading-normal space-y-1">
               <div className="flex justify-between">
                  <span>Base Contracts Subtotal:</span>
                  <span className="font-bold text-fg">${projections.baseBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between text-brand">
                  <span>Variable Catering (Est):</span>
                  <span className="font-bold">${projections.variableCatering.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between">
                  <span>Estimated Taxes ({taxRate}%):</span>
                  <span className="font-bold text-fg">${projections.taxes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between">
                  <span>Gratuity &amp; Service Fee ({serviceCharge}%):</span>
                  <span className="font-bold text-fg">${projections.serviceFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between text-sm font-black pt-2 border-t text-brand font-serif">
                  <span>Total Projected Cost:</span>
                  <span>${projections.projectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
            </div>
         </Card>

      </div>

      <Card className="border-border bg-surface">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
          <div><div className="text-xs font-bold text-brand">Revenue / cashflow dashboard</div><div className="text-xl font-bold text-fg">{fmt(totals.paid)}</div><p className="text-[11px] text-fg-muted">cash collected</p></div>
          <div><div className="text-xs font-bold text-brand">Projected receivables</div><div className="text-xl font-bold text-fg">{fmt(remaining)}</div><p className="text-[11px] text-fg-muted">remaining event balance</p></div>
          <div><div className="text-xs font-bold text-brand">Payment milestones</div><div className="text-xl font-bold text-fg">Invoice schedule</div><p className="text-[11px] text-fg-muted">Use payment links below to build deposits/installments/final balance.</p></div>
        </CardContent>
      </Card>

      {/* Actions */}
      {canManage && (
        <div className="flex justify-end">
          <AddBudgetItemDialog eventId={eventId} open={addOpen} onOpenChange={setAddOpen} />
        </div>
      )}

      {/* Items table */}
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-16 text-center text-fg-muted text-sm">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-fg-subtle" />
              No budget items yet.{canManage && ' Click "Add Item" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="px-4 py-3 text-left font-medium text-fg-muted">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-fg-muted">Item</th>
                    <th className="px-4 py-3 text-right font-medium text-fg-muted">Planned</th>
                    <th className="px-4 py-3 text-right font-medium text-fg-muted hidden sm:table-cell">Actual</th>
                    <th className="px-4 py-3 text-right font-medium text-fg-muted">Paid</th>
                    <th className="px-4 py-3 text-right font-medium text-fg-muted hidden sm:table-cell">Balance</th>
                    {canManage && <th className="px-4 py-3 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const bal = (item.actual_cents ?? item.planned_cents) - item.paid_cents;
                    return (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-surface-2/30">
                        <td className="px-4 py-3">
                          <Badge variant="default" className="text-[11px]">{item.category}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{item.title}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(item.planned_cents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                          {item.actual_cents != null ? (
                            <span className={item.actual_cents > item.planned_cents ? 'text-danger' : ''}>
                              {fmt(item.actual_cents)}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(item.paid_cents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                          <span className={bal > 0 ? 'text-warning font-medium' : bal === 0 ? 'text-success' : ''}>
                            {fmt(bal)}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <button
                              onClick={async () => { if (await askConfirm({ title: 'Remove this budget item?', destructive: true })) deleteMutation.mutate(item.id); }}
                              className="p-1 text-fg-subtle hover:text-danger rounded"
                              title="Remove" aria-label="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-2/30 font-medium">
                    <td className="px-4 py-3" colSpan={2}>Totals</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.planned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{fmt(totals.actual)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.paid)}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{fmt(remaining)}</td>
                    {canManage && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real payment capture (Stripe / Square hosted checkout) */}
      <PaymentsPanel eventId={eventId} />
    </div>
  );
}

// ─── Add Budget Item Dialog ─────────────────────────────
function AddBudgetItemDialog({ eventId, open, onOpenChange }: {
  eventId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [category, setCategory] = useState('Venue');
  const [title, setTitle] = useState('');
  const [planned, setPlanned] = useState('');

  const createMutation = useMutation({
    mutationFn: () => sdk.budget.create(eventId, {
      category,
      title,
      plannedCents: Math.round(parseFloat(planned || '0') * 100),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget', eventId] });
      toast({ title: 'Budget item added', variant: 'success' });
      onOpenChange(false);
      setTitle('');
      setPlanned('');
    },
    onError: () => {
      toast({ title: 'Could not add item', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Budget Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" placeholder="e.g. Dinner Service" />
          </div>
          <div>
            <Label>Planned Amount ($)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm">$</span>
              <Input
                type="number" min={0} step={0.01}
                value={planned} onChange={e => setPlanned(e.target.value)}
                className="pl-7" placeholder="0.00"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
            isLoading={createMutation.isPending}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ManagerSafeFinancialRiskCard({ canManage, remaining, variancePct, unsignedContracts, expiredContracts, escalationCount, paymentDueRisk, onEscalate }: {
  canManage: boolean;
  remaining: number;
  variancePct: number;
  unsignedContracts: number;
  expiredContracts: number;
  escalationCount: number;
  paymentDueRisk: { overdue: number; dueSoon: number; pendingCents: number };
  onEscalate: () => void;
}) {
  const paymentRisk = remaining > 0;
  const contractRisk = unsignedContracts > 0 || expiredContracts > 0;
  const dueDateRisk = paymentDueRisk.overdue > 0 || paymentDueRisk.dueSoon > 0;
  const highRisk = paymentRisk || contractRisk || variancePct > 15 || dueDateRisk;
  return (
    <Card className={highRisk ? 'border-warning/30 bg-warning-soft/20' : 'border-success/30 bg-success-soft'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-bold text-brand flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Manager-safe financial risk card</h3>
            <p className="text-xs text-fg-muted mt-1">Shows operational risk without exposing owner/admin-only financial detail when visibility is limited.</p>
          </div>
          <Badge variant={highRisk ? 'warning' : 'success'}>{highRisk ? 'Review before event' : 'No major finance blocker'}</Badge>
        </div>
        {!canManage && <div className="rounded-lg border border-border bg-surface p-3 text-xs text-fg-muted"><LockKeyhole className="inline h-3.5 w-3.5 mr-1" /> Exact financial values and edits are owner/admin only. Managers can see risk categories and escalate blockers.</div>}
        <div className="grid gap-2 sm:grid-cols-4">
          <MiniRiskItem label="Payment risk" value={paymentDueRisk.overdue > 0 ? `${paymentDueRisk.overdue} overdue` : paymentDueRisk.dueSoon > 0 ? `${paymentDueRisk.dueSoon} due soon` : paymentRisk ? (canManage ? 'Balance due' : 'Possible balance due') : 'Clear'} danger={paymentRisk || dueDateRisk} />
          <MiniRiskItem label="Budget variance" value={canManage ? `${variancePct > 0 ? '+' : ''}${variancePct}%` : 'Limited'} danger={variancePct > 15} />
          <MiniRiskItem label="Unsigned contracts" value={unsignedContracts} danger={unsignedContracts > 0} />
          <MiniRiskItem label="Escalations" value={escalationCount} danger={escalationCount > 0} />
        </div>
        {(paymentRisk || contractRisk) && <Button size="sm" variant="outline" onClick={onEscalate}><AlertTriangle className="h-4 w-4" /> Escalate payment/contract risk</Button>}
        {expiredContracts > 0 && <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger font-semibold"><Scale className="inline h-3.5 w-3.5 mr-1" /> Do not proceed without owner approval: expired contract detected.</div>}
      </CardContent>
    </Card>
  );
}

function MiniRiskItem({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">{label}</div><div className={danger ? 'text-lg font-bold text-warning' : 'text-lg font-bold text-fg'}>{value}</div></div>;
}
