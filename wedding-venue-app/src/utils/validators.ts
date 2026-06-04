import type {
  DecorArrangement,
  DecorItem,
  DecorPackage,
  EventQuestion,
  FixtureType,
  ImageItem,
  LayoutTemplate,
  Point,
  TableSpec,
  User,
  Venue,
} from '../types';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult<T> {
  valid: boolean;
  value: T;
  issues: ValidationIssue[];
}

function issue(
  path: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
): ValidationIssue {
  return { path, message, severity };
}

function isFinitePositive(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, num);
}

function sanitizeString(value: unknown): string {
  return String(value ?? '').trim();
}

function sanitizeImageItems(images: unknown): ImageItem[] {
  if (!Array.isArray(images)) return [];

  return images
    .map((img, index) => ({
      id: sanitizeString((img as { id?: unknown })?.id) || `image-${index + 1}`,
      url: sanitizeString((img as { url?: unknown })?.url),
      label: sanitizeString((img as { label?: unknown })?.label),
    }))
    .filter((img) => img.url.length > 0);
}

function sanitizePoints(points: unknown): Point[] {
  if (!Array.isArray(points)) return [];

  return points
    .map((p) => ({
      x: clampNonNegativeNumber((p as { x?: unknown })?.x),
      y: clampNonNegativeNumber((p as { y?: unknown })?.y),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateVenue(venue: Venue): ValidationResult<Venue> {
  const issues: ValidationIssue[] = [];

  const value: Venue = {
    ...venue,
    id: sanitizeString(venue.id),
    name: sanitizeString(venue.name),
    width: clampNonNegativeNumber(venue.width),
    height: clampNonNegativeNumber(venue.height),
    capacity: Math.floor(clampNonNegativeNumber(venue.capacity)),
    images: sanitizeImageItems(venue.images),
    shapePoints: sanitizePoints(venue.shapePoints),
  };

  if (!value.id) issues.push(issue('id', 'Venue ID is required.'));
  if (!value.name) issues.push(issue('name', 'Venue name is required.'));
  if (!isFinitePositive(value.width)) {
    issues.push(issue('width', 'Venue width must be greater than 0.'));
  }
  if (!isFinitePositive(value.height)) {
    issues.push(issue('height', 'Venue height must be greater than 0.'));
  }
  if (value.capacity < 0) {
    issues.push(issue('capacity', 'Venue capacity cannot be negative.'));
  }

  if (value.shape === 'custom' && value.shapePoints && value.shapePoints.length < 3) {
    issues.push(issue('shapePoints', 'Custom venues require at least 3 shape points.'));
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateTableSpec(spec: TableSpec): ValidationResult<TableSpec> {
  const issues: ValidationIssue[] = [];

  const value: TableSpec = {
    ...spec,
    id: sanitizeString(spec.id),
    name: sanitizeString(spec.name),
    width: clampNonNegativeNumber(spec.width),
    height: clampNonNegativeNumber(spec.height),
    capacity: Math.floor(clampNonNegativeNumber(spec.capacity)),
    images: sanitizeImageItems(spec.images),
    polygonPoints: sanitizePoints(spec.polygonPoints),
  };

  if (!value.id) issues.push(issue('id', 'Table ID is required.'));
  if (!value.name) issues.push(issue('name', 'Table name is required.'));
  if (!isFinitePositive(value.width)) {
    issues.push(issue('width', 'Table width must be greater than 0.'));
  }
  if (!isFinitePositive(value.height)) {
    issues.push(issue('height', 'Table height must be greater than 0.'));
  }
  if (value.capacity < 0) {
    issues.push(issue('capacity', 'Table capacity cannot be negative.'));
  }

  if (value.isSeatingType) {
    if ((value.seatingRowCount ?? 0) <= 0) {
      issues.push(issue('seatingRowCount', 'Seating types must have at least 1 row.'));
    }
    if ((value.seatingRowSpacing ?? 0) <= 0) {
      issues.push(
        issue('seatingRowSpacing', 'Seating row spacing must be greater than 0.'),
      );
    }
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateFixtureType(fixture: FixtureType): ValidationResult<FixtureType> {
  const issues: ValidationIssue[] = [];

  const value: FixtureType = {
    ...fixture,
    id: sanitizeString(fixture.id),
    name: sanitizeString(fixture.name),
    width: clampNonNegativeNumber(fixture.width),
    height: clampNonNegativeNumber(fixture.height),
    images: sanitizeImageItems(fixture.images),
  };

  if (!value.id) issues.push(issue('id', 'Fixture ID is required.'));
  if (!value.name) issues.push(issue('name', 'Fixture name is required.'));
  if (!isFinitePositive(value.width)) {
    issues.push(issue('width', 'Fixture width must be greater than 0.'));
  }
  if (!isFinitePositive(value.height)) {
    issues.push(issue('height', 'Fixture height must be greater than 0.'));
  }

  if (value.isRoom && (value.capacity ?? 0) < 0) {
    issues.push(issue('capacity', 'Room fixture capacity cannot be negative.'));
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateTemplate(template: LayoutTemplate): ValidationResult<LayoutTemplate> {
  const issues: ValidationIssue[] = [];

  const value: LayoutTemplate = {
    ...template,
    id: sanitizeString(template.id),
    name: sanitizeString(template.name),
    venueId: sanitizeString(template.venueId),
    tables: Array.isArray(template.tables) ? template.tables : [],
    fixtures: Array.isArray(template.fixtures) ? template.fixtures : [],
  };

  if (!value.id) issues.push(issue('id', 'Template ID is required.'));
  if (!value.name) issues.push(issue('name', 'Template name is required.'));
  if (!value.venueId) issues.push(issue('venueId', 'Template venue is required.'));

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateUser(user: User): ValidationResult<User> {
  const issues: ValidationIssue[] = [];

  const value: User = {
    ...user,
    id: sanitizeString(user.id),
    username: sanitizeString(user.username),
    name: sanitizeString(user.name),
    email: sanitizeString(user.email),
    contactPhoneNumber: sanitizeString(user.contactPhoneNumber),
  };

  if (!value.id) issues.push(issue('id', 'User ID is required.'));
  if (!value.username) issues.push(issue('username', 'Username is required.'));
  if (!value.name) issues.push(issue('name', 'User name is required.'));

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateEventQuestion(question: EventQuestion): ValidationResult<EventQuestion> {
  const issues: ValidationIssue[] = [];

  const value: EventQuestion = {
    ...question,
    id: sanitizeString(question.id),
    text: sanitizeString(question.text),
    options: Array.isArray(question.options)
      ? uniqueBy(
          question.options.map((o) => sanitizeString(o)).filter(Boolean),
          (o) => o.toLowerCase(),
        )
      : undefined,
  };

  if (!value.id) issues.push(issue('id', 'Question ID is required.'));
  if (!value.text) issues.push(issue('text', 'Question text is required.'));
  if (value.answerType === 'dropdown' && (!value.options || value.options.length === 0)) {
    issues.push(issue('options', 'Dropdown questions must include at least one option.'));
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateDecorItem(item: DecorItem): ValidationResult<DecorItem> {
  const issues: ValidationIssue[] = [];

  const value: DecorItem = {
    ...item,
    id: sanitizeString(item.id),
    name: sanitizeString(item.name),
    categoryId: sanitizeString(item.categoryId),
    width: clampNonNegativeNumber(item.width),
    height: clampNonNegativeNumber(item.height),
    images: sanitizeImageItems(item.images),
  };

  if (!value.id) issues.push(issue('id', 'Decor item ID is required.'));
  if (!value.name) issues.push(issue('name', 'Decor item name is required.'));
  if (!value.categoryId) issues.push(issue('categoryId', 'Decor item category is required.'));
  if (!isFinitePositive(value.width)) {
    issues.push(issue('width', 'Decor item width must be greater than 0.'));
  }
  if (!isFinitePositive(value.height)) {
    issues.push(issue('height', 'Decor item height must be greater than 0.'));
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateDecorArrangement(
  arrangement: DecorArrangement,
): ValidationResult<DecorArrangement> {
  const issues: ValidationIssue[] = [];

  const value: DecorArrangement = {
    ...arrangement,
    id: sanitizeString(arrangement.id),
    name: sanitizeString(arrangement.name),
    userId: sanitizeString(arrangement.userId),
    items: Array.isArray(arrangement.items) ? arrangement.items : [],
  };

  if (!value.id) issues.push(issue('id', 'Arrangement ID is required.'));
  if (!value.name) issues.push(issue('name', 'Arrangement name is required.'));
  if (value.items.length === 0) {
    issues.push(issue('items', 'Arrangement must include at least one decor item.'));
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateDecorPackage(pkg: DecorPackage): ValidationResult<DecorPackage> {
  const issues: ValidationIssue[] = [];

  const value: DecorPackage = {
    ...pkg,
    id: sanitizeString(pkg.id),
    name: sanitizeString(pkg.name),
    style: sanitizeString(pkg.style),
    arrangements: Array.isArray(pkg.arrangements) ? pkg.arrangements : [],
  };

  if (!value.id) issues.push(issue('id', 'Decor package ID is required.'));
  if (!value.name) issues.push(issue('name', 'Decor package name is required.'));
  if (value.arrangements.length === 0) {
    issues.push(issue('arrangements', 'Decor package must include at least one arrangement mapping.'));
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    value,
    issues,
  };
}

export function validateTemplateReferences(
  templates: LayoutTemplate[],
  venues: Venue[],
  tableSpecs: TableSpec[],
  fixtureTypes: FixtureType[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const venueIds = new Set(venues.map((v) => v.id));
  const tableSpecIds = new Set(tableSpecs.map((t) => t.id));
  const fixtureTypeIds = new Set(fixtureTypes.map((f) => f.id));

  templates.forEach((template, index) => {
    if (!venueIds.has(template.venueId)) {
      issues.push(
        issue(`templates[${index}].venueId`, `Missing venue reference: ${template.venueId}`),
      );
    }

    template.tables.forEach((table, tableIndex) => {
      if (!tableSpecIds.has(table.specId)) {
        issues.push(
          issue(
            `templates[${index}].tables[${tableIndex}].specId`,
            `Missing table spec reference: ${table.specId}`,
          ),
        );
      }
    });

    template.fixtures.forEach((fixture, fixtureIndex) => {
      if (!fixtureTypeIds.has(fixture.specId)) {
        issues.push(
          issue(
            `templates[${index}].fixtures[${fixtureIndex}].specId`,
            `Missing fixture type reference: ${fixture.specId}`,
          ),
        );
      }
    });
  });

  return issues;
}

export function validateVenueMasterLayoutReferences(
  venues: Venue[],
  tableSpecs: TableSpec[],
  fixtureTypes: FixtureType[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tableSpecIds = new Set(tableSpecs.map((t) => t.id));
  const fixtureTypeIds = new Set(fixtureTypes.map((f) => f.id));

  venues.forEach((venue, venueIndex) => {
    const master = venue.masterLayout;
    if (!master) return;

    (master.tables || []).forEach((table, tableIndex) => {
      if (!tableSpecIds.has(table.specId)) {
        issues.push(
          issue(
            `venues[${venueIndex}].masterLayout.tables[${tableIndex}].specId`,
            `Missing table spec reference: ${table.specId}`,
          ),
        );
      }
    });

    (master.fixtures || []).forEach((fixture, fixtureIndex) => {
      if (!fixtureTypeIds.has(fixture.specId)) {
        issues.push(
          issue(
            `venues[${venueIndex}].masterLayout.fixtures[${fixtureIndex}].specId`,
            `Missing fixture type reference: ${fixture.specId}`,
          ),
        );
      }
    });
  });

  return issues;
}

export function validateDecorReferences(
  arrangements: DecorArrangement[],
  items: DecorItem[],
  packages: DecorPackage[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const itemIds = new Set(items.map((i) => i.id));
  const arrangementIds = new Set(arrangements.map((a) => a.id));

  arrangements.forEach((arrangement, index) => {
    arrangement.items.forEach((item, itemIndex) => {
      if (!itemIds.has(item.decorItemId)) {
        issues.push(
          issue(
            `arrangements[${index}].items[${itemIndex}].decorItemId`,
            `Missing decor item reference: ${item.decorItemId}`,
          ),
        );
      }
    });
  });

  packages.forEach((pkg, index) => {
    pkg.arrangements.forEach((mapping, mappingIndex) => {
      if (!arrangementIds.has(mapping.arrangementId)) {
        issues.push(
          issue(
            `packages[${index}].arrangements[${mappingIndex}].arrangementId`,
            `Missing decor arrangement reference: ${mapping.arrangementId}`,
          ),
        );
      }
    });
  });

  return issues;
}