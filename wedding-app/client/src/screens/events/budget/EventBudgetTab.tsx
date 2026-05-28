import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Plus, Download, AlertCircle } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { DataTable, type Column } from '../../../ui/DataTable';

interface Props {
  eventId: string;
  organizationId: string;
}

export function EventBudgetTab({ eventId, organizationId }: Props) {
  // We'll mock the budget line items for now until the backend repo is built
  const [lineItems, setLineItems] = useState([
    { id: '1', category: 'Venue', title: 'Base Rental', plannedCents: 1000000, actualCents: 1000000, paidCents: 500000 },
    { id: '2', category: 'Catering', title: 'Dinner Service', plannedCents: 850000, actualCents: 900000, paidCents: 200000 },
    { id: '3', category: 'Florals', title: 'Arch & Centerpieces', plannedCents: 300000, actualCents: null, paidCents: 0 },
    { id: '4', category: 'Photography', title: 'Package A', plannedCents: 450000, actualCents: 450000, paidCents: 450000 },
  ]);

  const { data: vendorData } = useQuery({
    queryKey: ['vendors', eventId],
    queryFn: () => sdk.vendors.list(organizationId, { eventId }),
  });

  const totals = useMemo(() => {
    let planned = 0;
    let actual = 0;
    let paid = 0;
    for (const item of lineItems) {
      planned += item.plannedCents || 0;
      actual += item.actualCents || 0;
      paid += item.paidCents || 0;
    }
    return { planned, actual, paid, remaining: actual - paid, variance: actual - planned };
  }, [lineItems]);

  const columns: Column<typeof lineItems[0]>[] = [
    {
      id: 'category',
      header: 'Category',
      cell: (item) => <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{item.category}</Badge>
    },
    {
      id: 'title',
      header: 'Line Item',
      cell: (item) => <div className="font-medium">{item.title}</div>
    },
    {
      id: 'planned',
      header: 'Planned',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      cell: (item) => `$${(item.plannedCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      id: 'actual',
      header: 'Actual',
      className: 'text-right tabular-nums font-medium',
      headerClassName: 'text-right',
      cell: (item) => item.actualCents ? `$${(item.actualCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : <span className="text-fg-subtle">—</span>
    },
    {
      id: 'variance',
      header: 'Variance',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      cell: (item) => {
        if (!item.actualCents) return <span className="text-fg-subtle">—</span>;
        const diff = item.actualCents - item.plannedCents;
        if (diff === 0) return <span className="text-fg-muted">$0.00</span>;
        if (diff > 0) return <span className="text-danger">+$${(diff / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
        return <span className="text-success">-$${(Math.abs(diff) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
      }
    },
    {
      id: 'paid',
      header: 'Paid',
      className: 'text-right tabular-nums text-success',
      headerClassName: 'text-right',
      cell: (item) => item.paidCents > 0 ? `$${(item.paidCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : <span className="text-fg-subtle">—</span>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-fg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-brand" /> Budget Tracker
        </h2>
        <div className="flex items-center gap-2">
           <Button variant="outline"><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
           <Button><Plus className="w-4 h-4 mr-1" /> Add Line Item</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-surface-2 border-transparent">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-fg-muted mb-1">Total Planned</div>
            <div className="text-2xl font-bold">${(totals.planned / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-fg-muted mb-1">Total Actual</div>
            <div className="text-2xl font-bold">${(totals.actual / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            {totals.variance !== 0 && (
              <div className={`text-xs mt-1 font-medium ${totals.variance > 0 ? 'text-danger' : 'text-success'}`}>
                {totals.variance > 0 ? '+' : '-'}${(Math.abs(totals.variance) / 100).toLocaleString()} vs planned
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-fg-muted mb-1 flex items-center justify-between">
               Total Paid
               <Badge variant="success" className="text-[10px]">{(totals.paid / totals.actual * 100 || 0).toFixed(0)}%</Badge>
            </div>
            <div className="text-2xl font-bold text-success">${(totals.paid / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="border-danger/30">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-fg-muted mb-1 flex items-center gap-1 text-danger">
               Remaining Balance
               {totals.remaining > 0 && <AlertCircle className="w-3 h-3" />}
            </div>
            <div className="text-2xl font-bold text-danger">${(totals.remaining / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <DataTable 
          data={lineItems} 
          columns={columns} 
          emptyMessage="No budget items tracked yet."
        />
      </Card>
    </div>
  );
}
