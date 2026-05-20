import { STORAGE_KEYS } from '../constants/storageKeys';
import { STORAGE_VERSIONS } from '../constants/storageVersions';
import { saveVersionedStorage } from './storage';
import type { BackupBundle, BackupImportReport, BackupPayload } from './backupTypes';
import { emitDataChanged } from './appEvents';
import { buildBackupBundle } from './backupExport';
import {
  validateDecorArrangement,
  validateDecorItem,
  validateDecorPackage,
  validateEventQuestion,
  validateFixtureType,
  validateTableSpec,
  validateTemplate,
  validateUser,
  validateVenue,
} from './validators';

const ROLLBACK_KEY = STORAGE_KEYS.BACKUP_ROLLBACK;

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function parseBackupBundle(text: string): Promise<BackupBundle> {
  return JSON.parse(text) as BackupBundle;
}

export async function preflightBackupImport(
  bundle: BackupBundle,
): Promise<BackupImportReport> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle?.manifest || bundle.manifest.app !== 'seven-paths-manor-layout-planner') {
    errors.push(
      'Backup file is not a recognized Seven Paths Manor backup bundle.',
    );
  }

  if (!bundle?.payload) {
    errors.push('Backup payload is missing.');
  }

  if (bundle?.payload) {
    const computedHash = await sha256(JSON.stringify(bundle.payload));
    if (bundle?.checksums?.payloadHash !== computedHash) {
      errors.push(
        'Backup checksum does not match payload. The file may be corrupted or modified.',
      );
    }
  }

  const payload = bundle?.payload || {};

  const validateArray = <T>(
    label: string,
    value: unknown,
    validator: (item: T) => {
      valid: boolean;
      issues: { message: string; severity: 'error' | 'warning' }[];
    },
  ) => {
    if (!Array.isArray(value)) return;

    value.forEach((item, index) => {
      const result = validator(item as T);
      result.issues.forEach((issue) => {
        const line = `${label} ${index + 1}: ${issue.message}`;
        if (issue.severity === 'error') {
          errors.push(line);
        } else {
          warnings.push(line);
        }
      });
    });
  };

  validateArray('Venue', payload.venues, validateVenue as any);
  validateArray('Table Spec', payload.tableSpecs, validateTableSpec as any);
  validateArray('Fixture Type', payload.fixtureTypes, validateFixtureType as any);
  validateArray('Template', payload.templates, validateTemplate as any);
  validateArray('User', payload.users, validateUser as any);
  validateArray('Event Question', payload.eventQuestions, validateEventQuestion as any);
  validateArray('Decor Item', payload.decorItems, validateDecorItem as any);
  validateArray(
    'Decor Arrangement',
    payload.decorArrangements,
    validateDecorArrangement as any,
  );
  validateArray('Decor Package', payload.decorPackages, validateDecorPackage as any);

  if (payload.eventRoles !== undefined && !Array.isArray(payload.eventRoles)) {
    warnings.push('Event Roles: expected an array, import may ignore malformed values.');
  }

  if (payload.savedLayouts !== undefined && !Array.isArray(payload.savedLayouts)) {
    warnings.push('Saved Layouts: expected an array, import may ignore malformed values.');
  }

  if (payload.portalGuests !== undefined && !Array.isArray(payload.portalGuests)) {
    warnings.push('Portal Guests: expected an array, import may ignore malformed values.');
  }

  if (payload.rsvpSubmissions !== undefined && !Array.isArray(payload.rsvpSubmissions)) {
    warnings.push('RSVP Submissions: expected an array, import may ignore malformed values.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: bundle?.summary,
  };
}

export async function snapshotCurrentProjectForRollback(actor?: {
  id?: string;
  name?: string;
}): Promise<void> {
  const bundle = await buildBackupBundle(actor);
  localStorage.setItem(ROLLBACK_KEY, JSON.stringify(bundle));
}

function writeJson(key: string, value: unknown): void {
  if (value === undefined) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function writeVersioned(key: string, version: number, value: unknown): void {
  if (value === undefined) return;
  saveVersionedStorage(key, version, value);
}

export function applyBackupPayload(
  payload: BackupPayload,
  mode: 'replace' | 'merge' = 'replace',
): void {
  if (mode !== 'replace') {
    throw new Error('Only replace mode is currently supported.');
  }

  writeVersioned(STORAGE_KEYS.CONFIG, STORAGE_VERSIONS.CONFIG, payload.config);
  writeJson(STORAGE_KEYS.VENUES, payload.venues);
  writeJson(STORAGE_KEYS.TABLE_SPECS, payload.tableSpecs);
  writeJson(STORAGE_KEYS.FIXTURE_TYPES, payload.fixtureTypes);
  writeJson(STORAGE_KEYS.GUIDELINES, payload.guidelines);
  writeJson(STORAGE_KEYS.TEMPLATES, payload.templates);
  writeJson(STORAGE_KEYS.USERS, payload.users);
  writeJson(STORAGE_KEYS.LINEN_COLORS, payload.linenColors);
  writeJson(STORAGE_KEYS.SAVED_LAYOUTS, payload.savedLayouts);
  writeJson(STORAGE_KEYS.DECOR_ITEMS, payload.decorItems);
  writeJson(STORAGE_KEYS.DECOR_CATEGORIES, payload.decorCategories);
  writeJson(STORAGE_KEYS.DECOR_ARRANGEMENTS, payload.decorArrangements);
  writeJson(STORAGE_KEYS.DECOR_PACKAGES, payload.decorPackages);
  writeJson(STORAGE_KEYS.EVENT_ROLES, payload.eventRoles);
  writeJson(STORAGE_KEYS.EVENT_QUESTIONS, payload.eventQuestions);
  writeJson(STORAGE_KEYS.EVENT_ANSWERS, payload.eventAnswers);
  writeJson(STORAGE_KEYS.EVENT_SUBMISSIONS, payload.eventSubmissions);
  writeVersioned(STORAGE_KEYS.DIRECT_MESSAGES, STORAGE_VERSIONS.DIRECT_MESSAGES, payload.directMessages);
  writeVersioned(STORAGE_KEYS.PORTAL_CONFIG, STORAGE_VERSIONS.PORTAL_CONFIG, payload.portalConfig);
  writeVersioned(STORAGE_KEYS.PORTAL_GUESTS, STORAGE_VERSIONS.PORTAL_GUESTS, payload.portalGuests);
  writeVersioned(STORAGE_KEYS.RSVP_SUBMISSIONS, STORAGE_VERSIONS.RSVP_SUBMISSIONS, payload.rsvpSubmissions);
  writeJson(STORAGE_KEYS.STAFF_TASKS, payload.staffTasks);
  writeJson(STORAGE_KEYS.STAFF_AREAS, payload.staffAreas);
  writeJson(STORAGE_KEYS.STAFF_SHIFTS, payload.staffShifts);

  emitDataChanged('all');
}

export function getRollbackBackup(): BackupBundle | null {
  try {
    const raw = localStorage.getItem(ROLLBACK_KEY);
    return raw ? (JSON.parse(raw) as BackupBundle) : null;
  } catch {
    return null;
  }
}