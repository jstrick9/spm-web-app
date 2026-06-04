import { useMemo, useRef, useState } from 'react';
import { Guest, PlacedFixture, PlacedTable, Venue } from '../types';
import { getFixtureTypes, getTableSpecs } from '../hooks/useLayoutState';

export interface GuestPanelProps {
  guests: Guest[];
  tables: PlacedTable[];
  fixtures?: PlacedFixture[];
  venue?: Venue;
  onAddGuest: (name: string, group?: string, tableId?: string) => string;
  onUpdateGuest: (id: string, updates: Partial<Guest>) => void;
  onRemoveGuest: (id: string) => void;
  onAssignToTable: (guestId: string, tableId: string | null) => void;
  onAssignToRoom?: (guestId: string, roomId: string | null) => void;
  onImportCSV: (content: string) => void;
  onExportCSV: () => void;
  onClose: () => void;
  eventName?: string;
  venueName?: string;
}

type ActiveTab = 'guests' | 'assignments' | 'stats';

type AssignmentOption = {
  id: string;
  label: string;
  capacity: number;
  assignedGuests: Guest[];
  available: number;
};

export function GuestPanel({
  guests,
  tables,
  fixtures = [],
  venue,
  onAddGuest,
  onUpdateGuest,
  onRemoveGuest,
  onAssignToTable,
  onAssignToRoom,
  onImportCSV,
  onExportCSV,
  onClose,
  eventName,
  venueName,
}: GuestPanelProps) {
  const isLodging = venue?.category === 'lodging';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableSpecs = getTableSpecs();
  const fixtureTypes = getFixtureTypes();

  const [activeTab, setActiveTab] = useState<ActiveTab>('guests');
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [rsvpFilter, setRsvpFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>('all');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestGroup, setNewGuestGroup] = useState('');

  const lodgingRoomFixtures = useMemo<AssignmentOption[]>(() => {
    if (!isLodging) return [];
    return fixtures
      .filter(f => {
        const spec = fixtureTypes.find(s => s.id === f.specId);
        return spec?.category === 'lodging' && (spec?.lodgingType === 'rooms' || spec?.isRoom);
      })
      .map(f => {
        const spec = fixtureTypes.find(s => s.id === f.specId)!;
        const capacity = f.customCapacity ?? spec.capacity ?? 0;
        const assignedGuests = guests.filter(g => g.roomId === f.id);
        return {
          id: f.id,
          label: f.label || spec.name,
          capacity,
          assignedGuests,
          available: Math.max(0, capacity - assignedGuests.length),
        };
      });
  }, [isLodging, fixtures, fixtureTypes, guests]);

  const legacyRooms = useMemo<AssignmentOption[]>(() => {
    if (!isLodging || !venue?.rooms) return [];
    return venue.rooms.map(room => {
      const assignedGuests = guests.filter(g => g.roomId === room.id);
      return {
        id: room.id,
        label: room.name || room.label || 'Unnamed Room',
        capacity: room.capacity || 0,
        assignedGuests,
        available: Math.max(0, (room.capacity || 0) - assignedGuests.length),
      };
    });
  }, [isLodging, venue?.rooms, guests]);

  const tableAssignments = useMemo<AssignmentOption[]>(() => {
    if (isLodging) {
      return [...legacyRooms, ...lodgingRoomFixtures];
    }
    return tables.map(table => {
      const spec = tableSpecs.find(s => s.id === table.specId);
      const isSeatingType = !!spec?.isSeatingType;
      const perRow = table.chairCount ?? table.customCapacity ?? spec?.capacity ?? 0;
      const rowCount = isSeatingType ? Math.max(1, spec?.seatingRowCount || 1) : 1;
      const capacity = isSeatingType ? perRow * rowCount : (table.customCapacity ?? spec?.capacity ?? 0);
      const assignedGuests = guests.filter(g => g.tableId === table.id);
      return {
        id: table.id,
        label: table.label,
        capacity,
        assignedGuests,
        available: Math.max(0, capacity - assignedGuests.length),
      };
    });
  }, [isLodging, legacyRooms, lodgingRoomFixtures, tables, tableSpecs, guests]);

  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      const matchesSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.group?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.phone?.includes(q);

      const isAssigned = isLodging ? Boolean(g.roomId) : Boolean(g.tableId);
      const matchesAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'assigned' ? isAssigned : !isAssigned);

      const normalizedRsvp = (g.rsvpStatus || 'pending') as 'confirmed' | 'pending' | 'declined';
      const matchesRsvp = rsvpFilter === 'all' || normalizedRsvp === rsvpFilter;

      return matchesSearch && matchesAssignment && matchesRsvp;
    });
  }, [guests, search, isLodging, assignmentFilter, rsvpFilter]);

  const unassignedGuests = useMemo(() => {
    return guests.filter(g => (isLodging ? !g.roomId : !g.tableId));
  }, [guests, isLodging]);

  const stats = useMemo(() => {
    const confirmed = guests.filter(g => g.rsvpStatus === 'confirmed').length;
    const pending = guests.filter(g => (g.rsvpStatus || 'pending') === 'pending').length;
    const declined = guests.filter(g => g.rsvpStatus === 'declined').length;
    const seated = guests.filter(g => (isLodging ? g.roomId : g.tableId)).length;
    const totalCapacity = tableAssignments.reduce((sum, t) => sum + t.capacity, 0);
    return {
      total: guests.length,
      confirmed,
      pending,
      declined,
      assigned: seated,
      unassigned: guests.length - seated,
      totalCapacity,
      available: Math.max(0, totalCapacity - seated),
    };
  }, [guests, isLodging, tableAssignments]);

  const handleQuickAssign = (guestId: string, destinationId: string) => {
    if (isLodging && onAssignToRoom) {
      onAssignToRoom(guestId, destinationId || null);
    } else {
      onAssignToTable(guestId, destinationId || null);
    }
  };

  const handleAddGuest = () => {
    if (!newGuestName.trim()) return;
    onAddGuest(newGuestName.trim(), newGuestGroup.trim() || undefined);
    setNewGuestName('');
    setNewGuestGroup('');
    setShowAdd(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      onImportCSV(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#4A1942] to-[#3d1a45] text-white rounded-t-xl">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">👥 Guest Management</h2>
              <p className="text-sm text-white/70">
                {stats.total} guests • {stats.confirmed} confirmed • {stats.assigned} assigned
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">✕</button>
          </div>
          {(eventName || venueName) && (
            <div className="px-4 pb-4">
              <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-3 text-sm text-white/90 flex flex-wrap gap-3">
                {eventName && (
                  <span className="inline-flex items-center gap-1">
                    <span>💍</span>
                    <strong>Event:</strong> {eventName}
                  </span>
                )}
                {venueName && (
                  <span className="inline-flex items-center gap-1">
                    <span>{isLodging ? '🛏️' : '🏛️'}</span>
                    <strong>{isLodging ? 'Lodging venue' : 'Venue'}:</strong> {venueName}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <span>📍</span>
                  <strong>Mode:</strong> {isLodging ? 'Room assignments' : 'Table assignments'}
                </span>
              </div>
            </div>
          )}
          <div className="flex border-t border-white/20">
            {[
              { id: 'guests', label: 'Guest List', icon: '👥' },
              { id: 'assignments', label: isLodging ? 'Rooms' : 'Tables', icon: isLodging ? '🛏️' : '🪑' },
              { id: 'stats', label: 'Statistics', icon: '📊' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-[#4A1942]' : 'text-white/80 hover:bg-white/10'}`}
              >
                <span className="mr-1">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'guests' && (
          <>
            <div className="p-3 border-b bg-gray-50 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search guests by name, party, email, or phone..."
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
                <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#5c2a54]">➕ Add Guest</button>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-100">📥 Import</button>
                <button onClick={onExportCSV} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-100">📤 Export</button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-gray-500">Assignment</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'assigned', label: isLodging ? 'Assigned to rooms' : 'Assigned to tables' },
                  { id: 'unassigned', label: isLodging ? 'Unassigned rooms' : 'Unassigned seats' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setAssignmentFilter(filter.id as typeof assignmentFilter)}
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      assignmentFilter === filter.id
                        ? 'bg-[#4A1942] text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="ml-2 font-medium text-gray-500">RSVP</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'confirmed', label: 'Confirmed' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'declined', label: 'Declined' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setRsvpFilter(filter.id as typeof rsvpFilter)}
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      rsvpFilter === filter.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="ml-auto text-gray-500">
                  Showing <strong>{filteredGuests.length}</strong> of {guests.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto divide-y">
              {filteredGuests.map(guest => (
                <div key={guest.id} className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${selectedGuestId === guest.id ? 'bg-purple-50' : ''}`}>
                  <button onClick={() => setSelectedGuestId(guest.id)} className="text-left flex-1 min-w-0">
                    <div className="font-medium truncate">{guest.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {guest.group ? `📁 ${guest.group}` : 'No group'}
                      {guest.email ? ` • ✉️ ${guest.email}` : ''}
                    </div>
                  </button>
                  <div className="w-36">
                    <select
                      value={isLodging ? (guest.roomId || '') : (guest.tableId || '')}
                      onChange={(e) => handleQuickAssign(guest.id, e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs"
                    >
                      <option value="">{isLodging ? 'Unassigned Room' : 'Unseated'}</option>
                      {tableAssignments.map(dest => (
                        <option key={dest.id} value={dest.id} disabled={dest.available <= 0 && (isLodging ? guest.roomId : guest.tableId) !== dest.id}>
                          {dest.label} ({dest.assignedGuests.length}/{dest.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => onRemoveGuest(guest.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Delete guest">🗑️</button>
                </div>
              ))}
              {filteredGuests.length === 0 && (
                <div className="text-center text-gray-400 py-12">No guests found.</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'assignments' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-700">{isLodging ? '🛏️ Unassigned Guests' : '🪑 Unseated Guests'}</h3>
                  <span className="text-sm bg-gray-200 px-2 py-1 rounded">{unassignedGuests.length}</span>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-auto">
                  {unassignedGuests.map(guest => (
                    <div key={guest.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100">
                      <span className="truncate">{guest.name}</span>
                      <select onChange={(e) => handleQuickAssign(guest.id, e.target.value)} className="px-2 py-1 border rounded text-xs" defaultValue="">
                        <option value="">Assign to...</option>
                        {tableAssignments.filter(t => t.available > 0).map(dest => (
                          <option key={dest.id} value={dest.id}>{dest.label} ({dest.assignedGuests.length}/{dest.capacity})</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {unassignedGuests.length === 0 && <p className="text-center text-gray-400 py-4">All guests are assigned! 🎉</p>}
                </div>
              </div>

              {tableAssignments.map(dest => (
                <div key={dest.id} className={`border rounded-lg p-4 ${dest.available === 0 ? 'bg-green-50 border-green-200' : dest.available < 3 ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">{dest.label}</h3>
                    <span className={`text-sm px-2 py-1 rounded ${dest.available === 0 ? 'bg-green-200 text-green-800' : dest.available < 3 ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200'}`}>
                      {dest.assignedGuests.length}/{dest.capacity}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{dest.available} space{dest.available !== 1 ? 's' : ''} available</div>
                  <div className="space-y-1 max-h-[220px] overflow-auto">
                    {dest.assignedGuests.map(guest => (
                      <div key={guest.id} className="flex items-center justify-between p-1.5 bg-white rounded border text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-2 h-2 rounded-full ${guest.rsvpStatus === 'confirmed' ? 'bg-green-500' : guest.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                          <span className="truncate">{guest.name}</span>
                        </div>
                        <button onClick={() => handleQuickAssign(guest.id, '')} className="text-gray-400 hover:text-red-500 p-1" title="Remove assignment">✕</button>
                      </div>
                    ))}
                    {dest.assignedGuests.length === 0 && <p className="text-center text-gray-400 py-2 text-sm">No guests assigned</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Guests', value: stats.total, icon: '👥', color: 'bg-blue-100 text-blue-800' },
                { label: 'Confirmed', value: stats.confirmed, icon: '✅', color: 'bg-green-100 text-green-800' },
                { label: 'Pending', value: stats.pending, icon: '⏳', color: 'bg-yellow-100 text-yellow-800' },
                { label: 'Declined', value: stats.declined, icon: '❌', color: 'bg-red-100 text-red-800' },
                { label: isLodging ? 'Assigned to Rooms' : 'Seated', value: stats.assigned, icon: isLodging ? '🛏️' : '🪑', color: 'bg-purple-100 text-purple-800' },
                { label: isLodging ? 'Unassigned' : 'Unseated', value: stats.unassigned, icon: '🚶', color: 'bg-gray-100 text-gray-800' },
                { label: 'Total Capacity', value: stats.totalCapacity, icon: '📊', color: 'bg-indigo-100 text-indigo-800' },
                { label: 'Available', value: stats.available, icon: '💺', color: 'bg-teal-100 text-teal-800' },
              ].map(stat => (
                <div key={stat.label} className={`p-4 rounded-lg ${stat.color}`}>
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm opacity-80">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(showAdd || selectedGuestId) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10001 }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="p-4 border-b bg-gradient-to-r from-[#4A1942] to-[#3d1a45] text-white rounded-t-xl flex justify-between items-center">
                <h3 className="font-bold">{showAdd ? 'Add New Guest' : 'Edit Guest'}</h3>
                <button onClick={() => { setShowAdd(false); setSelectedGuestId(null); }} className="p-1 hover:bg-white/20 rounded">✕</button>
              </div>
              {showAdd ? (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group</label>
                    <input value={newGuestGroup} onChange={(e) => setNewGuestGroup(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                    <button onClick={handleAddGuest} className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a54]">Add Guest</button>
                  </div>
                </div>
              ) : (() => {
                const editingGuest = guests.find(g => g.id === selectedGuestId) || null;
                if (!editingGuest) return null;
                return (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input value={editingGuest.name} onChange={(e) => onUpdateGuest(editingGuest.id, { name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Group</label>
                      <input value={editingGuest.group || ''} onChange={(e) => onUpdateGuest(editingGuest.id, { group: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{isLodging ? 'Room Assignment' : 'Table Assignment'}</label>
                      <select
                        value={isLodging ? (editingGuest.roomId || '') : (editingGuest.tableId || '')}
                        onChange={(e) => handleQuickAssign(editingGuest.id, e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">{isLodging ? 'Unassigned' : 'Unseated'}</option>
                        {tableAssignments.map(dest => (
                          <option key={dest.id} value={dest.id}>{dest.label} ({dest.assignedGuests.length}/{dest.capacity})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={() => setSelectedGuestId(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Done</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
