import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Arc } from 'react-konva';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutsSdk } from '../../../sdk/layouts';
import { guestsSdk } from '../../../sdk/guests';
import { sdk } from '../../../sdk';
import { cn } from '../../../ui/lib/cn';
import type { SdkEvent, SdkLayout } from '../../../sdk/types';
import {
  Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight,
  X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin, Sliders,
  PenTool, Undo2, Redo2, Grid, Activity
} from 'lucide-react';
import { vendorsSdk } from '../../../sdk/vendors';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { useToast } from '../../../ui/Toast';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../ui/Dialog';

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
  const { toast } = useToast();
  const stageRef = useRef<any>(null);
  const qc = useQueryClient();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [routePoints, setRoutePoints] = useState<number[]>([]);
  
  // Custom Snap to Grid state
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const gridSize = 20;

  // Spacing Safety Guide & Help States (Phase 6)
  const [showHelpGuide, setShowHelpGuide] = useState<boolean>(false);
  const [showClearanceRings, setShowClearanceRings] = useState<boolean>(true);
  const [guestSearch, setGuestSearch] = useState<string>('');

  // AI Smart Seating Auto-Arranger States (Phase 6)
  const [autoArrangeOpen, setAutoArrangeOpen] = useState<boolean>(false);
  const [affinityRule, setAffinityRule] = useState<'together' | 'spread'>('together');

  // Custom Node Wall Boundary Drawing Tool State
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawnPoints, setDrawnPoints] = useState<{ x: number; y: number }[]>([]);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);

  // Data Fetching
  const { data: guestsData } = useQuery({
    queryKey: ['guests', event.id],
    queryFn: () => guestsSdk.list(event.id),
  });
  const guests = guestsData?.guests || [];

  const { data: decorData } = useQuery({
    queryKey: ['decor', event.organization_id],
    queryFn: () => sdk.catalog.list(event.organization_id, 'decor' as any),
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

  const duplicateGuestIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const item of items) {
      if (item.guestId) {
        if (seen.has(item.guestId)) {
          duplicates.add(item.guestId);
        } else {
          seen.add(item.guestId);
        }
      }
    }
    return duplicates;
  }, [items]);
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

  // Push to Undo Stack Helper
  const pushState = (nextItems: any[]) => {
    setUndoStack(prev => [...prev, items]);
    setRedoStack([]); // Clear redo
    setItems(nextItems);
    setHasChanges(true);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(curr => curr.slice(0, -1));
    setRedoStack(curr => [...curr, items]);
    setItems(prev);
    setHasChanges(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(curr => curr.slice(0, -1));
    setUndoStack(curr => [...curr, items]);
    setItems(next);
    setHasChanges(true);
  };

  // Bind Ctrl+Z / Ctrl+Y keyboard shortcuts
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [undoStack, redoStack, items]);

  // Helper Bounding Box Collision Detection
  const getBounds = (item: any) => {
    const w = item.width || item.radius * 2 || 32;
    const h = item.height || item.radius * 2 || 32;
    return {
      minX: item.x - w / 2,
      maxX: item.x + w / 2,
      minY: item.y - h / 2,
      maxY: item.y + h / 2,
    };
  };

  // Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  const checkCollision = (item: any) => {
    if (item.type === 'chair' || item.type === 'vendor_zone' || item.type === 'custom_wall') return false;
    const boundsA = getBounds(item);
    const rA = item.radius || Math.max(item.width || 32, item.height || 32) / 2;

    // 1. Check overlaps and clearances with other floorplan items
    const collidesWithItem = items.some(other => {
      if (other.id === item.id || other.type === 'chair' || other.type === 'vendor_zone' || other.type === 'custom_wall') return false;
      const boundsB = getBounds(other);
      
      // Standard bounding box overlap
      const isOverlapping = (
        boundsA.minX < boundsB.maxX &&
        boundsA.maxX > boundsB.minX &&
        boundsA.minY < boundsB.maxY &&
        boundsA.maxY > boundsB.minY
      );

      if (isOverlapping) return true;

      // Table-to-table Spacing Clearance check (min 40px buffer between table edges)
      if ((item.type === 'round_table' || item.type === 'rect_table') && 
          (other.type === 'round_table' || other.type === 'rect_table')) {
         const centerDist = Math.hypot(item.x - other.x, item.y - other.y);
         const rB = other.radius || Math.max(other.width || 32, other.height || 32) / 2;
         const clearSpace = centerDist - (rA + rB);
         if (clearSpace < 40) { // 40px ~ 2ft spacing safety clearance
            return true;
         }
      }
      return false;
    });

    if (collidesWithItem) return true;

    // 2. Check overlap with custom drawn partition walls
    const collidesWithCustomWalls = items.filter(i => i.type === 'custom_wall').some(wall => {
      if (!wall.points || wall.points.length < 4) return false;
      for (let idx = 0; idx < wall.points.length - 2; idx += 2) {
         const dist = distToSegment(item.x, item.y, wall.points[idx], wall.points[idx+1], wall.points[idx+2], wall.points[idx+3]);
         if (dist < rA + 10) { // Wall clearance warning threshold
            return true;
         }
      }
      return false;
    });

    return collidesWithCustomWalls;
  };

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
    let nextX = node.x();
    let nextY = node.y();

    // Snap layout coordinates to Grid Subdivisions
    if (snapToGrid) {
      nextX = Math.round(nextX / gridSize) * gridSize;
      nextY = Math.round(nextY / gridSize) * gridSize;
    }

    const nextItems = items.map(i => i.id === id ? { 
      ...i, 
      x: nextX, 
      y: nextY, 
      rotation: Math.round(node.rotation() / 15) * 15, // Snap rotations to 15deg segments
      scaleX: node.scaleX(),
      scaleY: node.scaleY()
    } : i);

    pushState(nextItems);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedGuestRef.current) return;
    
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
       pushState([...items, newZone]);
       setShowVendorOverlay(true);
       draggedGuestRef.current = null;
       return;
    }

    const chair = items.find(i => i.type === 'chair' && Math.hypot(i.x - point.x, i.y - point.y) < (i.radius || 15));
    if (chair) {
       const nextItems = items.map(item =>
         item.id === chair.id ? { 
           ...item, 
           guestId: draggedGuestRef.current!.id,
           guestName: draggedGuestRef.current!.name,
           guestInitials: draggedGuestRef.current!.initials
         } : item
       );
       pushState(nextItems);
    }
    draggedGuestRef.current = null;
  };

  const getChairTable = (chair: any, allTables: any[]) => {
    let nearestTable = null;
    let minDistance = Infinity;
    for (const table of allTables) {
      const dist = Math.hypot(chair.x - table.x, chair.y - table.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestTable = table;
      }
    }
    return nearestTable;
  };

  const runAutoArranger = () => {
    const chairs = items.filter(i => i.type === 'chair');
    const tables = items.filter(i => i.type === 'round_table' || i.type === 'rect_table');

    if (tables.length === 0) {
      toast({ title: 'No tables found', description: 'Please place at least one table on the canvas first.', variant: 'destructive' });
      return;
    }

    if (chairs.length === 0) {
      toast({ title: 'No chairs found', description: 'Please make sure tables have seats spawned around them.', variant: 'destructive' });
      return;
    }

    const chairTableMap = new Map<string, any>();
    chairs.forEach(chair => {
      const tbl = getChairTable(chair, tables);
      if (tbl) chairTableMap.set(chair.id, tbl);
    });

    const emptyChairs = chairs.filter(c => !c.guestId);
    if (emptyChairs.length === 0) {
      toast({ title: 'No empty seats', description: 'All chairs on your canvas are already assigned!', variant: 'destructive' });
      return;
    }

    const assignedGuestIds = new Set(items.map(i => i.guestId).filter(Boolean));
    const unassignedGuests = guests.filter(g => !assignedGuestIds.has(g.id));

    if (unassignedGuests.length === 0) {
      toast({ title: 'All guests assigned', description: 'All of your imported guests are already placed in seats.', variant: 'success' });
      return;
    }

    const guestsByParty = new Map<string, any[]>();
    unassignedGuests.forEach(g => {
      const p = g.party_name || 'Individual';
      if (!guestsByParty.has(p)) guestsByParty.set(p, []);
      guestsByParty.get(p)!.push(g);
    });

    const emptyChairsByTable = new Map<string, any[]>();
    emptyChairs.forEach(c => {
      const tbl = chairTableMap.get(c.id);
      if (tbl) {
        if (!emptyChairsByTable.has(tbl.id)) emptyChairsByTable.set(tbl.id, []);
        emptyChairsByTable.get(tbl.id)!.push(c);
      }
    });

    const sortedParties = Array.from(guestsByParty.entries()).sort((a, b) => b[1].length - a[1].length);
    const finalAssignments = new Map<string, any>();

    if (affinityRule === 'together') {
      sortedParties.forEach(([partyName, partyGuests]) => {
        let guestsLeft = [...partyGuests];
        for (const [tableId, tblChairs] of emptyChairsByTable.entries()) {
          if (guestsLeft.length === 0) break;
          const availableSeats = tblChairs.filter(c => !finalAssignments.has(c.id));
          if (availableSeats.length > 0) {
            const toAssign = guestsLeft.slice(0, availableSeats.length);
            toAssign.forEach((guest, index) => {
              finalAssignments.set(availableSeats[index].id, guest);
            });
            guestsLeft = guestsLeft.slice(availableSeats.length);
          }
        }
      });
    } else {
      const tableIds = Array.from(emptyChairsByTable.keys());
      let tableIdx = 0;
      sortedParties.forEach(([partyName, partyGuests]) => {
        partyGuests.forEach(guest => {
          let assigned = false;
          for (let attempts = 0; attempts < tableIds.length; attempts++) {
            const currentTableId = tableIds[(tableIdx + attempts) % tableIds.length];
            const availableSeats = emptyChairsByTable.get(currentTableId)!.filter(c => !finalAssignments.has(c.id));
            if (availableSeats.length > 0) {
              finalAssignments.set(availableSeats[0].id, guest);
              tableIdx = (tableIdx + attempts + 1) % tableIds.length;
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            const remainingSeat = emptyChairs.find(c => !finalAssignments.has(c.id));
            if (remainingSeat) {
              finalAssignments.set(remainingSeat.id, guest);
            }
          }
        });
      });
    }

    const nextItems = items.map(item => {
      if (item.type === 'chair' && finalAssignments.has(item.id)) {
        const g = finalAssignments.get(item.id);
        const parts = g.full_name.split(' ');
        const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
        return {
          ...item,
          guestId: g.id,
          guestName: g.full_name,
          guestInitials: initials.toUpperCase()
        };
      }
      return item;
    });

    pushState(nextItems);
    setAutoArrangeOpen(false);
    toast({ 
      title: 'Smart Seating Completed!', 
      description: `Automatically seated ${finalAssignments.size} guests using "${affinityRule === 'together' ? 'Keep Parties Together' : 'Spread Out Groups'}" rule.`, 
      variant: 'success' 
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const unassignGuest = (chairId: string) => {
    const nextItems = items.map(item => 
      item.id === chairId ? { ...item, guestId: undefined, guestName: undefined, guestInitials: undefined } : item
    );
    pushState(nextItems);
  };

  const handleAddStickyNote = () => {
    const viewCenterX = (-pos.x + dimensions.width / 2) / scale;
    const viewCenterY = (-pos.y + dimensions.height / 2) / scale;
    
    const newNote = {
      id: `note-${Date.now()}`,
      type: 'sticky_note',
      x: viewCenterX,
      y: viewCenterY,
      text: 'Place comment here...',
      author: 'Planner',
      resolved: false,
      created_at: new Date().toISOString()
    };
    
    pushState([...items, newNote]);
    setSelectedId(newNote.id);
    toast({ title: 'Sticky Note Dropped!', description: 'Drag the yellow pin anywhere and type your comment in the properties panel.', variant: 'success' });
  };

  useEffect(() => {
    if (selectedId) {
      setSidebarTab('layers');
    }
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

  const CATALOG_ITEMS = [
    ...(catalogData?.items.map(c => {
       let spec = {};
       try { spec = JSON.parse(c.spec as any || '{}'); } catch {}
       return {
          label: c.name,
          type: (spec as any).type || c.kind,
          props: spec
       };
    }) || []),
    {
      label: '⚡ 120V Power Outlet',
      type: 'power_outlet',
      props: { width: 16, height: 16, color: '#f59e0b', capacity: 120 }
    },
    {
      label: '🔌 High-Voltage Source',
      type: 'high_voltage_source',
      props: { width: 20, height: 20, color: '#ef4444', capacity: 240 }
    }
  ];

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

    pushState([...items, newItem]);
  };

  const handleRestoreVersion = (version: any) => {
    if (window.confirm('Restore this layout version? Unsaved changes will be lost.')) {
      setItems(JSON.parse(version.payload).items || []);
      setViewingVersion(null);
      setHasChanges(true);
    }
  };

  const handlePreviewVersion = (version: any) => {
    setViewingVersion(version);
  };

  const exportToPNG = () => {
    if (!stageRef.current) return;
    try {
      const dataUrl = stageRef.current.toDataURL({ 
        mimeType: 'image/png', 
        pixelRatio: 2 
      });
      const link = document.createElement('a');
      link.download = `floorplan_${event.title.toLowerCase().replace(/\s+/g, '_')}_rev${layout?.revision || 1}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Crisp PNG floorplan exported successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'PNG Export failed', description: e.message, variant: 'destructive' });
    }
  };

  const exportToSVG = () => {
    try {
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="100%" height="100%">`;
      svgContent += `<rect width="100%" height="100%" fill="#FDFBF7" />`;
      
      items.forEach(item => {
        if (item.type === 'round_table') {
          svgContent += `<circle cx="${item.x}" cy="${item.y}" r="${item.radius}" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2" />`;
          svgContent += `<text x="${item.x}" y="${item.y + 4}" font-family="serif" font-size="10" text-anchor="middle" fill="#374151">${item.label || ''}</text>`;
        } else if (item.type === 'rect_table' || item.type === 'dance_floor') {
          const offsetX = (item.width || 0) / 2;
          const offsetY = (item.height || 0) / 2;
          const fill = item.type === 'dance_floor' ? '#e5e7eb' : '#f3f4f6';
          const stroke = item.type === 'dance_floor' ? '#d1d5db' : '#9ca3af';
          svgContent += `<rect x="${item.x - offsetX}" y="${item.y - offsetY}" width="${item.width}" height="${item.height}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2" transform="rotate(${item.rotation || 0} ${item.x} ${item.y})" />`;
          svgContent += `<text x="${item.x}" y="${item.y + 4}" font-family="serif" font-size="10" text-anchor="middle" fill="#374151" transform="rotate(${item.rotation || 0} ${item.x} ${item.y})">${item.label || ''}</text>`;
        } else if (item.type === 'chair') {
          svgContent += `<circle cx="${item.x}" cy="${item.y}" r="${item.radius || 8}" fill="#fff" stroke="#6b7280" stroke-width="1" />`;
        } else if (item.type === 'custom_wall') {
           if (item.points && item.points.length >= 4) {
              const path = `M ${item.points[0]} ${item.points[1]} ` + item.points.slice(2).reduce((acc: string, val: number, idx: number) => {
                 return acc + (idx % 2 === 0 ? `L ${val} ` : `${val} `);
              }, '');
              svgContent += `<path d="${path}" fill="none" stroke="${item.color || '#374151'}" stroke-width="${item.strokeWidth || 5}" stroke-linecap="round" stroke-linejoin="round" />`;
           }
        }
      });
      svgContent += `</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `floorplan_${event.title.toLowerCase().replace(/\s+/g, '_')}_rev${layout?.revision || 1}.svg`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Architectural SVG vectors exported successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'SVG Export failed', description: e.message, variant: 'destructive' });
    }
  };

  const exportToPDF = () => {
    if (!stageRef.current) return;
    try {
      const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/png', pixelRatio: 2 });
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Popup blocked');
      
      const html = `
        <html>
        <head>
          <title>Floorplan Blueprint - ${event.title}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: 'Georgia', serif;
              background-color: #fcfbfa;
              color: #2c2a29;
              display: flex;
              flex-direction: column;
              height: 100vh;
              box-sizing: border-box;
            }
            .container {
              border: 2px solid #e1d5c9;
              display: flex;
              flex-direction: column;
              flex: 1;
              height: 100%;
              padding: 15px;
              box-sizing: border-box;
              background-color: #ffffff;
            }
            .canvas-image {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px dashed #e1d5c9;
              margin-bottom: 20px;
              overflow: hidden;
            }
            .canvas-image img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            .title-block {
              border: 2px solid #2c2a29;
              display: grid;
              grid-template-columns: 2fr 1fr 1fr;
              font-size: 11px;
              font-family: sans-serif;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .title-block > div {
              border-right: 1px solid #2c2a29;
              padding: 8px 12px;
            }
            .title-block > div:last-child {
              border-right: none;
            }
            .label {
              font-size: 8px;
              color: #777;
              margin-bottom: 4px;
            }
            .val {
              font-size: 13px;
              font-family: 'Georgia', serif;
              color: #2c2a29;
            }
            @media print {
              body { padding: 0; background: none; }
              .container { border: 2px solid #000; }
              .title-block { border: 2px solid #000; }
              .title-block > div { border-right: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="canvas-image">
               <img src="${dataUrl}" alt="Floorplan Blueprint" />
            </div>
            <div class="title-block">
               <div>
                  <div class="label">Project Title</div>
                  <div class="val" style="font-weight: 900;">${event.title}</div>
               </div>
               <div>
                  <div class="label">Space / Location</div>
                  <div class="val">Seven Paths Manor</div>
               </div>
               <div>
                  <div class="label">Drawing Reference</div>
                  <div class="val">REV ${layout?.revision || 1} - ${layout?.approval_status || 'Draft'}</div>
               </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
      toast({ title: 'Scale-accurate PDF Blueprint generated', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'PDF Export failed', description: e.message, variant: 'destructive' });
    }
  };

  // Node Point Boundary Clicks for Drawing Custom Walls
  const handleStageClick = (e: any) => {
    if (!drawingMode) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const clickedPt = {
      x: (stage.getPointerPosition()!.x - pos.x) / scale,
      y: (stage.getPointerPosition()!.y - pos.y) / scale
    };
    setDrawnPoints(prev => [...prev, clickedPt]);
  };

  const finalizeCustomWall = () => {
    if (drawnPoints.length < 2) {
      setDrawingMode(false);
      setDrawnPoints([]);
      return;
    }
    const newWall = {
      id: `wall-${Date.now()}`,
      type: 'custom_wall',
      points: drawnPoints.flatMap(p => [p.x, p.y]),
      label: 'Custom Wall Partition',
      color: '#374151'
    };
    pushState([...items, newWall]);
    setDrawingMode(false);
    setDrawnPoints([]);
  };

  const generateAILayout = () => {
    if (!window.confirm('This will replace your current layout with an AI generated suggestion based on your guest count. Proceed?')) {
      return;
    }

    const guestCount = event.guest_count || 100;
    const tableCapacity = 8;
    const tablesNeeded = Math.ceil(guestCount / tableCapacity);
    
    const newItems: any[] = [];
    const startX = 100;
    const startY = 100;
    const spacingX = 120;
    const spacingY = 120;
    
    let currentX = startX;
    let currentY = startY;
    let tablesPlaced = 0;
    
    newItems.push({
      id: `df-${Date.now()}`, type: 'dance_floor', x: 400, y: 300, width: 200, height: 200, label: 'Dance Floor', rotation: 0
    });
    
    newItems.push({
      id: `ht-${Date.now()}`, type: 'rect_table', x: 400, y: 100, width: 144, height: 48, label: 'Head Table', rotation: 0
    });

    const danceFloorBounds = { minX: 300, maxX: 500, minY: 200, maxY: 400 };

    while (tablesPlaced < tablesNeeded) {
      const inDanceFloor = currentX > danceFloorBounds.minX && currentX < danceFloorBounds.maxX && currentY > danceFloorBounds.minY && currentY < danceFloorBounds.maxY;
      const inHeadTable = currentY < 150 && currentX > 300 && currentX < 500;
      
      if (!inDanceFloor && !inHeadTable) {
         newItems.push({
           id: `t${tablesPlaced}-${Date.now()}`,
           type: 'round_table',
           x: currentX,
           y: currentY,
           radius: 30,
           label: `Table ${tablesPlaced + 1}`,
           rotation: 0
         });
         
         const chairRadius = 30 + 15;
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

    pushState(newItems);
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
    <div className="flex flex-col gap-4">
      {/* Undo/Redo & Snap Grid Toolbars */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-[#FDFBF7] rounded-xl border border-[#e1d5c9] gap-3 shadow-md animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo} 
            disabled={undoStack.length === 0} 
            title="Undo (⌘Z)"
            className="border-[#e1d5c9] hover:bg-brand-soft/20 text-fg-muted hover:text-fg font-semibold transition-all"
          >
            <Undo2 className="h-4 w-4 mr-1 text-brand" /> Undo {undoStack.length > 0 && <span className="text-[10px] bg-brand-soft text-brand-strong px-1.5 py-0.5 rounded-full ml-1 font-bold">{undoStack.length}</span>}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRedo} 
            disabled={redoStack.length === 0} 
            title="Redo (⌘Y)"
            className="border-[#e1d5c9] hover:bg-brand-soft/20 text-fg-muted hover:text-fg font-semibold transition-all"
          >
            <Redo2 className="h-4 w-4 mr-1 text-brand" /> Redo {redoStack.length > 0 && <span className="text-[10px] bg-brand-soft text-brand-strong px-1.5 py-0.5 rounded-full ml-1 font-bold">{redoStack.length}</span>}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#FDFBF7] px-3.5 py-2 rounded-xl border border-[#e1d5c9] text-xs font-semibold shadow-xs">
            <Grid className="h-4 w-4 text-brand" />
            <span className="text-fg-subtle">Grid Snapping (20px)</span>
            <input
              type="checkbox"
              aria-label="Grid Snapping (20px)"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 ml-1 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#FDFBF7] px-3.5 py-2 rounded-xl border border-[#e1d5c9] text-xs font-semibold shadow-xs">
            <GripVertical className="h-4 w-4 text-brand" />
            <span className="text-fg-subtle">Spacing Safety Rings</span>
            <input
              type="checkbox"
              aria-label="Spacing Safety Rings"
              checked={showClearanceRings}
              onChange={(e) => setShowClearanceRings(e.target.checked)}
              className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 ml-1 cursor-pointer"
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

      <div className="flex w-full h-[600px] border border-[#e1d5c9] rounded-lg bg-surface overflow-hidden shadow-md">
        {/* Sidebar Catalog / Guests */}
        <div className="w-64 border-r border-[#e1d5c9] bg-[#FDFBF7] flex flex-col overflow-hidden">
          <div className="flex flex-col border-b border-[#e1d5c9] bg-[#FDFBF7] px-1">
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
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#FDFBF7]">
            {sidebarTab === 'catalog' && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleAddStickyNote}
                  className="p-2.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-xl text-xs text-left text-[#92400e] transition-all duration-150 flex items-center justify-between font-bold shadow-xs"
                >
                  <span className="flex items-center gap-1.5">📌 Drop Sticky Note Pin</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase bg-amber-100 border-amber-200">New</Badge>
                </button>
                {CATALOG_ITEMS.map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleAddItem(c)}
                    className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-all duration-150 flex items-center gap-2 font-medium"
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
                    className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center gap-2 font-medium"
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
                 
                 <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto">
                   {[...items].reverse().map((item, reverseIdx) => {
                     const actualIdx = items.length - 1 - reverseIdx;
                     const isSelected = selectedId === item.id;
                     
                     return (
                       <div key={item.id} className={cn("flex items-center gap-2 p-2 rounded text-xs border", isSelected ? "bg-brand-soft border-brand text-brand-strong" : "bg-surface border-border")}>
                          <button className="text-fg-subtle hover:text-fg cursor-grab active:cursor-grabbing"><GripVertical className="w-3 h-3" /></button>
                          <span className="truncate flex-1 font-semibold cursor-pointer" onClick={() => setSelectedId(item.id)}>{item.label || item.type}</span>
                          
                          <div className="flex flex-col gap-1 items-end">
                             <button onClick={() => {
                               if (actualIdx === items.length - 1) return;
                               const newItems = [...items];
                               [newItems[actualIdx], newItems[actualIdx+1]] = [newItems[actualIdx+1], newItems[actualIdx]];
                               pushState(newItems);
                             }} className="p-0.5 hover:bg-black/10 rounded">▲</button>
                             <button onClick={() => {
                               if (actualIdx === 0) return;
                               const newItems = [...items];
                               [newItems[actualIdx], newItems[actualIdx-1]] = [newItems[actualIdx-1], newItems[actualIdx]];
                               pushState(newItems);
                             }} className="p-0.5 hover:bg-black/10 rounded">▼</button>
                          </div>
                       </div>
                     );
                   })}
                 </div>
                 
                 {selectedId && (() => {
                   const activeItem = items.find(i => i.id === selectedId);
                   if (!activeItem) return null;
                   
                   if (activeItem.type === 'sticky_note') {
                     const isResolved = activeItem.resolved === true;
                     return (
                       <div className="mt-4 pt-4 border-t border-border space-y-3 bg-[#FDFBF7] p-4 rounded-xl border border-[#e1d5c9] text-xs font-semibold">
                          <div className="text-xs font-bold text-fg-muted uppercase tracking-wider font-serif text-brand flex items-center gap-1.5">
                             📌 Sticky Note Comment
                          </div>
                          <p className="text-[10px] text-fg-subtle">Enter your feedback or note to coordinate with your planner in real-time.</p>
                          
                          <div>
                            <label className="text-fg-subtle block mb-1">Author / Signer</label>
                            <input 
                              type="text" 
                              className="w-full bg-surface border border-[#e1d5c9] rounded px-2.5 py-1.5 font-semibold"
                              value={activeItem.author || ''}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, author: e.target.value} : i));
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Note Comment Text</label>
                            <textarea
                              className="w-full bg-surface border border-[#e1d5c9] rounded px-2.5 py-1.5 min-h-[70px] text-xs font-semibold"
                              value={activeItem.text || ''}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, text: e.target.value} : i));
                              }}
                            />
                          </div>

                          <div className="flex gap-2 pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="xs" 
                              className={cn("flex-1 text-[10px] font-bold h-7", isResolved ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200")}
                              onClick={() => {
                                pushState(items.map(i => i.id === selectedId ? {...i, resolved: !isResolved} : i));
                              }}
                            >
                               {isResolved ? 'Reopen Note' : 'Resolve Note'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="text-[10px] font-bold h-7 text-danger hover:bg-danger/10" 
                              onClick={() => {
                                pushState(items.filter(i => i.id !== selectedId));
                                setSelectedId(null);
                              }}
                            >
                               Delete
                            </Button>
                          </div>
                       </div>
                     );
                   }
                   
                   if (activeItem.type === 'custom_wall') {
                     return (
                       <div className="mt-4 pt-4 border-t border-border space-y-3 bg-[#FDFBF7] p-4 rounded-xl border border-[#e1d5c9] text-xs font-semibold">
                          <div className="text-xs font-bold text-fg-muted uppercase tracking-wider font-serif">Drawn Wall Properties</div>
                          
                          <div>
                            <label className="text-fg-subtle block mb-1">Wall Thickness (pixels)</label>
                            <input 
                              type="range" 
                              min="2" 
                              max="24"
                              className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand mt-1"
                              value={activeItem.strokeWidth || 5}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, strokeWidth: parseInt(e.target.value)} : i));
                              }}
                            />
                            <div className="text-right text-[10px] text-fg-subtle mt-0.5">{activeItem.strokeWidth || 5}px thickness</div>
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Height Bound (ft)</label>
                            <select 
                              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs mt-1"
                              value={activeItem.heightBound || '8'}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, heightBound: e.target.value} : i));
                              }}
                            >
                              <option value="6">6 ft Partition Panel</option>
                              <option value="8">8 ft Standard Drywall</option>
                              <option value="10">10 ft High Ceiling Altar</option>
                              <option value="12">12 ft Grand Cathedral Partition</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Wall Texture Style</label>
                            <select 
                              className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs mt-1"
                              value={activeItem.texture || 'drywall'}
                              onChange={(e) => {
                                pushState(items.map(i => i.id === selectedId ? {...i, texture: e.target.value} : i));
                              }}
                            >
                              <option value="drywall">🧱 Standard Drywall</option>
                              <option value="wood">🪵 Rustic Wood Panel</option>
                              <option value="brick">🧱 Rustic Brick finish</option>
                              <option value="concrete">🪨 Solid Raw Concrete</option>
                              <option value="plaster">✨ Smooth Plaster finish</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-fg-subtle block mb-1">Paint / Stroke Hex Color</label>
                            <div className="flex gap-2 items-center mt-1">
                              <input 
                                type="color" 
                                className="h-8 w-10 border rounded cursor-pointer shrink-0"
                                value={activeItem.color || '#374151'}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                }}
                              />
                              <input 
                                type="text"
                                className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1 h-8"
                                value={activeItem.color || '#374151'}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                }}
                              />
                            </div>
                          </div>

                          <Button variant="outline" size="sm" className="w-full mt-3 text-danger hover:bg-danger/10 border-danger/20 font-bold" onClick={() => {
                             pushState(items.filter(i => i.id !== selectedId));
                             setSelectedId(null);
                          }}>Delete Wall</Button>
                       </div>
                     );
                   }
                   
                   return (
                     <div className="mt-4 pt-4 border-t border-[#e1d5c9] space-y-3 bg-[#FDFBF7] p-4 rounded-xl border border-[#e1d5c9] text-xs font-semibold">
                        <div className="text-xs font-bold text-fg-muted uppercase tracking-wider font-serif">Transform Properties</div>
                        
                        {/* Dynamic Custom Property Editors based on Type */}
                        <div className="space-y-2 pb-3 border-b border-border/40">
                           <div>
                              <label className="text-fg-subtle block mb-1">Item Label / Name</label>
                              <input 
                                type="text" 
                                className="w-full bg-surface border border-[#e1d5c9] rounded px-2.5 py-1.5"
                                value={activeItem.label || ''}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, label: e.target.value} : i));
                                }}
                              />
                           </div>

                           {(activeItem.type === 'round_table' || activeItem.type === 'rect_table') && (
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                 <div>
                                    <label className="text-fg-subtle block mb-1">Seating Capacity</label>
                                    <input 
                                      type="number" 
                                      className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1"
                                      value={activeItem.capacity || 8}
                                      onChange={(e) => {
                                        pushState(items.map(i => i.id === selectedId ? {...i, capacity: parseInt(e.target.value)} : i));
                                      }}
                                    />
                                 </div>
                                 {activeItem.type === 'round_table' ? (
                                    <div>
                                       <label className="text-fg-subtle block mb-1">Diameter (px)</label>
                                       <input 
                                         type="number" 
                                         className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1"
                                         value={activeItem.radius ? activeItem.radius * 2 : 60}
                                         onChange={(e) => {
                                           pushState(items.map(i => i.id === selectedId ? {...i, radius: parseFloat(e.target.value) / 2} : i));
                                         }}
                                       />
                                    </div>
                                 ) : (
                                    <div>
                                       <label className="text-fg-subtle block mb-1">Width (px)</label>
                                       <input 
                                         type="number" 
                                         className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1"
                                         value={activeItem.width || 120}
                                         onChange={(e) => {
                                           pushState(items.map(i => i.id === selectedId ? {...i, width: parseFloat(e.target.value)} : i));
                                         }}
                                       />
                                    </div>
                                 )}
                              </div>
                           )}

                           {activeItem.type === 'chair' && (
                              <div className="mt-1">
                                 <label className="text-fg-subtle block mb-1">Assign Guest Directly</label>
                                 <select
                                   className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1.5 text-xs mt-1"
                                   value={activeItem.guestId || ''}
                                   onChange={(e) => {
                                      const selectedGuestId = e.target.value;
                                      if (!selectedGuestId) {
                                         pushState(items.map(i => i.id === selectedId ? { ...i, guestId: null, guestName: null, guestInitials: null } : i));
                                      } else {
                                         const g = guests.find(guest => guest.id === selectedGuestId);
                                         if (g) {
                                            const parts = g.full_name.split(' ');
                                            const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
                                            pushState(items.map(i => i.id === selectedId ? { 
                                               ...i, 
                                               guestId: g.id, 
                                               guestName: g.full_name, 
                                               guestInitials: initials.toUpperCase() 
                                            } : i));
                                         }
                                      }
                                   }}
                                 >
                                    <option value="">-- No Guest Assigned --</option>
                                    {guests.map(g => (
                                       <option key={g.id} value={g.id}>{g.full_name}</option>
                                    ))}
                                 </select>
                              </div>
                           )}

                           {activeItem.type === 'decor' && (
                              <div className="mt-1">
                                 <label className="text-fg-subtle block mb-1">Decor Display Color</label>
                                 <div className="flex gap-2 items-center mt-1">
                                   <input 
                                     type="color" 
                                     className="h-8 w-10 border rounded cursor-pointer shrink-0"
                                     value={activeItem.color || '#D4AF37'}
                                     onChange={(e) => {
                                       pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                     }}
                                   />
                                   <input 
                                     type="text"
                                     className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1 h-8"
                                     value={activeItem.color || '#D4AF37'}
                                     onChange={(e) => {
                                       pushState(items.map(i => i.id === selectedId ? {...i, color: e.target.value} : i));
                                     }}
                                   />
                                 </div>
                              </div>
                           )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <div>
                              <label className="text-fg-subtle block mb-1">X Coordinate</label>
                              <input 
                                type="number" 
                                className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1"
                                value={Math.round(activeItem.x || 0)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: parseFloat(e.target.value)} : i));
                                }}
                              />
                           </div>
                           <div>
                              <label className="text-fg-subtle block mb-1">Y Coordinate</label>
                              <input 
                                type="number" 
                                className="w-full bg-surface border border-border rounded px-2 py-1"
                                value={Math.round(activeItem.y || 0)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, y: parseFloat(e.target.value)} : i));
                                }}
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <div>
                              <label className="text-fg-subtle block mb-1">Rotation (deg)</label>
                              <input 
                                type="number" 
                                className="w-full bg-surface border border-border rounded px-2 py-1"
                                value={Math.round(activeItem.rotation || 0)}
                                onChange={(e) => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, rotation: parseFloat(e.target.value)} : i));
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
                                  pushState(items.map(i => i.id === selectedId ? {...i, opacity: parseFloat(e.target.value)/100} : i));
                                }}
                              />
                           </div>
                        </div>
                        
                        <div className="pt-2 border-t border-border space-y-2 text-xs">
                           <div className="text-fg-subtle block font-bold mb-1">Alignment &amp; Position Nudges</div>
                           <div className="grid grid-cols-2 gap-2">
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="text-[10px] h-7 font-bold"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: Math.round((i.x || 0) / 20) * 20, y: Math.round((i.y || 0) / 20) * 20} : i));
                                }}
                              >
                                📐 Snap to Grid (20px)
                              </Button>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="text-[10px] h-7 font-bold"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, rotation: 0} : i));
                                }}
                              >
                                🔄 Reset Rotation
                              </Button>
                           </div>
                           <div className="flex gap-1.5 items-center justify-center pt-1">
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="h-7 w-12 font-black text-sm"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: (i.x || 0) - 5} : i));
                                }}
                              >
                                ←
                              </Button>
                              <div className="flex flex-col gap-1">
                                 <Button 
                                   variant="outline" 
                                   size="xs" 
                                   className="h-7 w-12 font-black text-sm"
                                   onClick={() => {
                                     pushState(items.map(i => i.id === selectedId ? {...i, y: (i.y || 0) - 5} : i));
                                   }}
                                 >
                                   ↑
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="xs" 
                                   className="h-7 w-12 font-black text-sm"
                                   onClick={() => {
                                     pushState(items.map(i => i.id === selectedId ? {...i, y: (i.y || 0) + 5} : i));
                                   }}
                                 >
                                   ↓
                                 </Button>
                              </div>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="h-7 w-12 font-black text-sm"
                                onClick={() => {
                                  pushState(items.map(i => i.id === selectedId ? {...i, x: (i.x || 0) + 5} : i));
                                }}
                              >
                                →
                              </Button>
                           </div>
                           <div className="text-center text-[9px] text-fg-subtle">Nudges selected item by 5px intervals</div>
                        </div>

                        <Button variant="outline" size="sm" className="w-full mt-2 text-danger hover:bg-danger/10 border-danger/20 font-bold" onClick={() => {
                           pushState(items.filter(i => i.id !== selectedId));
                           setSelectedId(null);
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
                  <label className="flex items-center gap-2 text-xs cursor-pointer font-bold">
                    <input type="checkbox" checked={showVendorOverlay} onChange={(e) => setShowVendorOverlay(e.target.checked)} className="rounded border-border text-brand focus:ring-brand h-4 w-4 cursor-pointer" />
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
                        className="p-2 border border-border bg-surface hover:bg-surface-3 rounded text-sm text-left text-fg transition-colors flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing font-medium"
                        draggable
                        onDragStart={(e) => {
                          draggedGuestRef.current = { id: v.id, name: v.name, initials: 'V' };
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

                <div className="space-y-2 border-t pt-3 mt-2">
                  <span className="text-[10px] font-black uppercase text-brand tracking-widest block">Quick Vendor Setup Blocks</span>
                  <div className="grid grid-cols-2 gap-2 text-left">
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'Catering Staging Zone', props: { width: 120, height: 60, vendorName: 'Catering Prep' } })}
                     >
                       🔨 Catering Zone
                     </Button>
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'DJ Booth Area', props: { width: 80, height: 50, vendorName: 'DJ Booth' } })}
                     >
                       🎵 DJ Booth
                     </Button>
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'Floristry Setup Spot', props: { width: 100, height: 50, vendorName: 'Floral Setup' } })}
                     >
                       🌸 Florist Spot
                     </Button>
                     <Button 
                       type="button" 
                       variant="secondary" 
                       size="xs" 
                       className="text-[10px] font-bold h-8 flex justify-start text-fg"
                       onClick={() => handleAddItem({ type: 'vendor_zone', label: 'Bar Station Line', props: { width: 140, height: 40, vendorName: 'Main Bar' } })}
                     >
                       🍹 Bar Station
                     </Button>
                  </div>
                </div>

              </div>
            )}

            {sidebarTab === 'guests' && (() => {
              const assignedIds = new Set(items.map(i => i.guestId).filter(Boolean));
              const unassigned = guests.filter(g => 
                !assignedIds.has(g.id) && 
                g.full_name.toLowerCase().includes(guestSearch.toLowerCase())
              );
              
              return (
                <div className="flex flex-col gap-2">
                  <div className="mb-2">
                    <Input 
                      placeholder="Search guests..." 
                      value={guestSearch} 
                      onChange={(e) => setGuestSearch(e.target.value)}
                      className="text-xs h-8 border-[#e1d5c9]"
                    />
                  </div>
                  <p className="text-xs text-fg-subtle mb-1 font-bold">{unassigned.length} unassigned guests matching</p>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1">
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
                          className="p-2 border border-border bg-surface rounded text-sm text-fg cursor-grab active:cursor-grabbing flex items-center gap-2 hover:border-brand/40 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] flex items-center justify-center font-bold">
                            {initials.toUpperCase()}
                          </div>
                          <span className="truncate font-semibold">{g.full_name}</span>
                        </div>
                      );
                    })}
                    {unassigned.length === 0 && (
                      <p className="text-sm text-fg-muted text-center py-4 italic">No unassigned guests found</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Main Canvas Area */}
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
             <Button variant="outline" size="sm" className="font-bold border-[#e1d5c9] bg-white hover:bg-brand-soft/20 text-brand" onClick={() => setShowHelpGuide(!showHelpGuide)}>
               {showHelpGuide ? '📖 Hide Guide' : '📖 Help Guide'}
             </Button>
             
             {/* Multi-Format Blueprint Exporters (Phase 6) */}
             <div className="flex gap-1 items-center border border-[#e1d5c9] bg-white p-1 rounded-xl shadow-xs print:hidden">
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
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-[#FDFBF7] border border-[#e1d5c9] p-4 rounded-xl shadow-lg flex flex-col md:flex-row gap-4 items-start md:items-center justify-between animate-in slide-in-from-bottom-4 duration-200">
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
              <DialogContent className="max-w-xl bg-[#FDFBF7] border border-[#e1d5c9] rounded-2xl shadow-xl">
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
                          className="mt-1.5 w-full h-10 px-3 rounded-lg border border-[#e1d5c9] bg-white text-xs font-semibold cursor-pointer"
                       >
                          <option value="together">🟢 Keep Parties &amp; Families Together (Recommended)</option>
                          <option value="spread">🟡 Spread Out Groups (Socialize &amp; Mingle)</option>
                       </select>
                    </div>

                    {/* Summary of Unassigned Guests & Groups */}
                    <div className="bg-white p-4 rounded-xl border border-[#e1d5c9] space-y-2.5">
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
                                      <Badge key={name} variant="outline" className="bg-[#FDFBF7] text-fg-subtle border-[#e1d5c9] text-[9px] py-0.5 px-2">
                                         {name}: {count}
                                      </Badge>
                                   ))}
                                </div>
                             </div>
                          );
                       })()}
                    </div>
                 </div>

                 <DialogFooter className="border-t border-[#e1d5c9] pt-4 mt-2">
                    <Button variant="ghost" onClick={() => setAutoArrangeOpen(false)}>Cancel</Button>
                    <Button onClick={runAutoArranger} className="bg-brand text-brand-fg font-bold">
                       ⚡ Run AI Seating
                    </Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>
        )}
        </div>
      </div>
    </div>
  );
}
