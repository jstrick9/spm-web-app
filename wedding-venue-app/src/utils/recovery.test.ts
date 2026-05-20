import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./backupExport', () => ({
  buildBackupBundle: vi.fn(async (actor?: { id?: string; name?: string }) => ({
    manifest: {
      app: 'seven-paths-manor-layout-planner',
      bundleVersion: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: actor,
      source: 'browser-local-storage',
    },
    summary: {
      venueCount: 0,
      templateCount: 0,
      userCount: 0,
      savedLayoutCount: 0,
      decorItemCount: 0,
      decorArrangementCount: 0,
      guestPortalSubmissionCount: 0,
    },
    checksums: {
      payloadHash: 'mock-hash',
    },
    payload: {},
  })),
}));

import {
  buildProjectHealthReport,
  createEmergencyRecoverySnapshot,
  getEmergencyRecoverySnapshot,
  quarantineStorageKey,
  recoverCorruptDomains,
  resetStorageDomain,
} from './recovery';

function getAllStorageKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
    (key): key is string => Boolean(key),
  );
}

describe('recovery helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports healthy and corrupt domains', () => {
    localStorage.setItem('spm_venues', JSON.stringify([{ id: 'v1' }]));
    localStorage.setItem('spm_templates', '{bad-json');

    const report = buildProjectHealthReport();

    const venues = report.domains.find((d) => d.key === 'spm_venues');
    const templates = report.domains.find((d) => d.key === 'spm_templates');

    expect(venues?.status).toBe('healthy');
    expect(templates?.status).toBe('corrupt');
    expect(report.overallStatus).toBe('corrupt');
  });

  it('quarantines a domain and removes the original key', () => {
    localStorage.setItem('spm_templates', '{bad-json');
    const backupKey = quarantineStorageKey('spm_templates');

    expect(backupKey).toBeTruthy();
    expect(localStorage.getItem('spm_templates')).toBeNull();
    expect(localStorage.getItem(backupKey!)).toBe('{bad-json');
  });

  it('resets a domain to provided defaults', () => {
    localStorage.setItem('spm_templates', '{bad-json');
    resetStorageDomain('spm_templates', []);

    expect(localStorage.getItem('spm_templates')).toBe('[]');
  });

  it('recovers corrupt domains by quarantining and replacing with defaults', () => {
    localStorage.setItem('spm_templates', '{bad-json');

    const repaired = recoverCorruptDomains();

    expect(repaired.length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('spm_templates') || 'null')).toEqual(
      [],
    );

    expect(
      getAllStorageKeys().some((key) =>
        key.startsWith('spm_quarantine_spm_templates_'),
      ),
    ).toBe(true);
  });

  it('stores and retrieves an emergency recovery snapshot', async () => {
    const snapshot = await createEmergencyRecoverySnapshot({
      id: 'u1',
      name: 'Jane',
    });

    expect(snapshot.manifest.app).toBe('seven-paths-manor-layout-planner');

    const stored = getEmergencyRecoverySnapshot();
    expect(stored?.manifest.app).toBe('seven-paths-manor-layout-planner');
    expect(stored?.manifest.exportedBy?.name).toBe('Jane');
  });
});