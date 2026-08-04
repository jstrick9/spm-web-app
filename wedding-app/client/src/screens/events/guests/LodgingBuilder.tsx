import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge }               from '../../../ui/Badge';
import { cn }                  from '../../../ui/lib/cn';
import { Home, Sliders, Settings, Users, Plus, Trash2, RotateCw, Layout, Search, Grid, Compass, ZoomIn, ZoomOut, Check, X } from 'lucide-react';

export interface LodgingFurniture {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string;
  label?: string;
}

export interface LodgingRoom {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  shape?: 'rectangle' | 'custom';
  polygonPoints?: { x: number; y: number }[];
  capacity: number;
  assignedGuests: string[]; // guestIds
  color?: string;
  label?: string;
  furniture?: LodgingFurniture[];
}

export interface LodgingFloor {
  id: string;
  name: string;
  level: number;
  width: number;
  height: number;
  rooms: LodgingRoom[];
}

interface LodgingBuilderProps {
  eventId: string;
  venueId: string;
  venueName: string;
  venueWidth: number;
  venueHeight: number;
  initialFloors: LodgingFloor[];
  onSave: (floors: LodgingFloor[]) => void;
  onClose: () => void;
}

const SCALE = 10; // pixels per foot
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const furnitureCatalog = [
  { type: 'bed-king', label: 'King Bed', icon: '🛏️', width: 6, height: 7, color: '#DBEAFE' },
  { type: 'bed-queen', label: 'Queen Bed', icon: '🛏️', width: 5, height: 7, color: '#DBEAFE' },
  { type: 'bed-double', label: 'Double Bed', icon: '🛏️', width: 4.5, height: 6, color: '#DBEAFE' },
  { type: 'bed-twin', label: 'Twin Bed', icon: '🛏️', width: 3, height: 6, color: '#DBEAFE' },
  { type: 'nightstand', label: 'Nightstand', icon: '🪵', width: 2, height: 2, color: '#F3E8FF' },
  { type: 'dresser', label: 'Dresser', icon: '🗄️', width: 4, height: 1.5, color: '#FDE68A' },
  { type: 'chair', label: 'Chair', icon: '🪑', width: 2, height: 2, color: '#FEF3C7' },
  { type: 'sofa', label: 'Sofa', icon: '🛋️', width: 7, height: 3.5, color: '#FBCFE8' },
  { type: 'sleeper-sofa', label: 'Sleeper Sofa', icon: '🛋️', width: 7, height: 4, color: '#FBCFE8' },
  { type: 'toilet', label: 'Toilet', icon: '🚽', width: 1.5, height: 2, color: '#E0F2FE' },
  { type: 'shower', label: 'Shower', icon: '🚿', width: 3, height: 3, color: '#E0F2FE' },
  { type: 'sink', label: 'Sink', icon: '🚰', width: 2, height: 1.5, color: '#E0F2FE' },
  { type: 'pool-table', label: 'Pool Table', icon: '🎱', width: 8, height: 4, color: '#BBF7D0' },
];

export function LodgingBuilder({ eventId, venueId, venueName, venueWidth, venueHeight, initialFloors, onSave, onClose }: LodgingBuilderProps) {
  const { toast } = useToast();
  
  const resolvedFloors = initialFloors && initialFloors.length > 0
    ? initialFloors
    : [{ id: 'f1', name: 'First Floor', level: 1, width: venueWidth || 60, height: venueHeight || 40, rooms: [] }];

  const [floors, setFloors] = useState<LodgingFloor[]>(resolvedFloors);
  const [activeFloorId, setActiveFloorId] = useState<string>(resolvedFloors[0]?.id || 'f1');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [draggingFurnitureId, setDraggingFurnitureId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [roomShapeDraft, setRoomShapeDraft] = useState<'rectangle' | 'custom'>('rectangle');
  
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(1);
  const [searchFurniture, setSearchFurniture] = useState('');
  const [activeRightPanelTab, setActiveRightPanelTab] = useState<'room' | 'guests' | 'furniture' | 'item'>('room');
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Lodging Search & Filter States (Phase 6)
  const [lodgingGuestSearch, setLodgingGuestSearch] = useState('');
  const [lodgingPartyFilter, setLodgingPartyFilter] = useState('all');

  // Fetch Event Guests
  const { data: guestsData } = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => sdk.guests.list(eventId),
  });
  const guests = guestsData?.guests || [];

  const uniqueParties = useMemo(() => {
    const set = new Set<string>();
    guests.forEach((g: any) => {
      if (g.party_name && g.party_name.trim()) {
        set.add(g.party_name.trim());
      }
    });
    return Array.from(set);
  }, [guests]);

  const activeFloor = floors.find(f => f.id === activeFloorId);
  const selectedRoom = activeFloor?.rooms.find(r => r.id === selectedRoomId) || null;
  const selectedFurniture = selectedRoom?.furniture?.find(f => f.id === selectedFurnitureId) || null;

  const filteredFurnitureCatalog = furnitureCatalog.filter(item =>
    item.label.toLowerCase().includes(searchFurniture.toLowerCase())
  );

  const snap = (value: number) => (snapToGrid ? Math.round(value / gridSize) * gridSize : value);

  const addFloor = () => {
    const newFloor: LodgingFloor = {
      id: `f-${Date.now()}`,
      name: `Floor ${floors.length + 1}`,
      level: floors.length + 1,
      width: venueWidth || 60,
      height: venueHeight || 40,
      rooms: [],
    };
    setFloors(prev => [...prev, newFloor]);
    setActiveFloorId(newFloor.id);
    setSelectedRoomId(null);
  };

  const updateActiveFloor = (updates: Partial<LodgingFloor>) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, ...updates } : f));
  };

  const addRoom = () => {
    if (!activeFloor) return;
    const newRoom: LodgingRoom = {
      id: `room-${Date.now()}`,
      name: `Room ${activeFloor.rooms.length + 1}`,
      width: 14,
      height: 12,
      x: 2,
      y: 2,
      shape: roomShapeDraft,
      capacity: 2,
      assignedGuests: [],
      color: '#E2E8F0',
      furniture: [],
    };
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, rooms: [...f.rooms, newRoom] } : f));
    setSelectedRoomId(newRoom.id);
    setSelectedFurnitureId(null);
  };

  const updateRoom = (roomId: string, updates: Partial<LodgingRoom>) => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? {
      ...f,
      rooms: f.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r),
    } : f));
  };

  const deleteRoom = (roomId: string) => {
    if (!activeFloor) return;
    setFloors(prev => prev.map(f => f.id === activeFloorId ? {
      ...f,
      rooms: f.rooms.filter(r => r.id !== roomId),
    } : f));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
      setSelectedFurnitureId(null);
    }
  };

  const addFurniture = (type: string) => {
    if (!selectedRoom) return;
    const def = furnitureCatalog.find(f => f.type === type) || furnitureCatalog[0];
    const newFurniture: LodgingFurniture = {
      id: `fur-${Date.now()}`,
      type: def.type,
      x: 1,
      y: 1,
      width: def.width,
      height: def.height,
      rotation: 0,
      color: def.color,
      label: def.label,
    };
    updateRoom(selectedRoom.id, { furniture: [...(selectedRoom.furniture || []), newFurniture] });
    setSelectedFurnitureId(newFurniture.id);
  };

  const updateFurniture = (furnitureId: string, updates: Partial<LodgingFurniture>) => {
    if (!selectedRoom) return;
    updateRoom(selectedRoom.id, {
      furniture: (selectedRoom.furniture || []).map(item => item.id === furnitureId ? { ...item, ...updates } : item),
    });
  };

  const deleteFurniture = (furnitureId: string) => {
    if (!selectedRoom) return;
    updateRoom(selectedRoom.id, {
      furniture: (selectedRoom.furniture || []).filter(item => item.id !== furnitureId),
    });
    if (selectedFurnitureId === furnitureId) setSelectedFurnitureId(null);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!canvasRef.current || !activeFloor) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = snap(clamp((e.clientX - rect.left) / SCALE - dragOffset.x, 0, activeFloor.width));
      const y = snap(clamp((e.clientY - rect.top) / SCALE - dragOffset.y, 0, activeFloor.height));

      if (draggingRoomId) {
        const room = activeFloor.rooms.find(r => r.id === draggingRoomId);
        if (!room) return;
        updateRoom(draggingRoomId, {
          x: clamp(x, 0, Math.max(0, activeFloor.width - room.width)),
          y: clamp(y, 0, Math.max(0, activeFloor.height - room.height)),
        });
      }

      if (draggingFurnitureId && selectedRoom) {
        const item = selectedRoom.furniture?.find(f => f.id === draggingFurnitureId);
        if (!item) return;
        updateFurniture(draggingFurnitureId, {
          x: clamp(x - selectedRoom.x, 0, Math.max(0, selectedRoom.width - item.width)),
          y: clamp(y - selectedRoom.y, 0, Math.max(0, selectedRoom.height - item.height)),
        });
      }
    };

    const handleUp = () => {
      setDraggingRoomId(null);
      setDraggingFurnitureId(null);
    };

    if (draggingRoomId || draggingFurnitureId) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingRoomId, draggingFurnitureId, dragOffset, activeFloor, selectedRoom, gridSize, snapToGrid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-paper rounded-2xl shadow-2xl flex flex-col w-full max-w-[96vw] h-[94vh] overflow-hidden border border-paper-border">
        
        {/* Luxury Header */}
        <div className="p-4 border-b border-paper-border flex justify-between items-center bg-brand text-white">
          <div>
            <h2 className="text-lg font-serif font-bold flex items-center gap-2">
              <Home className="h-5 w-5 text-brand" /> 🏨 Lodging & Room Allocation Builder
            </h2>
            <p className="text-xs text-white/80">{venueName} • Floorplans, suite capacities, and guest cabin allocations</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSave(floors)} className="bg-success hover:bg-success/90 font-bold">
              Save Lodging
            </Button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80" aria-label="Close lodging editor">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Builder Content */}
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_380px] h-full min-h-0 flex-1">
          
          {/* Left Panel: Floor / Room selector */}
          <div className="border-r border-paper-border bg-paper/60 overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl border border-paper-border bg-white p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Floors</h3>
                <Button size="xs" variant="outline" onClick={addFloor}>+ Add Floor</Button>
              </div>
              <div className="space-y-2">
                {floors.map(floor => (
                  <button
                    key={floor.id}
                    onClick={() => {
                      setActiveFloorId(floor.id);
                      setSelectedRoomId(null);
                      setSelectedFurnitureId(null);
                    }}
                    className={[
                      'w-full text-left p-3 rounded-lg border text-xs font-semibold transition-all',
                      activeFloorId === floor.id ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-white border-border hover:bg-surface-2'
                    ].join(' ')}
                  >
                    <div>{floor.name}</div>
                    <div className="text-[10px] text-fg-subtle font-normal mt-1">{floor.width}’ × {floor.height}’ · {floor.rooms.length} rooms</div>
                  </button>
                ))}
              </div>
            </div>

            {activeFloor && (
              <div className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-sm">
                <h3 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Floor settings</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-[10px]">Name</Label>
                    <Input value={activeFloor.name} onChange={(e) => updateActiveFloor({ name: e.target.value })} className="h-8 mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Level</Label>
                    <Input type="number" value={activeFloor.level} onChange={(e) => updateActiveFloor({ level: parseInt(e.target.value) || 1 })} className="h-8 mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Width (ft)</Label>
                    <Input type="number" value={activeFloor.width} onChange={(e) => updateActiveFloor({ width: parseInt(e.target.value) || venueWidth })} className="h-8 mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Height (ft)</Label>
                    <Input type="number" value={activeFloor.height} onChange={(e) => updateActiveFloor({ height: parseInt(e.target.value) || venueHeight })} className="h-8 mt-1 text-xs" />
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-paper-border bg-white p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Rooms</h3>
                <Button size="xs" variant="outline" onClick={addRoom} disabled={!activeFloor}>+ Add Room</Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activeFloor?.rooms.map(room => {
                  const pct = room.capacity > 0 ? Math.round((room.assignedGuests.length / room.capacity) * 100) : 0;
                  return (
                    <button
                      key={room.id}
                      onClick={() => { setSelectedRoomId(room.id); setSelectedFurnitureId(null); }}
                      className={[
                        'w-full text-left p-3 rounded-lg border text-xs font-semibold transition-all space-y-1.5',
                        selectedRoomId === room.id ? 'bg-brand/10 border-brand/40 text-brand' : 'bg-white border-paper-border hover:bg-paper'
                      ].join(' ')}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-bold truncate max-w-[120px]">{room.name}</div>
                        <Badge variant={pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'success'} className="text-[8px] px-1 py-0 uppercase tracking-tight font-black">
                           {pct > 100 ? 'Over' : `${pct}%`}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-fg-subtle font-normal">{room.width}’ × {room.height}’ · {room.assignedGuests.length}/{room.capacity} beds</div>
                      <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", pct > 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                      </div>
                    </button>
                  );
                })}
                {!activeFloor?.rooms.length && <div className="text-xs text-fg-subtle italic text-center py-4">No rooms added yet.</div>}
              </div>
            </div>
          </div>

          {/* Center Panel: Interactive Map grid */}
          <div className="relative bg-paper/40 min-h-0 overflow-auto p-6 flex items-center justify-center border-r border-paper-border">
            {activeFloor && (
              <div
                ref={canvasRef}
                className="relative bg-white border border-paper-border shadow-md rounded-xl overflow-hidden origin-top"
                style={{ width: activeFloor.width * SCALE, height: activeFloor.height * SCALE, transform: `scale(${zoom})` }}
                onClick={() => { setSelectedRoomId(null); setSelectedFurnitureId(null); }}
              >
                {showGrid && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(203,213,225,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(203,213,225,0.4) 1px, transparent 1px)`,
                      backgroundSize: `${gridSize * SCALE}px ${gridSize * SCALE}px`,
                    }}
                  />
                )}

                {activeFloor.rooms.map(room => {
                  const overCapacity = room.assignedGuests.length > room.capacity;
                  return (
                    <div
                      key={room.id}
                      className={cn(
                        "absolute border-2 rounded-lg shadow-sm cursor-move overflow-hidden transition-all duration-150",
                        selectedRoomId === room.id ? "border-brand ring-2 ring-brand/30" : "border-fg-subtle/40",
                        overCapacity ? "border-danger ring-2 ring-danger-soft bg-danger-soft/20" : ""
                      )}
                      style={{
                        left: room.x * SCALE,
                        top: room.y * SCALE,
                        width: room.width * SCALE,
                        height: room.height * SCALE,
                        backgroundColor: room.color || '#E2E8F0',
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedRoomId(room.id);
                        setSelectedFurnitureId(null);
                        if (!canvasRef.current) return;
                        const rect = canvasRef.current.getBoundingClientRect();
                        setDragOffset({
                          x: (e.clientX - rect.left) / SCALE - room.x,
                          y: (e.clientY - rect.top) / SCALE - room.y,
                        });
                        setDraggingRoomId(room.id);
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 bg-white/80 backdrop-blur-xs px-2 py-1 border-b border-black/10 text-[10px] font-bold flex items-center justify-between">
                        <span className="truncate">{room.name}</span>
                        <span className={overCapacity ? "text-danger" : "text-fg-subtle"}>
                          {room.assignedGuests.length}/{room.capacity} {overCapacity ? '⚠️' : ''}
                        </span>
                      </div>

                      {room.furniture?.map(item => {
                        const icon = furnitureCatalog.find(f => f.type === item.type)?.icon || '📦';
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "absolute border rounded-md flex items-center justify-center text-xs cursor-move shadow-sm",
                              selectedFurnitureId === item.id ? "border-brand ring-2 ring-brand/30" : "border-gray-300"
                            )}
                            style={{
                              left: item.x * SCALE,
                              top: item.y * SCALE,
                              width: item.width * SCALE,
                              height: item.height * SCALE,
                              transform: `rotate(${item.rotation}deg)`,
                              backgroundColor: item.color || '#F8FAFC',
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedRoomId(room.id);
                              setSelectedFurnitureId(item.id);
                              if (!canvasRef.current) return;
                              const rect = canvasRef.current.getBoundingClientRect();
                              setDragOffset({
                                x: (e.clientX - rect.left) / SCALE - room.x - item.x,
                                y: (e.clientY - rect.top) / SCALE - room.y - item.y,
                              });
                              setDraggingFurnitureId(item.id);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRoomId(room.id);
                              setSelectedFurnitureId(item.id);
                            }}
                          >
                            <span className="pointer-events-none">{icon}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Grid Controls overlay */}
            <div className="absolute bottom-4 right-4 rounded-xl bg-white shadow-md border border-paper-border p-3 flex gap-3 items-center text-xs">
              <label className="flex items-center gap-1 cursor-pointer font-semibold"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="rounded border-border" /> Grid</label>
              <label className="flex items-center gap-1 cursor-pointer font-semibold"><input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="rounded border-border" /> Snap</label>
              <div className="flex items-center gap-2">
                <Button size="xs" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))}><ZoomOut className="h-3.5 w-3.5" /></Button>
                <span className="font-bold">{Math.round(zoom * 100)}%</span>
                <Button size="xs" variant="ghost" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))}><ZoomIn className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>

          {/* Right Panel: Custom assignment settings */}
          <div className="border-l border-paper-border bg-paper/60 overflow-y-auto p-4 space-y-4">
            {selectedRoom ? (
              <div className="rounded-xl border border-paper-border bg-white overflow-hidden shadow-sm">
                <div className="grid grid-cols-4 border-b border-paper-border text-center text-xs">
                  {[
                    { id: 'room', label: 'Room' },
                    { id: 'guests', label: 'Guests' },
                    { id: 'furniture', label: 'Furniture' },
                    { id: 'item', label: 'Config' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveRightPanelTab(tab.id as any)}
                      className={cn(
                        "py-3 font-semibold transition-all border-b-2",
                        activeRightPanelTab === tab.id ? "bg-brand/5 border-brand text-brand" : "bg-surface-2 border-transparent text-fg-subtle"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-4">
                  {activeRightPanelTab === 'room' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-border">
                        <h4 className="text-xs font-bold text-fg uppercase tracking-wider">Room parameters</h4>
                        <Button size="xs" variant="destructive" onClick={() => deleteRoom(selectedRoom.id)}>Delete Room</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="col-span-2">
                          <Label>Room Title</Label>
                          <Input value={selectedRoom.name} onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label>Width (ft)</Label>
                          <Input type="number" value={selectedRoom.width} onChange={(e) => updateRoom(selectedRoom.id, { width: parseFloat(e.target.value) || 1 })} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label>Height (ft)</Label>
                          <Input type="number" value={selectedRoom.height} onChange={(e) => updateRoom(selectedRoom.id, { height: parseFloat(e.target.value) || 1 })} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label>Max Occupancy</Label>
                          <Input type="number" value={selectedRoom.capacity} onChange={(e) => updateRoom(selectedRoom.id, { capacity: parseInt(e.target.value) || 1 })} className="h-9 mt-1 text-xs" />
                        </div>
                        <div>
                          <Label>Hex Color</Label>
                          <Input value={selectedRoom.color || '#E2E8F0'} onChange={(e) => updateRoom(selectedRoom.id, { color: e.target.value })} className="h-9 mt-1 text-xs" />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRightPanelTab === 'guests' && (() => {
                    const filteredGuests = guests.filter(g => {
                      const isAttending = g.rsvp_status === 'attending';
                      if (!isAttending) return false;
                      const matchesSearch = g.full_name.toLowerCase().includes(lodgingGuestSearch.toLowerCase()) || 
                                           (g.party_name || '').toLowerCase().includes(lodgingGuestSearch.toLowerCase());
                      const matchesParty = lodgingPartyFilter === 'all' || g.party_name === lodgingPartyFilter;
                      return matchesSearch && matchesParty;
                    });

                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-border">
                          <h4 className="text-xs font-bold text-fg uppercase tracking-wider">Lodging Assignment</h4>
                          <span className="text-[11px] font-bold text-brand">{selectedRoom.assignedGuests.length} / {selectedRoom.capacity} Occupied</span>
                        </div>
                        
                        {/* Search & Filter Controls */}
                        <div className="space-y-2">
                          <Input 
                            placeholder="Search guest names..." 
                            value={lodgingGuestSearch}
                            onChange={(e) => setLodgingGuestSearch(e.target.value)}
                            className="h-8 text-xs border-paper-border"
                          />
                          {uniqueParties.length > 0 && (
                            <select
                              value={lodgingPartyFilter}
                              onChange={(e) => setLodgingPartyFilter(e.target.value)}
                              className="w-full h-8 text-xs border border-paper-border bg-white rounded-lg px-2 font-semibold text-fg"
                            >
                              <option value="all">All Groups / Parties</option>
                              {uniqueParties.map(p => (
                                 <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                          {filteredGuests.map(guest => {
                            const assigned = selectedRoom.assignedGuests.includes(guest.id);
                            const disabled = !assigned && selectedRoom.assignedGuests.length >= selectedRoom.capacity;
                            return (
                              <label key={guest.id} className={cn("flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs cursor-pointer hover:border-brand/40 transition-colors", assigned ? "bg-brand-soft/20 border-brand/30" : "bg-white border-border")}>
                                <div>
                                  <div className="font-semibold text-fg">{guest.full_name}</div>
                                  <div className="text-[9px] text-fg-subtle">{guest.party_name || 'Guest Party'}</div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={assigned}
                                  disabled={disabled}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...selectedRoom.assignedGuests, guest.id].slice(0, selectedRoom.capacity)
                                      : selectedRoom.assignedGuests.filter(id => id !== guest.id);
                                    updateRoom(selectedRoom.id, { assignedGuests: next });
                                  }}
                                  className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
                                />
                              </label>
                            );
                          })}
                          {filteredGuests.length === 0 && (
                            <div className="text-center text-xs text-fg-subtle italic py-4">No matching attending guests found</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {activeRightPanelTab === 'furniture' && (
                    <div className="space-y-3">
                      <Input value={searchFurniture} onChange={(e) => setSearchFurniture(e.target.value)} placeholder="Filter library..." className="h-8 text-xs" />
                      <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                        {filteredFurnitureCatalog.map(item => (
                          <button key={item.type} onClick={() => addFurniture(item.type)} className="p-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-left flex items-center gap-2">
                            <span className="text-lg">{item.icon}</span>
                            <div>
                              <div className="text-xs font-bold text-fg">{item.label}</div>
                              <div className="text-[10px] text-fg-subtle">{item.width}’ × {item.height}’</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeRightPanelTab === 'item' && (
                    selectedFurniture ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-border">
                          <h4 className="text-xs font-bold text-fg uppercase tracking-wider">Item details</h4>
                          <Button size="xs" variant="destructive" onClick={() => deleteFurniture(selectedFurniture.id)}>Delete</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="col-span-2">
                            <Label>Item Label</Label>
                            <Input value={selectedFurniture.label || ''} onChange={(e) => updateFurniture(selectedFurniture.id, { label: e.target.value })} className="h-9 mt-1 text-xs" />
                          </div>
                          <div>
                            <Label>Width (ft)</Label>
                            <Input type="number" value={selectedFurniture.width} onChange={(e) => updateFurniture(selectedFurniture.id, { width: parseFloat(e.target.value) || 1 })} className="h-9 mt-1 text-xs" />
                          </div>
                          <div>
                            <Label>Height (ft)</Label>
                            <Input type="number" value={selectedFurniture.height} onChange={(e) => updateFurniture(selectedFurniture.id, { height: parseFloat(e.target.value) || 1 })} className="h-9 mt-1 text-xs" />
                          </div>
                          <div>
                            <Label>Rotation</Label>
                            <Input type="number" value={selectedFurniture.rotation} onChange={(e) => updateFurniture(selectedFurniture.id, { rotation: parseFloat(e.target.value) || 0 })} className="h-9 mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6 text-xs text-fg-subtle italic border border-dashed rounded-lg bg-surface-2/20">
                        Select a furniture item on the canvas to configure parameters.
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-fg-subtle p-6">
                <div>
                  <div className="text-4xl mb-3 text-brand">🏨</div>
                  <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Select a Room</h3>
                  <p className="text-xs text-fg-subtle mt-2 leading-relaxed">Choose a room layout on the map or left list to map suites, lodging, and furniture.</p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
