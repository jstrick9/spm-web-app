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
import { usePrompt } from '../../../ui/usePrompt';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../ui/Dialog';

import { CanvasToolbar } from './canvasSections/CanvasToolbar';
import { CanvasSidebar } from './canvasSections/CanvasSidebar';
import { CanvasStageArea } from './canvasSections/CanvasStageArea';

interface Props {
  event: SdkEvent;
}

import { DEFAULT_ITEMS, FLOOR_WALK_CHECKS, DEFAULT_MANAGER_LAYOUT_OPS, centerDistance, itemLabel, managerLayoutOpsFromBackend, type FloorWalkCheckId, type ManagerLayoutOpsState } from './layoutOpsModel';
import { LAYOUT_OBJECT_PALETTE, LAYOUT_PALETTE_CATEGORIES, type LayoutPaletteCategory } from './layoutObjectPalette';
import { generateWeddingPackage, WEDDING_LAYOUT_PACKAGES, type WeddingLayoutPackage } from './weddingLayoutPackages';
import { createIndependentSetupGroup } from './setupGroups';
import { LayoutCollaborationPanel } from './LayoutCollaborationPanel';
import { usePermission } from '../../../lib/usePermission';


// Decomposed review/readiness panels (see ./canvasPanels.tsx).
import { MobileLayoutReview, LayoutReadinessPanel } from './canvasPanels';

export function CanvasPage({ event }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
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
  const allowedTemplateCategories = useMemo(() => { try { const payload = typeof layout?.payload === 'string' ? JSON.parse(layout.payload) : layout?.payload; return Array.isArray(payload?.allowedObjectCategories) ? new Set(payload.allowedObjectCategories) : null; } catch { return null; } }, [layout?.payload]);
  const allowedTemplateInventory = useMemo(() => { try { const payload = typeof layout?.payload === 'string' ? JSON.parse(layout.payload) : layout?.payload; return Array.isArray(payload?.allowedInventoryItemIds) ? new Set(payload.allowedInventoryItemIds) : null; } catch { return null; } }, [layout?.payload]);
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
    const templateCategory = catalogItem.category || (catalogItem.type === 'decor' ? 'decor' : catalogItem.type?.includes('table') ? 'tables' : catalogItem.type === 'chair' ? 'chairs' : 'service');
    if (allowedTemplateCategories && !allowedTemplateCategories.has(templateCategory)) { toast({ title: 'Not included in this venue template', description: 'Ask Seven Paths Manor to add this object category to your approved template.', variant: 'destructive' }); return; }
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

  const handleRestoreVersion = async (version: any) => {
    if (await askConfirm({ title: 'Restore this layout version?', description: 'Unsaved changes will be lost.', destructive: true })) {
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

  const generateAILayout = async () => {
    if (!(await askConfirm({ title: 'Replace layout with an AI suggestion?', description: 'This will replace your current layout with an AI generated suggestion based on your guest count.', destructive: true }))) {
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
      <CanvasToolbar snapToGrid={snapToGrid} setSnapToGrid={setSnapToGrid} showClearanceRings={showClearanceRings} setShowClearanceRings={setShowClearanceRings} drawingMode={drawingMode} setDrawingMode={setDrawingMode} drawnPoints={drawnPoints} setDrawnPoints={setDrawnPoints} undoStack={undoStack} redoStack={redoStack} handleUndo={handleUndo} handleRedo={handleRedo} finalizeCustomWall={finalizeCustomWall} />

      <Dialog open={setupGroupOpen} onOpenChange={setSetupGroupOpen}><DialogContent><DialogHeader><DialogTitle>Create independent setup group</DialogTitle><DialogDescription>Configure one table setup, then create independent copies. Inventory reserves immediately for this event.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Setup name</Label><Input value={setupGroupName} onChange={(e) => setSetupGroupName(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Number of setups</Label><Input type="number" min="1" value={setupGroupQuantity} onChange={(e) => setSetupGroupQuantity(Math.max(1, Number(e.target.value) || 1))}/></div><div><Label>Chairs per setup</Label><Input type="number" min="0" value={setupGroupChairs} onChange={(e) => setSetupGroupChairs(Math.max(0, Number(e.target.value) || 0))}/></div></div><div><Label>Arrange copies</Label><div className="mt-1 flex gap-1">{(['grid','row','arc'] as const).map((arrangement) => <button type="button" key={arrangement} onClick={() => setSetupGroupArrangement(arrangement)} className={`rounded border px-2 py-1 text-xs ${setupGroupArrangement === arrangement ? 'border-brand bg-brand-soft text-brand' : 'border-border'}`}>{arrangement}</button>)}</div></div><div><Label>Venue table inventory</Label><select aria-label="Venue table inventory" className="mt-1 h-10 w-full rounded border border-border bg-surface px-2" value={setupTableId} onChange={(e) => setSetupTableId(e.target.value)}><option value="">Choose table…</option>{(inventoryData?.items || []).filter((item: any) => { try { return JSON.parse(item.spec || '{}').objectType === 'table'; } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div>{selectedSetupCapacity > 0 && <div className="rounded border border-brand/20 bg-brand-soft/20 p-2 text-xs"><strong>{selectedSetupTable?.name}</strong> seats up to {selectedSetupCapacity} for {serviceStyle.replace('_', ' ')} service. <button type="button" className="ml-1 font-semibold underline" onClick={() => setSetupGroupChairs(selectedSetupCapacity)}>Use {selectedSetupCapacity} chairs per setup</button> · {Math.ceil(Math.max(1, event.guest_count || packageGuests) / selectedSetupCapacity)} setup(s) suggested for {event.guest_count || packageGuests} guests.</div>}<div><Label>Venue chair inventory (optional)</Label><select aria-label="Venue chair inventory" className="mt-1 h-10 w-full rounded border border-border bg-surface px-2" value={setupChairId} onChange={(e) => setSetupChairId(e.target.value)}><option value="">No chairs</option>{(inventoryData?.items || []).filter((item: any) => { try { return JSON.parse(item.spec || '{}').objectType === 'chair'; } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div><div><Label>Centerpiece / decor inventory (optional)</Label><select aria-label="Venue decor inventory" className="mt-1 h-10 w-full rounded border border-border bg-surface px-2" value={setupDecorId} onChange={(e) => setSetupDecorId(e.target.value)}><option value="">No centerpiece</option>{(inventoryData?.items || []).filter((item: any) => { try { return JSON.parse(item.spec || '{}').objectType === 'decor'; } catch { return false; } }).map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.available_count} available</option>)}</select></div>{reservationConflict && <div className="rounded border border-warning/40 bg-warning-soft/20 p-2 text-xs"><strong>Inventory review required</strong><p className="mt-1 text-fg-muted">An authorized venue manager may proceed with a documented override after reviewing same-day inventory.</p><Label className="mt-2 block">Manager override reason</Label><Input aria-label="Manager inventory override reason" value={reservationOverrideReason} onChange={(e) => setReservationOverrideReason(e.target.value)} placeholder="Why can this reservation proceed?"/></div>}</div><DialogFooter><Button variant="secondary" onClick={() => { setSetupGroupOpen(false); setReservationConflict(''); }}>Cancel</Button><Button onClick={() => void addSetupGroup()}>{reservationConflict ? 'Proceed with override' : 'Reserve & add group'}</Button></DialogFooter></DialogContent></Dialog>
      <LayoutReadinessPanel diagnostics={layoutDiagnostics} items={items} layout={layout} event={event} hasChanges={hasChanges} selectedId={selectedId} setSelectedId={setSelectedId} nudgeItem={nudgeItem} rainPlanCompare={rainPlanCompare} setRainPlanCompare={setRainPlanCompare} vendorSpecificView={vendorSpecificView} setVendorSpecificView={setVendorSpecificView} managerOps={managerLayoutOps} onToggleFloorWalkCheck={toggleFloorWalkCheck} onRecordVarianceEvidence={recordVarianceEvidence} onSetRainPlanActive={setRainPlanActive} setupPacketUrl={setupPacketUrl} onCreateSetupPacket={createSignedSetupPacket} />

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs"><span><strong>Venue-owned structure & safety</strong> is protected from event edits.</span><span className="flex gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={showProtectedLayers} onChange={(e) => setShowProtectedLayers(e.target.checked)}/> Show protected layers</label><label className="flex items-center gap-2"><input type="checkbox" checked={showCommentPins} onChange={(e) => setShowCommentPins(e.target.checked)}/> Show comment pins</label></span></div>
      <div className="flex w-full h-[600px] border border-paper-border rounded-lg bg-surface overflow-hidden shadow-md">
        {/* Sidebar Catalog / Guests */}
      <CanvasSidebar guestSearch={guestSearch} setGuestSearch={setGuestSearch} items={items} selectedId={selectedId} setSelectedId={setSelectedId} sidebarTab={sidebarTab} setSidebarTab={setSidebarTab} paletteCategory={paletteCategory} setPaletteCategory={setPaletteCategory} viewingVersion={viewingVersion} setHasChanges={setHasChanges} packageGuests={packageGuests} setPackageGuests={setPackageGuests} serviceStyle={serviceStyle} setServiceStyle={setServiceStyle} setSetupGroupOpen={setSetupGroupOpen} showVendorOverlay={showVendorOverlay} setShowVendorOverlay={setShowVendorOverlay} draggedGuestRef={draggedGuestRef} inventoryData={inventoryData} guests={guests} DECOR_ITEMS={DECOR_ITEMS} layout={layout} versions={versions} vendors={vendors} allowedTemplateCategories={allowedTemplateCategories} allowedTemplateInventory={allowedTemplateInventory} pushState={pushState} reconcileMappedInventory={reconcileMappedInventory} saveLayout={saveLayout} handleAddStickyNote={handleAddStickyNote} CATALOG_ITEMS={CATALOG_ITEMS} handleAddItem={handleAddItem} addWeddingPackage={addWeddingPackage} handleRestoreVersion={handleRestoreVersion} handlePreviewVersion={handlePreviewVersion} event={event} />

        {/* Main Canvas Area */}
      <CanvasStageArea routePoints={routePoints} setRoutePoints={setRoutePoints} showHelpGuide={showHelpGuide} setShowHelpGuide={setShowHelpGuide} showClearanceRings={showClearanceRings} autoArrangeOpen={autoArrangeOpen} setAutoArrangeOpen={setAutoArrangeOpen} affinityRule={affinityRule} setAffinityRule={setAffinityRule} drawingMode={drawingMode} drawnPoints={drawnPoints} items={items} selectedId={selectedId} setSelectedId={setSelectedId} vendorLines={vendorLines} setVendorLines={setVendorLines} viewingVersion={viewingVersion} setViewingVersion={setViewingVersion} dimensions={dimensions} scale={scale} pos={pos} setPos={setPos} hasChanges={hasChanges} setHasChanges={setHasChanges} showProtectedLayers={showProtectedLayers} showCommentPins={showCommentPins} showVendorOverlay={showVendorOverlay} stageRef={stageRef} containerRef={containerRef} trRef={trRef} toast={toast} layoutCollaboration={layoutCollaboration} guests={guests} layout={layout} duplicateGuestIds={duplicateGuestIds} pushState={pushState} checkCollision={checkCollision} handleSave={handleSave} handleDragEnd={handleDragEnd} handleDrop={handleDrop} runAutoArranger={runAutoArranger} handleDragOver={handleDragOver} unassignGuest={unassignGuest} handleWheel={handleWheel} structuralData={structuralData} exportToPNG={exportToPNG} exportToSVG={exportToSVG} exportToPDF={exportToPDF} handleStageClick={handleStageClick} generateAILayout={generateAILayout} resetView={resetView} isSaving={isSaving} />
      </div>
    </div>
  );
}



