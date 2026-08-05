/**
 * VendorCheckInApp — Phase 23: wired to real vendor_checkins backend.
 *
 * Status changes now POST to the server and persist across sessions.
 * The service worker's BackgroundSyncPlugin ensures check-ins work
 * even when WiFi drops in the parking lot.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Search, LogIn, LogOut, Clock, AlertCircle, Phone, Building2, UserCircle, X, Download, Keyboard, MessageSquare, Loader2, Camera, LockKeyhole } from 'lucide-react';
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
  const [kioskMode, setKioskMode] = useState(false);
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
    const vendor = vendors.find(v => v.id === decodedText || v.name.toLowerCase() === decodedText.toLowerCase());
    if (vendor) {
      updateStatus(vendor.id, 'arrived');
      toast({ title: `${vendor.name} Checked In!`, variant: 'success' });
    } else {
      toast({ title: 'Unknown QR Code', description: 'Could not match this pass to any vendor. Use manual search fallback below.', variant: 'destructive' });
    }
  };

  const exportReport = () => {
    const rows = [['Vendor','Category','Contact','Phone','Status'], ...vendors.map(v => [v.name, v.category || '', v.contact_name || '', v.phone || '', statusMap[v.id] || 'expected'])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-checkin-report-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredVendors = vendors.filter(v => {
    const s = statusMap[v.id] || 'expected';
    if (filter === 'expected' && s !== 'expected') return false;
    if (filter === 'arrived' && !['arrived', 'setup', 'completed'].includes(s)) return false;
    // 'late' shows vendors explicitly marked late by the day-of captain.
    if (filter === 'late' && s !== 'late') return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.category?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (vendorsLoading) {
    return <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4 animate-pulse">Loading check-in system...</div>;
  }

  const expectedCount = vendors.filter(v => (statusMap[v.id] || 'expected') === 'expected').length;
  const arrivedCount = vendors.filter(v => ['arrived', 'setup', 'completed'].includes(statusMap[v.id])).length;
  const lateCount = vendors.filter(v => statusMap[v.id] === 'late').length;

  return (
    <div className={cn("min-h-screen bg-surface-2/50 pb-20", kioskMode && "bg-black text-white")}>
      <header className="bg-surface border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Vendor Check-In</h1>
            <p className="text-sm text-fg-muted mt-0.5">Day-of captain mode · tablet/mobile optimized operations</p>
            <p className={cn("text-xs mt-1", kioskMode ? "text-white/70" : "text-fg-subtle")}>Offline mode: if WiFi drops, updates will retry when the app comes back online. Scan unavailable? Use manual vendor search and Mark Arrived fallback.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Button variant={kioskMode ? 'default' : 'outline'} size="sm" onClick={() => setKioskMode(!kioskMode)}><LockKeyhole className="h-4 w-4" /> {kioskMode ? 'Kiosk mode on' : 'Kiosk mode'}</Button><div className="flex items-center gap-4 bg-surface-2 px-4 py-2 rounded-lg border border-border shadow-sm">
            <Clock className="w-5 h-5 text-brand" />
            <div className="font-mono text-xl font-medium tracking-tight">{format(time, 'h:mm:ss a')}</div>
          </div></div>
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
            <AlertCircle className="w-3.5 h-3.5" /> Late <span className="ml-0.5 opacity-70">({lateCount})</span>
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
          <Button variant="outline" className="h-12 px-4 rounded-xl shadow-sm shrink-0 border border-border" onClick={exportReport}>
            <Download className="w-5 h-5 mr-2" /> Export
          </Button>
        </div>

        <div className={cn("rounded-xl border border-border bg-surface p-3 text-xs text-fg-muted", kioskMode && "bg-white/10 text-white/80 border-white/20")}>
          <strong>Scan unavailable workflow:</strong> search vendor name/category, verify contact, then tap Mark Arrived. Use Export for paper reconciliation if connectivity is unstable.
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
                <Card key={vendor.id} className={cn("overflow-hidden transition-all duration-300", status === 'late' ? "border-danger/40 shadow-sm" : status !== 'expected' ? "border-brand/30 shadow-sm" : "border-border shadow-none")}>
                  <div className={cn("p-4", status === 'late' ? "bg-danger/5" : status !== 'expected' ? "bg-brand/5" : "bg-surface")}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{vendor.name}</h3>
                        <div className="text-sm font-medium text-fg-subtle uppercase tracking-widest mt-1">{vendor.category}</div>
                      </div>
                      <Badge variant={status === 'expected' ? 'outline' : status === 'departed' ? 'info' : status === 'late' ? 'danger' : 'success'} className="uppercase text-[10px] tracking-wider font-bold">
                        {status === 'late' ? 'late ⚠' : status}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-6 text-sm">
                      {vendor.contact_name && <div className="flex items-center gap-2 text-fg-muted"><UserCircle className="w-4 h-4 opacity-50" /> {vendor.contact_name}</div>}
                      {vendor.phone && <div className="flex items-center gap-2 text-fg-muted"><Phone className="w-4 h-4 opacity-50" /> {vendor.phone}</div>}
                      {vendor.phone && (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <a href={`tel:${vendor.phone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-bold text-brand"><Phone className="w-4 h-4" /> Call</a>
                          <a href={`sms:${vendor.phone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-bold text-brand"><MessageSquare className="w-4 h-4" /> SMS</a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
                      {status === 'expected' && (
                        <>
                          <Button className="flex-1 min-w-[120px]" size="sm" onClick={() => updateStatus(vendor.id, 'arrived')}>
                            <LogIn className="w-4 h-4 mr-2" /> Mark Arrived
                          </Button>
                          <Button
                            className="flex-1 min-w-[100px] border-danger/30 text-danger hover:bg-danger/10"
                            variant="outline" size="sm"
                            onClick={() => updateStatus(vendor.id, 'late')}
                            aria-label={`Mark ${vendor.name} as late`}
                          >
                            <AlertCircle className="w-4 h-4 mr-2" /> Mark Late
                          </Button>
                        </>
                      )}
                      {status === 'late' && (
                        <Button className="flex-1 min-w-[120px]" size="sm" onClick={() => updateStatus(vendor.id, 'arrived')}>
                          <LogIn className="w-4 h-4 mr-2" /> Arrived Late — Check In
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
  const [scannerState, setScannerState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!open) {
      setScannerState('idle');
      return;
    }

    let cancelled = false;
    let scanner: any = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    setScannerState('loading');

    timeout = setTimeout(() => {
      import('html5-qrcode')
        .then(({ Html5QrcodeScanner }) => {
          if (cancelled) return;
          scanner = new Html5QrcodeScanner('reader', {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
          }, false);
          scanner.render(
            (text: string) => {
              try { void scanner?.clear(); } catch { /* scanner already closed */ }
              onScan(text);
            },
            () => { /* scanner library emits decode misses continuously; keep UI quiet */ },
          );
          setScannerState('ready');
        })
        .catch(() => {
          if (!cancelled) setScannerState('error');
        });
    }, 100);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (scanner) {
        try { void scanner.clear(); } catch { /* scanner already closed */ }
      }
    };
  }, [open, onScan]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm relative bg-surface rounded-xl overflow-hidden">
        <div className="p-4 bg-surface flex justify-between items-center border-b border-border">
          <h3 className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4" /> Scan Vendor Pass</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div id="reader" className="w-full bg-black min-h-[300px] flex items-center justify-center text-sm text-fg-inverse/80">
          {scannerState === 'loading' && (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading secure camera scanner…</span>
              <span className="text-xs opacity-80">The QR scanner code is downloaded only after Scan is tapped to keep day-of check-in fast.</span>
            </div>
          )}
          {scannerState === 'error' && (
            <div className="p-6 text-center text-sm">
              Camera scanner could not load. Use manual vendor search fallback below.
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border text-sm text-fg-muted space-y-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-fg"><Keyboard className="w-4 h-4" /> QR scanner fallback</div>
            <p className="text-xs mt-1">If the camera is blocked, cellular data is weak, or a QR code is damaged, use manual vendor search to mark arrival.</p>
          </div>
          <Button className="w-full min-h-11" variant="outline" onClick={onClose}>Use manual search fallback</Button>
        </div>
      </div>
      <p className="text-fg-inverse/70 mt-6 text-sm">Align the QR code within the frame, or use manual search fallback.</p>
    </div>
  );
}
