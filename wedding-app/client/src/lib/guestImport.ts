/**
 * Guest CSV importer — column auto-detection, per-row validation, and
 * payload construction for the bulk endpoint.
 *
 * The wizard UI calls these pure functions; no DOM, no React. Everything
 * here is unit-testable.
 */
import { z } from 'zod';
import type { SdkRsvpStatus } from '../sdk/types';

/** Every field the importer can map to. */
export const GUEST_FIELDS = [
  'fullName', 'email', 'phone', 'partyName',
  'rsvpStatus', 'tableAssignment',
  'dietaryRestrictions', 'accessibilityNotes',
  'plusOneAllowed', 'allowPortalAccess',
] as const;
export type GuestField = typeof GUEST_FIELDS[number];

/** Display labels + which header strings auto-match each field. */
export const FIELD_META: Record<GuestField, { label: string; aliases: ReadonlyArray<string>; required?: boolean }> = {
  fullName:            { label: 'Full name',        aliases: ['name', 'full name', 'guest', 'guest name', 'first last', 'invitee'], required: true },
  email:               { label: 'Email',            aliases: ['email', 'e-mail', 'mail', 'email address'] },
  phone:               { label: 'Phone',            aliases: ['phone', 'phone number', 'mobile', 'cell', 'tel'] },
  partyName:           { label: 'Party / household',aliases: ['party', 'household', 'family', 'group', 'party name'] },
  rsvpStatus:          { label: 'RSVP status',      aliases: ['rsvp', 'rsvp status', 'response', 'status'] },
  tableAssignment:     { label: 'Table',            aliases: ['table', 'table assignment', 'table number', 'seating'] },
  dietaryRestrictions: { label: 'Dietary',          aliases: ['dietary', 'dietary restrictions', 'diet', 'allergies', 'meal'] },
  accessibilityNotes:  { label: 'Accessibility',    aliases: ['accessibility', 'accommodations', 'access', 'access notes'] },
  plusOneAllowed:      { label: 'Plus-one allowed', aliases: ['plus one', '+1', 'plus-one', 'plus 1 allowed'] },
  allowPortalAccess:   { label: 'Allow portal',     aliases: ['portal', 'allow portal', 'portal access'] },
};

/** RSVP status synonyms we accept when parsing user-supplied CSVs. */
const RSVP_SYNONYMS: Record<string, SdkRsvpStatus> = {
  'pending':   'pending',  '':            'pending', 'no response': 'pending', 'awaiting': 'pending',
  'attending': 'attending', 'yes':        'attending', 'y':         'attending', 'going': 'attending', 'confirmed': 'attending', 'rsvp yes': 'attending',
  'declined':  'declined',  'no':         'declined', 'n':          'declined', 'not going': 'declined', 'cant make it': 'declined', 'regrets': 'declined',
  'maybe':     'maybe',     'tentative':  'maybe', 'unsure': 'maybe',
};

export type Mapping = Partial<Record<GuestField, number>>;

/** Truthy values for boolean columns (plusOneAllowed, allowPortalAccess). */
const TRUTHY = new Set(['1', 'true', 'yes', 'y', 't']);
const FALSY  = new Set(['0', 'false', 'no', 'n', 'f', '']);

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Given the header row of the CSV, suggest which column maps to which
 * field. Confidence: 1.0 = exact alias match; 0.6 = aliased substring;
 * 0 = no match (field stays unmapped).
 */
export function autoDetectMapping(headers: string[]): {
  mapping: Mapping;
  confidence: Partial<Record<GuestField, number>>;
} {
  const normalized = headers.map(normalizeHeader);
  const mapping: Mapping = {};
  const confidence: Partial<Record<GuestField, number>> = {};

  for (const field of GUEST_FIELDS) {
    const aliases = FIELD_META[field].aliases.map((a) => a.toLowerCase());
    // 1. exact match
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i];
      if (!h) continue;
      if (aliases.includes(h)) {
        if (1.0 > bestScore) { bestScore = 1.0; bestIdx = i; }
      } else {
        // 2. fuzzy: header includes alias or vice versa
        const hits = aliases.some((a) => h.includes(a) || a.includes(h));
        if (hits && 0.6 > bestScore) { bestScore = 0.6; bestIdx = i; }
      }
    }
    if (bestIdx >= 0 && !columnAlreadyTaken(mapping, bestIdx)) {
      mapping[field] = bestIdx;
      confidence[field] = bestScore;
    }
  }
  return { mapping, confidence };
}

function columnAlreadyTaken(mapping: Mapping, col: number): boolean {
  return Object.values(mapping).includes(col);
}

// ─── Per-row validation ────────────────────────────────
export type RowIssue = {
  field?: GuestField;
  message: string;
  severity: 'error' | 'warning';
};

export interface ImportRow {
  /** 0-indexed row position in the source CSV (excluding header). */
  index: number;
  /** Raw cells, indexed by source column. */
  raw: string[];
  /** Mapped, normalized values ready to ship to the API. */
  parsed: ParsedRow;
  /** Validation issues. Errors block import; warnings don't. */
  issues: RowIssue[];
}

export interface ParsedRow {
  fullName: string;
  email?: string;
  phone?: string;
  partyName?: string;
  rsvpStatus?: SdkRsvpStatus;
  tableAssignment?: string;
  dietaryRestrictions?: string;
  accessibilityNotes?: string;
  plusOneAllowed?: boolean;
  allowPortalAccess?: boolean;
}

const emailSchema = z.string().email();

/**
 * Parse + validate one CSV row against the chosen mapping.
 * Trims values, normalizes RSVP synonyms, coerces booleans.
 */
export function parseRow(
  raw: string[],
  mapping: Mapping,
  index: number,
): ImportRow {
  const get = (field: GuestField): string => {
    const col = mapping[field];
    return col != null ? (raw[col] ?? '').trim() : '';
  };

  const issues: RowIssue[] = [];
  const parsed: ParsedRow = {
    fullName: get('fullName'),
  };

  // ── fullName: required ──
  if (!parsed.fullName) {
    issues.push({ field: 'fullName', message: 'Full name is required', severity: 'error' });
  } else if (parsed.fullName.length > 200) {
    issues.push({ field: 'fullName', message: 'Full name is too long (max 200)', severity: 'error' });
  }

  // ── email ──
  const emailRaw = get('email');
  if (emailRaw) {
    const ok = emailSchema.safeParse(emailRaw);
    if (!ok.success) {
      issues.push({ field: 'email', message: 'Invalid email format', severity: 'error' });
    } else {
      parsed.email = emailRaw;
    }
  }

  // ── phone ── (lenient — accept anything; tighten later if needed)
  const phoneRaw = get('phone');
  if (phoneRaw) {
    if (phoneRaw.length > 40) {
      issues.push({ field: 'phone', message: 'Phone is too long', severity: 'warning' });
    }
    parsed.phone = phoneRaw;
  }

  // ── party ──
  const party = get('partyName');
  if (party) parsed.partyName = party;

  // ── rsvpStatus ──
  const rsvpRaw = get('rsvpStatus').toLowerCase();
  if (rsvpRaw) {
    const matched = RSVP_SYNONYMS[rsvpRaw];
    if (matched) {
      parsed.rsvpStatus = matched;
    } else {
      issues.push({
        field: 'rsvpStatus',
        message: `Unknown RSVP value "${rsvpRaw}" — will default to "pending"`,
        severity: 'warning',
      });
    }
  }

  // ── table ──
  const table = get('tableAssignment');
  if (table) parsed.tableAssignment = table;

  // ── dietary / accessibility ──
  const diet = get('dietaryRestrictions');
  if (diet) parsed.dietaryRestrictions = diet;
  const access = get('accessibilityNotes');
  if (access) parsed.accessibilityNotes = access;

  // ── plusOneAllowed (boolean) ──
  const p1 = get('plusOneAllowed').toLowerCase();
  if (p1) {
    if (TRUTHY.has(p1)) parsed.plusOneAllowed = true;
    else if (FALSY.has(p1)) parsed.plusOneAllowed = false;
    else issues.push({
      field: 'plusOneAllowed',
      message: `Unknown plus-one value "${p1}" — defaulting to no`,
      severity: 'warning',
    });
  }

  // ── allowPortalAccess (boolean) ──
  const ap = get('allowPortalAccess').toLowerCase();
  if (ap) {
    if (TRUTHY.has(ap)) parsed.allowPortalAccess = true;
    else if (FALSY.has(ap)) parsed.allowPortalAccess = false;
    else issues.push({
      field: 'allowPortalAccess',
      message: `Unknown portal value "${ap}" — defaulting to yes`,
      severity: 'warning',
    });
  }

  return { index, raw, parsed, issues };
}

/** Run parseRow over every data row. */
export function parseAll(rows: string[][], mapping: Mapping, headerRowIndex = 0): ImportRow[] {
  const data = rows.filter((_, i) => i !== headerRowIndex);
  return data.map((r, i) => parseRow(r, mapping, i));
}

// ─── Collision detection ────────────────────────────────
export type CollisionStrategy = 'skip' | 'replace' | 'append';

export interface CollisionReport {
  rowIndex: number;
  importEmail: string;
  existingGuestId: string;
  existingName: string;
}

/**
 * Find rows whose normalized email matches an existing guest. Only rows
 * with a valid email participate; emailless rows are always appended.
 */
export function detectCollisions(
  rows: ImportRow[],
  existingGuests: ReadonlyArray<{ id: string; email: string | null; full_name: string }>,
): CollisionReport[] {
  const byEmail = new Map<string, { id: string; full_name: string }>();
  for (const g of existingGuests) {
    if (g.email) byEmail.set(g.email.toLowerCase(), g);
  }
  const out: CollisionReport[] = [];
  for (const r of rows) {
    if (!r.parsed.email) continue;
    const key = r.parsed.email.toLowerCase();
    const hit = byEmail.get(key);
    if (hit) {
      out.push({ rowIndex: r.index, importEmail: r.parsed.email, existingGuestId: hit.id, existingName: hit.full_name });
    }
  }
  return out;
}

/**
 * Summarize: how many rows are importable, error, warning, collision.
 */
export interface ImportSummary {
  total: number;
  errors: number;
  warnings: number;
  collisions: number;
  importable: number;     // = total - errors
}

export function summarize(rows: ImportRow[], collisions: CollisionReport[]): ImportSummary {
  let errors = 0, warnings = 0;
  for (const r of rows) {
    if (r.issues.some((i) => i.severity === 'error')) errors++;
    if (r.issues.some((i) => i.severity === 'warning')) warnings++;
  }
  return {
    total: rows.length,
    errors,
    warnings,
    collisions: collisions.length,
    importable: rows.length - errors,
  };
}
