import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Group, Text, Arc, Rect, Transformer } from 'react-konva';
import { Button } from '../../../ui/Button';
import { MousePointer2, PenTool, Save, Trash2, Undo, DoorOpen, AppWindow, Cylinder, Upload, Download } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { useToast } from '../../../ui/Toast';
import { cn } from '../../../ui/lib/cn';
import { VenueSpaceScaffoldWizard } from './VenueSpaceScaffoldWizard';
import { venuesSdk } from '../../../sdk/venues';
import { extractDxfPaths } from './dxfImport';
import { importSvgPaths } from './svgImport';

interface Props {
  orgId: string;
}

export function VenueBuilder({ orgId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedVenue, setSelectedVenue] = useState<any | null>(null);
  const [underlayOpacity, setUnderlayOpacity] = useState(0.5);
  const [underlayLocked, setUnderlayLocked] = useState(true);
  const [underlayRotation, setUnderlayRotation] = useState(0);
  const [underlayScale, setUnderlayScale] = useState(1);
  const [calibrationPixels, setCalibrationPixels] = useState('');
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [dxfLayers, setDxfLayers] = useState<string[]>([]); const [hiddenDxfLayers, setHiddenDxfLayers] = useState<Set<string>>(new Set());
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateMoment, setTemplateMoment] = useState('reception');
  const [templateService, setTemplateService] = useState('plated');
  const [templateMinGuests, setTemplateMinGuests] = useState('1');
  const [templateMaxGuests, setTemplateMaxGuests] = useState('');
  const [templateCategories, setTemplateCategories] = useState<string[]>(['tables', 'chairs', 'decor', 'service', 'ceremony']);
  const [templateInventoryIds, setTemplateInventoryIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Builder Modes
  const [mode, setMode] = useState<'select' | 'draw_wall' | 'add_door' | 'add_window' | 'add_pillar' | 'add_exit' | 'add_accessible_route' | 'add_power' | 'add_loading'>('select');
  
  // State
  const [lines, setLines] = useState<any[]>([]);
  const [doors, setDoors] = useState<any[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  const [pillars, setPillars] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [scale, setScale] = useState(1);
  const [gridSize, setGridSize] = useState(50);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridPhysical, setGridPhysical] = useState(5);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trRef = useRef<any>(null);

  // Load venue structural guidelines
  const { data, isLoading } = useQuery({
    queryKey: ['catalog', orgId, 'guideline'],
    queryFn: () => sdk.catalog.list(orgId, 'guideline' as any),
  });
  const { data: venueTemplates } = useQuery({
    queryKey: ['catalog', orgId, 'template'],
    queryFn: () => sdk.catalog.list(orgId, 'template' as any),
  });
  const { data: venueInventory } = useQuery({
    queryKey: ['inventory', orgId],
    queryFn: () => sdk.inventory.list(orgId),
    enabled: templateEditorOpen,
  });
  const { data: scaffoldVersions } = useQuery({ queryKey: ['venue-scaffold-versions', selectedVenue?.id], queryFn: () => venuesSdk.scaffoldVersions(selectedVenue.id), enabled: !!selectedVenue?.id });

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
    setDoors(layout.doors || []); setWindows(layout.windows || []); setPillars(layout.pillars || []); setZones(layout.zones || []);
    if (selectedVenue.canvas_width || selectedVenue.width) {
      const canvasWidth = selectedVenue.canvas_width || selectedVenue.width * 10;
      setDimensions({ width: canvasWidth, height: selectedVenue.canvas_height || selectedVenue.height * 10 });
      if (selectedVenue.width) setGridPhysical(Number(((selectedVenue.width / canvasWidth) * gridSize).toFixed(2)));
    }
    const underlay = (() => { try { return typeof selectedVenue.underlay === 'string' ? JSON.parse(selectedVenue.underlay || '{}') : (selectedVenue.underlay || {}); } catch { return {}; } })();
    setCalibrationPixels(underlay.calibrationPixels ? String(underlay.calibrationPixels) : ''); setCalibrationDistance(underlay.calibrationDistance ? String(underlay.calibrationDistance) : '');
    setUnderlayOpacity(Number(underlay.opacity ?? 0.5)); setUnderlayLocked(underlay.locked !== false); setUnderlayRotation(Number(underlay.rotation ?? 0)); setUnderlayScale(Number(underlay.scale ?? 1));
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
        return venuesSdk.saveScaffold(selectedVenue.id, { masterLayout: { walls: lines, doors, windows, pillars, zones }, canvasWidth: dimensions.width, canvasHeight: dimensions.height, description: 'Canvas structural update' });
      }
      const res = await sdk.catalog.list(orgId, 'guideline' as any);
      const structural = res.items.find(i => i.name === 'Venue Structural Walls');
      
      const payload = {
        name: 'Venue Structural Walls',
        visible: true,
        spec: { type: 'structural', lines, doors, windows, pillars, zones }
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
    const rawPt = getRelativePointerPosition(stage);
    const pt = snapToGrid ? { x: Math.round(rawPt.x / gridSize) * gridSize, y: Math.round(rawPt.y / gridSize) * gridSize } : rawPt;

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
    } else if (mode.startsWith('add_')) {
      const type = mode.replace('add_', '');
      setZones([...zones, { id: `zone-${Date.now()}`, type, x: pt.x, y: pt.y, width: type === 'accessible_route' ? 120 : 60, height: type === 'accessible_route' ? 36 : 60 }]);
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

  const templateMutation = useMutation({
    mutationFn: () => {
      if (!selectedVenue) throw new Error('Select an approved venue space first');
      const minGuests = Number(templateMinGuests);
      const maxGuests = Number(templateMaxGuests || selectedVenue.capacity);
      if (!Number.isInteger(minGuests) || minGuests < 1 || !Number.isInteger(maxGuests) || maxGuests < minGuests) throw new Error('Enter a valid guest range.');
      if (!templateCategories.length) throw new Error('Choose at least one object category.');
      return sdk.catalog.create(orgId, 'template', {
        name: templateName.trim() || `${selectedVenue.name} ${templateMoment} template`, visible: true,
        spec: { venueId: selectedVenue.id, weddingMoment: templateMoment, serviceStyle: templateService, minGuests, maxGuests,
          masterLayout: { walls: lines, doors, windows, pillars, zones }, allowedObjectCategories: templateCategories,
          allowedInventoryItemIds: templateInventoryIds.length ? templateInventoryIds : null }
      });
    },
    onSuccess: () => { setTemplateName(''); setTemplateInventoryIds([]); setTemplateEditorOpen(false); toast({ title: 'Venue template published', description: 'Couples can now use this approved template as an editable proposal.', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not publish template', description: e.message, variant: 'destructive' })
  });

  const archiveTemplateMutation = useMutation({
    mutationFn: (template: any) => sdk.catalog.update(template.id, { visible: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalog', orgId, 'template'] }); toast({ title: 'Template archived', description: 'It is no longer available to couples.', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not archive template', description: e.message, variant: 'destructive' }),
  });

  const openTemplateEditor = () => {
    if (!selectedVenue || selectedVenue.approval_status !== 'approved') { toast({ title: 'Choose an approved venue space', description: 'Templates are always connected to an approved venue space.', variant: 'destructive' }); return; }
    setTemplateMaxGuests(String(selectedVenue.capacity || ''));
    setTemplateEditorOpen(true);
  };
  const toggleTemplateChoice = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);

  const handleVectorImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const newLines: any[] = [];
      if (file.name.toLowerCase().endsWith('.dxf')) {
        const { default: DxfParser } = await import('dxf-parser');
        const result = extractDxfPaths(new DxfParser().parseSync(text), `dxf-${Date.now()}`, selectedVenue?.unit_system === 'metric' ? 'm' : 'ft');
        newLines.push(...result.paths); setDxfLayers((current) => [...new Set([...current, ...result.layers])]);
        if (result.units || result.layers.length) {
          toast({ title: `DXF reference: ${result.units ?? 'unspecified units'}${result.layers.length ? ` · ${result.layers.length} layer${result.layers.length === 1 ? '' : 's'}` : ''}`, variant: 'success' });
        }
      } else {
      newLines.push(...importSvgPaths(text));
      }
      if (newLines.length > 0) {
        setLines([...lines, ...newLines]);
        setHasChanges(true);
        toast({ title: `Imported ${newLines.length} paths from ${file.name.toLowerCase().endsWith('.dxf') ? 'DXF' : 'SVG'}`, variant: 'success' });
      } else {
        toast({ title: 'No supported paths found in this vector file', variant: 'destructive' });
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

  const updateUnderlay = (patch: Record<string, unknown>) => {
    if (!selectedVenue) return;
    const current = (() => { try { return typeof selectedVenue.underlay === 'string' ? JSON.parse(selectedVenue.underlay || '{}') : (selectedVenue.underlay || {}); } catch { return {}; } })();
    const underlay = { ...current, ...patch };
    setSelectedVenue({ ...selectedVenue, underlay });
    void venuesSdk.update(selectedVenue.id, { underlay });
  };

  const exportPng = () => {
    const stage = trRef.current?.getStage?.() || containerRef.current?.querySelector('canvas');
    const dataUrl = stage?.toDataURL?.({ pixelRatio: 2 }) || (stage instanceof HTMLCanvasElement ? stage.toDataURL('image/png') : null);
    if (!dataUrl) { toast({ title: 'Export unavailable', description: 'Select or open a venue scaffold first.', variant: 'destructive' }); return; }
    const link = document.createElement('a'); link.href = dataUrl; link.download = `${selectedVenue?.name || 'venue-space'}-scaffold.png`; link.click();
    toast({ title: 'PNG exported', description: 'Share this reference with planners or your operations team.', variant: 'success' });
  };

  const exportPdf = () => {
    const stage = trRef.current?.getStage?.() || containerRef.current?.querySelector('canvas');
    const dataUrl = stage?.toDataURL?.({ pixelRatio: 2 }) || (stage instanceof HTMLCanvasElement ? stage.toDataURL('image/png') : null);
    if (!dataUrl) { toast({ title: 'Export unavailable', variant: 'destructive' }); return; }
    const popup = window.open('', '_blank'); if (!popup) return;
    const title = String(selectedVenue?.name || 'Venue scaffold').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
    popup.document.write(`<!doctype html><title>${title}</title><style>body{font-family:system-ui;padding:24px}img{max-width:100%;height:auto}</style><h1>${title}</h1><p>${selectedVenue?.width || ''} × ${selectedVenue?.height || ''} ${selectedVenue?.unit_system === 'metric' ? 'm' : 'ft'} · revision ${selectedVenue?.revision || 1}</p><img src="${dataUrl}" onload="window.print()">`);
    popup.document.close();
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setDoors(prev => prev.filter(d => d.id !== selectedId));
    setWindows(prev => prev.filter(w => w.id !== selectedId));
    setPillars(prev => prev.filter(p => p.id !== selectedId));
    setZones(prev => prev.filter(zone => zone.id !== selectedId));
    setSelectedId(null);
    setHasChanges(true);
  };

  return (
    <div className="flex flex-col gap-4">
       <VenueSpaceScaffoldWizard orgId={orgId} onSelectVenue={setSelectedVenue} />
       {selectedVenue && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand-soft/20 px-3 py-2 text-sm text-brand">
         <span>Editing scaffold: <strong>{selectedVenue.name}</strong> · {selectedVenue.width}×{selectedVenue.height} · {selectedVenue.unit_system ?? 'imperial'} · {selectedVenue.approval_status ?? 'draft'}</span>
         {(() => { try { const u = typeof selectedVenue.underlay === 'string' ? JSON.parse(selectedVenue.underlay || '{}') : selectedVenue.underlay; return u?.url ? <>
           <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={underlayLocked} onChange={(e) => { setUnderlayLocked(e.target.checked); updateUnderlay({ locked: e.target.checked }); }} /> Lock underlay</label>
           <label className="flex items-center gap-1 text-xs">Opacity <input aria-label="Underlay opacity" type="range" min="0.1" max="1" step="0.05" value={underlayOpacity} onChange={(e) => { const opacity = Number(e.target.value); setUnderlayOpacity(opacity); updateUnderlay({ opacity }); }} /></label>
           <label className="flex items-center gap-1 text-xs">Scale <input aria-label="Underlay scale" type="range" min="0.5" max="2" step="0.05" value={underlayScale} onChange={(e) => { const scale = Number(e.target.value); setUnderlayScale(scale); updateUnderlay({ scale }); }} /></label>
           <label className="flex items-center gap-1 text-xs">Rotate <select aria-label="Underlay rotation" value={underlayRotation} onChange={(e) => { const rotation = Number(e.target.value); setUnderlayRotation(rotation); updateUnderlay({ rotation }); }}><option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></label>
           {typeof u.sourceUrl === 'string' && <a className="text-xs font-semibold underline" href={u.sourceUrl} target="_blank" rel="noreferrer">Open original {u.sourceName || 'PDF'}</a>}
           <span className="flex items-center gap-1 rounded border border-brand/20 bg-surface px-2 py-1 text-xs"><strong>Calibrate</strong><input aria-label="Known line pixels" className="w-14 border rounded px-1" type="number" min="1" value={calibrationPixels} onChange={(e) => setCalibrationPixels(e.target.value)} placeholder="px"/><span>px =</span><input aria-label="Known line distance" className="w-14 border rounded px-1" type="number" min="0.1" value={calibrationDistance} onChange={(e) => setCalibrationDistance(e.target.value)} placeholder={selectedVenue.unit_system === 'metric' ? 'm' : 'ft'}/><Button size="xs" variant="outline" onClick={() => { const pixels = Number(calibrationPixels); const distance = Number(calibrationDistance); if (!pixels || !distance) { toast({ title: 'Enter a known line', description: 'Measure a line on the reference plan in pixels and enter its real-world distance.', variant: 'destructive' }); return; } updateUnderlay({ calibrationPixels: pixels, calibrationDistance: distance, pixelsPerUnit: pixels / distance, calibrationMethod: 'known_line' }); toast({ title: 'Reference calibrated', description: `${pixels / distance} pixels per ${selectedVenue.unit_system === 'metric' ? 'meter' : 'foot'}.`, variant: 'success' }); }}>Save scale</Button></span>
         </> : null; } catch { return null; } })()}
       </div>}
       {dxfLayers.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3 text-xs"><strong>DXF layers</strong>{dxfLayers.map((layer) => <label key={layer} className="flex items-center gap-1 rounded border border-border px-2 py-1"><input type="checkbox" checked={!hiddenDxfLayers.has(layer)} onChange={(e) => setHiddenDxfLayers((current) => { const next = new Set(current); if (e.target.checked) next.delete(layer); else next.add(layer); return next; })}/>{layer}</label>)}</div>}
       {selectedVenue && <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 text-xs md:grid-cols-3"><div><strong>Space readiness</strong><p className="text-fg-muted">{zones.length} operational zones · {selectedVenue.capacity} guest capacity</p></div><div><strong>Reference plan</strong><p className="text-fg-muted">{underlayLocked ? 'Locked' : 'Unlocked'} · {Math.round(underlayOpacity * 100)}% opacity · {selectedVenue.width}×{selectedVenue.height} {selectedVenue.unit_system === 'metric' ? 'm' : 'ft'} overall fit</p></div><div><strong>Revision history</strong><p className="text-fg-muted">{scaffoldVersions?.versions?.length ?? 0} saved revision(s)</p></div></div>}
       {selectedVenue && <div className="rounded-lg border border-warning/30 bg-warning-soft/20 px-3 py-2 text-xs text-warning">{!zones.some((z) => z.type === 'exit') && <span className="mr-3">Add at least one exit.</span>}{!zones.some((z) => z.type === 'accessible_route') && <span className="mr-3">Add an accessible route.</span>}{!zones.some((z) => z.type === 'power') && <span className="mr-3">Add a power zone.</span>}{!zones.some((z) => z.type === 'loading') && <span>Add a loading zone.</span>}</div>}
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
             <Button variant={mode === 'add_exit' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_exit')}>Exit</Button>
             <Button variant={mode === 'add_accessible_route' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_accessible_route')}>Accessible route</Button>
             <Button variant={mode === 'add_power' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_power')}>Power</Button>
             <Button variant={mode === 'add_loading' ? 'default' : 'secondary'} size="sm" onClick={() => setMode('add_loading')}>Loading</Button>
             <label className="ml-2 flex items-center gap-1 text-xs text-fg-muted"><input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} /> Snap</label>
             <select aria-label="Grid size" className="h-8 rounded border border-border bg-surface px-2 text-xs" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}><option value={25}>Fine grid</option><option value={50}>Standard grid</option><option value={100}>Large grid</option></select>
             {selectedVenue && <span className="text-xs text-fg-muted">Grid ≈ {gridPhysical} {selectedVenue.unit_system === 'metric' ? 'm' : 'ft'}</span>}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
             {selectedId && (
               <Button variant="outline" className="text-danger border-danger/30 hover:bg-danger/10" size="sm" onClick={deleteSelected}>
                 <Trash2 className="w-4 h-4 mr-1"/> Delete Selected
               </Button>
             )}
             <Button size="sm" variant="outline" disabled={!selectedVenue || selectedVenue.approval_status !== 'approved'} onClick={openTemplateEditor}>Save layout as template</Button>
             <div className="w-px h-6 bg-border mx-1" />
             <input type="file" accept=".svg,.dxf" className="hidden" ref={fileInputRef} onChange={handleVectorImport} />
             <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
               <Upload className="w-4 h-4 mr-1"/> Import SVG / DXF
             </Button>
             <Button variant="outline" size="sm" onClick={exportPng}>
               <Download className="w-4 h-4 mr-1" /> Export PNG
             </Button>
             <Button variant="outline" size="sm" onClick={exportPdf}>
               <Download className="w-4 h-4 mr-1" /> Print / Save PDF
             </Button>
             <Button size="sm" disabled={!hasChanges || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
               <Save className="w-4 h-4 mr-1" /> Save
             </Button>
          </div>
       </div>

       {templateEditorOpen && <section aria-label="Venue template editor" className="rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-sm">
         <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-semibold">Publish venue template</h3><p className="text-sm text-fg-muted">This captures the current structural space. Couples can edit only the object types and inventory you allow.</p></div><Button size="xs" variant="ghost" onClick={() => setTemplateEditorOpen(false)}>Close</Button></div>
         <div className="grid gap-3 md:grid-cols-3"><label className="text-sm">Template name<input aria-label="Template name" className="mt-1 h-9 w-full rounded border border-border bg-surface px-2" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder={`${selectedVenue?.name || 'Venue'} template`}/></label><label className="text-sm">Wedding moment<select aria-label="Template moment" className="mt-1 h-9 w-full rounded border border-border bg-surface px-2" value={templateMoment} onChange={(e) => setTemplateMoment(e.target.value)}><option value="ceremony">Ceremony</option><option value="cocktail">Cocktail hour</option><option value="reception">Reception</option><option value="outdoor_tent">Outdoor / tent</option><option value="rain_plan">Rain plan</option></select></label><label className="text-sm">Service style<select aria-label="Template service style" className="mt-1 h-9 w-full rounded border border-border bg-surface px-2" value={templateService} onChange={(e) => setTemplateService(e.target.value)}><option value="plated">Plated</option><option value="buffet_stations">Buffet / stations</option><option value="family_style">Family-style</option><option value="cocktail">Cocktail reception</option><option value="brunch">Brunch</option></select></label><label className="text-sm">Minimum guests<input aria-label="Minimum guests" type="number" min="1" className="mt-1 h-9 w-full rounded border border-border bg-surface px-2" value={templateMinGuests} onChange={(e) => setTemplateMinGuests(e.target.value)}/></label><label className="text-sm">Maximum guests<input aria-label="Maximum guests" type="number" min="1" className="mt-1 h-9 w-full rounded border border-border bg-surface px-2" value={templateMaxGuests} onChange={(e) => setTemplateMaxGuests(e.target.value)}/></label></div>
         <fieldset className="mt-4"><legend className="text-sm font-medium">Couple-editable object categories</legend><div className="mt-2 flex flex-wrap gap-3">{['tables','chairs','decor','service','ceremony'].map(category => <label key={category} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={templateCategories.includes(category)} onChange={() => toggleTemplateChoice(category, setTemplateCategories)}/>{category}</label>)}</div></fieldset>
         <fieldset className="mt-4"><legend className="text-sm font-medium">Approved inventory overrides <span className="font-normal text-fg-muted">(optional; leave empty to allow compatible inventory)</span></legend><div className="mt-2 flex flex-wrap gap-3">{venueInventory?.items?.length ? venueInventory.items.map((item: any) => <label key={item.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={templateInventoryIds.includes(item.id)} onChange={() => toggleTemplateChoice(item.id, setTemplateInventoryIds)}/>{item.name}</label>) : <p className="text-sm text-fg-muted">No venue inventory is available to restrict yet.</p>}</div></fieldset>
         <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setTemplateEditorOpen(false)}>Cancel</Button><Button isLoading={templateMutation.isPending} onClick={() => templateMutation.mutate()}>Publish template</Button></div>
       </section>}

       <section aria-label="Venue template library" className="rounded-lg border border-border bg-surface p-4"><div className="flex items-baseline justify-between gap-3"><div><h3 className="font-semibold">Venue template library</h3><p className="text-sm text-fg-muted">Only active templates linked to approved spaces appear in the couple gallery.</p></div><span className="text-sm text-fg-muted">{venueTemplates?.items?.filter((template: any) => template.visible).length ?? 0} active</span></div><div className="mt-3 grid gap-2 md:grid-cols-2">{venueTemplates?.items?.length ? venueTemplates.items.map((template: any) => { const spec = typeof template.spec === 'string' ? (() => { try { return JSON.parse(template.spec); } catch { return {}; } })() : (template.spec || {}); return <div key={template.id} className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm"><div><strong>{template.name}</strong><p className="text-fg-muted">{spec.weddingMoment || 'Wedding layout'} · {spec.serviceStyle || 'Flexible service'} · {spec.minGuests ?? '—'}–{spec.maxGuests ?? '—'} guests</p><p className="text-xs text-fg-muted">{template.visible ? 'Active in couple gallery' : 'Archived'}</p></div>{template.visible && <Button size="xs" variant="outline" isLoading={archiveTemplateMutation.isPending} onClick={() => archiveTemplateMutation.mutate(template)}>Archive</Button>}</div>; }) : <p className="text-sm text-fg-muted">Save an approved layout as a template to start your gallery.</p>}</div></section>

       <div ref={containerRef} className="w-full h-[600px] border border-border rounded-lg bg-surface relative overflow-hidden">
          {(() => { try { const underlay = selectedVenue?.underlay ? (typeof selectedVenue.underlay === 'string' ? JSON.parse(selectedVenue.underlay) : selectedVenue.underlay) : null; return underlay?.url ? <img src={underlay.url} alt="Venue reference underlay" className="absolute inset-0 h-full w-full object-contain pointer-events-none" style={{ opacity: underlayOpacity, transform: `scale(${underlayScale}) rotate(${underlayRotation}deg)` }} /> : null; } catch { return null; } })()}
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
                {Array.from({ length: Math.ceil(2000 / gridSize) }).map((_, i) => (
                   <React.Fragment key={i}>
                      <Line points={[0, i * gridSize, 2000, i * gridSize]} stroke="#e5e7eb" strokeWidth={1} />
                      <Line points={[i * gridSize, 0, i * gridSize, 2000]} stroke="#e5e7eb" strokeWidth={1} />
                   </React.Fragment>
                ))}
              </Group>

              {/* Walls */}
              {lines.filter((line) => !line.layer || !hiddenDxfLayers.has(line.layer)).map((line, i) => (
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

              {/* Operational zones */}
              {zones.map((zone) => <Group key={zone.id} id={zone.id} x={zone.x} y={zone.y} draggable={mode === 'select'} onClick={() => mode === 'select' && setSelectedId(zone.id)} onDragEnd={(e) => { setZones(prev => prev.map(item => item.id === zone.id ? { ...item, x: e.target.x(), y: e.target.y() } : item)); setHasChanges(true); }}><Rect width={zone.width} height={zone.height} fill={zone.type === 'exit' ? '#dcfce7' : zone.type === 'power' ? '#fef3c7' : '#dbeafe'} stroke={zone.type === 'exit' ? '#16a34a' : zone.type === 'power' ? '#d97706' : '#2563eb'} strokeWidth={2} dash={[6, 4]} /><Text text={zone.type.replace('_', ' ')} fontSize={11} fill="#374151" width={zone.width} align="center" y={zone.height / 2 - 6} /></Group>)}

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
