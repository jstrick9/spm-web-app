import React, { useState, useMemo, useRef } from 'react';
import { TeamMembers } from './TeamMembers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, Database, Settings, Activity, Download, Upload, Server,
  Layers, Plus, Save, Trash2, Heart, HelpCircle, Palette, CheckCircle2,
  AlertCircle, Sparkles, Image, Trash
} from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';
import { sdk } from '../../../sdk';
import type { SdkCatalogItem } from '../../../sdk/types';
import { ControlPanel } from '../../../components/ControlPanel';
import { EventQuestionsStudio } from '../questions/EventQuestionsStudio';

interface Props {
  orgId: string;
}

type AdminTab = 'team' | 'permissions' | 'catalog' | 'decor' | 'venue' | 'questions' | 'branding' | 'backups' | 'diagnostics';
type CatalogKind = 'table' | 'chair' | 'fixture' | 'wall_style' | 'linen' | 'guideline' | 'spacing' | 'template';

export function AdminPanel({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('team');

  return (
    <>
      <PageHeader
        title="Admin Settings & Operations"
        description="Universal operational suite for managing branding, team members, floorplan catalogs, florals, and database backups."
      />
      <PageBody>
        <Card className="min-h-[600px] flex flex-col shadow-md border-border">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="flex-1 flex flex-col">
            <div className="border-b border-border p-4 bg-surface-2/30 overflow-x-auto">
              <TabsList className="flex flex-nowrap gap-1">
                <TabsTrigger value="team" className="text-xs"><Users className="w-3.5 h-3.5 mr-1.5" /> Team</TabsTrigger>
                <TabsTrigger value="permissions" className="text-xs"><Shield className="w-3.5 h-3.5 mr-1.5" /> Permissions</TabsTrigger>
                <TabsTrigger value="catalog" className="text-xs"><Layers className="w-3.5 h-3.5 mr-1.5" /> Catalog Studio</TabsTrigger>
                <TabsTrigger value="decor" className="text-xs"><Heart className="w-3.5 h-3.5 mr-1.5" /> Decor</TabsTrigger>
                <TabsTrigger value="venue" className="text-xs"><Layers className="w-3.5 h-3.5 mr-1.5" /> Venues</TabsTrigger>
                <TabsTrigger value="questions" className="text-xs"><HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Questions</TabsTrigger>
                <TabsTrigger value="branding" className="text-xs"><Palette className="w-3.5 h-3.5 mr-1.5" /> Branding</TabsTrigger>
                <TabsTrigger value="backups" className="text-xs"><Database className="w-3.5 h-3.5 mr-1.5" /> Backups</TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs"><Activity className="w-3.5 h-3.5 mr-1.5" /> Diagnostics</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 p-6 bg-surface-2/10">
              <TabsContent value="team" className="h-full m-0">
                <TeamMembers orgId={orgId} />
              </TabsContent>
              
              <TabsContent value="permissions" className="h-full m-0">
                <PermissionsMatrix orgId={orgId} />
              </TabsContent>

              <TabsContent value="catalog" className="h-full m-0">
                <UnifiedCatalogManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="decor" className="h-full m-0">
                <DecorManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="venue" className="h-full m-0">
                <VenueManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="questions" className="h-full m-0">
                <EventQuestionsStudio orgId={orgId} />
              </TabsContent>

              <TabsContent value="branding" className="h-full m-0">
                <BrandingManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="backups" className="h-full m-0">
                <BackupManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="diagnostics" className="h-full m-0">
                <ControlPanel />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </PageBody>
    </>
  );
}

// ─── 1. Role-Based Permissions Matrix ─────────────────────────────────────────
function PermissionsMatrix({ orgId }: { orgId: string }) {
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', orgId],
    queryFn: () => sdk.roles.listRoles(orgId),
  });

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ['permissions', orgId],
    queryFn: () => sdk.roles.permissionCatalog(orgId),
  });

  if (rolesLoading || permLoading) {
    return <div className="p-8 text-center text-fg-muted animate-pulse">Loading permission matrix...</div>;
  }

  const roles = rolesData?.roles || [];
  const catalog = permData?.catalog || [];

  const categorized = catalog.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof catalog>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="text-sm font-bold text-fg">Role-Based Access Matrix</h3>
           <p className="text-xs text-fg-muted">Review which organizational roles possess specific application capabilities.</p>
        </div>
        <Button variant="outline" size="sm">Create Custom Role</Button>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg bg-surface shadow-sm -mx-4 sm:mx-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-fg-subtle sticky left-0 bg-surface-2 z-10 w-64 border-r border-border">Permission</th>
              {roles.map(r => (
                <th key={r.id} className="px-4 py-3 font-medium text-center min-w-[120px] whitespace-nowrap">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{r.name}</span>
                    {r.is_system === 1 && <Badge variant="outline" className="text-[9px] mt-1 tracking-wider uppercase">System</Badge>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(categorized).map(([category, perms]) => (
              <React.Fragment key={category}>
                <tr className="bg-surface-2/50">
                  <td colSpan={roles.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                    {category}
                  </td>
                </tr>
                {perms.map(p => (
                  <tr key={p.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-surface z-10 border-r border-border group">
                      <div className="font-medium text-fg text-xs">{p.label}</div>
                      <div className="text-[10px] text-fg-muted mt-0.5 max-w-[200px] truncate group-hover:whitespace-normal group-hover:break-words">{p.description}</div>
                    </td>
                    {roles.map(r => {
                      const hasPerm = r.permissions?.includes(p.id) ?? false;
                      return (
                        <td key={`${r.id}-${p.id}`} className="px-4 py-3 text-center">
                          {hasPerm ? (
                            <div className="w-4 h-4 rounded-full bg-brand-soft border border-brand/30 text-brand flex items-center justify-center mx-auto text-[10px]">✓</div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-surface-2 border border-border mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 2. Unified Catalog Studio (Chairs, Tables, Walls, Spacings, etc.) ────────
function UnifiedCatalogManager({ orgId }: { orgId: string }) {
  const [subTab, setSubTab] = useState<CatalogKind>('table');
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['catalog-admin', orgId, subTab],
    queryFn: () => sdk.catalog.list(orgId, subTab as any),
  });

  const [localItems, setLocalItems] = useState<Partial<SdkCatalogItem>[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  React.useEffect(() => {
    if (data) {
      setLocalItems(data.items);
      setHasChanges(false);
    }
  }, [data, subTab]);

  const saveMutation = useMutation({
    mutationFn: (items: any[]) => sdk.catalog.replaceAll(orgId, subTab as any, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-admin', orgId, subTab] });
      toast({ title: 'Operational catalog presets saved', variant: 'success' });
      setHasChanges(false);
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  });

  const handleAdd = () => {
    let spec: any = {};
    if (subTab === 'table') spec = { shape: 'round', radius: 30, capacity: 8, color: '#FFFFFF', allowAsDecorBase: true };
    else if (subTab === 'chair') spec = { radius: 10, icon: '🪑', color: '#D4AF37', width: 1.5, inventoryCount: 150 };
    else if (subTab === 'fixture') spec = { type: 'stage', width: 96, height: 144, color: '#8C52FF' };
    else if (subTab === 'wall_style') spec = { thickness: 4, height: 8, color: '#C0C0C0', texture: 'plaster' };
    else if (subTab === 'linen') spec = { type: 'tablecloth', material: 'polyester', color: '#FFFFFF' };
    else if (subTab === 'guideline') spec = { bufferWidth: 5, severity: 'warning', desc: 'Clear escape route buffer' };
    else if (subTab === 'spacing') spec = { rowSpacing: 6, seatSpacing: 1.5, code: 'standard-seating' };
    else if (subTab === 'template') spec = { category: 'reception', payload: '{}' };

    setLocalItems([...localItems, {
      name: `New ${subTab.replace('_', ' ')}`,
      spec: JSON.stringify(spec),
      visible: true
    } as any]);
    setHasChanges(true);
  };

  const handleQuickAdd = (presetType: string) => {
    let newPresets: any[] = [];
    if (subTab === 'table') {
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
    } else if (subTab === 'chair') {
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
    } else if (subTab === 'fixture') {
      newPresets = [
        { name: '12x12 Dance Floor', spec: JSON.stringify({ type: 'dance_floor', width: 144, height: 144, color: '#8F4F4F' }), visible: true },
        { name: 'Full Catering Bar', spec: JSON.stringify({ type: 'bar', width: 96, height: 36, color: '#C0C0C0' }), visible: true },
      ];
    } else if (subTab === 'wall_style') {
      newPresets = [
        { name: 'Wood Lattice Panel', spec: JSON.stringify({ thickness: 2, height: 8, color: '#D2B48C', texture: 'wood' }), visible: true },
        { name: 'Solid Divider Wall', spec: JSON.stringify({ thickness: 4, height: 10, color: '#FFFFFF', texture: 'drywall' }), visible: true },
      ];
    } else if (subTab === 'linen') {
      newPresets = [
        { name: 'Burgundy Table Runner', spec: JSON.stringify({ type: 'runner', material: 'velvet', color: '#800020' }), visible: true },
        { name: 'Ivory Polyester Cloth', spec: JSON.stringify({ type: 'tablecloth', material: 'polyester', color: '#FFFFF0' }), visible: true },
      ];
    } else if (subTab === 'guideline') {
      newPresets = [
        { name: 'ADA Seating Gap', spec: JSON.stringify({ bufferWidth: 4, severity: 'info', desc: 'Clear space for wheelchair access' }), visible: true },
        { name: 'Main Exit Path Buffer', spec: JSON.stringify({ bufferWidth: 6, severity: 'danger', desc: 'Keep entirely free of chairs/decor' }), visible: true },
      ];
    } else if (subTab === 'spacing') {
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
    setLocalItems(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const catalogSubTabs: { id: CatalogKind; label: string }[] = [
    { id: 'table', label: 'Tables' },
    { id: 'chair', label: 'Chairs' },
    { id: 'fixture', label: 'Fixtures' },
    { id: 'wall_style', label: 'Walls' },
    { id: 'linen', label: 'Linens' },
    { id: 'guideline', label: 'Guidelines' },
    { id: 'spacing', label: 'Spacings' },
    { id: 'template', label: 'Templates' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border space-y-3">
        <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand" /> Quick-Add Presets
        </h4>
        <div className="flex flex-wrap gap-2">
          {subTab === 'table' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('round')}>⭕ Round Tables</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('rectangle')}>⬜ Rectangle Tables</Button>
            </>
          )}
          {subTab === 'chair' && (
            <>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('chiavari')}>👑 Chiavari Styles</Button>
              <Button size="xs" variant="outline" onClick={() => handleQuickAdd('ghost')}>💎 Ghost Collection</Button>
            </>
          )}
          {subTab === 'fixture' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('fixture')}>📦 Stage & Dance Floors</Button>}
          {subTab === 'wall_style' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('wall_style')}>🧱 Partition Walls</Button>}
          {subTab === 'linen' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('linen')}>🧵 Tablecloths & Runners</Button>}
          {subTab === 'guideline' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('guideline')}>🚒 Fire Safety Guidelines</Button>}
          {subTab === 'spacing' && <Button size="xs" variant="outline" onClick={() => handleQuickAdd('spacing')}>📏 Row & Seat Spacing</Button>}
        </div>
      </div>

      <div className="border-b border-border pb-3 overflow-x-auto flex gap-1">
        {catalogSubTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={[
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0',
              subTab === t.id ? 'bg-brand/10 text-brand' : 'text-fg-muted hover:bg-surface-2'
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center bg-surface-2/60 p-3 rounded-lg border border-border">
        <span className="text-xs font-bold text-fg-subtle capitalize">{subTab.replace('_', ' ')} list</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd}><Plus className="w-3.5 h-3.5 mr-1" /> Add Item</Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(localItems.map(i => ({ ...i, spec: typeof i.spec === 'string' ? JSON.parse(i.spec) : i.spec })))}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <div className="space-y-2">
          {localItems.length === 0 ? (
            <div className="text-center text-xs text-fg-muted py-8 border border-dashed rounded-lg">No presets configured yet.</div>
          ) : (
            localItems.map((item, i) => {
              const spec = typeof item.spec === 'string' ? JSON.parse(item.spec || '{}') : (item.spec || {});
              return (
                <div key={i} className="flex flex-col gap-3 bg-surface p-4 rounded-lg border border-border hover:border-brand/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input placeholder="Item Name" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} className="h-9 text-xs font-semibold" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-danger hover:bg-danger/10 shrink-0" onClick={() => removeRow(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-border/40">
                    {subTab === 'table' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Shape</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.shape || 'round'}
                            onChange={e => updateSpec(i, 'shape', e.target.value)}
                          >
                            <option value="round">Round Circle</option>
                            <option value="rect">Rectangular</option>
                            <option value="square">Square</option>
                            <option value="oval">Oval / Elongated</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Diameter/Width (in)</Label>
                          <Input type="number" value={spec.radius ? spec.radius * 2 : (spec.width || '')} onChange={e => updateSpec(i, spec.shape === 'round' ? 'radius' : 'width', parseInt(e.target.value) / (spec.shape === 'round' ? 2 : 1))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Seating Capacity</Label>
                          <Input type="number" value={spec.capacity || ''} onChange={e => updateSpec(i, 'capacity', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input type="text" value={spec.color || '#FFFFFF'} onChange={e => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'chair' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Icon/Emoji</Label>
                          <Input type="text" value={spec.icon || '🪑'} onChange={e => updateSpec(i, 'icon', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Width (ft)</Label>
                          <Input type="number" step={0.1} value={spec.width || 1.5} onChange={e => updateSpec(i, 'width', parseFloat(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Stock Inventory</Label>
                          <Input type="number" value={spec.inventoryCount || 100} onChange={e => updateSpec(i, 'inventoryCount', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input type="text" value={spec.color || '#D4AF37'} onChange={e => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'fixture' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Fixture Type</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.type || 'stage'}
                            onChange={e => updateSpec(i, 'type', e.target.value)}
                          >
                            <option value="stage">Stage Platform</option>
                            <option value="dance_floor">Dance Floor</option>
                            <option value="bar">Beverage Bar</option>
                            <option value="arch">Floral Arch</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Width (in)</Label>
                          <Input type="number" value={spec.width || 96} onChange={e => updateSpec(i, 'width', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Length (in)</Label>
                          <Input type="number" value={spec.height || 144} onChange={e => updateSpec(i, 'height', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input type="text" value={spec.color || '#8C52FF'} onChange={e => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'wall_style' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Thickness (in)</Label>
                          <Input type="number" value={spec.thickness || 4} onChange={e => updateSpec(i, 'thickness', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Height (ft)</Label>
                          <Input type="number" value={spec.height || 8} onChange={e => updateSpec(i, 'height', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Texture</Label>
                          <Input type="text" value={spec.texture || 'plaster'} onChange={e => updateSpec(i, 'texture', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Hex Color</Label>
                          <Input type="text" value={spec.color || '#C0C0C0'} onChange={e => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'linen' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Linen Type</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.type || 'tablecloth'}
                            onChange={e => updateSpec(i, 'type', e.target.value)}
                          >
                            <option value="tablecloth">Tablecloth</option>
                            <option value="runner">Table Runner</option>
                            <option value="overlay">Overlay Cloth</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Material</Label>
                          <Input type="text" value={spec.material || 'polyester'} onChange={e => updateSpec(i, 'material', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Linen Color</Label>
                          <Input type="text" value={spec.color || '#FFFFFF'} onChange={e => updateSpec(i, 'color', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'guideline' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Buffer Width (ft)</Label>
                          <Input type="number" value={spec.bufferWidth || 5} onChange={e => updateSpec(i, 'bufferWidth', parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Severity Level</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.severity || 'warning'}
                            onChange={e => updateSpec(i, 'severity', e.target.value)}
                          >
                            <option value="info">Information (Blue)</option>
                            <option value="warning">Warning Buffer (Amber)</option>
                            <option value="danger">Critical Egress (Red)</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-fg-subtle">Description</Label>
                          <Input type="text" value={spec.desc || ''} onChange={e => updateSpec(i, 'desc', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'spacing' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Row Spacing (ft)</Label>
                          <Input type="number" step={0.1} value={spec.rowSpacing || 5.0} onChange={e => updateSpec(i, 'rowSpacing', parseFloat(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Chair Spacing (ft)</Label>
                          <Input type="number" step={0.1} value={spec.seatSpacing || 1.5} onChange={e => updateSpec(i, 'seatSpacing', parseFloat(e.target.value))} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Spacing Code</Label>
                          <Input type="text" value={spec.code || ''} onChange={e => updateSpec(i, 'code', e.target.value)} className="h-9 mt-1 text-xs" />
                        </div>
                      </>
                    )}

                    {subTab === 'template' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-fg-subtle">Template Category</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                            value={spec.category || 'reception'}
                            onChange={e => updateSpec(i, 'category', e.target.value)}
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
      )}
    </div>
  );
}

// ─── 3. Venue Manager with Image Upload ─────────────────────────────────────
function VenueManager({ orgId }: { orgId: string }) {
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
function DecorManager({ orgId }: { orgId: string }) {
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
function BrandingManager({ orgId }: { orgId: string }) {
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

// ─── 5. Database Backup Snapshots Manager ────────────────────────────────────
function BackupManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleExport = () => {
    setDownloading(true);
    toast({ title: 'Preparing Backup', description: 'Downloading your organization data...' });
    const link = document.createElement('a');
    link.href = `/api/orgs/${orgId}/export/backup.json`;
    link.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    setTimeout(() => {
      setDownloading(false);
      toast({ title: 'Backup Downloaded', variant: 'success' });
    }, 1000);
  };

  const handleImport = () => {
    toast({ title: 'Import restricted', description: 'Contact system administrator to restore from snapshot.', variant: 'destructive' });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-brand-soft/30 border border-brand/20 p-5 rounded-xl flex items-start gap-4">
        <Server className="w-6 h-6 text-brand shrink-0 mt-1" />
        <div>
           <h3 className="font-semibold text-fg">Database Snapshots</h3>
           <p className="text-sm text-fg-muted mt-1 leading-relaxed">
             Full operational data including Guests, Layouts, Configurations, and Chat threads are stored in isolated encrypted tenants. You can request a physical local backup of your environment for archival purposes.
           </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4 text-brand"/> Export Data</CardTitle>
            <CardDescription>Download a complete JSON backup of all events, guests, vendors, and budget data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={downloading} onClick={handleExport}>
               {downloading ? 'Generating...' : 'Download Snapshot'}
            </Button>
            <p className="text-[10px] text-center text-fg-subtle mt-3">Includes events, guests, vendors, budget, and timeline data</p>
          </CardContent>
        </Card>

        <Card className="border-danger/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-danger"><Upload className="w-4 h-4"/> Restore Backup</CardTitle>
            <CardDescription>Overwrites current active state with a previous binary file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleImport}>
               Upload & Restore
            </Button>
            <p className="text-[10px] text-center text-danger/70 mt-3 font-semibold">WARNING: This action is destructive.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
