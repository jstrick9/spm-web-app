import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Arc } from 'react-konva';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutsSdk, layoutInventorySdk } from '../../../sdk/layouts';
import { guestsSdk } from '../../../sdk/guests';
import { sdk } from '../../../sdk';
import { cn } from '../../../ui/lib/cn';
import type { SdkEvent, SdkLayout } from '../../../sdk/types';
import {
  Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight,
  X, Sparkles, Layers, Flower2, GripVertical, Plus, Truck, MapPin, Sliders,
  PenTool, Undo2, Redo2, Grid, Activity, FileText, Keyboard, Printer, Eye, Umbrella, Smartphone, Maximize2, QrCode, Camera, ShieldCheck, ClipboardCheck, Accessibility, Zap
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

import { DEFAULT_ITEMS, FLOOR_WALK_CHECKS, DEFAULT_MANAGER_LAYOUT_OPS, centerDistance, itemLabel, managerLayoutOpsFromBackend, type FloorWalkCheckId, type ManagerLayoutOpsState } from './layoutOpsModel';
import { LAYOUT_OBJECT_PALETTE, LAYOUT_PALETTE_CATEGORIES, type LayoutPaletteCategory } from './layoutObjectPalette';
import { generateWeddingPackage, WEDDING_LAYOUT_PACKAGES, type WeddingLayoutPackage } from './weddingLayoutPackages';
import { createIndependentSetupGroup } from './setupGroups';

export function CanvasPage({ event }: Props) {
  const { toast } = useToast();
  const canApproveLayout = usePermission('layouts.publish');
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
  const [mobileViewport, setMobileViewport] = useState(false);
  const [forceCanvasOnMobile, setForceCanvasOnMobile] = useState(false);
  const trRef = useRef<any>(null);
  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'guests' | 'decor' | 'layers' | 'history' | 'vendors'>('catalog');
  const [paletteCategory, setPaletteCategory] = useState<LayoutPaletteCategory>('tables');
  const [packageGuests, setPackageGuests] = useState(Math.max(1, event.guest_count || 100));
  const [showProtectedLayers, setShowProtectedLayers] = useState(true);
  const [showCommentPins, setShowCommentPins] = useState(false);
  const [sharedReviewExpanded, setSharedReviewExpanded] = useState(false);
  const [serviceStyle, setServiceStyle] = useState('reception');
  const [setupGroupOpen, setSetupGroupOpen] = useState(false); const [reservationConflict, setReservationConflict] = useState(''); const [reservationOverrideReason, setReservationOverrideReason] = useState(''); const [setupGroupName, setSetupGroupName] = useState('Table setup'); const [setupGroupArrangement, setSetupGroupArrangement] = useState<'grid'|'row'|'arc'>('grid'); const [setupGroupQuantity, setSetupGroupQuantity] = useState(10); const [setupGroupChairs, setSetupGroupChairs] = useState(8); const [setupTableId, setSetupTableId] = useState(''); const [setupChairId, setSetupChairId] = useState(''); const [setupDecorId, setSetupDecorId] = useState('');
  const [showVendorOverlay, setShowVendorOverlay] = useState(false);
  const [vendorLines, setVendorLines] = useState<any[]>([]);
  const [viewingVersion, setViewingVersion] = useState<any>(null);
  const [vendorSpecificView, setVendorSpecificView] = useState(false);
  const [rainPlanCompare, setRainPlanCompare] = useState(false);
  const [managerLayoutOps, setManagerLayoutOps] = useState<ManagerLayoutOpsState>(DEFAULT_MANAGER_LAYOUT_OPS);
  const [setupPacketUrl, setSetupPacketUrl] = useState<string>('');
  const variancePhotoInputRef = useRef<HTMLInputElement>(null);
  
  const { data: versionsData } = useQuery({
    queryKey: ['layouts', layout?.id, 'versions'],
    queryFn: () => layoutsSdk.listVersions(layout!.id),
    enabled: !!layout?.id,
  });
  const versions = (versionsData as any)?.versions || [];

  const { data: layoutOpsData } = useQuery({
    queryKey: ['layout-ops', layout?.id],
    queryFn: () => layoutsSdk.ops(layout!.id),
    enabled: !!layout?.id,
  });

  const { data: inventoryData } = useQuery({ queryKey: ['inventory', event.organization_id], queryFn: () => sdk.inventory.list(event.organization_id) });
  const { data: reservationsData } = useQuery({ queryKey: ['layout-inventory-reservations', layout?.id], queryFn: () => layoutInventorySdk.list(layout!.id), enabled: !!layout?.id });
  const { data: sharedInventoryReview } = useQuery({ queryKey: ['layout-inventory-shared-review', layout?.id], queryFn: () => layoutInventorySdk.sharedReview(layout!.id), enabled: !!layout?.id && canApproveLayout, retry: false });
  const { data: layoutCollaboration } = useQuery({ queryKey: ['layout-collaboration', layout?.id], queryFn: () => layoutsSdk.collaboration(layout!.id), enabled: !!layout?.id });
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', event.id],
    queryFn: () => vendorsSdk.list(event.organization_id, { eventId: event.id }),
  });
  const vendors = vendorsData?.vendors || [];
  const selectedSetupTable = useMemo(() => (inventoryData?.items || []).find((item: any) => item.id === setupTableId), [inventoryData?.items, setupTableId]);
  const selectedSetupCapacity = useMemo(() => {
    try {
      const capacities = JSON.parse(selectedSetupTable?.spec || '{}').seatingCapacities || {};
      const key = serviceStyle === 'plated' ? 'plated' : serviceStyle === 'family_style' ? 'family_style' : serviceStyle === 'cocktail' ? 'cocktail' : undefined;
      return key ? Number(capacities[key] || 0) : 0;
    } catch { return 0; }
  }, [selectedSetupTable?.spec, serviceStyle]);

  const draggedGuestRef = useRef<{ id: string; name: string; initials: string } | null>(null);

  useEffect(() => {
    const update = () => setMobileViewport(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Initialize state once layout loads
  useEffect(() => {
    if (data) {
      if (layout && layout.payload && Array.isArray((layout.payload as any).items)) {
        setItems((layout.payload as any).items);
        setVendorLines((layout.payload as any).vendorLines || []);
        setManagerLayoutOps({ ...DEFAULT_MANAGER_LAYOUT_OPS, ...((layout.payload as any).managerLayoutOps || {}) });
        setServiceStyle((layout.payload as any).serviceStyle || 'reception');
      } else {
        setItems(DEFAULT_ITEMS);
        setManagerLayoutOps(DEFAULT_MANAGER_LAYOUT_OPS);
      }
      setHasChanges(false);
    }
  }, [data, layout]);

  useEffect(() => {
    if (layoutOpsData?.ops) {
      setManagerLayoutOps(managerLayoutOpsFromBackend(layoutOpsData.ops));
      const packet = layoutOpsData.ops.setupPackets?.find((p: any) => p.audience === 'setup_crew') || layoutOpsData.ops.setupPackets?.[0];
      if (packet?.token) setSetupPacketUrl(`/api/public/layout-packets/${packet.token}`);
    }
  }, [layoutOpsData?.ops]);

  // Push to Undo Stack Helper
  const pushState = (nextItems: any[]) => {
    setUndoStack(prev => [...prev, items]);
    setRedoStack([]); // Clear redo
    setItems(nextItems);
    setHasChanges(true);
  };

  const reconcileMappedInventory = (nextItems: any[]) => {
    if (!layout) return;
    const totals = new Map<string, number>();
    nextItems.forEach((item) => { if (item.inventoryItemId) totals.set(item.inventoryItemId, (totals.get(item.inventoryItemId) || 0) + 1); });
    void layoutInventorySdk.reserve(layout.id, [...totals].map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity })))
      .then(() => { qc.invalidateQueries({ queryKey: ['inventory', event.organization_id] }); qc.invalidateQueries({ queryKey: ['layout-inventory-reservations', layout.id] }); })
      .catch((e: any) => toast({ title: 'Inventory update needs review', description: e.message, variant: 'destructive' }));
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
      payload: { items: payload, vendorLines, managerLayoutOps, serviceStyle }
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layouts', event.id] });
      setHasChanges(false);
    }
  });

  const saveLayout = useMutation({
    mutationFn: (payload: any) => layoutsSdk.save(layout!.id, { items: payload.items || payload, vendorLines: payload.vendorLines || vendorLines, managerLayoutOps: payload.managerLayoutOps || managerLayoutOps, serviceStyle: payload.serviceStyle || serviceStyle }, { approvalStatus: payload.approvalStatus }),
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

  const persistManagerLayoutOps = (next: ManagerLayoutOpsState, description: string) => {
    setManagerLayoutOps(next);
    if (layout) {
      layoutsSdk.save(layout.id, { items, vendorLines, managerLayoutOps: next }, { approvalStatus: layout.approval_status, changeDescription: description })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['layouts', event.id] });
          toast({ title: 'Layout verification saved', description, variant: 'success' });
        })
        .catch((e: any) => toast({ title: 'Could not save layout verification', description: e.message, variant: 'destructive' }));
    } else {
      toast({ title: 'Verification staged locally', description: 'Save the layout to persist this verification record.', variant: 'success' });
    }
  };

  const toggleFloorWalkCheck = async (id: FloorWalkCheckId) => {
    const current = managerLayoutOps.floorWalkChecks || {};
    const checked = !current[id];
    const next = {
      ...managerLayoutOps,
      floorWalkChecks: { ...current, [id]: checked },
      floorWalkCompletedAt: Object.values({ ...current, [id]: checked }).every(Boolean) ? new Date().toISOString() : managerLayoutOps.floorWalkCompletedAt,
    };
    setManagerLayoutOps(next);
    if (!layout) return persistManagerLayoutOps(next, `Floor walk check updated: ${id}`);
    try {
      await layoutsSdk.setFloorWalkCheck(layout.id, { checkId: id, status: checked ? 'verified' : 'pending' });
      qc.invalidateQueries({ queryKey: ['layout-ops', layout.id] });
      toast({ title: 'Floor walk check saved', description: `${id} ${checked ? 'verified' : 'reopened'}.`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Could not save floor walk check', description: e.message, variant: 'destructive' });
    }
  };

  const recordVarianceEvidence = () => {
    variancePhotoInputRef.current?.click();
  };

  const handleVariancePhotoSelected = async (eventChange: React.ChangeEvent<HTMLInputElement>) => {
    const file = eventChange.target.files?.[0];
    eventChange.target.value = '';
    if (!file) return;
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const note = `Photo evidence uploaded: ${file.name}`;
    const nextEvidence = [
      ...(managerLayoutOps.varianceEvidence || []),
      { id: `variance-${Date.now()}`, at: new Date().toISOString(), note, status: 'open' as const },
    ];
    setManagerLayoutOps({ ...managerLayoutOps, varianceEvidence: nextEvidence });
    if (!layout) return persistManagerLayoutOps({ ...managerLayoutOps, varianceEvidence: nextEvidence }, 'Layout variance/photo evidence recorded');
    try {
      await layoutsSdk.addVarianceEvidence(layout.id, { note, photoDataUri: dataUri });
      qc.invalidateQueries({ queryKey: ['layout-ops', layout.id] });
      toast({ title: 'Variance photo uploaded', description: 'Photo evidence was stored securely and attached to this layout.', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Could not upload variance photo', description: e.message, variant: 'destructive' });
    }
  };

  const setRainPlanActive = async (active: boolean) => {
    const next = { ...managerLayoutOps, rainPlanActive: active, rainPlanActivatedAt: active ? new Date().toISOString() : managerLayoutOps.rainPlanActivatedAt };
    setManagerLayoutOps(next);
    if (!layout) return persistManagerLayoutOps(next, active ? 'Rain plan activated for layout operations' : 'Rain plan deactivated for layout operations');
    try {
      await layoutsSdk.setRainPlan(layout.id, { active, note: active ? 'Manager activated rain plan from floor walk workflow.' : 'Manager deactivated rain plan from floor walk workflow.' });
      qc.invalidateQueries({ queryKey: ['layout-ops', layout.id] });
      toast({ title: active ? 'Rain plan activated' : 'Rain plan deactivated', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Could not update rain plan', description: e.message, variant: 'destructive' });
    }
  };

  const createSignedSetupPacket = async () => {
    if (!layout) return;
    try {
      const res = await layoutsSdk.createSetupPacket(layout.id, {
        audience: 'setup_crew',
        payload: { eventId: event.id, layoutId: layout.id, revision: layout.revision, seats: layoutDiagnostics.seats, tables: layoutDiagnostics.tables, vendorZones: layoutDiagnostics.vendorZones },
      });
      setSetupPacketUrl(res.publicUrl);
      qc.invalidateQueries({ queryKey: ['layout-ops', layout.id] });
      toast({ title: 'Signed setup packet created', description: 'The QR packet now deep-links to a signed read-only setup packet.', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Could not create setup packet', description: e.message, variant: 'destructive' });
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
    if (layout?.approval_status === 'approved' && !canApproveLayout) { toast({ title: 'Approved layout is locked', description: 'Ask the venue to reopen a new proposal revision for changes.', variant: 'destructive' }); return; }
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
    if (newItem.type === 'vendor_zone') setShowVendorOverlay(true);
    setSelectedId(newItem.id);
  };

  const addWeddingPackage = (kind: WeddingLayoutPackage) => {
    if (layout?.approval_status === 'approved' && !canApproveLayout) { toast({ title: 'Approved layout is locked', description: 'Ask the venue to reopen a new proposal revision for changes.', variant: 'destructive' }); return; }
    const proposalObjects = generateWeddingPackage(kind, packageGuests, items.length, serviceStyle);
    pushState([...items, ...proposalObjects]);
    if (proposalObjects.some((item) => item.type === 'vendor_zone')) setShowVendorOverlay(true);
    setSelectedId(proposalObjects[0]?.id || null);
    toast({ title: `${WEDDING_LAYOUT_PACKAGES.find((item) => item.id === kind)?.label} added`, description: `${proposalObjects.length} editable proposal objects were added for ${packageGuests} guests. Review and save before requesting venue approval.`, variant: 'success' });
  };

  const addSetupGroup = async () => {
    const inventory = inventoryData?.items || [];
    const tableItem = inventory.find((item: any) => item.id === setupTableId); const chairItem = inventory.find((item: any) => item.id === setupChairId); const decorItem = inventory.find((item: any) => item.id === setupDecorId);
    if (!tableItem) { toast({ title: 'Choose a venue table', description: 'Create a table inventory item, then choose it for this setup group.', variant: 'destructive' }); return; }
    let spec: any = {}; try { spec = JSON.parse(tableItem.spec || '{}'); } catch {}
    const result = createIndependentSetupGroup({ label: setupGroupName || tableItem.name, quantity: setupGroupQuantity, arrangement: setupGroupArrangement, table: { inventoryItemId: tableItem.id, label: tableItem.name, width: Number(spec.widthFeet || 6), depth: Number(spec.depthFeet || spec.widthFeet || 6), shape: Number(spec.widthFeet || 6) === Number(spec.depthFeet || spec.widthFeet || 6) ? 'round' : 'rect' }, ...(chairItem ? { chair: { inventoryItemId: chairItem.id, label: chairItem.name, count: setupGroupChairs } } : {}), ...(decorItem ? { centerpiece: { inventoryItemId: decorItem.id, label: decorItem.name } } : {}) });
    const nextItems = [...items, ...result.items];
    try {
      if (layout) {
        const existing = reservationsData?.reservations || []; const totals = new Map(existing.map((item: any) => [item.inventory_item_id, item.quantity]));
        result.reservations.forEach((item) => totals.set(item.inventoryItemId, (totals.get(item.inventoryItemId) || 0) + item.quantity));
        await layoutInventorySdk.reserve(layout.id, [...totals].map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity })), reservationOverrideReason || undefined);
      } else {
        const created = await layoutsSdk.create({ organizationId: event.organization_id, eventId: event.id, name: 'Primary Layout', payload: { items: nextItems, vendorLines, managerLayoutOps } });
        await layoutInventorySdk.reserve(created.layout.id, result.reservations, reservationOverrideReason || undefined);
      }
      pushState(nextItems); setSetupGroupOpen(false); setReservationConflict(''); setReservationOverrideReason(''); qc.invalidateQueries({ queryKey: ['inventory', event.organization_id] }); qc.invalidateQueries({ queryKey: ['layout-inventory-reservations'] }); qc.invalidateQueries({ queryKey: ['layouts', event.id] });
      toast({ title: 'Independent setup group added', description: `${setupGroupQuantity} table setups and their inventory were reserved for this event.`, variant: 'success' });
    } catch (e: any) { setReservationConflict(e.message || 'Inventory reservation conflict'); toast({ title: 'Inventory reservation needs review', description: e.message, variant: 'destructive' }); }
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
                  <div class="val">${event.title || 'Event Venue'}</div>
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

  const nudgeItem = (id: string, dx: number, dy: number) => {
    pushState(items.map(item => item.id === id ? { ...item, x: Number(item.x || 0) + dx, y: Number(item.y || 0) + dy } : item));
    setSelectedId(id);
  };

  const layoutDiagnostics = useMemo(() => {
    const seats = items.filter(i => i.type === 'chair' || i.type === 'seat');
    const assignedSeats = seats.filter(s => s.guestId).length;
    const tables = items.filter(i => ['round_table','rect_table','table'].includes(i.type));
    const exits = items.filter(i => ['fire_exit','exit'].includes(i.type) || /exit/i.test(itemLabel(i)));
    const adaPaths = items.filter(i => ['ada_path','walkway','aisle'].includes(i.type) || /ada|access/i.test(itemLabel(i)));
    const vendorZones = items.filter(i => i.type === 'vendor_zone');
    const outlets = items.filter(i => ['power_outlet','high_voltage_source'].includes(i.type));
    const warnings: string[] = [];
    if (event.guest_count && seats.length < event.guest_count) warnings.push(`Seat shortage: ${event.guest_count} expected guests but only ${seats.length} seats.`);
    if (duplicateGuestIds.size > 0) warnings.push(`${duplicateGuestIds.size} duplicate guest seating assignment(s).`);
    if (layout && layout.approval_status !== 'approved') warnings.push('Layout approval warning: this layout is not approved yet.');
    if (!adaPaths.length) warnings.push('ADA/accessibility path is not marked.');
    if (!exits.length) warnings.push('Fire exits are not marked.');
    const serviceZones = items.filter(i => i.type === 'dance_floor' || (i.type === 'vendor_zone' && /catering|bar|service|prep/i.test(itemLabel(i))));
    const serviceConflicts = serviceZones.filter(zone => items.some(other => other.id !== zone.id && !['chair','seat'].includes(other.type) && centerDistance(zone, other) < 64));
    if (serviceConflicts.length) warnings.push(`${serviceConflicts.length} dance floor/catering/service clearance warning(s).`);
    const poweredZones = vendorZones.filter(z => /dj|band|catering|bar|lighting|photo/i.test(itemLabel(z)));
    const noPower = poweredZones.filter(zone => !outlets.some(outlet => centerDistance(zone, outlet) <= 180));
    if (noPower.length) warnings.push(`${noPower.length} vendor zone(s) may be too far from power.`);
    if (vendorZones.length && vendorLines.length === 0 && !items.some(i => i.type === 'load_in_path')) warnings.push('Vendor load-in path is not marked.');
    const capacityPct = event.guest_count ? Math.min(100, Math.round((assignedSeats / event.guest_count) * 100)) : 0;
    const checklist = [
      { label: 'Enough seats for expected guests', done: !event.guest_count || seats.length >= event.guest_count },
      { label: 'No duplicate guest seating', done: duplicateGuestIds.size === 0 },
      { label: 'Layout approved', done: layout?.approval_status === 'approved' },
      { label: 'ADA path marked', done: adaPaths.length > 0 },
      { label: 'Fire exits marked', done: exits.length > 0 },
      { label: 'Vendor zones have load-in path', done: vendorZones.length === 0 || vendorLines.length > 0 || items.some(i => i.type === 'load_in_path') },
      { label: 'Power sources placed for vendor zones', done: noPower.length === 0 },
    ];
    return { seats: seats.length, assignedSeats, tables: tables.length, exits: exits.length, adaPaths: adaPaths.length, vendorZones: vendorZones.length, outlets: outlets.length, warnings, capacityPct, checklist };
  }, [items, event.guest_count, duplicateGuestIds, layout?.approval_status, vendorLines.length]);

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  }

  const isSaving = createLayout.isPending || saveLayout.isPending;

  if (mobileViewport && !forceCanvasOnMobile) {
    return (
      <>
      <input ref={variancePhotoInputRef} type="file" accept="image/*" className="hidden" aria-label="Upload layout variance photo evidence" onChange={handleVariancePhotoSelected} />
      <MobileLayoutReview
        event={event}
        layout={layout}
        diagnostics={layoutDiagnostics}
        items={items}
        vendors={vendors}
        managerOps={managerLayoutOps}
        onToggleFloorWalkCheck={toggleFloorWalkCheck}
        onRecordVarianceEvidence={recordVarianceEvidence}
        onSetRainPlanActive={setRainPlanActive}
        setupPacketUrl={setupPacketUrl}
        onCreateSetupPacket={createSignedSetupPacket}
        onOpenCanvas={() => setForceCanvasOnMobile(true)}
      />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={variancePhotoInputRef} type="file" accept="image/*" className="hidden" aria-label="Upload layout variance photo evidence" onChange={handleVariancePhotoSelected} />
      {layout?.id && (() => { const latest = (layoutCollaboration?.reviews || []).find((review: any) => review.decision !== 'pending'); const openComments = (layoutCollaboration?.comments || []).filter((comment: any) => comment.status === 'open').length; const locked = layout.approval_status === 'approved' && !canApproveLayout; if (!latest && !openComments && !locked) return null; return <div className={`rounded-lg border p-3 text-sm ${latest?.decision === 'approved' ? 'border-success/30 bg-success-soft/20' : latest?.decision === 'changes_requested' || openComments ? 'border-warning/30 bg-warning-soft/20' : 'border-border bg-surface-2'}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{latest?.decision === 'approved' ? 'Venue layout approved' : latest?.decision === 'changes_requested' ? 'Venue requested changes' : openComments ? `${openComments} open layout comment${openComments === 1 ? '' : 's'}` : 'Venue layout status'}</strong><p className="text-xs text-fg-muted">{locked ? 'This approved layout is locked. Ask the venue to reopen a new proposal revision for changes.' : latest?.decision_note || 'Open the review comparison to see venue feedback and revision changes.'}</p></div><span className="flex gap-2"><Button size="xs" variant="outline" onClick={() => { window.location.hash = `#/events/${event.id}?tab=layout`; }}>Open review</Button>{locked && <Button size="xs" onClick={async () => { const note = window.prompt('Describe the changes you need:'); if (!note?.trim()) return; try { await layoutsSdk.requestReopen(layout.id, note); toast({ title: 'Reopen request sent', description: 'The venue will review your requested changes.', variant: 'success' }); } catch (e: any) { toast({ title: 'Could not request reopening', description: e.message, variant: 'destructive' }); } }}>Request reopening</Button>}</span></div></div>; })()}
      {layout?.id && canApproveLayout && <div className="rounded-lg border border-border bg-surface p-3 text-sm"><div className="flex items-center justify-between"><strong>Shared inventory review</strong><span className="text-xs text-fg-muted">Manual same-day review</span></div>{sharedInventoryReview?.review.status === 'manual-review' && <>{sharedInventoryReview.review.conflicts.length ? <div className="mt-2 space-y-1">{Object.entries(sharedInventoryReview.review.conflicts.reduce((groups: Record<string, any[]>, conflict) => { (groups[conflict.event_title] ||= []).push(conflict); return groups; }, {})).map(([eventTitle, conflicts]) => <div key={eventTitle} className="rounded border border-warning/30 bg-warning-soft/20 p-2"><strong>{eventTitle}</strong><span className="ml-2 text-xs text-fg-muted">{(conflicts as any[]).length} shared item{(conflicts as any[]).length === 1 ? '' : 's'}</span>{sharedReviewExpanded && <ul className="mt-1 list-disc pl-4 text-xs text-fg-muted">{(conflicts as any[]).map((conflict) => <li key={`${conflict.inventory_name}-${conflict.event_id}`}>{conflict.inventory_name}: {conflict.other_quantity} reserved on {conflict.start_date}</li>)}</ul>}</div>)}</div> : <p className="mt-2 text-xs text-success">No other event reservations are recorded for {sharedInventoryReview.review.eventDate}.</p>}<Button variant="secondary" size="xs" className="mt-2" onClick={() => setSharedReviewExpanded((open) => !open)}>{sharedReviewExpanded ? 'Hide item details' : 'Show item details'}</Button><p className="mt-2 text-xs text-fg-muted">Same-day reservations are shown for venue manager review; they do not automatically mean the events overlap.</p></>}{sharedInventoryReview?.review.status === 'event-date-needed' && <p className="mt-2 text-xs text-warning">Add an event date to review same-day shared inventory.</p>}</div>}
      {layout?.id && <LayoutCollaborationPanel layoutId={layout.id} canApprove={canApproveLayout} target={selectedId ? (() => { const item = items.find((entry) => entry.id === selectedId); return { objectId: selectedId, label: itemLabel(item || { type: 'Object' }), x: item?.x, y: item?.y }; })() : undefined} />}
      {mobileViewport && forceCanvasOnMobile && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft/20 p-3 text-sm text-warning flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span><strong>Advanced canvas editor on mobile:</strong> use only when necessary. Review, readiness, reports, and print packet are optimized for phones.</span>
          <Button size="sm" variant="outline" onClick={() => setForceCanvasOnMobile(false)}><Smartphone className="h-4 w-4" /> Return to mobile review</Button>
        </div>
      )}
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

      <Dialog open={setupGroupOpen} onOpenChange={setSetupGroupOpen}><DialogContent><DialogHeader><DialogTitle>Create independent setup group</DialogTitle><DialogDescription>Configure one table setup, then create independent copies. Inventory reserves immediately for this event.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Setup name</Label><Input value={setupGroupName} onChange={(e) => setSetupGroupName(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Number of setups</Label><Input type="number" min="1" value={setupGroupQuantity} onChange={(e) => setSetupGroupQuantity(Math.max(1, Number(e.target.value) || 1))}/></div><div><Label>Chairs per setup</Label><Input type="number" min="0" value={setupGroupChairs} onChange={(e) => setSetupGroupChairs(Math.max(0, Number(e.target.value) || 0))}/></div></div><div><Label>Arrange copies</Label><div className="mt-1 flex gap-1">{(['grid','row','arc'] as const).map((arrangement) => <button type="button" key={arrangement} onClick={() => setSetupGroupArrangement(arrangement)} className={`rounded border px-2 py-1 text-xs ${setupGroupArrangement === arrangement ? 'border-brand bg-brand-soft text-brand' : 'border-border'}`}>{arrangement}</button>)}</div></div><div><Label>Venue table inventory</Label><select aria-label="Venue table inventory" className="mt-1 h-10 w-full rounded border border-border bg-surface px-2" value={setupTableId} onChange={(e) => setSetupTableId(e.target.value)}><option value="">Choose table…</option>{(inventoryData?.items || []).filter((item: any) => { try { return JSON.parse(item.spec || '{}').objectType === 'table'; } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div>{selectedSetupCapacity > 0 && <div className="rounded border border-brand/20 bg-brand-soft/20 p-2 text-xs"><strong>{selectedSetupTable?.name}</strong> seats up to {selectedSetupCapacity} for {serviceStyle.replace('_', ' ')} service. <button type="button" className="ml-1 font-semibold underline" onClick={() => setSetupGroupChairs(selectedSetupCapacity)}>Use {selectedSetupCapacity} chairs per setup</button> · {Math.ceil(Math.max(1, event.guest_count || packageGuests) / selectedSetupCapacity)} setup(s) suggested for {event.guest_count || packageGuests} guests.</div>}<div><Label>Venue chair inventory (optional)</Label><select aria-label="Venue chair inventory" className="mt-1 h-10 w-full rounded border border-border bg-surface px-2" value={setupChairId} onChange={(e) => setSetupChairId(e.target.value)}><option value="">No chairs</option>{(inventoryData?.items || []).filter((item: any) => { try { return JSON.parse(item.spec || '{}').objectType === 'chair'; } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div><div><Label>Centerpiece / decor inventory (optional)</Label><select aria-label="Venue decor inventory" className="mt-1 h-10 w-full rounded border border-border bg-surface px-2" value={setupDecorId} onChange={(e) => setSetupDecorId(e.target.value)}><option value="">No centerpiece</option>{(inventoryData?.items || []).filter((item: any) => { try { return JSON.parse(item.spec || '{}').objectType === 'decor'; } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div>{reservationConflict && <div className="rounded border border-warning/40 bg-warning-soft/20 p-2 text-xs"><strong>Inventory review required</strong><p className="mt-1 text-fg-muted">An authorized venue manager may proceed with a documented override after reviewing same-day inventory.</p><Label className="mt-2 block">Manager override reason</Label><Input aria-label="Manager inventory override reason" value={reservationOverrideReason} onChange={(e) => setReservationOverrideReason(e.target.value)} placeholder="Why can this reservation proceed?"/></div>}</div><DialogFooter><Button variant="secondary" onClick={() => { setSetupGroupOpen(false); setReservationConflict(''); }}>Cancel</Button><Button onClick={() => void addSetupGroup()}>{reservationConflict ? 'Proceed with override' : 'Reserve & add group'}</Button></DialogFooter></DialogContent></Dialog>
      <LayoutReadinessPanel diagnostics={layoutDiagnostics} items={items} layout={layout} event={event} hasChanges={hasChanges} selectedId={selectedId} setSelectedId={setSelectedId} nudgeItem={nudgeItem} rainPlanCompare={rainPlanCompare} setRainPlanCompare={setRainPlanCompare} vendorSpecificView={vendorSpecificView} setVendorSpecificView={setVendorSpecificView} managerOps={managerLayoutOps} onToggleFloorWalkCheck={toggleFloorWalkCheck} onRecordVarianceEvidence={recordVarianceEvidence} onSetRainPlanActive={setRainPlanActive} setupPacketUrl={setupPacketUrl} onCreateSetupPacket={createSignedSetupPacket} />

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs"><span><strong>Venue-owned structure & safety</strong> is protected from event edits.</span><span className="flex gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={showProtectedLayers} onChange={(e) => setShowProtectedLayers(e.target.checked)}/> Show protected layers</label><label className="flex items-center gap-2"><input type="checkbox" checked={showCommentPins} onChange={(e) => setShowCommentPins(e.target.checked)}/> Show comment pins</label></span></div>
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
                <div className="rounded-lg border border-brand/20 bg-brand-soft/20 p-2.5">
                  <div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-fg">Wedding setup packages</div><label className="text-[10px] text-fg-muted">Guests <input aria-label="Package guest count" className="ml-1 w-12 rounded border border-border bg-surface px-1 py-0.5" type="number" min="1" value={packageGuests} onChange={(e) => setPackageGuests(Math.max(1, Number(e.target.value) || 1))}/></label></div>
                  <p className="mt-0.5 text-[10px] leading-tight text-fg-muted">Add a complete editable starting proposal; venue structure stays protected.</p><label className="mt-2 block text-[10px] font-semibold text-fg-muted">Event service style<select aria-label="Event service style" className="mt-1 h-7 w-full rounded border border-border bg-surface px-1 text-[10px]" value={serviceStyle} onChange={(e) => { setServiceStyle(e.target.value); setHasChanges(true); }}><option value="ceremony">Ceremony</option><option value="cocktail">Cocktail</option><option value="plated">Reception · plated</option><option value="buffet_stations">Reception · buffet/stations</option><option value="family_style">Reception · family-style</option><option value="brunch">Brunch</option><option value="after_party">After-party</option></select></label>
                  <div className="mt-2 grid grid-cols-2 gap-1">{WEDDING_LAYOUT_PACKAGES.map((item) => <button key={item.id} type="button" title={item.description} onClick={() => addWeddingPackage(item.id)} className="rounded border border-brand/20 bg-surface px-1.5 py-1 text-left text-[10px] font-semibold hover:bg-brand-soft">{item.label}</button>)}</div>
                  <Button size="xs" className="mt-2 w-full" variant="secondary" onClick={() => setSetupGroupOpen(true)}>Create independent setup group</Button>
                </div>
                <div className="rounded-lg border border-brand/20 bg-brand-soft/20 p-2.5">
                  <div className="text-xs font-bold text-fg">Quick event design</div>
                  <p className="mt-0.5 text-[10px] leading-tight text-fg-muted">Choose an object, then drag it into place. Your changes remain a proposal until venue approval.</p>
                  <div className="mt-2 flex flex-wrap gap-1" aria-label="Design object categories">{LAYOUT_PALETTE_CATEGORIES.map(category => <button key={category.id} type="button" onClick={() => setPaletteCategory(category.id)} className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', paletteCategory === category.id ? 'bg-brand text-white' : 'bg-surface text-fg-muted hover:bg-surface-2')}>{category.label}</button>)}</div>
                </div>
                {LAYOUT_OBJECT_PALETTE.filter(item => item.category === paletteCategory).map((item) => (
                  <button key={item.label} onClick={() => handleAddItem(item)} className="p-2 border border-brand/25 bg-surface hover:bg-brand-soft/20 rounded text-sm text-left text-fg transition-all duration-150 flex items-center gap-2 font-medium">
                    <Plus className="w-4 h-4 text-brand" />{item.label}
                  </button>
                ))}
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Venue inventory & utilities</div>
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
                                const nextItems = items.filter(i => i.id !== selectedId);
                                pushState(nextItems); reconcileMappedInventory(nextItems);
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
                             const nextItems = items.filter(i => i.id !== selectedId);
                             pushState(nextItems); reconcileMappedInventory(nextItems);
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

                           {['round_table', 'rect_table', 'chair', 'decor'].includes(activeItem.type) && <div><label className="text-fg-subtle block mb-1">Venue inventory mapping</label><select aria-label="Venue inventory mapping" className="w-full bg-surface border border-[#e1d5c9] rounded px-2 py-1" value={activeItem.inventoryItemId || ''} onChange={(e) => { const inventoryItemId = e.target.value || undefined; const nextItems = items.map((item) => item.id === selectedId ? { ...item, inventoryItemId } : item); pushState(nextItems); reconcileMappedInventory(nextItems); }}><option value="">Not reserved from venue inventory</option>{(inventoryData?.items || []).filter((item: any) => { try { const type = JSON.parse(item.spec || '{}').objectType; return (activeItem.type.includes('table') && type === 'table') || (activeItem.type === 'chair' && type === 'chair') || (activeItem.type === 'decor' && type === 'decor'); } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div>}
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
                           const nextItems = items.filter(i => i.id !== selectedId);
                           pushState(nextItems); reconcileMappedInventory(nextItems);
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


function MobileLayoutReview({
  event,
  layout,
  diagnostics,
  items,
  vendors,
  managerOps,
  onToggleFloorWalkCheck,
  onRecordVarianceEvidence,
  onSetRainPlanActive,
  setupPacketUrl,
  onCreateSetupPacket,
  onOpenCanvas,
}: {
  event: SdkEvent;
  layout?: SdkLayout;
  diagnostics: any;
  items: any[];
  vendors: any[];
  managerOps: ManagerLayoutOpsState;
  onToggleFloorWalkCheck: (id: FloorWalkCheckId) => void;
  onRecordVarianceEvidence: () => void;
  onSetRainPlanActive: (active: boolean) => void;
  setupPacketUrl: string;
  onCreateSetupPacket: () => void;
  onOpenCanvas: () => void;
}) {
  const readyCount = diagnostics.checklist.filter((item: any) => item.done).length;
  const readinessPct = Math.round((readyCount / Math.max(1, diagnostics.checklist.length)) * 100);
  const tables = items.filter((item) => ['round_table', 'rect_table', 'table'].includes(item.type));
  const seats = items.filter((item) => ['chair', 'seat'].includes(item.type));
  const vendorZones = items.filter((item) => item.type === 'vendor_zone');
  const exits = items.filter((item) => ['fire_exit', 'exit'].includes(item.type) || /exit/i.test(itemLabel(item)));
  const paths = items.filter((item) => ['ada_path', 'walkway', 'aisle', 'load_in_path'].includes(item.type) || /ada|access|load/i.test(itemLabel(item)));
  const assignedSeatCount = seats.filter((seat) => seat.guestName || seat.guestId).length;
  const floorWalkDone = FLOOR_WALK_CHECKS.filter(check => managerOps.floorWalkChecks?.[check.id]).length;
  const mappedInventoryCount = items.filter((item) => item.inventoryItemId).length;
  const mappedInventoryTypes = new Set(items.filter((item) => item.inventoryItemId).map((item) => item.inventoryItemId)).size;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="success" className="mb-2"><Smartphone className="h-3 w-3" /> Mobile review mode</Badge>
            <h2 className="text-lg font-bold text-fg">Layout review, readiness, and print packet</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Canvas editing is intentionally disabled on phones. Review safety readiness, vendor zones, seating counts,
              and print/share the floorplan packet from this mobile-safe view.
            </p>
          </div>
          <Button variant="outline" className="min-h-11" onClick={onOpenCanvas}>
            <Maximize2 className="h-4 w-4" /> Open advanced canvas editor
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-fg">{event.title || 'Event'} floorplan packet</h2>
            <p className="text-sm text-fg-muted">{layout?.name || 'Primary layout'} · Rev {layout?.revision || 1} · {layout?.approval_status || 'draft'}</p>
          </div>
          <Badge variant={readinessPct >= 85 ? 'success' : readinessPct >= 60 ? 'warning' : 'danger'}>{readinessPct}% ready</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniLayoutMetric label="Seats" value={diagnostics.seats} detail={`${assignedSeatCount} assigned`} />
          <MiniLayoutMetric label="Tables" value={tables.length} detail="Floorplan tables" />
          <MiniLayoutMetric label="Vendor zones" value={vendorZones.length} detail="Load-in/service areas" />
          <MiniLayoutMetric label="Safety marks" value={exits.length + paths.length} detail="Exits + paths" />
          <MiniLayoutMetric label="Reserved inventory" value={mappedInventoryCount} detail={`${mappedInventoryTypes} venue item type${mappedInventoryTypes === 1 ? '' : 's'}`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 print:break-inside-avoid">
        <div className="rounded-2xl border border-brand/20 bg-brand-soft/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand"><ClipboardCheck className="h-4 w-4" /> Floor walk verification mode</h3>
          <p className="mb-3 text-xs text-fg-muted">Manager phone checklist for physically verifying the room against the approved layout.</p>
          <div className="space-y-2">
            {FLOOR_WALK_CHECKS.map((check) => (
              <button key={check.id} type="button" onClick={() => onToggleFloorWalkCheck(check.id)} className="w-full rounded-xl border border-border bg-surface p-3 text-left text-sm">
                <span className="flex items-start gap-2">
                  <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold', managerOps.floorWalkChecks?.[check.id] ? 'bg-success text-success-soft' : 'bg-warning-soft text-warning')}>{managerOps.floorWalkChecks?.[check.id] ? '✓' : '!'}</span>
                  <span><strong className="block text-fg">{check.label}</strong><span className="text-xs text-fg-muted">{check.detail}</span></span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-brand">{floorWalkDone}/{FLOOR_WALK_CHECKS.length} floor walk checks complete</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-brand"><QrCode className="h-4 w-4" /> QR-coded physical setup packet</h3>
          <div className="flex items-center gap-4">
            <div aria-label="Setup packet QR code" className="grid h-28 w-28 shrink-0 grid-cols-7 gap-0.5 rounded-lg border border-border bg-white p-2">
              {Array.from({ length: 49 }).map((_, idx) => <span key={idx} className={cn('rounded-[1px]', ((idx * 7 + event.id.length + (layout?.revision || 1)) % 5) < 2 ? 'bg-fg' : 'bg-surface')} />)}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-fg">Scan packet reference</p>
              <p className="text-xs text-fg-muted">Event {event.id.slice(0, 8)} · layout rev {layout?.revision || 1}. Print this packet for setup crew and vendors.</p>
              {setupPacketUrl ? <a className="mt-2 block text-xs font-bold text-brand underline" href={setupPacketUrl} target="_blank" rel="noreferrer">Open signed read-only packet</a> : <Button size="sm" variant="outline" className="mt-2" onClick={onCreateSetupPacket}>Create signed packet link</Button>}
              <a className="mt-2 inline-flex text-xs font-bold text-brand underline" href={`#/events/${event.id}/run-sheet`}>Open layout-to-run-sheet setup references</a>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
            <strong className="text-fg">Variance/photo evidence:</strong> {managerOps.varianceEvidence.length} open record(s). Use this when the room does not match the approved plan.
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onRecordVarianceEvidence}><Camera className="h-4 w-4" /> Record variance/photo evidence</Button>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
            <strong className="text-fg">Rain plan activation:</strong> {managerOps.rainPlanActive ? 'Active' : 'Not active'}
            <Button size="sm" variant={managerOps.rainPlanActive ? 'default' : 'outline'} className="mt-3 w-full" onClick={() => onSetRainPlanActive(!managerOps.rainPlanActive)}><Umbrella className="h-4 w-4" /> {managerOps.rainPlanActive ? 'Rain plan active' : 'Activate rain plan'}</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><Activity className="h-4 w-4" /> Readiness checklist</h3>
          <div className="space-y-2">
            {diagnostics.checklist.map((item: any) => (
              <div key={item.label} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm">
                <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', item.done ? 'bg-success text-success-soft' : 'bg-warning-soft text-warning')}>{item.done ? '✓' : '!'}</span>
                <span className="text-fg">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><AlertTriangle className="h-4 w-4" /> Owner-safe warnings</h3>
          {diagnostics.warnings.length ? (
            <div className="space-y-2">
              {diagnostics.warnings.map((warning: string) => (
                <div key={warning} className="rounded-xl border border-warning/30 bg-warning-soft/20 p-3 text-sm text-warning">{warning}</div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">No blocking layout readiness issues detected.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-brand"><FileText className="h-4 w-4" /> Non-canvas floorplan report</h3>
            <p className="text-xs text-fg-muted">Phone-friendly summary for owners, planners, staff, and vendors.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print floorplan packet</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MobileReportSection title="Seating and capacity" rows={[
            ['Expected guests', String(event.guest_count || 0)],
            ['Seats placed', String(diagnostics.seats)],
            ['Assigned seats', String(assignedSeatCount)],
            ['Capacity coverage', `${diagnostics.capacityPct}%`],
          ]} />
          <MobileReportSection title="Safety and accessibility" rows={[
            ['ADA/access paths', String(diagnostics.adaPaths)],
            ['Fire exits', String(diagnostics.exits)],
            ['Power sources', String(diagnostics.outlets)],
            ['Warnings', String(diagnostics.warnings.length)],
          ]} />
          <MobileReportSection title="Vendor operations" rows={[
            ['Vendors booked', String(vendors.length)],
            ['Vendor zones', String(diagnostics.vendorZones)],
            ['Load-in paths', String(paths.length)],
            ['Power sources', String(diagnostics.outlets)],
          ]} />
          <MobileReportSection title="Approval" rows={[
            ['Layout status', layout?.approval_status || 'draft'],
            ['Revision', String(layout?.revision || 1)],
            ['Last updated', layout?.updated_at ? new Date(layout.updated_at).toLocaleString() : 'Not saved yet'],
          ]} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 print:break-inside-avoid">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><Keyboard className="h-4 w-4" /> Object inventory</h3>
        <div className="space-y-2">
          {items.length ? items.slice(0, 40).map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
              <div className="font-semibold text-fg">{itemLabel(item)}</div>
              <div className="text-xs text-fg-muted">{item.type} · x {Math.round(item.x || 0)}, y {Math.round(item.y || 0)}{item.guestName ? ` · ${item.guestName}` : ''}</div>
            </div>
          )) : <p className="text-sm text-fg-muted">No layout objects have been placed yet.</p>}
          {items.length > 40 && <p className="text-xs text-fg-muted">Showing first 40 of {items.length} objects for phone readability. Print packet includes the summary.</p>}
        </div>
      </div>
    </div>
  );
}

import { MobileReportSection } from './MobileReportSection';

function LayoutReadinessPanel({
  diagnostics,
  items,
  layout,
  event,
  hasChanges,
  selectedId,
  setSelectedId,
  nudgeItem,
  rainPlanCompare,
  setRainPlanCompare,
  vendorSpecificView,
  setVendorSpecificView,
  managerOps,
  onToggleFloorWalkCheck,
  onRecordVarianceEvidence,
  onSetRainPlanActive,
  setupPacketUrl,
  onCreateSetupPacket,
}: {
  diagnostics: { seats: number; assignedSeats: number; tables: number; exits: number; adaPaths: number; vendorZones: number; outlets: number; warnings: string[]; capacityPct: number; checklist: Array<{ label: string; done: boolean }> };
  items: any[];
  layout?: SdkLayout;
  event: SdkEvent;
  hasChanges: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  nudgeItem: (id: string, dx: number, dy: number) => void;
  rainPlanCompare: boolean;
  setRainPlanCompare: (v: boolean) => void;
  vendorSpecificView: boolean;
  setVendorSpecificView: (v: boolean) => void;
  managerOps: ManagerLayoutOpsState;
  onToggleFloorWalkCheck: (id: FloorWalkCheckId) => void;
  onRecordVarianceEvidence: () => void;
  onSetRainPlanActive: (active: boolean) => void;
  setupPacketUrl: string;
  onCreateSetupPacket: () => void;
}) {
  const readyCount = diagnostics.checklist.filter(i => i.done).length;
  const readinessPct = Math.round((readyCount / Math.max(1, diagnostics.checklist.length)) * 100);
  const approvedLayoutChanged = layout?.approval_status === 'approved' && hasChanges;
  const tables = items.filter(item => ['round_table', 'rect_table', 'table'].includes(item.type));
  const seats = items.filter(item => ['chair', 'seat'].includes(item.type));
  const vendorZones = items.filter(item => item.type === 'vendor_zone');
  const floorWalkDone = FLOOR_WALK_CHECKS.filter(check => managerOps.floorWalkChecks?.[check.id]).length;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand flex items-center gap-2"><Activity className="h-4 w-4" /> Layout readiness & approval checklist</h2>
            <p className="text-xs text-fg-muted mt-1">Validate seating, ADA, fire exits, vendor load-in, service clearance, power, and approval before sharing the floorplan.</p>
          </div>
          <Badge variant={readinessPct >= 85 ? 'success' : readinessPct >= 60 ? 'warning' : 'danger'}>{readinessPct}% ready</Badge>
        </div>
        {approvedLayoutChanged && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            <strong>Layout changed after approval:</strong> Unsaved canvas changes exist on an approved layout. Save as a new revision and re-request approval before sharing with setup crew or vendors.
          </div>
        )}
        <div className="rounded-lg border border-brand/20 bg-brand-soft/5 p-3 text-xs text-fg-muted">
          <strong className="text-brand">Canvas editing guidance:</strong> detailed editing is best on desktop or tablet. Managers on phones should use mobile review, floor walk verification, readiness reports, and print packets.
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <MiniLayoutMetric label="Capacity heatmap" value={`${diagnostics.capacityPct}%`} detail={`${diagnostics.assignedSeats}/${diagnostics.seats} seats assigned`} />
          <MiniLayoutMetric label="ADA paths" value={diagnostics.adaPaths} detail="Marked accessible routes" />
          <MiniLayoutMetric label="Fire exits" value={diagnostics.exits} detail="Marked exit points" />
          <MiniLayoutMetric label="Power sources" value={diagnostics.outlets} detail="For DJ/band/catering" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {diagnostics.checklist.map(item => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-2 text-xs">
              <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', item.done ? 'bg-success text-success-soft' : 'bg-warning-soft text-warning')}>{item.done ? '✓' : '!'}</span>
              {item.label}
            </div>
          ))}
        </div>
        {diagnostics.warnings.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning space-y-1">
            {diagnostics.warnings.slice(0, 6).map(w => <div key={w}>• {w}</div>)}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={rainPlanCompare ? 'default' : 'outline'} onClick={() => setRainPlanCompare(!rainPlanCompare)}><Umbrella className="h-4 w-4" /> Rain-plan comparison</Button>
          <Button size="sm" variant={vendorSpecificView ? 'default' : 'outline'} onClick={() => setVendorSpecificView(!vendorSpecificView)}><Eye className="h-4 w-4" /> Vendor-specific layout view</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print floorplan packet</Button>
        </div>
        {rainPlanCompare && <p className="text-xs text-fg-muted">Rain-plan comparison: duplicate this layout as an indoor/rain plan version, then use version history approval to compare changes.</p>}
        {vendorSpecificView && <p className="text-xs text-fg-muted">Vendor-specific view: vendor zones, power, and load-in routes are highlighted in the object list and report for partner sharing.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <h3 className="text-xs font-bold text-brand flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Physical verification checklist</h3>
            <div className="mt-2 grid gap-1">
              {FLOOR_WALK_CHECKS.slice(0, 6).map(check => (
                <button key={check.id} type="button" onClick={() => onToggleFloorWalkCheck(check.id)} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left text-[11px]">
                  <span className={managerOps.floorWalkChecks?.[check.id] ? 'text-success' : 'text-warning'}>{managerOps.floorWalkChecks?.[check.id] ? '✓' : '!'}</span>
                  <span>{check.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-semibold text-brand">{floorWalkDone}/{FLOOR_WALK_CHECKS.length} complete</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
            <h3 className="text-xs font-bold text-brand flex items-center gap-2"><QrCode className="h-4 w-4" /> Setup packet controls</h3>
            <div className="text-[11px] text-fg-muted">QR packet ref: {event.id.slice(0, 8)} · rev {layout?.revision || 1}. Layout-to-run-sheet references are included for setup crew.</div>
            {setupPacketUrl ? <a href={setupPacketUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-brand underline">Signed read-only setup packet</a> : <Button size="xs" variant="outline" onClick={onCreateSetupPacket}><QrCode className="h-3.5 w-3.5" /> Create signed packet</Button>}
            <a href={`#/events/${event.id}/run-sheet`} className="text-[11px] font-bold text-brand underline">Open run sheet setup references</a>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="xs" variant="outline" onClick={onRecordVarianceEvidence}><Camera className="h-3.5 w-3.5" /> Record variance</Button>
              <Button size="xs" variant={managerOps.rainPlanActive ? 'default' : 'outline'} onClick={() => onSetRainPlanActive(!managerOps.rainPlanActive)}><Umbrella className="h-3.5 w-3.5" /> Rain plan</Button>
            </div>
            {managerOps.varianceEvidence.length > 0 && <p className="text-[11px] text-warning font-semibold">{managerOps.varianceEvidence.length} variance/photo evidence record(s).</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-bold text-brand flex items-center gap-2"><Keyboard className="h-4 w-4" /> Keyboard-accessible object list</h2>
        <p className="text-xs text-fg-muted">Select an object and nudge it without using the canvas. This also serves as a non-canvas summary/report.</p>
        <div className="max-h-64 overflow-auto space-y-1">
          {items.length === 0 ? <div className="text-xs text-fg-muted">No layout objects yet.</div> : items.map(item => (
            <div key={item.id} className={cn('rounded-lg border p-2 text-xs', selectedId === item.id ? 'border-brand bg-brand-soft/30' : 'border-border bg-surface-2')}>
              <button type="button" onClick={() => setSelectedId(item.id)} className="w-full text-left font-semibold text-fg">{itemLabel(item)} <span className="text-fg-muted">({item.type})</span></button>
              <div className="mt-1 text-fg-muted">x {Math.round(item.x || 0)}, y {Math.round(item.y || 0)}{item.guestName ? ` · ${item.guestName}` : ''}</div>
              <div className="mt-2 flex gap-1">
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, 0, -5)}>↑</Button>
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, 0, 5)}>↓</Button>
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, -5, 0)}>←</Button>
                <Button size="xs" variant="outline" onClick={() => nudgeItem(item.id, 5, 0)}>→</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-fg-muted">
          <FileText className="inline h-3.5 w-3.5 mr-1" /> Non-canvas seat/table inventory: {tables.length} tables, {seats.length} seats, {vendorZones.length} vendor zones, {diagnostics.outlets} power sources. Fire marshal/accessibility packet checks: {managerOps.floorWalkChecks?.fire_marshal ? 'fire ready' : 'fire pending'} · {managerOps.floorWalkChecks?.accessibility ? 'accessibility ready' : 'accessibility pending'}.
        </div>
      </div>
    </div>
  );
}

import { MiniLayoutMetric } from './MiniLayoutMetric';
import { LayoutCollaborationPanel } from './LayoutCollaborationPanel';
import { usePermission } from '../../../lib/usePermission';
