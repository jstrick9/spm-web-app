import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Arc } from 'react-konva';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutsSdk } from '../../../sdk/layouts';
import { guestsSdk } from '../../../sdk/guests';
import { sdk } from '../../../sdk';
import { cn } from '../../../ui/lib/cn';
import type { SdkEvent, SdkLayout } from '../../../sdk/types';
import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin } from 'lucide-react';
import { vendorsSdk } from '../../../sdk/vendors';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';

interface Props {
  event: SdkEvent;
}

const DEFAULT_ITEMS = [
  { id: 't1', type: 'round_table', x: 200, y: 200, radius: 40, label: 'Table 1', rotation: 0 },
  { id: 't2', type: 'rect_table', x: 400, y: 150, width: 120, height: 60, label: 'Head Table', rotation: 15 },
  { id: 'c1', type: 'chair', x: 200, y: 140, radius: 10, label: '', rotation: 0 },
  { id: 'd1', type: 'dance_floor', x: 400, y: 400, width: 150, height: 150, label: 'Dance Floor', rotation: 0 }
];

export function CanvasPage({ event }: Props) {
  const qc = useQueryClient();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [routePoints, setRoutePoints] = useState<number[]>([]);
  
  // Data Fetching
  const { data: guestsData } = useQuery({
    queryKey: ['guests', event.id],
    queryFn: () => guestsSdk.list(event.id),
  });
  const guests = guestsData?.guests || [];

  
  const { data: decorData } = useQuery({
    queryKey: ['decor', event.organization_id],
    queryFn: () => sdk.catalog.list(event.organization_id, 'decor' as any), // assuming 'decor' maps generically, we will mock if empty
  });
  
  const DECOR_ITEMS = [
    { label: 'Floral Centerpiece', type: 'decor', props: { width: 20, height: 20, shape: 'circle', color: '#fbcfe8' } },
    { label: 'Candle Cluster', type: 'decor', props: { width: 10, height: 10, shape: 'circle', color: '#fef08a' } },
    { label: 'Archway', type: 'decor', props: { width: 80, height: 20, shape: 'rect', color: '#dcfce7' } },
    { label: 'Aisle Runner', type: 'decor', props: { width: 40, height: 200, shape: 'rect', color: '#f3f4f6' } },
    { label: 'Draping', type: 'decor', props: { width: 100, height: 10, shape: 'rect', color: '#e0e7ff' } }
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['layouts', event.id],
    queryFn: () => layoutsSdk.list(event.organization_id, { eventId: event.id }),
  });
  
  const layout = data?.layouts?.[0];
  const [items, setItems] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trRef = useRef<any>(null);
  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'decor' | 'layers' | 'history' | 'vendors'>('catalog');
  const [showVendorOverlay, setShowVendorOverlay] = useState(false);
  const [vendorLines, setVendorLines] = useState<any[]>([]);
  const [viewingVersion, setViewingVersion] = useState<any>(null);
  
  const { data: versionsData } = useQuery({
    queryKey: ['layouts', layout?.id, 'versions'],
    queryFn: () => layoutsSdk.listVersions(layout!.id),
    enabled: !!layout?.id,
  });
  const versions = (versionsData as any)?.versions || [];

  
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', event.id],
    queryFn: () => vendorsSdk.list(event.organization_id, { eventId: event.id }),
  });
  const vendors = vendorsData?.vendors || [];

  const draggedGuestRef = useRef<{ id: string; name: string; initials: string } | null>(null);

  // Initialize state once layout loads
  useEffect(() => {
    if (data) {
      if (layout && layout.payload && Array.isArray((layout.payload as any).items)) {
        setItems((layout.payload as any).items);
        setVendorLines((layout.payload as any).vendorLines || []);
      } else {
        setItems(DEFAULT_ITEMS);
      }
      setHasChanges(false);
    }
  }, [data, layout]);

  // Mutations
  const createLayout = useMutation({
    mutationFn: (payload: any) => layoutsSdk.create({
      organizationId: event.organization_id,
      eventId: event.id,
      name: 'Primary Layout',
      payload: { items: payload, vendorLines }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layouts', event.id] });
      setHasChanges(false);
    }
  });

  const saveLayout = useMutation({
    mutationFn: (payload: any) => layoutsSdk.save(layout!.id, { items: payload.items || payload, vendorLines: payload.vendorLines || vendorLines }, { approvalStatus: payload.approvalStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layouts', event.id] });
      setHasChanges(false);
    }
  });

  const handleSave = () => {
    if (layout) {
      saveLayout.mutate(items);
    } else {
      createLayout.mutate(items);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragEnd = (e: any, id: string) => {
    const node = e.target;
    setItems((prev) => 
      prev.map(i => i.id === id ? { 
        ...i, 
        x: node.x(), 
        y: node.y(), 
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY()
      } : i)
    );
    // We also need to map the old door/window logic if it exists
    setItems((prev) => 
      prev.map(item => item.id === id ? { ...item, x: node.x(), y: node.y() } : item)
    );
    setHasChanges(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedGuestRef.current) return;
    
    // We need to map the drop coordinate into the stage
    // Note: this is a simple approximation relying on the container bounding rect
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const point = {
      x: (x - pos.x) / scale,
      y: (y - pos.y) / scale
    };


    const isVendor = !!vendors.find(v => v.id === draggedGuestRef.current!.id);

    if (isVendor) {
       // Drop Vendor Zone
       const newZone = {
          id: `vz-${Date.now()}`,
          type: 'vendor_zone',
          vendorId: draggedGuestRef.current!.id,
          vendorName: draggedGuestRef.current!.name,
          x: point.x,
          y: point.y,
          width: 100,
          height: 100,
          rotation: 0
       };
       setItems(prev => [...prev, newZone]);
       setHasChanges(true);
       setShowVendorOverlay(true);
       draggedGuestRef.current = null;
       return;
    }


    // Find if we dropped near a chair
    const chair = items.find(i => i.type === 'chair' && Math.hypot(i.x - point.x, i.y - point.y) < (i.radius || 15));
    if (chair) {
       setItems(prev => prev.map(item =>
         item.id === chair.id ? { 
           ...item, 
           guestId: draggedGuestRef.current!.id,
           guestName: draggedGuestRef.current!.name,
           guestInitials: draggedGuestRef.current!.initials
         } : item
       ));
       setHasChanges(true);
    }
    draggedGuestRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow drop
  };

  const unassignGuest = (chairId: string) => {
    setItems(prev => prev.map(item => 
      item.id === chairId ? { ...item, guestId: undefined, guestName: undefined, guestInitials: undefined } : item
    ));
    setHasChanges(true);
  };

  
  useEffect(() => {
    if (selectedId && trRef.current) {
      const stage = trRef.current.getStage();
      const selectedNode = stage.findOne('#' + selectedId);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, items]);


  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(newScale);
    setPos({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale
    });
  };

  
  
  
  const { data: catalogData } = useQuery({
    queryKey: ['catalog', event.organization_id],
    queryFn: async () => {
      const [tables, fixtures, guidelines] = await Promise.all([
        sdk.catalog.list(event.organization_id, 'table'),
        sdk.catalog.list(event.organization_id, 'fixture'),
        sdk.catalog.list(event.organization_id, 'guideline' as any),
      ]);
      return { 
        items: [...tables.items, ...fixtures.items],
        guidelines: guidelines.items.find(i => i.name === 'Venue Structural Walls') 
      };
    }
  });

  const CATALOG_ITEMS = catalogData?.items.map(c => {
     let spec = {};
     try { spec = JSON.parse(c.spec as any || '{}'); } catch {}
     return {
        label: c.name,
        type: (spec as any).type || c.kind,
        props: spec
     };
  }) || [];

  
  const structuralData = React.useMemo(() => {
     if (!catalogData?.guidelines?.spec) return { lines: [], doors: [], windows: [], pillars: [] };
     try {
       const spec = typeof catalogData.guidelines.spec === 'string' ? JSON.parse(catalogData.guidelines.spec) : catalogData.guidelines.spec;
       return {
         lines: spec.lines || [],
         doors: spec.doors || [],
         windows: spec.windows || [],
         pillars: spec.pillars || []
       };
     } catch { return { lines: [], doors: [], windows: [], pillars: [] }; }
  }, [catalogData?.guidelines]);


  const handleAddItem = (catalogItem: any) => {


    // Add to center of current view
    const viewCenterX = (-pos.x + dimensions.width / 2) / scale;
    const viewCenterY = (-pos.y + dimensions.height / 2) / scale;
    
    const newItem = {
      id: `item-${Date.now()}`,
      type: catalogItem.type,
      x: viewCenterX,
      y: viewCenterY,
      label: catalogItem.label,
      rotation: 0,
      ...catalogItem.props
    };

    setItems(prev => [...prev, newItem]);
    setHasChanges(true);
  };

  const addTable = () => {
    setItems(prev => [
      ...prev,
      { id: `t${Date.now()}`, type: 'round_table', x: 100, y: 100, radius: 40, label: `New Table`, rotation: 0 }
    ]);
    setHasChanges(true);
  };

  
  const handleRestoreVersion = (version: any) => {
    if (window.confirm('Restore this layout version? Unsaved changes will be lost.')) {
      setItems(JSON.parse(version.payload).items || []);
      setViewingVersion(null);
      setHasChanges(true); // Forces them to save it to make it the new active revision
    }
  };

  const handlePreviewVersion = (version: any) => {
    setViewingVersion(version);
  };

  
  const generateAILayout = () => {
    if (!window.confirm('This will replace your current layout with an AI generated suggestion based on your guest count. Proceed?')) {
      return;
    }

    const guestCount = event.guest_count || 100;
    const tableCapacity = 8; // Assuming 60" rounds
    const tablesNeeded = Math.ceil(guestCount / tableCapacity);
    
    // We need to pack them into the venue structural boundaries if they exist,
    // or just a default grid. We'll use a simple grid layout avoiding the center (dance floor).
    
    const newItems: any[] = [];
    const startX = 100;
    const startY = 100;
    const spacingX = 120;
    const spacingY = 120;
    
    let currentX = startX;
    let currentY = startY;
    let tablesPlaced = 0;
    
    // Add Dance Floor in center
    newItems.push({
      id: `df-${Date.now()}`, type: 'dance_floor', x: 400, y: 300, width: 200, height: 200, label: 'Dance Floor', rotation: 0
    });
    
    // Add Head Table
    newItems.push({
      id: `ht-${Date.now()}`, type: 'rect_table', x: 400, y: 100, width: 144, height: 48, label: 'Head Table', rotation: 0
    });

    const danceFloorBounds = { minX: 300, maxX: 500, minY: 200, maxY: 400 };

    while (tablesPlaced < tablesNeeded) {
      // Check if current position intersects dance floor or head table
      const inDanceFloor = currentX > danceFloorBounds.minX && currentX < danceFloorBounds.maxX && currentY > danceFloorBounds.minY && currentY < danceFloorBounds.maxY;
      const inHeadTable = currentY < 150 && currentX > 300 && currentX < 500;
      
      if (!inDanceFloor && !inHeadTable) {
         newItems.push({
           id: `t${tablesPlaced}-${Date.now()}`,
           type: 'round_table',
           x: currentX,
           y: currentY,
           radius: 30, // 60" round is 30 radius in this scale
           label: `Table ${tablesPlaced + 1}`,
           rotation: 0
         });
         
         // Add Chairs around table
         const chairRadius = 30 + 15; // table radius + space
         for(let c=0; c < tableCapacity; c++) {
            const angle = (c / tableCapacity) * Math.PI * 2;
            newItems.push({
               id: `c${tablesPlaced}-${c}-${Date.now()}`,
               type: 'chair',
               x: currentX + Math.cos(angle) * chairRadius,
               y: currentY + Math.sin(angle) * chairRadius,
               radius: 9,
               label: '',
               rotation: 0
            });
         }
         tablesPlaced++;
      }
      
      currentX += spacingX;
      if (currentX > 700) {
        currentX = startX;
        currentY += spacingY;
      }
    }

    setItems(newItems);
    setHasChanges(true);
    resetView();
    
  };

  const resetView = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  }

  const isSaving = createLayout.isPending || saveLayout.isPending;

  
  return (
    <div className="flex w-full h-[600px] border border-border rounded-lg bg-surface overflow-hidden">
      {/* Sidebar Catalog */}
      
      {/* Sidebar Catalog / Guests */}
      <div className="w-64 border-r border-border bg-surface-2 flex flex-col overflow-hidden">
        <div className="flex flex-col border-b border-border bg-surface-2 px-1">
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
</div><div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {sidebarTab === 'catalog' && (
            <div className="flex flex-col gap-2">
              {CATALOG_ITEMS.map((c, i) => (
                <button 
                  key={i} 
                  onClick={() => handleAddItem(c)}
                  className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center gap-2"
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
                        onChange={(e) => {
                           if (window.confirm(`Change layout status to ${e.target.value}?`)) {
                              saveLayout.mutate({ ...JSON.parse(layout.payload as any), approvalStatus: e.target.value });
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
                  className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center gap-2"
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
               
               <div className="flex flex-col gap-1">
                 {[...items].reverse().map((item, reverseIdx) => {
                   const actualIdx = items.length - 1 - reverseIdx;
                   const isSelected = selectedId === item.id;
                   
                   return (
                     <div key={item.id} className={cn("flex items-center gap-2 p-2 rounded text-xs border", isSelected ? "bg-brand-soft border-brand text-brand-strong" : "bg-surface border-border")}>
                        <button className="text-fg-subtle hover:text-fg cursor-grab active:cursor-grabbing"><GripVertical className="w-3 h-3" /></button>
                        <span className="truncate flex-1" onClick={() => setSelectedId(item.id)}>{item.label || item.type}</span>
                        
                        <div className="flex flex-col gap-1 items-end">
                           <button onClick={() => {
                             if (actualIdx === items.length - 1) return;
                             const newItems = [...items];
                             [newItems[actualIdx], newItems[actualIdx+1]] = [newItems[actualIdx+1], newItems[actualIdx]];
                             setItems(newItems);
                             setHasChanges(true);
                           }} className="p-0.5 hover:bg-black/10 rounded">▲</button>
                           <button onClick={() => {
                             if (actualIdx === 0) return;
                             const newItems = [...items];
                             [newItems[actualIdx], newItems[actualIdx-1]] = [newItems[actualIdx-1], newItems[actualIdx]];
                             setItems(newItems);
                             setHasChanges(true);
                           }} className="p-0.5 hover:bg-black/10 rounded">▼</button>
                        </div>
                     </div>
                   );
                 })}
               </div>
               
               {selectedId && (() => {
                 const activeItem = items.find(i => i.id === selectedId);
                 if (!activeItem) return null;
                 
                 return (
                   <div className="mt-4 pt-4 border-t border-border space-y-3">
                      <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Transform Properties</div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                         <div>
                            <label className="text-fg-subtle block mb-1">Rotation (deg)</label>
                            <input 
                              type="number" 
                              className="w-full bg-surface border border-border rounded px-2 py-1"
                              value={Math.round(activeItem.rotation || 0)}
                              onChange={(e) => {
                                setItems(prev => prev.map(i => i.id === selectedId ? {...i, rotation: parseFloat(e.target.value)} : i));
                                setHasChanges(true);
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
                                setItems(prev => prev.map(i => i.id === selectedId ? {...i, opacity: parseFloat(e.target.value)/100} : i));
                                setHasChanges(true);
                              }}
                            />
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                         <div>
                            <label className="text-fg-subtle block mb-1">Scale X</label>
                            <input 
                              type="number" step="0.1"
                              className="w-full bg-surface border border-border rounded px-2 py-1"
                              value={(activeItem.scaleX || 1).toFixed(2)}
                              onChange={(e) => {
                                setItems(prev => prev.map(i => i.id === selectedId ? {...i, scaleX: parseFloat(e.target.value)} : i));
                                setHasChanges(true);
                              }}
                            />
                         </div>
                         <div>
                            <label className="text-fg-subtle block mb-1">Scale Y</label>
                            <input 
                              type="number" step="0.1"
                              className="w-full bg-surface border border-border rounded px-2 py-1"
                              value={(activeItem.scaleY || 1).toFixed(2)}
                              onChange={(e) => {
                                setItems(prev => prev.map(i => i.id === selectedId ? {...i, scaleY: parseFloat(e.target.value)} : i));
                                setHasChanges(true);
                              }}
                            />
                         </div>
                      </div>
                      
                      <Button variant="outline" size="sm" className="w-full mt-2 text-danger hover:bg-danger/10 border-danger/20" onClick={() => {
                         setItems(prev => prev.filter(i => i.id !== selectedId));
                         setSelectedId(null);
                         setHasChanges(true);
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
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={showVendorOverlay} onChange={(e) => setShowVendorOverlay(e.target.checked)} className="rounded border-border text-brand focus:ring-brand" />
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
                      className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => {
                        draggedGuestRef.current = { id: v.id, name: v.name, initials: 'V' }; // re-using ref
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
            </div>
          )}


          {sidebarTab === 'guests' && (() => {
            const assignedIds = new Set(items.map(i => i.guestId).filter(Boolean));
            const unassigned = guests.filter(g => !assignedIds.has(g.id));
            
            return (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-fg-muted mb-2">{unassigned.length} unassigned guests</p>
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
                      className="p-2 border border-border bg-surface rounded text-sm text-fg cursor-grab active:cursor-grabbing flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] flex items-center justify-center font-medium">
                        {initials.toUpperCase()}
                      </div>
                      <span className="truncate">{g.full_name}</span>
                    </div>
                  );
                })}
                {unassigned.length === 0 && (
                  <p className="text-sm text-fg-muted text-center py-4">All guests assigned!</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>


      
      {/* Main Canvas Area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface" onDrop={handleDrop} onDragOver={handleDragOver}>
        
        {viewingVersion && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-brand-soft border border-brand text-brand-strong px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4">
            <ArrowLeftRight className="w-4 h-4" />
            <span className="text-sm font-medium">Viewing Revision {viewingVersion.revision} Diff Overlay</span>
            <button onClick={() => setViewingVersion(null)} className="ml-2 bg-brand/20 p-1 rounded-full hover:bg-brand/30 transition-colors"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="absolute top-4 left-4 z-10 bg-surface border border-border p-2 rounded-md shadow-sm opacity-80 pointer-events-none">

          <p className="text-sm font-medium">Layout Canvas</p>
          <p className="text-xs text-fg-muted">Scroll to zoom, drag background to pan</p>
        </div>
        
        <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
           
           <Button variant="secondary" className="bg-purple-100 text-purple-900 border-purple-200 hover:bg-purple-200" size="sm" onClick={generateAILayout}>
             <Sparkles className="w-4 h-4 mr-1 text-purple-600" /> Auto-Suggest Layout
           </Button>
           <Button variant="outline" size="sm" onClick={resetView}>Reset View</Button>

           <Button 
              size="sm" 
              onClick={handleSave} 
              disabled={!hasChanges || isSaving}
              className={hasChanges ? 'animate-pulse' : ''}
           >
             {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
             Save
           </Button>
        </div>

        
        <Stage 
        
          onMouseDown={(e) => { 
             if (e.evt.shiftKey && showVendorOverlay) {
                const stage = e.target.getStage();
                if (stage) {
                  const pt = {
                    x: (stage.getPointerPosition()!.x - pos.x) / scale,
                    y: (stage.getPointerPosition()!.y - pos.y) / scale
                  };
                  setRoutePoints([...routePoints, pt.x, pt.y]);
                }
             } else {
                if (e.target === e.target.getStage()) setSelectedId(null); 
             }
          }}
          onDblClick={(e) => {
             if (e.evt.shiftKey && showVendorOverlay && routePoints.length > 0) {
                setVendorLines([...vendorLines, { points: routePoints }]);
                setRoutePoints([]);
                setHasChanges(true);
             }
          }}

          width={dimensions.width} 
          height={dimensions.height}
          onWheel={handleWheel}
          scaleX={scale}
          scaleY={scale}
          x={pos.x}
          y={pos.y}
          draggable
          onDragMove={(e) => {
             if (e.target === e.target.getStage()) {
                setPos({ x: e.target.x(), y: e.target.y() });
             }
          }}
        >
        
        
        {viewingVersion && (
          <Layer opacity={0.3}>
            {JSON.parse(viewingVersion.payload).items?.map((item: any) => {
               if (item.type === 'round_table') {
                  return <Circle key={`ghost-${item.id}`} x={item.x} y={item.y} radius={item.radius} fill="#ec4899" stroke="#be185d" strokeWidth={2} listening={false} />;
               }
               if (item.type === 'rect_table') {
                  return <Rect key={`ghost-${item.id}`} x={item.x} y={item.y} width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} rotation={item.rotation} fill="#ec4899" stroke="#be185d" strokeWidth={2} cornerRadius={4} listening={false} />;
               }
               return null;
            })}
          </Layer>
        )}
        
        <Layer>
          {/* Structural Boundaries */}
          <Group listening={false}>
            {structuralData.lines.map((line: any, i: number) => (
              <Line
                key={line.id || i}
                points={line.points}
                stroke="#374151"
                strokeWidth={4}
                closed={true}
                fill="#f3f4f6"
                opacity={0.4}
                lineCap="round"
                lineJoin="round"
              />
            ))}
            
            {structuralData.doors.map((door: any) => (
              <Group key={door.id} x={door.x} y={door.y} rotation={door.rotation} opacity={0.6}>
                <Line points={[0, 0, door.width, 0]} stroke="#374151" strokeWidth={3} />
                <Arc x={0} y={0} innerRadius={door.width} outerRadius={door.width} angle={90} rotation={0} stroke="#9ca3af" strokeWidth={1} dash={[4, 4]} />
                <Line points={[0, 0, 0, door.width]} stroke="#374151" strokeWidth={2} />
              </Group>
            ))}
            
            {structuralData.windows.map((win: any) => (
              <Rect 
                key={win.id} x={win.x} y={win.y} width={win.width} height={6} rotation={win.rotation} offsetX={win.width/2} offsetY={3}
                fill="#bae6fd" stroke="#3b82f6" strokeWidth={2} opacity={0.6}
              />
            ))}
            
            {structuralData.pillars.map((pil: any) => (
              <Circle 
                key={pil.id} x={pil.x} y={pil.y} radius={pil.radius} 
                fill="#9ca3af" stroke="#4b5563" strokeWidth={2} opacity={0.6}
              />
            ))}
          </Group>



          {items.map((item) => {
            if (item.type === 'round_table') {
              return (
                <Group key={item.id} x={item.x} y={item.y} draggable onDragEnd={(e) => handleDragEnd(e, item.id)}>
                   <Circle radius={item.radius} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} />
                   <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={item.radius||0} offsetY={7} width={(item.radius||0) * 2} />
                </Group>
              );
            }
            
            if (item.type === 'rect_table') {
               return (
                <Group 
                  key={item.id} 
                  id={item.id}
                  x={item.x} 
                  y={item.y} 
                  rotation={item.rotation} 
                  draggable 
                  onDragEnd={(e) => handleDragEnd(e, item.id)}
                  onClick={() => setSelectedId(item.id)}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    setItems((prev) => 
                      prev.map(i => i.id === item.id ? { 
                        ...i, 
                        x: node.x(), 
                        y: node.y(), 
                        rotation: node.rotation(),
                        scaleX: node.scaleX(),
                        scaleY: node.scaleY()
                      } : i)
                    );
                    setHasChanges(true);
                  }}
                >
                   <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} cornerRadius={4} />
                   <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={7} width={item.width} />
                </Group>
               );
            }

             
            if (item.type === 'decor') {
               return (
                <Group key={item.id} id={item.id} x={item.x} y={item.y} rotation={item.rotation || 0} scaleX={item.scaleX || 1} scaleY={item.scaleY || 1} opacity={item.opacity || 1} draggable onDragEnd={(e) => handleDragEnd(e, item.id)} onClick={() => setSelectedId(item.id)}>
                   {item.shape === 'circle' ? (
                     <Circle radius={item.width/2} fill={item.color} stroke="#9ca3af" strokeWidth={1} />
                   ) : (
                     <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill={item.color} stroke="#9ca3af" strokeWidth={1} cornerRadius={2} />
                   )}
                </Group>
               );
            }

             if (item.type === 'dance_floor') {
               return (
                <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation} draggable onDragEnd={(e) => handleDragEnd(e, item.id)}>
                   <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#e5e7eb" stroke="#d1d5db" strokeWidth={1} dash={[10, 5]} />
                   <Text text={item.label} fontSize={16} fill="#6b7280" fontStyle="italic" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={8} width={item.width} />
                </Group>
               );
            }
            
            if (item.type === 'chair') {
              return (
                 <Group key={item.id} x={item.x} y={item.y} draggable onDragEnd={(e) => handleDragEnd(e, item.id)} onDblClick={() => unassignGuest(item.id)}>
                   <Circle radius={item.radius} fill={item.guestId ? "#fdf2f8" : "#fff"} stroke={item.guestId ? "#ec4899" : "#6b7280"} strokeWidth={1.5} />
                   {item.guestInitials && (
                     <Text text={item.guestInitials} fontSize={8} fill="#be185d" align="center" verticalAlign="middle" offsetX={item.radius} offsetY={4} width={item.radius * 2} listening={false} />
                   )}
                 </Group>
              )
            }
            return null;
          })}
        </Layer>
        <Layer>
          {selectedId && (
            <Transformer
              ref={trRef}
              boundBoxFunc={(oldBox, newBox) => {
                // limit resize
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            />
          )}
        </Layer>

        {showVendorOverlay && (
          <Layer>
            {/* Vendor Load-in Routes */}
            {vendorLines.map((line, i) => (
              <Line key={i} points={line.points} stroke="#22c55e" strokeWidth={3} dash={[10, 5]} opacity={0.6} lineCap="round" lineJoin="round" />
            ))}
            
            {routePoints.length > 0 && (
              <Line points={routePoints} stroke="#22c55e" strokeWidth={3} dash={[10, 5]} opacity={0.6} lineCap="round" lineJoin="round" />
            )}

            {items.map(item => {
              if (item.type === 'vendor_zone') {
                 // We will check for collisions with other vendor zones
                 const overlaps = items.some(other => {
                    if (other.type !== 'vendor_zone' || other.id === item.id) return false;
                    return (
                      item.x < other.x + other.width &&
                      item.x + item.width > other.x &&
                      item.y < other.y + other.height &&
                      item.y + item.height > other.y
                    );
                 });

                 return (
                   <Group key={item.id} id={item.id} x={item.x} y={item.y} rotation={item.rotation} draggable onDragEnd={(e) => handleDragEnd(e, item.id)} onClick={() => setSelectedId(item.id)}>
                      <Rect 
                        width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} 
                        fill={overlaps ? "#fef2f2" : "#eff6ff"} 
                        stroke={overlaps ? "#ef4444" : "#3b82f6"} 
                        strokeWidth={2} dash={[5, 5]} opacity={0.7} 
                      />
                      <Rect 
                        x={-((item.width||0)/2)} y={-((item.height||0)/2) - 20} width={item.width} height={20} 
                        fill={overlaps ? "#ef4444" : "#3b82f6"} 
                      />
                      <Text 
                        text={item.vendorName} x={-((item.width||0)/2)} y={-((item.height||0)/2) - 16} width={item.width} 
                        fontSize={10} fill="#ffffff" align="center" fontStyle="bold" 
                      />
                      {overlaps && (
                        <Text text="⚠️ CONFLICT" x={-((item.width||0)/2)} y={-((item.height||0)/2) + 10} width={item.width} fontSize={12} fill="#ef4444" align="center" fontStyle="bold" />
                      )}
                   </Group>
                 )
              }
              return null;
            })}
          </Layer>
        )}
</Stage>

      </div>
    </div>
  );
}
