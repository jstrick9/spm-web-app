import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles, Check, Upload, Image, Trash } from 'lucide-react';
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

export type CatalogKind = 'table' | 'chair' | 'fixture' | 'wall_style' | 'linen' | 'guideline' | 'spacing' | 'template' | 'decor' | 'venue' | 'branding';

const KINDS: { id: CatalogKind; label: string; desc: string }[] = [
  { id: 'table', label: 'Tables', desc: 'Define shapes, dimensions, and capacities for floorplan tables.' },
  { id: 'chair', label: 'Chairs & Seating', desc: 'Manage styles, widths, and stocks of chairs.' },
  { id: 'fixture', label: 'Fixtures & Stages', desc: 'Stages, dance floors, bars, and podium sizes.' },
  { id: 'wall_style', label: 'Wall Styles', desc: 'Architectural wall properties and partition styles.' },
  { id: 'linen', label: 'Linens', desc: 'Tablecloths, runners, overlays, and draperies.' },
  { id: 'guideline', label: 'Guidelines', desc: 'Emergency exits, safety rings, and spacing rules.' },
  { id: 'spacing', label: 'Spacing Presets', desc: 'Spacing offsets between tables and row configurations.' },
  { id: 'template', label: 'Layout Templates', desc: 'Seated, ceremony, and banquet table layouts.' },
  { id: 'decor', label: 'Decor Inventory', desc: 'Manage floral arrangements, lights, arches, and floral photos.' },
  { id: 'venue', label: 'Venues', desc: 'Manage venue spaces, dimensions, capacities, and layout photos.' },
  { id: 'branding', label: 'Venue Branding', desc: 'Customize logo, Google fonts, text colors, and brand palettes.' },
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
                    'w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between',
                    activeTab === k.id
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  ].join(' ')}
                >
                  <span>{k.label}</span>
                  {k.id === 'branding' && <Palette className="h-3.5 w-3.5" />}
                  {k.id === 'decor' && <Heart className="h-3.5 w-3.5" />}
                  {k.id === 'venue' && <Layers className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration area */}
          <div className="lg:col-span-3">
            <Card className="min-h-[500px]">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {KINDS.find((k) => k.id === activeTab)?.label}
                </CardTitle>
                <CardDescription>
                  {KINDS.find((k) => k.id === activeTab)?.desc}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeTab === 'branding' ? (
                  <BrandingManager orgId={orgId} />
                ) : activeTab === 'decor' ? (
                  <DecorManager orgId={orgId} />
                ) : activeTab === 'venue' ? (
                  <VenueManager orgId={orgId} />
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

// ─── Generic Catalog Item Manager with Quick-Add Presets ─────────────────
export function CatalogManager({ orgId, kind }: { orgId: string; kind: Exclude<CatalogKind, 'decor' | 'branding' | 'venue'> }) {
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
      toast({ title: 'Inventory catalog updated', variant: 'success' });
      setHasChanges(false);
    },
    onError: (e: any) => {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    let spec: any = {};
    if (kind === 'table') spec = { shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true };
    else if (kind === 'chair') spec = { radius: 10, icon: '🪑', color: '#D4AF37', width: 1.5, inventoryCount: 150 };
    else if (kind === 'fixture') spec = { type: 'stage', width: 96, height: 144, color: '#8C52FF' };
    else if (kind === 'wall_style') spec = { thickness: 4, height: 8, color: '#C0C0C0', texture: 'plaster' };
    else if (kind === 'linen') spec = { type: 'tablecloth', material: 'polyester', color: '#FFFFFF' };
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
          { name: 'Chiavari Gold', spec: JSON.stringify({ radius: 9, icon: '👑', color: '#D4AF37', width: 1.4, inventoryCount: 200 }), visible: true },
          { name: 'Chiavari Silver', spec: JSON.stringify({ radius: 9, icon: '🪑', color: '#C0C0C0', width: 1.4, inventoryCount: 150 }), visible: true },
        ];
      } else if (presetType === 'ghost') {
        newPresets = [
          { name: 'Ghost Acrylic', spec: JSON.stringify({ radius: 10, icon: '💎', color: '#E8E8E8', width: 1.6, inventoryCount: 100 }), visible: true },
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
        { name: 'Burgundy Table Runner', spec: JSON.stringify({ type: 'runner', material: 'velvet', color: '#800020' }), visible: true },
        { name: 'Ivory Polyester Cloth', spec: JSON.stringify({ type: 'tablecloth', material: 'polyester', color: '#FFFFF0' }), visible: true },
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
          {kind === 'spacing' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('spacing')}>📏 Row & Seat Spacing</Button>}
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

      <div className="space-y-3">
        {localItems.length === 0 ? (
          <div className="text-center text-xs text-fg-muted py-10 border border-dashed rounded-lg">
            No configurations configured yet.
          </div>
        ) : (
          localItems.map((item, i) => {
            const spec = typeof item.spec === 'string' ? JSON.parse(item.spec || '{}') : (item.spec || {});
            return (
              <div key={i} className="flex flex-col gap-3 bg-surface p-4 rounded-lg border border-border hover:border-brand/40 transition-colors">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-border/40">
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
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Diameter/Width (in)</Label>
                        <Input type="number" value={spec.radius ? spec.radius * 2 : (spec.width || '')} onChange={(e) => updateSpec(i, spec.shape === 'round' ? 'radius' : 'width', parseInt(e.target.value) / (spec.shape === 'round' ? 2 : 1))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Seating Capacity</Label>
                        <Input type="number" value={spec.capacity || ''} onChange={(e) => updateSpec(i, 'capacity', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                        <Input type="text" value={spec.color || '#FFFFFF'} onChange={(e) => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                    </>
                  )}

                  {kind === 'chair' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Icon/Emoji</Label>
                        <Input type="text" value={spec.icon || '🪑'} onChange={(e) => updateSpec(i, 'icon', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Width (ft)</Label>
                        <Input type="number" step={0.1} value={spec.width || 1.5} onChange={(e) => updateSpec(i, 'width', parseFloat(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Stock Inventory</Label>
                        <Input type="number" value={spec.inventoryCount || 100} onChange={(e) => updateSpec(i, 'inventoryCount', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                        <Input type="text" value={spec.color || '#D4AF37'} onChange={(e) => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
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
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Width (in)</Label>
                        <Input type="number" value={spec.width || 96} onChange={(e) => updateSpec(i, 'width', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Length (in)</Label>
                        <Input type="number" value={spec.height || 144} onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                        <Input type="text" value={spec.color || '#8C52FF'} onChange={(e) => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                    </>
                  )}

                  {kind === 'wall_style' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Thickness (in)</Label>
                        <Input type="number" value={spec.thickness || 4} onChange={(e) => updateSpec(i, 'thickness', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Height (ft)</Label>
                        <Input type="number" value={spec.height || 8} onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Texture</Label>
                        <Input type="text" value={spec.texture || 'plaster'} onChange={(e) => updateSpec(i, 'texture', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                        <Input type="text" value={spec.color || '#C0C0C0'} onChange={(e) => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
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
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Material</Label>
                        <Input type="text" value={spec.material || 'polyester'} onChange={(e) => updateSpec(i, 'material', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Linen Color</Label>
                        <Input type="text" value={spec.color || '#FFFFFF'} onChange={(e) => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                    </>
                  )}

                  {kind === 'guideline' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Buffer Width (ft)</Label>
                        <Input type="number" value={spec.bufferWidth || 5} onChange={(e) => updateSpec(i, 'bufferWidth', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
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
                        <Label className="text-[10px] text-fg-subtle">Description</Label>
                        <Input type="text" value={spec.desc || ''} onChange={(e) => updateSpec(i, 'desc', e.target.value)} className="h-9 mt-1 text-xs" />
                      </div>
                    </>
                  )}

                  {kind === 'spacing' && (
                    <>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Row Spacing (ft)</Label>
                        <Input type="number" step={0.1} value={spec.rowSpacing || 5.0} onChange={(e) => updateSpec(i, 'rowSpacing', parseFloat(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Chair Spacing (ft)</Label>
                        <Input type="number" step={0.1} value={spec.seatSpacing || 1.5} onChange={(e) => updateSpec(i, 'seatSpacing', parseFloat(e.target.value))} className="h-9 mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-fg-subtle">Spacing Code</Label>
                        <Input type="text" value={spec.code || ''} onChange={(e) => updateSpec(i, 'code', e.target.value)} className="h-9 mt-1 text-xs" />
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
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Venue Manager with Image Upload ─────────────────────────────────────
export function VenueManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newVenueName, setNewVenueName] = useState('');
  const [capacity, setCapacity] = useState(150);
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(40);
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
        environment: 'indoor',
        style: venuePhoto ? { photo: venuePhoto } : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      setNewVenueName('');
      setVenuePhoto(null);
      toast({ title: 'Venue created successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to create venue', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.venues.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      toast({ title: 'Venue removed', variant: 'success' });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  const venues = venueData?.venues ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border space-y-4">
        <h4 className="text-xs font-bold text-fg">Add New Venue Space</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="venue-name" className="text-[10px]">Venue Name</Label>
            <Input id="venue-name" placeholder="Grand Ballroom, South Garden..." value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} className="h-9 text-xs mt-1" />
          </div>
          <div>
            <Label htmlFor="venue-cap" className="text-[10px]">Max Capacity</Label>
            <Input id="venue-cap" type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="venue-w" className="text-[10px]">W (ft)</Label>
              <Input id="venue-w" type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
            </div>
            <div className="flex-1">
              <Label htmlFor="venue-h" className="text-[10px]">L (ft)</Label>
              <Input id="venue-h" type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
            </div>
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
          <div className="col-span-2 text-center text-xs text-fg-muted py-8 border border-dashed rounded-lg">No venues added yet.</div>
        ) : (
          venues.map((v: any) => {
            const style = typeof v.style === 'string' ? JSON.parse(v.style || '{}') : (v.style || {});
            return (
              <Card key={v.id} className="p-3 flex items-center justify-between border-border bg-surface-1">
                <div className="flex items-center gap-3">
                  {style.photo ? (
                    <img src={style.photo} alt={v.name} className="h-12 w-12 object-cover rounded-md border border-border" />
                  ) : (
                    <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle">
                      <Image className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-fg">{v.name}</h4>
                    <p className="text-[10px] text-fg-subtle mt-0.5">{v.width}ft × {v.height}ft · {v.capacity} guests · {v.environment}</p>
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

// ─── Decor Manager with Image Upload ───────────────────────────────────────
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
      <div className="flex flex-col gap-3 bg-surface-2/60 p-4 rounded-xl border border-border">
        <Input
          placeholder="New Decor Item Name (e.g. Flower Arch, Centerpiece Vase)..."
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
              <img src={decorPhoto} alt="Decor" className="h-10 w-10 object-cover rounded-md border border-border" />
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
          <div className="col-span-2 text-center text-xs text-fg-muted py-10 border border-dashed rounded-lg">
            No decor items added yet.
          </div>
        ) : (
          items.map((it: any) => (
            <Card key={it.id} className="border border-border p-3 flex items-center justify-between gap-3 bg-surface-1">
              <div className="flex items-center gap-3">
                {it.image_path ? (
                  <img src={it.image_path} alt={it.name} className="h-12 w-12 object-cover rounded-md border border-border" />
                ) : (
                  <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle">
                    <Image className="h-5 w-5" />
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

// ─── Branding Manager with Fonts & Logo Upload ───────────────────────────
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
    <div className="space-y-6 max-w-xl">
      <div className="space-y-4">
        {/* Logo Upload */}
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
                <img src={logoPhoto} alt="Venue Logo" className="h-10 w-10 object-contain rounded-md border border-border bg-white" />
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
              <option value="Fraunces">Fraunces (Default - Editorial)</option>
              <option value="Playfair Display">Playfair Display (Chic Serif)</option>
              <option value="Montserrat">Montserrat (Geometric Modern)</option>
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
              <option value="Inter">Inter (Default - High Contrast)</option>
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

      <Button onClick={() => saveBrandingMutation.mutate()} className="w-full h-11 tracking-wider font-semibold">
        <Save className="h-4 w-4 mr-2" /> Save Branding Preferences
      </Button>
    </div>
  );
}
