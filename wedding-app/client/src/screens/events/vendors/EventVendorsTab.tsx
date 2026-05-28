import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Truck, ExternalLink, Mail, Phone } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { DataTable, type Column } from '../../../ui/DataTable';
import { Link } from 'lucide-react';
import { SdkVendor } from '../../../sdk/types';
import { VendorFormDialog } from './VendorFormDialog';
import { VendorPaymentDialog } from './VendorPaymentDialog';
import { VendorTimelineChart } from './VendorTimelineChart';
import { VendorCommunicationsHub } from './hub/VendorCommunicationsHub';
import { CreditCard } from 'lucide-react';

interface Props {
  eventId: string;
  organizationId: string;
}

export function EventVendorsTab({ eventId, organizationId }: Props) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentVendor, setPaymentVendor] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors', eventId],
    queryFn: () => sdk.vendors.list(organizationId, { eventId }),
  });

  const vendors = data?.vendors || [];
  const filtered = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    (v.category && v.category.toLowerCase().includes(search.toLowerCase()))
  );

  const totalContract = vendors.reduce((acc, v) => acc + (v.contract_amount_cents || 0), 0);

  const columns: Column<SdkVendor>[] = [
    {
      id: 'name',
      header: 'Vendor Name',
      cell: (v) => (
        <div className="font-medium text-fg flex items-center gap-2">
          {v.name}
          {v.is_preferred === 1 && <Badge variant="brand" className="text-[10px]">Preferred</Badge>}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: (v) => <span className="text-fg-muted">{v.category || '—'}</span>,
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: (v) => (
        <div className="flex flex-col text-sm text-fg-muted">
          {v.contact_name ? <span>{v.contact_name}</span> : null}
          <div className="flex gap-2 items-center mt-1">
            {v.email && <a href={`mailto:${v.email}`} className="text-brand hover:underline" aria-label="Email"><Mail className="w-3.5 h-3.5" /></a>}
            {v.phone && <a href={`tel:${v.phone}`} className="text-brand hover:underline" aria-label="Phone"><Phone className="w-3.5 h-3.5" /></a>}
            {v.website_url && <a href={v.website_url} target="_blank" rel="noreferrer" className="text-brand hover:underline" aria-label="Website"><ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>
          <div className="mt-2">
            <a href={`#/vendor/${v.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase font-medium text-brand tracking-wider hover:underline">
               <Link className="w-3 h-3" /> Vendor Portal Link
            </a>
          </div>
        </div>
      ),
    },
    
    {
      id: 'amount',
      header: 'Contract Amount',
      cell: (v) => (
        <div className="text-right tabular-nums">
          {v.contract_amount_cents ? `${(v.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </div>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      cell: (v) => {
        const contract = v.contract_amount_cents || 0;
        const paid = v.amount_paid_cents || 0;
        const balance = contract - paid;
        return (
          <div className="flex flex-col items-end">
             <div className="tabular-nums font-medium">
               {balance > 0 ? `${(balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : balance < 0 ? `-${(Math.abs(balance) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00'}
             </div>
             {paid > 0 && <div className="text-[10px] text-success">Paid: ${(paid / 100).toLocaleString()}</div>}
             <Button 
               variant="outline" 
               size="xs" 
               className="mt-2 text-[10px] py-1 h-auto"
               onClick={() => setPaymentVendor({ id: v.id, name: v.name })}
             >
               <CreditCard className="w-3 h-3 mr-1" /> Log Payment
             </Button>
          </div>
        )
      }
    }
  ];


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-sm">
          <Input 
            startSlot={<Search className="w-4 h-4 text-fg-muted" />} 
            placeholder="Search vendors..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Vendor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-fg-muted">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{vendors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-fg-muted">Total Contracted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              ${(totalContract / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="pt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </CardContent></Card>
      ) : error ? (
        <Card><CardContent className="pt-6 text-sm text-danger">
          Failed to load vendors.
        </CardContent></Card>
      ) : (
        <Card>
          <DataTable 
            columns={columns} 
            data={filtered} 
            getRowKey={v => v.id}
            emptyMessage={
               <div className="py-12 flex flex-col items-center text-center">
                 <Truck className="w-12 h-12 text-fg-subtle mb-4" />
                 <h3 className="text-lg font-medium">No vendors attached</h3>
                 <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                   Add caterers, florists, photographers, and other partners specific to this event.
                 </p>
                 <Button variant="outline" onClick={() => setCreateOpen(true)}>Add Vendor</Button>
               </div>
            }
          />
        </Card>
      )}

      {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}
        {vendors.length > 0 && <VendorCommunicationsHub eventId={eventId} organizationId={organizationId} />}

      {paymentVendor && (
        <VendorPaymentDialog
           open={true}
           onOpenChange={(v) => !v && setPaymentVendor(null)}
           vendorId={paymentVendor.id}
           vendorName={paymentVendor.name}
           eventId={eventId}
        />
      )}

      {createOpen && (
        <VendorFormDialog 
          open={createOpen} 
          onOpenChange={setCreateOpen} 
          eventId={eventId} 
          organizationId={organizationId} 
        />
      )}
    </div>
  );
}
