/**
 * InventoryManager — Phase 21: wired to real inventory backend.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Search, Plus, AlertTriangle, Trash2 } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkInventoryItem } from '../../../sdk/inventory';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Badge } from '../../../ui/Badge';
import { StatCard } from '../../../ui/StatCard';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';
import { usePrompt } from '../../../ui/usePrompt';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../../ui/Dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../ui/Select';

interface Props { orgId: string }

const CONDITION_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  good: 'success', fair: 'warning', poor: 'danger', maintenance: 'danger',
};

export function InventoryManager({ orgId }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', orgId],
    queryFn: () => sdk.inventory.list(orgId),
  });

  const items = data?.items ?? [];
  const stats = data?.stats ?? { total: 0, lowStock: 0, maintenance: 0 };

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.inventory.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', orgId] });
      toast({ title: 'Item removed', variant: 'success' });
    },
    onError: (error: any) => {
      const reserved = error?.code === 'inventory-item-has-reservations';
      toast({ title: reserved ? 'Item is reserved by active layouts' : 'Could not remove item', description: reserved ? 'Remove or reassign the layout reservations before deleting this inventory item.' : error?.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <><PageHeader title="Inventory" /><PageBody><Skeleton className="h-48" /></PageBody></>;
  }

  return (
    <>
      {promptNode}
      <PageHeader
        title="Inventory Manager"
        description="Track physical assets, stock levels, and maintenance status."
      />
      <PageBody className="space-y-5">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <StatCard label="Total Items" value={stats.total} />
          <StatCard
            label="Low Stock"
            value={stats.lowStock}
            description={stats.lowStock > 0 ? 'items below threshold' : undefined}
          />
          <StatCard
            label="Maintenance"
            value={stats.maintenance}
            description={stats.maintenance > 0 ? 'need attention' : undefined}
          />
        </div>

        {/* Alerts */}
        {stats.lowStock > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {stats.lowStock} item{stats.lowStock > 1 ? 's' : ''} below minimum stock level
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
            <Input
              placeholder="Search by name or SKU…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <AddInventoryDialog orgId={orgId} open={addOpen} onOpenChange={setAddOpen} />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-fg-muted text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 text-fg-subtle" />
                {search ? 'No items match your search.' : 'No inventory items yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50">
                      <th className="px-4 py-3 text-left font-medium text-fg-muted hidden sm:table-cell">SKU</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted">Item</th>
                      <th className="px-4 py-3 text-center font-medium text-fg-muted">Total</th>
                      <th className="px-4 py-3 text-center font-medium text-fg-muted">Available</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted hidden sm:table-cell">Condition</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-surface-2/30">
                        <td className="px-4 py-3 font-mono text-xs text-fg-muted hidden sm:table-cell">{item.sku || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-fg-subtle mt-0.5">
                            {item.category} · {item.owner_type.replace('_', ' ')}
                          </div>{(() => { try { const spec = JSON.parse(item.spec || '{}'); return spec.objectType === 'table' ? <div className="text-[10px] text-fg-muted">{spec.widthFeet || '?'}×{spec.depthFeet || '?'} ft · {Object.entries(spec.seatingCapacities || {}).map(([style, seats]) => `${style.replace('_', ' ')} ${seats}`).join(' · ')}</div> : null; } catch { return null; } })()}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{item.total_count}</td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          <span className={item.available_count < 10 ? 'text-warning font-medium' : ''}>
                            {item.available_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant={CONDITION_BADGE[item.condition] ?? 'default'} className="text-[10px]">
                            {item.condition}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={async () => { if (await askConfirm({ title: 'Remove this inventory item?', destructive: true })) deleteMutation.mutate(item.id); }} className="p-1 text-fg-subtle hover:text-danger rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

// ─── Add Dialog ─────────────────────────────────────────
function AddInventoryDialog({ orgId, open, onOpenChange }: {
  orgId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('other');
  const [totalCount, setTotalCount] = useState('0');
  const [objectType, setObjectType] = useState<'table'|'chair'|'decor'|'fixture'|'other'>('other');
  const [widthFeet, setWidthFeet] = useState(''); const [depthFeet, setDepthFeet] = useState('');
  const [platedSeats, setPlatedSeats] = useState(''); const [familySeats, setFamilySeats] = useState(''); const [cocktailSeats, setCocktailSeats] = useState('');

  const createMutation = useMutation({
    mutationFn: () => sdk.inventory.create(orgId, {
      name, sku: sku || undefined, category,
      totalCount: parseInt(totalCount) || 0,
      availableCount: parseInt(totalCount) || 0,
      spec: { objectType, ...(widthFeet ? { widthFeet: Number(widthFeet) } : {}), ...(depthFeet ? { depthFeet: Number(depthFeet) } : {}), ...(objectType === 'table' ? { seatingCapacities: { ...(platedSeats ? { plated: Number(platedSeats) } : {}), ...(familySeats ? { family_style: Number(familySeats) } : {}), ...(cocktailSeats ? { cocktail: Number(cocktailSeats) } : {}) } } : {}) },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', orgId] });
      toast({ title: 'Item added', variant: 'success' });
      onOpenChange(false); setName(''); setSku(''); setTotalCount('0');
    },
    onError: () => { toast({ title: 'Could not add item', variant: 'destructive' }); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
          <div><Label>SKU (optional)</Label><Input value={sku} onChange={e => setSku(e.target.value)} className="mt-1 font-mono" /></div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['chair','linen','centerpiece','av','lighting','tableware','other'].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Count</Label><Input type="number" min={0} value={totalCount} onChange={e => setTotalCount(e.target.value)} className="mt-1" /></div>
          <div><Label>Layout object type</Label><Select value={objectType} onValueChange={(value) => setObjectType(value as typeof objectType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['table','chair','decor','fixture','other'].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
          {objectType === 'table' && <><div className="grid grid-cols-2 gap-3"><div><Label>Width (ft)</Label><Input type="number" min="0" value={widthFeet} onChange={e => setWidthFeet(e.target.value)} className="mt-1" placeholder="6" /></div><div><Label>Depth (ft)</Label><Input type="number" min="0" value={depthFeet} onChange={e => setDepthFeet(e.target.value)} className="mt-1" placeholder="6" /></div></div><div><Label>Seating capacities by service style</Label><div className="mt-1 grid grid-cols-3 gap-2"><Input aria-label="Plated seating capacity" type="number" min="0" value={platedSeats} onChange={e => setPlatedSeats(e.target.value)} placeholder="Plated"/><Input aria-label="Family style seating capacity" type="number" min="0" value={familySeats} onChange={e => setFamilySeats(e.target.value)} placeholder="Family"/><Input aria-label="Cocktail seating capacity" type="number" min="0" value={cocktailSeats} onChange={e => setCocktailSeats(e.target.value)} placeholder="Cocktail"/></div></div></>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} isLoading={createMutation.isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
