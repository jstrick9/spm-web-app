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
import { DollarSign, Plus, Trash2, Loader2 } from 'lucide-react';
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
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('budget.manage');
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['budget', eventId],
    queryFn: () => sdk.budget.list(eventId),
  });

  const items = data?.items ?? [];
  const totals = data?.totals ?? { planned: 0, actual: 0, paid: 0 };
  const remaining = totals.actual - totals.paid;
  const variancePct = totals.planned > 0
    ? Math.round(((totals.actual - totals.planned) / totals.planned) * 100)
    : 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.budget.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget', eventId] });
      toast({ title: 'Item removed', variant: 'success' });
    },
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-48" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI band */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <StatCard label="Total Planned" value={fmt(totals.planned)} />
        <StatCard
          label="Total Actual"
          value={fmt(totals.actual)}
          description={variancePct !== 0
            ? `${variancePct > 0 ? '+' : ''}${variancePct}% vs planned`
            : undefined}
        />
        <StatCard label="Total Paid" value={fmt(totals.paid)} />
        <StatCard
          label="Remaining"
          value={fmt(remaining)}
          description={remaining > 0 ? 'still due' : remaining === 0 ? 'fully paid' : undefined}
        />
      </div>

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
                              onClick={() => { if (window.confirm('Remove this budget item?')) deleteMutation.mutate(item.id); }}
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
