import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings } from 'lucide-react';
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

type CatalogKind = 'table' | 'chair' | 'fixture' | 'wall_style' | 'linen' | 'guideline' | 'spacing' | 'template' | 'decor' | 'branding';

const KINDS: { id: CatalogKind; label: string; desc: string }[] = [
  { id: 'table', label: 'Tables', desc: 'Manage shapes and radii for table seating configurations.' },
  { id: 'chair', label: 'Chairs', desc: 'Specify dimensions and spacing of standard seating inventory.' },
  { id: 'fixture', label: 'Fixtures & Stages', desc: 'Configure larger stage, dance floor, bar, and structural elements.' },
  { id: 'wall_style', label: 'Wall Styles', desc: 'Custom boundaries, partition screens, and backdrops.' },
  { id: 'linen', label: 'Linens', desc: 'Default tablecloths, overlays, and drapery configurations.' },
  { id: 'guideline', label: 'Guidelines', desc: 'Safety buffers, emergency exit guides, and spacing rules.' },
  { id: 'spacing', label: 'Spacing Settings', desc: 'Pacing intervals and chair-to-table offset presets.' },
  { id: 'template', label: 'Layout Templates', desc: 'Global floorplan structures pre-seeded for easy reuse.' },
  { id: 'decor', label: 'Decor Inventory', desc: 'Manage your floral arrangements, lights, and arches.' },
  { id: 'branding', label: 'Venue Branding', desc: 'Customize venue presets, support details, and themes.' },
];

export function CatalogScreen({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<CatalogKind>('table');

  return (
    <>
      <PageHeader
        title="Admin & Catalog Studio"
        description="Complete operational center to manage layouts, decor, inventory, and venue branding."
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
                    'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between',
                    activeTab === k.id
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  ].join(' ')}
                >
                  <span>{k.label}</span>
                  {k.id === 'branding' && <Palette className="h-3.5 w-3.5" />}
                  {k.id === 'decor' && <Heart className="h-3.5 w-3.5" />}
                  {k.id === 'fixture' && <Layers className="h-3.5 w-3.5" />}
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

// ─── Generic Catalog Item Manager (For SdkCatalogItems) ───────────────────
function CatalogManager({ orgId, kind }: { orgId: string; kind: Exclude<CatalogKind, 'decor' | 'branding'> }) {
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const handleAdd = () => {
    let spec: any = {};
    if (kind === 'table') spec = { shape: 'round', radius: 30 };
    else if (kind === 'chair') spec = { radius: 10 };
    else if (kind === 'fixture') spec = { type: 'stage', width: 96, height: 144 };
    else spec = { desc: `Default ${kind} preset` };

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
      <div className="flex justify-between items-center bg-surface-2/60 p-3 rounded-lg border border-border">
        <span className="text-xs font-semibold text-fg-subtle">
          {localItems.length} configuration preset{localItems.length !== 1 ? 's' : ''}
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
            <Save className="w-4 h-4 mr-1" /> Save
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
              <div key={i} className="flex items-center gap-3 bg-surface p-3 rounded-lg border border-border hover:border-brand/40 transition-colors">
                <div className="flex-1">
                  <Input
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) => updateItem(i, 'name', e.target.value)}
                    className="h-9 text-xs font-semibold"
                  />
                </div>

                {/* Specific layouts based on kind */}
                {kind === 'table' && (
                  <>
                    <select
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
                      value={spec.shape || 'round'}
                      onChange={(e) => updateSpec(i, 'shape', e.target.value)}
                    >
                      <option value="round">Round</option>
                      <option value="rect">Rectangular</option>
                    </select>
                    {spec.shape === 'round' ? (
                      <Input
                        type="number"
                        placeholder="Radius (in)"
                        className="h-9 w-24 text-xs"
                        value={spec.radius || ''}
                        onChange={(e) => updateSpec(i, 'radius', parseInt(e.target.value))}
                      />
                    ) : (
                      <>
                        <Input
                          type="number"
                          placeholder="W (in)"
                          className="h-9 w-20 text-xs"
                          value={spec.width || ''}
                          onChange={(e) => updateSpec(i, 'width', parseInt(e.target.value))}
                        />
                        <Input
                          type="number"
                          placeholder="H (in)"
                          className="h-9 w-20 text-xs"
                          value={spec.height || ''}
                          onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))}
                        />
                      </>
                    )}
                  </>
                )}

                {kind === 'fixture' && (
                  <>
                    <select
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
                      value={spec.type || 'stage'}
                      onChange={(e) => updateSpec(i, 'type', e.target.value)}
                    >
                      <option value="stage">Stage</option>
                      <option value="dance_floor">Dance Floor</option>
                      <option value="bar">Bar Element</option>
                      <option value="backdrop">Backdrop</option>
                    </select>
                    <Input
                      type="number"
                      placeholder="W (in)"
                      className="h-9 w-20 text-xs"
                      value={spec.width || ''}
                      onChange={(e) => updateSpec(i, 'width', parseInt(e.target.value))}
                    />
                    <Input
                      type="number"
                      placeholder="H (in)"
                      className="h-9 w-20 text-xs"
                      value={spec.height || ''}
                      onChange={(e) => updateSpec(i, 'height', parseInt(e.target.value))}
                    />
                  </>
                )}

                {kind !== 'table' && kind !== 'fixture' && (
                  <div className="flex-1">
                    <Input
                      placeholder="Details / Hex Color / Spec description"
                      value={spec.desc || ''}
                      onChange={(e) => updateSpec(i, 'desc', e.target.value)}
                      className="h-9 text-xs text-fg-muted"
                    />
                  </div>
                )}

                <Button variant="ghost" size="icon" className="h-9 w-9 text-danger hover:bg-danger/10" onClick={() => removeRow(i)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Decor Manager ─────────────────────────────────────────────────────────
function DecorManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newItemName, setNewItemName] = useState('');

  const { data: decorData, isLoading } = useQuery({
    queryKey: ['decor-items', orgId],
    queryFn: () => sdk.decor.listItems(orgId),
  });

  const createMutation = useMutation({
    mutationFn: () => sdk.decor.createItem(orgId, { name: newItemName, visible: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-items', orgId] });
      setNewItemName('');
      toast({ title: 'Decor item added', variant: 'success' });
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

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const items = decorData?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="New Decor Item Name (e.g. Flower Arch, Centerpiece Vase)..."
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="h-10 text-xs"
        />
        <Button onClick={() => createMutation.mutate()} disabled={!newItemName.trim() || createMutation.isPending}>
          Add Decor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {items.length === 0 ? (
          <div className="col-span-2 text-center text-xs text-fg-muted py-10 border border-dashed rounded-lg">
            No decor items added yet.
          </div>
        ) : (
          items.map((it: any) => (
            <Card key={it.id} className="border border-border p-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-fg">{it.name}</h4>
                <p className="text-[10px] text-fg-subtle capitalize mt-0.5">Status: {it.visible ? 'Visible' : 'Hidden'}</p>
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

// ─── Branding Manager ──────────────────────────────────────────────────────
function BrandingManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState('Seven Paths Manor');
  const [supportEmail, setSupportEmail] = useState('hello@sevenpathsmanor.com');
  const [phone, setPhone] = useState('(555) 019-2831');
  const [webUrl, setWebUrl] = useState('https://sevenpathsmanor.com');
  const [brandColor, setBrandColor] = useState('#800020'); // Default Burgandy

  const saveBrandingMutation = useMutation({
    mutationFn: () => sdk.orgs.updateBranding(orgId, {
      name: orgName,
      support_email: supportEmail,
      phone,
      website_url: webUrl,
      brandColor,
    }),
    onSuccess: () => {
      toast({ title: 'Venue branding saved successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to update branding details', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-4">
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
