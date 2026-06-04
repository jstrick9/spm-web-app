import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar
} from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkCatalogItem } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Skeleton } from '../../ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { useToast } from '../../ui/Toast';

interface Props {
  orgId: string;
}

export type CatalogKind =
  | 'table'
  | 'chair'
  | 'fixture'
  | 'wall_style'
  | 'linen'
  | 'guideline'
  | 'spacing'
  | 'template'
  | 'decor'
  | 'venue'
  | 'branding'
  | 'guest_portal'
  | 'access_control';

const KINDS: { id: CatalogKind; label: string; desc: string; icon: string }[] = [
  { id: 'table', label: 'Tables', desc: 'Define shapes, dimensions, and capacities for floorplan tables.', icon: '⭕' },
  { id: 'chair', label: 'Chairs & Seating', desc: 'Manage styles, widths, and stocks of chairs.', icon: '🪑' },
  { id: 'fixture', label: 'Fixtures & Stages', desc: 'Stages, dance floors, bars, and podium sizes.', icon: '📦' },
  { id: 'wall_style', label: 'Wall Styles', desc: 'Architectural wall properties, thicknesses, and materials.', icon: '🧱' },
  { id: 'linen', label: 'Linens', desc: 'Tablecloths, runners, overlays, and draperies.', icon: '🧵' },
  { id: 'guideline', label: 'Guidelines', desc: 'Emergency exits, safety rings, and spacing rules.', icon: '🚒' },
  { id: 'spacing', label: 'Spacing Presets', desc: 'Spacing offsets between tables and row configurations.', icon: '📐' },
  { id: 'template', label: 'Layout Templates', desc: 'Seated, ceremony, and banquet table layouts.', icon: '📋' },
  { id: 'decor', label: 'Decor Inventory', desc: 'Manage floral arrangements, lights, arches, and floral photos.', icon: '🌸' },
  { id: 'venue', label: 'Venues', desc: 'Manage venue spaces, dimensions, capacities, and layout photos.', icon: '🏛️' },
  { id: 'branding', label: 'Venue Branding', desc: 'Customize logo, Google fonts, text colors, and brand palettes.', icon: '🎨' },
  { id: 'guest_portal', label: 'Guest Portal Studio', desc: 'Passcode gates, song lists, lodging rules, and visual portal settings.', icon: '🌐' },
  { id: 'access_control', label: 'User & Access Matrix', desc: 'Team invites, system roles, and interactive privilege matrix.', icon: '🛡️' },
];

export function CatalogScreen({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<CatalogKind>('table');

  return (
    <>
      <PageHeader
        title="Admin Settings & Operations"
        description="Comprehensive operational workspace to configure structural floorplans, floral packages, and organization custom branding."
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation vertical list */}
          <div className="lg:col-span-1 space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle px-3 mb-2">Operational Controls</h2>
            <div className="flex flex-col gap-1">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setActiveTab(k.id)}
                  className={[
                    'w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between',
                    activeTab === k.id
                      ? 'bg-brand text-brand-fg shadow-sm font-bold border-l-4 border-brand-strong'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{k.icon}</span>
                    {k.label}
                  </span>
                  <ChevronRight className={['h-3.5 w-3.5 opacity-40 transition-transform', activeTab === k.id ? 'translate-x-0.5 opacity-100' : ''].join(' ')} />
                </button>
              ))}
            </div>
          </div>

          {/* Configuration area */}
          <div className="lg:col-span-3">
            <Card className="min-h-[550px] border border-border bg-[#FDFBF7] shadow-lg">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-lg font-serif font-bold text-fg flex items-center gap-2">
                  <span className="text-xl">{KINDS.find((k) => k.id === activeTab)?.icon}</span>
                  {KINDS.find((k) => k.id === activeTab)?.label}
                </CardTitle>
                <CardDescription className="text-xs text-fg-subtle">
                  {KINDS.find((k) => k.id === activeTab)?.desc}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {activeTab === 'branding' ? (
                  <BrandingManager orgId={orgId} />
                ) : activeTab === 'decor' ? (
                  <DecorManager orgId={orgId} />
                ) : activeTab === 'venue' ? (
                  <VenueManager orgId={orgId} />
                ) : activeTab === 'guest_portal' ? (
                  <GuestPortalManager orgId={orgId} />
                ) : activeTab === 'access_control' ? (
                  <AccessControlManager orgId={orgId} />
                ) : (
                  <CatalogManager orgId={orgId} kind={activeTab} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

// ─── 1. Interactive SVG Shape Previews ─────────────────────────────────────
function renderShapePreview(shape: string, color: string = '#E5E5E5', capacity: number = 8) {
  const size = 64;
  const radius = size / 2;
  const stroke = '#3F3F46';

  // Render seats arranged symmetrically around the table shape
  const seatRadius = 4;
  const seats = Array.from({ length: Math.min(16, Math.max(0, capacity)) }).map((_, i, arr) => {
    const angle = (i * 2 * Math.PI) / arr.length;
    const offset = radius - 8;
    const cx = radius + offset * Math.cos(angle);
    const cy = radius + offset * Math.sin(angle);
    return <circle key={i} cx={cx} cy={cy} r={seatRadius} fill="#D4AF37" stroke="#333" strokeWidth="0.5" />;
  });

  return (
    <div className="relative h-16 w-16 bg-surface-2 rounded-lg border border-border flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
      <svg className="h-full w-full p-1" viewBox="0 0 64 64">
        {shape === 'round' && <circle cx={radius} cy={radius} r={radius - 12} fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'rect' && <rect x="14" y="20" width={size - 28} height={size - 40} rx="2" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'square' && <rect x="16" y="16" width={size - 32} height={size - 32} rx="2" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'oval' && <ellipse cx={radius} cy={radius} rx={radius - 12} ry={radius - 18} fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'triangle' && <polygon points="32,14 50,48 14,40" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'semicircle' && <path d="M 14,40 A 18,18 0 0,1 50,40 L 14,40" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'hexagon' && <polygon points="32,14 48,22 48,42 32,50 16,42 16,22" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'octagon' && <polygon points="32,13 45,19 49,32 45,45 32,51 19,45 15,32 19,19" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {seats}
      </svg>
    </div>
  );
}

// ─── 2. Generic Catalog Item Manager with Quick-Add Presets ─────────────────
export function CatalogManager({ orgId, kind }: { orgId: string; kind: Exclude<CatalogKind, 'decor' | 'branding' | 'venue' | 'guest_portal' | 'access_control'> }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', orgId, kind],
    queryFn: () => sdk.catalog.list(orgId, kind as any),
  });

  const [localItems, setLocalItems] = useState<Partial<SdkCatalogItem>[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  React.useEffect(() => {
    if (data) {
      setLocalItems(data.items);
      setHasChanges(false);
    }
  }, [data, kind]);

  const saveMutation = useMutation({
    mutationFn: (items: any[]) => sdk.catalog.replaceAll(orgId, kind as any, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog', orgId, kind] });
      toast({ title: 'Inventory catalog updated successfully', variant: 'success' });
      setHasChanges(false);
    },
    onError: (e: any) => {
      toast({ title: 'Could not save configurations', description: e.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    let spec: any = {};
    if (kind === 'table') spec = { shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true };
    else if (kind === 'chair') spec = { radius: 10, icon: '🪑', color: '#D4AF37', width: 1.5, depth: 1.5, inventoryCount: 150 };
    else if (kind === 'fixture') spec = { type: 'stage', width: 96, height: 144, color: '#8C52FF' };
    else if (kind === 'wall_style') spec = { thickness: 4, height: 8, color: '#C0C0C0', texture: 'plaster' };
    else if (kind === 'linen') spec = { type: 'tablecloth', material: 'polyester', color: '#FFFFFF', dropLength: 30 };
    else if (kind === 'guideline') spec = { bufferWidth: 5, severity: 'warning', desc: 'Clear escape route buffer' };
    else if (kind === 'spacing') spec = { rowSpacing: 6, seatSpacing: 1.5, code: 'standard-seating' };
    else if (kind === 'template') spec = { category: 'reception', payload: '{}' };

    setLocalItems([
      ...localItems,
      {
        name: `New ${kind.replace('_', ' ')}`,
        spec: JSON.stringify(spec),
        visible: true,
      } as any,
    ]);
    setHasChanges(true);
  };

  const handleQuickAdd = (presetType: string) => {
    let newPresets: any[] = [];
    if (kind === 'table') {
      if (presetType === 'round') {
        newPresets = [
          { name: '60" Round (8)', spec: JSON.stringify({ shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true }), visible: true },
          { name: '48" Round (6)', spec: JSON.stringify({ shape: 'round', radius: 24, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true }), visible: true },
        ];
      } else if (presetType === 'rectangle') {
        newPresets = [
          { name: '6ft Banquet (6)', spec: JSON.stringify({ shape: 'rect', width: 72, height: 30, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true }), visible: true },
          { name: '8ft Banquet (8)', spec: JSON.stringify({ shape: 'rect', width: 96, height: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true }), visible: true },
        ];
      }
    } else if (kind === 'chair') {
      if (presetType === 'chiavari') {
        newPresets = [
          { name: 'Chiavari Gold', spec: JSON.stringify({ radius: 9, icon: '👑', color: '#D4AF37', width: 1.4, depth: 1.4, inventoryCount: 200 }), visible: true },
          { name: 'Chiavari Silver', spec: JSON.stringify({ radius: 9, icon: '🪑', color: '#C0C0C0', width: 1.4, depth: 1.4, inventoryCount: 150 }), visible: true },
        ];
      } else if (presetType === 'ghost') {
        newPresets = [
          { name: 'Ghost Acrylic', spec: JSON.stringify({ radius: 10, icon: '💎', color: '#E8E8E8', width: 1.6, depth: 1.5, inventoryCount: 100 }), visible: true },
        ];
      }
    } else if (kind === 'fixture') {
      newPresets = [
        { name: '12x12 Dance Floor', spec: JSON.stringify({ type: 'dance_floor', width: 144, height: 144, color: '#8F4F4F' }), visible: true },
        { name: 'Full Catering Bar', spec: JSON.stringify({ type: 'bar', width: 96, height: 36, color: '#C0C0C0' }), visible: true },
      ];
    } else if (kind === 'wall_style') {
      newPresets = [
        { name: 'Wood Lattice Panel', spec: JSON.stringify({ thickness: 2, height: 8, color: '#D2B48C', texture: 'wood' }), visible: true },
        { name: 'Solid Divider Wall', spec: JSON.stringify({ thickness: 4, height: 10, color: '#FFFFFF', texture: 'drywall' }), visible: true },
      ];
    } else if (kind === 'linen') {
      newPresets = [
        { name: 'Burgundy Table Runner', spec: JSON.stringify({ type: 'runner', material: 'velvet', color: '#800020', dropLength: 12 }), visible: true },
        { name: 'Ivory Polyester Cloth', spec: JSON.stringify({ type: 'tablecloth', material: 'polyester', color: '#FFFFF0', dropLength: 30 }), visible: true },
      ];
    } else if (kind === 'guideline') {
      newPresets = [
        { name: 'ADA Seating Gap', spec: JSON.stringify({ bufferWidth: 4, severity: 'info', desc: 'Clear space for wheelchair access' }), visible: true },
        { name: 'Main Exit Path Buffer', spec: JSON.stringify({ bufferWidth: 6, severity: 'danger', desc: 'Keep entirely free of chairs/decor' }), visible: true },
      ];
    } else if (kind === 'spacing') {
      newPresets = [
        { name: 'Comfortable Rows', spec: JSON.stringify({ rowSpacing: 6, seatSpacing: 1.8, code: 'comfort' }), visible: true },
        { name: 'Compact Ceremony', spec: JSON.stringify({ rowSpacing: 4.5, seatSpacing: 1.2, code: 'compact-cer' }), visible: true },
      ];
    }

    if (newPresets.length > 0) {
      setLocalItems([...localItems, ...newPresets]);
      setHasChanges(true);
      toast({ title: 'Added presets to layout list', description: 'Click Save below to commit.', variant: 'success' });
    }
  };

  const updateItem = (index: number, key: string, value: any) => {
    const next = [...localItems];
    next[index] = { ...next[index], [key]: value };
    setLocalItems(next);
    setHasChanges(true);
  };

  const updateSpec = (index: number, key: string, value: any) => {
    const next = [...localItems];
    try {
      const spec = JSON.parse(next[index].spec as any || '{}');
      spec[key] = value;
      next[index].spec = JSON.stringify(spec) as any;
      setLocalItems(next);
      setHasChanges(true);
    } catch {}
  };

  const removeRow = (index: number) => {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Add Presets Panel */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border space-y-3">
        <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand" /> Quick-Add Presets
        </h4>
        <div className="flex flex-wrap gap-2">
          {kind === 'table' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('round')}>⭕ Round Tables</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('rectangle')}>⬜ Rectangle Tables</Button>
            </>
          )}
          {kind === 'chair' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('chiavari')}>👑 Chiavari Styles</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('ghost')}>💎 Ghost Collection</Button>
            </>
          )}
          {kind === 'fixture' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('fixture')}>📦 Stage & Dance Floors</Button>}
          {kind === 'wall_style' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('wall_style')}>🧱 Partition Walls</Button>}
          {kind === 'linen' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('linen')}>🧵 Tablecloths & Runners</Button>}
          {kind === 'guideline' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('guideline')}>🚒 Fire Safety Guidelines</Button>}
          {kind === 'spacing' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('spacing')}>📐 Row & Seat Spacing</Button>}
        </div>
      </div>

      <div className="flex justify-between items-center bg-surface-2/60 p-3 rounded-lg border border-border">
        <span className="text-xs font-semibold text-fg-subtle">
          {localItems.length} active configuration{localItems.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
          <Button
            size="sm"
            onClick={() =>
              saveMutation.mutate(
                localItems.map((i) => ({
                  ...i,
                  spec: typeof i.spec === 'string' ? JSON.parse(i.spec) : i.spec,
                })),
              )
            }
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-1" /> Save Presets
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {localItems.length === 0 ? (
          <div className="text-center text-xs text-fg-muted py-10 border border-dashed rounded-lg bg-surface-2/20">
            No configurations created yet.
          </div>
        ) : (
          localItems.map((item, i) => {
            const spec = typeof item.spec === 'string' ? JSON.parse(item.spec || '{}') : (item.spec || {});
            return (
              <div key={i} className="flex flex-col md:flex-row gap-4 bg-surface p-4 rounded-xl border border-border/80 hover:border-brand/40 transition-colors shadow-sm">
                
                {/* Embedded SVG Visual Preview */}
                {kind === 'table' && renderShapePreview(spec.shape || 'round', spec.color || '#E8E0D0', spec.capacity || 8)}
                {kind === 'chair' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center text-2xl relative shadow-sm" style={{ color: spec.color || '#D4AF37' }}>
                    {spec.icon || '🪑'}
                    <span className="text-[9px] absolute bottom-1 font-bold tracking-tight text-fg-subtle">{spec.inventoryCount || 100}</span>
                  </div>
                )}
                {kind === 'fixture' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex items-center justify-center relative shadow-sm overflow-hidden" style={{ backgroundColor: spec.color || '#8C52FF' }}>
                    <span className="text-[10px] font-bold text-white tracking-wide capitalize">{spec.type || 'stage'}</span>
                  </div>
                )}
                {kind === 'wall_style' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden">
                    <div className="w-4 h-12 rounded bg-fg-muted" style={{ backgroundColor: spec.color || '#999999' }} />
                    <span className="text-[9px] absolute bottom-0.5 capitalize text-fg-subtle font-semibold">{spec.texture || 'drywall'}</span>
                  </div>
                )}
                {kind === 'linen' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden" style={{ color: spec.color || '#D4AF37' }}>
                    <span className="text-xl">🧵</span>
                    <span className="text-[8px] absolute bottom-1 font-bold text-fg-subtle capitalize">{spec.type || 'cloth'}</span>
                  </div>
                )}
                {kind === 'guideline' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden">
                    <span className="text-xl">🚒</span>
                    <span className="text-[8px] absolute bottom-1 font-bold text-danger-strong capitalize">{spec.severity || 'warning'}</span>
                  </div>
                )}
                {kind === 'spacing' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden">
                    <span className="text-xl">📐</span>
                    <span className="text-[9px] absolute bottom-1 font-bold text-fg-subtle">{spec.rowSpacing || 6}ft</span>
                  </div>
                )}
                {kind === 'template' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden">
                    <span className="text-xl">📋</span>
                    <span className="text-[8px] absolute bottom-1 font-bold text-fg-subtle capitalize">{spec.category || 'reception'}</span>
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="Preset Name"
                        value={item.name}
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        className="h-9 text-xs font-semibold"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-danger hover:bg-danger/10 shrink-0" onClick={() => removeRow(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Sub-form inputs dynamically compiled based on catalog kinds */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-border/40">
                    {kind === 'table' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Shape</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.shape || 'round'}
                            onChange={(e) => updateSpec(i, 'shape', e.target.value)}
                          >
                            <option value="round">Round Circle</option>
                            <option value="rect">Rectangular</option>
                            <option value="square">Square</option>
                            <option value="oval">Oval / Elongated</option>
                            <option value="hexagon">Hexagonal</option>
                            <option value="octagon">Octagonal</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Diameter/Width (in)</Label>
                          <Input
                            type="number"
                            value={spec.radius ? spec.radius * 2 : (spec.width || '')}
                            onChange={(e) => updateSpec(i, spec.shape === 'round' ? 'radius' : 'width', parseInt(e.target.value) / (spec.shape === 'round' ? 2 : 1))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Seating Capacity</Label>
                          <Input
                            type="number"
                            value={spec.capacity || ''}
                            onChange={(e) => updateSpec(i, 'capacity', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input
                            type="text"
                            value={spec.color || '#FFFFFF'}
                            onChange={(e) => updateSpec(i, 'color', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id={`decor-base-${i}`}
                            checked={spec.allowAsDecorBase ?? true}
                            onChange={(e) => updateSpec(i, 'allowAsDecorBase', e.target.checked)}
                            className="rounded border-border accent-brand"
                          />
                          <Label htmlFor={`decor-base-${i}`} className="text-[11px] cursor-pointer text-fg-subtle">
                            Allow arrangements/florals top base
                          </Label>
                        </div>
                      </>
                    )}

                    {kind === 'chair' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Icon/Emoji</Label>
                          <Input
                            type="text"
                            value={spec.icon || '🪑'}
                            onChange={(e) => updateSpec(i, 'icon', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Width (ft)</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={spec.width || 1.5}
                            onChange={(e) => updateSpec(i, 'width', parseFloat(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Depth (ft)</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={spec.depth || 1.5}
                            onChange={(e) => updateSpec(i, 'depth', parseFloat(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Stock Count</Label>
                          <Input
                            type="number"
                            value={spec.inventoryCount || 100}
                            onChange={(e) => updateSpec(i, 'inventoryCount', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                      </>
                    )}

                    {kind === 'fixture' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Fixture Type</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.type || 'stage'}
                            onChange={(e) => updateSpec(i, 'type', e.target.value)}
                          >
                            <option value="stage">Stage Platform</option>
                            <option value="dance_floor">Dance Floor</option>
                            <option value="bar">Beverage Bar</option>
                            <option value="arch">Floral Arch</option>
                            <option value="podium">Podium / Altars</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Width (in)</Label>
                          <Input
                            type="number"
                            value={spec.width || 96}
                            onChange={(e) => updateSpec(i, 'width', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Length (in)</Label>
                          <Input
                            type="number"
                            value={spec.height || 144}
                            onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input
                            type="text"
                            value={spec.color || '#8C52FF'}
                            onChange={(e) => updateSpec(i, 'color', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                      </>
                    )}

                    {kind === 'wall_style' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Thickness (in)</Label>
                          <Input
                            type="number"
                            value={spec.thickness || 4}
                            onChange={(e) => updateSpec(i, 'thickness', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Height (ft)</Label>
                          <Input
                            type="number"
                            value={spec.height || 8}
                            onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Texture</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.texture || 'plaster'}
                            onChange={(e) => updateSpec(i, 'texture', e.target.value)}
                          >
                            <option value="drywall">Solid Drywall</option>
                            <option value="plaster">Plaster Finish</option>
                            <option value="wood">Wood Panel</option>
                            <option value="brick">Rustic Brick</option>
                            <option value="concrete">Raw Concrete</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Paint Color</Label>
                          <Input
                            type="text"
                            value={spec.color || '#C0C0C0'}
                            onChange={(e) => updateSpec(i, 'color', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                      </>
                    )}

                    {kind === 'linen' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Linen Type</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.type || 'tablecloth'}
                            onChange={(e) => updateSpec(i, 'type', e.target.value)}
                          >
                            <option value="tablecloth">Tablecloth</option>
                            <option value="runner">Table Runner</option>
                            <option value="overlay">Overlay Cloth</option>
                            <option value="drape">Backdrop Drapery</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Material</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.material || 'polyester'}
                            onChange={(e) => updateSpec(i, 'material', e.target.value)}
                          >
                            <option value="polyester">Polyester</option>
                            <option value="satin">Satin Glow</option>
                            <option value="velvet">Luxury Velvet</option>
                            <option value="linen">Natural Linen</option>
                            <option value="sequin">Glam Sequin</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Drop Length (in)</Label>
                          <Input
                            type="number"
                            value={spec.dropLength || 30}
                            onChange={(e) => updateSpec(i, 'dropLength', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Linen Color</Label>
                          <Input
                            type="text"
                            value={spec.color || '#FFFFFF'}
                            onChange={(e) => updateSpec(i, 'color', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                      </>
                    )}

                    {kind === 'guideline' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Buffer Width (ft)</Label>
                          <Input
                            type="number"
                            value={spec.bufferWidth || 5}
                            onChange={(e) => updateSpec(i, 'bufferWidth', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Severity Level</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.severity || 'warning'}
                            onChange={(e) => updateSpec(i, 'severity', e.target.value)}
                          >
                            <option value="info">Information (Blue)</option>
                            <option value="warning">Warning Buffer (Amber)</option>
                            <option value="danger">Critical Egress (Red)</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-fg-subtle">Regulatory Description</Label>
                          <Input
                            type="text"
                            value={spec.desc || ''}
                            onChange={(e) => updateSpec(i, 'desc', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                      </>
                    )}

                    {kind === 'spacing' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Row Spacing (ft)</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={spec.rowSpacing || 5.0}
                            onChange={(e) => updateSpec(i, 'rowSpacing', parseFloat(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Chair Spacing (ft)</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={spec.seatSpacing || 1.5}
                            onChange={(e) => updateSpec(i, 'seatSpacing', parseFloat(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Min Clearance (ft)</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={spec.minClearance || 3.0}
                            onChange={(e) => updateSpec(i, 'minClearance', parseFloat(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Spacing Code</Label>
                          <Input
                            type="text"
                            value={spec.code || ''}
                            onChange={(e) => updateSpec(i, 'code', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                      </>
                    )}

                    {kind === 'template' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Template Category</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.category || 'reception'}
                            onChange={(e) => updateSpec(i, 'category', e.target.value)}
                          >
                            <option value="reception">Reception / Seated banquet</option>
                            <option value="ceremony">Ceremony / Row seating</option>
                            <option value="cocktail">Cocktail / Standing</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── 3. Venue Manager with Environment & Local Photos ──────────────────────
export function VenueManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newVenueName, setNewVenueName] = useState('');
  const [capacity, setCapacity] = useState(150);
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(40);
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor' | 'both'>('indoor');
  const [venuePhoto, setVenuePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: venueData, isLoading } = useQuery({
    queryKey: ['venues', orgId],
    queryFn: () => sdk.venues.list(orgId),
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVenuePhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      sdk.venues.create(orgId, {
        name: newVenueName,
        capacity,
        width,
        height,
        environment,
        style: venuePhoto ? { photo: venuePhoto } : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      setNewVenueName('');
      setVenuePhoto(null);
      toast({ title: 'Venue created successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to create venue space', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.venues.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      toast({ title: 'Venue deleted successfully', variant: 'success' });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  const venues = venueData?.venues ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4">
        <h4 className="text-xs font-bold text-fg">Add New Venue Workspace</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="venue-name" className="text-[10px]">Venue Name</Label>
            <Input id="venue-name" placeholder="Grand Ballroom, South Garden..." value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} className="h-9 text-xs mt-1" />
          </div>
          <div>
            <Label htmlFor="venue-cap" className="text-[10px]">Max Capacity</Label>
            <Input id="venue-cap" type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
          </div>
          <div>
            <Label htmlFor="venue-env" className="text-[10px]">Environment</Label>
            <select
              id="venue-env"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
            >
              <option value="indoor">🏛️ Indoor Hall</option>
              <option value="outdoor">🌿 Outdoor Garden</option>
              <option value="both">✨ Both Indoor/Outdoor</option>
            </select>
          </div>
          <div>
            <Label htmlFor="venue-w" className="text-[10px]">Width (ft)</Label>
            <Input id="venue-w" type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
          </div>
          <div>
            <Label htmlFor="venue-h" className="text-[10px]">Length / Height (ft)</Label>
            <Input id="venue-h" type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
          </div>
        </div>

        {/* Upload venue photo */}
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handlePhotoUpload} ref={fileInputRef} className="hidden" />
          <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {venuePhoto ? 'Change Space Layout Photo' : 'Upload Space Layout Photo'}
          </Button>
          {venuePhoto && (
            <div className="flex items-center gap-2">
              <img src={venuePhoto} alt="Space Layout" className="h-10 w-10 object-cover rounded-md border border-border" />
              <Button size="xs" variant="ghost" className="text-danger" onClick={() => setVenuePhoto(null)}>
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => createMutation.mutate()} disabled={!newVenueName.trim() || createMutation.isPending} className="w-full">
          Create Venue
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {venues.length === 0 ? (
          <div className="col-span-2 text-center text-xs text-fg-muted py-8 border border-dashed rounded-lg bg-surface-2/20">No venues configured yet.</div>
        ) : (
          venues.map((v: any) => {
            const style = typeof v.style === 'string' ? JSON.parse(v.style || '{}') : (v.style || {});
            return (
              <Card key={v.id} className="p-3 flex items-center justify-between border-border bg-[#FDFBF7]">
                <div className="flex items-center gap-3">
                  {style.photo ? (
                    <img src={style.photo} alt={v.name} className="h-12 w-12 object-cover rounded-md border border-border shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle shadow-sm">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-fg">{v.name}</h4>
                    <p className="text-[10px] text-fg-subtle mt-0.5">{v.width}ft × {v.height}ft · {v.capacity} guests · <span className="capitalize">{v.environment || 'indoor'}</span></p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10" onClick={() => deleteMutation.mutate(v.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── 4. Decor Manager with Florals & Images ────────────────────────────────
export function DecorManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newItemName, setNewItemName] = useState('');
  const [decorPhoto, setDecorPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: decorData, isLoading } = useQuery({
    queryKey: ['decor-items', orgId],
    queryFn: () => sdk.decor.listItems(orgId),
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDecorPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => sdk.decor.createItem(orgId, { name: newItemName, visible: true, imagePath: decorPhoto || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      setNewItemName('');
      setDecorPhoto(null);
      toast({ title: 'Decor item added successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to add decor', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.decor.deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      toast({ title: 'Decor item deleted', variant: 'success' });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  const items = decorData?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 bg-surface-2/40 p-4 rounded-xl border border-border">
        <Input
          placeholder="New Decor Item Name (e.g. Flower Arch, Centerpiece Vase, Fairy Lights)..."
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="h-10 text-xs bg-surface"
        />

        {/* Upload decor photo */}
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handlePhotoUpload} ref={fileInputRef} className="hidden" />
          <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {decorPhoto ? 'Change Decor Photo' : 'Upload Decor Photo'}
          </Button>
          {decorPhoto && (
            <div className="flex items-center gap-2">
              <img src={decorPhoto} alt="Decor" className="h-10 w-10 object-cover rounded-md border border-border shadow-sm" />
              <Button size="xs" variant="ghost" className="text-danger" onClick={() => setDecorPhoto(null)}>
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => createMutation.mutate()} disabled={!newItemName.trim() || createMutation.isPending}>
          Add Decor Item
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {items.length === 0 ? (
          <div className="col-span-2 text-center text-xs text-fg-muted py-10 border border-dashed rounded-lg bg-surface-2/20">
            No decor items added yet.
          </div>
        ) : (
          items.map((it: any) => (
            <Card key={it.id} className="border border-border p-3 flex items-center justify-between gap-3 bg-[#FDFBF7]">
              <div className="flex items-center gap-3">
                {it.image_path ? (
                  <img src={it.image_path} alt={it.name} className="h-12 w-12 object-cover rounded-md border border-border shadow-sm" />
                ) : (
                  <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle shadow-sm">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-fg">{it.name}</h4>
                  <p className="text-[10px] text-fg-subtle capitalize mt-0.5">Status: {it.visible ? 'Visible' : 'Hidden'}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10" onClick={() => deleteMutation.mutate(it.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 5. Branding Manager with Google Fonts & Previews ─────────────────────
export function BrandingManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState('Seven Paths Manor');
  const [supportEmail, setSupportEmail] = useState('hello@sevenpathsmanor.com');
  const [phone, setPhone] = useState('(555) 019-2831');
  const [webUrl, setWebUrl] = useState('https://sevenpathsmanor.com');
  const [brandColor, setBrandColor] = useState('#800020');
  const [headingFont, setHeadingFont] = useState('Fraunces');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [logoPhoto, setLogoPhoto] = useState<string | null>(null);
  const [tagline, setTagline] = useState('Where Your Love Story Unfolds');
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome to our digital layout assistant.');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveBrandingMutation = useMutation({
    mutationFn: () =>
      sdk.orgs.updateBranding(orgId, {
        name: orgName,
        support_email: supportEmail,
        phone,
        website_url: webUrl,
        brandColor,
        headingFont,
        bodyFont,
        logo: logoPhoto,
      }),
    onSuccess: () => {
      toast({ title: 'Venue branding saved successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to update branding details', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Logo Upload */}
          <div className="bg-surface-2/40 p-4 rounded-xl border border-border flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-fg">Venue Logo</Label>
              <p className="text-[10px] text-fg-subtle">PNG, JPG, or SVG base64 image</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*" onChange={handleLogoUpload} ref={fileInputRef} className="hidden" />
              <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> {logoPhoto ? 'Change Logo' : 'Upload Logo'}
              </Button>
              {logoPhoto && (
                <div className="flex items-center gap-2">
                  <img src={logoPhoto} alt="Venue Logo" className="h-10 w-10 object-contain rounded-md border border-border bg-white p-1" />
                  <Button size="xs" variant="ghost" className="text-danger" onClick={() => setLogoPhoto(null)}>
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="h-10 text-xs mt-1" />
          </div>

          <div>
            <Label htmlFor="org-tagline">Venue Tagline</Label>
            <Input id="org-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className="h-10 text-xs mt-1" />
          </div>

          <div>
            <Label htmlFor="org-welcome">Welcome Message</Label>
            <Input id="org-welcome" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="h-10 text-xs mt-1" />
          </div>

          <div>
            <Label htmlFor="org-email">Support Email</Label>
            <Input id="org-email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="h-10 text-xs mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-phone">Phone</Label>
              <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 text-xs mt-1" />
            </div>
            <div>
              <Label htmlFor="org-web">Website URL</Label>
              <Input id="org-web" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} className="h-10 text-xs mt-1" />
            </div>
          </div>

          {/* Fonts configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="heading-font">Heading Font</Label>
              <select
                id="heading-font"
                value={headingFont}
                onChange={(e) => setHeadingFont(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
              >
                <option value="Fraunces">Fraunces (Editorial)</option>
                <option value="Playfair Display">Playfair Display (Chic Serif)</option>
                <option value="Montserrat">Montserrat (Geometric)</option>
                <option value="Cinzel">Cinzel (Formal Classic)</option>
                <option value="Poppins">Poppins (Clean Sans-Serif)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="body-font">Body Font</Label>
              <select
                id="body-font"
                value={bodyFont}
                onChange={(e) => setBodyFont(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
              >
                <option value="Inter">Inter (Clean Modern)</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Noto Serif">Noto Serif</option>
                <option value="Georgia">Georgia</option>
                <option value="Quicksand">Quicksand (Whimsical)</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="brand-color">Brand Accent Color</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                id="brand-color"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-16 border rounded-md cursor-pointer"
              />
              <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 text-xs max-w-[120px]" />
            </div>
          </div>
        </div>

        {/* Live Visual Branding Preview Card */}
        <div className="space-y-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Live Branding Preview</Label>
          <div className="rounded-2xl border border-border bg-white shadow-md overflow-hidden min-h-[400px] flex flex-col">
            <div className="p-4 text-white flex items-center gap-3" style={{ backgroundColor: brandColor }}>
              {logoPhoto ? (
                <img src={logoPhoto} alt="Logo" className="h-8 w-8 object-contain rounded bg-white p-0.5" />
              ) : (
                <span className="text-2xl">💒</span>
              )}
              <div>
                <h4 className="font-bold text-xs" style={{ fontFamily: headingFont }}>{orgName}</h4>
                <p className="text-[10px] opacity-95" style={{ fontFamily: bodyFont }}>{tagline}</p>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-lg font-bold font-serif text-fg" style={{ fontFamily: headingFont }}>
                  Welcome back to our digital layout assistant
                </h3>
                <p className="text-xs text-fg-muted leading-relaxed" style={{ fontFamily: bodyFont }}>
                  {welcomeMessage} Utilize our structural layout and floral designer tools to customize the space.
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <span className="text-[10px] text-fg-subtle bg-surface-2 px-2 py-1 rounded">📞 {phone}</span>
                  <span className="text-[10px] text-fg-subtle bg-surface-2 px-2 py-1 rounded">🌐 {webUrl.replace('https://', '')}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 space-y-2">
                <div className="flex gap-2">
                  <button className="flex-1 py-2 text-[10px] font-bold text-white rounded-lg transition-transform hover:scale-[1.02]" style={{ backgroundColor: brandColor }}>
                    Explore Layouts
                  </button>
                  <button className="flex-1 py-2 text-[10px] font-bold text-fg-subtle border border-border rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors">
                    Secondary action
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={() => saveBrandingMutation.mutate()} className="w-full h-11 tracking-wider font-semibold">
        <Save className="h-4 w-4 mr-2" /> Save Branding Preferences
      </Button>
    </div>
  );
}

// ─── 6. Guest Portal Studio ────────────────────────────────────────────────
export function GuestPortalManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [requirePasscode, setRequirePasscode] = useState(true);
  const [showMeals, setShowMeals] = useState(true);
  const [allowSongs, setAllowSongs] = useState(true);
  const [enableRegistry, setEnableRegistry] = useState(true);
  const [registryUrl, setRegistryUrl] = useState('https://withjoy.com/smith-wedding');
  const [expiryDays, setExpiryDays] = useState(60);
  const [lodgingRooms, setLodgingRooms] = useState(8);
  const [portalWelcome, setPortalWelcome] = useState('Welcome to our digital layout assistant.');

  const handleSave = () => {
    toast({ title: 'Guest Portal preferences saved', variant: 'success' });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-brand" /> Portal Configurations
            </h4>

            {/* Checkbox settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="gate" className="text-xs font-semibold cursor-pointer">RSVP Password Gate</Label>
                  <p className="text-[10px] text-fg-subtle">Require sign-in passcode for RSVPs</p>
                </div>
                <input
                  type="checkbox"
                  id="gate"
                  checked={requirePasscode}
                  onChange={(e) => setRequirePasscode(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="meals" className="text-xs font-semibold cursor-pointer">Menu & Dining Options</Label>
                  <p className="text-[10px] text-fg-subtle">Show dinner menus during portal RSVP</p>
                </div>
                <input
                  type="checkbox"
                  id="meals"
                  checked={showMeals}
                  onChange={(e) => setShowMeals(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="songs" className="text-xs font-semibold cursor-pointer">Wedding Song Requests</Label>
                  <p className="text-[10px] text-fg-subtle">Allow guests to add to song list requests</p>
                </div>
                <input
                  type="checkbox"
                  id="songs"
                  checked={allowSongs}
                  onChange={(e) => setAllowSongs(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="registry" className="text-xs font-semibold cursor-pointer">Registry Integration</Label>
                  <p className="text-[10px] text-fg-subtle">Enable external gift registry link</p>
                </div>
                <input
                  type="checkbox"
                  id="registry"
                  checked={enableRegistry}
                  onChange={(e) => setEnableRegistry(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="reg-url" className="text-[11px]">Registry URL</Label>
            <Input id="reg-url" disabled={!enableRegistry} value={registryUrl} onChange={(e) => setRegistryUrl(e.target.value)} className="h-9 text-xs mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry" className="text-[11px]">Expiration Limit (days)</Label>
              <Input id="expiry" type="number" value={expiryDays} onChange={(e) => setExpiryDays(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
            </div>
            <div>
              <Label htmlFor="lodging" className="text-[11px]">Lodging Setup (Rooms/Cabins)</Label>
              <Input id="lodging" type="number" value={lodgingRooms} onChange={(e) => setLodgingRooms(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="portal-msg" className="text-[11px]">Portal Welcome Message</Label>
            <Input id="portal-msg" value={portalWelcome} onChange={(e) => setPortalWelcome(e.target.value)} className="h-10 text-xs mt-1" />
          </div>
        </div>

        {/* Live Portal Simulation Preview Card */}
        <div className="space-y-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Visual Guest Portal Simulation</Label>
          <div className="rounded-2xl border border-border bg-[#FDFBF7] shadow-md p-6 min-h-[400px] flex flex-col justify-between font-serif">
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-3 flex justify-between items-center text-xs text-fg-subtle">
                <span>🔒 RSVP Security Enabled</span>
                <span className="bg-success-soft text-success px-2 py-0.5 rounded font-semibold">Active</span>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-fg">Olivia & Thomas</h3>
                <p className="text-xs text-fg-muted">September 12, 2026</p>
              </div>

              <p className="text-xs text-center leading-relaxed text-fg-muted px-4 font-sans">
                {portalWelcome} Please respond by August 1st.
              </p>

              <div className="space-y-2 font-sans pt-2">
                {requirePasscode && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brand" /> Passcode Sign-In Gate</span>
                    <span className="font-semibold text-fg">Required</span>
                  </div>
                )}
                {showMeals && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Utensils className="h-3.5 w-3.5 text-brand" /> Dinner Menu Selection</span>
                    <span className="font-semibold text-fg">Enabled</span>
                  </div>
                )}
                {allowSongs && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5 text-brand" /> Wedding Playlist Suggestion</span>
                    <span className="font-semibold text-fg">Enabled</span>
                  </div>
                )}
                {enableRegistry && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-brand" /> Registry link</span>
                    <span className="font-semibold text-fg truncate max-w-[120px]">{registryUrl.replace('https://', '')}</span>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full mt-4 font-sans">
              Save Portal Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 7. Access Control Manager & Privilege Grid ──────────────────────────
export function AccessControlManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  const membersQuery = useQuery({
    queryKey: ['members-access', orgId],
    queryFn: () => sdk.roles.listMembers(orgId),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles-access', orgId],
    queryFn: () => sdk.roles.listRoles(orgId),
  });

  const permQuery = useQuery({
    queryKey: ['permissions-access', orgId],
    queryFn: () => sdk.roles.permissionCatalog(orgId),
  });

  const inviteMutation = useMutation({
    mutationFn: () => sdk.roles.addMember(orgId, { userEmail: email, roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Team member invited successfully', variant: 'success' });
      setEmail('');
      setRoleId('');
      setInviteOpen(false);
    },
    onError: () => toast({ title: 'Could not invite member', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => sdk.roles.removeMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Team member removed', variant: 'success' });
    },
  });

  const members = (membersQuery.data as any)?.members ?? [];
  const roles = rolesQuery.data?.roles ?? [];
  const permissions = permQuery.data?.catalog ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Management List */}
        <div className="md:col-span-1 bg-surface-2/30 p-4 rounded-xl border border-border space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand" /> Staff Accounts
            </h4>
            <Button size="xs" onClick={() => setInviteOpen(!inviteOpen)}>Invite</Button>
          </div>

          {inviteOpen && (
            <div className="bg-white p-3 rounded-lg border border-border space-y-3">
              <div>
                <Label htmlFor="inv-email" className="text-[10px]">Email</Label>
                <Input id="inv-email" type="email" placeholder="planner@test.com" value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label htmlFor="inv-role" className="text-[10px]">Role</Label>
                <select
                  id="inv-role"
                  value={roleId}
                  onChange={e => setRoleId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                >
                  <option value="">Select role</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <Button size="xs" onClick={() => inviteMutation.mutate()} className="w-full" disabled={!email || !roleId}>Send Invite</Button>
            </div>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {members.length === 0 ? (
              <p className="text-[11px] text-fg-subtle py-4 text-center">No staff found.</p>
            ) : (
              members.map((m: any) => (
                <div key={m.userId} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-border shadow-xs">
                  <div>
                    <div className="text-xs font-bold text-fg">{m.fullName || m.email}</div>
                    <div className="text-[9px] text-fg-subtle">{m.roleName}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-danger hover:bg-danger/10" onClick={() => removeMutation.mutate(m.userId)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Interactive Permissions Access Grid Matrix */}
        <div className="md:col-span-2 space-y-4">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-brand" /> Interactive Access Permissions Grid
          </h4>
          <div className="overflow-x-auto border border-border rounded-xl bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2/60 border-b border-border text-[10px] uppercase font-bold tracking-wider text-fg-subtle">
                  <th className="p-3 border-r">Capability</th>
                  {roles.map((r: any) => (
                    <th key={r.id} className="p-3 text-center min-w-[80px]">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={roles.length + 1} className="p-4 text-center text-fg-subtle">No permission policies mapped.</td>
                  </tr>
                ) : (
                  permissions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-surface-2/20 transition-colors">
                      <td className="p-3 border-r">
                        <div className="font-semibold text-fg">{p.label}</div>
                        <div className="text-[9px] text-fg-subtle mt-0.5">{p.description}</div>
                      </td>
                      {roles.map((r: any) => {
                        const hasPerm = r.permissions?.includes(p.id) ?? false;
                        return (
                          <td key={r.id} className="p-3 text-center">
                            {hasPerm ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success text-xs font-bold">✓</span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-fg-subtle text-xs">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
