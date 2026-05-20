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
  getVenues: () => [{ id: 'v1', name: 'Venue 1' }],
  getTableSpecs: () => [{ id: 't1', name: 'Table 1' }],
  getFixtureTypes: () => [{ id: 'f1', name: 'Fixture 1' }],
  getGuidelines: () => [{ id: 'g1', title: 'Guideline 1' }],
  getTemplates: () => [{ id: 'tpl1', name: 'Template 1' }],
  getUsers: () => [{ id: 'u1', username: 'admin' }],
  getSavedLayouts: () => [{ id: 'l1', name: 'Layout 1' }],
  getDecorItems: () => [{ id: 'd1', name: 'Decor Item 1' }],
  getDecorCategories: () => [{ id: 'dc1', name: 'Decor Category 1' }],
  getDecorArrangements: () => [{ id: 'da1', name: 'Decor Arrangement 1' }],
  getDecorPackages: () => [{ id: 'dp1', name: 'Decor Package 1' }],
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

describe('backup export', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds a backup bundle with manifest, summary, and checksum', async () => {
    localStorage.setItem('spm_rsvp_submissions', JSON.stringify([{ id: 'r1' }]));

    const bundle = await buildBackupBundle({ id: 'u1', name: 'Jane' });

    expect(bundle.manifest.app).toBe('seven-paths-manor-layout-planner');
    expect(bundle.manifest.exportedBy?.name).toBe('Jane');
    expect(bundle.manifest.bundleVersion).toBe(1);
    expect(bundle.summary.venueCount).toBe(1);
    expect(bundle.summary.templateCount).toBe(1);
    expect(bundle.summary.userCount).toBe(1);
    expect(bundle.summary.savedLayoutCount).toBe(1);
    expect(bundle.summary.decorItemCount).toBe(1);
    expect(bundle.summary.decorArrangementCount).toBe(1);
    expect(bundle.summary.guestPortalSubmissionCount).toBe(1);
    expect(bundle.checksums.payloadHash).toBeTruthy();
  });

  it('includes named payload domains', async () => {
    localStorage.setItem('spm_event_roles', JSON.stringify(['Bride', 'Groom']));

    const bundle = await buildBackupBundle();

    expect(bundle.payload.config).toBeTruthy();
    expect(Array.isArray(bundle.payload.venues)).toBe(true);
    expect(Array.isArray(bundle.payload.tableSpecs)).toBe(true);
    expect(Array.isArray(bundle.payload.fixtureTypes)).toBe(true);
    expect(Array.isArray(bundle.payload.templates)).toBe(true);
    expect(Array.isArray(bundle.payload.users)).toBe(true);
    expect(bundle.payload.eventRoles).toEqual(['Bride', 'Groom']);
  });

  it('falls back safely when optional raw localStorage domains are malformed', async () => {
    localStorage.setItem('spm_event_questions', '{bad-json');

    const bundle = await buildBackupBundle();

    expect(bundle.payload.eventQuestions).toEqual([]);
  });
});