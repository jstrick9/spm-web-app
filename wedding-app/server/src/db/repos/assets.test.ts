import '../../test/setup.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database.js';
import { applyAllMigrations } from '../migrate.js';
import { assetsRepo } from './assets.js';

describe('assetsRepo capabilities', () => {
  beforeEach(() => { applyAllMigrations({ quiet: true }); db.prepare('DELETE FROM asset_capabilities').run(); db.prepare('DELETE FROM assets').run(); db.pragma('foreign_keys = OFF'); });
  it('issues, verifies, records use, rejects wrong audience, and revokes a capability', () => {
    const asset = assetsRepo.create({ organization_id: 'org', event_id: null, owner_type: 'vendor_coi', owner_id: 'vendor', storage_key: '/uploads/private/coi.pdf', original_filename: 'coi.pdf', mime_type: 'application/pdf', visibility: 'capability', publish_status: 'approved', created_by: null });
    const issued = assetsRepo.issueCapability(asset.id, 'vendor', '2999-01-01T00:00:00.000Z');
    expect(assetsRepo.verifyCapability(asset.id, issued.token, 'guest')).toBeUndefined();
    expect(assetsRepo.verifyCapability(asset.id, issued.token, 'vendor')?.id).toBe(issued.row.id);
    expect(db.prepare('SELECT last_used_at FROM asset_capabilities WHERE id=?').get(issued.row.id)).toMatchObject({ last_used_at: expect.any(String) });
    expect(assetsRepo.revokeCapability(issued.row.id)).toBe(true);
    expect(assetsRepo.verifyCapability(asset.id, issued.token, 'vendor')).toBeUndefined();
  });
  it('rejects expired capabilities', () => {
    const asset = assetsRepo.create({ organization_id: 'org', event_id: null, owner_type: 'vendor_coi', owner_id: 'vendor2', storage_key: '/uploads/private/coi2.pdf', original_filename: 'coi2.pdf', mime_type: 'application/pdf', visibility: 'capability', publish_status: 'approved', created_by: null });
    const issued = assetsRepo.issueCapability(asset.id, 'vendor', '2000-01-01T00:00:00.000Z');
    expect(assetsRepo.verifyCapability(asset.id, issued.token, 'vendor')).toBeUndefined();
  });
});
