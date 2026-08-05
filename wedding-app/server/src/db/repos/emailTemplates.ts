import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson, parseJson } from '../../lib/json.js';

export interface EmailTemplateRow {
  id: string; organization_id: string; name: string; subject: string;
  body_html: string; body_text: string; category: string;
  merge_fields: string; is_default: number;
  created_by: string | null; created_at: string; updated_at: string;
}

export const emailTemplatesRepo = {
  listForOrg(orgId: string): EmailTemplateRow[] {
    return db.prepare(`SELECT * FROM email_templates WHERE organization_id = ? ORDER BY category, name`).all(orgId) as EmailTemplateRow[];
  },

  findById(id: string): EmailTemplateRow | undefined {
    return db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get(id) as EmailTemplateRow | undefined;
  },

  create(orgId: string, input: {
    name: string; subject: string; bodyHtml: string; bodyText?: string;
    category?: string; mergeFields?: string[]; createdBy: string;
  }): EmailTemplateRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO email_templates (id, organization_id, name, subject, body_html, body_text, category, merge_fields, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, input.name, input.subject, input.bodyHtml,
      input.bodyText ?? '', input.category ?? 'custom',
      stringifyJson(input.mergeFields ?? []), input.createdBy);
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<{
    name: string; subject: string; bodyHtml: string; bodyText: string; category: string;
  }>): EmailTemplateRow | undefined {
    const map: Record<string, string> = { name: 'name', subject: 'subject', bodyHtml: 'body_html', bodyText: 'body_text', category: 'category' };
    const fields: string[] = []; const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) { const col = map[k]; if (!col) continue; fields.push(`${col} = ?`); values.push(v); }
    if (!fields.length) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE email_templates SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM email_templates WHERE id = ?`).run(id).changes > 0;
  },

  /**
   * Render a template with merge data.
   *
   * Values are sanitized per channel:
   *  - HTML body: values are HTML-escaped so guest/vendor-supplied text
   *    (names, notes) cannot inject markup or break the email layout.
   *  - Subject: CR/LF and other control characters are neutralized so a
   *    malicious merge value cannot attempt header injection.
   *  - Plain-text body: values are inserted verbatim (no escaping in text).
   */
  render(template: EmailTemplateRow, data: Record<string, string>): { subject: string; html: string; text: string } {
    let subject = template.subject;
    let html = template.body_html;
    let text = template.body_text;
    for (const [key, rawValue] of Object.entries(data)) {
      // Keys come from template authoring, but treat them as literal regex text.
      const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\{\\{${safeKey}\\}\\}`, 'g');
      subject = subject.replace(pattern, subjectSafe(rawValue));
      html = html.replace(pattern, escapeHtml(rawValue));
      text = text.replace(pattern, rawValue);
    }
    // Belt-and-suspenders: neutralize control chars the template itself may contain.
    subject = subjectSafe(subject);
    return { subject, html, text };
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function subjectSafe(value: string): string {
  // RFC 5322: no CR/LF or control chars in the header line.
  return value
    .replace(/[\r\n\t\0\x01-\x08\x0b\x0c\x0e-\x1f\x7f]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
