import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export const layoutCollaborationRepo = {
  listComments(layoutId: string) { return db.prepare(`SELECT * FROM layout_comments WHERE layout_id = ? ORDER BY created_at DESC`).all(layoutId); },
  addComment(input: { layoutId: string; orgId: string; eventId?: string | null; revision: number; authorUserId: string; authorLabel: string; body: string; target?: Record<string, unknown> }) {
    const id = uuid(); db.prepare(`INSERT INTO layout_comments (id,layout_id,organization_id,event_id,revision,author_user_id,author_label,body,target_json) VALUES (?,?,?,?,?,?,?,?,?)`).run(id,input.layoutId,input.orgId,input.eventId ?? null,input.revision,input.authorUserId,input.authorLabel,input.body,stringifyJson(input.target ?? {}));
    return db.prepare(`SELECT * FROM layout_comments WHERE id = ?`).get(id);
  },
  findComment(id: string) { return db.prepare(`SELECT * FROM layout_comments WHERE id=?`).get(id) as { id: string; layout_id: string; author_user_id: string | null } | undefined; },
  resolveComment(id: string, userId: string) { db.prepare(`UPDATE layout_comments SET status='resolved', resolved_by=?, resolved_at=datetime('now') WHERE id=?`).run(userId,id); return db.prepare(`SELECT * FROM layout_comments WHERE id=?`).get(id); },
  latestApprovedReview(layoutId: string) { return db.prepare(`SELECT * FROM layout_review_requests WHERE layout_id=? AND decision='approved' ORDER BY revision DESC, reviewed_at DESC LIMIT 1`).get(layoutId) as { revision: number } | undefined; },
  listReviews(layoutId: string) { return db.prepare(`SELECT * FROM layout_review_requests WHERE layout_id=? ORDER BY requested_at DESC`).all(layoutId); },
  requestReview(input: { layoutId: string; orgId: string; eventId?: string | null; revision: number; userId: string }) { const id=uuid(); db.prepare(`INSERT INTO layout_review_requests (id,layout_id,organization_id,event_id,revision,requested_by) VALUES (?,?,?,?,?,?)`).run(id,input.layoutId,input.orgId,input.eventId ?? null,input.revision,input.userId); return db.prepare(`SELECT * FROM layout_review_requests WHERE id=?`).get(id); },
  decideReview(id: string, reviewerId: string, decision: 'approved'|'changes_requested'|'rejected', note?: string) { db.prepare(`UPDATE layout_review_requests SET reviewed_by=?, reviewed_at=datetime('now'), decision=?, decision_note=? WHERE id=?`).run(reviewerId,decision,note ?? null,id); return db.prepare(`SELECT * FROM layout_review_requests WHERE id=?`).get(id); },
};
