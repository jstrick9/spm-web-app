import {
  Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight,
  X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin, Sliders,
  PenTool, Undo2, Redo2, Grid, Activity, FileText, Keyboard, Printer, Eye, Umbrella, Smartphone, Maximize2, QrCode, Camera, ShieldCheck, ClipboardCheck, Accessibility, Zap
} from 'lucide-react';
import { Button } from '../../../../ui/Button';

export interface CanvasToolbarProps {
  snapToGrid: boolean;
  setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>;
  showClearanceRings: boolean;
  setShowClearanceRings: React.Dispatch<React.SetStateAction<boolean>>;
  drawingMode: boolean;
  setDrawingMode: React.Dispatch<React.SetStateAction<boolean>>;
  drawnPoints: { x: number; y: number }[];
  setDrawnPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
  undoStack: any[][];
  redoStack: any[][];
  handleUndo: () => void;
  handleRedo: () => void;
  finalizeCustomWall: () => void;
}

export function CanvasToolbar({ snapToGrid, setSnapToGrid, showClearanceRings, setShowClearanceRings, drawingMode, setDrawingMode, drawnPoints, setDrawnPoints, undoStack, redoStack, handleUndo, handleRedo, finalizeCustomWall }: CanvasToolbarProps) {
  return (
      <div className="flex flex-wrap items-center justify-between p-3 bg-paper rounded-xl border border-paper-border gap-3 shadow-md animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo} 
            disabled={undoStack.length === 0} 
            title="Undo (⌘Z)"
            className="border-paper-border hover:bg-brand-soft/20 text-fg-muted hover:text-fg font-semibold transition-all"
          >
            <Undo2 className="h-4 w-4 mr-1 text-brand" /> Undo {undoStack.length > 0 && <span className="text-[10px] bg-brand-soft text-brand-strong px-1.5 py-0.5 rounded-full ml-1 font-bold">{undoStack.length}</span>}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRedo} 
            disabled={redoStack.length === 0} 
            title="Redo (⌘Y)"
            className="border-paper-border hover:bg-brand-soft/20 text-fg-muted hover:text-fg font-semibold transition-all"
          >
            <Redo2 className="h-4 w-4 mr-1 text-brand" /> Redo {redoStack.length > 0 && <span className="text-[10px] bg-brand-soft text-brand-strong px-1.5 py-0.5 rounded-full ml-1 font-bold">{redoStack.length}</span>}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-paper px-3.5 py-2 rounded-xl border border-paper-border text-xs font-semibold shadow-xs">
            <Grid className="h-4 w-4 text-brand" />
            <span className="text-fg-subtle">Grid Snapping (20px)</span>
            <input
              type="checkbox"
              aria-label="Grid Snapping (20px)"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="rounded border-paper-border text-brand accent-brand h-4 w-4 ml-1 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-paper px-3.5 py-2 rounded-xl border border-paper-border text-xs font-semibold shadow-xs">
            <GripVertical className="h-4 w-4 text-brand" />
            <span className="text-fg-subtle">Spacing Safety Rings</span>
            <input
              type="checkbox"
              aria-label="Spacing Safety Rings"
              checked={showClearanceRings}
              onChange={(e) => setShowClearanceRings(e.target.checked)}
              className="rounded border-paper-border text-brand accent-brand h-4 w-4 ml-1 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={drawingMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (drawingMode) {
                  finalizeCustomWall();
                } else {
                  setDrawingMode(true);
                  setDrawnPoints([]);
                }
              }}
              className="flex items-center gap-1.5"
            >
              <PenTool className="h-4 w-4 text-brand" />
              {drawingMode ? 'Close Polygon Wall' : 'Draw Polygon Walls'}
            </Button>
            {drawingMode && (
              <span className="text-xs font-bold text-brand animate-pulse">
                Click canvas to place nodes ({drawnPoints.length} set)
              </span>
            )}
          </div>
        </div>
      </div>
  );
}
