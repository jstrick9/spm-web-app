import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Arc } from 'react-konva';
import { cn } from '../../../../ui/lib/cn';
import {
  Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight,
  X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin, Sliders,
  PenTool, Undo2, Redo2, Grid, Activity, FileText, Keyboard, Printer, Eye, Umbrella, Smartphone, Maximize2, QrCode, Camera, ShieldCheck, ClipboardCheck, Accessibility, Zap
} from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { Badge } from '../../../../ui/Badge';
import { Label } from '../../../../ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../ui/Dialog';

export interface CanvasStageAreaProps {
  routePoints: number[];
  setRoutePoints: React.Dispatch<React.SetStateAction<number[]>>;
  showHelpGuide: boolean;
  setShowHelpGuide: React.Dispatch<React.SetStateAction<boolean>>;
  showClearanceRings: boolean;
  autoArrangeOpen: boolean;
  setAutoArrangeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  affinityRule: 'together' | 'spread';
  setAffinityRule: React.Dispatch<React.SetStateAction<'together' | 'spread'>>;
  drawingMode: boolean;
  drawnPoints: { x: number; y: number }[];
  items: any[];
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  vendorLines: any[];
  setVendorLines: React.Dispatch<React.SetStateAction<any[]>>;
  viewingVersion: any;
  setViewingVersion: React.Dispatch<React.SetStateAction<any>>;
  dimensions: any;
  scale: any;
  pos: any;
  setPos: React.Dispatch<React.SetStateAction<any>>;
  hasChanges: any;
  setHasChanges: React.Dispatch<React.SetStateAction<any>>;
  showProtectedLayers: any;
  showCommentPins: any;
  showVendorOverlay: any;
  stageRef: React.RefObject<any>;
  containerRef: React.RefObject<HTMLDivElement>;
  trRef: React.RefObject<any>;
  toast: any;
  layoutCollaboration: any;
  guests: any[];
  layout: any;
  duplicateGuestIds: any;
  pushState: (nextItems: any[]) => void;
  checkCollision: (item: any) => any;
  handleSave: () => void;
  handleDragEnd: (e: any, id: string) => void;
  handleDrop: (e: React.DragEvent) => void;
  runAutoArranger: () => void;
  handleDragOver: (e: React.DragEvent) => void;
  unassignGuest: (chairId: string) => void;
  handleWheel: (e: any) => void;
  structuralData: any;
  exportToPNG: () => void;
  exportToSVG: () => void;
  exportToPDF: () => void;
  handleStageClick: (e: any) => void;
  generateAILayout: () => void;
  resetView: () => void;
  isSaving: any;
}

export function CanvasStageArea({ routePoints, setRoutePoints, showHelpGuide, setShowHelpGuide, showClearanceRings, autoArrangeOpen, setAutoArrangeOpen, affinityRule, setAffinityRule, drawingMode, drawnPoints, items, selectedId, setSelectedId, vendorLines, setVendorLines, viewingVersion, setViewingVersion, dimensions, scale, pos, setPos, hasChanges, setHasChanges, showProtectedLayers, showCommentPins, showVendorOverlay, stageRef, containerRef, trRef, toast, layoutCollaboration, guests, layout, duplicateGuestIds, pushState, checkCollision, handleSave, handleDragEnd, handleDrop, runAutoArranger, handleDragOver, unassignGuest, handleWheel, structuralData, exportToPNG, exportToSVG, exportToPDF, handleStageClick, generateAILayout, resetView, isSaving }: CanvasStageAreaProps) {
  return (
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-surface" onDrop={handleDrop} onDragOver={handleDragOver}>
          
          {viewingVersion && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-brand-soft border border-brand text-brand-strong px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4 font-bold">
              <ArrowLeftRight className="w-4 h-4 animate-bounce" />
              <span className="text-sm">Viewing Revision {viewingVersion.revision} Diff Overlay</span>
              <button onClick={() => setViewingVersion(null)} className="ml-2 bg-brand/20 p-1 rounded-full hover:bg-brand/30 transition-colors"><X className="w-3 h-3" /></button>
            </div>
          )}

          <div className="absolute top-4 left-4 z-10 bg-surface border border-border p-2.5 rounded-md shadow-sm opacity-90 pointer-events-none font-serif">
            <p className="text-sm font-black text-fg flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-brand" /> Layout Designer Workspace
            </p>
            <p className="text-[10px] text-fg-subtle font-semibold uppercase mt-1">Scroll to zoom · Drag background to pan</p>
          </div>
          
          <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
             <Button variant="secondary" className="bg-purple-100 text-purple-950 border-purple-200 hover:bg-purple-200 font-bold" size="sm" onClick={generateAILayout}>
               <Sparkles className="w-4 h-4 mr-1 text-purple-600 animate-spin-slow" /> Auto-Suggest Layout
             </Button>
             <Button 
                variant="secondary" 
                className="bg-indigo-100 text-indigo-950 border-indigo-200 hover:bg-indigo-200 font-bold" 
                size="sm" 
                onClick={() => setAutoArrangeOpen(true)}
             >
               <Activity className="w-4 h-4 mr-1 text-indigo-600 animate-pulse" /> AI Smart Seating
             </Button>
             <Button variant="outline" size="sm" className="font-bold" onClick={resetView}>Reset View</Button>
             <Button variant="outline" size="sm" className="font-bold border-paper-border bg-white hover:bg-brand-soft/20 text-brand" onClick={() => setShowHelpGuide(!showHelpGuide)}>
               {showHelpGuide ? '📖 Hide Guide' : '📖 Help Guide'}
             </Button>
             
             {/* Multi-Format Blueprint Exporters (Phase 6) */}
             <div className="flex gap-1 items-center border border-paper-border bg-white p-1 rounded-xl shadow-xs print:hidden">
                <Button variant="ghost" size="xs" className="text-[10px] font-bold h-7 py-0.5 px-2.5 rounded-lg hover:bg-brand-soft/20 text-brand" onClick={exportToPNG} title="Export as High-Resolution PNG for Printing">
                   📸 PNG
                </Button>
                <span className="text-[#e1d5c9] text-xs font-normal select-none">|</span>
                <Button variant="ghost" size="xs" className="text-[10px] font-bold h-7 py-0.5 px-2.5 rounded-lg hover:bg-brand-soft/20 text-brand" onClick={exportToSVG} title="Export as Scale-Accurate SVG Vector Blueprint">
                   🗺️ SVG
                </Button>
                <span className="text-[#e1d5c9] text-xs font-normal select-none">|</span>
                <Button variant="ghost" size="xs" className="text-[10px] font-bold h-7 py-0.5 px-2.5 rounded-lg hover:bg-brand-soft/20 text-brand" onClick={exportToPDF} title="Export as Architectural PDF Blueprint with Title Block">
                   📰 PDF
                </Button>
             </div>

             <Button 
                size="sm" 
                onClick={handleSave} 
                disabled={!hasChanges || isSaving}
                className={cn('font-bold', hasChanges ? 'animate-pulse' : '')}
             >
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
               Save Layout
             </Button>
          </div>

          <Stage 
            ref={stageRef}
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
                  handleStageClick(e);
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
            draggable={!drawingMode}
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
            {showProtectedLayers && <Group listening={false}>
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
            </Group>}

            {/* Custom Drawn Node Walls / Boundaries */}
            {items.filter(item => item.type === 'custom_wall').map((wall: any) => (
              <Line
                key={wall.id}
                points={wall.points}
                stroke={wall.color || "#374151"}
                strokeWidth={wall.strokeWidth || 5}
                lineCap="round"
                lineJoin="round"
                draggable
                onDragEnd={(e) => handleDragEnd(e, wall.id)}
                onClick={() => setSelectedId(wall.id)}
              />
            ))}

            {/* Currently drawing polygon node preview */}
            {drawingMode && drawnPoints.length > 0 && (
              <Group>
                {drawnPoints.map((pt, index) => (
                  <Circle key={index} x={pt.x} y={pt.y} radius={5} fill="#800020" stroke="#fff" strokeWidth={1.5} />
                ))}
                <Line
                  points={drawnPoints.flatMap(p => [p.x, p.y])}
                  stroke="#800020"
                  strokeWidth={3}
                  dash={[8, 4]}
                  lineCap="round"
                  lineJoin="round"
                />
              </Group>
            )}

            {items.map((item) => {
              const isColliding = checkCollision(item);

              if (item.type === 'sticky_note') {
                const isResolved = item.resolved === true;
                return (
                  <Group 
                    key={item.id} 
                    x={item.x} 
                    y={item.y} 
                    draggable 
                    onDragEnd={(e) => handleDragEnd(e, item.id)}
                    onClick={() => setSelectedId(item.id)}
                  >
                     <Circle 
                       radius={12} 
                       fill={isResolved ? "#10b981" : "#f59e0b"} 
                       stroke="#fff" 
                       strokeWidth={1.5} 
                       shadowColor="black"
                       shadowBlur={4}
                       shadowOffset={{ x: 1, y: 2 }}
                       shadowOpacity={0.3}
                     />
                     <Text 
                       text="📌" 
                       fontSize={12} 
                       offsetX={6} 
                       offsetY={6} 
                       listening={false} 
                     />
                     {!isResolved && item.text && (
                       <Text 
                         text={item.text.length > 15 ? item.text.slice(0, 15) + '...' : item.text} 
                         fontSize={8} 
                         fontStyle="bold"
                         fill="#2c2a29"
                         bg="white"
                         offsetX={30}
                         offsetY={-16}
                         width={60}
                         align="center"
                         listening={false}
                       />
                     )}
                  </Group>
                );
              }

              if (item.type === 'power_outlet' || item.type === 'high_voltage_source') {
                const isHV = item.type === 'high_voltage_source';
                return (
                  <Group 
                    key={item.id} 
                    x={item.x} 
                    y={item.y} 
                    draggable 
                    onDragEnd={(e) => handleDragEnd(e, item.id)}
                    onClick={() => setSelectedId(item.id)}
                  >
                     <Circle 
                       radius={12} 
                       fill={isHV ? "#fee2e2" : "#fef3c7"} 
                       stroke={isHV ? "#ef4444" : "#f59e0b"} 
                       strokeWidth={2} 
                       shadowColor="black"
                       shadowBlur={4}
                       shadowOffset={{ x: 1, y: 2 }}
                       shadowOpacity={0.3}
                     />
                     <Text 
                       text={isHV ? "🔌" : "⚡"} 
                       fontSize={12} 
                       offsetX={6} 
                       offsetY={6} 
                       listening={false} 
                     />
                     <Text 
                       text={isHV ? "HV Source" : "120V Outlet"} 
                       fontSize={8} 
                       fontStyle="bold"
                       fill={isHV ? "#b91c1c" : "#b45309"}
                       offsetX={30}
                       offsetY={-16}
                       width={60}
                       align="center"
                       listening={false}
                     />
                  </Group>
                );
              }

              if (item.type === 'round_table') {
                return (
                  <Group key={item.id} x={item.x} y={item.y} draggable onDragEnd={(e) => handleDragEnd(e, item.id)}>
                     {showClearanceRings && (
                       <Circle 
                         radius={(item.radius || 30) + 40} 
                         fill={isColliding ? "rgba(239, 68, 68, 0.04)" : "rgba(16, 185, 129, 0.04)"} 
                         stroke={isColliding ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"} 
                         strokeWidth={1.5} 
                         dash={[6, 3]} 
                         listening={false} 
                       />
                     )}
                     <Circle radius={item.radius} fill={isColliding ? "#fee2e2" : "#f3f4f6"} stroke={isColliding ? "#ef4444" : "#9ca3af"} strokeWidth={isColliding ? 3 : 2} />
                     <Text text={item.label} fontSize={12} fill="#374151" align="center" verticalAlign="middle" offsetX={item.radius||0} offsetY={7} width={(item.radius||0) * 2} />
                     {isColliding && (
                       <Text text="⚠️ Overlap" fontSize={9} fill="#ef4444" fontStyle="bold" align="center" offsetX={item.radius} offsetY={-18} width={item.radius * 2} />
                     )}
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
                      const nextItems = items.map(i => i.id === item.id ? { 
                        ...i, 
                        x: node.x(), 
                        y: node.y(), 
                        rotation: node.rotation(),
                        scaleX: node.scaleX(),
                        scaleY: node.scaleY()
                      } : i);
                      pushState(nextItems);
                    }}
                  >
                     {showClearanceRings && (
                       <Rect 
                         width={(item.width || 120) + 80} 
                         height={(item.height || 60) + 80} 
                         offsetX={((item.width || 120) + 80) / 2} 
                         offsetY={((item.height || 60) + 80) / 2} 
                         fill={isColliding ? "rgba(239, 68, 68, 0.04)" : "rgba(16, 185, 129, 0.04)"} 
                         stroke={isColliding ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"} 
                         strokeWidth={1.5} 
                         dash={[6, 3]} 
                         cornerRadius={8}
                         listening={false} 
                       />
                     )}
                     <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill={isColliding ? "#fee2e2" : "#f3f4f6"} stroke={isColliding ? "#ef4444" : "#9ca3af"} strokeWidth={isColliding ? 3 : 2} cornerRadius={4} />
                     <Text text={item.label} fontSize={12} fill="#374151" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={7} width={item.width} />
                     {isColliding && (
                       <Text text="⚠️ Overlap" fontSize={9} fill="#ef4444" fontStyle="bold" align="center" offsetX={(item.width||0)/2} offsetY={-25} width={item.width} />
                     )}
                  </Group>
                 );
              }

              if (item.type === 'decor') {
                 return (
                  <Group key={item.id} id={item.id} x={item.x} y={item.y} rotation={item.rotation || 0} scaleX={item.scaleX || 1} scaleY={item.scaleY || 1} opacity={item.opacity || 1} draggable onDragEnd={(e) => handleDragEnd(e, item.id)} onClick={() => setSelectedId(item.id)}>
                     {item.shape === 'circle' ? (
                       <Circle radius={item.width/2} fill={item.color} stroke={isColliding ? "#ef4444" : "#9ca3af"} strokeWidth={isColliding ? 2.5 : 1} />
                     ) : (
                       <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill={item.color} stroke={isColliding ? "#ef4444" : "#9ca3af"} strokeWidth={isColliding ? 2.5 : 1} cornerRadius={2} />
                     )}
                  </Group>
                 );
              }

               if (item.type === 'dance_floor') {
                 return (
                  <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation} draggable onDragEnd={(e) => handleDragEnd(e, item.id)}>
                     <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill={isColliding ? "#fee2e2" : "#e5e7eb"} stroke={isColliding ? "#ef4444" : "#d1d5db"} strokeWidth={isColliding ? 3 : 1} dash={isColliding ? undefined : [10, 5]} />
                     <Text text={item.label} fontSize={14} fill="#6b7280" fontStyle="italic" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={8} width={item.width} />
                  </Group>
                 );
              }
              
              if (item.type === 'chair') {
                const isDuplicateSeat = item.guestId && duplicateGuestIds.has(item.guestId);
                const fill = isDuplicateSeat ? "#fee2e2" : (item.guestId ? "#fdf2f8" : "#fff");
                const stroke = isDuplicateSeat ? "#ef4444" : (item.guestId ? "#ec4899" : "#6b7280");
                const strokeWidth = isDuplicateSeat ? 2.5 : 1.5;
                const textColor = isDuplicateSeat ? "#ef4444" : "#be185d";

                return (
                   <Group key={item.id} x={item.x} y={item.y} draggable onDragEnd={(e) => handleDragEnd(e, item.id)} onDblClick={() => unassignGuest(item.id)}>
                     <Circle radius={item.radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                     {item.guestInitials && (
                       <Text text={item.guestInitials} fontSize={8} fill={textColor} align="center" verticalAlign="middle" offsetX={item.radius} offsetY={4} width={item.radius * 2} listening={false} />
                     )}
                     {isDuplicateSeat && (
                       <Text text="⚠️" fontSize={10} fill="#ef4444" fontStyle="bold" align="center" offsetX={item.radius} offsetY={-16} width={item.radius * 2} listening={false} />
                     )}
                   </Group>
                )
              }
              return null;
            })}
          </Layer>
          {showCommentPins && <Layer>{(layoutCollaboration?.comments || []).filter((comment: any) => comment.status === 'open').map((comment: any, index: number) => { try { const target = JSON.parse(comment.target_json || '{}'); if (typeof target.x !== 'number' || typeof target.y !== 'number') return null; return <Group key={`comment-pin-${comment.id}`} x={target.x} y={target.y} onClick={() => { toast({ title: `Comment ${index + 1}`, description: comment.body, variant: 'success' }); }}><Circle radius={13} fill="#7c3aed" stroke="#fff" strokeWidth={2}/><Text text={String(index + 1)} fontSize={11} fontStyle="bold" fill="#fff" align="center" offsetX={13} offsetY={5} width={26}/></Group>; } catch { return null; } })}</Layer>}
          <Layer>
            {selectedId && (
              <Transformer
                ref={trRef}
                boundBoxFunc={(oldBox, newBox) => {
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
              {vendorLines.map((line, i) => (
                <Line key={i} points={line.points} stroke="#22c55e" strokeWidth={3} dash={[10, 5]} opacity={0.6} lineCap="round" lineJoin="round" />
              ))}
              
              {routePoints.length > 0 && (
                <Line points={routePoints} stroke="#22c55e" strokeWidth={3} dash={[10, 5]} opacity={0.6} lineCap="round" lineJoin="round" />
              )}

              {items.map(item => {
                if (item.type === 'vendor_zone') {
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

        {/* Collapsible Canvas Help Guide Overlay */}
        {showHelpGuide && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-paper border border-paper-border p-4 rounded-xl shadow-lg flex flex-col md:flex-row gap-4 items-start md:items-center justify-between animate-in slide-in-from-bottom-4 duration-200">
            <div className="space-y-1">
               <h4 className="font-serif font-black text-xs text-brand uppercase tracking-wider flex items-center gap-1">
                  📖 Interactive Canvas User Guide
               </h4>
               <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-[11px] text-fg-subtle font-semibold leading-normal">
                  <li>🖱️ <strong className="text-fg">Scroll Wheel</strong>: Zoom in and out of the canvas.</li>
                  <li>🖐️ <strong className="text-fg">Drag Background</strong>: Pan and navigate across the room layout.</li>
                  <li>🔄 <strong className="text-fg">Rotate Items</strong>: Select an item on stage and drag the rotation anchor handle.</li>
                  <li>👥 <strong className="text-fg">Seat Assignments</strong>: Drag guests from the "Guests" tab and drop them on chairs.</li>
                  <li>⌨️ <strong className="text-fg">Micro-Nudges</strong>: Select any item and use arrow keys (←, →, ↑, ↓) to shift it by 5px.</li>
                  <li>🚨 <strong className="text-fg">Safety Circles</strong>: Green translucent rings show safety clearances. Overlapping items flash Red alerts.</li>
               </ul>
            </div>
            <Button size="xs" onClick={() => setShowHelpGuide(false)} className="bg-brand text-brand-fg shrink-0 text-[10px] font-bold py-1 px-3">
               Got It!
            </Button>
          </div>
        )}

        {autoArrangeOpen && (
           <Dialog open={autoArrangeOpen} onOpenChange={setAutoArrangeOpen}>
              <DialogContent className="max-w-xl bg-paper border border-paper-border rounded-2xl shadow-xl">
                 <DialogHeader>
                    <DialogTitle className="font-serif font-bold text-lg text-brand flex items-center gap-1.5">
                       🧠 AI Smart Seating Auto-Arranger
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                       Our algorithms will automatically cluster and assign unassigned guests to tables based on family parties.
                    </DialogDescription>
                 </DialogHeader>

                 <div className="space-y-4 py-2 font-semibold text-xs text-fg">
                    {/* Select Affinity Rule */}
                    <div>
                       <Label className="text-[10px] uppercase font-bold text-fg-subtle">Seating Affinity Rule</Label>
                       <select
                          value={affinityRule}
                          onChange={(e) => setAffinityRule(e.target.value as any)}
                          className="mt-1.5 w-full h-10 px-3 rounded-lg border border-paper-border bg-white text-xs font-semibold cursor-pointer"
                       >
                          <option value="together">🟢 Keep Parties &amp; Families Together (Recommended)</option>
                          <option value="spread">🟡 Spread Out Groups (Socialize &amp; Mingle)</option>
                       </select>
                    </div>

                    {/* Summary of Unassigned Guests & Groups */}
                    <div className="bg-white p-4 rounded-xl border border-paper-border space-y-2.5">
                       <h4 className="text-[10px] uppercase tracking-wider font-bold text-brand">Detected Guest Clusters</h4>
                       {(() => {
                          const unassigned = guests.filter(g => !items.some(i => i.guestId === g.id));
                          const partiesMap: Record<string, number> = {};
                          unassigned.forEach(g => {
                             const p = g.party_name || 'Individual';
                             partiesMap[p] = (partiesMap[p] || 0) + 1;
                          });
                          const partiesList = Object.entries(partiesMap);

                          return (
                             <div className="space-y-1.5">
                                <p className="text-fg-subtle text-[11px] font-semibold">{unassigned.length} unassigned guests in {partiesList.length} clusters ready to seat.</p>
                                <div className="max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-1.5 pt-1">
                                   {partiesList.map(([name, count]) => (
                                      <Badge key={name} variant="outline" className="bg-paper text-fg-subtle border-paper-border text-[9px] py-0.5 px-2">
                                         {name}: {count}
                                      </Badge>
                                   ))}
                                </div>
                             </div>
                          );
                       })()}
                    </div>
                 </div>

                 <DialogFooter className="border-t border-paper-border pt-4 mt-2">
                    <Button variant="ghost" onClick={() => setAutoArrangeOpen(false)}>Cancel</Button>
                    <Button onClick={runAutoArranger} className="bg-brand text-brand-fg font-bold">
                       ⚡ Run AI Seating
                    </Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>
        )}
        </div>
  );
}
