import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import type { ContractRow } from './contracts.js';
import type { PaymentLinkRow } from './paymentLinks.js';

export type FinancialLegalSource = 'contract' | 'payment' | 'legal' | 'manual';
export type FinancialLegalSeverity = 'info' | 'warning' | 'blocked';

export interface FinancialLegalEscalationRow {
  id: string; organization_id: string; event_id: string; source_type: FinancialLegalSource; source_id: string | null;
  severity: FinancialLegalSeverity; status: 'open' | 'acknowledged' | 'resolved'; label: string; detail: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}

export interface GoNoGoFlagRow {
  id: string; organization_id: string; event_id: string; flag_type: string; source_type: FinancialLegalSource; source_id: string | null;
  severity: 'warning' | 'blocked'; status: 'open' | 'owner_approved' | 'resolved'; label: string; detail: string | null;
  requires_owner_approval: number; created_by: string | null; approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string;
}

export interface ContractObligationExtractRow {
  id: string; organization_id: string; event_id: string; contract_id: string; obligation_key: string; label: string;
  excerpt: string | null; confidence: 'low' | 'medium' | 'high'; status: 'detected' | 'approved' | 'dismissed';
  approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string;
}

const OBLIGATION_RULES = [
  { key: 'load_in', label: 'Load-in / strike', terms: ['load-in', 'load in', 'loadout', 'load-out', 'strike', 'delivery', 'setup'] },
  { key: 'insurance', label: 'Insurance / COI', terms: ['insurance', 'coi', 'certificate of insurance', 'liability'] },
  { key: 'cleanup', label: 'Cleanup / damage', terms: ['cleanup', 'clean up', 'trash', 'damage', 'security deposit', 'breakdown'] },
  { key: 'alcohol', label: 'Alcohol / bar', terms: ['alcohol', 'bar', 'liquor', 'beer', 'wine', 'bartender'] },
  { key: 'noise', label: 'Noise / music', terms: ['noise', 'music', 'dj', 'band', 'decibel', 'sound ordinance'] },
  { key: 'overtime', label: 'Overtime / curfew', terms: ['overtime', 'curfew', 'end time', 'late fee', 'extension'] },
];

function excerptFor(text: string, terms: string[]): string | null {
  const lower = text.toLowerCase();
  const term = terms.find(t => lower.includes(t));
  if (!term) return null;
  const idx = Math.max(0, lower.indexOf(term) - 80);
  return text.slice(idx, idx + 220).trim();
}

export function extractContractObligations(contract: Pick<ContractRow, 'title' | 'content'>) {
  const text = `${contract.title}\n${contract.content || ''}`;
  const lower = text.toLowerCase();
  return OBLIGATION_RULES
    .filter(rule => rule.terms.some(term => lower.includes(term)))
    .map(rule => ({
      obligationKey: rule.key,
      label: rule.label,
      excerpt: excerptFor(text, rule.terms),
      confidence: rule.terms.filter(term => lower.includes(term)).length > 1 ? 'high' as const : 'medium' as const,
    }));
}

export const financialLegalOpsRepo = {
  listForEvent(eventId: string) {
    return {
      escalations: db.prepare(`SELECT * FROM event_financial_legal_escalations WHERE event_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(eventId) as FinancialLegalEscalationRow[],
      goNoGoFlags: db.prepare(`SELECT * FROM event_go_no_go_flags WHERE event_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(eventId) as GoNoGoFlagRow[],
      obligationExtracts: db.prepare(`SELECT * FROM contract_obligation_extracts WHERE event_id = ? ORDER BY contract_id, obligation_key`).all(eventId) as ContractObligationExtractRow[],
    };
  },

  createEscalation(input: { orgId: string; eventId: string; sourceType?: FinancialLegalSource; sourceId?: string | null; severity?: FinancialLegalSeverity; label: string; detail?: string; createdBy?: string | null }): FinancialLegalEscalationRow {
    const id = uuid();
    db.prepare(`INSERT INTO event_financial_legal_escalations (id, organization_id, event_id, source_type, source_id, severity, label, detail, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId, input.sourceType ?? 'manual', input.sourceId ?? null, input.severity ?? 'warning', input.label, input.detail ?? null, input.createdBy ?? null,
    );
    return db.prepare(`SELECT * FROM event_financial_legal_escalations WHERE id = ?`).get(id) as FinancialLegalEscalationRow;
  },

  createGoNoGoFlag(input: { orgId: string; eventId: string; sourceType?: FinancialLegalSource; sourceId?: string | null; severity?: 'warning' | 'blocked'; label: string; detail?: string; createdBy?: string | null }): GoNoGoFlagRow {
    const id = uuid();
    db.prepare(`INSERT INTO event_go_no_go_flags (id, organization_id, event_id, source_type, source_id, severity, label, detail, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId, input.sourceType ?? 'manual', input.sourceId ?? null, input.severity ?? 'blocked', input.label, input.detail ?? null, input.createdBy ?? null,
    );
    return db.prepare(`SELECT * FROM event_go_no_go_flags WHERE id = ?`).get(id) as GoNoGoFlagRow;
  },

  approveGoNoGoFlag(flagId: string, userId: string): GoNoGoFlagRow | undefined {
    db.prepare(`UPDATE event_go_no_go_flags SET status = 'owner_approved', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(userId, flagId);
    return db.prepare(`SELECT * FROM event_go_no_go_flags WHERE id = ?`).get(flagId) as GoNoGoFlagRow | undefined;
  },

  upsertContractObligations(contract: ContractRow): ContractObligationExtractRow[] {
    const extracts = extractContractObligations(contract);
    for (const ex of extracts) {
      const existing = db.prepare(`SELECT * FROM contract_obligation_extracts WHERE contract_id = ? AND obligation_key = ?`).get(contract.id, ex.obligationKey) as ContractObligationExtractRow | undefined;
      if (existing) {
        db.prepare(`UPDATE contract_obligation_extracts SET label = ?, excerpt = ?, confidence = ?, updated_at = datetime('now') WHERE id = ?`).run(ex.label, ex.excerpt, ex.confidence, existing.id);
      } else {
        db.prepare(`INSERT INTO contract_obligation_extracts (id, organization_id, event_id, contract_id, obligation_key, label, excerpt, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          uuid(), contract.organization_id, contract.event_id, contract.id, ex.obligationKey, ex.label, ex.excerpt, ex.confidence,
        );
      }
    }
    return db.prepare(`SELECT * FROM contract_obligation_extracts WHERE contract_id = ? ORDER BY obligation_key`).all(contract.id) as ContractObligationExtractRow[];
  },

  paymentDueRisk(payments: PaymentLinkRow[]) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let overdue = 0;
    let dueSoon = 0;
    let pendingCents = 0;
    for (const payment of payments) {
      if (payment.status === 'completed' || payment.status === 'refunded') continue;
      pendingCents += payment.amount_cents;
      let meta: any = {};
      try { meta = JSON.parse(payment.metadata || '{}'); } catch {}
      if (!meta.dueDate) continue;
      const due = new Date(meta.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
      if (diffDays < 0) overdue += 1;
      else if (diffDays <= 7) dueSoon += 1;
    }
    return { overdue, dueSoon, pendingCents };
  },
};
