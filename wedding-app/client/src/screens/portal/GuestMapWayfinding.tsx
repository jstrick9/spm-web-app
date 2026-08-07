import React, { useEffect, useMemo, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { Accessibility, Armchair, BedDouble, Building2, DoorOpen, Eye, Map as MapIcon, RotateCcw, Search, ShieldCheck, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { useI18n } from '../../i18n/I18nContext';
import { Label } from '../../ui/Label';
import type { PortalGuestEntry, PortalInfoResponse, PortalLayoutPayload, LayoutCanvasItem, RoundTableItem, RectTableItem, DanceFloorItem, ChairItem } from '../../sdk/portalTypes';

type Palette = {
  bg: string;
  surface: string;
  border: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  primary: string;
  primaryFg: string;
  primaryHover: string;
  accent: string;
  accentSoft: string;
};

type WayfindingTarget = 'seat' | 'table' | 'lodging' | 'restroom' | 'entrance';

function isRoundTable(item: LayoutCanvasItem): item is RoundTableItem { return item.type === 'round_table'; }
function isRectTable(item: LayoutCanvasItem): item is RectTableItem { return item.type === 'rect_table'; }
function isDanceFloor(item: LayoutCanvasItem): item is DanceFloorItem { return item.type === 'dance_floor'; }
function isChair(item: LayoutCanvasItem): item is ChairItem { return item.type === 'chair'; }

const LABEL_TITLES: Record<string, string> = {
  parking: 'Parking', entrance: 'Entrance', ceremony: 'Ceremony space', reception: 'Reception space', restroom: 'Restrooms', bar: 'Bar', buffet: 'Buffet', dance_floor: 'Dance floor', ada_route: 'ADA route', lodging: 'Lodging', custom: 'Map note',
};

export function GuestMapWayfinding({
  guests,
  activeGuest,
  selectedGuestId,
  setSelectedGuestId,
  layout,
  timeline,
  subEvents,
  palette,
  guestTravel,
  guestWayfinding,
}: {
  guests: PortalGuestEntry[];
  activeGuest?: PortalGuestEntry;
  selectedGuestId: string;
  setSelectedGuestId: (guestId: string) => void;
  layout: PortalLayoutPayload | null;
  timeline: Array<Record<string, any>>;
  subEvents: Array<Record<string, any>>;
  palette: Palette;
  guestTravel: PortalInfoResponse['guestTravel'] | null;
  guestWayfinding: PortalInfoResponse['guestWayfinding'] | null;
}) {
  const { t } = useI18n();
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [target, setTarget] = useState<WayfindingTarget>('seat');
  const [mapMode, setMapMode] = useState<'outdoor' | 'indoor'>('outdoor');

  const mapFilteredGuests = useMemo(() => {
    if (!mapSearchQuery.trim()) return [];
    const q = mapSearchQuery.toLowerCase();
    return guests.filter(g => g.fullName.toLowerCase().includes(q) && (g.tableAssignment || g.roomAssignment));
  }, [guests, mapSearchQuery]);

  const labels = guestWayfinding?.labels || [];
  const seatAssigned = Boolean(activeGuest?.tableAssignment || activeGuest?.seatAssignment);
  const personalOnly = guestWayfinding?.seatingPrivacyMode === 'personal_only' || layout?.privacyMode === 'personal_only';

  const actionCards: Array<{ id: WayfindingTarget; label: string; detail: string; icon: React.ElementType }> = [
    { id: 'seat', label: 'Find my seat', icon: Armchair, detail: seatAssigned ? `${activeGuest?.tableAssignment || 'Table assigned'}${activeGuest?.seatAssignment ? ` · Seat ${activeGuest.seatAssignment}` : ''}` : 'Seat not assigned yet' },
    { id: 'table', label: 'Find my table', icon: Building2, detail: activeGuest?.tableAssignment || 'Table not assigned yet' },
    { id: 'lodging', label: 'Find my lodging', icon: BedDouble, detail: activeGuest?.allowLodgingAccess ? (activeGuest.roomAssignment || 'Lodging details pending') : 'No lodging shared for this invitation' },
    { id: 'restroom', label: 'Find restroom', icon: MapIcon, detail: labelDetail(labels, 'restroom') || 'Restroom route details pending' },
    { id: 'entrance', label: 'Find entrance', icon: DoorOpen, detail: labelDetail(labels, 'entrance') || guestTravel?.dropoffPoint || 'Entrance details pending' },
  ];

  return (
    <div className="space-y-6 flex flex-col relative">
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-display">{t('map.findSeat')} / Wayfinding</h2>
        <p className="text-sm" style={{ color: palette.fgMuted }}>Start with what you need most: your seat, table, lodging, restroom, entrance, or accessible route.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-5" aria-label="Guest wayfinding quick actions">
        {actionCards.map(({ id, label, detail, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTarget(id)} className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5" style={{ borderColor: target === id ? palette.primary : palette.border, background: target === id ? palette.accentSoft : palette.surface }} aria-pressed={target === id}>
            <Icon className="h-4 w-4 mb-2" aria-hidden="true" />
            <div className="text-xs font-black uppercase tracking-widest">{label}</div>
            <div className="mt-1 text-[11px] line-clamp-2" style={{ color: palette.fgMuted }}>{detail}</div>
          </button>
        ))}
      </div>

      {activeGuest && !seatAssigned && (target === 'seat' || target === 'table') && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft/20 p-4 text-sm text-warning">
          <strong>Seat not assigned yet.</strong> You are on the guest list, but the couple or venue has not shared your table/seat assignment yet. Check back closer to the event or ask the venue team when you arrive.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.surface }}>
            <Label htmlFor="mapSearch" className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: palette.fgSubtle }}><Search className="inline h-3 w-3 mr-1" /> {t('map.findSeat')}</Label>
            <Input id="mapSearch" placeholder={t('map.searchPlaceholder')} value={mapSearchQuery} onChange={(e) => setMapSearchQuery(e.target.value)} className="bg-surface border-border text-xs h-10 font-semibold" />
            {mapFilteredGuests.length > 0 && (
              <div className="mt-2 border rounded-xl p-2 space-y-1 text-left" style={{ borderColor: palette.border, background: palette.accentSoft }}>
                {mapFilteredGuests.slice(0, 5).map(member => (
                  <button key={member.id} onClick={() => { setSelectedGuestId(member.id); setMapSearchQuery(''); setTarget(member.roomAssignment && !member.tableAssignment ? 'lodging' : 'seat'); }} className="block w-full p-2 text-xs font-semibold hover:bg-surface-2 rounded-lg text-left border-b last:border-0" style={{ borderColor: palette.border }}>
                    Find details for: <strong>{member.fullName}</strong>{member.tableAssignment ? ` (${member.tableAssignment})` : ''}{member.roomAssignment ? ` · ${member.roomAssignment}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs" style={{ borderColor: palette.border, background: palette.surface }}>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={mapMode === 'outdoor' ? 'default' : 'outline'} onClick={() => setMapMode('outdoor')}>{t('map.outdoor')} / arrival</Button>
              <Button type="button" size="sm" variant={mapMode === 'indoor' ? 'default' : 'outline'} onClick={() => setMapMode('indoor')}>{t('map.indoor')} / rain-plan</Button>
            </div>
            <span style={{ color: palette.fgMuted }}>Use two fingers to zoom, then drag the map. You can also use the + / − buttons.</span>
          </div>

          {activeGuest && layout && seatAssigned && (
            <div className="p-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border shadow-xs" style={{ background: '#fdf2f8', borderColor: '#fbcfe8', color: '#9d174d' }}>
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping shrink-0" aria-hidden="true" />
              <span>Your personal table/seat is highlighted. {personalOnly ? 'Only your personal seating details are shown for privacy.' : 'Other shared map details may also be visible.'}</span>
            </div>
          )}

          <div className="flex-1 min-h-[400px] w-full rounded-2xl overflow-hidden relative border shadow-inner" style={{ background: palette.surface, borderColor: palette.border }}>
            {!layout ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center" style={{ color: palette.fgSubtle }}>
                <MapIcon className="w-12 h-12 mb-4 opacity-50" aria-hidden="true" />
                <p>The layout map hasn't been published yet.</p>
                <p className="mt-2 text-xs">Use the text fallback below for arrival, seating, restroom, and accessible-route details that have been shared.</p>
              </div>
            ) : (
              <PortalMapViewer layout={layout} activeGuestId={selectedGuestId} labels={labels} mapMode={mapMode} />
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <MapLegend labels={labels} palette={palette} personalOnly={personalOnly} />
          <AccessibilityRouteCard guestWayfinding={guestWayfinding} labels={labels} palette={palette} />
          <WayfindingPreview guestWayfinding={guestWayfinding} palette={palette} />
        </aside>
      </div>

      <TextMapDetailsFallback activeGuest={activeGuest} timeline={timeline} subEvents={subEvents} palette={palette} labels={labels} guestTravel={guestTravel} mapMode={mapMode} guestWayfinding={guestWayfinding} />

      {activeGuest && activeGuest.allowLodgingAccess && activeGuest.roomAssignment && (
        <LodgingMap activeGuest={activeGuest} guests={guests} selectedGuestId={selectedGuestId} palette={palette} />
      )}
    </div>
  );
}

function labelDetail(labels: Array<{ type: string; details: string; label: string }>, type: string) {
  const found = labels.find((label) => label.type === type);
  return found?.details || found?.label || '';
}

function MapLegend({ labels, palette, personalOnly }: { labels: Array<{ id: string; type: string; label: string; details: string }>; palette: Palette; personalOnly: boolean }) {
  const base = labels.length ? labels : [
    { id: 'parking', type: 'parking', label: 'Parking', details: 'Parking details pending' },
    { id: 'entrance', type: 'entrance', label: 'Entrance', details: 'Entrance details pending' },
    { id: 'ada_route', type: 'ada_route', label: 'ADA route', details: 'Accessible route pending' },
  ];
  return <Card style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base">Map legend</CardTitle><CardDescription>Labels shared by the venue/couple.</CardDescription></CardHeader><CardContent className="space-y-2 text-xs">{personalOnly && <Badge variant="outline"><ShieldCheck className="h-3 w-3 mr-1" /> Personal-only seating privacy</Badge>}{base.map((label) => <div key={label.id} className="rounded-lg border p-2" style={{ borderColor: palette.border }}><strong>{LABEL_TITLES[label.type] || label.label}</strong><p style={{ color: palette.fgMuted }}>{label.label}{label.details ? ` — ${label.details}` : ''}</p></div>)}</CardContent></Card>;
}

function AccessibilityRouteCard({ guestWayfinding, labels, palette }: { guestWayfinding: PortalInfoResponse['guestWayfinding'] | null; labels: Array<{ type: string; label: string; details: string }>; palette: Palette }) {
  const ada = labelDetail(labels, 'ada_route') || guestWayfinding?.accessibilityRouteDetails || '';
  return <Card style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><Accessibility className="h-4 w-4" /> Accessibility route map</CardTitle></CardHeader><CardContent className="text-sm"><p className="whitespace-pre-wrap">{ada || 'Accessible route details have not been posted yet. If you need mobility support, contact the venue/couple before arrival or ask the venue team at the entrance.'}</p></CardContent></Card>;
}

function WayfindingPreview({ guestWayfinding, palette }: { guestWayfinding: PortalInfoResponse['guestWayfinding'] | null; palette: Palette }) {
  return <Card style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> 3D / AR walkthrough</CardTitle><CardDescription>Preview the venue before arrival when shared.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{guestWayfinding?.arPreviewUrl ? <Button asChild size="sm"><a href={guestWayfinding.arPreviewUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 mr-1" /> Open guest walkthrough</a></Button> : <p style={{ color: palette.fgMuted }}>3D/AR preview has not been shared yet.</p>}<p className="text-xs" style={{ color: palette.fgMuted }}>{guestWayfinding?.arPreviewDescription || 'If enabled later, this will show a guest-safe walkthrough without exposing operational staff areas.'}</p></CardContent></Card>;
}

function TextMapDetailsFallback({ activeGuest, timeline, subEvents, palette, labels, guestTravel, mapMode, guestWayfinding }: { activeGuest?: PortalGuestEntry; timeline: Array<Record<string, any>>; subEvents: Array<Record<string, any>>; palette: Palette; labels: Array<{ id: string; type: string; label: string; details: string }>; guestTravel: PortalInfoResponse['guestTravel'] | null; mapMode: 'outdoor' | 'indoor'; guestWayfinding: PortalInfoResponse['guestWayfinding'] | null }) {
  return (
    <Card style={{ background: palette.surface, borderColor: palette.border }}>
      <CardHeader><CardTitle className="text-base">Non-canvas text map details</CardTitle><CardDescription>Everything important from the visual map in screen-reader and low-bandwidth-friendly text.</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {activeGuest ? <div className="rounded-lg border p-3" style={{ borderColor: palette.border }}><span className="text-[10px] uppercase font-bold tracking-widest block" style={{ color: palette.fgSubtle }}>📋 High-Contrast Seating Assignment</span><strong>{activeGuest.fullName}</strong><p>{activeGuest.tableAssignment ? `Table: ${activeGuest.tableAssignment}` : 'Seat not assigned yet.'}{activeGuest.seatAssignment ? ` · Seat: ${activeGuest.seatAssignment}` : ''}{activeGuest.roomAssignment ? ` · Lodging: ${activeGuest.roomAssignment}` : ''}</p></div> : <p>Please identify yourself to see personal seat, table, or lodging details.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <p><strong>Parking:</strong> {labelDetail(labels, 'parking') || guestTravel?.parkingEntrance || 'Parking details pending.'}</p>
          <p><strong>Entrance:</strong> {labelDetail(labels, 'entrance') || guestTravel?.dropoffPoint || 'Entrance details pending.'}</p>
          <p><strong>Ceremony:</strong> {labelDetail(labels, 'ceremony') || 'Ceremony space label pending.'}</p>
          <p><strong>Reception:</strong> {labelDetail(labels, 'reception') || 'Reception space label pending.'}</p>
          <p><strong>Restroom:</strong> {labelDetail(labels, 'restroom') || 'Restroom label pending.'}</p>
          <p><strong>Bar:</strong> {labelDetail(labels, 'bar') || 'Bar label pending.'}</p>
          <p><strong>Buffet:</strong> {labelDetail(labels, 'buffet') || 'Buffet label pending.'}</p>
          <p><strong>Dance floor:</strong> {labelDetail(labels, 'dance_floor') || 'Dance floor label pending.'}</p>
          <p><strong>ADA route:</strong> {labelDetail(labels, 'ada_route') || guestWayfinding?.accessibilityRouteDetails || 'ADA route pending.'}</p>
          <p><strong>{mapMode === 'indoor' ? 'Indoor rain-plan map' : 'Outdoor arrival map'}:</strong> {mapMode === 'indoor' ? (guestWayfinding?.indoorMapNote || 'Indoor rain-plan map note pending.') : (guestWayfinding?.outdoorMapNote || 'Outdoor arrival map note pending.')}</p>
        </div>
        {timeline.slice(0, 6).map((item) => <div key={String(item.id)} className="flex gap-2"><span className="font-bold">{item.starts_at ? new Date(String(item.starts_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span><span>{String(item.title || '')}</span></div>)}
        {subEvents.length > 0 && <div className="pt-2 border-t" style={{ borderColor: palette.border }}><strong>Wedding weekend RSVP events:</strong> {subEvents.map(s => String(s.title)).join(', ')}</div>}
      </CardContent>
    </Card>
  );
}

function LodgingMap({ activeGuest, guests, selectedGuestId, palette }: { activeGuest: PortalGuestEntry; guests: PortalGuestEntry[]; selectedGuestId: string; palette: Palette }) {
  const roommates = guests.filter(g => g.id !== selectedGuestId && g.roomAssignment === activeGuest.roomAssignment);
  return (
    <div className="bg-surface p-5 rounded-xl border space-y-4 text-left shadow-sm animate-in zoom-in-95 duration-200" style={{ borderColor: palette.border }}>
      <div className="space-y-1"><span className="text-[10px] uppercase font-bold tracking-widest block" style={{ color: palette.fgSubtle }}>🏡 On-Site Estate Lodging Map</span><h4 className="text-sm font-serif font-black text-brand">Your Assigned Cabin: <strong className="text-brand font-black underline">{activeGuest.roomAssignment}</strong></h4></div>
      <div className="border border-border rounded-xl overflow-hidden bg-surface p-2 relative h-48 flex items-center justify-center">
        <svg viewBox="0 0 320 200" className="w-full h-full text-fg" aria-label="On-site lodging map">
          <path d="M 30,100 Q 160,80 290,120" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
          <path d="M 100,50 L 100,150" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
          <LodgingSvgNode name="Pine Cottage" icon="🏡" x={40} y={40} active={/pine|cottage/i.test(activeGuest.roomAssignment || '')} />
          <LodgingSvgNode name="Maple Cabin" icon="🏡" x={160} y={30} active={/maple|cabin/i.test(activeGuest.roomAssignment || '')} />
          <LodgingSvgNode name="Cedar Lodge" icon="🏰" x={240} y={110} active={/cedar|lodge/i.test(activeGuest.roomAssignment || '')} />
          <LodgingSvgNode name="Birch Suite" icon="🏡" x={100} y={120} active={/birch|suite/i.test(activeGuest.roomAssignment || '')} />
        </svg>
      </div>
      <div className="space-y-2 border-t pt-3.5"><span className="text-[10px] uppercase font-bold tracking-widest block" style={{ color: palette.fgSubtle }}>👥 My Roommates / Suite Group</span>{roommates.length === 0 ? <div className="text-xs italic" style={{ color: palette.fgSubtle }}>No other roommates are assigned to this cabin. Enjoy your private suite!</div> : <div className="grid grid-cols-2 gap-2 text-xs">{roommates.map(m => <div key={m.id} className="p-2 border rounded-lg bg-surface flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-brand-soft text-brand-strong font-bold text-[10px] flex items-center justify-center shrink-0">{m.fullName.split(' ').map((n) => n[0]).join('')}</div><span className="font-semibold text-fg-muted truncate">{m.fullName}</span></div>)}</div>}</div>
    </div>
  );
}

function LodgingSvgNode({ name, icon, x, y, active }: { name: string; icon: string; x: number; y: number; active: boolean }) {
  return <g transform={`translate(${x},${y})`}><rect x="-20" y="-15" width="40" height="30" rx="4" fill={active ? '#fef3c7' : '#fff'} stroke={active ? '#f59e0b' : '#9ca3af'} strokeWidth={active ? 2.5 : 1.5} />{active && <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" strokeDasharray="3,1.5" />}<text x="0" y="2" fontSize="12" textAnchor="middle">{icon}</text><text x="0" y="24" fontSize="8" fontWeight="bold" textAnchor="middle" fill={active ? '#b45309' : '#6b7280'}>{name}</text></g>;
}

function PortalMapViewer({ layout, activeGuestId, labels, mapMode }: { layout: PortalLayoutPayload; activeGuestId: string; labels: Array<{ id: string; type: string; label: string; details: string }>; mapMode: 'outdoor' | 'indoor' }) {
  const { t } = useI18n();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(0.8);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeGuestId && layout?.items && dimensions.width > 0 && dimensions.height > 0) {
      const itemsList = Array.isArray(layout.items) ? layout.items : [];
      const guestChair = itemsList.find((i) => isChair(i) && i.guestId === activeGuestId);
      if (guestChair) {
        const targetScale = 1.3;
        setScale(targetScale);
        setPos({ x: dimensions.width / 2 - (guestChair.x || 0) * targetScale, y: dimensions.height / 2 - (guestChair.y || 0) * targetScale });
      }
    }
  }, [activeGuestId, layout?.items, dimensions.width, dimensions.height]);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const oldScale = stage.scaleX();
    const mp = { x: pointerPos.x / oldScale - stage.x() / oldScale, y: pointerPos.y / oldScale - stage.y() / oldScale };
    const ns = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(ns);
    setPos({ x: -(mp.x - pointerPos.x / ns) * ns, y: -(mp.y - pointerPos.y / ns) * ns });
  };

  const items: LayoutCanvasItem[] = Array.isArray(layout.items) ? layout.items : [];
  const mapLabelItems = labels.map((label, index) => ({ ...label, x: 80 + (index % 3) * 180, y: 40 + Math.floor(index / 3) * 52 }));

  return (
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing relative" role="img" aria-label="Venue floor plan — interactive guest wayfinding map">
      <div className="absolute left-3 top-3 z-20 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold uppercase shadow">{mapMode === 'indoor' ? 'Indoor / rain plan' : 'Outdoor / arrival'}</div>
      <div className="absolute right-3 top-3 z-20 flex gap-1 rounded-lg bg-white/90 p-1 shadow">
        <button type="button" aria-label={t('map.zoomIn')} className="rounded p-1 border" onClick={() => setScale(s => Math.min(3, s * 1.15))}><ZoomIn className="h-4 w-4" /></button>
        <button type="button" aria-label={t('map.zoomOut')} className="rounded p-1 border" onClick={() => setScale(s => Math.max(0.3, s / 1.15))}><ZoomOut className="h-4 w-4" /></button>
        <button type="button" aria-label="Reset map" className="rounded p-1 border" onClick={() => { setScale(0.8); setPos({ x: 50, y: 50 }); }}><RotateCcw className="h-4 w-4" /></button>
      </div>
      <Stage width={dimensions.width} height={dimensions.height} onWheel={handleWheel} scaleX={scale} scaleY={scale} x={pos.x} y={pos.y} draggable onDragMove={(e) => { if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() }); }}>
        <Layer>
          {mapLabelItems.map((label) => <Group key={`label-${label.id}`} x={label.x} y={label.y}><Rect width={150} height={32} cornerRadius={8} fill={label.type === 'ada_route' ? '#ecfdf5' : '#eff6ff'} stroke={label.type === 'ada_route' ? '#10b981' : '#3b82f6'} strokeWidth={1.5} /><Text text={`${LABEL_TITLES[label.type] || label.label}: ${label.label}`} fontSize={11} fill="#1f2937" x={8} y={9} width={134} /></Group>)}
          {items.map((item) => {
            const isActive = !!(activeGuestId && isChair(item) && item.guestId === activeGuestId);
            if (isRoundTable(item)) return <Group key={item.id} x={item.x} y={item.y}><Circle radius={item.radius} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} /><Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={item.radius} offsetY={7} width={item.radius * 2} /></Group>;
            if (isRectTable(item)) return <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}><Rect width={item.width} height={item.height} offsetX={item.width / 2} offsetY={item.height / 2} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} cornerRadius={4} /><Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={item.width / 2} offsetY={7} width={item.width} /></Group>;
            if (isDanceFloor(item)) return <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}><Rect width={item.width} height={item.height} offsetX={item.width / 2} offsetY={item.height / 2} fill="#e5e7eb" stroke="#d1d5db" strokeWidth={1} dash={[10, 5]} /><Text text={item.label} fontSize={16} fill="#6b7280" fontStyle="italic" align="center" verticalAlign="middle" offsetX={item.width / 2} offsetY={8} width={item.width} /></Group>;
            if (isChair(item)) return <Group key={item.id} x={item.x} y={item.y}><Circle radius={item.radius} fill={isActive ? '#fdf2f8' : item.guestId ? '#e5e7eb' : '#fff'} stroke={isActive ? '#ec4899' : '#9ca3af'} strokeWidth={isActive ? 3 : 1.5} />{isActive && <><Circle radius={item.radius + 8} stroke="#ec4899" strokeWidth={2} opacity={0.6} dash={[4, 4]} /><Circle radius={item.radius + 14} stroke="#f59e0b" strokeWidth={1.5} opacity={0.4} dash={[6, 3]} /></>}{item.guestInitials && !isActive && <Text text={item.guestInitials} fontSize={8} fill="#6b7280" align="center" verticalAlign="middle" offsetX={item.radius} offsetY={4} width={item.radius * 2} listening={false} />}</Group>;
            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
}
