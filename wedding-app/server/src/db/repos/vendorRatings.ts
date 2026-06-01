import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface VendorRatingRow {
  id: string; organization_id: string; vendor_id: string; event_id: string;
  rating: number; quality_score: number | null; timeliness_score: number | null;
  communication_score: number | null; review: string | null;
  rated_by: string | null; created_at: string;
}

export const vendorRatingsRepo = {
  create(input: {
    organizationId: string; vendorId: string; eventId: string;
    rating: number; qualityScore?: number; timelinessScore?: number;
    communicationScore?: number; review?: string; ratedBy: string;
  }): VendorRatingRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO vendor_ratings (id, organization_id, vendor_id, event_id, rating, quality_score, timeliness_score, communication_score, review, rated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(vendor_id, event_id) DO UPDATE SET rating=excluded.rating, quality_score=excluded.quality_score, timeliness_score=excluded.timeliness_score, communication_score=excluded.communication_score, review=excluded.review`
    ).run(id, input.organizationId, input.vendorId, input.eventId, input.rating,
      input.qualityScore ?? null, input.timelinessScore ?? null,
      input.communicationScore ?? null, input.review ?? null, input.ratedBy);
    return this.findByVendorEvent(input.vendorId, input.eventId)!;
  },

  findByVendorEvent(vendorId: string, eventId: string): VendorRatingRow | undefined {
    return db.prepare(`SELECT * FROM vendor_ratings WHERE vendor_id = ? AND event_id = ?`).get(vendorId, eventId) as VendorRatingRow | undefined;
  },

  listForVendor(vendorId: string): VendorRatingRow[] {
    return db.prepare(`SELECT * FROM vendor_ratings WHERE vendor_id = ? ORDER BY created_at DESC`).all(vendorId) as VendorRatingRow[];
  },

  /** Aggregate rating for a vendor across all events. */
  aggregate(vendorId: string): { avgRating: number; count: number; avgQuality: number; avgTimeliness: number; avgCommunication: number } {
    const row = db.prepare(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as count,
              AVG(quality_score) as avg_quality, AVG(timeliness_score) as avg_timeliness,
              AVG(communication_score) as avg_communication
       FROM vendor_ratings WHERE vendor_id = ?`
    ).get(vendorId) as any;
    return {
      avgRating: Math.round((row.avg_rating ?? 0) * 10) / 10,
      count: row.count ?? 0,
      avgQuality: Math.round((row.avg_quality ?? 0) * 10) / 10,
      avgTimeliness: Math.round((row.avg_timeliness ?? 0) * 10) / 10,
      avgCommunication: Math.round((row.avg_communication ?? 0) * 10) / 10,
    };
  },
};
