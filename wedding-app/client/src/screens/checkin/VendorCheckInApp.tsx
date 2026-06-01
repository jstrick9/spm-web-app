/**
 * VendorCheckInApp — Phase 23: wired to real vendor_checkins backend.
 *
 * Status changes now POST to the server and persist across sessions.
 * The service worker's BackgroundSyncPlugin ensures check-ins work
 * even when WiFi drops in the parking lot.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Search, LogIn, LogOut, Clock, AlertCircle, Phone, Building2, UserCircle, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { sdk } from '../../sdk';
import type { CheckInStatus } from '../../sdk/checkins';
import { useToast } from '../../ui/Toast';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { cn } from '../../ui/lib/cn';
import { format } from 'date-fns';

interface Props { eventId: string; organizationId: string }

export function VendorCheckInApp({ eventId, organizationId }: Props) {
  const [time, setTime] = useState(new Date());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'expected' | 'arrived' | 'late'>('all');
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Real data from server ────────────────────────────
  const { data: vendorData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', eventId],
    queryFn: () => sdk.vendors.list(organizationId, { eventId }),
  });

  const { data: checkinData } = useQuery({
    queryKey: ['checkins', eventId],
    queryFn: () => sdk.checkins.list(eventId),
  });

  const vendors = vendorData?.vendors || [];
  const statusMap = checkinData?.statusMap || {};

  // ─── Mutation: update check-in status ─────────────────
  const updateMutation = useMutation({
    mutationFn: ({ vendorId, status }: { vendorId: string; status: CheckInStatus }) =>
      sdk.checkins.update(eventId, vendorId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkins', eventId] });
    },
    onError: () => {
      toast({ title: 'Status update failed — will retry when online', variant: 'destructive' });
    },
  });

  const updateStatus = (vendorId: string, status: CheckInStatus) => {
    updateMutation.mutate({ vendorId, status });
  };

  const handleScan = (decodedText: string) => {
    setScanning(false);
    const vendor = vendors.find(v => v.id === decodedText);
    if (vendor) {
      updateStatus(decodedText, 'arrived');
      toast({ title: `${vendor.name} Checked In!`, variant: 'success' });
    } else {
      toast({ title: 'Unknown QR Code', description: 'Could not match this pass to any vendor.', variant: 'destructive' });
    }
  };

  const filteredVendors = vendors.filter(v => {
    const s = statusMap[v.id] || 'expected';
    if (filter === 'expected' && s !== 'expected') return false;
    if (filter === 'arrived' && !['arrived', 'setup', 'completed'].includes(s)) return false;
    if (filter === 'late' && s !== 'expected') return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.category?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (vendorsLoading) {
    return <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4 animate-pulse">Loading check-in system...</div>;
  }

  const expectedCount = vendors.filter(v => (statusMap[v.id] || 'expected') === 'expected').length;
  const arrivedCount = vendors.filter(v => ['arrived', 'setup', 'completed'].includes(statusMap[v.id])).length;

  return (
    <div className="min-h-screen bg-surface-2/50 pb-20">
      <header className="bg-surface border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Vendor Check-In</h1>
            <p className="text-sm text-fg-muted mt-0.5">Tablet-optimized day-of operations</p>
          </div>
          <div className="flex items-center gap-4 bg-surface-2 px-4 py-2 rounded-lg border border-border shadow-sm">
            <Clock className="w-5 h-5 text-brand" />
            <div className="font-mono text-xl font-medium tracking-tight">{format(time, 'h:mm:ss a')}</div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-3 border-t border-border/50 flex gap-2 overflow-x-auto">
          {[
            { key: 'all' as const, label: 'All Vendors', count: vendors.length },
            { key: 'expected' as const, label: 'Expected', count: expectedCount },
            { key: 'arrived' as const, label: 'On-Site', count: arrivedCount },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
                filter === f.key ? "bg-fg text-surface" : "bg-surface-2 text-fg-muted hover:text-fg")}>
              {f.label} <span className="ml-1 opacity-70">({f.count})</span>
            </button>
          ))}
          <button onClick={() => setFilter('late')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap flex items-center gap-1",
              filter === 'late' ? "bg-danger text-danger-fg" : "bg-danger/10 text-danger hover:bg-danger/20")}>
            <AlertCircle className="w-3.5 h-3.5" /> Late
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-4 space-y-4">
        <div className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <Input placeholder="Search vendor or category..." className="pl-10 h-12 text-lg rounded-xl bg-surface shadow-sm border-border" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant="secondary" className="h-12 px-6 rounded-xl shadow-sm shrink-0 border border-border" onClick={() => setScanning(true)}>
            <QrCode className="w-5 h-5 mr-2" /> Scan
          </Button>
        </div>

        {filteredVendors.length === 0 ? (
          <div className="text-center py-20 text-fg-muted">
            <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No vendors match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVendors.map(vendor => {
              const status = statusMap[vendor.id] || 'expected';
              return (
                <Card key={vendor.id} className={cn("overflow-hidden transition-all duration-300", status !== 'expected' ? "border-brand/30 shadow-sm" : "border-border shadow-none")}>
                  <div className={cn("p-4", status !== 'expected' ? "bg-brand/5" : "bg-surface")}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{vendor.name}</h3>
                        <div className="text-sm font-medium text-fg-subtle uppercase tracking-widest mt-1">{vendor.category}</div>
                      </div>
                      <Badge variant={status === 'expected' ? 'outline' : status === 'departed' ? 'info' : 'success'} className="uppercase text-[10px] tracking-wider font-bold">
                        {status}
                      </Badge>
                    </div>

                    <div className="space-y-1 mb-6 text-sm">
                      {vendor.contact_name && <div className="flex items-center gap-2 text-fg-muted"><UserCircle className="w-4 h-4 opacity-50" /> {vendor.contact_name}</div>}
                      {vendor.phone && <div className="flex items-center gap-2 text-fg-muted"><Phone className="w-4 h-4 opacity-50" /> {vendor.phone}</div>}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
                      {status === 'expected' && (
                        <Button className="flex-1 min-w-[120px]" size="sm" onClick={() => updateStatus(vendor.id, 'arrived')}>
                          <LogIn className="w-4 h-4 mr-2" /> Mark Arrived
                        </Button>
                      )}
                      {status === 'arrived' && (
                        <Button className="flex-1 min-w-[120px]" variant="secondary" size="sm" onClick={() => updateStatus(vendor.id, 'setup')}>
                          <Building2 className="w-4 h-4 mr-2" /> Begin Setup
                        </Button>
                      )}
                      {status === 'setup' && (
                        <Button className="flex-1 min-w-[120px]" variant="outline" size="sm" onClick={() => updateStatus(vendor.id, 'completed')}>
                          <Clock className="w-4 h-4 mr-2" /> Setup Complete
                        </Button>
                      )}
                      {['completed', 'arrived', 'setup'].includes(status) && (
                        <Button className="flex-1 min-w-[120px]" variant="outline" size="sm" onClick={() => updateStatus(vendor.id, 'departed')}>
                          <LogOut className="w-4 h-4 mr-2 text-fg-subtle" /> Departed
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <QRScannerModal open={scanning} onClose={() => setScanning(false)} onScan={handleScan} />
    </div>
  );
}

function QRScannerModal({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (data: string) => void }) {
  useEffect(() => {
    if (!open) return;
    let scanner: any = null;
    const timeout = setTimeout(() => {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((text: string) => { scanner.clear(); onScan(text); }, () => {});
    }, 100);
    return () => { clearTimeout(timeout); if (scanner) try { scanner.clear(); } catch {} };
  }, [open, onScan]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm relative bg-white rounded-xl overflow-hidden">
        <div className="p-4 bg-surface flex justify-between items-center border-b border-border">
          <h3 className="font-semibold">Scan Vendor Pass</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div id="reader" className="w-full bg-black min-h-[300px]" />
      </div>
      <p className="text-white/70 mt-6 text-sm">Align the QR code within the frame.</p>
    </div>
  );
}
