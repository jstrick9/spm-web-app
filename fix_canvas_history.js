const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { Loader2, Save, Move, Search } from 'lucide-react';",
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight } from 'lucide-react';"
);

// We add a 'history' tab to the sidebar
code = code.replace(
  "const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests'>('catalog');",
  "const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'history'>('catalog');\n  const [viewingVersion, setViewingVersion] = useState<any>(null);"
);

// We need the layout versions query
const versionsQuery = `
  const { data: versionsData } = useQuery({
    queryKey: ['layouts', layout?.id, 'versions'],
    queryFn: () => layoutsSdk.listVersions(layout!.id),
    enabled: !!layout?.id,
  });
  const versions = versionsData?.versions || [];
`;
code = code.replace("const draggedGuestRef = useRef", versionsQuery + "\n  const draggedGuestRef = useRef");

// We need a way to restore the version
const restoreLogic = `
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
`;
code = code.replace("const resetView = () => {", restoreLogic + "\n  const resetView = () => {");

// Add history tab button
code = code.replace(
  "<button \n            className={cn(\"flex-1 py-2 text-sm font-medium border-b-2 transition-colors\", sidebarTab === 'guests' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')}\n            onClick={() => setSidebarTab('guests')}\n          >\n            Guests\n          </button>",
  "<button \n            className={cn(\"flex-1 py-2 text-sm font-medium border-b-2 transition-colors\", sidebarTab === 'guests' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')}\n            onClick={() => setSidebarTab('guests')}\n          >\n            Guests\n          </button>\n          <button \n            className={cn(\"flex-1 py-2 text-sm font-medium border-b-2 transition-colors\", sidebarTab === 'history' ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')}\n            onClick={() => setSidebarTab('history')}\n          >\n            History\n          </button>"
);

// Add history tab content
const historyContent = `
          {sidebarTab === 'history' && (
            <div className="flex flex-col gap-4">
               {layout && (
                 <div className="bg-surface p-3 rounded border border-border shadow-sm mb-2">
                   <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 flex justify-between items-center">
                     Current Layout
                     <Badge variant="success" className="text-[10px]">Active</Badge>
                   </div>
                   <div className="text-sm font-medium">Revision {layout.revision}</div>
                   <div className="text-xs text-fg-subtle mt-1">Last updated {new Date(layout.updated_at).toLocaleString()}</div>
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
`;
code = code.replace("{sidebarTab === 'guests' && (() => {", historyContent + "\n\n          {sidebarTab === 'guests' && (() => {");

// Add ghost view overlay for diffing
const ghostLayer = `
        {viewingVersion && (
          <Layer opacity={0.3}>
            {JSON.parse(viewingVersion.payload).items?.map((item: any) => {
               if (item.type === 'round_table') {
                  return <Circle key={\`ghost-\${item.id}\`} x={item.x} y={item.y} radius={item.radius} fill="#ec4899" stroke="#be185d" strokeWidth={2} listening={false} />;
               }
               if (item.type === 'rect_table') {
                  return <Rect key={\`ghost-\${item.id}\`} x={item.x} y={item.y} width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} rotation={item.rotation} fill="#ec4899" stroke="#be185d" strokeWidth={2} cornerRadius={4} listening={false} />;
               }
               return null;
            })}
          </Layer>
        )}
        <Layer>
`;

code = code.replace("<Layer>", ghostLayer);

// Add Top UI warning when viewing history
const viewWarning = `
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
`;
code = code.replace(
  '{/* Main Canvas Area */}\n      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface" onDrop={handleDrop} onDragOver={handleDragOver}>\n        <div className="absolute top-4 left-4 z-10 bg-surface border border-border p-2 rounded-md shadow-sm opacity-80 pointer-events-none">',
  viewWarning
);

fs.writeFileSync(path, code);
