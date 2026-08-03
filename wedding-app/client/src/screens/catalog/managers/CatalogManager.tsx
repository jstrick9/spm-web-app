import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkCatalogItem } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import type { CatalogKind } from '../CatalogScreen';
import { renderShapePreview } from '../CatalogScreen';

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
