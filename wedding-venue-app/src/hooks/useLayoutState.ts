import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PlacedTable,
  PlacedFixture,
  PlacedDecor,
  Venue,
  Guest,
  Layout,
  TableSpec,
  FixtureType,
  Guideline,
  LayoutTemplate,
  User,
  DecorItem,
  DecorCategoryDef,
  DecorArrangement,
  DecorPackage,
  ChairSpec,
} from '../types';
import {
  defaultVenues,
  defaultTableSpecs,
  defaultFixtureTypes,
  defaultGuidelines,
  defaultLayoutTemplates,
  defaultUsers,
  defaultLinenColors,
  LinenColor,
  defaultChairSpecs,
  loadFromStorage,
  saveToStorage,
} from '../data/venueData';
import {
  getSavedLayoutDocuments,
  setSavedLayoutDocuments,
} from '../utils/collaboration';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { emitDataChanged, on } from '../utils/appEvents';

// Position type
export interface Position {
  x: number;
  y: number;
}

// Validation warning type
export interface ValidationWarning {
  id: string;
  type: 'overlap' | 'capacity' | 'spacing' | 'accessibility';
  message: string;
  itemIds: string[];
}

// Saved layout type (user layouts)
export interface SavedLayout {
  id: string;
  name: string;
  venueId: string;
  tables: PlacedTable[];
  fixtures: PlacedFixture[];
  decor: PlacedDecor[];
  guests: Guest[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// Storage keys
const STORAGE = {
  VENUES: STORAGE_KEYS.VENUES,
  TABLE_SPECS: STORAGE_KEYS.TABLE_SPECS,
  FIXTURE_TYPES: STORAGE_KEYS.FIXTURE_TYPES,
  GUIDELINES: STORAGE_KEYS.GUIDELINES,
  TEMPLATES: STORAGE_KEYS.TEMPLATES,
  USERS: STORAGE_KEYS.USERS,
  SAVED_LAYOUTS: STORAGE_KEYS.SAVED_LAYOUTS,
  CONFIG: STORAGE_KEYS.CONFIG,
  LINEN_COLORS: STORAGE_KEYS.LINEN_COLORS,
  DECOR_ITEMS: STORAGE_KEYS.DECOR_ITEMS,
  DECOR_CATEGORIES: STORAGE_KEYS.DECOR_CATEGORIES,
  DECOR_ARRANGEMENTS: STORAGE_KEYS.DECOR_ARRANGEMENTS,
  DECOR_PACKAGES: STORAGE_KEYS.DECOR_PACKAGES,
};

// Safe fallback venue so the app never crashes when there are no venues configured yet.
const FALLBACK_VENUE: Venue = {
  id: 'setup-venue',
  name: 'New Venue',
  category: 'reception',
  width: 60,
  height: 40,
  capacity: 150,
  color: '#FFFFFF',
  borderColor: '#4A1942',
  borderWidth: 2,
  pattern: 'solid',
  shape: 'rectangle',
  isMaster: true,
  canvasWidth: 100,
  canvasHeight: 80,
  venueX: 20,
  venueY: 20,
  exteriorPadding: { top: 20, right: 20, bottom: 20, left: 20 },
};


function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

// Data access functions
export function getVenues(): Venue[] {
  const venues = loadFromStorage(STORAGE.VENUES, defaultVenues) as Venue[];
  return venues.length > 0 ? venues : [FALLBACK_VENUE];
}

export function setVenues(venues: Venue[]): void {
  saveToStorage(STORAGE.VENUES, venues);
  emitDataChanged('venues');
}

export function getTableSpecs(): TableSpec[] {
  return loadFromStorage(STORAGE.TABLE_SPECS, defaultTableSpecs);
}

export function setTableSpecs(specs: TableSpec[]): void {
  saveToStorage(STORAGE.TABLE_SPECS, specs);
  emitDataChanged('tableSpecs');
}

export function getFixtureTypes(): FixtureType[] {
  return loadFromStorage(STORAGE.FIXTURE_TYPES, defaultFixtureTypes);
}

export function setFixtureTypes(types: FixtureType[]): void {
  saveToStorage(STORAGE.FIXTURE_TYPES, types);
  emitDataChanged('fixtureTypes');
}

export function getGuidelines(): Guideline[] {
  return loadFromStorage(STORAGE.GUIDELINES, defaultGuidelines);
}

export function setGuidelines(guidelines: Guideline[]): void {
  saveToStorage(STORAGE.GUIDELINES, guidelines);
  emitDataChanged('guidelines');
}

export function getTemplates(): LayoutTemplate[] {
  return loadFromStorage(STORAGE.TEMPLATES, defaultLayoutTemplates);
}

export function setTemplates(templates: LayoutTemplate[]): void {
  saveToStorage(STORAGE.TEMPLATES, templates);
  emitDataChanged('templates');
}

export function getUsers(): User[] {
  return loadFromStorage(STORAGE.USERS, defaultUsers);
}

export function setUsers(users: User[]): void {
  saveToStorage(STORAGE.USERS, users);
}

export function getSavedLayouts(): SavedLayout[] {
  return getSavedLayoutDocuments().map(
    ({ revision, lastModifiedBy, lastModifiedByName, ...layout }) => ({
      ...layout,
      decor: Array.isArray(layout.decor) ? layout.decor : [],
    }),
  );
}

export function setSavedLayouts(layouts: SavedLayout[]): void {
  const existingDocs = getSavedLayoutDocuments();

  const nextDocs = layouts.map((layout) => {
    const existing = existingDocs.find((doc) => doc.id === layout.id);

    return {
      ...layout,
      decor: Array.isArray(layout.decor) ? layout.decor : [],
      revision: existing?.revision ?? 1,
      lastModifiedBy: existing?.lastModifiedBy,
      lastModifiedByName: existing?.lastModifiedByName,
    };
  });

  setSavedLayoutDocuments(nextDocs);
}

export function getChairSpecsFromLayout(): ChairSpec[] {
  return loadFromStorage(STORAGE_KEYS.CHAIR_SPECS_LEGACY, defaultChairSpecs);
}

export function setChairSpecsInLayout(specs: ChairSpec[]): void {
  saveToStorage(STORAGE_KEYS.CHAIR_SPECS_LEGACY, specs);
  emitDataChanged('chairSpecs');
}

export function getLinenColors(): LinenColor[] {
  return loadFromStorage(STORAGE.LINEN_COLORS, defaultLinenColors);
}

export function setLinenColors(colors: LinenColor[]): void {
  saveToStorage(STORAGE.LINEN_COLORS, colors);
  emitDataChanged('linenColors');
}

export function getDecorItems(): DecorItem[] {
  const items = loadFromStorage(STORAGE.DECOR_ITEMS, []) as DecorItem[];
  return Array.isArray(items) ? items : [];
}

export function setDecorItems(items: DecorItem[]): void {
  saveToStorage(STORAGE.DECOR_ITEMS, items);
  emitDataChanged('decorItems');
}

export function getDecorCategories(): DecorCategoryDef[] {
  return loadFromStorage(STORAGE.DECOR_CATEGORIES, []) as DecorCategoryDef[];
}

export function setDecorCategories(categories: DecorCategoryDef[]): void {
  saveToStorage(STORAGE.DECOR_CATEGORIES, categories);
  emitDataChanged('decorCategories');
}

export function getDecorArrangements(): DecorArrangement[] {
  return loadFromStorage(STORAGE.DECOR_ARRANGEMENTS, []) as DecorArrangement[];
}

export function setDecorArrangements(arrangements: DecorArrangement[]): void {
  saveToStorage(STORAGE.DECOR_ARRANGEMENTS, arrangements);
  emitDataChanged('decorArrangements');
}

export function getDecorPackages(): DecorPackage[] {
  return loadFromStorage(STORAGE.DECOR_PACKAGES, []) as DecorPackage[];
}

export function setDecorPackages(packages: DecorPackage[]): void {
  saveToStorage(STORAGE.DECOR_PACKAGES, packages);
  emitDataChanged('decorPackages');
}

export function resetToDefaults(): void {
  saveToStorage(STORAGE.VENUES, defaultVenues);
  saveToStorage(STORAGE.TABLE_SPECS, defaultTableSpecs);
  saveToStorage(STORAGE.FIXTURE_TYPES, defaultFixtureTypes);
  saveToStorage(STORAGE.GUIDELINES, defaultGuidelines);
  saveToStorage(STORAGE.TEMPLATES, defaultLayoutTemplates);
  saveToStorage(STORAGE.USERS, defaultUsers);
  saveToStorage(STORAGE.LINEN_COLORS, defaultLinenColors);
  saveToStorage(STORAGE.DECOR_ITEMS, []);
  emitDataChanged('all');
}

// Create initial layout
function createInitialLayout(venueId: string): Layout {
  return {
    id: `layout-${Date.now()}`,
    name: 'Untitled Layout',
    venueId,
    tables: [],
    fixtures: [],
    decor: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Main hook
export function useLayoutState(initialVenueId: string = 'setup-venue') {
  const [venues, setVenuesState] = useState<Venue[]>(() => getVenues());
  const [currentVenue, setCurrentVenue] = useState<Venue>(() => {
    const allVenues = getVenues();
    return allVenues.find((v) => v.id === initialVenueId) || allVenues[0] || FALLBACK_VENUE;
  });

  const [layout, setLayout] = useState<Layout>(() => {
    const allVenues = getVenues();
    const initialVenue =
      allVenues.find((v) => v.id === initialVenueId) || allVenues[0] || FALLBACK_VENUE;
    return createInitialLayout(initialVenue.id);
  });

  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  // Track venue change for reset
  const venueChangeCallback = useRef<(() => void) | null>(null);

  // Set venue change callback
  const setOnVenueChange = useCallback((callback: () => void) => {
    venueChangeCallback.current = callback;
  }, []);

  // Listen for data changes from AdminPanel
  useEffect(() => {
    const handleDataChange = (detail: { type: string } | void) => {
      const type = detail?.type;

      if (type === 'venues' || type === 'all') {
        const allVenues = getVenues();
        setVenuesState(allVenues);

        const updatedVenue = allVenues.find((v) => v.id === currentVenue.id);
        if (updatedVenue) {
          setCurrentVenue(updatedVenue);
        } else {
          setCurrentVenue(allVenues[0] || FALLBACK_VENUE);
        }
      }
    };

    return on('spm_data_changed', handleDataChange);
  }, [currentVenue.id]);

  // Refresh venues from storage
  const refreshVenues = useCallback(() => {
    const allVenues = getVenues();
    setVenuesState(allVenues);

    const updated = allVenues.find((v) => v.id === currentVenue.id);
    if (updated) {
      setCurrentVenue(updated);
    } else {
      setCurrentVenue(allVenues[0] || FALLBACK_VENUE);
    }
  }, [currentVenue.id]);

  // Change venue - ROBUST VERSION: Always works regardless of admin changes
  const changeVenue = useCallback((venueId: string) => {
    try {
      const allVenues = getVenues();
      const venue = allVenues.find((v) => v.id === venueId);

      if (!venue) {
        console.error('Venue not found:', venueId);
        return;
      }

      setVenuesState([...allVenues]);
      setCurrentVenue({ ...venue });

      const masterTables = venue.masterLayout?.tables || [];
      const masterFixtures = venue.masterLayout?.fixtures || [];
      const masterDecor = venue.masterLayout?.decor || [];

      const newLayout: Layout = {
        id: `layout-${Date.now()}`,
        name: 'Untitled Layout',
        venueId,
        tables: masterTables.map((t) => ({
          ...t,
          id: `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
        fixtures: masterFixtures.map((f) => ({
          ...f,
          id: `fixture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
        decor: masterDecor.map((d) => ({
          ...d,
          id: `decor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setLayout(newLayout);
      setSelectedId(null);
      setWarnings([]);

      if (venueChangeCallback.current) {
        setTimeout(() => {
          try {
            venueChangeCallback.current?.();
          } catch (err) {
            console.error('Error in venue change callback:', err);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error changing venue:', error);
    }
  }, []);

  // Add table
  const addTable = useCallback(
    (specId: string, position: Position) => {
      const specs = getTableSpecs();
      const spec = specs.find((s) => s.id === specId);
      if (!spec) return;

      const tableCount = layout.tables.filter((t) => t.specId === specId).length;
      const newTable: PlacedTable = {
        id: `table-${Date.now()}`,
        type: 'table',
        specId,
        x: position.x,
        y: position.y,
        rotation: 0,
        label: `${spec.name.split(' ')[0]} ${tableCount + 1}`,
        guests: [],
        hasLinen: spec.isSeatingType ? false : true,
        linenColor: 'white',
        showChairs: true,
        chairType: spec.defaultChairType || 'white-plastic',
        chairCount: spec.capacity,
        chairLayout: spec.defaultChairLayout || 'all-sides',
      };

      setLayout((prev) => ({
        ...prev,
        tables: [...prev.tables, newTable],
        updatedAt: new Date().toISOString(),
      }));
      setSelectedId(newTable.id);
    },
    [layout.tables],
  );

  // Add fixture
  const addFixture = useCallback(
    (specId: string, position: Position, isExterior?: boolean) => {
      const fixtures = getFixtureTypes();
      const spec = fixtures.find((f) => f.id === specId);
      if (!spec) return;

      const fixtureCount = layout.fixtures.filter((f) => f.specId === specId).length;
      const newFixture: PlacedFixture = {
        id: `fixture-${Date.now()}`,
        type: 'fixture',
        specId,
        x: position.x,
        y: position.y,
        rotation: 0,
        label: fixtureCount > 0 ? `${spec.name} ${fixtureCount + 1}` : spec.name,
        isExterior: isExterior || spec.isExterior,
      };

      setLayout((prev) => ({
        ...prev,
        fixtures: [...prev.fixtures, newFixture],
        updatedAt: new Date().toISOString(),
      }));
      setSelectedId(newFixture.id);
    },
    [layout.fixtures],
  );

  // Update table
  const updateTable = useCallback((id: string, updates: Partial<PlacedTable>) => {
    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Update fixture
  const updateFixture = useCallback((id: string, updates: Partial<PlacedFixture>) => {
    setLayout((prev) => ({
      ...prev,
      fixtures: prev.fixtures.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Add decor
  const addDecor = useCallback(
    (
      decorItemId: string,
      position: Position,
      parentId?: string,
      parentType: any = 'canvas',
    ) => {
      const items = getDecorItems();
      const spec = items.find((i) => i.id === decorItemId);
      if (!spec) return;

      const newDecor: any = {
        id: `decor-${Date.now()}`,
        decorItemId,
        x: position.x,
        y: position.y,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        zIndex: 100 + layout.decor.length,
        parentType,
        parentId,
      };

      setLayout((prev) => ({
        ...prev,
        decor: [...prev.decor, newDecor],
        updatedAt: new Date().toISOString(),
      }));
      setSelectedId(newDecor.id);
    },
    [layout.decor],
  );

  // Update decor
  const updateDecor = useCallback((id: string, updates: Partial<any>) => {
    setLayout((prev) => ({
      ...prev,
      decor: prev.decor.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Remove item
  const removeItem = useCallback(
    (id: string) => {
      setLayout((prev) => ({
        ...prev,
        tables: prev.tables.filter((t) => t.id !== id),
        fixtures: prev.fixtures.filter((f) => f.id !== id),
        decor: prev.decor.filter((d) => d.id !== id),
        updatedAt: new Date().toISOString(),
      }));

      if (selectedId === id) {
        setSelectedId(null);
      }
    },
    [selectedId],
  );

  // Duplicate item
  const duplicateItem = useCallback(
    (id: string) => {
      const table = layout.tables.find((t) => t.id === id);
      if (table) {
        const newTable: PlacedTable = {
          ...table,
          id: `table-${Date.now()}`,
          x: table.x + 3,
          y: table.y + 3,
          label: `${table.label} Copy`,
          guests: [],
        };

        setLayout((prev) => ({
          ...prev,
          tables: [...prev.tables, newTable],
          updatedAt: new Date().toISOString(),
        }));
        setSelectedId(newTable.id);
        return;
      }

      const fixture = layout.fixtures.find((f) => f.id === id);
      if (fixture) {
        const newFixture: PlacedFixture = {
          ...fixture,
          id: `fixture-${Date.now()}`,
          x: fixture.x + 3,
          y: fixture.y + 3,
          label: `${fixture.label} Copy`,
        };

        setLayout((prev) => ({
          ...prev,
          fixtures: [...prev.fixtures, newFixture],
          updatedAt: new Date().toISOString(),
        }));
        setSelectedId(newFixture.id);
      }
    },
    [layout.tables, layout.fixtures],
  );

  // Add guest
  const addGuest = useCallback((name: string, group?: string, tableId?: string): string => {
    const newGuest: Guest = {
      id: `guest-${Date.now()}`,
      name,
      group,
      tableId,
      rsvpStatus: 'pending',
    };

    setGuests((prev) => [...prev, newGuest]);

    if (tableId) {
      setLayout((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, guests: [...t.guests, newGuest.id] } : t,
        ),
        updatedAt: new Date().toISOString(),
      }));
    }

    return newGuest.id;
  }, []);

  // Update guest
  const updateGuest = useCallback((id: string, updates: Partial<Guest>) => {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }, []);

  // Remove guest
  const removeGuest = useCallback((id: string) => {
    setGuests((prev) => prev.filter((g) => g.id !== id));

    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => ({
        ...t,
        guests: t.guests.filter((gId) => gId !== id),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Assign guest to table
  const assignGuestToTable = useCallback((guestId: string, tableId: string | null) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, tableId: tableId || undefined } : g)),
    );

    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (tableId && t.id === tableId) {
          return { ...t, guests: [...t.guests.filter((id) => id !== guestId), guestId] };
        }

        return { ...t, guests: t.guests.filter((id) => id !== guestId) };
      }),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Assign guest to lodging room fixture or legacy venue room
  const assignGuestToRoom = useCallback((guestId: string, roomId: string | null) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === guestId
          ? { ...g, roomId: roomId || undefined, tableId: undefined }
          : g,
      ),
    );

    setLayout((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => ({
        ...t,
        guests: t.guests.filter((id) => id !== guestId),
      })),
      fixtures: prev.fixtures.map((f) => {
        const spec = getFixtureTypes().find((s) => s.id === f.specId);
        const isRoomFixture =
          spec?.category === 'lodging' && (spec?.lodgingType === 'rooms' || spec?.isRoom);

        if (!isRoomFixture) return f;

        const currentGuests = f.guests || [];

        if (roomId && f.id === roomId) {
          return {
            ...f,
            guests: [...currentGuests.filter((id) => id !== guestId), guestId],
          };
        }

        return {
          ...f,
          guests: currentGuests.filter((id) => id !== guestId),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Import guests from CSV
  const importGuestsFromCSV = useCallback((csvText: string) => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return;

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const nameIndex = headers.findIndex((h) => h.includes('name'));
    const groupIndex = headers.findIndex((h) => h.includes('group') || h.includes('party'));

    if (nameIndex === -1) {
      alert('CSV must have a "name" column');
      return;
    }

    const newGuests: Guest[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const name = values[nameIndex];
      if (name) {
        newGuests.push({
          id: `guest-${Date.now()}-${i}`,
          name,
          group: groupIndex >= 0 ? values[groupIndex] : undefined,
          rsvpStatus: 'pending' as const,
        });
      }
    }

    setGuests((prev) => [...prev, ...newGuests]);
  }, []);

  // Export guests to CSV
  const exportGuestsToCSV = useCallback(() => {
    const headers = ['Name', 'Group', 'Table', 'Dietary Restrictions', 'Accessibility', 'RSVP'];
    const rows = guests.map((g) => {
      const table = layout.tables.find((t) => t.guests.includes(g.id));
      return [
        g.name,
        g.group || '',
        table?.label || 'Unassigned',
        g.dietaryRestrictions || '',
        g.accessibility ? 'Yes' : 'No',
        g.rsvpStatus || 'pending',
      ].map(csvEscape).join(',');
    });

    const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guest-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [guests, layout.tables]);

  // Clear layout
  const clearLayout = useCallback(() => {
    if (confirm('Clear all tables and fixtures from this layout?')) {
      setLayout((prev) => ({
        ...prev,
        tables: [],
        fixtures: [],
        updatedAt: new Date().toISOString(),
      }));
      setSelectedId(null);
    }
  }, []);

  // Save layout
  const saveLayout = useCallback(
    (name: string) => {
      const savedLayouts = getSavedLayouts();

      const newLayout: SavedLayout = {
        id: `saved-${Date.now()}`,
        name,
        venueId: currentVenue.id,
        tables: layout.tables,
        fixtures: layout.fixtures,
        decor: layout.decor,
        guests,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSavedLayouts([...savedLayouts, newLayout]);
      return newLayout.id;
    },
    [currentVenue.id, layout.tables, layout.fixtures, layout.decor, guests],
  );

  // Load layout
  const loadLayout = useCallback((layoutId: string) => {
    const savedLayouts = getSavedLayouts();
    const savedLayout = savedLayouts.find((l) => l.id === layoutId);

    if (savedLayout) {
      const allVenues = getVenues();
      const venue = allVenues.find((v) => v.id === savedLayout.venueId);

      if (venue) {
        setCurrentVenue(venue);
        setVenuesState(allVenues);
      }

      setLayout({
        id: `layout-${Date.now()}`,
        name: savedLayout.name,
        venueId: savedLayout.venueId,
        tables: savedLayout.tables,
        fixtures: savedLayout.fixtures,
        decor: savedLayout.decor || [],
        createdAt: savedLayout.createdAt,
        updatedAt: new Date().toISOString(),
      });

      setGuests(savedLayout.guests || []);
      setSelectedId(null);

      if (venueChangeCallback.current) {
        setTimeout(() => venueChangeCallback.current?.(), 100);
      }
    }
  }, []);

  // Delete saved layout
  const deleteSavedLayout = useCallback((layoutId: string) => {
    const savedLayouts = getSavedLayouts();
    setSavedLayouts(savedLayouts.filter((l) => l.id !== layoutId));
  }, []);

  // Load template
  const loadTemplate = useCallback((template: LayoutTemplate) => {
    const allVenues = getVenues();
    const venue = allVenues.find((v) => v.id === template.venueId);

    if (venue) {
      setCurrentVenue(venue);
      setVenuesState(allVenues);

      setLayout({
        id: `layout-${Date.now()}`,
        name: template.name,
        venueId: template.venueId,
        tables: (template.tables || []).map((t) => ({
          ...t,
          id: `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          guests: [] as string[],
        })),
        fixtures: (template.fixtures || []).map((f) => ({
          ...f,
          id: `fixture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
        decor: (template as any).decor || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSelectedId(null);

      if (venueChangeCallback.current) {
        setTimeout(() => venueChangeCallback.current?.(), 100);
      }
    }
  }, []);

  // Save current layout as master layout for venue
  const saveMasterLayout = useCallback(() => {
    const allVenues = getVenues();

    const updatedVenues = allVenues.map((v) => {
      if (v.id === currentVenue.id) {
        return {
          ...v,
          isMaster: true,
          masterLayout: {
            tables: layout.tables,
            fixtures: layout.fixtures,
            decor: layout.decor,
            savedAt: new Date().toISOString(),
          },
        };
      }

      return v;
    });

    setVenues(updatedVenues);
    setVenuesState(updatedVenues);

    const updatedVenue = updatedVenues.find((v) => v.id === currentVenue.id);
    if (updatedVenue) {
      setCurrentVenue(updatedVenue);
    }
  }, [currentVenue.id, layout.tables, layout.fixtures, layout.decor]);

  // Clear master layout for venue
  const clearMasterLayout = useCallback(() => {
    const allVenues = getVenues();

    const updatedVenues = allVenues.map((v) => {
      if (v.id === currentVenue.id) {
        const { masterLayout, ...rest } = v;
        return rest;
      }

      return v;
    });

    setVenues(updatedVenues);
    setVenuesState(updatedVenues);

    const updatedVenue = updatedVenues.find((v) => v.id === currentVenue.id);
    if (updatedVenue) {
      setCurrentVenue(updatedVenue);
    }
  }, [currentVenue.id]);
  
  // Update entire layout (for undo/redo)
  const updateLayout = useCallback((updates: { tables?: PlacedTable[]; fixtures?: PlacedFixture[]; decor?: PlacedDecor[] }) => {
    setLayout((prev) => ({
      ...prev,
      tables: updates.tables ?? prev.tables,
      fixtures: updates.fixtures ?? prev.fixtures,
      decor: updates.decor ?? prev.decor,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  return {
    // State
    venues,
    currentVenue,
    layout,
    guests,
    selectedId,
    warnings,

    // Setters
    setSelectedId,
    setOnVenueChange,

    // Actions
    changeVenue,
    refreshVenues,
	updateLayout,
    addTable,
    addFixture,
    addDecor,
    updateTable,
    updateFixture,
    updateDecor,
    removeItem,
    duplicateItem,
    addGuest,
    updateGuest,
    removeGuest,
    assignGuestToTable,
    assignGuestToRoom,
    importGuestsFromCSV,
    exportGuestsToCSV,
    clearLayout,
    saveLayout,
    loadLayout,
    deleteSavedLayout,
    loadTemplate,
    saveMasterLayout,
    clearMasterLayout,
    getDecorItems,
    setDecorItems,
    getDecorCategories,
    setDecorCategories,
    getDecorArrangements,
    setDecorArrangements,
    getDecorPackages,
    setDecorPackages,
  };
}