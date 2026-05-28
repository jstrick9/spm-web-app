const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update imports
code = code.replace(
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X, Sparkles, Layers, Flower2, GripVertical, Plus } from 'lucide-react';",
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin } from 'lucide-react';\nimport { vendorsSdk } from '../../../sdk/vendors';"
);

// Add vendor tab to state
code = code.replace(
  "const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'decor' | 'layers' | 'history'>('catalog');",
  "const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'decor' | 'layers' | 'history' | 'vendors'>('catalog');\n  const [showVendorOverlay, setShowVendorOverlay] = useState(false);\n  const [vendorLines, setVendorLines] = useState<any[]>([]);"
);

// Add vendor query
const vendorQuery = `
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', event.id],
    queryFn: () => vendorsSdk.list(event.organization_id, { eventId: event.id }),
  });
  const vendors = vendorsData?.vendors || [];
`;
code = code.replace("const draggedGuestRef = useRef", vendorQuery + "\n  const draggedGuestRef = useRef");

// Update buttons
const tabButtons = `
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
`;
code = code.replace(/<div className="flex border-b border-border bg-surface-2 px-1">[\s\S]*?<\/div><div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">/m, 
`<div className="flex flex-col border-b border-border bg-surface-2 px-1">` + tabButtons + `</div><div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">`);

// Add vendor panel logic
const vendorPanel = `
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
`;

code = code.replace("{sidebarTab === 'guests' && (() => {", vendorPanel + "\n\n          {sidebarTab === 'guests' && (() => {");


// Handle Vendor Drag Drops
const vendorDropLogic = `
    const isVendor = !!vendors.find(v => v.id === draggedGuestRef.current!.id);

    if (isVendor) {
       // Drop Vendor Zone
       const newZone = {
          id: \`vz-\${Date.now()}\`,
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
`;

code = code.replace(
  "const point = {\n      x: (x - pos.x) / scale,\n      y: (y - pos.y) / scale\n    };",
  "const point = {\n      x: (x - pos.x) / scale,\n      y: (y - pos.y) / scale\n    };\n\n" + vendorDropLogic
);

// Add Shift-click route logic
code = code.replace(
  "const [pos, setPos] = useState({ x: 0, y: 0 });",
  "const [pos, setPos] = useState({ x: 0, y: 0 });\n  const [routePoints, setRoutePoints] = useState<number[]>([]);"
);

const vendorRenderLogic = `
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
`;

code = code.replace(/<\/Layer>\s*<\/Stage>/, "</Layer>\n" + vendorRenderLogic + "</Stage>");

// Handle shift click drawing
const shiftClickLogic = `
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
`;

code = code.replace(
  "onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}",
  shiftClickLogic
);

// We need to persist vendor lines too
code = code.replace(
  "payload: { items: payload }",
  "payload: { items: payload, vendorLines }"
);

code = code.replace(
  "payload: any) => layoutsSdk.save(layout!.id, { items: payload }),",
  "payload: any) => layoutsSdk.save(layout!.id, { items: payload, vendorLines }),"
);

code = code.replace(
  "setItems((layout.payload as any).items);",
  "setItems((layout.payload as any).items);\n        setVendorLines((layout.payload as any).vendorLines || []);"
);


fs.writeFileSync(path, code);
