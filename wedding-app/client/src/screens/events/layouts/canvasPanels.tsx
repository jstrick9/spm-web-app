import { cn } from '../../../ui/lib/cn';
import { sdk } from '../../../sdk';
import { MiniLayoutMetric } from './MiniLayoutMetric';
import { DEFAULT_ITEMS, FLOOR_WALK_CHECKS, DEFAULT_MANAGER_LAYOUT_OPS, centerDistance, itemLabel, managerLayoutOpsFromBackend, type FloorWalkCheckId, type ManagerLayoutOpsState } from './layoutOpsModel';
import type { SdkEvent, SdkLayout } from '../../../sdk/types';
import {
  Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight,
  X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin, Sliders,
  PenTool, Undo2, Redo2, Grid, Activity, FileText, Keyboard, Printer, Eye, Umbrella, Smartphone, Maximize2, QrCode, Camera, ShieldCheck, ClipboardCheck, Accessibility, Zap
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';

export function MobileLayoutReview({
  event,
  layout,
  diagnostics,
  items,
  vendors,
  managerOps,
  onToggleFloorWalkCheck,
  onRecordVarianceEvidence,
  onSetRainPlanActive,
  setupPacketUrl,
  onCreateSetupPacket,
  onOpenCanvas,
}: {
  event: SdkEvent;
  layout?: SdkLayout;
  diagnostics: any;
  items: any[];
  vendors: any[];
  managerOps: ManagerLayoutOpsState;
  onToggleFloorWalkCheck: (id: FloorWalkCheckId) => void;
  onRecordVarianceEvidence: () => void;
  onSetRainPlanActive: (active: boolean) => void;
  setupPacketUrl: string;
  onCreateSetupPacket: () => void;
  onOpenCanvas: () => void;
}) {
  const readyCount = diagnostics.checklist.filter((item: any) => item.done).length;
  const readinessPct = Math.round((readyCount / Math.max(1, diagnostics.checklist.length)) * 100);
  const tables = items.filter((item) => ['round_table', 'rect_table', 'table'].includes(item.type));
  const seats = items.filter((item) => ['chair', 'seat'].includes(item.type));
  const vendorZones = items.filter((item) => item.type === 'vendor_zone');
  const exits = items.filter((item) => ['fire_exit', 'exit'].includes(item.type) || /exit/i.test(itemLabel(item)));
  const paths = items.filter((item) => ['ada_path', 'walkway', 'aisle', 'load_in_path'].includes(item.type) || /ada|access|load/i.test(itemLabel(item)));
  const assignedSeatCount = seats.filter((seat) => seat.guestName || seat.guestId).length;
  const floorWalkDone = FLOOR_WALK_CHECKS.filter(check => managerOps.floorWalkChecks?.[check.id]).length;
  const mappedInventoryCount = items.filter((item) => item.inventoryItemId).length;
  const mappedInventoryTypes = new Set(items.filter((item) => item.inventoryItemId).map((item) => item.inventoryItemId)).size;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="success" className="mb-2"><Smartphone className="h-3 w-3" /> Mobile review mode</Badge>
            <h2 className="text-lg font-bold text-fg">Layout review, readiness, and print packet</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Canvas editing is intentionally disabled on phones. Review safety readiness, vendor zones, seating counts,
              and print/share the floorplan packet from this mobile-safe view.
            </p>
          </div>
          <Button variant="outline" className="min-h-11" onClick={onOpenCanvas}>
            <Maximize2 className="h-4 w-4" /> Open advanced canvas editor
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-fg">{event.title || 'Event'} floorplan packet</h2>
            <p className="text-sm text-fg-muted">{layout?.name || 'Primary layout'} · Rev {layout?.revision || 1} · {layout?.approval_status || 'draft'}</p>
          </div>
          <Badge variant={readinessPct >= 85 ? 'success' : readinessPct >= 60 ? 'warning' : 'danger'}>{readinessPct}% ready</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniLayoutMetric label="Seats" value={diagnostics.seats} detail={`${assignedSeatCount} assigned`} />
          <MiniLayoutMetric label="Tables" value={tables.length} detail="Floorplan tables" />
          <MiniLayoutMetric label="Vendor zones" value={vendorZones.length} detail="Load-in/service areas" />
          <MiniLayoutMetric label="Safety marks" value={exits.length + paths.length} detail="Exits + paths" />
          <MiniLayoutMetric label="Reserved inventory" value={mappedInventoryCount} detail={`${mappedInventoryTypes} venue item type${mappedInventoryTypes === 1 ? '' : 's'}`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 print:break-inside-avoid">
        <div className="rounded-2xl border border-brand/20 bg-brand-soft/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand"><ClipboardCheck className="h-4 w-4" /> Floor walk verification mode</h3>
          <p className="mb-3 text-xs text-fg-muted">Manager phone checklist for physically verifying the room against the approved layout.</p>
          <div className="space-y-2">
            {FLOOR_WALK_CHECKS.map((check) => (
              <button key={check.id} type="button" onClick={() => onToggleFloorWalkCheck(check.id)} className="w-full rounded-xl border border-border bg-surface p-3 text-left text-sm">
                <span className="flex items-start gap-2">
                  <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold', managerOps.floorWalkChecks?.[check.id] ? 'bg-success text-success-soft' : 'bg-warning-soft text-warning')}>{managerOps.floorWalkChecks?.[check.id] ? '✓' : '!'}</span>
                  <span><strong className="block text-fg">{check.label}</strong><span className="text-xs text-fg-muted">{check.detail}</span></span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-brand">{floorWalkDone}/{FLOOR_WALK_CHECKS.length} floor walk checks complete</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-brand"><QrCode className="h-4 w-4" /> QR-coded physical setup packet</h3>
          <div className="flex items-center gap-4">
            <div aria-label="Setup packet QR code" className="grid h-28 w-28 shrink-0 grid-cols-7 gap-0.5 rounded-lg border border-border bg-white p-2">
              {Array.from({ length: 49 }).map((_, idx) => <span key={idx} className={cn('rounded-[1px]', ((idx * 7 + event.id.length + (layout?.revision || 1)) % 5) < 2 ? 'bg-fg' : 'bg-surface')} />)}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-fg">Scan packet reference</p>
              <p className="text-xs text-fg-muted">Event {event.id.slice(0, 8)} · layout rev {layout?.revision || 1}. Print this packet for setup crew and vendors.</p>
              {setupPacketUrl ? <a className="mt-2 block text-xs font-bold text-brand underline" href={setupPacketUrl} target="_blank" rel="noreferrer">Open signed read-only packet</a> : <Button size="sm" variant="outline" className="mt-2" onClick={onCreateSetupPacket}>Create signed packet link</Button>}
              <a className="mt-2 inline-flex text-xs font-bold text-brand underline" href={`#/events/${event.id}/run-sheet`}>Open layout-to-run-sheet setup references</a>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
            <strong className="text-fg">Variance/photo evidence:</strong> {managerOps.varianceEvidence.length} open record(s). Use this when the room does not match the approved plan.
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onRecordVarianceEvidence}><Camera className="h-4 w-4" /> Record variance/photo evidence</Button>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
            <strong className="text-fg">Rain plan activation:</strong> {managerOps.rainPlanActive ? 'Active' : 'Not active'}
            <Button size="sm" variant={managerOps.rainPlanActive ? 'default' : 'outline'} className="mt-3 w-full" onClick={() => onSetRainPlanActive(!managerOps.rainPlanActive)}><Umbrella className="h-4 w-4" /> {managerOps.rainPlanActive ? 'Rain plan active' : 'Activate rain plan'}</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><Activity className="h-4 w-4" /> Readiness checklist</h3>
          <div className="space-y-2">
            {diagnostics.checklist.map((item: any) => (
              <div key={item.label} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm">
                <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', item.done ? 'bg-success text-success-soft' : 'bg-warning-soft text-warning')}>{item.done ? '✓' : '!'}</span>
                <span className="text-fg">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><AlertTriangle className="h-4 w-4" /> Owner-safe warnings</h3>
          {diagnostics.warnings.length ? (
            <div className="space-y-2">
              {diagnostics.warnings.map((warning: string) => (
                <div key={warning} className="rounded-xl border border-warning/30 bg-warning-soft/20 p-3 text-sm text-warning">{warning}</div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">No blocking layout readiness issues detected.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-brand"><FileText className="h-4 w-4" /> Non-canvas floorplan report</h3>
            <p className="text-xs text-fg-muted">Phone-friendly summary for owners, planners, staff, and vendors.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print floorplan packet</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MobileReportSection title="Seating and capacity" rows={[
            ['Expected guests', String(event.guest_count || 0)],
            ['Seats placed', String(diagnostics.seats)],
            ['Assigned seats', String(assignedSeatCount)],
            ['Capacity coverage', `${diagnostics.capacityPct}%`],
          ]} />
          <MobileReportSection title="Safety and accessibility" rows={[
            ['ADA/access paths', String(diagnostics.adaPaths)],
            ['Fire exits', String(diagnostics.exits)],
            ['Power sources', String(diagnostics.outlets)],
            ['Warnings', String(diagnostics.warnings.length)],
          ]} />
          <MobileReportSection title="Vendor operations" rows={[
            ['Vendors booked', String(vendors.length)],
            ['Vendor zones', String(diagnostics.vendorZones)],
            ['Load-in paths', String(paths.length)],
            ['Power sources', String(diagnostics.outlets)],
          ]} />
          <MobileReportSection title="Approval" rows={[
            ['Layout status', layout?.approval_status || 'draft'],
            ['Revision', String(layout?.revision || 1)],
            ['Last updated', layout?.updated_at ? new Date(layout.updated_at).toLocaleString() : 'Not saved yet'],
          ]} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 print:break-inside-avoid">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><Keyboard className="h-4 w-4" /> Object inventory</h3>
        <div className="space-y-2">
          {items.length ? items.slice(0, 40).map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
              <div className="font-semibold text-fg">{itemLabel(item)}</div>
              <div className="text-xs text-fg-muted">{item.type} · x {Math.round(item.x || 0)}, y {Math.round(item.y || 0)}{item.guestName ? ` · ${item.guestName}` : ''}</div>
            </div>
          )) : <p className="text-sm text-fg-muted">No layout objects have been placed yet.</p>}
          {items.length > 40 && <p className="text-xs text-fg-muted">Showing first 40 of {items.length} objects for phone readability. Print packet includes the summary.</p>}
        </div>
      </div>
    </div>
  );
}

import { MobileReportSection } from './MobileReportSection';

export function LayoutReadinessPanel({
  diagnostics,
  items,
  layout,
  event,
  hasChanges,
  selectedId,
  setSelectedId,
  nudgeItem,
  rainPlanCompare,
  setRainPlanCompare,
  vendorSpecificView,
  setVendorSpecificView,
  managerOps,
  onToggleFloorWalkCheck,
  onRecordVarianceEvidence,
  onSetRainPlanActive,
  setupPacketUrl,
  onCreateSetupPacket,
}: {
  diagnostics: { seats: number; assignedSeats: number; tables: number; exits: number; adaPaths: number; vendorZones: number; outlets: number; warnings: string[]; capacityPct: number; checklist: Array<{ label: string; done: boolean }> };
  items: any[];
  layout?: SdkLayout;
  event: SdkEvent;
  hasChanges: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  nudgeItem: (id: string, dx: number, dy: number) => void;
  rainPlanCompare: boolean;
  setRainPlanCompare: (v: boolean) => void;
  vendorSpecificView: boolean;
  setVendorSpecificView: (v: boolean) => void;
  managerOps: ManagerLayoutOpsState;
  onToggleFloorWalkCheck: (id: FloorWalkCheckId) => void;
  onRecordVarianceEvidence: () => void;
  onSetRainPlanActive: (active: boolean) => void;
  setupPacketUrl: string;
  onCreateSetupPacket: () => void;
}) {
  const readyCount = diagnostics.checklist.filter(i => i.done).length;
  const readinessPct = Math.round((readyCount / Math.max(1, diagnostics.checklist.length)) * 100);
  const approvedLayoutChanged = layout?.approval_status === 'approved' && hasChanges;
  const tables = items.filter(item => ['round_table', 'rect_table', 'table'].includes(item.type));
  const seats = items.filter(item => ['chair', 'seat'].includes(item.type));
  const vendorZones = items.filter(item => item.type === 'vendor_zone');
  const floorWalkDone = FLOOR_WALK_CHECKS.filter(check => managerOps.floorWalkChecks?.[check.id]).length;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand flex items-center gap-2"><Activity className="h-4 w-4" /> Layout readiness & approval checklist</h2>
            <p className="text-xs text-fg-muted mt-1">Validate seating, ADA, fire exits, vendor load-in, service clearance, power, and approval before sharing the floorplan.</p>
          </div>
          <Badge variant={readinessPct >= 85 ? 'success' : readinessPct >= 60 ? 'warning' : 'danger'}>{readinessPct}% ready</Badge>
        </div>
        {approvedLayoutChanged && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            <strong>Layout changed after approval:</strong> Unsaved canvas changes exist on an approved layout. Save as a new revision and re-request approval before sharing with setup crew or vendors.
          </div>
        )}
        <div className="rounded-lg border border-brand/20 bg-brand-soft/5 p-3 text-xs text-fg-muted">
          <strong className="text-brand">Canvas editing guidance:</strong> detailed editing is best on desktop or tablet. Managers on phones should use mobile review, floor walk verification, readiness reports, and print packets.
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <MiniLayoutMetric label="Capacity heatmap" value={`${diagnostics.capacityPct}%`} detail={`${diagnostics.assignedSeats}/${diagnostics.seats} seats assigned`} />
          <MiniLayoutMetric label="ADA paths" value={diagnostics.adaPaths} detail="Marked accessible routes" />
          <MiniLayoutMetric label="Fire exits" value={diagnostics.exits} detail="Marked exit points" />
          <MiniLayoutMetric label="Power sources" value={diagnostics.outlets} detail="For DJ/band/catering" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {diagnostics.checklist.map(item => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-2 text-xs">
              <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', item.done ? 'bg-success text-success-soft' : 'bg-warning-soft text-warning')}>{item.done ? '✓' : '!'}</span>
              {item.label}
            </div>
          ))}
        </div>
        {diagnostics.warnings.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning space-y-1">
            {diagnostics.warnings.slice(0, 6).map(w => <div key={w}>• {w}</div>)}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={rainPlanCompare ? 'default' : 'outline'} onClick={() => setRainPlanCompare(!rainPlanCompare)}><Umbrella className="h-4 w-4" /> Rain-plan comparison</Button>
          <Button size="sm" variant={vendorSpecificView ? 'default' : 'outline'} onClick={() => setVendorSpecificView(!vendorSpecificView)}><Eye className="h-4 w-4" /> Vendor-specific layout view</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print floorplan packet</Button>
        </div>
        {rainPlanCompare && <p className="text-xs text-fg-muted">Rain-plan comparison: duplicate this layout as an indoor/rain plan version, then use version history approval to compare changes.</p>}
        {vendorSpecificView && <p className="text-xs text-fg-muted">Vendor-specific view: vendor zones, power, and load-in routes are highlighted in the object list and report for partner sharing.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <h3 className="text-xs font-bold text-brand flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Physical verification checklist</h3>
            <div className="mt-2 grid gap-1">
              {FLOOR_WALK_CHECKS.slice(0, 6).map(check => (
                <button key={check.id} type="button" onClick={() => onToggleFloorWalkCheck(check.id)} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left text-[11px]">
                  <span className={managerOps.floorWalkChecks?.[check.id] ? 'text-success' : 'text-warning'}>{managerOps.floorWalkChecks?.[check.id] ? '✓' : '!'}</span>
                  <span>{check.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-semibold text-brand">{floorWalkDone}/{FLOOR_WALK_CHECKS.length} complete</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
            <h3 className="text-xs font-bold text-brand flex items-center gap-2"><QrCode className="h-4 w-4" /> Setup packet controls</h3>
            <div className="text-[11px] text-fg-muted">QR packet ref: {event.id.slice(0, 8)} · rev {layout?.revision || 1}. Layout-to-run-sheet references are included for setup crew.</div>
            {setupPacketUrl ? <a href={setupPacketUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-brand underline">Signed read-only setup packet</a> : <Button size="xs" variant="outline" onClick={onCreateSetupPacket}><QrCode className="h-3.5 w-3.5" /> Create signed packet</Button>}
            <a href={`#/events/${event.id}/run-sheet`} className="text-[11px] font-bold text-brand underline">Open run sheet setup references</a>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="xs" variant="outline" onClick={onRecordVarianceEvidence}><Camera className="h-3.5 w-3.5" /> Record variance</Button>
              <Button size="xs" variant={managerOps.rainPlanActive ? 'default' : 'outline'} onClick={() => onSetRainPlanActive(!managerOps.rainPlanActive)}><Umbrella className="h-3.5 w-3.5" /> Rain plan</Button>
            </div>
            {managerOps.varianceEvidence.length > 0 && <p className="text-[11px] text-warning font-semibold">{managerOps.varianceEvidence.length} variance/photo evidence record(s).</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-bold text-brand flex items-center gap-2"><Keyboard className="h-4 w-4" /> Keyboard-accessible object list</h2>
        <p className="text-xs text-fg-muted">Select an object and nudge it without using the canvas. This also serves as a non-canvas summary/report.</p>
        <div className="max-h-64 overflow-auto space-y-1">
          {items.length === 0 ? <div className="text-xs text-fg-muted">No layout objects yet.</div> : items.map(item => (
            <div key={item.id} className={cn('rounded-lg border p-2 text-xs', selectedId === item.id ? 'border-brand bg-brand-soft/30' : 'border-border bg-surface-2')}>
              <button type="button" onClick={() => setSelectedId(item.id)} className="w-full text-left font-semibold text-fg">{itemLabel(item)} <span className="text-fg-muted">({item.type})</span></button>
              <div className="mt-1 text-fg-muted">x {Math.round(item.x || 0)}, y {Math.round(item.y || 0)}{item.guestName ? ` · ${item.guestName}` : ''}</div>
              <div className="mt-2 flex gap-1">
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, 0, -5)}>↑</Button>
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, 0, 5)}>↓</Button>
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, -5, 0)}>←</Button>
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, 5, 0)}>→</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-fg-muted">
          <FileText className="inline h-3.5 w-3.5 mr-1" /> Non-canvas seat/table inventory: {tables.length} tables, {seats.length} seats, {vendorZones.length} vendor zones, {diagnostics.outlets} power sources. Fire marshal/accessibility packet checks: {managerOps.floorWalkChecks?.fire_marshal ? 'fire ready' : 'fire pending'} · {managerOps.floorWalkChecks?.accessibility ? 'accessibility ready' : 'accessibility pending'}.
        </div>
      </div>
    </div>
  );
}


