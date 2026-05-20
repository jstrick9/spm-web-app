import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from './storageKeys';

describe('STORAGE_KEYS', () => {
  it('includes core config and layout keys', () => {
    expect(STORAGE_KEYS.CONFIG).toBe('spm_config');
    expect(STORAGE_KEYS.VENUES).toBe('spm_venues');
    expect(STORAGE_KEYS.SAVED_LAYOUTS).toBe('spm_savedLayouts');
  });

  it('includes auth/session-related keys', () => {
    expect(STORAGE_KEYS.SESSION_V2).toBe('spm_session_v2');
    expect(STORAGE_KEYS.SESSION_LEGACY).toBe('spm_session');
    expect(STORAGE_KEYS.REMEMBERED_USER).toBe('spm_remembered_user');
    expect(STORAGE_KEYS.PASSWORD_RESET_CODE).toBe('spm_reset_code');
    expect(STORAGE_KEYS.WELCOME_HIDDEN).toBe('spm_welcome_hidden');
  });

  it('includes guest portal keys', () => {
    expect(STORAGE_KEYS.PORTAL_CONFIG).toBe('spm_portal_config');
    expect(STORAGE_KEYS.PORTAL_AUTH).toBe('spm_portal_auth');
    expect(STORAGE_KEYS.PORTAL_GUESTS).toBe('spm_portal_guests');
    expect(STORAGE_KEYS.RSVP_SUBMISSIONS).toBe('spm_rsvp_submissions');
  });

  it('includes editor settings keys', () => {
    expect(STORAGE_KEYS.CHAIR_SPECS_PRIMARY).toBe('spm_chair_specs');
    expect(STORAGE_KEYS.CHAIR_SPECS_LEGACY).toBe('spm_chairSpecs');
    expect(STORAGE_KEYS.WALL_STYLES).toBe('spm_wall_styles');
    expect(STORAGE_KEYS.SPACING_SETTINGS).toBe('spm_spacing_settings');
    expect(STORAGE_KEYS.ALIGNMENT_SETTINGS).toBe('spm_alignment_settings');
  });

  it('includes template/feature keys', () => {
    expect(STORAGE_KEYS.INDOOR_FEATURE_TEMPLATES).toBe('spm_indoor_feature_templates');
    expect(STORAGE_KEYS.OUTDOOR_FEATURE_TEMPLATES).toBe('spm_outdoor_feature_templates');
  });

  it('includes backup/recovery/collaboration keys', () => {
    expect(STORAGE_KEYS.LAYOUT_EDIT_SESSIONS).toBe('spm_layout_edit_sessions');
    expect(STORAGE_KEYS.BACKUP_ROLLBACK).toBe('spm_backup_rollback_latest');
    expect(STORAGE_KEYS.RECOVERY_SNAPSHOT).toBe('spm_recovery_emergency_snapshot');
  });

  it('contains only unique values', () => {
    const values = Object.values(STORAGE_KEYS);
    const uniqueValues = new Set(values);

    expect(uniqueValues.size).toBe(values.length);
  });
});