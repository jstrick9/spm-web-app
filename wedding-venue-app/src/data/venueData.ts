import { 
  Venue, 
  TableSpec, 
  FixtureType, 
  Guideline, 
  LayoutCategoryInfo,
  LayoutTemplate,
  User,
  SpacingSettings,
  ChairSpec,
  WallStyle,
  AlignmentSettings,
  defaultAlignmentSettings,
  DecorItem,
  DecorPackage
} from '../types';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { emitDataChanged } from '../utils/appEvents';

// Default spacing settings
export const defaultSpacingSettings: SpacingSettings = {
  minItemSpacing: 2, // 2 feet between items (tables cannot overlap)
  minWallSpacing: 1, // 1 foot from walls
  minFixtureSpacing: 3, // 3 feet from major fixtures
  minTableSpacing: 3, // 3 feet between tables (for server access)
  enableCollisionDetection: true,
  showCollisionWarnings: true
};

// Get/Set spacing settings
export function getSpacingSettings(): SpacingSettings {
  const stored = localStorage.getItem(STORAGE_KEYS.SPACING_SETTINGS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultSpacingSettings;
    }
  }
  return defaultSpacingSettings;
}

export function setSpacingSettings(settings: SpacingSettings): void {
  localStorage.setItem(STORAGE_KEYS.SPACING_SETTINGS, JSON.stringify(settings));
  emitDataChanged('spacing');
}

// Get/Set alignment settings
export function getAlignmentSettings(): AlignmentSettings {
  const stored = localStorage.getItem(STORAGE_KEYS.ALIGNMENT_SETTINGS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultAlignmentSettings;
    }
  }
  return defaultAlignmentSettings;
}

export function setAlignmentSettings(settings: AlignmentSettings): void {
  localStorage.setItem(STORAGE_KEYS.ALIGNMENT_SETTINGS, JSON.stringify(settings));
  emitDataChanged('alignment');
}

// Default chair specifications
export const defaultChairSpecs: ChairSpec[] = [
  { id: 'white-plastic', name: 'White Plastic', color: '#FFFFFF', width: 1.5, depth: 1.5, icon: '🪑' },
  { id: 'wingback', name: 'Wingback', color: '#8B4513', width: 2, depth: 2, icon: '🛋️' },
  { id: 'chiavari', name: 'Chiavari Gold', color: '#D4AF37', width: 1.5, depth: 1.5, icon: '🪑' },
  { id: 'folding', name: 'Folding Chair', color: '#808080', width: 1.5, depth: 1.5, icon: '🪑' },
  { id: 'banquet', name: 'Banquet Chair', color: '#4A1942', width: 1.75, depth: 1.75, icon: '🪑' },
  { id: 'ghost', name: 'Ghost Chair', color: '#E8E8E8', width: 1.5, depth: 1.5, icon: '🪑' },
  { id: 'crossback', name: 'Crossback', color: '#CD853F', width: 1.75, depth: 1.75, icon: '🪑' },
  { id: 'none', name: 'No Chairs', color: 'transparent', width: 0, depth: 0, icon: '' },
];

// Get chair specs
export function getChairSpecs(): ChairSpec[] {
  const stored = localStorage.getItem(STORAGE_KEYS.CHAIR_SPECS_PRIMARY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultChairSpecs;
    }
  }
  return defaultChairSpecs;
}

export function setChairSpecs(specs: ChairSpec[]): void {
  localStorage.setItem(STORAGE_KEYS.CHAIR_SPECS_PRIMARY, JSON.stringify(specs));
  emitDataChanged('chairs');
}

// Default wall styles (for greenery/drapery walls)
export const defaultWallStyles: WallStyle[] = [
  { id: 'greenery', name: 'Greenery Wall', color: '#228B22', icon: '🌿', pattern: 'grass', enabled: true },
  { id: 'drapery-white', name: 'White Drapery', color: '#FFFFFF', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-ivory', name: 'Ivory Drapery', color: '#FFFFF0', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-blush', name: 'Blush Drapery', color: '#F8E8E8', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-burgundy', name: 'Burgundy Drapery', color: '#722F37', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-navy', name: 'Navy Drapery', color: '#1E3A5F', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-gold', name: 'Gold Drapery', color: '#D4AF37', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-sage', name: 'Sage Drapery', color: '#9CAF88', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-dusty-blue', name: 'Dusty Blue Drapery', color: '#6B8E9F', icon: '🪟', pattern: 'solid', enabled: true },
  { id: 'drapery-black', name: 'Black Drapery', color: '#1F2937', icon: '🪟', pattern: 'solid', enabled: true },
];

// Get wall styles
export function getWallStyles(): WallStyle[] {
  const stored = localStorage.getItem(STORAGE_KEYS.WALL_STYLES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultWallStyles;
    }
  }
  return defaultWallStyles;
}

export function setWallStyles(styles: WallStyle[]): void {
  localStorage.setItem(STORAGE_KEYS.WALL_STYLES, JSON.stringify(styles));
  emitDataChanged('wallStyles');
}

// Indoor feature templates (doors, windows, etc.)
export interface IndoorFeatureTemplate {
  id: string;
  type: 'door' | 'window' | 'column' | 'pillar' | 'partition' | 'fireplace' | 'stage' | 'bar-counter' | 'screen' | 'custom';
  name: string;
  icon: string;
  defaultWidth: number;
  defaultHeight?: number;
  defaultDepth?: number;
  color: string;
  borderColor?: string;
  borderWidth?: number;
  pattern?: string;
  doorType?: 'single' | 'double' | 'sliding' | 'french' | 'barn' | 'accordion';
  canOpen?: boolean;
  imageUrl?: string;
  description?: string;
  isCustom?: boolean;
}

export const defaultIndoorFeatureTemplates: IndoorFeatureTemplate[] = [
  // Doors
  { id: 'single-door', type: 'door', name: 'Single Door', icon: '🚪', defaultWidth: 3, color: '#8B4513', doorType: 'single', canOpen: true },
  { id: 'double-door', type: 'door', name: 'Double Door', icon: '🚪', defaultWidth: 6, color: '#8B4513', doorType: 'double', canOpen: true },
  { id: 'french-door', type: 'door', name: 'French Door', icon: '🚪', defaultWidth: 6, color: '#FFFFFF', doorType: 'french', canOpen: true },
  { id: 'sliding-door', type: 'door', name: 'Sliding Door', icon: '🚪', defaultWidth: 8, color: '#87CEEB', doorType: 'sliding', canOpen: false },
  { id: 'barn-door', type: 'door', name: 'Barn Door', icon: '🚪', defaultWidth: 6, color: '#654321', doorType: 'barn', canOpen: true },
  // Windows
  { id: 'window-small', type: 'window', name: 'Small Window', icon: '🪟', defaultWidth: 3, defaultHeight: 4, color: '#87CEEB' },
  { id: 'window-large', type: 'window', name: 'Large Window', icon: '🪟', defaultWidth: 6, defaultHeight: 5, color: '#87CEEB' },
  { id: 'bay-window', type: 'window', name: 'Bay Window', icon: '🪟', defaultWidth: 8, defaultHeight: 5, defaultDepth: 2, color: '#87CEEB' },
  // Columns & Pillars
  { id: 'column-round', type: 'column', name: 'Round Column', icon: '🏛️', defaultWidth: 2, defaultHeight: 2, color: '#E8E8E8' },
  { id: 'column-square', type: 'column', name: 'Square Column', icon: '🏛️', defaultWidth: 2, defaultHeight: 2, color: '#E8E8E8' },
  { id: 'pillar', type: 'pillar', name: 'Decorative Pillar', icon: '🏛️', defaultWidth: 1.5, defaultHeight: 1.5, color: '#D4AF37' },
  // Other features
  { id: 'partition', type: 'partition', name: 'Room Partition', icon: '🧱', defaultWidth: 10, defaultHeight: 1, color: '#808080' },
  { id: 'fireplace', type: 'fireplace', name: 'Fireplace', icon: '🔥', defaultWidth: 6, defaultHeight: 2, defaultDepth: 2, color: '#8B0000' },
  { id: 'stage', type: 'stage', name: 'Stage/Platform', icon: '🎭', defaultWidth: 20, defaultHeight: 12, defaultDepth: 1, color: '#2F2F2F' },
  { id: 'bar-counter', type: 'bar-counter', name: 'Bar Counter', icon: '🍸', defaultWidth: 12, defaultHeight: 3, color: '#654321' },
  // Screens (for pavilions, etc.)
  { id: 'screen-large', type: 'screen', name: 'Large Screen', icon: '🖼️', defaultWidth: 17.92, defaultHeight: 0.5, color: '#1F2937', description: "17' 11\" opening" },
  { id: 'screen-medium', type: 'screen', name: 'Medium Screen', icon: '🖼️', defaultWidth: 10.5, defaultHeight: 0.5, color: '#1F2937', description: "10' 6\" opening" },
  { id: 'screen-small', type: 'screen', name: 'Small Screen', icon: '🖼️', defaultWidth: 5, defaultHeight: 0.5, color: '#1F2937' },
  { id: 'column-screen', type: 'column', name: 'Screen Column', icon: '🏛️', defaultWidth: 0.42, defaultHeight: 0.42, color: '#4A1942', description: '5" column between screens' },
];

// Get indoor feature templates (default + custom)
export function getIndoorFeatureTemplates(): IndoorFeatureTemplate[] {
  const stored = localStorage.getItem(STORAGE_KEYS.INDOOR_FEATURE_TEMPLATES);
  if (stored) {
    try {
      const custom = JSON.parse(stored) as IndoorFeatureTemplate[];
      return [...defaultIndoorFeatureTemplates, ...custom];
    } catch {
      return defaultIndoorFeatureTemplates;
    }
  }
  return defaultIndoorFeatureTemplates;
}

export function setIndoorFeatureTemplates(templates: IndoorFeatureTemplate[]): void {
  // Only save custom templates (filter out defaults)
  const customTemplates = templates.filter(t => t.isCustom);
  localStorage.setItem(STORAGE_KEYS.INDOOR_FEATURE_TEMPLATES, JSON.stringify(customTemplates));
  emitDataChanged('indoorTemplates');
}

export function addIndoorFeatureTemplate(template: IndoorFeatureTemplate): void {
  const current = getIndoorFeatureTemplates().filter(t => t.isCustom);
  setIndoorFeatureTemplates([...current, { ...template, isCustom: true }]);
}

export function deleteIndoorFeatureTemplate(id: string): void {
  const current = getIndoorFeatureTemplates().filter(t => t.isCustom && t.id !== id);
  setIndoorFeatureTemplates(current);
}

// Outdoor feature templates
export interface OutdoorFeatureTemplate {
  id: string;
  type: string;
  name: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  secondaryColor?: string;
  borderColor?: string;
  borderWidth?: number;
  pattern?: string;
  shape?: string;
  imageUrl?: string;
  description?: string;
  isCustom?: boolean;
}

export const defaultOutdoorFeatureTemplates: OutdoorFeatureTemplate[] = [
  // Trees & Plants
  { id: 'tree-oak', type: 'tree', name: 'Oak Tree', icon: '🌳', defaultWidth: 15, defaultHeight: 15, color: '#228B22', secondaryColor: '#8B4513', shape: 'circle' },
  { id: 'tree-pine', type: 'tree', name: 'Pine Tree', icon: '🌲', defaultWidth: 8, defaultHeight: 12, color: '#006400', shape: 'triangle' },
  { id: 'tree-willow', type: 'tree', name: 'Willow Tree', icon: '🌳', defaultWidth: 20, defaultHeight: 18, color: '#9ACD32', shape: 'oval' },
  { id: 'tree-group', type: 'tree-group', name: 'Tree Cluster', icon: '🌲🌳', defaultWidth: 25, defaultHeight: 20, color: '#228B22' },
  { id: 'bush', type: 'bush', name: 'Bush/Shrub', icon: '🌿', defaultWidth: 4, defaultHeight: 4, color: '#2E8B57', shape: 'circle' },
  { id: 'hedge', type: 'hedge', name: 'Hedge Row', icon: '🌿', defaultWidth: 20, defaultHeight: 3, color: '#228B22', shape: 'rectangle' },
  { id: 'flower-bed', type: 'flower-bed', name: 'Flower Bed', icon: '🌸', defaultWidth: 8, defaultHeight: 4, color: '#FFB6C1', secondaryColor: '#90EE90', pattern: 'grass' },
  { id: 'planter', type: 'planter', name: 'Large Planter', icon: '🪴', defaultWidth: 3, defaultHeight: 3, color: '#8B4513', secondaryColor: '#228B22' },
  // Water Features
  { id: 'pond', type: 'pond', name: 'Pond', icon: '💧', defaultWidth: 20, defaultHeight: 15, color: '#4169E1', pattern: 'water', shape: 'oval' },
  { id: 'fountain', type: 'fountain', name: 'Fountain', icon: '⛲', defaultWidth: 10, defaultHeight: 10, color: '#87CEEB', shape: 'circle' },
  { id: 'stream', type: 'stream', name: 'Stream', icon: '🌊', defaultWidth: 30, defaultHeight: 5, color: '#4169E1', pattern: 'water' },
  // Pathways & Structures
  { id: 'pathway-stone', type: 'pathway', name: 'Stone Pathway', icon: '🪨', defaultWidth: 4, defaultHeight: 20, color: '#A0522D', pattern: 'concrete' },
  { id: 'pathway-gravel', type: 'pathway', name: 'Gravel Path', icon: '🛤️', defaultWidth: 4, defaultHeight: 20, color: '#D2B48C', pattern: 'gravel' },
  { id: 'bridge', type: 'bridge', name: 'Garden Bridge', icon: '🌉', defaultWidth: 8, defaultHeight: 4, color: '#8B4513', pattern: 'wood' },
  { id: 'arbor', type: 'arbor', name: 'Arbor/Arch', icon: '🏛️', defaultWidth: 6, defaultHeight: 2, color: '#FFFFFF' },
  { id: 'pergola', type: 'pergola', name: 'Pergola', icon: '🏠', defaultWidth: 12, defaultHeight: 10, color: '#D2691E', pattern: 'wood' },
  { id: 'gazebo', type: 'gazebo', name: 'Gazebo', icon: '🏛️', defaultWidth: 12, defaultHeight: 12, color: '#FFFFFF', shape: 'octagon' },
  // Fencing & Boundaries
  { id: 'fence-wood', type: 'fence', name: 'Wood Fence', icon: '🪵', defaultWidth: 20, defaultHeight: 1, color: '#8B4513' },
  { id: 'fence-white', type: 'fence', name: 'White Picket', icon: '🏠', defaultWidth: 20, defaultHeight: 1, color: '#FFFFFF' },
  { id: 'fence-iron', type: 'fence', name: 'Iron Fence', icon: '⚫', defaultWidth: 20, defaultHeight: 1, color: '#1F2937' },
  { id: 'gate', type: 'gate', name: 'Garden Gate', icon: '🚪', defaultWidth: 4, defaultHeight: 1, color: '#8B4513' },
  // Decorative
  { id: 'bench', type: 'bench', name: 'Garden Bench', icon: '🪑', defaultWidth: 5, defaultHeight: 2, color: '#8B4513' },
  { id: 'statue', type: 'statue', name: 'Statue', icon: '🗿', defaultWidth: 3, defaultHeight: 3, color: '#808080', shape: 'circle' },
  { id: 'rock', type: 'rock', name: 'Boulder', icon: '🪨', defaultWidth: 4, defaultHeight: 3, color: '#696969', shape: 'oval' },
  { id: 'lamp-post', type: 'lamp-post', name: 'Lamp Post', icon: '💡', defaultWidth: 2, defaultHeight: 2, color: '#2F2F2F', shape: 'circle' },
  { id: 'string-lights', type: 'string-lights', name: 'String Lights', icon: '✨', defaultWidth: 30, defaultHeight: 1, color: '#FFD700' },
  // Functional
  { id: 'lawn', type: 'lawn', name: 'Lawn Area', icon: '🌱', defaultWidth: 30, defaultHeight: 20, color: '#90EE90', pattern: 'grass' },
  { id: 'garden', type: 'garden', name: 'Garden Bed', icon: '🌻', defaultWidth: 15, defaultHeight: 8, color: '#8B4513', pattern: 'grass' },
  { id: 'parking', type: 'parking', name: 'Parking Area', icon: '🅿️', defaultWidth: 30, defaultHeight: 20, color: '#4B4B4B', pattern: 'concrete' },
  { id: 'driveway', type: 'driveway', name: 'Driveway', icon: '🛣️', defaultWidth: 12, defaultHeight: 40, color: '#808080', pattern: 'gravel' },
  { id: 'sign', type: 'sign', name: 'Venue Sign', icon: '🪧', defaultWidth: 4, defaultHeight: 2, color: '#FFFFFF' },
];

// Get outdoor feature templates (default + custom)
export function getOutdoorFeatureTemplates(): OutdoorFeatureTemplate[] {
  const stored = localStorage.getItem(STORAGE_KEYS.OUTDOOR_FEATURE_TEMPLATES);
  if (stored) {
    try {
      const custom = JSON.parse(stored) as OutdoorFeatureTemplate[];
      return [...defaultOutdoorFeatureTemplates, ...custom];
    } catch {
      return defaultOutdoorFeatureTemplates;
    }
  }
  return defaultOutdoorFeatureTemplates;
}

export function setOutdoorFeatureTemplates(templates: OutdoorFeatureTemplate[]): void {
  // Only save custom templates (filter out defaults)
  const customTemplates = templates.filter(t => t.isCustom);
  localStorage.setItem(STORAGE_KEYS.OUTDOOR_FEATURE_TEMPLATES, JSON.stringify(customTemplates));
  emitDataChanged('outdoorTemplates');
}

export function addOutdoorFeatureTemplate(template: OutdoorFeatureTemplate): void {
  const current = getOutdoorFeatureTemplates().filter(t => t.isCustom);
  setOutdoorFeatureTemplates([...current, { ...template, isCustom: true }]);
}

export function deleteOutdoorFeatureTemplate(id: string): void {
  const current = getOutdoorFeatureTemplates().filter(t => t.isCustom && t.id !== id);
  setOutdoorFeatureTemplates(current);
}

// Linen Color type
export interface LinenColor {
  id: string;
  name: string;
  hex: string;
  textColor: string;
  enabled: boolean;
}

// Layout categories
export const layoutCategories: LayoutCategoryInfo[] = [
  { id: 'reception', name: 'Reception', description: 'Wedding reception spaces', icon: '🎉', color: '#4A1942' },
  { id: 'ceremony', name: 'Ceremony', description: 'Wedding ceremony spaces', icon: '💒', color: '#6B5B95' },
  { id: 'cocktail', name: 'Cocktail Hour', description: 'Cocktail hour areas', icon: '🍸', color: '#88B04B' },
  { id: 'lodging', name: 'Lodging', description: 'Guest accommodations', icon: '🏨', color: '#F7CAC9' },
  { id: 'rehearsal-dinner', name: 'Rehearsal Dinner', description: 'Rehearsal dinner venues', icon: '🍽️', color: '#92A8D1' },
  { id: 'outdoor', name: 'Outdoor', description: 'Outdoor spaces', icon: '🌳', color: '#88B04B' },
  { id: 'other', name: 'Other', description: 'Other event spaces', icon: '📍', color: '#B565A7' },
];

// Default linen colors (admin can customize)
export const defaultLinenColors: LinenColor[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF', textColor: '#374151', enabled: true },
  { id: 'ivory', name: 'Ivory', hex: '#FFFFF0', textColor: '#374151', enabled: true },
  { id: 'black', name: 'Black', hex: '#1F2937', textColor: '#FFFFFF', enabled: true },
  { id: 'navy', name: 'Navy', hex: '#1E3A5F', textColor: '#FFFFFF', enabled: true },
  { id: 'burgundy', name: 'Burgundy', hex: '#722F37', textColor: '#FFFFFF', enabled: true },
  { id: 'sage', name: 'Sage', hex: '#9CAF88', textColor: '#374151', enabled: true },
  { id: 'blush', name: 'Blush', hex: '#F8E8E8', textColor: '#374151', enabled: true },
  { id: 'gold', name: 'Gold', hex: '#D4AF37', textColor: '#374151', enabled: true },
  { id: 'silver', name: 'Silver', hex: '#C0C0C0', textColor: '#374151', enabled: true },
  { id: 'dusty-blue', name: 'Dusty Blue', hex: '#6B8E9F', textColor: '#FFFFFF', enabled: true },
  { id: 'terracotta', name: 'Terracotta', hex: '#C96E4F', textColor: '#FFFFFF', enabled: true },
  { id: 'lavender', name: 'Lavender', hex: '#B8A9C9', textColor: '#374151', enabled: true },
  { id: 'forest', name: 'Forest Green', hex: '#228B22', textColor: '#FFFFFF', enabled: true },
  { id: 'coral', name: 'Coral', hex: '#FF7F50', textColor: '#374151', enabled: true },
  { id: 'charcoal', name: 'Charcoal', hex: '#36454F', textColor: '#FFFFFF', enabled: true },
];

// Default users (admin can create more)
export const defaultUsers: User[] = [
  {
    id: 'admin-1',
    username: 'admin',
    password: 'spm2024',
    role: 'admin',
    name: 'Administrator',
    email: 'weddings@sevenpathsmanor.com',
    phone: '',
    imageUrl: '',
    jobTitle: 'System Administrator',
    department: 'Administration',
    notes: 'Primary administrator account',
    isActive: true,
    loginCount: 0,
    createdAt: new Date().toISOString(),
    permissions: {
      canCreateTemplates: true,
      canEditTemplates: true,
      canDeleteTemplates: true,
      canManageGuests: true,
      canPrint: true,
      canExport: true,
      canViewAllLayouts: true
    }
  }
];

// Default venue spaces
export const defaultVenues: Venue[] = [];

// Default table specifications
export const defaultTableSpecs: TableSpec[] = [
  {
    id: 'round-6ft',
    name: '6ft Round Table',
    shape: 'circle',
    width: 6,
    height: 6,
    capacity: 10,
    color: '#FFFFFF',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'round-5ft',
    name: '5ft Round Table',
    shape: 'circle',
    width: 5,
    height: 5,
    capacity: 8,
    color: '#FFFFFF',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'round-4ft',
    name: '4ft Round Table',
    shape: 'circle',
    width: 4,
    height: 4,
    capacity: 6,
    color: '#FFFFFF',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'rect-8ft',
    name: '8ft Rectangular Table',
    shape: 'rectangle',
    width: 8,
    height: 3,
    capacity: 10,
    color: '#FFFFFF',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'rect-6ft',
    name: '6ft Rectangular Table',
    shape: 'rectangle',
    width: 6,
    height: 2.5,
    capacity: 8,
    color: '#FFFFFF',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'sweetheart',
    name: 'Sweetheart Table',
    shape: 'semicircle',
    width: 5,
    height: 2.5,
    capacity: 2,
    color: '#FFE4E1',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'head-table',
    name: 'Head Table',
    shape: 'rectangle',
    width: 12,
    height: 3,
    capacity: 12,
    color: '#FFE4E1',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'cocktail-round',
    name: 'Cocktail Table',
    shape: 'circle',
    width: 2,
    height: 2,
    capacity: 4,
    color: '#F0F0F0',
    pattern: 'solid',
    allowAsDecorBase: true
  },
  {
    id: 'seating-ceremony-row',
    name: 'Ceremony Seating Row',
    shape: 'rectangle',
    width: 20,
    height: 2,
    capacity: 12,
    color: '#E5E7EB',
    pattern: 'solid',
    isSeatingType: true,
    seatingStyle: 'straight-row',
    seatingRowCount: 4,
    seatingRowSpacing: 3,
    showChairs: true,
    defaultChairType: 'white-plastic',
    venueCategories: ['ceremony'],
    allowAsDecorBase: true
  },

];

// Default fixture types
export const defaultFixtureTypes: FixtureType[] = [
  // Lodging / Utilities Fixtures
  {
    id: 'power-outlet',
    name: 'Power Outlet',
    shape: 'rectangle',
    width: 1.5,
    height: 1.5,
    color: '#E2E8F0',
    pattern: 'solid',
    icon: '🔌',
    category: 'lodging'
  },
  {
    id: 'water-hookup',
    name: 'Water Hookup',
    shape: 'circle',
    width: 1.5,
    height: 1.5,
    color: '#3B82F6',
    pattern: 'water',
    icon: '🚰',
    category: 'lodging'
  },
  {
    id: 'exit-door',
    name: 'Exit Door',
    shape: 'rectangle',
    width: 3,
    height: 1,
    color: '#EF4444',
    pattern: 'solid',
    icon: '🚪',
    category: 'lodging'
  },
  // Lodging Furniture
  {
    id: 'bed-king',
    name: 'King Bed',
    shape: 'rectangle',
    width: 6.3,
    height: 6.7,
    color: '#F8FAFC',
    pattern: 'solid',
    icon: '🛏️',
    category: 'lodging'
  },
  {
    id: 'bed-queen',
    name: 'Queen Bed',
    shape: 'rectangle',
    width: 5,
    height: 6.7,
    color: '#F8FAFC',
    pattern: 'solid',
    icon: '🛏️',
    category: 'lodging'
  },
  {
    id: 'bed-twin',
    name: 'Twin Bed',
    shape: 'rectangle',
    width: 3.2,
    height: 6.2,
    color: '#F8FAFC',
    pattern: 'solid',
    icon: '🛏️',
    category: 'lodging'
  },
  {
    id: 'dresser',
    name: 'Dresser',
    shape: 'rectangle',
    width: 4,
    height: 1.5,
    color: '#8B4513',
    pattern: 'wood',
    icon: '🗄️',
    category: 'lodging'
  },
  {
    id: 'nightstand',
    name: 'Nightstand',
    shape: 'rectangle',
    width: 1.5,
    height: 1.5,
    color: '#8B4513',
    pattern: 'wood',
    icon: '🪑',
    category: 'lodging'
  },
  {
    id: 'sofa',
    name: 'Sofa / Couch',
    shape: 'rectangle',
    width: 7,
    height: 3,
    color: '#94A3B8',
    pattern: 'solid',
    icon: '🛋️',
    category: 'lodging'
  },
  {
    id: 'sleeper-sofa',
    name: 'Sleeper Sofa',
    shape: 'rectangle',
    width: 7,
    height: 3,
    color: '#64748B',
    pattern: 'solid',
    icon: '🛋️',
    category: 'lodging'
  },
  {
    id: 'toilet',
    name: 'Toilet',
    shape: 'oval',
    width: 1.5,
    height: 2,
    color: '#FFFFFF',
    pattern: 'solid',
    icon: '🚽',
    category: 'lodging'
  },
  {
    id: 'shower',
    name: 'Shower',
    shape: 'rectangle',
    width: 3,
    height: 3,
    color: '#E2E8F0',
    pattern: 'tile',
    icon: '🚿',
    category: 'lodging'
  },
  {
    id: 'bath-shower',
    name: 'Bath/Shower Combo',
    shape: 'rectangle',
    width: 5,
    height: 2.5,
    color: '#E2E8F0',
    pattern: 'tile',
    icon: '🛁',
    category: 'lodging'
  },
  {
    id: 'sink',
    name: 'Sink / Vanity',
    shape: 'rectangle',
    width: 3,
    height: 2,
    color: '#F1F5F9',
    pattern: 'marble',
    icon: '🚰',
    category: 'lodging'
  },
  {
    id: 'refrigerator',
    name: 'Refrigerator',
    shape: 'rectangle',
    width: 3,
    height: 3,
    color: '#CBD5E1',
    pattern: 'solid',
    icon: '🧊',
    category: 'lodging'
  },
  {
    id: 'pool-table',
    name: 'Pool Table',
    shape: 'rectangle',
    width: 8,
    height: 4,
    color: '#166534',
    pattern: 'solid',
    icon: '🎱',
    category: 'lodging'
  },
  // Interior fixtures
  {
    id: 'dance-floor',
    name: 'Dance Floor',
    shape: 'rectangle',
    width: 18,
    height: 18,
    color: '#1a1a1a',
    pattern: 'checkered',
    icon: '💃',
    category: 'interior'
  },
  {
    id: 'dj-station',
    name: 'DJ Station',
    shape: 'rectangle',
    width: 8,
    height: 4,
    color: '#2C3E50',
    pattern: 'solid',
    icon: '🎵',
    category: 'interior'
  },
  {
    id: 'bar',
    name: 'Bar',
    shape: 'rectangle',
    width: 10,
    height: 4,
    color: '#8B4513',
    pattern: 'wood',
    icon: '🍸',
    category: 'interior'
  },
  {
    id: 'buffet',
    name: 'Buffet Station',
    shape: 'rectangle',
    width: 12,
    height: 3,
    color: '#DDD',
    pattern: 'solid',
    icon: '🍽️',
    category: 'interior'
  },
  {
    id: 'dessert-table',
    name: 'Dessert Table',
    shape: 'rectangle',
    width: 8,
    height: 3,
    color: '#FFE4E1',
    pattern: 'solid',
    icon: '🎂',
    category: 'interior'
  },
  {
    id: 'gift-table',
    name: 'Gift Table',
    shape: 'rectangle',
    width: 6,
    height: 2.5,
    color: '#E8E8E8',
    pattern: 'solid',
    icon: '🎁',
    category: 'interior'
  },
  {
    id: 'photo-booth',
    name: 'Photo Booth',
    shape: 'rectangle',
    width: 10,
    height: 8,
    color: '#3498DB',
    pattern: 'solid',
    icon: '📷',
    category: 'interior'
  },
  {
    id: 'stage',
    name: 'Stage',
    shape: 'rectangle',
    width: 16,
    height: 12,
    color: '#34495E',
    pattern: 'wood',
    icon: '🎤',
    category: 'interior'
  },
  {
    id: 'altar',
    name: 'Altar/Arch',
    shape: 'semicircle',
    width: 10,
    height: 5,
    color: '#FFF5EE',
    pattern: 'solid',
    icon: '⛪',
    category: 'interior'
  },
  {
    id: 'aisle-runner',
    name: 'Aisle Runner',
    shape: 'rectangle',
    width: 4,
    height: 40,
    color: '#FFFAF0',
    pattern: 'carpet',
    icon: '🚶',
    category: 'interior'
  },
  {
    id: 'greenery-wall',
    name: 'Greenery/Drapery Wall',
    shape: 'rectangle',
    width: 12,
    height: 2,
    color: '#228B22',
    pattern: 'solid',
    icon: '🌿',
    category: 'interior',
    hasVariants: true,
    variants: [
      { id: 'greenery', name: 'Greenery Wall', color: '#228B22', icon: '🌿' },
      { id: 'drapery-white', name: 'White Drapery', color: '#FFFFFF', icon: '🪟' },
      { id: 'drapery-ivory', name: 'Ivory Drapery', color: '#FFFFF0', icon: '🪟' },
      { id: 'drapery-blush', name: 'Blush Drapery', color: '#F8E8E8', icon: '🪟' },
      { id: 'drapery-burgundy', name: 'Burgundy Drapery', color: '#722F37', icon: '🪟' },
      { id: 'drapery-navy', name: 'Navy Drapery', color: '#1E3A5F', icon: '🪟' },
      { id: 'drapery-gold', name: 'Gold Drapery', color: '#D4AF37', icon: '🪟' },
    ]
  },
  {
    id: 'champagne-wall',
    name: 'Champagne Wall',
    shape: 'rectangle',
    width: 6,
    height: 2,
    color: '#FFD700',
    pattern: 'solid',
    icon: '🥂',
    category: 'interior'
  },
  // Exterior fixtures
  {
    id: 'fountain',
    name: 'Fountain',
    shape: 'circle',
    width: 10,
    height: 10,
    color: '#87CEEB',
    pattern: 'water',
    icon: '⛲',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'entry-pad',
    name: 'Entry Pad',
    shape: 'rectangle',
    width: 20,
    height: 20,
    color: '#A9A9A9',
    pattern: 'concrete',
    icon: '🚪',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'concrete-patio',
    name: 'Concrete Patio',
    shape: 'rectangle',
    width: 100,
    height: 10,
    color: '#C0C0C0',
    pattern: 'concrete',
    icon: '⬜',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'restrooms',
    name: 'Restrooms',
    shape: 'rectangle',
    width: 20,
    height: 12,
    color: '#F5F5DC',
    pattern: 'tile',
    icon: '🚻',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'gravel-drive',
    name: 'Gravel Driveway',
    shape: 'rectangle',
    width: 12,
    height: 30,
    color: '#D2B48C',
    pattern: 'gravel',
    icon: '🛤️',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'grass-area',
    name: 'Grass Area',
    shape: 'rectangle',
    width: 20,
    height: 20,
    color: '#90EE90',
    pattern: 'grass',
    icon: '🌱',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'manor-sign',
    name: 'Manor House Sign',
    shape: 'rectangle',
    width: 6,
    height: 3,
    color: '#8B4513',
    pattern: 'wood',
    icon: '↓',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'caterer-tent',
    name: 'Caterer Prep Tent',
    shape: 'rectangle',
    width: 15,
    height: 15,
    color: '#FFFAF0',
    pattern: 'solid',
    icon: '⛺',
    category: 'exterior',
    isExterior: true
  },
  {
    id: 'parking-area',
    name: 'Parking Area',
    shape: 'rectangle',
    width: 40,
    height: 20,
    color: '#696969',
    pattern: 'concrete',
    icon: '🅿️',
    category: 'exterior',
    isExterior: true
  }
];

// Default guidelines
export const defaultGuidelines: Guideline[] = [
  {
    id: 'aisle-width',
    title: 'Aisle Widths',
    description: 'Maintain 3-4 feet between chair backs for server and guest movement',
    enabled: true
  },
  {
    id: 'buffet-clearance',
    title: 'Buffet Clearance',
    description: 'Allow at least 5 feet of clearance around buffet areas',
    enabled: true
  },
  {
    id: 'dance-floor-buffer',
    title: 'Dance Floor Buffer',
    description: 'Keep tables at least 3 feet from the dance floor edge',
    enabled: true
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    description: 'Ensure wheelchair-accessible paths of at least 4 feet wide',
    enabled: true
  },
  {
    id: 'emergency-exits',
    title: 'Emergency Exits',
    description: 'Keep clear paths to all emergency exits',
    enabled: true
  }
];

// Default layout templates
export const defaultLayoutTemplates: LayoutTemplate[] = [
  {
    id: 'classic-reception',
    name: 'Classic Reception',
    description: 'Traditional reception layout with round tables surrounding the dance floor',
    category: 'reception',
    venueId: 'pavilion',
    tables: [
      { id: 't1', type: 'table', specId: 'sweetheart', x: 50, y: 5, rotation: 0, label: 'Sweetheart', guests: [] },
      { id: 't2', type: 'table', specId: 'round-6ft', x: 15, y: 15, rotation: 0, label: 'Table 1', guests: [] },
      { id: 't3', type: 'table', specId: 'round-6ft', x: 30, y: 15, rotation: 0, label: 'Table 2', guests: [] },
      { id: 't4', type: 'table', specId: 'round-6ft', x: 70, y: 15, rotation: 0, label: 'Table 3', guests: [] },
      { id: 't5', type: 'table', specId: 'round-6ft', x: 85, y: 15, rotation: 0, label: 'Table 4', guests: [] },
      { id: 't6', type: 'table', specId: 'round-6ft', x: 15, y: 30, rotation: 0, label: 'Table 5', guests: [] },
      { id: 't7', type: 'table', specId: 'round-6ft', x: 85, y: 30, rotation: 0, label: 'Table 6', guests: [] },
    ],
    fixtures: [
      { id: 'f1', type: 'fixture', specId: 'dance-floor', x: 50, y: 25, rotation: 0, label: 'Dance Floor' },
      { id: 'f2', type: 'fixture', specId: 'dj-station', x: 50, y: 38, rotation: 0, label: 'DJ' },
      { id: 'f3', type: 'fixture', specId: 'bar', x: 10, y: 38, rotation: 0, label: 'Bar' },
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    isMasterTemplate: true
  },
  {
    id: 'banquet-style',
    name: 'Banquet Style',
    description: 'Long rectangular tables for a formal banquet setting',
    category: 'reception',
    venueId: 'pavilion',
    tables: [
      { id: 't1', type: 'table', specId: 'head-table', x: 50, y: 5, rotation: 0, label: 'Head Table', guests: [] },
      { id: 't2', type: 'table', specId: 'rect-8ft', x: 25, y: 18, rotation: 0, label: 'Table 1', guests: [] },
      { id: 't3', type: 'table', specId: 'rect-8ft', x: 75, y: 18, rotation: 0, label: 'Table 2', guests: [] },
      { id: 't4', type: 'table', specId: 'rect-8ft', x: 25, y: 28, rotation: 0, label: 'Table 3', guests: [] },
      { id: 't5', type: 'table', specId: 'rect-8ft', x: 75, y: 28, rotation: 0, label: 'Table 4', guests: [] },
    ],
    fixtures: [
      { id: 'f1', type: 'fixture', specId: 'dance-floor', x: 50, y: 25, rotation: 0, label: 'Dance Floor' },
      { id: 'f2', type: 'fixture', specId: 'buffet', x: 10, y: 38, rotation: 0, label: 'Buffet' },
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    isMasterTemplate: true
  },
  {
    id: 'ceremony-traditional',
    name: 'Traditional Ceremony',
    description: 'Classic ceremony setup with rows of chairs facing the altar',
    category: 'ceremony',
    venueId: 'ceremony-lawn',
    tables: [
      { id: 'c1', type: 'table', specId: 'ceremony-chair-row', x: 15, y: 15, rotation: 0, label: 'Row 1 Left', guests: [] },
      { id: 'c2', type: 'table', specId: 'ceremony-chair-row', x: 45, y: 15, rotation: 0, label: 'Row 1 Right', guests: [] },
      { id: 'c3', type: 'table', specId: 'ceremony-chair-row', x: 15, y: 22, rotation: 0, label: 'Row 2 Left', guests: [] },
      { id: 'c4', type: 'table', specId: 'ceremony-chair-row', x: 45, y: 22, rotation: 0, label: 'Row 2 Right', guests: [] },
      { id: 'c5', type: 'table', specId: 'ceremony-chair-row', x: 15, y: 30, rotation: 0, label: 'Row 3 Left', guests: [] },
      { id: 'c6', type: 'table', specId: 'ceremony-chair-row', x: 45, y: 30, rotation: 0, label: 'Row 3 Right', guests: [] },
    ],
    fixtures: [
      { id: 'f1', type: 'fixture', specId: 'altar', x: 30, y: 5, rotation: 0, label: 'Altar' },
      { id: 'f2', type: 'fixture', specId: 'aisle-runner', x: 30, y: 25, rotation: 0, label: 'Aisle' },
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'admin'
  },
  {
    id: 'cocktail-garden',
    name: 'Garden Cocktail Hour',
    description: 'Casual cocktail setup with standing tables',
    category: 'cocktail',
    venueId: 'cocktail-garden',
    tables: [
      { id: 't1', type: 'table', specId: 'cocktail-round', x: 10, y: 10, rotation: 0, label: 'Cocktail 1', guests: [] },
      { id: 't2', type: 'table', specId: 'cocktail-round', x: 25, y: 10, rotation: 0, label: 'Cocktail 2', guests: [] },
      { id: 't3', type: 'table', specId: 'cocktail-round', x: 40, y: 10, rotation: 0, label: 'Cocktail 3', guests: [] },
      { id: 't4', type: 'table', specId: 'cocktail-round', x: 10, y: 25, rotation: 0, label: 'Cocktail 4', guests: [] },
      { id: 't5', type: 'table', specId: 'cocktail-round', x: 25, y: 25, rotation: 0, label: 'Cocktail 5', guests: [] },
      { id: 't6', type: 'table', specId: 'cocktail-round', x: 40, y: 25, rotation: 0, label: 'Cocktail 6', guests: [] },
    ],
    fixtures: [
      { id: 'f1', type: 'fixture', specId: 'bar', x: 20, y: 35, rotation: 0, label: 'Bar' },
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'admin'
  }
];

// Helper function to load data from localStorage with defaults
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`Error loading ${key} from storage:`, e);
  }
  return defaultValue;
}

// Default decor categories
export const defaultDecorCategories: LayoutCategoryInfo[] = [
  { id: 'florals' as any, name: 'Florals', icon: '🌸', color: '#ec4899', description: 'Flower arrangements and floral accents' },
  { id: 'vases' as any, name: 'Vases', icon: '🏺', color: '#0ea5e9', description: 'Vases and containers' },
  { id: 'candles' as any, name: 'Candles', icon: '🕯️', color: '#f59e0b', description: 'Taper, pillar, and votive candles' },
  { id: 'centerpieces' as any, name: 'Centerpieces', icon: '💐', color: '#8b5cf6', description: 'Table centerpieces and focal points' },
  { id: 'table-numbers' as any, name: 'Table Numbers', icon: '🔢', color: '#64748b', description: 'Numerical indicators for tables' },
  { id: 'signage' as any, name: 'Signage', icon: '🪧', color: '#475569', description: 'Informational and decorative signs' },
  { id: 'lighting' as any, name: 'Lighting', icon: '💡', color: '#eab308', description: 'Decorative and ambient lighting' },
  { id: 'backdrop' as any, name: 'Backdrop', icon: '🖼️', color: '#d946ef', description: 'Background displays and photo walls' },
  { id: 'arch' as any, name: 'Arch', icon: '⛩️', color: '#10b981', description: 'Ceremony arches and arbors' },
  { id: 'aisle' as any, name: 'Aisle', icon: '🚶', color: '#f43f5e', description: 'Aisle runners and floor decor' },
  { id: 'custom' as any, name: 'Custom', icon: '✨', color: '#6366f1', description: 'Bespoke decorative elements' },
];



// Default decor items
export const defaultDecorItems: DecorItem[] = [
  {
    id: 'decor-rose-centerpiece',
    name: 'Rose Centerpiece',
    categoryId: 'centerpieces',
    width: 1,
    height: 1,
    widthInches: 12,
    heightInches: 12,
    icon: '🌹',
    color: '#FF69B4',
    inventoryCount: 20,
    isTemplate: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'decor-gold-candle',
    name: 'Gold Taper Candle',
    categoryId: 'candles',
    width: 0.25,
    height: 0.25,
    widthInches: 3,
    heightInches: 3,
    icon: '🕯️',
    color: '#D4AF37',
    inventoryCount: 50,
    isTemplate: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'decor-arch-floral',
    name: 'Floral Archway',
    categoryId: 'arch',
    width: 8,
    height: 2,
    widthInches: 96,
    heightInches: 24,
    icon: '⛩️',
    color: '#FFFFFF',
    inventoryCount: 2,
    isTemplate: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'decor-table-runner-white',
    name: 'White Table Runner',
    categoryId: 'custom',
    width: 6,
    height: 1.5,
    widthInches: 72,
    heightInches: 18,
    icon: '🧵',
    color: '#FFFFFF',
    inventoryCount: 30,
    isTemplate: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'decor-gold-table-number',
    name: 'Gold Table Number',
    categoryId: 'table-numbers',
    width: 0.5,
    height: 0.5,
    widthInches: 6,
    heightInches: 6,
    icon: '🔢',
    color: '#D4AF37',
    inventoryCount: 40,
    isTemplate: false,
    createdAt: new Date().toISOString()
  }
];

// Default decor packages
export const defaultDecorPackages: DecorPackage[] = [
  {
    id: 'pkg-rustic-romance',
    name: 'Rustic Romance',
    style: 'Rustic',
    description: 'Natural wood accents, sage greenery, and ivory candles.',
    arrangements: []
  },
  {
    id: 'pkg-modern-gold',
    name: 'Modern Gold',
    style: 'Modern',
    description: 'Clean lines, gold accents, and white florals.',
    arrangements: []
  },
  {
    id: 'pkg-seasonal-spring',
    name: 'Seasonal Spring',
    style: 'Seasonal',
    description: 'Pastel colors and fresh spring blooms.',
    arrangements: []
  },
  {
    id: 'pkg-gold-premium',
    name: 'Gold Premium',
    style: 'Gold',
    description: 'Luxurious gold elements and high-end floral displays.',
    arrangements: []
  },
  {
    id: 'pkg-silver-luxe',
    name: 'Silver Luxe',
    style: 'Silver',
    description: 'Elegant silver accents and contemporary designs.',
    arrangements: []
  }
];

export function getDecorPackages(): any[] {
  return loadFromStorage(STORAGE_KEYS.DECOR_PACKAGES, defaultDecorPackages);
}

export function setDecorPackages(packages: any[]): void {
  saveToStorage(STORAGE_KEYS.DECOR_PACKAGES, packages);
  emitDataChanged('decorPackages');
}

// Helper function to save data to localStorage
export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}
