import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Skeleton } from '../../../ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { useToast } from '../../../ui/Toast';
import { usePrompt } from '../../../ui/usePrompt';

export function DecorManager({ orgId }: { orgId: string }) {
  const { askConfirm, promptNode } = usePrompt();
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
      {promptNode}
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
                  <Card key={it.id} className="border border-border p-3.5 flex items-center justify-between gap-3 bg-paper shadow-sm">
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
                        onClick={async () => { if (await askConfirm({ title: `Delete ${it.name}?`, description: 'This decor item cannot be restored.', destructive: true })) deleteItemMutation.mutate(it.id); }}
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
                <Card key={c.id} className="border border-border p-3.5 flex items-center justify-between gap-3 bg-paper shadow-sm">
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
                    onClick={async () => { if (await askConfirm({ title: `Delete ${c.name}?`, description: 'Decor items may need to be reassigned.', destructive: true })) deleteCategoryMutation.mutate(c.id); }}
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
