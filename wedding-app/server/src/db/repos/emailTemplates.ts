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

  /** Render a template with merge data. */
  render(template: EmailTemplateRow, data: Record<string, string>): { subject: string; html: string; text: string } {
    let subject = template.subject;
    let html = template.body_html;
    let text = template.body_text;
    for (const [key, value] of Object.entries(data)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(pattern, value);
      html = html.replace(pattern, value);
      text = text.replace(pattern, value);
    }
    return { subject, html, text };
  },
};
