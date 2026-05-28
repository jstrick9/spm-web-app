const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { Loader2, Save } from 'lucide-react';",
  "import { Loader2, Save, Move, Search } from 'lucide-react';"
);

// We need to inject the catalog logic
const catalogLogic = `
  const CATALOG_ITEMS = [
    { label: 'Round Table 60"', type: 'round_table', props: { radius: 30 } },
    { label: 'Round Table 72"', type: 'round_table', props: { radius: 36 } },
    { label: 'Rect Table 6ft', type: 'rect_table', props: { width: 72, height: 30 } },
    { label: 'Rect Table 8ft', type: 'rect_table', props: { width: 96, height: 30 } },
    { label: 'Sweetheart Table', type: 'rect_table', props: { width: 48, height: 30 } },
    { label: 'Chair', type: 'chair', props: { radius: 9 } },
    { label: 'Dance Floor (Small)', type: 'dance_floor', props: { width: 144, height: 144 } },
    { label: 'Dance Floor (Large)', type: 'dance_floor', props: { width: 240, height: 240 } },
    { label: 'Stage', type: 'rect_table', props: { width: 192, height: 96 } },
  ];

  const handleAddItem = (catalogItem: typeof CATALOG_ITEMS[0]) => {
    // Add to center of current view
    const viewCenterX = (-pos.x + dimensions.width / 2) / scale;
    const viewCenterY = (-pos.y + dimensions.height / 2) / scale;
    
    const newItem = {
      id: \`item-\${Date.now()}\`,
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
`;

code = code.replace(
  "const addTable = () => {",
  catalogLogic + "\n  const addTable = () => {"
);

// We need to change the return layout to have a flex container with sidebar
const returnBlock = `
  return (
    <div className="flex w-full h-[600px] border border-border rounded-lg bg-surface overflow-hidden">
      {/* Sidebar Catalog */}
      <div className="w-64 border-r border-border bg-surface-2 p-4 flex flex-col gap-4 overflow-y-auto">
        <h3 className="font-medium text-sm text-fg">Catalog</h3>
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
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface">
        <div className="absolute top-4 left-4 z-10 bg-surface border border-border p-2 rounded-md shadow-sm opacity-80 pointer-events-none">
          <p className="text-sm font-medium">Layout Canvas</p>
          <p className="text-xs text-fg-muted">Scroll to zoom, drag background to pan</p>
        </div>
        
        <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
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
`;

code = code.replace(
  /return \(\s*<div ref=\{containerRef\} className="w-full h-\[600px\].*? overflow-hidden">\s*<div className="absolute top-4 left-4.*?>[\s\S]*?<Stage/m,
  returnBlock
);

code = code.replace(
  "</Stage>\n    </div>\n  );\n}",
  "</Stage>\n      </div>\n    </div>\n  );\n}"
);

fs.writeFileSync(path, code);
