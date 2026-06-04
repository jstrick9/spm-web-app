import { on } from './appEvents';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Seven Paths Manor',
    tagline: 'Where Your Love Story Unfolds',
    location: 'Spring Hope, NC',
    websiteUrl: 'https://www.sevenpathsmanor.com',
    supportEmail: 'events@sevenpathsmanor.com',
    logoUrl: '',
    primaryColor: '#4A1942',
    primaryDark: '#3d1a45',
    primaryLight: '#6b2c5c',
    accentColor: '#8B5A8B',
    backgroundColor: '#f3f4f6',
    textColor: '#1f2937',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFontFamily: 'Inter, system-ui, sans-serif',
    headerTextColor: '#FFFFFF',
    bodyTextColor: '#374151',
    accentTextColor: '#4A1942',
  }),
}));

vi.mock('../hooks/useLayoutState', () => ({
  getVenues: () => [
    {
      id: 'v1',
      name: 'Venue 1',
      width: 50,
      height: 40,
      capacity: 100,
      category: 'reception',
    },
  ],
  getTableSpecs: () => [
    {
      id: 't1',
      name: 'Table 1',
      shape: 'rectangle',
      width: 6,
      height: 3,
      capacity: 8,
    },
  ],
  getFixtureTypes: () => [
    {
      id: 'f1',
      name: 'Fixture 1',
      shape: 'rectangle',
      width: 4,
      height: 4,
    },
  ],
  getGuidelines: () => [{ id: 'g1', title: 'Guideline 1' }],
  getTemplates: () => [
    {
      id: 'tpl1',
      name: 'Template 1',
      venueId: 'v1',
      tables: [],
      fixtures: [],
      category: 'reception',
      createdAt: new Date().toISOString(),
    },
  ],
  getUsers: () => [
    {
      id: 'u1',
      username: 'admin',
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  getSavedLayouts: () => [{ id: 'l1', name: 'Layout 1' }],
  getDecorItems: () => [
    {
      id: 'd1',
      name: 'Decor Item 1',
      categoryId: 'c1',
      width: 1,
      height: 1,
    },
  ],
  getDecorCategories: () => [{ id: 'dc1', name: 'Decor Category 1' }],
  getDecorArrangements: () => [
    {
      id: 'da1',
      name: 'Decor Arrangement 1',
      userId: 'u1',
      baseType: 'table',
      items: [{ decorItemId: 'd1' }],
      createdAt: new Date().toISOString(),
    },
  ],
  getDecorPackages: () => [
    {
      id: 'dp1',
      name: 'Decor Package 1',
      style: 'Modern',
      arrangements: [{ arrangementId: 'da1', targetCategory: 'reception' }],
    },
  ],
  getLinenColors: () => [{ id: 'lc1', name: 'White' }],
}));

vi.mock('../data/venueData', () => ({
  getChairSpecs: () => [{ id: 'c1', name: 'Chair 1' }],
  getWallStyles: () => [{ id: 'w1', name: 'Wall 1' }],
  getSpacingSettings: () => ({
    minItemSpacing: 2,
    minWallSpacing: 1,
    minFixtureSpacing: 3,
    minTableSpacing: 3,
    enableCollisionDetection: true,
    showCollisionWarnings: true,
  }),
}));

import { buildBackupBundle } from './backupExport';
import {
  applyBackupPayload,
  getRollbackBackup,
  preflightBackupImport,
  snapshotCurrentProjectForRollback,
} from './backupImport';

describe('backup import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('passes preflight for a valid bundle', async () => {
    const bundle = await buildBackupBundle();
    const report = await preflightBackupImport(bundle);

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('fails preflight when checksum is wrong', async () => {
    const bundle = await buildBackupBundle();
    bundle.checksums.payloadHash = 'bad-hash';

    const report = await preflightBackupImport(bundle);

    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.toLowerCase().includes('checksum'))).toBe(
      true,
    );
  });

  it('applies backup payload into supported storage keys', () => {
    const event = vi.fn();
    const off = on('spm_data_changed', event);

    applyBackupPayload(
      {
        venues: [{ id: 'v1', name: 'Venue 1' }],
        templates: [{ id: 't1', name: 'Template 1' }],
      },
      'replace',
    );

    expect(JSON.parse(localStorage.getItem('spm_venues') || '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('spm_templates') || '[]')).toHaveLength(1);
    expect(event).toHaveBeenCalled();

    off();
  });

  it('stores and retrieves a rollback backup snapshot', async () => {
    await snapshotCurrentProjectForRollback({ id: 'u1', name: 'Jane' });

    const rollback = getRollbackBackup();
    expect(rollback).not.toBeNull();
    expect(rollback?.manifest.app).toBe('seven-paths-manor-layout-planner');
  });

  it('throws when unsupported merge mode is requested', () => {
    expect(() =>
      applyBackupPayload(
        {
          venues: [{ id: 'v1', name: 'Venue 1' }],
        },
        'merge',
      ),
    ).toThrow('Only replace mode is currently supported.');
  });
});