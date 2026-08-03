import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasToolbar } from './canvasSections/CanvasToolbar';
import { CanvasSidebar } from './canvasSections/CanvasSidebar';
import { CanvasStageArea } from './canvasSections/CanvasStageArea';

// Konva's Stage needs a 2D canvas context even in jsdom (same stub as CanvasPage.test.tsx).
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      fillRect: function() {}, clearRect: function(){},
      getImageData: function(x: number, y: number, w: number, h: number) { return { data: new Array(w*h*4) }; },
      putImageData: function() {}, createImageData: function(){ return []; },
      setTransform: function(){}, drawImage: function(){}, save: function(){},
      fillText: function(){}, restore: function(){}, beginPath: function(){},
      moveTo: function(){}, lineTo: function(){}, closePath: function(){},
      stroke: function(){}, translate: function(){}, scale: function(){},
      rotate: function(){}, arc: function(){}, fill: function(){},
      measureText: function(){ return { width: 0 }; }, transform: function(){},
      rect: function(){}, clip: function(){},
    };
  };
}

/**
 * Direct component tests for the extracted CanvasPage sections.
 * These lock the section contracts in place so future in-section refactors
 * (per ARCHITECTURE_CLOSEOUT P2) are safe: each section is renderable and
 * interactive with props alone, independent of the container's data wiring.
 */

// ── Factories ─────────────────────────────────────────────
const noop = () => {};
const setState = (v: any) => { void v; };

function toolbarProps(over: Partial<Parameters<typeof CanvasToolbar>[0]> = {}) {
  return {
    snapToGrid: true, setSnapToGrid: setState as any,
    showClearanceRings: true, setShowClearanceRings: setState as any,
    drawingMode: false, setDrawingMode: setState as any,
    drawnPoints: [], setDrawnPoints: setState as any,
    undoStack: [], redoStack: [],
    handleUndo: noop, handleRedo: noop, finalizeCustomWall: noop,
    ...over,
  };
}

function sidebarProps(over: Partial<Parameters<typeof CanvasSidebar>[0]> = {}) {
  const event = { id: 'evt1', organization_id: 'org1', title: 'Test Wedding', status: 'planning' as const, start_date: '2026-09-12', end_date: null, guest_count: 100, slug: 'test' } as any;
  return {
    guestSearch: '', setGuestSearch: setState as any,
    items: [], selectedId: null, setSelectedId: setState as any,
    sidebarTab: 'catalog' as const, setSidebarTab: setState as any,
    paletteCategory: 'tables' as const, setPaletteCategory: setState as any,
    viewingVersion: null, setHasChanges: setState as any,
    packageGuests: 100, setPackageGuests: setState as any,
    serviceStyle: 'plated', setServiceStyle: setState as any,
    setSetupGroupOpen: setState as any,
    showVendorOverlay: false, setShowVendorOverlay: setState as any,
    draggedGuestRef: { current: null } as any,
    inventoryData: { items: [] } as any,
    guests: [{ id: 'g1', full_name: 'Jane Guest', email: 'jane@example.com', party_name: 'Smith' }] as any,
    DECOR_ITEMS: [],
    layout: { id: 'l1', revision: 1, updated_at: new Date().toISOString(), approval_status: 'draft' } as any,
    versions: [],
    vendors: [{ id: 'v1', name: 'DJ Dave', category: 'dj' }] as any,
    allowedTemplateCategories: null, allowedTemplateInventory: null,
    pushState: noop, reconcileMappedInventory: noop,
    saveLayout: { isPending: false } as any,
    handleAddStickyNote: noop,
    CATALOG_ITEMS: [],
    handleAddItem: noop, addWeddingPackage: noop,
    handleRestoreVersion: noop, handlePreviewVersion: noop,
    event,
    ...over,
  };
}

function stageAreaProps(over: Partial<Parameters<typeof CanvasStageArea>[0]> = {}) {
  return {
    routePoints: [], setRoutePoints: setState as any,
    showHelpGuide: false, setShowHelpGuide: setState as any,
    showClearanceRings: true, autoArrangeOpen: false, setAutoArrangeOpen: setState as any,
    affinityRule: 'together' as const, setAffinityRule: setState as any,
    drawingMode: false, drawnPoints: [],
    items: [], selectedId: null, setSelectedId: setState as any,
    vendorLines: [], setVendorLines: setState as any,
    viewingVersion: null, setViewingVersion: setState as any,
    dimensions: { width: 800, height: 600 }, scale: 1, pos: { x: 0, y: 0 }, setPos: setState as any,
    hasChanges: false, setHasChanges: setState as any,
    showProtectedLayers: true, showCommentPins: true, showVendorOverlay: false,
    stageRef: { current: null } as any, containerRef: { current: null } as any, trRef: { current: null } as any,
    toast: noop as any,
    layoutCollaboration: null, guests: [] as any, layout: { id: 'l1' } as any, duplicateGuestIds: new Set<string>(),
    pushState: noop, checkCollision: () => null,
    handleSave: noop, handleDragEnd: noop, handleDrop: noop, runAutoArranger: noop, handleDragOver: noop,
    unassignGuest: noop, handleWheel: noop, structuralData: { lines: [], doors: [], windows: [], pillars: [] } as any,
    exportToPNG: noop, exportToSVG: noop, exportToPDF: noop,
    handleStageClick: noop, generateAILayout: noop, resetView: noop, isSaving: false,
    ...over,
  };
}

// ── CanvasToolbar ─────────────────────────────────────────
describe('CanvasToolbar', () => {
  it('renders undo/redo, snapping, safety rings, and draw-wall controls', () => {
    render(<CanvasToolbar {...toolbarProps({ undoStack: [['a']], redoStack: [['b']] })} />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/grid snapping \(20px\)/i)).toBeChecked();
    expect(screen.getByLabelText(/spacing safety rings/i)).toBeChecked();
    expect(screen.getByRole('button', { name: /draw polygon walls/i })).toBeInTheDocument();
  });

  it('disables undo/redo when their stacks are empty', () => {
    render(<CanvasToolbar {...toolbarProps()} />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });

  it('fires undo/redo and draw-wall handlers, and toggles snapping', async () => {
    const user = userEvent.setup();
    const handleUndo = vi.fn();
    const handleRedo = vi.fn();
    const finalizeCustomWall = vi.fn();
    const setSnapToGrid = vi.fn();
    render(<CanvasToolbar {...toolbarProps({
      undoStack: [['a']], redoStack: [['b']],
      drawingMode: true, // already drawing: the button becomes "Close Polygon Wall" → finalizeCustomWall
      handleUndo, handleRedo, finalizeCustomWall, setSnapToGrid: setSnapToGrid as any,
    })} />);
    await user.click(screen.getByRole('button', { name: /undo/i }));
    await user.click(screen.getByRole('button', { name: /redo/i }));
    await user.click(screen.getByRole('button', { name: /close polygon wall/i }));
    await user.click(screen.getByLabelText(/grid snapping \(20px\)/i));
    expect(handleUndo).toHaveBeenCalledTimes(1);
    expect(handleRedo).toHaveBeenCalledTimes(1);
    expect(finalizeCustomWall).toHaveBeenCalledTimes(1);
    expect(setSnapToGrid).toHaveBeenCalledWith(false);
  });

  it('shows the drawing-mode node counter and closes polygon walls', () => {
    render(<CanvasToolbar {...toolbarProps({ drawingMode: true, drawnPoints: [{ x: 1, y: 2 }, { x: 3, y: 4 }] })} />);
    expect(screen.getByText(/2 set/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close polygon wall/i })).toBeInTheDocument();
  });
});

// ── CanvasSidebar ─────────────────────────────────────────
describe('CanvasSidebar', () => {
  it('renders all six workspace tabs', () => {
    render(<CanvasSidebar {...sidebarProps()} />);
    // The catalog tab also has category chips (e.g. "Decor"), so assert the
    // tab row contains at least one exact-name button per workspace tab.
    for (const name of ['Items', 'Decor', 'Guests', 'Layers', 'Diff', 'Vendors']) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('switches content to the guests tab', async () => {
    const user = userEvent.setup();
    const setSidebarTab = vi.fn();
    render(<CanvasSidebar {...sidebarProps({ setSidebarTab: setSidebarTab as any })} />);
    await user.click(screen.getByRole('button', { name: /guests/i }));
    expect(setSidebarTab).toHaveBeenCalledWith('guests');
  });

  it('shows wedding setup packages and quick design on the items tab', () => {
    render(<CanvasSidebar {...sidebarProps()} />);
    expect(screen.getByText(/wedding setup packages/i)).toBeInTheDocument();
    expect(screen.getByText(/quick event design/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/package guest count/i)).toHaveValue(100);
  });

  it('renders assigned vendors on the vendors tab', () => {
    render(<CanvasSidebar {...sidebarProps({ sidebarTab: 'vendors' as const })} />);
    expect(screen.getByText('DJ Dave')).toBeInTheDocument();
  });

  it('renders version history on the diff tab', () => {
    render(<CanvasSidebar {...sidebarProps({
      sidebarTab: 'history' as const,
      versions: [{ id: 'v9', revision: 1, created_at: new Date().toISOString(), master_layout: '{}' }] as any,
    })} />);
    expect(screen.getByText(/version history/i)).toBeInTheDocument();
    expect(screen.getByText(/revision 1/i)).toBeInTheDocument();
  });
});

// ── CanvasStageArea ───────────────────────────────────────
describe('CanvasStageArea', () => {
  it('renders the canvas container with zoom controls and the stage', () => {
    render(<CanvasStageArea {...stageAreaProps()} />);
    expect(screen.getByRole('button', { name: /help guide/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save layout/i })).toBeInTheDocument();
  });

  it('shows the interactive canvas user guide overlay when enabled', () => {
    render(<CanvasStageArea {...stageAreaProps({ showHelpGuide: true })} />);
    expect(screen.getByText(/interactive canvas user guide/i)).toBeInTheDocument();
  });

  it('shows the revision diff banner when viewing a version', () => {
    render(<CanvasStageArea {...stageAreaProps({
      viewingVersion: { revision: 3, payload: JSON.stringify({ items: [] }) },
    })} />);
    expect(screen.getByText(/viewing revision 3 diff overlay/i)).toBeInTheDocument();
  });

  it('opens the AI auto-arranger dialog with guest summary', () => {
    render(<CanvasStageArea {...stageAreaProps({
      autoArrangeOpen: true,
      guests: [{ id: 'g1', full_name: 'Jane Guest', party_name: 'Smith Family' }] as any,
    })} />);
    expect(screen.getByText(/ai smart seating auto-arranger/i)).toBeInTheDocument();
    expect(screen.getAllByText(/unassigned guests/i).length).toBeGreaterThanOrEqual(1);
  });

  it('fires the save and reset handlers', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const resetView = vi.fn();
    render(<CanvasStageArea {...stageAreaProps({ handleSave, resetView, hasChanges: true })} />);
    await user.click(screen.getByRole('button', { name: /save layout/i }));
    await user.click(screen.getByRole('button', { name: /reset view/i }));
    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(resetView).toHaveBeenCalledTimes(1);
  });
});
