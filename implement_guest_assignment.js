const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// Add guests imports
code = code.replace(
  "import { layoutsSdk } from '../../../sdk/layouts';",
  "import { layoutsSdk } from '../../../sdk/layouts';\nimport { guestsSdk } from '../../../sdk/guests';\nimport { cn } from '../../../ui/lib/cn';"
);

// Add activeTab state
code = code.replace(
  "const [hasChanges, setHasChanges] = useState(false);",
  "const [hasChanges, setHasChanges] = useState(false);\n  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests'>('catalog');\n  const draggedGuestRef = useRef<{ id: string; name: string; initials: string } | null>(null);"
);

// Add guest query
code = code.replace(
  "const { data, isLoading } = useQuery({",
  "const { data: guestsData } = useQuery({\n    queryKey: ['guests', event.id],\n    queryFn: () => guestsSdk.list(event.id),\n  });\n  const guests = guestsData?.guests || [];\n\n  const { data, isLoading } = useQuery({"
);

// Add drop handler
code = code.replace(
  "const handleWheel = (e: any) => {",
  `const handleDrop = (e: React.DragEvent) => {
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

  const handleWheel = (e: any) => {`
);

// Add assigned guests filter logic
const sidebarLogic = `
      {/* Sidebar Catalog / Guests */}
      <div className="w-64 border-r border-border bg-surface-2 flex flex-col overflow-hidden">
        <div className="flex border-b border-border">
          <button 
            className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", sidebarTab === 'catalog' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')}
            onClick={() => setSidebarTab('catalog')}
          >
            Catalog
          </button>
          <button 
            className={cn("flex-1 py-2 text-sm font-medium border-b-2 transition-colors", sidebarTab === 'guests' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')}
            onClick={() => setSidebarTab('guests')}
          >
            Guests
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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
`;

code = code.replace(
  /<div className="w-64 border-r border-border bg-surface-2 p-4 flex flex-col gap-4 overflow-y-auto">[\s\S]*?<\/div>\s*<\/div>/m,
  sidebarLogic
);

// Add event handlers to the container ref
code = code.replace(
  '<div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface">',
  '<div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface" onDrop={handleDrop} onDragOver={handleDragOver}>'
);

// Add chair guest rendering
const chairRender = `
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
`;

code = code.replace(
  /if \(item.type === 'chair'\) \{\s*return \([\s\S]*?\)\s*\}/,
  chairRender
);

fs.writeFileSync(path, code);
