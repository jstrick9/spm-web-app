import { getConfig } from '../config';
import {
  getDecorArrangements,
  getDecorCategories,
  getDecorItems,
  getDecorPackages,
  getFixtureTypes,
  getGuidelines,
  getLinenColors,
  getSavedLayouts,
  getTableSpecs,
  getTemplates,
  getUsers,
  getVenues,
} from '../hooks/useLayoutState';
import {
  getChairSpecs,
  getSpacingSettings,
  getWallStyles,
} from '../data/venueData';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { BackupBundle, BackupBundleSummary, BackupPayload } from './backupTypes';

const BUNDLE_VERSION = 1;

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function buildSummary(payload: BackupPayload): BackupBundleSummary {
  return {
    venueCount: Array.isArray(payload.venues) ? payload.venues.length : 0,
    templateCount: Array.isArray(payload.templates) ? payload.templates.length : 0,
    userCount: Array.isArray(payload.users) ? payload.users.length : 0,
    savedLayoutCount: Array.isArray(payload.savedLayouts) ? payload.savedLayouts.length : 0,
    decorItemCount: Array.isArray(payload.decorItems) ? payload.decorItems.length : 0,
    decorArrangementCount: Array.isArray(payload.decorArrangements)
      ? payload.decorArrangements.length
      : 0,
    guestPortalSubmissionCount: Array.isArray(payload.rsvpSubmissions)
      ? payload.rsvpSubmissions.length
      : 0,
  };
}

export async function buildBackupBundle(actor?: {
  id?: string;
  name?: string;
}): Promise<BackupBundle> {
  const payload: BackupPayload = {
    config: getConfig(),
    venues: getVenues(),
    tableSpecs: getTableSpecs(),
    fixtureTypes: getFixtureTypes(),
    guidelines: getGuidelines(),
    templates: getTemplates(),
    users: getUsers(),
    linenColors: getLinenColors(),
    chairSpecs: getChairSpecs(),
    wallStyles: getWallStyles(),
    spacingSettings: getSpacingSettings(),
    savedLayouts: getSavedLayouts(),
    decorItems: getDecorItems(),
    decorCategories: getDecorCategories(),
    decorArrangements: getDecorArrangements(),
    decorPackages: getDecorPackages(),
    eventRoles: readJson(STORAGE_KEYS.EVENT_ROLES, []),
    eventQuestions: readJson(STORAGE_KEYS.EVENT_QUESTIONS, []),
    eventAnswers: readJson(STORAGE_KEYS.EVENT_ANSWERS, []),
    eventSubmissions: readJson(STORAGE_KEYS.EVENT_SUBMISSIONS, []),
    directMessages: readJson(STORAGE_KEYS.DIRECT_MESSAGES, []),
    portalConfig: readJson(STORAGE_KEYS.PORTAL_CONFIG, null),
    portalGuests: readJson(STORAGE_KEYS.PORTAL_GUESTS, []),
    rsvpSubmissions: readJson(STORAGE_KEYS.RSVP_SUBMISSIONS, []),
    staffTasks: readJson(STORAGE_KEYS.STAFF_TASKS, []),
    staffAreas: readJson(STORAGE_KEYS.STAFF_AREAS, []),
    staffShifts: readJson(STORAGE_KEYS.STAFF_SHIFTS, []),
  };

  const summary = buildSummary(payload);
  const payloadJson = JSON.stringify(payload);
  const payloadHash = await sha256(payloadJson);

  return {
    manifest: {
      app: 'seven-paths-manor-layout-planner',
      bundleVersion: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: actor,
      source: 'browser-local-storage',
    },
    summary,
    checksums: {
      payloadHash,
    },
    payload,
  };
}

export async function downloadBackupBundle(actor?: {
  id?: string;
  name?: string;
}): Promise<void> {
  const bundle = await buildBackupBundle(actor);
  const content = JSON.stringify(bundle, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}