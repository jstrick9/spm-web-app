import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface GalleryImageRow {
  id: string;
  organization_id: string;
  event_id: string;
  filename: string;
  url: string;
  category: string;
  caption: string | null;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
}

export const galleryRepo = {
  listForEvent(eventId: string): GalleryImageRow[] {
    return db.prepare(
      `SELECT * FROM gallery_images WHERE event_id = ? ORDER BY sort_order, created_at DESC`
    ).all(eventId) as GalleryImageRow[];
  },

  findById(id: string): GalleryImageRow | undefined {
    return db.prepare(`SELECT * FROM gallery_images WHERE id = ?`).get(id) as GalleryImageRow | undefined;
  },

  create(input: {
    organizationId: string; eventId: string;
    filename: string; url: string; category?: string;
    caption?: string; sortOrder?: number; uploadedBy: string;
  }): GalleryImageRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO gallery_images (id, organization_id, event_id, filename, url, category, caption, sort_order, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.organizationId, input.eventId, input.filename,
      input.url, input.category ?? 'vibe', input.caption ?? null,
      input.sortOrder ?? 0, input.uploadedBy);
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<{
    category: string; caption: string; sortOrder: number;
  }>): GalleryImageRow | undefined {
    const map: Record<string, string> = {
      category: 'category', caption: 'caption', sortOrder: 'sort_order',
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k]; if (!col) continue;
      fields.push(`${col} = ?`); values.push(v ?? null);
    }
    if (!fields.length) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE gallery_images SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM gallery_images WHERE id = ?`).run(id).changes > 0;
  },

  countByCategory(eventId: string): Record<string, number> {
    const rows = db.prepare(
      `SELECT category, COUNT(*) AS n FROM gallery_images WHERE event_id = ? GROUP BY category`
    ).all(eventId) as Array<{ category: string; n: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.category] = r.n;
    return out;
  },
};
