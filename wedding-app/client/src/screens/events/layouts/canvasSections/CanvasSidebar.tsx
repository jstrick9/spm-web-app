import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Arc } from 'react-konva';
import { cn } from '../../../../ui/lib/cn';
import {
  Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight,
  X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin, Sliders,
  PenTool, Undo2, Redo2, Grid, Activity, FileText, Keyboard, Printer, Eye, Umbrella, Smartphone, Maximize2, QrCode, Camera, ShieldCheck, ClipboardCheck, Accessibility, Zap
} from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { Badge } from '../../../../ui/Badge';
import { Input } from '../../../../ui/Input';
import { Label } from '../../../../ui/Label';
import { LAYOUT_OBJECT_PALETTE, LAYOUT_PALETTE_CATEGORIES, type LayoutPaletteCategory } from '.././layoutObjectPalette';
import { generateWeddingPackage, WEDDING_LAYOUT_PACKAGES, type WeddingLayoutPackage } from '.././weddingLayoutPackages';
import type { SdkEvent } from '../../../../sdk/types';
import { usePrompt } from '../../../../ui/usePrompt';

export interface CanvasSidebarProps {
  guestSearch: string;
  setGuestSearch: React.Dispatch<React.SetStateAction<string>>;
  items: any[];
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  sidebarTab: 'catalog' | 'guests' | 'decor' | 'layers' | 'history' | 'vendors';
  setSidebarTab: React.Dispatch<React.SetStateAction<'catalog' | 'guests' | 'decor' | 'layers' | 'history' | 'vendors'>>;
  paletteCategory: LayoutPaletteCategory;
  setPaletteCategory: React.Dispatch<React.SetStateAction<LayoutPaletteCategory>>;
  viewingVersion: any;
  setHasChanges: React.Dispatch<React.SetStateAction<any>>;
  packageGuests: any;
  setPackageGuests: React.Dispatch<React.SetStateAction<any>>;
  serviceStyle: any;
  setServiceStyle: React.Dispatch<React.SetStateAction<any>>;
  setSetupGroupOpen: React.Dispatch<React.SetStateAction<any>>;
  showVendorOverlay: any;
  setShowVendorOverlay: React.Dispatch<React.SetStateAction<any>>;
  draggedGuestRef: React.MutableRefObject<{ id: string; name: string; initials: string } | null>;
  inventoryData: any;
  guests: any[];
  DECOR_ITEMS: any[];
  layout: any;
  versions: any[];
  vendors: any[];
  allowedTemplateCategories: any;
  allowedTemplateInventory: any;
  pushState: (nextItems: any[]) => void;
  reconcileMappedInventory: (nextItems: any[]) => void;
  saveLayout: any;
  handleAddStickyNote: () => void;
  CATALOG_ITEMS: any[];
  handleAddItem: (catalogItem: any) => void;
  addWeddingPackage: (kind: WeddingLayoutPackage) => void;
  handleRestoreVersion: (version: any) => void;
  handlePreviewVersion: (version: any) => void;
  event: SdkEvent;
}

export function CanvasSidebar({ guestSearch, setGuestSearch, items, selectedId, setSelectedId, sidebarTab, setSidebarTab, paletteCategory, setPaletteCategory, viewingVersion, setHasChanges, packageGuests, setPackageGuests, serviceStyle, setServiceStyle, setSetupGroupOpen, showVendorOverlay, setShowVendorOverlay, draggedGuestRef, inventoryData, guests, DECOR_ITEMS, layout, versions, vendors, allowedTemplateCategories, allowedTemplateInventory, pushState, reconcileMappedInventory, saveLayout, handleAddStickyNote, CATALOG_ITEMS, handleAddItem, addWeddingPackage, handleRestoreVersion, handlePreviewVersion, event }: CanvasSidebarProps) {
  const { ask, askConfirm, promptNode } = usePrompt();
  return (
        <div className="w-64 border-r border-paper-border bg-paper flex flex-col overflow-hidden">
      {promptNode}
          <div className="flex flex-col border-b border-paper-border bg-paper px-1">
            <div className="flex w-full">
              <button className={cn("flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors", sidebarTab === 'catalog' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('catalog')}>Items</button>
              <button className={cn("flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors", sidebarTab === 'decor' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('decor')}><Flower2 className="w-3 h-3 mx-auto mb-0.5" />Decor</button>
              <button className={cn("flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors", sidebarTab === 'guests' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('guests')}><Search className="w-3 h-3 mx-auto mb-0.5" />Guests</button>
            </div>
            <div className="flex w-full">
              <button className={cn("flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors", sidebarTab === 'layers' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('layers')}><Layers className="w-3 h-3 mx-auto mb-0.5" />Layers</button>
              <button className={cn("flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors", sidebarTab === 'vendors' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('vendors')}><Truck className="w-3 h-3 mx-auto mb-0.5" />Vendors</button>
              <button className={cn("flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors", sidebarTab === 'history' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('history')}><History className="w-3 h-3 mx-auto mb-0.5" />Diff</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-paper">
            {sidebarTab === 'catalog' && (
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-brand/20 bg-brand-soft/20 p-2.5">
                  <div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-fg">Wedding setup packages</div><label className="text-[10px] text-fg-muted">Guests <input aria-label="Package guest count" className="ml-1 w-12 rounded border border-border bg-surface px-1 py-0.5" type="number" min="1" value={packageGuests} onChange={(e) => setPackageGuests(Math.max(1, Number(e.target.value) || 1))}/></label></div>
                  <p className="mt-0.5 text-[10px] leading-tight text-fg-muted">Add a complete editable starting proposal; venue structure stays protected.</p><label className="mt-2 block text-[10px] font-semibold text-fg-muted">Event service style<select aria-label="Event service style" className="mt-1 h-7 w-full rounded border border-border bg-surface px-1 text-[10px]" value={serviceStyle} onChange={(e) => { setServiceStyle(e.target.value); setHasChanges(true); }}><option value="ceremony">Ceremony</option><option value="cocktail">Cocktail</option><option value="plated">Reception · plated</option><option value="buffet_stations">Reception · buffet/stations</option><option value="family_style">Reception · family-style</option><option value="brunch">Brunch</option><option value="after_party">After-party</option></select></label>
                  <div className="mt-2 grid grid-cols-2 gap-1">{WEDDING_LAYOUT_PACKAGES.map((item) => <button key={item.id} type="button" title={item.description} onClick={() => addWeddingPackage(item.id)} className="rounded border border-brand/20 bg-surface px-1.5 py-1 text-left text-[10px] font-semibold hover:bg-brand-soft">{item.label}</button>)}</div>
                  <Button size="xs" className="mt-2 w-full" variant="secondary" onClick={() => setSetupGroupOpen(true)}>Create independent setup group</Button>
                </div>
                <div className="rounded-lg border border-brand/20 bg-brand-soft/20 p-2.5">
                  <div className="text-xs font-bold text-fg">Quick event design</div>
                  <p className="mt-0.5 text-[10px] leading-tight text-fg-muted">Choose an object, then drag it into place. Your changes remain a proposal until venue approval.</p>
                  <div className="mt-2 flex flex-wrap gap-1" aria-label="Design object categories">{LAYOUT_PALETTE_CATEGORIES.filter(category => !allowedTemplateCategories || allowedTemplateCategories.has(category.id)).map(category => <button key={category.id} type="button" onClick={() => setPaletteCategory(category.id)} className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', paletteCategory === category.id ? 'bg-brand text-white' : 'bg-surface text-fg-muted hover:bg-surface-2')}>{category.label}</button>)}</div>
                </div>
                {LAYOUT_OBJECT_PALETTE.filter(item => item.category === paletteCategory && (!allowedTemplateCategories || allowedTemplateCategories.has(item.category))).map((item) => (
                  <button key={item.label} onClick={() => handleAddItem(item)} className="p-2 border border-brand/25 bg-surface hover:bg-brand-soft/20 rounded text-sm text-left text-fg transition-all duration-150 flex items-center gap-2 font-medium">
                    <Plus className="w-4 h-4 text-brand" />{item.label}
                  </button>
                ))}
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Venue inventory & utilities</div>
                <button 
                  onClick={handleAddStickyNote}
                  className="p-2.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-xl text-xs text-left text-[#92400e] transition-all duration-150 flex items-center justify-between font-bold shadow-xs"
                >
                  <span className="flex items-center gap-1.5">📌 Drop Sticky Note Pin</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase bg-amber-100 border-amber-200">New</Badge>
                </button>
                {CATALOG_ITEMS.map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleAddItem(c)}
                    className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-all duration-150 flex items-center gap-2 font-medium"
                  >
                    <Move className="w-4 h-4 text-fg-muted" />
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === 'history' && (
              <div className="flex flex-col gap-4">
                 {layout && (
                   <div className="bg-surface p-3 rounded border border-border shadow-sm mb-2">
                     <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 flex justify-between items-center">
                       Current Layout
                       <Badge variant={layout.approval_status === 'approved' ? 'success' : layout.approval_status === 'pending' ? 'warning' : 'outline'} className="text-[10px] uppercase">{layout.approval_status}</Badge>
                     </div>
                     <div className="text-sm font-medium">Revision {layout.revision}</div>
                     <div className="text-xs text-fg-subtle mt-1 mb-2">Last updated {new Date(layout.updated_at).toLocaleString()}</div>
                     
                     <div className="flex gap-2">
                        <select 
                          className="text-xs bg-surface-2 border border-border rounded px-2 py-1 w-full"
                          value={layout.approval_status}
                          onChange={async (e) => {
                             const nextStatus = e.target.value;
                             if (await askConfirm({ title: `Change layout status to ${nextStatus}?` })) {
                                saveLayout.mutate({ ...JSON.parse(layout.payload as any), approvalStatus: nextStatus });
                             }
                          }}
                        >
                           <option value="draft">Draft</option>
                           <option value="pending">Pending Approval</option>
                           <option value="approved">Approved</option>
                           <option value="rejected">Rejected</option>
                        </select>
                     </div>
                   </div>
                 )}

                 <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider px-1">Version History</div>
                 {versions.length === 0 && <p className="text-xs text-fg-muted text-center py-4 italic">No previous versions.</p>}
                 
                 <div className="flex flex-col gap-3 overflow-y-auto">
                   {versions.map((v: any) => (
                     <div key={v.id} className={cn(
                       "flex flex-col gap-2 p-3 bg-surface rounded border transition-colors relative",
                       viewingVersion?.id === v.id ? "border-brand shadow-sm" : "border-border hover:border-brand/40"
                     )}>
                       <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              Rev {v.revision} 
                              {v.change_description && <span className="text-xs font-normal text-fg-muted bg-surface-2 px-1.5 rounded">{v.change_description}</span>}
                            </div>
                            <div className="text-[10px] text-fg-subtle mt-0.5">{new Date(v.created_at).toLocaleString()}</div>
                          </div>
                       </div>
                       
                       <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                          <Button 
                            variant={viewingVersion?.id === v.id ? "secondary" : "outline"} 
                            size="xs" 
                            className="flex-1 text-[10px] h-6"
                            onClick={() => handlePreviewVersion(viewingVersion?.id === v.id ? null : v)}
                          >
                            {viewingVersion?.id === v.id ? 'Exit Preview' : 'Preview Diff'}
                          </Button>
                          <Button 
                            variant="default" 
                            size="xs" 
                            className="flex-1 text-[10px] h-6"
                            onClick={() => handleRestoreVersion(v)}
                          >
                            Restore
                          </Button>
                       </div>
                   </div>
                   ))}
                 </div>
              </div>
            )}

            {sidebarTab === 'decor' && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Decor Library</div>
                {DECOR_ITEMS.map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleAddItem(c)}
                    className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center gap-2 font-medium"
                  >
                    <Plus className="w-4 h-4 text-brand" />
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === 'layers' && (
              <div className="flex flex-col gap-4">
                 <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Layers Panel</div>
                 <div className="text-[10px] text-fg-subtle mb-2 leading-tight">Drag to reorder z-index. Top of list renders in front.</div>
                 
                 <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto">
                   {[...items].reverse().map((item, reverseIdx) => {
                     const actualIdx = items.length - 1 - reverseIdx;
                     const isSelected = selectedId === item.id;
                     
                     return (
                       <div key={item.id} className={cn("flex items-center gap-2 p-2 rounded text-xs border", isSelected ? "bg-brand-soft border-brand text-brand-strong" : "bg-surface border-border")}>
                          <button className="text-fg-subtle hover:text-fg cursor-grab active:cursor-grabbing" aria-label={`Drag ${item.label || item.type}`}><GripVertical className="w-3 h-3" /></button>
                          <span className="truncate flex-1 font-semibold cursor-pointer" onClick={() => setSelectedId(item.id)}>{item.label || item.type}</span>
                          
                          <div className="flex flex-col gap-1 items-end">
                             <button onClick={() => {
                               if (actualIdx === items.length - 1) return;
                               const newItems = [...items];
                               [newItems[actualIdx], newItems[actualIdx+1]] = [newItems[actualIdx+1], newItems[actualIdx]];
                               pushState(newItems);
                             }} className="p-0.5 hover:bg-black/10 rounded">▲</button>
                             <button onClick={() => {
                               if (actualIdx === 0) return;
                               const newItems = [...items];
                               [newItems[actualIdx], newItems[actualIdx-1]] = [newItems[actualIdx-1], newItems[actualIdx]];
                               pushState(newItems);
                             }} className="p-0.5 hover:bg-black/10 rounded">▼</button>
                          </div>
                       </div>
                     );
                   })}
                 </div>
                 
                 {selectedId && (() => {
                   const activeItem = items.find(i => i.id === selectedId);
                   if (!activeItem) return null;
                   
                   if (activeItem.type === 'sticky_note') {
                     const isResolved = activeItem.resolved === true;
                     return (
                       <div className="mt-4 pt-4 border-t border-border space-y-3 bg-paper p-4 rounded-xl border border-paper-border text-xs font-semibold">
                          <div className="text-xs font-bold text-fg-muted uppercase tracking-wider font-serif text-brand flex items-center gap-1.5">
                             📌 Sticky Note Comment
                          </div>
                          <p className="text-[10px] text-fg-subtle">Enter your feedback or note to coordinate with your planner in real-time.</p>
                          
                          <div>
                            <label className="text-fg-subtle block mb-1">Author / Signer</label>
                            <input 
                              type="text" 
                              className="w-full bg-surface border border-paper-border rounded px-2.5 py-1.5 font-semibold"
                              value={activeItem.author || ''}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, author: e.target.value} : i));
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Note Comment Text</label>
                            <textarea
                              className="w-full bg-surface border border-paper-border rounded px-2.5 py-1.5 min-h-[70px] text-xs font-semibold"
                              value={activeItem.text || ''}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, text: e.target.value} : i));
                              }}
                            />
                          </div>

                          <div className="flex gap-2 pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="xs" 
                              className={cn("flex-1 text-[10px] font-bold h-7", isResolved ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200")}
                              onClick={() => {
                                pushState(items.map(i => i.id === selectedId ? {...i, resolved: !isResolved} : i));
                              }}
                            >
                               {isResolved ? 'Reopen Note' : 'Resolve Note'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="text-[10px] font-bold h-7 text-danger hover:bg-danger/10" 
                              onClick={() => {
                                const nextItems = items.filter(i => i.id !== selectedId);
                                pushState(nextItems); reconcileMappedInventory(nextItems);
                                setSelectedId(null);
                              }}
                            >
                               Delete
                            </Button>
                          </div>
                       </div>
                     );
                   }
                   
                   if (activeItem.type === 'custom_wall') {
                     return (
                       <div className="mt-4 pt-4 border-t border-border space-y-3 bg-paper p-4 rounded-xl border border-paper-border text-xs font-semibold">
                          <div className="text-xs font-bold text-fg-muted uppercase tracking-wider font-serif">Drawn Wall Properties</div>
                          
                          <div>
                            <label className="text-fg-subtle block mb-1">Wall Thickness (pixels)</label>
                            <input 
                              type="range" 
                              min="2" 
                              max="24"
                              className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand mt-1"
                              value={activeItem.strokeWidth || 5}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, strokeWidth: parseInt(e.target.value)} : i));
                              }}
                            />
                            <div className="text-right text-[10px] text-fg-subtle mt-0.5">{activeItem.strokeWidth || 5}px thickness</div>
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Height Bound (ft)</label>
                            <select 
                              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs mt-1"
                              value={activeItem.heightBound || '8'}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, heightBound: e.target.value} : i));
                              }}
                            >
                              <option value="6">6 ft Partition Panel</option>
                              <option value="8">8 ft Standard Drywall</option>
                              <option value="10">10 ft High Ceiling Altar</option>
                              <option value="12">12 ft Grand Cathedral Partition</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Wall Texture Style</label>
                            <select 
                              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs mt-1"
                              value={activeItem.texture || 'drywall'}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, texture: e.target.value} : i));
                              }}
                            >
                              <option value="drywall">🧱 Standard Drywall</option>
                              <option value="wood">🪵 Rustic Wood Panel</option>
                              <option value="brick">🧱 Rustic Brick finish</option>
                              <option value="concrete">🪨 Solid Raw Concrete</option>
                              <option value="plaster">✨ Smooth Plaster finish</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Paint / Stroke Hex Color</label>
                            <div className="flex gap-2 items-center mt-1">
                              <input 
                                type="color" 
                                className="h-8 w-10 border rounded cursor-pointer shrink-0"
                                value={activeItem.color || '#374151'}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                }}
                              />
                              <input 
                                type="text"
                                className="w-full bg-surface border border-paper-border rounded px-2 py-1 h-8"
                                value={activeItem.color || '#374151'}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                }}
                              />
                            </div>
                          </div>

                          <Button variant="outline" size="sm" className="w-full mt-3 text-danger hover:bg-danger/10 border-danger/20 font-bold" onClick={() => {
                             const nextItems = items.filter(i => i.id !== selectedId);
                             pushState(nextItems); reconcileMappedInventory(nextItems);
                             setSelectedId(null);
                          }}>Delete Wall</Button>
                       </div>
                     );
                   }
                   
                   return (
                     <div className="mt-4 pt-4 border-t border-paper-border space-y-3 bg-paper p-4 rounded-xl border border-paper-border text-xs font-semibold">
                        <div className="text-xs font-bold text-fg-muted uppercase tracking-wider font-serif">Transform Properties</div>
                        
                        {/* Dynamic Custom Property Editors based on Type */}
                        <div className="space-y-2 pb-3 border-b border-border/40">
                           <div>
                              <label className="text-fg-subtle block mb-1">Item Label / Name</label>
                              <input 
                                type="text" 
                                className="w-full bg-surface border border-paper-border rounded px-2.5 py-1.5"
                                value={activeItem.label || ''}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, label: e.target.value} : i));
                                }}
                              />
                           </div>

                           {['round_table', 'rect_table', 'chair', 'decor'].includes(activeItem.type) && <div><label className="text-fg-subtle block mb-1">Venue inventory mapping</label><select aria-label="Venue inventory mapping" className="w-full bg-surface border border-paper-border rounded px-2 py-1" value={activeItem.inventoryItemId || ''} onChange={(e) => { const inventoryItemId = e.target.value || undefined; const nextItems = items.map((item) => item.id === selectedId ? { ...item, inventoryItemId } : item); pushState(nextItems); reconcileMappedInventory(nextItems); }}><option value="">Not reserved from venue inventory</option>{(inventoryData?.items || []).filter((item: any) => { try { const type = JSON.parse(item.spec || '{}').objectType; return ((activeItem.type.includes('table') && type === 'table') || (activeItem.type === 'chair' && type === 'chair') || (activeItem.type === 'decor' && type === 'decor')) && (!allowedTemplateInventory || allowedTemplateInventory.has(item.id)); } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div>}
                           {(activeItem.type === 'round_table' || activeItem.type === 'rect_table') && (
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                 <div>
                                    <label className="text-fg-subtle block mb-1">Seating Capacity</label>
                                    <input 
                                      type="number" 
                                      className="w-full bg-surface border border-paper-border rounded px-2 py-1"
                                      value={activeItem.capacity || 8}
                                      onChange={(e) => {
                                        pushState(items.map(i => i.id === selectedId ? {...i, capacity: parseInt(e.target.value)} : i));
                                      }}
                                    />
                                 </div>
                                 {activeItem.type === 'round_table' ? (
                                    <div>
                                       <label className="text-fg-subtle block mb-1">Diameter (px)</label>
                                       <input 
                                         type="number" 
                                         className="w-full bg-surface border border-paper-border rounded px-2 py-1"
                                         value={activeItem.radius ? activeItem.radius * 2 : 60}
                                         onChange={(e) => {
                                           pushState(items.map(i => i.id === selectedId ? {...i, radius: parseFloat(e.target.value) / 2} : i));
                                         }}
                                       />
                                    </div>
                                 ) : (
                                    <div>
                                       <label className="text-fg-subtle block mb-1">Width (px)</label>
                                       <input 
                                         type="number" 
                                         className="w-full bg-surface border border-paper-border rounded px-2 py-1"
                                         value={activeItem.width || 120}
                                         onChange={(e) => {
                                           pushState(items.map(i => i.id === selectedId ? {...i, width: parseFloat(e.target.value)} : i));
                                         }}
                                       />
                                    </div>
                                 )}
                              </div>
                           )}

                           {activeItem.type === 'chair' && (
                              <div className="mt-1">
                                 <label className="text-fg-subtle block mb-1">Assign Guest Directly</label>
                                 <select
                                   className="w-full bg-surface border border-paper-border rounded px-2 py-1.5 text-xs mt-1"
                                   value={activeItem.guestId || ''}
                                   onChange={(e) => {
                                      const selectedGuestId = e.target.value;
                                      if (!selectedGuestId) {
                                         pushState(items.map(i => i.id === selectedId ? { ...i, guestId: null, guestName: null, guestInitials: null } : i));
                                      } else {
                                         const g = guests.find(guest => guest.id === selectedGuestId);
                                         if (g) {
                                            const parts = g.full_name.split(' ');
                                            const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
                                            pushState(items.map(i => i.id === selectedId ? { 
                                               ...i, 
                                               guestId: g.id, 
                                               guestName: g.full_name, 
                                               guestInitials: initials.toUpperCase() 
                                            } : i));
                                         }
                                      }
                                   }}
                                 >
                                    <option value="">-- No Guest Assigned --</option>
                                    {guests.map(g => (
                                       <option key={g.id} value={g.id}>{g.full_name}</option>
                                    ))}
                                 </select>
                              </div>
                           )}

                           {activeItem.type === 'decor' && (
                              <div className="mt-1">
                                 <label className="text-fg-subtle block mb-1">Decor Display Color</label>
                                 <div className="flex gap-2 items-center mt-1">
                                   <input 
                                     type="color" 
                                     className="h-8 w-10 border rounded cursor-pointer shrink-0"
                                     value={activeItem.color || '#D4AF37'}
                                     onChange={(e) => {
                                       pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                     }}
                                   />
                                   <input 
                                     type="text"
                                     className="w-full bg-surface border border-paper-border rounded px-2 py-1 h-8"
                                     value={activeItem.color || '#D4AF37'}
                                     onChange={(e) => {
                                       pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                     }}
                                   />
                                 </div>
                              </div>
                           )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <div>
                              <label className="text-fg-subtle block mb-1">X Coordinate</label>
                              <input 
                                type="number" 
                                className="w-full bg-surface border border-paper-border rounded px-2 py-1"
                                value={Math.round(activeItem.x || 0)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: parseFloat(e.target.value)} : i));
                                }}
                              />
                           </div>
                           <div>
                              <label className="text-fg-subtle block mb-1">Y Coordinate</label>
                              <input 
                                type="number" 
                                className="w-full bg-surface border border-border rounded px-2 py-1"
                                value={Math.round(activeItem.y || 0)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, y: parseFloat(e.target.value)} : i));
                                }}
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <div>
                              <label className="text-fg-subtle block mb-1">Rotation (deg)</label>
                              <input 
                                type="number" 
                                className="w-full bg-surface border border-border rounded px-2 py-1"
                                value={Math.round(activeItem.rotation || 0)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, rotation: parseFloat(e.target.value)} : i));
                                }}
                              />
                           </div>
                           <div>
                              <label className="text-fg-subtle block mb-1">Opacity (%)</label>
                              <input 
                                type="number" 
                                min="10" max="100"
                                className="w-full bg-surface border border-border rounded px-2 py-1"
                                value={Math.round((activeItem.opacity || 1) * 100)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, opacity: parseFloat(e.target.value)/100} : i));
                                }}
                              />
                           </div>
                        </div>
                        
                        <div className="pt-2 border-t border-border space-y-2 text-xs">
                           <div className="text-fg-subtle block font-bold mb-1">Alignment &amp; Position Nudges</div>
                           <div className="grid grid-cols-2 gap-2">
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="text-[10px] h-7 font-bold"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: Math.round((i.x || 0) / 20) * 20, y: Math.round((i.y || 0) / 20) * 20} : i));
                                }}
                              >
                                📐 Snap to Grid (20px)
                              </Button>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="text-[10px] h-7 font-bold"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, rotation: 0} : i));
                                }}
                              >
                                🔄 Reset Rotation
                              </Button>
                           </div>
                           <div className="flex gap-1.5 items-center justify-center pt-1">
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="h-7 w-12 font-black text-sm"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: (i.x || 0) - 5} : i));
                                }}
                              >
                                ←
                              </Button>
                              <div className="flex flex-col gap-1">
                                 <Button 
                                   variant="outline" 
                                   size="xs" 
                                   className="h-7 w-12 font-black text-sm"
                                   onClick={() => {
                                     pushState(items.map(i => i.id === selectedId ? {...i, y: (i.y || 0) - 5} : i));
                                   }}
                                 >
                                   ↑
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="xs" 
                                   className="h-7 w-12 font-black text-sm"
                                   onClick={() => {
                                     pushState(items.map(i => i.id === selectedId ? {...i, y: (i.y || 0) + 5} : i));
                                   }}
                                 >
                                   ↓
                                 </Button>
                              </div>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="h-7 w-12 font-black text-sm"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: (i.x || 0) + 5} : i));
                                }}
                              >
                                →
                              </Button>
                           </div>
                           <div className="text-center text-[9px] text-fg-subtle">Nudges selected item by 5px intervals</div>
                        </div>

                        <Button variant="outline" size="sm" className="w-full mt-2 text-danger hover:bg-danger/10 border-danger/20 font-bold" onClick={() => {
                           const nextItems = items.filter(i => i.id !== selectedId);
                           pushState(nextItems); reconcileMappedInventory(nextItems);
                           setSelectedId(null);
                        }}>Delete Item</Button>
                     </div>
                   );
                 })()}
              </div>
            )}

            {sidebarTab === 'vendors' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Vendor Overlay</span>
                  <label className="flex items-center gap-2 text-xs cursor-pointer font-bold">
                    <input type="checkbox" checked={showVendorOverlay} onChange={(e) => setShowVendorOverlay(e.target.checked)} className="rounded border-border text-brand focus:ring-brand h-4 w-4 cursor-pointer" />
                    Show Overlay
                  </label>
                </div>

                {vendors.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-border rounded text-xs text-fg-muted">No vendors assigned.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-fg-subtle leading-tight mb-2">Drag a vendor onto the canvas to mark their setup zone. Draw routes by shift-clicking points.</div>
                    {vendors.map(v => (
                      <div 
                        key={v.id} 
                        className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing font-medium"
                        draggable
                        onDragStart={(e) => {
                          draggedGuestRef.current = { id: v.id, name: v.name, initials: 'V' };
                        }}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.id.length > 5 ? '#3b82f6' : '#ec4899' }} />
                          <span className="truncate">{v.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase bg-surface-2">{v.category}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 border-t pt-3 mt-2">
                  <span className="text-[10px] font-black uppercase text-brand tracking-widest block">Quick Vendor Setup Blocks</span>
                  <div className="grid grid-cols-2 gap-2 text-left">
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'Catering Staging Zone', props: { width: 120, height: 60, vendorName: 'Catering Prep' } })}
                     >
                       🔨 Catering Zone
                     </Button>
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'DJ Booth Area', props: { width: 80, height: 50, vendorName: 'DJ Booth' } })}
                     >
                       🎵 DJ Booth
                     </Button>
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'Floristry Setup Spot', props: { width: 100, height: 50, vendorName: 'Floral Setup' } })}
                     >
                       🌸 Florist Spot
                     </Button>
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'Bar Station Line', props: { width: 140, height: 40, vendorName: 'Main Bar' } })}
                     >
                       🍹 Bar Station
                     </Button>
                  </div>
                </div>

              </div>
            )}

            {sidebarTab === 'guests' && (() => {
              const assignedIds = new Set(items.map(i => i.guestId).filter(Boolean));
              const unassigned = guests.filter(g => 
                !assignedIds.has(g.id) && 
                g.full_name.toLowerCase().includes(guestSearch.toLowerCase())
              );
              
              return (
                <div className="flex flex-col gap-2">
                  <div className="mb-2">
                    <Input 
                      placeholder="Search guests..." 
                      value={guestSearch} 
                      onChange={(e) => setGuestSearch(e.target.value)}
                      className="text-xs h-8 border-paper-border"
                    />
                  </div>
                  <p className="text-xs text-fg-subtle mb-1 font-bold">{unassigned.length} unassigned guests matching</p>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1">
                    {unassigned.map(g => {
                      const parts = g.full_name.split(' ');
                      const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
                      return (
                        <div 
                          key={g.id}
                          draggable
                          onDragStart={(e) => {
                            draggedGuestRef.current = { id: g.id, name: g.full_name, initials: initials.toUpperCase() };
                          }}
                          className="p-2 border border-border bg-surface rounded text-sm text-fg cursor-grab active:cursor-grabbing flex items-center gap-2 hover:border-brand/40 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] flex items-center justify-center font-bold">
                            {initials.toUpperCase()}
                          </div>
                          <span className="truncate font-semibold">{g.full_name}</span>
                        </div>
                      );
                    })}
                    {unassigned.length === 0 && (
                      <p className="text-sm text-fg-muted text-center py-4 italic">No unassigned guests found</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
  );
}
