const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// We add a 'decor' and 'layers' tab to the sidebar
code = code.replace(
  "const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'history'>('catalog');",
  "const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'decor' | 'layers' | 'history'>('catalog');"
);

code = code.replace(
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X, Sparkles } from 'lucide-react';",
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X, Sparkles, Layers, Flower2, GripVertical, Plus } from 'lucide-react';"
);

// We need to fetch decor items
const decorQuery = `
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
`;
code = code.replace("const { data, isLoading } = useQuery({", decorQuery + "\n  const { data, isLoading } = useQuery({");


const tabButtons = `
          <button className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", sidebarTab === 'catalog' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('catalog')}>Items</button>
          <button className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", sidebarTab === 'decor' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('decor')}><Flower2 className="w-3 h-3 mx-auto mb-0.5" />Decor</button>
          <button className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", sidebarTab === 'guests' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('guests')}><Search className="w-3 h-3 mx-auto mb-0.5" />Guests</button>
          <button className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", sidebarTab === 'layers' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('layers')}><Layers className="w-3 h-3 mx-auto mb-0.5" />Layers</button>
          <button className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", sidebarTab === 'history' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')} onClick={() => setSidebarTab('history')}><History className="w-3 h-3 mx-auto mb-0.5" />Diff</button>
`;

code = code.replace(
  /<div className="flex border-b border-border">[\s\S]*?<\/div>\s*<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">/m,
  `<div className="flex border-b border-border bg-surface-2 px-1">` + tabButtons + `</div><div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">`
);

// We need to implement Z-Index reordering and properties panel
const layersAndDecor = `
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
`;

code = code.replace("{sidebarTab === 'guests' && (() => {", layersAndDecor + "\n\n          {sidebarTab === 'guests' && (() => {");

// Now we need to render the decor items on the canvas
const renderDecor = `
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
`;

code = code.replace("if (item.type === 'dance_floor') {", renderDecor + "\n             if (item.type === 'dance_floor') {");

// Update handleTransformEnd to support properties panel sync
code = code.replace(
  "const node = e.target;",
  "const node = e.target;\n    setItems((prev) => \n      prev.map(i => i.id === id ? { \n        ...i, \n        x: node.x(), \n        y: node.y(), \n        rotation: node.rotation(),\n        scaleX: node.scaleX(),\n        scaleY: node.scaleY()\n      } : i)\n    );\n    // We also need to map the old door/window logic if it exists"
);

fs.writeFileSync(path, code);
