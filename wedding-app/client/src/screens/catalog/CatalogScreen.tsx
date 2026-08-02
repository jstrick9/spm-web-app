import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkCatalogItem } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
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
        title="Admin & Catalog Studio"
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
    if (kind === 'table') spec = { shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 50 };
    else if (kind === 'chair') spec = { radius: 10, icon: '🪑', color: '#D4AF37', width: 1.5, depth: 1.5, inventoryCount: 150 };
    else if (kind === 'fixture') spec = { type: 'stage', width: 96, height: 144, color: '#8C52FF' };
    else if (kind === 'wall_style') spec = { thickness: 4, height: 8, color: '#C0C0C0', texture: 'plaster', enabled: true };
    else if (kind === 'linen') spec = { type: 'tablecloth', material: 'polyester', color: '#FFFFFF', dropLength: 30, enabled: true };
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

  // Helper function to load defaults for Tables, Chairs, Walls & Linens (Step 11 full parity)
  const handleLoadDefaults = () => {
    if (kind === 'table') {
      const defaults = [
        { name: '60" Round Table (8)', spec: { shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 50 }, visible: true },
        { name: '6ft Banquet Table (6)', spec: { shape: 'rect', width: 72, height: 30, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 40 }, visible: true },
        { name: '8ft Banquet Table (8)', spec: { shape: 'rect', width: 96, height: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 30 }, visible: true },
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default table configurations loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    } else if (kind === 'chair') {
      const defaults = [
        { name: 'Chiavari Gold', spec: { radius: 9, icon: '👑', color: '#D4AF37', width: 1.4, depth: 1.4, inventoryCount: 200 }, visible: true },
        { name: 'Chiavari Silver', spec: { radius: 9, icon: '🪑', color: '#C0C0C0', width: 1.4, depth: 1.4, inventoryCount: 150 }, visible: true },
        { name: 'Ghost Acrylic', spec: { radius: 10, icon: '💎', color: '#E8E8E8', width: 1.6, depth: 1.5, inventoryCount: 100 }, visible: true },
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default chair configurations loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    } else if (kind === 'wall_style') {
      const defaults = [
        { name: 'Drywall Standard White', spec: { thickness: 4, height: 8, color: '#FFFFFF', texture: 'drywall', enabled: true }, visible: true },
        { name: 'Rustic Brick Altar', spec: { thickness: 12, height: 10, color: '#B22222', texture: 'brick', enabled: true }, visible: true },
        { name: 'Wood Partition Panel', spec: { thickness: 2, height: 6, color: '#8B5A2B', texture: 'wood', enabled: true }, visible: true },
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default wall style configurations loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    } else if (kind === 'linen') {
      const defaults = [
        { name: 'Classic White Polyester', spec: { type: 'tablecloth', material: 'polyester', color: '#FFFFFF', dropLength: 30, enabled: true }, visible: true },
        { name: 'Romantic Blush Satin', spec: { type: 'runner', material: 'satin', color: '#FFC0CB', dropLength: 12, enabled: true }, visible: true },
        { name: 'Moody Burgundy Velvet', spec: { type: 'overlay', material: 'velvet', color: '#800020', dropLength: 18, enabled: true }, visible: true },
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default linen style configurations loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    } else if (kind === 'guideline') {
      const defaults = [
        { name: 'ADA Wheelchair Buffer', spec: { bufferWidth: 5, severity: 'info', desc: 'ADA compliance spacing clearance for seating and wall buffers.' }, visible: true },
        { name: 'Emergency Exit Corridor', spec: { bufferWidth: 6, severity: 'danger', desc: 'Critical regulatory egress clearance for doorways and corridor pathways.' }, visible: true },
        { name: 'Fire Flame Safety Ring', spec: { bufferWidth: 3, severity: 'warning', desc: 'Safety buffer ring around open fire pits, sterno pans, or active candles.' }, visible: true },
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default safety & regulatory guidelines loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    } else if (kind === 'spacing') {
      const defaults = [
        { name: 'Spacious Dining Setup', spec: { rowSpacing: 6.0, seatSpacing: 1.8, minClearance: 4.5, seatingGapRule: 'extra-wide', tableToTableClearance: 5.0, code: 'dining-lux', enabled: true }, visible: true },
        { name: 'Traditional Ceremony Spacing', spec: { rowSpacing: 4.5, seatSpacing: 1.2, minClearance: 3.0, seatingGapRule: 'standard', tableToTableClearance: 3.5, code: 'ceremony-standard', enabled: true }, visible: true },
        { name: 'Cozy Bistro Spacing', spec: { rowSpacing: 5.0, seatSpacing: 1.5, minClearance: 3.5, seatingGapRule: 'aisle-only', tableToTableClearance: 4.0, code: 'bistro-snug', enabled: true }, visible: true },
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default spacing configurations loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    } else if (kind === 'template') {
      const defaults = [
        {
          name: 'Grand Ballroom Banquet Setup',
          spec: {
            category: 'reception',
            targetCapacity: 150,
            description: 'Complete round table seated layout with a centralized 12x12 dance floor and high-fidelity catering buffers.',
            payload: '{"tables":[{"id":"t1","shape":"round","radius":30,"x":100,"y":100},{"id":"t2","shape":"round","radius":30,"x":250,"y":100}],"fixtures":[{"id":"f1","type":"dance_floor","width":144,"height":144,"x":175,"y":250}]}',
            enabled: true
          },
          visible: true
        },
        {
          name: 'Symmetrical Ceremony Row Seating',
          spec: {
            category: 'ceremony',
            targetCapacity: 200,
            description: 'Classic center-aisle seating configuration with front altar and custom floral arches.',
            payload: '{"chairs":[{"id":"c1","width":1.5,"depth":1.5,"x":80,"y":120},{"id":"c2","width":1.5,"depth":1.5,"x":120,"y":120}],"fixtures":[{"id":"f1","type":"arch","width":96,"height":36,"x":100,"y":50}]}',
            enabled: true
          },
          visible: true
        },
        {
          name: 'Cocktail Hour Mixer Layout',
          spec: {
            category: 'cocktail',
            targetCapacity: 100,
            description: 'Spacious high-top bar tables with dual catering beverage stations and auxiliary lounge staging.',
            payload: '{"tables":[{"id":"t1","shape":"round","radius":18,"x":120,"y":100}],"fixtures":[{"id":"f1","type":"bar","width":96,"height":36,"x":100,"y":50}]}',
            enabled: true
          },
          visible: true
        }
      ];
      setLocalItems(defaults as any);
      setHasChanges(true);
      toast({ title: 'Default pre-cooked layout templates loaded', description: 'Click Save Presets below to persist.', variant: 'success' });
    }
  };

  const handleQuickAdd = (presetType: string) => {
    let newPresets: any[] = [];
    if (kind === 'table') {
      if (presetType === 'round') {
        newPresets = [
          { name: '60" Round (8)', spec: { shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 50 }, visible: true },
          { name: '48" Round (6)', spec: { shape: 'round', radius: 24, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 30 }, visible: true },
        ];
      } else if (presetType === 'rectangle') {
        newPresets = [
          { name: '6ft Banquet (6)', spec: { shape: 'rect', width: 72, height: 30, capacity: 6, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 40 }, visible: true },
          { name: '8ft Banquet (8)', spec: { shape: 'rect', width: 96, height: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true, inventoryCount: 30 }, visible: true },
        ];
      }
    } else if (kind === 'chair') {
      if (presetType === 'chiavari') {
        newPresets = [
          { name: 'Chiavari Gold', spec: { radius: 9, icon: '👑', color: '#D4AF37', width: 1.4, depth: 1.4, inventoryCount: 200 }, visible: true },
          { name: 'Chiavari Silver', spec: { radius: 9, icon: '🪑', color: '#C0C0C0', width: 1.4, depth: 1.4, inventoryCount: 150 }, visible: true },
        ];
      } else if (presetType === 'ghost') {
        newPresets = [
          { name: 'Ghost Acrylic', spec: { radius: 10, icon: '💎', color: '#E8E8E8', width: 1.6, depth: 1.5, inventoryCount: 100 }, visible: true },
        ];
      }
    } else if (kind === 'fixture') {
      newPresets = [
        { name: '12x12 Dance Floor', spec: { type: 'dance_floor', width: 144, height: 144, color: '#8F4F4F' }, visible: true },
        { name: 'Full Catering Bar', spec: { type: 'bar', width: 96, height: 36, color: '#C0C0C0' }, visible: true },
      ];
    } else if (kind === 'wall_style') {
      newPresets = [
        { name: 'Wood Lattice Panel', spec: { thickness: 2, height: 8, color: '#D2B48C', texture: 'wood', enabled: true }, visible: true },
        { name: 'Solid Divider Wall', spec: { thickness: 4, height: 10, color: '#FFFFFF', texture: 'drywall', enabled: true }, visible: true },
      ];
    } else if (kind === 'linen') {
      newPresets = [
        { name: 'Burgundy Table Runner', spec: { type: 'runner', material: 'velvet', color: '#800020', dropLength: 12, enabled: true }, visible: true },
        { name: 'Ivory Polyester Cloth', spec: { type: 'tablecloth', material: 'polyester', color: '#FFFFF0', dropLength: 30, enabled: true }, visible: true },
      ];
    } else if (kind === 'guideline') {
      if (presetType === 'ada') {
        newPresets = [
          { name: 'ADA Seating Gap', spec: { bufferWidth: 4, severity: 'info', desc: 'Clear space for wheelchair access' }, visible: true },
        ];
      } else if (presetType === 'clearance') {
        newPresets = [
          { name: 'Main Exit Path Buffer', spec: { bufferWidth: 6, severity: 'danger', desc: 'Keep entirely free of chairs/decor' }, visible: true },
        ];
      } else {
        newPresets = [
          { name: 'Fire Safety Ring', spec: { bufferWidth: 3, severity: 'warning', desc: 'Safety buffer zone around live candles or open flames' }, visible: true },
        ];
      }
    } else if (kind === 'spacing') {
      if (presetType === 'luxury') {
        newPresets = [
          { name: 'Spacious Luxury Dining', spec: { rowSpacing: 6.0, seatSpacing: 1.8, minClearance: 4.5, seatingGapRule: 'extra-wide', tableToTableClearance: 5.0, code: 'dining-lux', enabled: true }, visible: true },
        ];
      } else if (presetType === 'ceremony') {
        newPresets = [
          { name: 'Ceremony Seating Offset', spec: { rowSpacing: 4.5, seatSpacing: 1.2, minClearance: 3.0, seatingGapRule: 'standard', tableToTableClearance: 3.5, code: 'ceremony-standard', enabled: true }, visible: true },
        ];
      } else {
        newPresets = [
          { name: 'Bistro Snug Spacing', spec: { rowSpacing: 5.0, seatSpacing: 1.5, minClearance: 3.5, seatingGapRule: 'aisle-only', tableToTableClearance: 4.0, code: 'bistro-snug', enabled: true }, visible: true },
        ];
      }
    } else if (kind === 'template') {
      if (presetType === 'reception') {
        newPresets = [
          {
            name: 'Seated Reception Banquet',
            spec: {
              category: 'reception',
              targetCapacity: 150,
              description: 'Round table banquet seating layout with central staging.',
              payload: '{"tables":[], "fixtures":[]}',
              enabled: true
            },
            visible: true
          }
        ];
      } else if (presetType === 'ceremony') {
        newPresets = [
          {
            name: 'Symmetrical Row Ceremony',
            spec: {
              category: 'ceremony',
              targetCapacity: 200,
              description: 'Symmetrical theater style row layout with main center-aisle.',
              payload: '{"chairs":[], "fixtures":[]}',
              enabled: true
            },
            visible: true
          }
        ];
      } else {
        newPresets = [
          {
            name: 'Cocktail Hour Mixer',
            spec: {
              category: 'cocktail',
              targetCapacity: 100,
              description: 'High-top bistro tables and dual perimeter bar stations.',
              payload: '{"tables":[], "fixtures":[]}',
              enabled: true
            },
            visible: true
          }
        ];
      }
    }

    if (newPresets.length > 0) {
      setLocalItems([...localItems, ...newPresets] as any);
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

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Quick Add Presets Panel */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Quick-Add Presets &amp; Defaults
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly inject industry-standard floorplan configurations into your catalog.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === 'table' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('round')}>⭕ Round Tables</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('rectangle')}>⬜ Rectangle Tables</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Table Defaults</Button>
            </>
          )}
          {kind === 'chair' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('chiavari')}>👑 Chiavari Styles</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('ghost')}>💎 Ghost Collection</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Chair Defaults</Button>
            </>
          )}
          {kind === 'wall_style' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('wall_style')}>🧱 Partition Walls</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Wall Defaults</Button>
            </>
          )}
          {kind === 'linen' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('linen')}>🧵 Tablecloths &amp; Runners</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Linen Defaults</Button>
            </>
          )}
          {kind === 'fixture' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('fixture')}>📦 Stage & Dance Floors</Button>}
          {kind === 'guideline' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('guideline')}>🚒 Fire Safety Ring</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('ada')}>♿ ADA Spacing Buffer Rules</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('clearance')}>🚨 Regulatory Clearances</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Guideline Defaults</Button>
            </>
          )}
          {kind === 'spacing' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('luxury')}>📐 Spacious Luxury</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('ceremony')}>💒 Ceremony Seating</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('bistro')}>☕ Bistro Cafe Style</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Spacing Defaults</Button>
            </>
          )}
          {kind === 'template' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('reception')}>🎉 Banquet Reception</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('ceremony')}>💒 Row Ceremony</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('cocktail')}>🍸 Cocktail Mixer</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Template Defaults</Button>
            </>
          )}
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
              <div key={i} className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-border/80 hover:border-brand/40 transition-colors shadow-sm">
                
                {/* Embedded SVG Visual Preview */}
                {kind === 'table' && renderShapePreview(spec.shape || 'round', spec.color || '#E8E0D0', spec.capacity || 8)}
                {kind === 'chair' && (
                  <div className="h-16 w-16 rounded-lg border border-border flex flex-col items-center justify-center text-2xl relative shadow-sm overflow-hidden shrink-0" style={{ backgroundColor: spec.color || '#D4AF37' }}>
                    <span className="mb-1">{spec.icon || '🪑'}</span>
                    <span className="text-[8px] absolute bottom-1 font-bold tracking-tight text-white/95 uppercase bg-black/25 px-1.5 rounded-full">{spec.inventoryCount || 100}</span>
                  </div>
                )}
                {kind === 'fixture' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex items-center justify-center relative shadow-sm overflow-hidden" style={{ backgroundColor: spec.color || '#8C52FF' }}>
                    <span className="text-[10px] font-bold text-white tracking-wide capitalize">{spec.type || 'stage'}</span>
                  </div>
                )}
                {kind === 'wall_style' && (
                  <div className="h-16 w-16 bg-[#FDFBF7] rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden shrink-0" style={{ borderLeft: `5px solid ${spec.color || '#999999'}` }}>
                     <span className="text-2xl">🧱</span>
                     <span className="text-[8px] absolute bottom-0.5 capitalize text-fg-subtle font-bold tracking-tight">{spec.texture || 'plaster'}</span>
                  </div>
                )}
                {kind === 'linen' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden shrink-0" style={{ borderLeft: `5px solid ${spec.color || '#FFFFFF'}` }}>
                    <span className="text-2xl">🧵</span>
                    <span className="text-[8px] absolute bottom-0.5 capitalize text-fg-subtle font-bold tracking-tight">{spec.type || 'cloth'}</span>
                  </div>
                )}
                {kind === 'guideline' && (
                  <div className={[
                    "h-16 w-16 rounded-lg border flex flex-col items-center justify-center relative shadow-sm overflow-hidden shrink-0 transition-colors",
                    spec.severity === 'danger' ? 'bg-red-50/80 border-red-200 text-red-700' :
                    spec.severity === 'warning' ? 'bg-amber-50/80 border-amber-200 text-amber-700' :
                    'bg-blue-50/80 border-blue-200 text-blue-700'
                  ].join(' ')}>
                    <span className="text-2xl">
                      {spec.severity === 'danger' ? '🚨' :
                       spec.severity === 'warning' ? '⚠️' :
                       '♿'}
                    </span>
                    <span className="text-[9px] font-bold tracking-tight absolute bottom-1 uppercase">
                      {spec.bufferWidth || 5}ft
                    </span>
                  </div>
                )}
                {kind === 'spacing' && (
                  <div className="h-16 w-16 bg-[#FDFBF7] rounded-lg border border-border/80 flex flex-col items-center justify-center relative shadow-sm overflow-hidden shrink-0">
                    <div className="grid grid-cols-3 gap-1.5 opacity-60 p-1">
                      <div className="w-2.5 h-2.5 rounded bg-brand-soft border border-brand/20" />
                      <div className="w-2.5 h-2.5 rounded bg-brand-soft border border-brand/20" />
                      <div className="w-2.5 h-2.5 rounded bg-brand-soft border border-brand/20" />
                      <div className="w-2.5 h-2.5 rounded bg-brand-soft border border-brand/20" />
                      <div className="w-2.5 h-2.5 rounded bg-brand-soft border border-brand/20" />
                      <div className="w-2.5 h-2.5 rounded bg-brand-soft border border-brand/20" />
                    </div>
                    <span className="text-[8px] font-bold tracking-tight absolute bottom-0.5 text-brand bg-brand-soft/30 px-1 rounded-full">
                      {spec.rowSpacing || 6}×{spec.seatSpacing || 1.5}ft
                    </span>
                  </div>
                )}
                {kind === 'template' && (
                  <div className="h-16 w-16 bg-surface-2 rounded-lg border border-border flex flex-col items-center justify-center relative shadow-sm overflow-hidden">
                    <span className="text-xl">📋</span>
                    <span className="text-[8px] absolute bottom-1 font-bold text-fg-subtle capitalize">{spec.category || 'reception'}</span>
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="Preset Name"
                        value={item.name}
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        className="h-9 text-xs font-semibold"
                      />
                    </div>
                    
                    {/* Quick duplicate button */}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        const duplicate = {
                          ...item,
                          id: `dup-${Date.now()}`,
                          name: `${item.name} (Copy)`
                        };
                        setLocalItems([...localItems, duplicate] as any);
                        setHasChanges(true);
                        toast({ title: 'Configuration duplicated successfully' });
                      }}
                      className="text-xs text-brand bg-brand-soft/20 hover:bg-brand-soft/40 font-bold"
                    >
                      Duplicate
                    </Button>

                    <Button variant="ghost" size="icon" className="h-9 w-9 text-danger hover:bg-danger/10 shrink-0" onClick={() => removeRow(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Sub-form inputs dynamically compiled based on catalog kinds */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-border/40 font-semibold">
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
                        
                        {spec.shape === 'round' ? (
                          <div>
                            <Label className="text-[10px] text-fg-subtle">Diameter (in)</Label>
                            <Input
                              type="number"
                              value={spec.radius ? spec.radius * 2 : 60}
                              onChange={(e) => updateSpec(i, 'radius', parseInt(e.target.value) / 2)}
                              className="h-9 mt-1 text-xs"
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <Label className="text-[10px] text-fg-subtle">Width (in)</Label>
                              <Input
                                type="number"
                                value={spec.width || 72}
                                onChange={(e) => updateSpec(i, 'width', parseInt(e.target.value))}
                                className="h-9 mt-1 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-fg-subtle">Length/Height (in)</Label>
                              <Input
                                type="number"
                                value={spec.height || 30}
                                onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))}
                                className="h-9 mt-1 text-xs"
                              />
                            </div>
                          </>
                        )}

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
                          <Label className="text-[10px] text-fg-subtle">Inventory Stock Count</Label>
                          <Input
                            type="number"
                            value={spec.inventoryCount || 50}
                            onChange={(e) => updateSpec(i, 'inventoryCount', parseInt(e.target.value))}
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
                            className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
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
                          <Label className="text-[10px] text-fg-subtle">Inventory Stock Count</Label>
                          <Input
                            type="number"
                            value={spec.inventoryCount || 100}
                            onChange={(e) => updateSpec(i, 'inventoryCount', parseInt(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input
                            type="text"
                            value={spec.color || '#D4AF37'}
                            onChange={(e) => updateSpec(i, 'color', e.target.value)}
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

                        <div className="col-span-2 flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id={`wall-enabled-${i}`}
                            checked={spec.enabled ?? true}
                            onChange={(e) => updateSpec(i, 'enabled', e.target.checked)}
                            className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
                          />
                          <Label htmlFor={`wall-enabled-${i}`} className="text-[11px] cursor-pointer text-fg-subtle">
                             Enable Wall Style in Workspace
                          </Label>
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

                        {/* Linen Style Enabled checkbox (Step 11 full parity) */}
                        <div className="col-span-2 flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id={`linen-enabled-${i}`}
                            checked={spec.enabled ?? true}
                            onChange={(e) => updateSpec(i, 'enabled', e.target.checked)}
                            className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
                          />
                          <Label htmlFor={`linen-enabled-${i}`} className="text-[11px] cursor-pointer text-fg-subtle">
                             Enable Linen Option in Workspace
                          </Label>
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
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Buffer Highlight Color</Label>
                          <Input
                            type="text"
                            placeholder={spec.severity === 'danger' ? '#ef4444' : spec.severity === 'warning' ? '#f59e0b' : '#3b82f6'}
                            value={spec.color || ''}
                            onChange={(e) => updateSpec(i, 'color', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Regulatory Description</Label>
                          <Input
                            type="text"
                            value={spec.desc || ''}
                            onChange={(e) => updateSpec(i, 'desc', e.target.value)}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>

                        {/* Guideline Active/Enabled checkbox (Step 12 parity) */}
                        <div className="col-span-2 flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id={`guideline-enabled-${i}`}
                            checked={spec.enabled ?? true}
                            onChange={(e) => updateSpec(i, 'enabled', e.target.checked)}
                            className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
                          />
                          <Label htmlFor={`guideline-enabled-${i}`} className="text-[11px] cursor-pointer text-fg-subtle">
                             Enable Guideline &amp; Clearance Checks on Canvas
                          </Label>
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
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Seating Gap Rule</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.seatingGapRule || 'standard'}
                            onChange={(e) => updateSpec(i, 'seatingGapRule', e.target.value)}
                          >
                            <option value="standard">Standard Seating Gap</option>
                            <option value="extra-wide">Extra-Wide Access</option>
                            <option value="aisle-only">Aisle Only Clearances</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Table Clearance Offset (ft)</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={spec.tableToTableClearance || 4.0}
                            onChange={(e) => updateSpec(i, 'tableToTableClearance', parseFloat(e.target.value))}
                            className="h-9 mt-1 text-xs"
                          />
                        </div>

                        {/* Spacing Constraints active checkbox */}
                        <div className="col-span-2 flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id={`spacing-enabled-${i}`}
                            checked={spec.enabled ?? true}
                            onChange={(e) => updateSpec(i, 'enabled', e.target.checked)}
                            className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
                          />
                          <Label htmlFor={`spacing-enabled-${i}`} className="text-[11px] cursor-pointer text-fg-subtle">
                             Enable Spacing &amp; Clearance Constraints Checking
                          </Label>
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

// ─── 3. Venue Manager with Environment & Local Photos ──
export function VenueManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newVenueName, setNewVenueName] = useState('');
  const [capacity, setCapacity] = useState(150);
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(40);
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor' | 'both'>('indoor');
  
  const [venueCategory, setVenueCategory] = useState<'reception' | 'ceremony' | 'cocktail' | 'lodging' | 'other'>('reception');
  const [floorPattern, setFloorPattern] = useState<'wood' | 'concrete' | 'grass' | 'carpet' | 'tile'>('wood');
  const [canvasWidth, setCanvasWidth] = useState<number>(140);
  const [canvasHeight, setCanvasHeight] = useState<number>(120);
  const [isMasterSpace, setIsMasterSpace] = useState<boolean>(true);

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

  const handleLoadPreset = (presetType: 'reception' | 'cocktail' | 'ceremony' | 'lodging') => {
    if (presetType === 'reception') {
      setNewVenueName('Reception Venue'); setCapacity(150); setWidth(60); setHeight(40);
      setEnvironment('indoor'); setVenueCategory('reception'); setFloorPattern('wood');
      setCanvasWidth(140); setCanvasHeight(120); setIsMasterSpace(true);
    } else if (presetType === 'cocktail') {
      setNewVenueName('Cocktail Hour Venue'); setCapacity(75); setWidth(40); setHeight(30);
      setEnvironment('both'); setVenueCategory('cocktail'); setFloorPattern('concrete');
      setCanvasWidth(100); setCanvasHeight(90); setIsMasterSpace(true);
    } else if (presetType === 'ceremony') {
      setNewVenueName('Ceremony Venue'); setCapacity(200); setWidth(80); setHeight(60);
      setEnvironment('outdoor'); setVenueCategory('ceremony'); setFloorPattern('grass');
      setCanvasWidth(160); setCanvasHeight(140); setIsMasterSpace(true);
    } else if (presetType === 'lodging') {
      setNewVenueName('Lodging Cabin Venue'); setCapacity(12); setWidth(50); setHeight(30);
      setEnvironment('both'); setVenueCategory('lodging'); setFloorPattern('wood');
      setCanvasWidth(110); setCanvasHeight(90); setIsMasterSpace(false);
    }
    toast({ title: 'Venue preset parameters loaded successfully' });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      sdk.venues.create(orgId, {
        name: newVenueName,
        capacity,
        width,
        height,
        environment,
        category: venueCategory,
        style: {
          photo: venuePhoto || undefined,
          pattern: floorPattern,
          canvasWidth,
          canvasHeight,
          isMaster: isMasterSpace
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      setNewVenueName('');
      setVenuePhoto(null);
      toast({ title: 'Venue space created successfully', variant: 'success' });
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
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Venue Presets
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly load typical venue space presets with corresponding dimensions and layouts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('reception')}>🎉 Reception</Button>
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('cocktail')}>🍸 Cocktail Hour</Button>
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('ceremony')}>💒 Ceremony</Button>
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('lodging')}>🏡 Lodging Cabin</Button>
        </div>
      </div>

      <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4 font-semibold">
        <h4 className="text-xs font-bold text-fg font-serif">Add New Venue Workspace</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
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
            <Label htmlFor="venue-cat" className="text-[10px]">Venue Category</Label>
            <select
              id="venue-cat"
              value={venueCategory}
              onChange={(e) => setVenueCategory(e.target.value as any)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
            >
              <option value="reception">Reception / Banquet</option>
              <option value="ceremony">Ceremony / Row seating</option>
              <option value="cocktail">Cocktail Hour</option>
              <option value="lodging">Lodging Accommodations</option>
              <option value="other">Other space</option>
            </select>
          </div>
          <div>
            <Label htmlFor="venue-pat" className="text-[10px]">Floor pattern</Label>
            <select
              id="venue-pat"
              value={floorPattern}
              onChange={(e) => setFloorPattern(e.target.value as any)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
            >
              <option value="wood">🪓 Hardwood Plank</option>
              <option value="concrete">🧱 Raw Concrete</option>
              <option value="grass">🌿 Outdoor Grass / Lawn</option>
              <option value="carpet">🧶 Luxury Carpet</option>
              <option value="tile">🔲 Ceramic Tile</option>
            </select>
          </div>
          <div>
            <Label htmlFor="venue-w" className="text-[10px]">Width (ft)</Label>
            <Input id="venue-w" type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>
          <div>
            <Label htmlFor="venue-h" className="text-[10px]">Length / Height (ft)</Label>
            <Input id="venue-h" type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>

          <div>
            <Label htmlFor="venue-cw" className="text-[10px]">Canvas Envelope Width (ft)</Label>
            <Input id="venue-cw" type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>
          <div>
            <Label htmlFor="venue-ch" className="text-[10px]">Canvas Envelope Height (ft)</Label>
            <Input id="venue-ch" type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>

          <div className="col-span-2 flex items-center gap-2 mt-4">
             <input
               type="checkbox"
               id="venue-master"
               checked={isMasterSpace}
               onChange={(e) => setIsMasterSpace(e.target.checked)}
               className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
             />
             <Label htmlFor="venue-master" className="text-xs cursor-pointer text-fg-subtle">Set as organization primary master layout space</Label>
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

        <Button onClick={() => createMutation.mutate()} disabled={!newVenueName.trim() || createMutation.isPending} className="w-full h-10 font-bold">
          Create Venue
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {venues.length === 0 ? (
          <div className="col-span-2 text-center text-xs text-fg-muted py-8 border border-dashed rounded-lg bg-surface-2/20">No venues added yet.</div>
        ) : (
          venues.map((v: any) => {
            const style = typeof v.style === 'string' ? JSON.parse(v.style || '{}') : (v.style || {});
            return (
              <Card key={v.id} className="p-3.5 flex items-center justify-between border-border bg-[#FDFBF7] shadow-sm">
                <div className="flex items-center gap-3">
                  {style.photo ? (
                    <img src={style.photo} alt={v.name} className="h-12 w-12 object-cover rounded-md border border-border shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle shadow-sm">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
                       {v.name}
                       {style.isMaster && <Badge variant="warning" className="text-[8px] uppercase px-1 py-0 font-bold">Master</Badge>}
                    </h4>
                    <p className="text-[10px] text-fg-subtle mt-0.5 capitalize">
                      {v.width}ft × {v.height}ft · {v.capacity} guests · {v.environment} · {style.pattern || 'wood'} floor
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                   {/* Quick duplicate button (Step 9 full parity) */}
                   <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        sdk.venues.create(orgId, {
                           name: `${v.name} (Copy)`,
                           capacity: v.capacity,
                           width: v.width,
                           height: v.height,
                           environment: v.environment,
                           category: v.category,
                           style
                        }).then(() => {
                           qc.invalidateQueries({ queryKey: ['venues', orgId] });
                           toast({ title: 'Venue space duplicated successfully' });
                        });
                      }}
                      className="h-8 w-8 text-brand hover:bg-brand-soft/30 rounded"
                      title="Duplicate"
                   >
                      <Plus className="h-3.5 w-3.5" />
                   </Button>

                   <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10" onClick={() => { if (window.confirm(`Delete ${v.name}? Deletion is blocked while event layouts reference this space.`)) deleteMutation.mutate(v.id); }}>
                     <Trash2 className="w-4 h-4" />
                   </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Decor Manager with Image Upload ───────────────────────────────────────
export function DecorManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  // Tabs: 'items' | 'categories'
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'categories'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Item form state
  const [newItemName, setNewItemName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [inventoryStock, setInventoryStock] = useState(10);
  const [decorColor, setDecorColor] = useState('#FFFFFF');
  const [visible, setVisible] = useState(true);
  const [decorPhoto, setDecorPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🌸');

  // Load Categories & Items
  const { data: categoriesData, isLoading: isLoadingCats } = useQuery({
    queryKey: ['decor-categories', orgId],
    queryFn: () => sdk.decor.listCategories(orgId),
  });

  const { data: decorData, isLoading: isLoadingItems } = useQuery({
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

  const createItemMutation = useMutation({
    mutationFn: () =>
      sdk.decor.createItem(orgId, {
        categoryId: categoryId || undefined,
        name: newItemName,
        imagePath: decorPhoto || undefined,
        visible,
        spec: {
          stock: inventoryStock,
          color: decorColor,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      setNewItemName('');
      setCategoryId('');
      setInventoryStock(10);
      setDecorColor('#FFFFFF');
      setDecorPhoto(null);
      toast({ title: 'Decor item added successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed to add decor', description: e.message, variant: 'destructive' }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: () =>
      sdk.decor.createCategory(orgId, {
        name: newCatName,
        icon: newCatIcon,
        sortOrder: (categoriesData?.categories?.length || 0) + 1,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-categories', orgId] });
      setNewCatName('');
      setNewCatIcon('🌸');
      toast({ title: 'Category created successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed to create category', description: e.message, variant: 'destructive' }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => sdk.decor.deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      toast({ title: 'Decor item deleted successfully', variant: 'success' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => sdk.decor.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-categories', orgId] });
      toast({ title: 'Category deleted successfully', variant: 'success' });
    },
  });

  const handleLoadDefaults = async () => {
    try {
      // 1. Create standard categories first
      const cat1 = await sdk.decor.createCategory(orgId, { name: 'Floral Arrangements', icon: '🌸', sortOrder: 1 });
      const cat2 = await sdk.decor.createCategory(orgId, { name: 'Lighting & Ambience', icon: '✨', sortOrder: 2 });
      const cat3 = await sdk.decor.createCategory(orgId, { name: 'Table Centerpieces', icon: '🕯️', sortOrder: 3 });

      // 2. Create items under those categories
      await sdk.decor.createItem(orgId, {
        categoryId: cat1.category.id,
        name: 'Romantic Cherry Blossom Arch',
        visible: true,
        spec: { stock: 5, color: '#FFB7C5' },
      });
      await sdk.decor.createItem(orgId, {
        categoryId: cat2.category.id,
        name: 'Fairy String Light Canopy',
        visible: true,
        spec: { stock: 12, color: '#FFF3CD' },
      });
      await sdk.decor.createItem(orgId, {
        categoryId: cat3.category.id,
        name: 'Luxury Tall Gold Candelabra',
        visible: true,
        spec: { stock: 40, color: '#D4AF37' },
      });

      qc.invalidateQueries({ queryKey: ['decor-categories', orgId] });
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      toast({ title: 'Default floral package and decor categories loaded', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Failed to load defaults', description: e.message, variant: 'destructive' });
    }
  };

  const handleQuickAdd = async (presetType: string) => {
    try {
      let payload: any = {};
      if (presetType === 'floral') {
        payload = { name: 'Eucalyptus Garland Table Runner', visible: true, spec: { stock: 60, color: '#556B2F' } };
      } else if (presetType === 'lighting') {
        payload = { name: 'Edison Bulb Suspension Drops', visible: true, spec: { stock: 15, color: '#FFD700' } };
      } else {
        payload = { name: 'Geometric Gold Terrarium Centerpiece', visible: true, spec: { stock: 30, color: '#FFD700' } };
      }
      await sdk.decor.createItem(orgId, payload);
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      toast({ title: 'Decor preset added successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Failed to quick add preset', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoadingCats || isLoadingItems) return <Skeleton className="h-32 w-full rounded-lg" />;

  const categories = categoriesData?.categories ?? [];
  const items = decorData?.items ?? [];

  const filteredItems = items.filter((it: any) => {
    const matchesSearch = it.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter ? it.category_id === selectedCategoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Tab Segment Selector */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveSubTab('items')}
          className={[
            'pb-2 px-4 text-xs font-bold transition-all border-b-2',
            activeSubTab === 'items' ? 'border-brand text-brand' : 'border-transparent text-fg-subtle hover:text-fg',
          ].join(' ')}
        >
          🌸 Decor Inventory Items
        </button>
        <button
          onClick={() => setActiveSubTab('categories')}
          className={[
            'pb-2 px-4 text-xs font-bold transition-all border-b-2',
            activeSubTab === 'categories' ? 'border-brand text-brand' : 'border-transparent text-fg-subtle hover:text-fg',
          ].join(' ')}
        >
          📁 Categories Studio
        </button>
      </div>

      {activeSubTab === 'items' ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Quick Add Presets Panel */}
          <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
                <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Quick-Add Presets &amp; Defaults
              </h4>
              <p className="text-[10px] text-fg-subtle">Instantly load typical floral design arrangements and decor styles.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('floral')}>🌸 Floral Runners</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('lighting')}>✨ Edison Bulbs</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('centerpiece')}>🕯️ Terrariums</Button>
              <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Decor Defaults</Button>
            </div>
          </div>

          {/* Add Decor Item Form */}
          <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4 font-semibold">
            <h4 className="text-xs font-bold text-fg font-serif">Add New Decor Item</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-2">
                <Label htmlFor="decor-name" className="text-[10px]">Decor Name</Label>
                <Input
                  id="decor-name"
                  placeholder="Flower Arch, Tall Centerpieces..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="decor-cat-select" className="text-[10px]">Category Mapping</Label>
                <select
                  id="decor-cat-select"
                  className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">No Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.icon || '🌸'} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="decor-stock" className="text-[10px]">In Stock Inventory</Label>
                <Input
                  id="decor-stock"
                  type="number"
                  value={inventoryStock}
                  onChange={(e) => setInventoryStock(parseInt(e.target.value))}
                  className="h-9 mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="decor-color" className="text-[10px]">Decor Color Hex</Label>
                <Input
                  id="decor-color"
                  type="text"
                  value={decorColor}
                  onChange={(e) => setDecorColor(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>

              <div className="col-span-2 flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="decor-visible"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
                />
                <Label htmlFor="decor-visible" className="text-xs cursor-pointer text-fg-subtle">
                  Visible &amp; Selectable on workspace design canvas
                </Label>
              </div>
            </div>

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

            <Button
              onClick={() => createItemMutation.mutate()}
              disabled={!newItemName.trim() || createItemMutation.isPending}
              className="w-full h-10 font-bold mt-2"
            >
              Add Decor Item
            </Button>
          </div>

          {/* Search and Filters bar */}
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <Input
                placeholder="🔍 Search decor inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <select
                className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || '🌸'} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Decor Cards Listing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {filteredItems.length === 0 ? (
              <div className="col-span-2 text-center text-xs text-fg-muted py-10 border border-dashed rounded-lg bg-surface-2/20">
                No matching decor items found.
              </div>
            ) : (
              filteredItems.map((it: any) => {
                const spec = typeof it.spec === 'string' ? JSON.parse(it.spec || '{}') : (it.spec || {});
                const mappedCategory = categories.find((c: any) => c.id === it.category_id);
                return (
                  <Card key={it.id} className="border border-border p-3.5 flex items-center justify-between gap-3 bg-[#FDFBF7] shadow-sm">
                    <div className="flex items-center gap-3">
                      {it.image_path ? (
                        <img src={it.image_path} alt={it.name} className="h-12 w-12 object-cover rounded-md border border-border shadow-sm" />
                      ) : (
                        <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle shadow-sm" style={{ borderLeft: `4px solid ${spec.color || '#FFFFFF'}` }}>
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
                          {it.name}
                          {!it.visible && <Badge variant="outline" className="text-[7px] uppercase px-1 py-0">Hidden</Badge>}
                        </h4>
                        <p className="text-[10px] text-fg-subtle mt-0.5">
                          {mappedCategory ? `${mappedCategory.icon || '🌸'} ${mappedCategory.name}` : 'Uncategorized'} · Stock: <span className="font-bold">{spec.stock ?? 10}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Quick duplicator */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          sdk.decor.createItem(orgId, {
                            categoryId: it.category_id || undefined,
                            name: `${it.name} (Copy)`,
                            imagePath: it.image_path || undefined,
                            visible: it.visible,
                            spec
                          }).then(() => {
                            qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
                            toast({ title: 'Decor entry duplicated successfully' });
                          });
                        }}
                        className="h-8 w-8 text-brand hover:bg-brand-soft/30 rounded"
                        title="Duplicate Entry"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-danger hover:bg-danger/10"
                        onClick={() => { if (window.confirm(`Delete ${it.name}? This decor item cannot be restored.`)) deleteItemMutation.mutate(it.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Categories Studio Tab */
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4 font-semibold">
            <h4 className="text-xs font-bold text-fg font-serif">Add New Category</h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="col-span-2">
                <Label htmlFor="cat-name" className="text-[10px]">Category Name</Label>
                <Input
                  id="cat-name"
                  placeholder="Floral Arrangements, Table Linens, Tableware..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="cat-icon" className="text-[10px]">Category Icon / Emoji</Label>
                <Input
                  id="cat-icon"
                  placeholder="🌸"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>
            </div>
            <Button
              onClick={() => createCategoryMutation.mutate()}
              disabled={!newCatName.trim() || createCategoryMutation.isPending}
              className="w-full h-10 font-bold"
            >
              Create Category
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {categories.length === 0 ? (
              <div className="col-span-2 text-center text-xs text-fg-muted py-8 border border-dashed rounded-lg bg-surface-2/20">
                No custom decor categories configured yet.
              </div>
            ) : (
              categories.map((c: any) => (
                <Card key={c.id} className="border border-border p-3.5 flex items-center justify-between gap-3 bg-[#FDFBF7] shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.icon || '🌸'}</span>
                    <div>
                      <h4 className="text-xs font-bold text-fg font-serif">{c.name}</h4>
                      <p className="text-[9px] text-fg-subtle uppercase tracking-wider mt-0.5">Sort Order: {c.sort_order ?? 0}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-danger hover:bg-danger/10"
                    onClick={() => { if (window.confirm(`Delete ${c.name}? Decor items may need to be reassigned.`)) deleteCategoryMutation.mutate(c.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Branding Manager with Fonts, Welcomes, and Previews ─────────────────
export function BrandingManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState('Seven Paths Manor');
  const [supportEmail, setSupportEmail] = useState('hello@sevenpathsmanor.com');
  const [phone, setPhone] = useState('(555) 019-2831');
  const [webUrl, setWebUrl] = useState('https://sevenpathsmanor.com');
  const [location, setLocation] = useState('Anytown, USA');
  
  // Custom theme colors
  const [brandColor, setBrandColor] = useState('#800020');
  const [bgColor, setBgColor] = useState('#FDFBF7');
  const [headerTextColor, setHeaderTextColor] = useState('#FFFFFF');
  const [bodyTextColor, setBodyTextColor] = useState('#2C2A29');
  const [accentTextColor, setAccentTextColor] = useState('#800020');

  // Custom welcome screens
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome to our digital layout assistant.');
  const [welcomeSubMessage, setWelcomeSubMessage] = useState('Feel free to configure the floorplan specs.');
  const [welcomeLogoPhoto, setWelcomeLogoPhoto] = useState<string | null>(null);

  const [headingFont, setHeadingFont] = useState('Fraunces');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [logoPhoto, setLogoPhoto] = useState<string | null>(null);
  
  // Accordion Sections state
  const [activeSection, setActiveSection] = useState<string | null>('identity');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const welcomeInputRef = useRef<HTMLInputElement>(null);

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

  const handleWelcomeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setWelcomeLogoPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all branding settings to factory defaults?')) {
      setOrgName('Seven Paths Manor');
      setSupportEmail('hello@sevenpathsmanor.com');
      setPhone('(555) 019-2831');
      setWebUrl('https://sevenpathsmanor.com');
      setLocation('Anytown, USA');
      setBrandColor('#800020');
      setBgColor('#FDFBF7');
      setHeaderTextColor('#FFFFFF');
      setBodyTextColor('#2C2A29');
      setAccentTextColor('#800020');
      setWelcomeMessage('Welcome to our digital layout assistant.');
      setWelcomeSubMessage('Feel free to configure the floorplan specs.');
      setWelcomeLogoPhoto(null);
      setHeadingFont('Fraunces');
      setBodyFont('Inter');
      setLogoPhoto(null);
      toast({ title: 'Branding settings reset to factory defaults', variant: 'success' });
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
        bgColor,
        headerTextColor,
        bodyTextColor,
        accentTextColor,
        welcomeMessage,
        welcomeSubMessage,
        welcomeLogoPhoto,
        location
      }),
    onSuccess: () => {
      toast({ title: 'Venue branding saved successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to update branding details', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Accordion Configurations Form */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Section 1: Logo & Identity */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'identity' ? null : 'identity')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>🏷️ Logo &amp; Identity</span>
              {activeSection === 'identity' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'identity' && (
              <div className="p-4 space-y-4">
                <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex items-center justify-between">
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
                        <Button size="xs" variant="ghost" className="text-danger animate-pulse" onClick={() => setLogoPhoto(null)}>
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="org-name" className="text-[10px]">Organization Name</Label>
                  <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Website & Contacts */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'contact' ? null : 'contact')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>🌐 Website &amp; Contact</span>
              {activeSection === 'contact' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'contact' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="org-email" className="text-[10px]">Support Email</Label>
                    <Input id="org-email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="org-phone" className="text-[10px]">Telephone</Label>
                    <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="org-web" className="text-[10px]">Website URL</Label>
                    <Input id="org-web" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="org-loc" className="text-[10px]">Venue Location</Label>
                    <Input id="org-loc" value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Welcome Screen Customizer */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'welcome' ? null : 'welcome')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>👋 Welcome Screen Settings</span>
              {activeSection === 'welcome' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'welcome' && (
              <div className="p-4 space-y-4">
                <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-fg">Welcome Cover Photo</Label>
                    <p className="text-[10px] text-fg-subtle">PNG, JPG, or SVG base64 image</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={handleWelcomeUpload} ref={welcomeInputRef} className="hidden" />
                    <Button size="xs" variant="outline" onClick={() => welcomeInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {welcomeLogoPhoto ? 'Change Cover' : 'Upload Cover'}
                    </Button>
                    {welcomeLogoPhoto && (
                      <div className="flex items-center gap-2">
                        <img src={welcomeLogoPhoto} alt="Welcome Cover" className="h-10 w-10 object-cover rounded-md border border-border shadow-sm" />
                        <Button size="xs" variant="ghost" className="text-danger" onClick={() => setWelcomeLogoPhoto(null)}>
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="welcome-msg" className="text-[10px]">Welcome Message Header</Label>
                  <Input id="welcome-msg" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div>
                  <Label htmlFor="welcome-sub" className="text-[10px]">Welcome Sub-Message</Label>
                  <Input id="welcome-sub" value={welcomeSubMessage} onChange={(e) => setWelcomeSubMessage(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Color Scheme Palette */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'colors' ? null : 'colors')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>🎨 Color Theme &amp; Palettes</span>
              {activeSection === 'colors' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'colors' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold">
                  <div>
                    <Label className="text-[10px]">Brand Accent</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Background</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Header Text</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={headerTextColor} onChange={(e) => setHeaderTextColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={headerTextColor} onChange={(e) => setHeaderTextColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Body Text</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={bodyTextColor} onChange={(e) => setBodyTextColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={bodyTextColor} onChange={(e) => setBodyTextColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Accent Text</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={accentTextColor} onChange={(e) => setAccentTextColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={accentTextColor} onChange={(e) => setAccentTextColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Typography Advanced Selection */}
          <div className="rounded-xl border border-[#e1d5c9] bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'typography' ? null : 'typography')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>✍️ Advanced Typography &amp; Fonts</span>
              {activeSection === 'typography' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'typography' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <Label htmlFor="heading-font-sel">Heading Google Font</Label>
                    <select
                      id="heading-font-sel"
                      value={headingFont}
                      onChange={(e) => setHeadingFont(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1.5"
                    >
                      <option value="Fraunces">Fraunces (Editorial)</option>
                      <option value="Playfair Display">Playfair Display (Serif)</option>
                      <option value="Montserrat">Montserrat (Geometric)</option>
                      <option value="Cinzel">Cinzel (Classic)</option>
                      <option value="Poppins">Poppins (Clean)</option>
                      <option value="Noto Serif">Noto Serif (Classic)</option>
                      <option value="Georgia">Georgia (Traditional)</option>
                      <option value="Quicksand">Quicksand (Whimsical)</option>
                    </select>
                    <p className="text-[10px] text-fg-subtle mt-1" style={{ fontFamily: headingFont }}>Preview String: Seven Paths Manor</p>
                  </div>

                  <div>
                    <Label htmlFor="body-font-sel">Body Google Font</Label>
                    <select
                      id="body-font-sel"
                      value={bodyFont}
                      onChange={(e) => setBodyFont(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1.5"
                    >
                      <option value="Inter">Inter (Sans-Serif)</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Noto Serif">Noto Serif</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Quicksand">Quicksand (Whimsical)</option>
                      <option value="Poppins">Poppins</option>
                    </select>
                    <p className="text-[10px] text-fg-subtle mt-1" style={{ fontFamily: bodyFont }}>Preview String: The quick brown fox jumps.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
             <Button onClick={() => saveBrandingMutation.mutate()} className="flex-1 h-11 tracking-wider font-semibold text-xs">
               <Save className="h-4 w-4 mr-2" /> Save Branding Preferences
             </Button>
             <Button variant="outline" onClick={handleReset} className="h-11 font-semibold text-xs border-danger/20 text-danger hover:bg-danger/10">
               Reset Factory Defaults
             </Button>
          </div>
        </div>

        {/* 👁️ Right Panel: Fully Interactive Real-Time Live Brand Simulator */}
        <div className="lg:col-span-2 space-y-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5 font-serif">
             <Eye className="h-4 w-4 text-brand animate-pulse" /> Live Brand Simulator
          </Label>
          <div className="rounded-2xl border border-[#e1d5c9] bg-white shadow-md overflow-hidden min-h-[500px] flex flex-col justify-between" style={{ backgroundColor: bgColor }}>
            
            {/* Header Simulator */}
            <div className="p-4 text-white flex items-center gap-3" style={{ backgroundColor: brandColor, color: headerTextColor }}>
              {logoPhoto ? (
                <img src={logoPhoto} alt="Logo" className="h-8 w-8 object-contain rounded bg-white p-0.5" />
              ) : (
                <span className="text-2xl">💒</span>
              )}
              <div>
                <h4 className="font-bold text-xs" style={{ fontFamily: headingFont }}>{orgName}</h4>
                <p className="text-[9px] opacity-90" style={{ fontFamily: bodyFont }}>Where every detail is intentional.</p>
              </div>
            </div>

            {/* Welcome Cover Photo Simulator */}
            {welcomeLogoPhoto ? (
              <div className="h-44 w-full relative overflow-hidden">
                <img src={welcomeLogoPhoto} alt="Welcome Cover" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                   <span className="text-white text-xs font-serif italic tracking-wide">Premium Venue Layouts</span>
                </div>
              </div>
            ) : (
              <div className="h-32 bg-surface-2 border-b border-border flex items-center justify-center text-xs text-fg-subtle italic">
                 No welcome cover cover uploaded. Add one in the Settings panel!
              </div>
            )}

            {/* Content Simulator */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-fg leading-snug" style={{ fontFamily: headingFont, color: accentTextColor }}>
                  {welcomeMessage}
                </h3>
                <p className="text-xs leading-relaxed" style={{ fontFamily: bodyFont, color: bodyTextColor }}>
                  {welcomeSubMessage} Leverage our interactive snapping stages, layouts boundaries, and lodging maps.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[9px] text-fg-subtle font-sans">
                  <span className="bg-surface px-2.5 py-1 rounded border border-border shadow-xs">📞 {phone}</span>
                  <span className="bg-surface px-2.5 py-1 rounded border border-border shadow-xs">📍 {location}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 space-y-2">
                <div className="flex gap-2">
                  <button className="flex-1 py-2 text-[10px] font-bold text-white rounded-lg transition-transform hover:scale-[1.02]" style={{ backgroundColor: brandColor, color: headerTextColor }}>
                    Explore Layouts
                  </button>
                  <button className="flex-1 py-2 text-[10px] font-bold border border-border rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors" style={{ color: bodyTextColor }}>
                    Contact Office
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

// ─── 6. Guest Portal Studio ────────────────────────────────────────────────
export function GuestPortalManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: configData, isLoading } = useQuery({
    queryKey: ['platformConfig', orgId],
    queryFn: () => sdk.platformConfig.getOrg(orgId),
  });

  const [requirePasscode, setRequirePasscode] = useState(true);
  const [showMeals, setShowMeals] = useState(true);
  const [allowSongs, setAllowSongs] = useState(true);
  const [enableRegistry, setEnableRegistry] = useState(true);
  const [registryUrl, setRegistryUrl] = useState('https://withjoy.com/smith-wedding');
  const [expiryDays, setExpiryDays] = useState(60);
  const [lodgingRooms, setLodgingRooms] = useState(8);
  const [portalWelcome, setPortalWelcome] = useState('Welcome to our digital layout assistant.');

  // White-Label States (Phase 4)
  const [removePlatformBranding, setRemovePlatformBranding] = useState(false);
  const [customCopyrightString, setCustomCopyrightString] = useState('');
  const [mapDirectionsLink, setMapDirectionsLink] = useState('');
  const [supportEmailOverride, setSupportEmailOverride] = useState('');

  // Initialize state from fetched config
  React.useEffect(() => {
    if (configData?.config) {
      const portal = (configData.config as any).guestPortal;
      if (portal) {
        setRequirePasscode(portal.requirePasscode ?? true);
        setShowMeals(portal.showMeals ?? true);
        setAllowSongs(portal.allowSongs ?? true);
        setEnableRegistry(portal.enableRegistry ?? true);
        setRegistryUrl(portal.registryUrl ?? 'https://withjoy.com/smith-wedding');
        setExpiryDays(portal.expiryDays ?? 60);
        setLodgingRooms(portal.lodgingRooms ?? 8);
        setPortalWelcome(portal.portalWelcome ?? 'Welcome to our digital layout assistant.');
        setRemovePlatformBranding(portal.removePlatformBranding ?? false);
        setCustomCopyrightString(portal.customCopyrightString || '');
        setMapDirectionsLink(portal.mapDirectionsLink || '');
        setSupportEmailOverride(portal.supportEmailOverride || '');
      }
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const currentConfig = configData?.config || {};
      const updatedConfig = {
        ...currentConfig,
        guestPortal: {
          requirePasscode,
          showMeals,
          allowSongs,
          enableRegistry,
          registryUrl,
          expiryDays,
          lodgingRooms,
          portalWelcome,
          removePlatformBranding,
          customCopyrightString,
          mapDirectionsLink,
          supportEmailOverride,
        },
      };
      return sdk.platformConfig.putOrg(orgId, updatedConfig);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platformConfig', orgId] });
      toast({ title: 'Guest Portal preferences saved', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Could not save portal preferences', description: e.message, variant: 'destructive' });
    },
  });

  const handleLoadDefaults = () => {
    setRequirePasscode(true);
    setShowMeals(true);
    setAllowSongs(true);
    setEnableRegistry(true);
    setRegistryUrl('https://withjoy.com/smith-wedding');
    setExpiryDays(60);
    setLodgingRooms(8);
    setPortalWelcome('Welcome to our digital layout assistant.');
    setRemovePlatformBranding(false);
    setCustomCopyrightString('');
    setMapDirectionsLink('');
    setSupportEmailOverride('');
    toast({ title: 'Guest Portal factory defaults loaded', description: 'Click Save Portal Preferences below to persist.', variant: 'success' });
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Quick Add Presets Panel */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Portal Presets
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly load typical guest portal configuration templates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => {
             setRequirePasscode(true); setShowMeals(true); setAllowSongs(true); setEnableRegistry(true);
             setPortalWelcome("Welcome to our digital layout assistant.");
             toast({ title: 'Standard RSVP configuration loaded' });
          }}>🎉 Standard RSVP</Button>
          <Button size="xs" variant="outline" onClick={() => {
             setRequirePasscode(false); setShowMeals(false); setAllowSongs(false); setEnableRegistry(false);
             setPortalWelcome("Explore our digital layouts and accommodations.");
             toast({ title: 'Light Informative layout loaded' });
          }}>📖 Light Informative</Button>
          <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Portal Defaults</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-brand" /> Portal Configurations
            </h4>

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

          {/* White-Label Configurations Card (Phase 4) */}
          <div className="bg-white p-4 rounded-xl border border-[#e1d5c9] space-y-4 font-semibold text-xs">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif text-brand">
              🛡️ Client White-Label Parameters
            </h4>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="remove-branding" className="text-xs font-semibold cursor-pointer">Remove Platform Branding</Label>
                  <p className="text-[10px] text-fg-subtle">Completely hides default platform footer logo</p>
                </div>
                <input
                  type="checkbox"
                  id="remove-branding"
                  checked={removePlatformBranding}
                  onChange={(e) => setRemovePlatformBranding(e.target.checked)}
                  className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-border/40">
                 <div>
                    <Label htmlFor="custom-copyright" className="text-[10px] text-fg-subtle">Custom Copyright String</Label>
                    <Input id="custom-copyright" placeholder="e.g. © 2026 Seven Paths Manor. All rights reserved." value={customCopyrightString} onChange={e => setCustomCopyrightString(e.target.value)} className="h-9 mt-1 text-xs bg-surface border-[#e1d5c9]" />
                 </div>
                 <div>
                    <Label htmlFor="map-directions" className="text-[10px] text-fg-subtle">Custom Map Directions Link</Label>
                    <Input id="map-directions" placeholder="e.g. https://maps.google.com/?q=Seven+Paths+Manor" value={mapDirectionsLink} onChange={e => setMapDirectionsLink(e.target.value)} className="h-9 mt-1 text-xs bg-surface border-[#e1d5c9]" />
                 </div>
                 <div>
                    <Label htmlFor="support-email" className="text-[10px] text-fg-subtle">Support Email Override</Label>
                    <Input id="support-email" type="email" placeholder="coordinator@sevenpathsmanor.com" value={supportEmailOverride} onChange={e => setSupportEmailOverride(e.target.value)} className="h-9 mt-1 text-xs bg-surface border-[#e1d5c9]" />
                 </div>
              </div>
            </div>
          </div>
        </div>

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
                {mapDirectionsLink && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5">🗺️ Map &amp; Directions</span>
                    <span className="font-semibold text-brand truncate max-w-[120px] underline cursor-pointer">View Google Map</span>
                  </div>
                )}
                {supportEmailOverride && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5">📧 Coordinator Email</span>
                    <span className="font-semibold text-fg truncate max-w-[120px]">{supportEmailOverride}</span>
                  </div>
                )}
              </div>

              {/* Copyright & Branding Footer Simulator */}
              <div className="pt-4 mt-4 border-t border-border/40 text-[9px] text-fg-subtle flex flex-col items-center gap-1 text-center font-sans">
                 <div>{customCopyrightString || '© 2026 Olivia & Thomas. All rights reserved.'}</div>
                 {!removePlatformBranding && (
                    <div className="text-[8px] uppercase tracking-wider text-brand font-bold mt-1 flex items-center gap-1">
                       💒 Powered by Wedding Venue Intelligence
                    </div>
                 )}
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full mt-4 font-sans">
              {saveMutation.isPending ? 'Saving...' : 'Save Portal Preferences'}
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
  
  // Local state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  // Custom role creator state
  const [roleCreatorOpen, setRoleCreatorOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // Load backend data
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

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: () => sdk.roles.addMember(orgId, { userEmail: email, roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Team member invited successfully', variant: 'success' });
      setEmail('');
      setRoleId('');
      setInviteOpen(false);
    },
    onError: (e: any) => toast({ title: 'Could not invite member', description: e.message, variant: 'destructive' }),
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ userId, targetRoleId }: { userId: string; targetRoleId: string }) =>
      sdk.roles.updateMemberRole(orgId, userId, targetRoleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Staff account role updated successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed to update member role', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => sdk.roles.removeMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Team member removed', variant: 'success' });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: () =>
      sdk.roles.createCustomRole(orgId, {
        key: newRoleKey.toLowerCase().replace(/\s+/g, '-'),
        name: newRoleName,
        description: newRoleDesc,
        permissions: selectedPerms as any,
        hierarchy: 10,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles-access', orgId] });
      setNewRoleName('');
      setNewRoleKey('');
      setNewRoleDesc('');
      setSelectedPerms([]);
      setRoleCreatorOpen(false);
      toast({ title: 'Custom operational role created successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Could not create role', description: e.message, variant: 'destructive' }),
  });

  const handleLoadDefaults = async () => {
    try {
      // 1. Create Coordinator Preset Role
      await sdk.roles.createCustomRole(orgId, {
        key: 'coordinator',
        name: 'Day-of Coordinator',
        description: 'Assigned staff responsible for checking rsvps and designing event floorplans.',
        permissions: ['events.view', 'events.edit', 'layouts.view', 'rsvp.view'] as any,
        hierarchy: 10,
      });

      // 2. Create Florist Designer Preset Role
      await sdk.roles.createCustomRole(orgId, {
        key: 'designer',
        name: 'Floral & Decor Designer',
        description: 'Specialist managing decoration catalogs and setting up layouts arch styles.',
        permissions: ['events.view', 'decor.manage', 'layouts.view'] as any,
        hierarchy: 12,
      });

      qc.invalidateQueries({ queryKey: ['roles-access', orgId] });
      toast({ title: 'Standard operational roles presets loaded successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Could not load defaults', description: e.message, variant: 'destructive' });
    }
  };

  const handleQuickAdd = async (presetType: string) => {
    try {
      let rolePayload: any = {};
      if (presetType === 'coordinator') {
        rolePayload = {
          key: 'coord-' + Date.now(),
          name: 'Junior Coordinator',
          description: 'Assistant planner with restricted view-only layout access.',
          permissions: ['events.view', 'layouts.view'] as any,
          hierarchy: 8
        };
      } else {
        rolePayload = {
          key: 'steward-' + Date.now(),
          name: 'Catering Lead',
          description: 'Dining supervisor overseeing meal questionnaires and seating.',
          permissions: ['events.view', 'rsvp.view'] as any,
          hierarchy: 15
        };
      }
      await sdk.roles.createCustomRole(orgId, rolePayload);
      qc.invalidateQueries({ queryKey: ['roles-access', orgId] });
      toast({ title: 'Operational role preset created successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Failed to create role preset', description: e.message, variant: 'destructive' });
    }
  };

  const members = (membersQuery.data as any)?.members ?? [];
  const roles = rolesQuery.data?.roles ?? [];
  const permissions = permQuery.data?.catalog ?? [];

  const togglePermissionCheckbox = (permId: string) => {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Quick Add Presets Panel */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Custom Role Presets
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly pre-configure specialized administrative user privileges and credentials.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => handleQuickAdd('coordinator')}>📋 Day-Of Assistant</Button>
          <Button size="xs" variant="outline" onClick={() => handleQuickAdd('catering')}>🍽️ Catering Lead</Button>
          <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Role Defaults</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Staff Accounts */}
        <div className="lg:col-span-1 bg-surface-2/30 p-4 rounded-xl border border-border space-y-4 font-semibold">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
              <Users className="h-4 w-4 text-brand" /> Staff Accounts
            </h4>
            <Button size="xs" variant="outline" onClick={() => setInviteOpen(!inviteOpen)}>
              {inviteOpen ? 'Close' : 'Invite Staff'}
            </Button>
          </div>

          {inviteOpen && (
            <div className="bg-white p-4 rounded-xl border border-border space-y-3 shadow-xs">
              <h5 className="text-[11px] font-bold text-fg uppercase tracking-wider">Send Team Invite</h5>
              <div>
                <Label htmlFor="inv-email" className="text-[10px] text-fg-subtle">Email Address</Label>
                <Input id="inv-email" type="email" placeholder="planner@venue.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-xs mt-1" />
              </div>
              <div>
                <Label htmlFor="inv-role" className="text-[10px] text-fg-subtle">Privilege Level (Role)</Label>
                <select
                  id="inv-role"
                  value={roleId}
                  onChange={e => setRoleId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                >
                  <option value="">Select role</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <Button size="sm" onClick={() => inviteMutation.mutate()} className="w-full" disabled={!email || !roleId}>Send Invite</Button>
            </div>
          )}

          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {members.length === 0 ? (
              <p className="text-[11px] text-fg-subtle py-4 text-center">No staff found.</p>
            ) : (
              members.map((m: any) => (
                <div key={m.userId} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border shadow-sm">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-bold text-fg truncate">{m.fullName || m.email}</div>
                    <div className="text-[9px] text-fg-subtle truncate">{m.email}</div>
                    
                    {/* Editable staff role dropdown select (dynamic sync!) */}
                    <div className="mt-1.5">
                      <select
                        className="h-7 rounded border border-border bg-surface-2 px-1 text-[10px] font-semibold text-fg cursor-pointer max-w-[130px]"
                        value={m.roleId}
                        onChange={(e) => updateMemberRoleMutation.mutate({ userId: m.userId, targetRoleId: e.target.value })}
                      >
                        {roles.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10 shrink-0" onClick={() => {
                     if (window.confirm(`Revoke staff access for ${m.fullName || m.email}?`)) {
                       removeMutation.mutate(m.userId);
                     }
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Interactive Matrix Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
              <Shield className="h-4 w-4 text-brand" /> Interactive Privileges Matrix
            </h4>
            <Button size="xs" variant="outline" onClick={() => setRoleCreatorOpen(!roleCreatorOpen)}>
              {roleCreatorOpen ? 'Close Form' : 'Create Custom Role'}
            </Button>
          </div>

          {/* Interactive Role Creator Form */}
          {roleCreatorOpen && (
            <div className="bg-white p-5 rounded-xl border border-border space-y-4 shadow-md font-semibold animate-in slide-in-from-top-4">
              <h5 className="text-[11px] font-bold text-fg uppercase tracking-wider border-b pb-2">Define Custom Operational Role</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role-name" className="text-[10px]">Role Display Name</Label>
                  <Input id="role-name" placeholder="Day-of Coordinator" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div>
                  <Label htmlFor="role-key" className="text-[10px]">Identifier Code Key (Lowercase, no spaces)</Label>
                  <Input id="role-key" placeholder="coordinator" value={newRoleKey} onChange={e => setNewRoleKey(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="role-desc" className="text-[10px]">Role Description</Label>
                  <Input id="role-desc" placeholder="Assigned personnel with restricted operational and coordinator access..." value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
              </div>

              {/* Checkboxes of privileges */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-[10px] text-fg-subtle">Check Privileges to grant:</Label>
                <div className="grid grid-cols-2 gap-2 text-[11px] max-h-[150px] overflow-y-auto p-2 bg-surface-2/40 border rounded-lg">
                  {permissions.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:text-brand transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(p.id)}
                        onChange={() => togglePermissionCheckbox(p.id)}
                        className="rounded border-border text-brand accent-brand h-3.5 w-3.5"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button size="sm" onClick={() => createRoleMutation.mutate()} className="w-full" disabled={!newRoleName || !newRoleKey || selectedPerms.length === 0}>
                Create Custom Role
              </Button>
            </div>
          )}

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
