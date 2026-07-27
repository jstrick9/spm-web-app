import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Group, Text, Arc, Rect, Transformer } from 'react-konva';
import { Button } from '../../../ui/Button';
import { MousePointer2, PenTool, Save, Trash2, Undo, DoorOpen, AppWindow, Cylinder, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { useToast } from '../../../ui/Toast';
import { cn } from '../../../ui/lib/cn';
import { VenueSpaceScaffoldWizard } from './VenueSpaceScaffoldWizard';
import { venuesSdk } from '../../../sdk/venues';

interface Props {
  orgId: string;
}

export function VenueBuilder({ orgId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedVenue, setSelectedVenue] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Builder Modes
  const [mode, setMode] = useState<'select' | 'draw_wall' | 'add_door' | 'add_window' | 'add_pillar'>('select');
  
  // State
  const [lines, setLines] = useState<any[]>([]);
  const [doors, setDoors] = useState<any[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  const [pillars, setPillars] = useState<any[]>([]);
  
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trRef = useRef<any>(null);

  // Load venue structural guidelines
  const { data, isLoading } = useQuery({
    queryKey: ['catalog', orgId, 'guideline'],
    queryFn: () => sdk.catalog.list(orgId, 'guideline' as any),
  });

  useEffect(() => {
    if (data?.items && data.items.length > 0) {
      const structural = data.items.find(i => i.name === 'Venue Structural Walls');
      if (structural && structural.spec) {
        try {
          const spec = typeof structural.spec === 'string' ? JSON.parse(structural.spec) : structural.spec;
          setLines(spec.lines || []);
          setDoors(spec.doors || []);
          setWindows(spec.windows || []);
          setPillars(spec.pillars || []);
        } catch {}
      }
    }
  }, [data]);

  useEffect(() => {
    if (!selectedVenue) return;
    const layout = typeof selectedVenue.master_layout === 'string' ? JSON.parse(selectedVenue.master_layout || '{}') : (selectedVenue.master_layout || {});
    setLines((layout.walls || layout.lines || []).map((wall: any) => ({ id: wall.id, points: wall.points })));
    setDoors(layout.doors || []); setWindows(layout.windows || []); setPillars(layout.pillars || []);
    if (selectedVenue.canvas_width || selectedVenue.width) setDimensions({ width: selectedVenue.canvas_width || selectedVenue.width * 10, height: selectedVenue.canvas_height || selectedVenue.height * 10 });
    setHasChanges(false);
  }, [selectedVenue]);

  useEffect(() => {
    if (selectedId && trRef.current) {
      const stage = trRef.current.getStage();
      const node = stage.findOne('#' + selectedId);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, doors, windows, pillars]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedVenue) {
        return venuesSdk.update(selectedVenue.id, { masterLayout: { walls: lines, doors, windows, pillars }, canvasWidth: dimensions.width, canvasHeight: dimensions.height });
      }
      const res = await sdk.catalog.list(orgId, 'guideline' as any);
      const structural = res.items.find(i => i.name === 'Venue Structural Walls');
      
      const payload = {
        name: 'Venue Structural Walls',
        visible: true,
        spec: { type: 'structural', lines, doors, windows, pillars }
      };

      if (structural) {
        return sdk.catalog.update(structural.id, payload);
      } else {
        return sdk.catalog.create(orgId, 'guideline' as any, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog', orgId, 'guideline'] });
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      toast({ title: 'Venue boundaries saved', variant: 'success' });
      setHasChanges(false);
    }
  });

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

  const getRelativePointerPosition = (stage: any) => {
    const pointerPosition = stage.getPointerPosition();
    const stageTransform = stage.getAbsoluteTransform().copy();
    stageTransform.invert();
    return stageTransform.point(pointerPosition);
  };

  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pt = getRelativePointerPosition(stage);

    if (mode === 'select') {
      if (e.target === stage || e.target.name() === 'grid') {
        setSelectedId(null);
      }
      return;
    }
    
    if (mode === 'draw_wall') {
      if (currentPoints.length >= 4) {
        const firstX = currentPoints[0];
        const firstY = currentPoints[1];
        const dist = Math.hypot(firstX - pt.x, firstY - pt.y);
        
        if (dist < 15 / scale) {
          const newPolygon = [...currentPoints, firstX, firstY];
          setLines([...lines, { points: newPolygon, id: `line-${Date.now()}` }]);
          setCurrentPoints([]);
          setHasChanges(true);
          setMode('select');
          return;
        }
      }
      setCurrentPoints([...currentPoints, pt.x, pt.y]);
    } else if (mode === 'add_door') {
      setDoors([...doors, { id: `door-${Date.now()}`, x: pt.x, y: pt.y, width: 40, rotation: 0 }]);
      setHasChanges(true);
      setMode('select');
    } else if (mode === 'add_window') {
      setWindows([...windows, { id: `win-${Date.now()}`, x: pt.x, y: pt.y, width: 60, rotation: 0 }]);
      setHasChanges(true);
      setMode('select');
    } else if (mode === 'add_pillar') {
      setPillars([...pillars, { id: `pil-${Date.now()}`, x: pt.x, y: pt.y, radius: 12 }]);
      setHasChanges(true);
      setMode('select');
    }
  };

  const handleWheel = (e: any) => {
    if (mode === 'draw_wall') return;
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

  const handleSVGImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      
      const newLines: any[] = [];
      doc.querySelectorAll('line').forEach(el => {
        newLines.push({ id: `l-${Date.now()}-${Math.random()}`, points: [parseFloat(el.getAttribute('x1')||'0'), parseFloat(el.getAttribute('y1')||'0'), parseFloat(el.getAttribute('x2')||'0'), parseFloat(el.getAttribute('y2')||'0')] });
      });
      doc.querySelectorAll('rect').forEach(el => {
        const x = parseFloat(el.getAttribute('x')||'0');
        const y = parseFloat(el.getAttribute('y')||'0');
        const w = parseFloat(el.getAttribute('width')||'0');
        const h = parseFloat(el.getAttribute('height')||'0');
        newLines.push({ id: `l-${Date.now()}-${Math.random()}`, points: [x, y, x+w, y, x+w, y+h, x, y+h, x, y] });
      });
      doc.querySelectorAll('polygon, polyline').forEach(el => {
        const pts = el.getAttribute('points');
        if (pts) {
          const coords = pts.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
          if (coords.length > 0) newLines.push({ id: `l-${Date.now()}-${Math.random()}`, points: coords });
        }
      });
      
      if (newLines.length > 0) {
        setLines([...lines, ...newLines]);
        setHasChanges(true);
        toast({ title: `Imported ${newLines.length} paths from SVG`, variant: 'success' });
      } else {
        toast({ title: 'No valid paths found in SVG', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTransformEnd = (e: any, id: string, type: string) => {
    const node = e.target;
    if (type === 'door') {
      setDoors(prev => prev.map(d => d.id === id ? { ...d, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(10, node.width() * node.scaleX()) } : d));
    } else if (type === 'window') {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(10, node.width() * node.scaleX()) } : w));
    } else if (type === 'pillar') {
      setPillars(prev => prev.map(p => p.id === id ? { ...p, x: node.x(), y: node.y(), radius: Math.max(5, p.radius * node.scaleX()) } : p));
    }
    // reset scale
    node.scaleX(1);
    node.scaleY(1);
    setHasChanges(true);
  };

  const handleDragEnd = (e: any, id: string, type: string) => {
    const node = e.target;
    if (type === 'door') {
      setDoors(prev => prev.map(d => d.id === id ? { ...d, x: node.x(), y: node.y() } : d));
    } else if (type === 'window') {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, x: node.x(), y: node.y() } : w));
    } else if (type === 'pillar') {
      setPillars(prev => prev.map(p => p.id === id ? { ...p, x: node.x(), y: node.y() } : p));
    }
    setHasChanges(true);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setDoors(prev => prev.filter(d => d.id !== selectedId));
    setWindows(prev => prev.filter(w => w.id !== selectedId));
    setPillars(prev => prev.filter(p => p.id !== selectedId));
    setSelectedId(null);
    setHasChanges(true);
  };

  return (
    <div className="flex flex-col gap-4">
       <VenueSpaceScaffoldWizard orgId={orgId} onSelectVenue={setSelectedVenue} />
       {selectedVenue && <div className="rounded-lg border border-brand/30 bg-brand-soft/20 px-3 py-2 text-sm text-brand">Editing scaffold: <strong>{selectedVenue.name}</strong> · {selectedVenue.width}×{selectedVenue.height} · {selectedVenue.unit_system ?? 'imperial'} · {selectedVenue.approval_status ?? 'draft'}</div>}
       <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-3 bg-surface border border-border rounded-lg shadow-sm gap-4">
          <div className="flex flex-wrap gap-2">
             <Button variant={mode === 'select' ? 'default' : 'secondary'} size="sm" onClick={() => { setMode('select'); setCurrentPoints([]); }}>
               <MousePointer2 className="w-4 h-4 mr-1" /> Select
             </Button>
             <div className="w-px h-6 bg-border mx-1 self-center" />
             <Button variant={mode === 'draw_wall' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('draw_wall')}>
               <PenTool className="w-4 h-4 mr-1" /> Wall
             </Button>
             <Button variant={mode === 'add_door' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_door')}>
               <DoorOpen className="w-4 h-4 mr-1" /> Door
             </Button>
             <Button variant={mode === 'add_window' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_window')}>
               <AppWindow className="w-4 h-4 mr-1" /> Window
             </Button>
             <Button variant={mode === 'add_pillar' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_pillar')}>
               <Cylinder className="w-4 h-4 mr-1" /> Pillar
             </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
             {selectedId && (
               <Button variant="outline" className="text-danger border-danger/30 hover:bg-danger/10" size="sm" onClick={deleteSelected}>
                 <Trash2 className="w-4 h-4 mr-1"/> Delete Selected
               </Button>
             )}
             <div className="w-px h-6 bg-border mx-1" />
             <input type="file" accept=".svg" className="hidden" ref={fileInputRef} onChange={handleSVGImport} />
             <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
               <Upload className="w-4 h-4 mr-1"/> Import SVG
             </Button>
             <Button size="sm" disabled={!hasChanges || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
               <Save className="w-4 h-4 mr-1" /> Save
             </Button>
          </div>
       </div>

       <div ref={containerRef} className="w-full h-[600px] border border-border rounded-lg bg-surface relative overflow-hidden">
          <Stage 
            width={dimensions.width} 
            height={dimensions.height}
            onWheel={handleWheel}
            scaleX={scale}
            scaleY={scale}
            x={pos.x}
            y={pos.y}
            draggable={mode === 'select'}
            onClick={handleStageClick}
            onDragMove={(e) => {
               if (e.target === e.target.getStage()) {
                  setPos({ x: e.target.x(), y: e.target.y() });
               }
            }}
            style={{ cursor: mode === 'select' ? 'grab' : 'crosshair' }}
          >
            <Layer>
              <Group listening={false} name="grid">
                {Array.from({ length: 40 }).map((_, i) => (
                   <React.Fragment key={i}>
                      <Line points={[0, i * 50, 2000, i * 50]} stroke="#e5e7eb" strokeWidth={1} />
                      <Line points={[i * 50, 0, i * 50, 2000]} stroke="#e5e7eb" strokeWidth={1} />
                   </React.Fragment>
                ))}
              </Group>

              {/* Walls */}
              {lines.map((line, i) => (
                <Line key={line.id || i} points={line.points} stroke="#374151" strokeWidth={4} closed={true} fill="#f3f4f6" opacity={0.6} lineCap="round" lineJoin="round" />
              ))}

              {/* Doors */}
              {doors.map((door) => (
                <Group 
                  key={door.id} id={door.id} x={door.x} y={door.y} rotation={door.rotation} 
                  draggable={mode === 'select'} 
                  onClick={() => mode === 'select' && setSelectedId(door.id)}
                  onDragEnd={(e) => handleDragEnd(e, door.id, 'door')}
                  onTransformEnd={(e) => handleTransformEnd(e, door.id, 'door')}
                >
                  {/* Door frame line */}
                  <Line points={[0, 0, door.width, 0]} stroke="#374151" strokeWidth={3} />
                  {/* Door swing arc */}
                  <Arc x={0} y={0} innerRadius={door.width} outerRadius={door.width} angle={90} rotation={0} stroke="#9ca3af" strokeWidth={1} dash={[4, 4]} />
                  <Line points={[0, 0, 0, door.width]} stroke="#374151" strokeWidth={2} />
                  {/* Invisible rect for easier selection */}
                  <Rect width={door.width} height={door.width} fill="transparent" />
                </Group>
              ))}

              {/* Windows */}
              {windows.map((win) => (
                <Rect 
                  key={win.id} id={win.id} x={win.x} y={win.y} width={win.width} height={6} rotation={win.rotation} offsetX={win.width/2} offsetY={3}
                  fill="#bae6fd" stroke="#3b82f6" strokeWidth={2}
                  draggable={mode === 'select'}
                  onClick={() => mode === 'select' && setSelectedId(win.id)}
                  onDragEnd={(e) => handleDragEnd(e, win.id, 'window')}
                  onTransformEnd={(e) => handleTransformEnd(e, win.id, 'window')}
                />
              ))}

              {/* Pillars */}
              {pillars.map((pil) => (
                <Circle 
                  key={pil.id} id={pil.id} x={pil.x} y={pil.y} radius={pil.radius} 
                  fill="#9ca3af" stroke="#4b5563" strokeWidth={2}
                  draggable={mode === 'select'}
                  onClick={() => mode === 'select' && setSelectedId(pil.id)}
                  onDragEnd={(e) => handleDragEnd(e, pil.id, 'pillar')}
                  onTransformEnd={(e) => handleTransformEnd(e, pil.id, 'pillar')}
                />
              ))}

              {/* Drawing wall preview */}
              {currentPoints.length > 0 && (
                <Group listening={false}>
                   <Line points={currentPoints} stroke="#ec4899" strokeWidth={3} dash={[10, 5]} lineCap="round" lineJoin="round" />
                   {currentPoints.length > 2 && <Circle x={currentPoints[0]} y={currentPoints[1]} radius={6 / scale} fill="#fce7f3" stroke="#be185d" strokeWidth={2 / scale} />}
                </Group>
              )}

              {/* Transformer */}
              {selectedId && (
                <Transformer
                  ref={trRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
                    return newBox;
                  }}
                  rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                />
              )}
            </Layer>
          </Stage>
       </div>
    </div>
  );
}
