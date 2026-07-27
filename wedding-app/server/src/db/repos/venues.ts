import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface VenueRow {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  environment: 'indoor' | 'outdoor' | 'both';
  description: string | null;
  capacity: number;
  width: number;
  height: number;
  canvas_width: number | null;
  canvas_height: number | null;
  shape: string;          // JSON
  style: string;          // JSON
  master_layout: string;  // JSON
  metadata: string;       // JSON
  unit_system: 'imperial' | 'metric';
  template_key: string;
  approval_status: 'draft' | 'approved' | 'archived';
  revision: number;
  underlay: string; // JSON
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VenueInput {
  name: string;
  category?: string;
  environment?: 'indoor' | 'outdoor' | 'both';
  description?: string;
  capacity?: number;
  width?: number;
  height?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  shape?: Record<string, unknown>;
  style?: Record<string, unknown>;
  masterLayout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  unitSystem?: 'imperial' | 'metric';
  templateKey?: string;
  approvalStatus?: 'draft' | 'approved' | 'archived';
  underlay?: Record<string, unknown>;
}

export const venuesRepo = {
  findById(id: string): VenueRow | undefined {
    return db.prepare(`SELECT * FROM venues WHERE id = ? AND deleted_at IS NULL`).get(id) as VenueRow | undefined;
  },

  listForOrg(orgId: string): VenueRow[] {
    return db.prepare(
      `SELECT * FROM venues WHERE organization_id = ? AND deleted_at IS NULL ORDER BY name`
    ).all(orgId) as VenueRow[];
  },

  create(orgId: string, createdBy: string, input: VenueInput): VenueRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO venues
         (id, organization_id, name, category, environment, description,
          capacity, width, height, canvas_width, canvas_height,
          shape, style, master_layout, metadata, unit_system, template_key, approval_status, underlay, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      orgId,
      input.name,
      input.category ?? 'reception',
      input.environment ?? 'indoor',
      input.description ?? null,
      input.capacity ?? 0,
      input.width ?? 0,
      input.height ?? 0,
      input.canvasWidth ?? null,
      input.canvasHeight ?? null,
      stringifyJson(input.shape ?? {}),
      stringifyJson(input.style ?? {}),
      stringifyJson(input.masterLayout ?? {}),
      stringifyJson(input.metadata ?? {}),
      input.unitSystem ?? 'imperial',
      input.templateKey ?? 'custom',
      input.approvalStatus ?? 'draft',
      stringifyJson(input.underlay ?? {}),
      createdBy,
    );
    return this.findById(id)!;
  },

  update(id: string, input: Partial<VenueInput>): VenueRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    const scalarMap: Record<string, string> = {
      name: 'name', category: 'category', environment: 'environment',
      description: 'description', capacity: 'capacity', width: 'width', height: 'height',
      canvasWidth: 'canvas_width', canvasHeight: 'canvas_height', unitSystem: 'unit_system', templateKey: 'template_key', approvalStatus: 'approval_status',
    };
    for (const [k, col] of Object.entries(scalarMap)) {
      if (k in input) {
        fields.push(`${col} = ?`);
        values.push((input as Record<string, unknown>)[k]);
      }
    }
    const jsonMap: Record<string, string> = {
      shape: 'shape', style: 'style', masterLayout: 'master_layout', metadata: 'metadata', underlay: 'underlay',
    };
    for (const [k, col] of Object.entries(jsonMap)) {
      if (k in input) {
        fields.push(`${col} = ?`);
        values.push(stringifyJson((input as Record<string, unknown>)[k]));
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(
      `UPDATE venues SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);
    return this.findById(id);
  },

  softDelete(id: string): boolean {
    const res = db.prepare(
      `UPDATE venues SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`
    ).run(id);
    return res.changes > 0;
  },
};
