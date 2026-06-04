import { describe, expect, it } from 'vitest';
import {
  validateDecorReferences,
  validateEventQuestion,
  validateFixtureType,
  validateTableSpec,
  validateTemplate,
  validateTemplateReferences,
  validateVenue,
  validateVenueMasterLayoutReferences,
} from './validators';

describe('domain validators', () => {
  it('rejects invalid venues', () => {
    const result = validateVenue({
      id: '',
      name: '',
      width: 0,
      height: -1,
      capacity: -5,
      category: 'reception',
    } as any);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'id')).toBe(true);
    expect(result.issues.some((i) => i.path === 'width')).toBe(true);
    expect(result.issues.some((i) => i.path === 'height')).toBe(true);
  });

  it('rejects invalid table specs', () => {
    const result = validateTableSpec({
      id: '',
      name: '',
      width: 0,
      height: 0,
      capacity: -1,
      shape: 'rectangle',
    } as any);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'name')).toBe(true);
  });

  it('rejects invalid fixture types', () => {
    const result = validateFixtureType({
      id: '',
      name: '',
      width: 0,
      height: 0,
      shape: 'rectangle',
    } as any);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'id')).toBe(true);
  });

  it('rejects invalid templates', () => {
    const result = validateTemplate({
      id: '',
      name: '',
      venueId: '',
      tables: [],
      fixtures: [],
      category: 'reception',
      createdAt: new Date().toISOString(),
    } as any);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'venueId')).toBe(true);
  });

  it('rejects invalid dropdown event questions', () => {
    const result = validateEventQuestion({
      id: 'q1',
      text: 'Meal choice?',
      group: 'Reception',
      answerType: 'dropdown',
      options: [],
    } as any);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'options')).toBe(true);
  });
});

describe('reference integrity validators', () => {
  it('detects missing template references', () => {
    const issues = validateTemplateReferences(
      [
        {
          id: 'tpl1',
          name: 'Template 1',
          venueId: 'missing-venue',
          tables: [{ specId: 'missing-table' }],
          fixtures: [{ specId: 'missing-fixture' }],
          category: 'reception',
          createdAt: new Date().toISOString(),
        } as any,
      ],
      [],
      [],
      [],
    );

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.path.includes('venueId'))).toBe(true);
    expect(issues.some((i) => i.path.includes('tables'))).toBe(true);
    expect(issues.some((i) => i.path.includes('fixtures'))).toBe(true);
  });

  it('detects missing venue master-layout references', () => {
    const issues = validateVenueMasterLayoutReferences(
      [
        {
          id: 'venue1',
          name: 'Venue 1',
          width: 50,
          height: 40,
          capacity: 100,
          category: 'reception',
          masterLayout: {
            tables: [{ specId: 'missing-table' }],
            fixtures: [{ specId: 'missing-fixture' }],
            savedAt: new Date().toISOString(),
          },
        } as any,
      ],
      [],
      [],
    );

    expect(issues.some((i) => i.path.includes('masterLayout.tables'))).toBe(true);
    expect(issues.some((i) => i.path.includes('masterLayout.fixtures'))).toBe(true);
  });

  it('detects missing decor references', () => {
    const issues = validateDecorReferences(
      [
        {
          id: 'arr1',
          name: 'Arrangement',
          userId: 'u1',
          baseType: 'table',
          items: [{ decorItemId: 'missing-item' }],
          createdAt: new Date().toISOString(),
        } as any,
      ],
      [],
      [
        {
          id: 'pkg1',
          name: 'Package',
          style: 'Modern',
          arrangements: [{ arrangementId: 'missing-arrangement', targetCategory: 'reception' }],
        } as any,
      ],
    );

    expect(issues.some((i) => i.path.includes('decorItemId'))).toBe(true);
    expect(issues.some((i) => i.path.includes('arrangementId'))).toBe(true);
  });
});