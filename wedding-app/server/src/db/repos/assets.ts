import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { issueCapabilitySecret, verifyCapabilitySecret } from '../../lib/capability.js';

export type AssetVisibility = 'private' | 'public' | 'capability';
export type AssetPublishStatus = 'draft' | 'approved' | 'rejected';
export type AssetAudience = 'guest' | 'vendor' | 'planner' | 'external';
export interface AssetRow { id:string; organization_id:string; event_id:string|null; owner_type:string; owner_id:string; storage_key:string; original_filename:string; mime_type:string|null; visibility:AssetVisibility; publish_status:AssetPublishStatus; created_by:string|null; created_at:string; updated_at:string; }
export interface AssetCapabilityRow { id:string; asset_id:string; token_hash:string; token_salt:string; audience:AssetAudience; expires_at:string; revoked_at:string|null; created_by:string|null; last_used_at:string|null; created_at:string; }

export const assetsRepo = {
  create(input: Omit<AssetRow,'id'|'created_at'|'updated_at'>): AssetRow {
    const id=uuid(); db.prepare(`INSERT INTO assets (id,organization_id,event_id,owner_type,owner_id,storage_key,original_filename,mime_type,visibility,publish_status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.organization_id,input.event_id,input.owner_type,input.owner_id,input.storage_key,input.original_filename,input.mime_type,input.visibility,input.publish_status,input.created_by); return this.findById(id)!;
  },
  findById(id:string): AssetRow|undefined { return db.prepare('SELECT * FROM assets WHERE id=?').get(id) as AssetRow|undefined; },
  findByOwner(type:string,id:string): AssetRow|undefined { return db.prepare('SELECT * FROM assets WHERE owner_type=? AND owner_id=?').get(type,id) as AssetRow|undefined; },
  issueCapability(assetId:string,audience:AssetAudience,expiresAt:string,createdBy?:string|null) { const secret=issueCapabilitySecret(); const id=uuid(); db.prepare('INSERT INTO asset_capabilities (id,asset_id,token_hash,token_salt,audience,expires_at,created_by) VALUES (?,?,?,?,?,?,?)').run(id,assetId,secret.hash,secret.salt,audience,expiresAt,createdBy??null); return { token: secret.token, row: db.prepare('SELECT * FROM asset_capabilities WHERE id=?').get(id) as AssetCapabilityRow }; },
  verifyCapability(assetId:string,token:string,audience?:AssetAudience): AssetCapabilityRow|undefined { const rows=db.prepare(`SELECT * FROM asset_capabilities WHERE asset_id=? AND revoked_at IS NULL AND expires_at > datetime('now')`).all(assetId) as AssetCapabilityRow[]; const row=rows.find(r => (!audience||r.audience===audience)&&verifyCapabilitySecret(token,r)); if(row) db.prepare("UPDATE asset_capabilities SET last_used_at=datetime('now') WHERE id=?").run(row.id); return row; },
  revokeCapability(id:string){ return db.prepare("UPDATE asset_capabilities SET revoked_at=datetime('now') WHERE id=? AND revoked_at IS NULL").run(id).changes>0; },
};
