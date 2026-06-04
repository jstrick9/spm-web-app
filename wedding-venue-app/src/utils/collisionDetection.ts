import { PlacedTable, PlacedFixture, Venue, RectangularChairLayout } from '../types';
import { getTableSpecs, getFixtureTypes } from '../hooks/useLayoutState';
import { getSpacingSettings, getChairSpecs } from '../data/venueData';

function normalizeSpacing(value: number | undefined, fallback: number): number {
  const raw = Number.isFinite(value as number) ? Number(value) : fallback;
  // Keep spacing authoritative but safe in all scenarios
  return Math.max(0, Math.min(10, Math.round(raw)));
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionResult {
  collides: boolean;
  collidingItems: string[];
  wallError: string;
  details?: string;
}

// Get the effective bounding box of a table INCLUDING chairs
export function getTableBoundingBoxWithChairs(table: PlacedTable): BoundingBox {
  const tableSpecs = getTableSpecs();
  const chairSpecs = getChairSpecs();
  const spacingSettings = getSpacingSettings();
  
  const spec = tableSpecs.find(s => s.id === table.specId);
  if (!spec) {
    return { x: table.x, y: table.y, width: 4, height: 4 };
  }
  
  let effectiveWidth = spec.width;
  let effectiveHeight = spec.height;
  let offsetX = 0;
  let offsetY = 0;
  
  // Add chair dimensions based on chair type and layout
  if (table.showChairs !== false && table.chairType && table.chairType !== 'none') {
    const chairSpec = chairSpecs.find(c => c.id === table.chairType);
    if (chairSpec) {
      // Use the actual chair dimensions from the admin-configured chair specs
      const chairDepth = chairSpec.depth || chairSpec.width;
      const layout = table.chairLayout || 'all-sides';
      const shape = spec.shape || 'rectangle';
      const isHorizontal = spec.width >= spec.height;
      
      if (shape === 'circle' || shape === 'oval' || shape === 'hexagon' || shape === 'octagon') {
        // Round/circular tables have chairs all around
        effectiveWidth += chairDepth * 2;
        effectiveHeight += chairDepth * 2;
        offsetX = chairDepth;
        offsetY = chairDepth;
      } else if (shape === 'semicircle') {
        // Semicircle tables only have chairs on the straight side (bottom)
        effectiveHeight += chairDepth;
        // No offset needed - chairs are only on bottom, table position stays the same
      } else if (shape === 'rectangle') {
        // Rectangular tables - depends on chair layout setting
        if (layout === 'head-table') {
          // Chairs only on one long side (typically bottom for horizontal tables)
          if (isHorizontal) {
            effectiveHeight += chairDepth;
            // No Y offset - chairs are on bottom only
          } else {
            effectiveWidth += chairDepth;
            // No X offset - chairs are on right side only
          }
        } else if (layout === 'long-sides-only') {
          // Chairs on the two long sides only
          if (isHorizontal) {
            effectiveHeight += chairDepth * 2;
            offsetY = chairDepth;
          } else {
            effectiveWidth += chairDepth * 2;
            offsetX = chairDepth;
          }
        } else {
          // 'all-sides' - chairs on all 4 sides
          effectiveWidth += chairDepth * 2;
          effectiveHeight += chairDepth * 2;
          offsetX = chairDepth;
          offsetY = chairDepth;
        }
      } else {
        // Default: add chairs on all sides
        effectiveWidth += chairDepth * 2;
        effectiveHeight += chairDepth * 2;
        offsetX = chairDepth;
        offsetY = chairDepth;
      }
    }
  }
  
  // Add minimum table-to-table spacing
  const tableSpacing = normalizeSpacing(spacingSettings.minTableSpacing, 3);
  
  return {
    x: table.x - offsetX - tableSpacing / 2,
    y: table.y - offsetY - tableSpacing / 2,
    width: effectiveWidth + tableSpacing,
    height: effectiveHeight + tableSpacing
  };
}

// Get the bounding box for a fixture
export function getFixtureBoundingBox(fixture: PlacedFixture): BoundingBox {
  const fixtureTypes = getFixtureTypes();
  const spacingSettings = getSpacingSettings();
  
  const spec = fixtureTypes.find(s => s.id === fixture.specId);
  if (!spec) {
    return { x: fixture.x, y: fixture.y, width: 4, height: 4 };
  }

  // Spacing configuration only applies to venue fixtures (interior, non-lodging, non-exterior)
  const usesVenueSpacing = !spec.isExterior && spec.category !== 'exterior' && spec.category !== 'lodging';
  const spacing = usesVenueSpacing ? (spacingSettings.minFixtureSpacing || 1) : 0;
  
  return {
    x: fixture.x - spacing / 2,
    y: fixture.y - spacing / 2,
    width: spec.width + spacing,
    height: spec.height + spacing
  };
}

// Check if two bounding boxes overlap
export function boxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
  // Add a small epsilon to handle floating point comparison
  const epsilon = 0.01;
  return !(
    box1.x + box1.width <= box2.x + epsilon ||
    box2.x + box2.width <= box1.x + epsilon ||
    box1.y + box1.height <= box2.y + epsilon ||
    box2.y + box2.height <= box1.y + epsilon
  );
}

// Check wall spacing - returns error message if item is too close to wall
export function checkWallSpacing(
  itemBox: BoundingBox,
  venue: Venue,
  itemType: 'table' | 'fixture'
): { valid: boolean; message: string } {
  const spacingSettings = getSpacingSettings();
  
  if (!spacingSettings.enableCollisionDetection) {
    return { valid: true, message: '' };
  }
  
  const wallSpacing = spacingSettings.minWallSpacing || 1;
  
  // Calculate the actual bounds of the item (including chairs for tables)
  const leftEdge = itemBox.x;
  const topEdge = itemBox.y;
  const rightEdge = itemBox.x + itemBox.width;
  const bottomEdge = itemBox.y + itemBox.height;
  
  // Check each wall
  if (leftEdge < wallSpacing) {
    const distance = Math.max(0, leftEdge).toFixed(1);
    return { 
      valid: false, 
      message: `${itemType === 'table' ? 'Table (including chairs)' : 'Item'} is ${distance}ft from the left wall. Minimum is ${wallSpacing}ft.` 
    };
  }
  if (topEdge < wallSpacing) {
    const distance = Math.max(0, topEdge).toFixed(1);
    return { 
      valid: false, 
      message: `${itemType === 'table' ? 'Table (including chairs)' : 'Item'} is ${distance}ft from the top wall. Minimum is ${wallSpacing}ft.` 
    };
  }
  if (rightEdge > venue.width - wallSpacing) {
    const distance = Math.max(0, venue.width - rightEdge).toFixed(1);
    return { 
      valid: false, 
      message: `${itemType === 'table' ? 'Table (including chairs)' : 'Item'} is ${distance}ft from the right wall. Minimum is ${wallSpacing}ft.` 
    };
  }
  if (bottomEdge > venue.height - wallSpacing) {
    const distance = Math.max(0, venue.height - bottomEdge).toFixed(1);
    return { 
      valid: false, 
      message: `${itemType === 'table' ? 'Table (including chairs)' : 'Item'} is ${distance}ft from the bottom wall. Minimum is ${wallSpacing}ft.` 
    };
  }
  
  return { valid: true, message: '' };
}

// Check if a new table would collide with existing items
export function checkTableCollision(
  newTable: { 
    x: number; 
    y: number; 
    specId: string; 
    showChairs?: boolean; 
    chairType?: string;
    chairLayout?: RectangularChairLayout;
  },
  existingTables: PlacedTable[],
  existingFixtures: PlacedFixture[],
  venue?: Venue,
  excludeId?: string
): CollisionResult {
  const spacingSettings = getSpacingSettings();
  
  if (!spacingSettings.enableCollisionDetection) {
    return { collides: false, collidingItems: [], wallError: '' };
  }
  
  const tableSpecs = getTableSpecs();
  const chairSpecs = getChairSpecs();
  const tableSpacing = normalizeSpacing(spacingSettings.minTableSpacing, 3);
  
  const spec = tableSpecs.find(s => s.id === newTable.specId);
  if (!spec) {
    return { collides: false, collidingItems: [], wallError: '' };
  }
  
  // Calculate new table's bounding box WITH chairs
  let effectiveWidth = spec.width;
  let effectiveHeight = spec.height;
  let chairOffsetX = 0;
  let chairOffsetY = 0;
  
  if (newTable.showChairs !== false && newTable.chairType && newTable.chairType !== 'none') {
    const chairSpec = chairSpecs.find(c => c.id === newTable.chairType);
    if (chairSpec) {
      const chairDepth = chairSpec.depth || chairSpec.width;
      const layout = newTable.chairLayout || 'all-sides';
      const shape = spec.shape || 'rectangle';
      const isHorizontal = spec.width >= spec.height;
      
      if (shape === 'circle' || shape === 'oval' || shape === 'hexagon' || shape === 'octagon') {
        effectiveWidth += chairDepth * 2;
        effectiveHeight += chairDepth * 2;
        chairOffsetX = chairDepth;
        chairOffsetY = chairDepth;
      } else if (shape === 'semicircle') {
        effectiveHeight += chairDepth;
      } else if (shape === 'rectangle') {
        if (layout === 'head-table') {
          if (isHorizontal) {
            effectiveHeight += chairDepth;
          } else {
            effectiveWidth += chairDepth;
          }
        } else if (layout === 'long-sides-only') {
          if (isHorizontal) {
            effectiveHeight += chairDepth * 2;
            chairOffsetY = chairDepth;
          } else {
            effectiveWidth += chairDepth * 2;
            chairOffsetX = chairDepth;
          }
        } else {
          effectiveWidth += chairDepth * 2;
          effectiveHeight += chairDepth * 2;
          chairOffsetX = chairDepth;
          chairOffsetY = chairDepth;
        }
      } else {
        effectiveWidth += chairDepth * 2;
        effectiveHeight += chairDepth * 2;
        chairOffsetX = chairDepth;
        chairOffsetY = chairDepth;
      }
    }
  }
  
  // Create bounding box for the new table (including spacing)
  const newBox: BoundingBox = {
    x: newTable.x - chairOffsetX - tableSpacing / 2,
    y: newTable.y - chairOffsetY - tableSpacing / 2,
    width: effectiveWidth + tableSpacing,
    height: effectiveHeight + tableSpacing
  };
  
  // Also create a box WITHOUT spacing for wall checking
  const newBoxForWalls: BoundingBox = {
    x: newTable.x - chairOffsetX,
    y: newTable.y - chairOffsetY,
    width: effectiveWidth,
    height: effectiveHeight
  };
  
  // Check wall spacing first (use the box without table-to-table spacing)
  let wallError = '';
  if (venue) {
    const wallCheck = checkWallSpacing(newBoxForWalls, venue, 'table');
    if (!wallCheck.valid) {
      wallError = wallCheck.message;
    }
  }
  
  const collidingItems: string[] = [];
  
  // Check against existing tables
  for (const table of existingTables) {
    if (table.id === excludeId) continue;
    
    const existingBox = getTableBoundingBoxWithChairs(table);
    if (boxesOverlap(newBox, existingBox)) {
      collidingItems.push(table.id);
    }
  }
  
  // Check against existing venue fixtures only (spacing does not apply to lodging/exterior fixtures)
  for (const fixture of existingFixtures) {
    if (fixture.id === excludeId) continue;
    const existingSpec = getFixtureTypes().find(s => s.id === fixture.specId);
    if (!existingSpec) continue;
    if (existingSpec.isExterior || existingSpec.category === 'exterior' || existingSpec.category === 'lodging' || existingSpec.ignoreSpacingRules) continue;
    if (spec.isRoom) continue; // Rooms don't collide with fixtures
    
    const existingBox = getFixtureBoundingBox(fixture);
    if (boxesOverlap(newBox, existingBox)) {
      collidingItems.push(fixture.id);
    }
  }
  
  // Build detailed message
  let details = '';
  if (collidingItems.length > 0) {
    details = `Collision detected with ${collidingItems.length} item(s). Tables need ${tableSpacing}ft spacing (including chairs).`;
  }
  
  return {
    collides: collidingItems.length > 0 || wallError !== '',
    collidingItems,
    wallError,
    details
  };
}

// Check if a new fixture would collide with existing items
export function checkFixtureCollision(
  newFixture: { x: number; y: number; specId: string; isExterior?: boolean },
  existingTables: PlacedTable[],
  existingFixtures: PlacedFixture[],
  venue?: Venue,
  excludeId?: string
): CollisionResult {
  const spacingSettings = getSpacingSettings();
  
  if (!spacingSettings.enableCollisionDetection) {
    return { collides: false, collidingItems: [], wallError: '' };
  }
  
  const fixtureTypes = getFixtureTypes();
  const spacing = spacingSettings.minFixtureSpacing || 1;
  
  const spec = fixtureTypes.find(s => s.id === newFixture.specId);
  if (!spec) {
    return { collides: false, collidingItems: [], wallError: '' };
  }
  
  const newBox: BoundingBox = {
    x: newFixture.x - spacing / 2,
    y: newFixture.y - spacing / 2,
    width: spec.width + spacing,
    height: spec.height + spacing
  };
  
  // Spacing configuration only applies to venue fixtures (interior, non-lodging, non-exterior)
  // and can be explicitly disabled per fixture type.
  const usesVenueFixtureSpacing = !newFixture.isExterior && !spec.isExterior && spec.category !== 'exterior' && spec.category !== 'lodging' && !spec.ignoreSpacingRules;

  // Check wall spacing first (only for venue fixtures)
  let wallError = '';
  if (venue && usesVenueFixtureSpacing) {
    const wallCheck = checkWallSpacing(
      { x: newFixture.x, y: newFixture.y, width: spec.width, height: spec.height },
      venue,
      'fixture'
    );
    if (!wallCheck.valid) {
      wallError = wallCheck.message;
    }
  }
  
  const collidingItems: string[] = [];
  
  // Check against existing tables (only for venue fixtures)
  if (usesVenueFixtureSpacing) {
    const tableSpecs = getTableSpecs();
    for (const table of existingTables) {
      if (table.id === excludeId) continue;
      
      const tableSpec = tableSpecs.find(s => s.id === table.specId);
      if (tableSpec?.isRoom) continue; // Fixtures don't collide with rooms
      
      const existingBox = getTableBoundingBoxWithChairs(table);
      if (boxesOverlap(newBox, existingBox)) {
        collidingItems.push(table.id);
      }
    }
  }
  
  // Check against existing fixtures (only venue fixtures participate in spacing rules)
  if (usesVenueFixtureSpacing) {
    for (const fixture of existingFixtures) {
      if (fixture.id === excludeId) continue;
      const existingSpec = fixtureTypes.find(s => s.id === fixture.specId);
      if (!existingSpec) continue;
      if (existingSpec.isExterior || existingSpec.category === 'exterior' || existingSpec.category === 'lodging' || existingSpec.ignoreSpacingRules) continue;
      
      const existingBox = getFixtureBoundingBox(fixture);
      if (boxesOverlap(newBox, existingBox)) {
        collidingItems.push(fixture.id);
      }
    }
  }
  
  return {
    collides: collidingItems.length > 0 || wallError !== '',
    collidingItems,
    wallError
  };
}

// Validate all items in a layout (for display warnings)
export function validateLayout(
  tables: PlacedTable[],
  fixtures: PlacedFixture[],
  venue: Venue
): { tableWarnings: Map<string, string>; fixtureWarnings: Map<string, string> } {
  const tableWarnings = new Map<string, string>();
  const fixtureWarnings = new Map<string, string>();
  const spacingSettings = getSpacingSettings();
  
  if (!spacingSettings.enableCollisionDetection) {
    return { tableWarnings, fixtureWarnings };
  }
  
  // Check each table
  for (const table of tables) {
    const box = getTableBoundingBoxWithChairs(table);
    const wallCheck = checkWallSpacing(box, venue, 'table');
    if (!wallCheck.valid) {
      tableWarnings.set(table.id, wallCheck.message);
      continue;
    }
    
    // Check against other tables
    for (const otherTable of tables) {
      if (otherTable.id === table.id) continue;
      const otherBox = getTableBoundingBoxWithChairs(otherTable);
      if (boxesOverlap(box, otherBox)) {
        tableWarnings.set(table.id, 'Table is too close to another table');
        break;
      }
    }
  }
  
  // Check each venue fixture only (spacing config does not apply to lodging/exterior fixtures)
  for (const fixture of fixtures) {
    const fixtureTypes = getFixtureTypes();
    const spec = fixtureTypes.find(s => s.id === fixture.specId);
    if (!spec) continue;
    if (spec.isExterior || spec.category === 'exterior' || spec.category === 'lodging' || spec.ignoreSpacingRules) continue;
    
    const box: BoundingBox = { x: fixture.x, y: fixture.y, width: spec.width, height: spec.height };
    const wallCheck = checkWallSpacing(box, venue, 'fixture');
    if (!wallCheck.valid) {
      fixtureWarnings.set(fixture.id, wallCheck.message);
    }
  }
  
  return { tableWarnings, fixtureWarnings };
}
