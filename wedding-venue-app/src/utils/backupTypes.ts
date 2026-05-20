export interface BackupBundleManifest {
  app: 'seven-paths-manor-layout-planner';
  bundleVersion: number;
  exportedAt: string;
  exportedBy?: {
    id?: string;
    name?: string;
  };
  source: 'browser-local-storage';
  storageVersions?: Record<string, number>;
}

export interface BackupBundleSummary {
  venueCount: number;
  templateCount: number;
  userCount: number;
  savedLayoutCount: number;
  decorItemCount: number;
  decorArrangementCount: number;
  guestPortalSubmissionCount: number;
}

export interface BackupBundleChecksums {
  payloadHash: string;
}

export interface BackupPayload {
  config?: unknown;
  venues?: unknown;
  tableSpecs?: unknown;
  fixtureTypes?: unknown;
  guidelines?: unknown;
  templates?: unknown;
  users?: unknown;
  linenColors?: unknown;
  chairSpecs?: unknown;
  wallStyles?: unknown;
  spacingSettings?: unknown;
  savedLayouts?: unknown;
  decorItems?: unknown;
  decorCategories?: unknown;
  decorArrangements?: unknown;
  decorPackages?: unknown;
  eventRoles?: unknown;
  eventQuestions?: unknown;
  eventAnswers?: unknown;
  eventSubmissions?: unknown;
  directMessages?: unknown;
  portalConfig?: unknown;
  portalGuests?: unknown;
  rsvpSubmissions?: unknown;
  staffTasks?: unknown;
  staffAreas?: unknown;
  staffShifts?: unknown;
}

export interface BackupBundle {
  manifest: BackupBundleManifest;
  summary: BackupBundleSummary;
  checksums: BackupBundleChecksums;
  payload: BackupPayload;
}

export interface BackupImportReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary?: BackupBundleSummary;
}