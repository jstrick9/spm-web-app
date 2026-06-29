import React, { useState } from 'react';
import {
  PenTool,
  Plus,
  Users,
  Maximize2,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { NAVY, GOLD, IVORY, ROSE, FONT_DISPLAY, cardStyle } from '../constants/design';
import {
  PageHeader,
  BtnPrimary,
  BtnSecondary,
  BtnGhost,
  PremiumCard,
  PremiumCardHeader,
  StatusBadge,
  TagChip,
} from '../components/ui/PremiumUI';

type RoomId = 'ballroom' | 'garden' | 'courtyard';

interface Table {
  id: string;
  label: string;
  seats: number;
  assigned: number;
  x: number;
  y: number;
}

interface Room {
  id: RoomId;
  name: string;
  capacity: number;
  tables: Table[];
}

const ROOMS: Room[] = [
  {
    id: 'ballroom',
    name: 'Grand Ballroom',
    capacity: 220,
    tables: [
      { id: 'b1', label: 'Head Table', seats: 12, assigned: 10, x: 50, y: 15 },
      { id: 'b2', label: 'Table 1', seats: 10, assigned: 10, x: 20, y: 40 },
      { id: 'b3', label: 'Table 2', seats: 10, assigned: 8, x: 40, y: 40 },
      { id: 'b4', label: 'Table 3', seats: 10, assigned: 10, x: 60, y: 40 },
      { id: 'b5', label: 'Table 4', seats: 10, assigned: 6, x: 80, y: 40 },
      { id: 'b6', label: 'Table 5', seats: 10, assigned: 10, x: 15, y: 65 },
      { id: 'b7', label: 'Table 6', seats: 10, assigned: 9, x: 35, y: 65 },
      { id: 'b8', label: 'Table 7', seats: 10, assigned: 10, x: 55, y: 65 },
      { id: 'b9', label: 'Table 8', seats: 10, assigned: 7, x: 75, y: 65 },
      { id: 'b10', label: 'Table 9', seats: 10, assigned: 10, x: 25, y: 88 },
      { id: 'b11', label: 'Table 10', seats: 10, assigned: 8, x: 50, y: 88 },
      { id: 'b12', label: 'Table 11', seats: 10, assigned: 10, x: 75, y: 88 },
    ],
  },
  {
    id: 'garden',
    name: 'Garden Pavilion',
    capacity: 140,
    tables: [
      { id: 'g1', label: 'Head Table', seats: 8, assigned: 8, x: 50, y: 20 },
      { id: 'g2', label: 'Table 1', seats: 8, assigned: 7, x: 25, y: 45 },
      { id: 'g3', label: 'Table 2', seats: 8, assigned: 8, x: 50, y: 45 },
      { id: 'g4', label: 'Table 3', seats: 8, assigned: 6, x: 75, y: 45 },
      { id: 'g5', label: 'Table 4', seats: 8, assigned: 8, x: 20, y: 70 },
      { id: 'g6', label: 'Table 5', seats: 8, assigned: 5, x: 40, y: 70 },
      { id: 'g7', label: 'Table 6', seats: 8, assigned: 8, x: 60, y: 70 },
      { id: 'g8', label: 'Table 7', seats: 8, assigned: 7, x: 80, y: 70 },
    ],
  },
  {
    id: 'courtyard',
    name: 'Intimate Courtyard',
    capacity: 80,
    tables: [
      { id: 'c1', label: 'Head Table', seats: 6, assigned: 4, x: 50, y: 25 },
      { id: 'c2', label: 'Table 1', seats: 6, assigned: 6, x: 30, y: 55 },
      { id: 'c3', label: 'Table 2', seats: 6, assigned: 5, x: 50, y: 55 },
      { id: 'c4', label: 'Table 3', seats: 6, assigned: 6, x: 70, y: 55 },
      { id: 'c5', label: 'Table 4', seats: 6, assigned: 4, x: 40, y: 80 },
      { id: 'c6', label: 'Table 5', seats: 6, assigned: 3, x: 60, y: 80 },
    ],
  },
];

export const FloorPlan: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<RoomId>('ballroom');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const room = ROOMS.find((r) => r.id === activeRoom)!;
  const totalAssigned = room.tables.reduce((sum, t) => sum + t.assigned, 0);
  const totalSeats = room.tables.reduce((sum, t) => sum + t.seats, 0);
  const capacityPct = Math.round((totalAssigned / room.capacity) * 100);

  const selected = room.tables.find((t) => t.id === selectedTable);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seating & Layout"
        title="Floor Plan"
        subtitle="Design seating arrangements, manage table assignments, and visualize capacity across venue spaces."
        action={
          <>
            <BtnSecondary icon={Download}>Export PDF</BtnSecondary>
            <BtnPrimary icon={Plus}>New Layout</BtnPrimary>
          </>
        }
      />

      {/* Room tabs */}
      <div className="flex flex-wrap gap-2">
        {ROOMS.map((r) => {
          const assigned = r.tables.reduce((s, t) => s + t.assigned, 0);
          const active = activeRoom === r.id;
          return (
            <button
              key={r.id}
              onClick={() => { setActiveRoom(r.id); setSelectedTable(null); }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={
                active
                  ? { backgroundColor: NAVY, color: IVORY }
                  : { backgroundColor: IVORY, color: NAVY, border: `1px solid ${GOLD}30` }
              }
            >
              {r.name}
              <span
                className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                style={
                  active
                    ? { backgroundColor: `${GOLD}30`, color: GOLD }
                    : { backgroundColor: `${NAVY}08`, color: `${NAVY}60` }
                }
              >
                {assigned}/{r.capacity}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: `${GOLD}15` }}>
            <div className="flex items-center gap-2">
              <PenTool className="h-4 w-4" style={{ color: GOLD }} />
              <span className="text-sm font-medium" style={{ color: NAVY }}>{room.name}</span>
              <StatusBadge variant={capacityPct >= 90 ? 'urgent' : capacityPct >= 70 ? 'pending' : 'confirmed'} label={`${capacityPct}% capacity`} />
            </div>
            <div className="flex items-center gap-1">
              <BtnGhost onClick={() => setZoom((z) => Math.max(60, z - 10))}>
                <ZoomOut className="h-4 w-4" />
              </BtnGhost>
              <span className="text-xs px-2" style={{ color: `${NAVY}60` }}>{zoom}%</span>
              <BtnGhost onClick={() => setZoom((z) => Math.min(150, z + 10))}>
                <ZoomIn className="h-4 w-4" />
              </BtnGhost>
              <BtnGhost onClick={() => setZoom(100)}>
                <RotateCcw className="h-4 w-4" />
              </BtnGhost>
              <BtnGhost>
                <Maximize2 className="h-4 w-4" />
              </BtnGhost>
            </div>
          </div>

          {/* Floor plan canvas */}
          <div
            className="relative aspect-[4/3] min-h-[400px] overflow-hidden"
            style={{ backgroundColor: `${NAVY}04` }}
          >
            {/* Room outline */}
            <div
              className="absolute inset-4 rounded-2xl border-2 border-dashed"
              style={{ borderColor: `${GOLD}30` }}
            />

            {/* Stage / head area label */}
            <div
              className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1 rounded text-[10px] font-semibold uppercase tracking-widest"
              style={{ backgroundColor: `${NAVY}08`, color: `${NAVY}50` }}
            >
              Ceremony / Stage
            </div>

            {/* Dance floor */}
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-24 h-16 rounded-lg flex items-center justify-center text-[10px] font-medium"
              style={{ backgroundColor: `${ROSE}15`, color: '#9A6B55', border: `1px dashed ${ROSE}40` }}
            >
              Dance Floor
            </div>

            {/* Tables */}
            {room.tables.map((table) => {
              const fillPct = table.assigned / table.seats;
              const isSelected = selectedTable === table.id;
              const isFull = fillPct >= 1;
              const isPartial = fillPct > 0 && fillPct < 1;
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table.id)}
                  className="absolute transition-all hover:scale-110 focus:outline-none"
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    transform: `translate(-50%, -50%) scale(${zoom / 100})`,
                  }}
                  aria-label={`${table.label}: ${table.assigned}/${table.seats} seats`}
                >
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-all"
                    style={{
                      backgroundColor: isSelected ? GOLD : isFull ? `${GOLD}25` : isPartial ? `${ROSE}25` : IVORY,
                      color: isSelected ? NAVY : isFull ? '#8B6914' : NAVY,
                      border: isSelected ? `2px solid ${GOLD}` : `2px solid ${isFull ? GOLD : isPartial ? ROSE : `${NAVY}20`}`,
                      boxShadow: isSelected ? `0 0 0 3px ${GOLD}30` : undefined,
                    }}
                  >
                    {table.label.replace('Table ', 'T').replace('Head Table', 'HT')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Capacity bar */}
          <div className="px-5 py-4 border-t" style={{ borderColor: `${GOLD}15` }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: `${NAVY}70` }}>
                <Users className="h-3.5 w-3.5 inline mr-1" style={{ color: GOLD }} />
                {totalAssigned} guests seated · {totalSeats} table seats · {room.capacity} max capacity
              </span>
              <span className="font-semibold" style={{ color: NAVY }}>{capacityPct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${NAVY}10` }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${capacityPct}%`,
                  backgroundColor: capacityPct >= 90 ? ROSE : GOLD,
                }}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {selected ? (
            <PremiumCard>
              <PremiumCardHeader title={selected.label} subtitle="Table details" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: `${GOLD}08` }}>
                    <p className="text-xs" style={{ color: `${NAVY}60` }}>Seats</p>
                    <p className="text-lg font-bold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                      {selected.seats}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: `${GOLD}08` }}>
                    <p className="text-xs" style={{ color: `${NAVY}60` }}>Assigned</p>
                    <p className="text-lg font-bold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                      {selected.assigned}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: `${NAVY}50` }}>
                    Assigned Guests
                  </p>
                  <div className="space-y-2">
                    {Array.from({ length: selected.assigned }, (_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg text-sm"
                        style={{ backgroundColor: 'white', border: `1px solid ${GOLD}15` }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: `${GOLD}20`, color: '#8B6914' }}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span style={{ color: NAVY }}>Guest {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <BtnPrimary className="w-full justify-center">Assign Guests</BtnPrimary>
              </div>
            </PremiumCard>
          ) : (
            <PremiumCard>
              <PremiumCardHeader
                title="Table List"
                subtitle={`${room.tables.length} tables in ${room.name}`}
              />
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {room.tables.map((table) => {
                  const pct = Math.round((table.assigned / table.seats) * 100);
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(table.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors hover:bg-white/60"
                      style={{ border: `1px solid ${GOLD}12` }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: NAVY }}>{table.label}</p>
                        <p className="text-xs" style={{ color: `${NAVY}50` }}>
                          {table.assigned}/{table.seats} seats
                        </p>
                      </div>
                      <TagChip
                        label={`${pct}%`}
                        color={pct >= 100 ? 'gold' : pct >= 50 ? 'rose' : 'navy'}
                      />
                    </button>
                  );
                })}
              </div>
            </PremiumCard>
          )}

          <PremiumCard>
            <PremiumCardHeader title="Layout Tips" />
            <ul className="space-y-2 text-sm" style={{ color: `${NAVY}70` }}>
              <li className="flex gap-2">
                <span style={{ color: GOLD }}>•</span>
                Click any table to view and assign guests
              </li>
              <li className="flex gap-2">
                <span style={{ color: GOLD }}>•</span>
                Gold tables are fully assigned
              </li>
              <li className="flex gap-2">
                <span style={{ color: ROSE }}>•</span>
                Rose tables have partial seating
              </li>
              <li className="flex gap-2">
                <span style={{ color: GOLD }}>•</span>
                Export PDF for catering team
              </li>
            </ul>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
};
