import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export type CoupleDocumentCategory = 'inspiration_photo' | 'insurance' | 'vendor_doc' | 'ceremony_doc' | 'playlist' | 'diagram' | 'permit' | 'guest_list' | 'menu' | 'contract' | 'post_event_gallery' | 'other';
export type CoupleDocumentVisibility = 'couple' | 'couple_venue' | 'planner' | 'vendor' | 'guest_visible';
export type CoupleDocumentApproval = 'draft' | 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface CoupleDocumentRow {
  id: string;
  organization_id: string;
  event_id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  category: CoupleDocumentCategory;
  visibility: CoupleDocumentVisibility;
  approval_status: CoupleDocumentApproval;
  version: number;
  notes: string | null;
  extracted_summary: string | null;
  uploaded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  history: string;
  created_at: string;
  updated_at: string;
}

function appendHistory(row: CoupleDocumentRow | null, actor: string | null, action: string, note?: string) {
  let history: unknown[] = [];
  try { history = row ? JSON.parse(row.history || '[]') : []; } catch { history = []; }
  return [...history, { at: new Date().toISOString(), actor, action, note }];
}

export const coupleDocumentsRepo = {
  listForEvent(eventId: string): CoupleDocumentRow[] {
    return db.prepare(`SELECT * FROM couple_documents WHERE event_id = ? ORDER BY category, created_at DESC`).all(eventId) as CoupleDocumentRow[];
  },

  findById(id: string): CoupleDocumentRow | undefined {
    return db.prepare(`SELECT * FROM couple_documents WHERE id = ?`).get(id) as CoupleDocumentRow | undefined;
  },

  create(input: {
    organizationId: string;
    eventId: string;
    filename: string;
    url: string;
    mimeType?: string;
    category: CoupleDocumentCategory;
    visibility?: CoupleDocumentVisibility;
    notes?: string;
    extractedSummary?: string;
    uploadedBy?: string | null;
    approvalStatus?: CoupleDocumentApproval;
  }): CoupleDocumentRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO couple_documents
       (id, organization_id, event_id, filename, url, mime_type, category, visibility, approval_status, notes, extracted_summary, uploaded_by, history)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.organizationId,
      input.eventId,
      input.filename,
      input.url,
      input.mimeType ?? null,
      input.category,
      input.visibility ?? 'couple_venue',
      input.approvalStatus ?? 'pending',
      input.notes ?? null,
      input.extractedSummary ?? null,
      input.uploadedBy ?? null,
      stringifyJson([{ at: new Date().toISOString(), actor: input.uploadedBy ?? 'system', action: 'document.upload', note: input.notes }]),
    );
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<{ category: CoupleDocumentCategory; visibility: CoupleDocumentVisibility; approvalStatus: CoupleDocumentApproval; notes: string; extractedSummary: string }>, actor?: string | null): CoupleDocumentRow | undefined {
    const current = this.findById(id);
    if (!current) return undefined;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.category) { fields.push('category = ?'); values.push(patch.category); }
    if (patch.visibility) { fields.push('visibility = ?'); values.push(patch.visibility); }
    if (patch.approvalStatus) { fields.push('approval_status = ?'); values.push(patch.approvalStatus); }
    if (patch.notes !== undefined) { fields.push('notes = ?'); values.push(patch.notes); }
    if (patch.extractedSummary !== undefined) { fields.push('extracted_summary = ?'); values.push(patch.extractedSummary); }
    if (patch.approvalStatus && patch.approvalStatus !== current.approval_status) { fields.push('reviewed_by = ?', 'reviewed_at = datetime(\'now\')'); values.push(actor ?? null); }
    fields.push('history = ?'); values.push(stringifyJson(appendHistory(current, actor ?? null, 'document.update', patch.notes)));
    fields.push('updated_at = datetime(\'now\')');
    values.push(id);
    db.prepare(`UPDATE couple_documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  newVersion(id: string, input: { filename: string; url: string; mimeType?: string; notes?: string; actor?: string | null; extractedSummary?: string }): CoupleDocumentRow | undefined {
    const current = this.findById(id);
    if (!current) return undefined;
    db.prepare(
      `UPDATE couple_documents
       SET filename = ?, url = ?, mime_type = ?, notes = ?, extracted_summary = ?, version = version + 1, approval_status = 'pending', history = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(input.filename, input.url, input.mimeType ?? current.mime_type, input.notes ?? current.notes, input.extractedSummary ?? current.extracted_summary, stringifyJson(appendHistory(current, input.actor ?? null, 'document.new_version', input.notes)), id);
    return this.findById(id);
  },

  /** MODULE-07 CP-05: remove a document row; returns its stored URL so the
   * caller can delete the backing file. */
  delete(id: string): { url: string; filename: string } | null {
    const current = db.prepare(`SELECT * FROM couple_documents WHERE id = ?`).get(id) as CoupleDocumentRow | undefined;
    if (!current) return null;
    db.prepare(`DELETE FROM couple_documents WHERE id = ?`).run(id);
    return { url: current.url, filename: current.filename };
  },
};
