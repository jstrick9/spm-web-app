import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Save, Settings, Trash2 } from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkCatalogItem } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Skeleton } from '../../ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { useToast } from '../../ui/Toast';

interface Props {
  orgId: string;
}

type CatalogKind = 'table' | 'chair' | 'dance_floor' | 'stage';
const KINDS: { id: CatalogKind, label: string }[] = [
  { id: 'table', label: 'Tables' },
  { id: 'chair', label: 'Chairs' },
  { id: 'dance_floor', label: 'Dance Floors' },
  { id: 'stage', label: 'Stages' },
];

export function CatalogScreen({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<CatalogKind>('table');

  return (
    <>
      <PageHeader
        title="Catalog Studio"
        description="Manage your global inventory to drive the layout builder."
      />
      <PageBody>
        <Card className="min-h-[500px]">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CatalogKind)}>
            <div className="border-b border-border p-4 bg-surface-2/30">
              <TabsList>
                {KINDS.map(k => (
                  <TabsTrigger key={k.id} value={k.id}>{k.label}</TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <div className="p-6">
              {KINDS.map(k => (
                <TabsContent key={k.id} value={k.id}>
                  <CatalogManager orgId={orgId} kind={k.id} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </Card>
      </PageBody>
    </>
  );
}

function CatalogManager({ orgId, kind }: { orgId: string; kind: CatalogKind }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  // Actually maps to fixture or table
  const mappedKind = kind === 'chair' || kind === 'dance_floor' || kind === 'stage' ? 'fixture' : kind;

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', orgId, mappedKind],
    queryFn: () => sdk.catalog.list(orgId, mappedKind as any),
  });

  const [localItems, setLocalItems] = useState<Partial<SdkCatalogItem>[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  React.useEffect(() => {
    if (data) {
      // Filter out sub-types if using generic fixture
      const relevant = data.items.filter(i => {
         if (mappedKind === 'fixture') {
            try {
               const spec = JSON.parse(i.spec as any || '{}');
               return spec.type === kind;
            } catch { return false; }
         }
         return true;
      });
      setLocalItems(relevant);
      setHasChanges(false);
    }
  }, [data, kind, mappedKind]);

  const saveMutation = useMutation({
    mutationFn: async (items: any[]) => {
      // Fetch all to avoid overwriting other fixtures
      const allRes = await sdk.catalog.list(orgId, mappedKind as any);
      let allItems = allRes.items;
      
      if (mappedKind === 'fixture') {
         // Keep others, replace ours
         const others = allItems.filter(i => {
            try {
               const spec = JSON.parse(i.spec as any || '{}');
               return spec.type !== kind;
            } catch { return true; }
         });
         return sdk.catalog.replaceAll(orgId, mappedKind as any, [...others, ...items]);
      }
      return sdk.catalog.replaceAll(orgId, mappedKind as any, items);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog', orgId, mappedKind] });
      toast({ title: 'Catalog saved', variant: 'success' });
      setHasChanges(false);
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  });

  if (isLoading) return <div className="space-y-2">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const handleAdd = () => {
    let spec: any = { type: kind };
    if (kind === 'table') spec = { shape: 'round', radius: 30 };
    if (kind === 'chair') spec = { type: 'chair', radius: 10 };
    if (kind === 'dance_floor') spec = { type: 'dance_floor', width: 144, height: 144 };
    
    setLocalItems([...localItems, {
      name: `New ${kind.replace('_', ' ')}`,
      spec: JSON.stringify(spec),
      visible: true
    } as any]);
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
    setLocalItems(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex justify-between items-center bg-surface-2 p-3 rounded border border-border">
        <div>
           <h3 className="text-sm font-medium">Manage {kind.replace('_', ' ')}s</h3>
           <p className="text-xs text-fg-muted">These items will appear in the canvas layout builder.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={handleAdd}><Plus className="w-4 h-4 mr-1"/> Add Item</Button>
           <Button 
             size="sm" 
             onClick={() => saveMutation.mutate(localItems.map(i => ({...i, spec: typeof i.spec === 'string' ? JSON.parse(i.spec) : i.spec })))} 
             disabled={!hasChanges || saveMutation.isPending}
           >
             <Save className="w-4 h-4 mr-1"/> Save Changes
           </Button>
        </div>
      </div>

      <div className="space-y-3">
        {localItems.length === 0 ? (
          <div className="text-center text-sm text-fg-muted py-8 border border-dashed rounded">No items configured yet.</div>
        ) : (
          localItems.map((item, i) => {
            const spec = typeof item.spec === 'string' ? JSON.parse(item.spec || '{}') : (item.spec || {});
            return (
              <div key={i} className="flex items-center gap-3 bg-surface p-3 rounded border border-border hover:border-brand/50 transition-colors">
                <div className="flex-1">
                  <Input 
                    placeholder="Item Name" 
                    value={item.name} 
                    onChange={e => updateItem(i, 'name', e.target.value)} 
                    className="h-8 font-medium"
                  />
                </div>
                
                {/* Dynamic Spec Inputs based on kind */}
                {kind === 'table' && (
                  <>
                    <select 
                      className="h-8 rounded border-border bg-surface px-2 text-sm"
                      value={spec.shape || 'round'}
                      onChange={e => updateSpec(i, 'shape', e.target.value)}
                    >
                      <option value="round">Round</option>
                      <option value="rect">Rectangular</option>
                    </select>
                    {spec.shape === 'round' ? (
                      <Input type="number" placeholder="Radius (in)" className="h-8 w-24" value={spec.radius || ''} onChange={e => updateSpec(i, 'radius', parseInt(e.target.value))} />
                    ) : (
                      <>
                        <Input type="number" placeholder="W (in)" className="h-8 w-20" value={spec.width || ''} onChange={e => updateSpec(i, 'width', parseInt(e.target.value))} />
                        <Input type="number" placeholder="H (in)" className="h-8 w-20" value={spec.height || ''} onChange={e => updateSpec(i, 'height', parseInt(e.target.value))} />
                      </>
                    )}
                  </>
                )}

                {(kind === 'dance_floor' || kind === 'stage') && (
                  <>
                    <Input type="number" placeholder="Width (in)" className="h-8 w-24" value={spec.width || ''} onChange={e => updateSpec(i, 'width', parseInt(e.target.value))} />
                    <Input type="number" placeholder="Length (in)" className="h-8 w-24" value={spec.height || ''} onChange={e => updateSpec(i, 'height', parseInt(e.target.value))} />
                  </>
                )}

                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10" onClick={() => removeRow(i)}>
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
