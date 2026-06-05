import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Truck, ExternalLink, Mail, Phone, ShieldCheck, ShieldAlert, Edit, CreditCard, Calendar } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { useToast } from '../../../ui/Toast';
import { DataTable, type Column } from '../../../ui/DataTable';
import { Link } from 'lucide-react';
import { SdkVendor } from '../../../sdk/types';
import { VendorFormDialog } from './VendorFormDialog';
import { VendorPaymentDialog } from './VendorPaymentDialog';
import { VendorTimelineChart } from './VendorTimelineChart';
import { VendorCommunicationsHub } from './hub/VendorCommunicationsHub';
import { VendorMatchPanel } from './VendorMatchPanel';

interface Props {
  eventId: string;
  organizationId: string;
}

export function EventVendorsTab({ eventId, organizationId }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<SdkVendor | null>(null);
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

  // COI Analytics & Compliance Status helper
  const getCoiStatus = (v: SdkVendor) => {
    const meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata || '{}') : (v.metadata || {});
    if (!meta.coiReceived) {
      return { status: 'at-risk', label: 'At Risk (No COI)', insurer: null, policy: null, expires: null, color: 'danger' as const };
    }
    const expires = meta.coiExpirationDate;
    if (expires) {
      const expDate = new Date(expires);
      const today = new Date();
      // Set hours to zero for clean comparison
      expDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      if (expDate < today) {
        return { status: 'expired', label: 'Expired COI', insurer: meta.coiInsurer, policy: meta.coiPolicyNumber, expires, color: 'danger' as const };
      }
    }
    return { status: 'compliant', label: 'Compliant', insurer: meta.coiInsurer, policy: meta.coiPolicyNumber, expires, color: 'success' as const };
  };

  // Compile compliance aggregate counts
  const compliantCount = vendors.filter(v => getCoiStatus(v).status === 'compliant').length;
  const atRiskCount = vendors.filter(v => getCoiStatus(v).status !== 'compliant').length;

  const columns: Column<SdkVendor>[] = [
    {
      id: 'name',
      header: 'Vendor Name',
      cell: (v) => (
        <div className="font-semibold text-fg flex items-center gap-2">
          {v.name}
          {v.is_preferred === 1 && <Badge variant="brand" className="text-[10px]">Preferred</Badge>}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: (v) => <span className="text-fg-muted font-semibold capitalize">{v.category || '—'}</span>,
    },
    {
      id: 'coi',
      header: 'COI Compliance Status',
      cell: (v) => {
        const coi = getCoiStatus(v);
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={coi.color} className="text-[10px] uppercase font-bold tracking-tight py-0.5 px-2.5 max-w-fit">
              {coi.status === 'compliant' ? (
                <span className="flex items-center gap-1">🛡️ {coi.label}</span>
              ) : (
                <span className="flex items-center gap-1">🚨 {coi.label}</span>
              )}
            </Badge>
            {coi.insurer && (
              <span className="text-[9px] text-fg-subtle">
                {coi.insurer} ({coi.policy || 'No Policy#'})
              </span>
            )}
            {coi.expires && (
              <span className={coi.status === 'expired' ? "text-[9px] text-danger font-bold" : "text-[9px] text-fg-subtle"}>
                Expires: {new Date(coi.expires).toLocaleDateString()}
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: 'contact',
      header: 'Contact & Portal',
      cell: (v) => (
        <div className="flex flex-col text-xs text-fg-muted font-semibold">
          {v.contact_name ? <span className="font-bold text-fg">{v.contact_name}</span> : null}
          <div className="flex gap-2 items-center mt-1">
            {v.email && <a href={`mailto:${v.email}`} className="text-brand hover:underline flex items-center gap-1" aria-label="Email"><Mail className="w-3.5 h-3.5" /> {v.email}</a>}
            {v.phone && <a href={`tel:${v.phone}`} className="text-brand hover:underline flex items-center gap-1" aria-label="Phone"><Phone className="w-3.5 h-3.5" /> {v.phone}</a>}
            {v.website_url && <a href={v.website_url} target="_blank" rel="noreferrer" className="text-brand hover:underline" aria-label="Website"><ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <a href={`#/vendor/${v.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase font-medium text-brand tracking-wider hover:underline">
               <Link className="w-3 h-3" /> Vendor Portal Link
            </a>
            {getCoiStatus(v).status !== 'compliant' && (
              <Button 
                variant="outline" 
                size="xs" 
                className="text-[9px] h-6 py-0.5 px-2 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold rounded-lg inline-flex items-center gap-1 shadow-xs"
                onClick={() => {
                  const url = `${window.location.origin}/#/vendor/${v.id}`;
                  navigator.clipboard.writeText(url);
                  toast({ 
                    title: 'Remind Link Copied!', 
                    description: `Secure link for "${v.name}" copied to clipboard. Share this to let them upload COIs and answer questionnaires!`, 
                    variant: 'success' 
                  });
                }}
              >
                 🔔 Remind
              </Button>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Contract Amount',
      cell: (v) => (
        <div className="text-right font-bold tabular-nums">
          {v.contract_amount_cents ? `$${(v.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (v) => {
        const contract = v.contract_amount_cents || 0;
        const paid = v.amount_paid_cents || 0;
        const balance = contract - paid;
        return (
          <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
             <div className="tabular-nums font-bold">
               Bal: {balance > 0 ? `$${(balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : balance < 0 ? `-$${(Math.abs(balance) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00'}
             </div>
             {paid > 0 && <div className="text-[10px] text-success font-bold">Paid: ${(paid / 100).toLocaleString()}</div>}
             <div className="flex gap-1 mt-1">
                <Button 
                  variant="outline" 
                  size="xs" 
                  className="text-[9px] py-1 h-auto"
                  onClick={() => setPaymentVendor({ id: v.id, name: v.name })}
                >
                  <CreditCard className="w-3 h-3 mr-1" /> Log Pay
                </Button>
                <Button 
                  variant="outline" 
                  size="xs" 
                  className="text-[9px] py-1 h-auto border-brand/20 text-brand hover:bg-brand-soft/20"
                  onClick={() => setEditVendor(v)}
                >
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
             </div>
          </div>
        )
      }
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Search & Action Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-sm">
          <Input 
            startSlot={<Search className="w-4 h-4 text-fg-muted" />} 
            placeholder="Search vendors..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white border-[#e1d5c9] h-10 text-xs"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="font-bold">
          <Plus className="w-4 h-4 mr-1" /> Add Vendor Partner
        </Button>
      </div>

      {/* KPI Stats Panel with COI Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-[#e1d5c9] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-fg-subtle uppercase tracking-wider font-serif">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-fg">{vendors.length}</div>
            <p className="text-[10px] text-fg-subtle font-semibold mt-1">partners attached to event</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-[#e1d5c9] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-fg-subtle uppercase tracking-wider font-serif">Total Contracted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-fg tabular-nums">
              ${(totalContract / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-fg-subtle font-semibold mt-1">accrued financial liabilities</p>
          </CardContent>
        </Card>

        {/* Compliant COI KPI Card */}
        <Card className="bg-white border-success/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-success uppercase tracking-wider font-serif flex items-center gap-1">
               <ShieldCheck className="w-4 h-4" /> Compliant (COI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-success">{compliantCount}</div>
            <p className="text-[10px] text-success/80 font-semibold mt-1">verified active vendor insurance</p>
          </CardContent>
        </Card>

        {/* At Risk COI KPI Card */}
        <Card className="bg-white border-danger/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-danger uppercase tracking-wider font-serif flex items-center gap-1">
               <ShieldAlert className="w-4 h-4 text-danger animate-pulse" /> At Risk (No COI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-danger">{atRiskCount}</div>
            <p className="text-[10px] text-danger/80 font-semibold mt-1">unverified/expired vendor liability</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="pt-6 space-y-2 bg-white">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent></Card>
      ) : error ? (
        <Card><CardContent className="pt-6 text-sm text-danger bg-white">
          Failed to load vendor directory.
        </CardContent></Card>
      ) : (
        <Card className="border-[#e1d5c9] bg-white">
          <DataTable 
            columns={columns} 
            data={filtered} 
            getRowKey={v => v.id}
            emptyMessage={
               <div className="py-12 flex flex-col items-center text-center">
                 <Truck className="w-12 h-12 text-fg-subtle mb-4" />
                 <h3 className="text-lg font-medium font-serif text-fg">No vendors attached</h3>
                 <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                   Add caterers, florists, photographers, and other partners specific to this event.
                 </p>
                 <Button variant="outline" onClick={() => setCreateOpen(true)}>Add Vendor</Button>
               </div>
            }
          />
        </Card>
      )}

      {/* Smart vendor matching: reliability-ranked recommendations for this event */}
      <VendorMatchPanel eventId={eventId} />

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

      {editVendor && (
        <VendorFormDialog
          open={true}
          onOpenChange={(v) => !v && setEditVendor(null)}
          eventId={eventId}
          organizationId={organizationId}
          vendor={editVendor}
        />
      )}
    </div>
  );
}
