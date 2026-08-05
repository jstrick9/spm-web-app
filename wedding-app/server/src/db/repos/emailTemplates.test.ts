import '../../test/setup.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database.js';
import { emailTemplatesRepo } from './emailTemplates.js';
import type { EmailTemplateRow } from './emailTemplates.js';

beforeEach(() => {
  db.prepare(`DELETE FROM email_templates`).run();
  db.prepare(`DELETE FROM organizations`).run();
  db.prepare(`DELETE FROM users`).run();
});

function makeTemplate(overrides: Partial<EmailTemplateRow> = {}): EmailTemplateRow {
  return {
    id: 'tpl-test',
    organization_id: 'org-test',
    name: 'Test',
    subject: 'Hi {{guest_name}} — {{event_title}}',
    body_html: '<p>Dear {{guest_name}},</p><p>Join us at {{event_title}}.</p><p><a href="{{portal_link}}">RSVP</a></p>',
    body_text: 'Dear {{guest_name}},\nJoin us at {{event_title}}.\n{{portal_link}}',
    category: 'custom',
    merge_fields: '["guest_name","event_title","portal_link"]',
    is_default: 0,
    created_by: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    ...overrides,
  };
}

describe('emailTemplatesRepo.render', () => {
  it('substitutes plain values into subject, html and text', () => {
    const out = emailTemplatesRepo.render(makeTemplate(), {
      guest_name: 'Jane Doe',
      event_title: 'Spring Wedding',
      portal_link: 'https://venue.test/p/1',
    });
    expect(out.subject).toBe('Hi Jane Doe — Spring Wedding');
    expect(out.html).toContain('<p>Dear Jane Doe,</p>');
    expect(out.html).toContain('href="https://venue.test/p/1"');
    expect(out.text).toContain('Dear Jane Doe,');
  });

  it('HTML-escapes merge values in the html body (XSS / layout breakage)', () => {
    const out = emailTemplatesRepo.render(makeTemplate(), {
      guest_name: '<img src=x onerror=alert(1)> & "quote"',
      event_title: 'A&B <Wedding>',
      portal_link: 'https://venue.test/p/1',
    });
    expect(out.html).not.toContain('<img src=x');
    expect(out.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(out.html).toContain('A&amp;B &lt;Wedding&gt;');
    // Escaped entities survive attribute context without breaking the tag.
    expect(out.html).toContain('href="https://venue.test/p/1"');
  });

  it('leaves plain-text body unescaped', () => {
    const out = emailTemplatesRepo.render(makeTemplate(), {
      guest_name: 'A & B',
      event_title: 'X',
      portal_link: 'https://venue.test/p/1',
    });
    expect(out.text).toContain('Dear A & B,');
    expect(out.text).not.toContain('&amp;');
  });

  it('neutralizes CR/LF and control chars in the subject (header-injection guard)', () => {
    const out = emailTemplatesRepo.render(makeTemplate(), {
      guest_name: 'Jane\r\nBcc: victim@evil.test',
      event_title: 'X',
      portal_link: 'https://venue.test/p/1',
    });
    expect(out.subject).not.toContain('\r');
    expect(out.subject).not.toContain('\n');
    expect(out.subject).toContain('Jane Bcc: victim@evil.test');
  });

  it('handles regex-special characters in merge keys as literal text', () => {
    const out = emailTemplatesRepo.render(
      makeTemplate({ subject: 'Token: {{a.b}}', body_html: '{{a.b}}', body_text: '{{a.b}}' }),
      { 'a.b': '42' },
    );
    expect(out.subject).toBe('Token: 42');
    expect(out.html).toBe('42');
    expect(out.text).toBe('42');
  });

  it('replaces repeated occurrences of the same key', () => {
    const out = emailTemplatesRepo.render(
      makeTemplate({ subject: '{{guest_name}} / {{guest_name}}', body_html: '{{guest_name}} & {{guest_name}}', body_text: '' }),
      { guest_name: 'Sam', event_title: 'X', portal_link: 'https://venue.test/p/1' },
    );
    expect(out.subject).toBe('Sam / Sam');
    expect(out.html).toBe('Sam & Sam');
  });

  it('round-trips create -> findById -> render for a stored template', () => {
    db.prepare(`INSERT INTO users (id, email, password_hash, password_salt) VALUES ('u-1', 'u1@x.com', 'h', 's')`).run();
    db.prepare(`INSERT INTO organizations (id, name, slug, owner_id) VALUES ('org-x', 'OrgX', 'orgx-1', 'u-1')`).run();
    const row = emailTemplatesRepo.create('org-x', {
      name: 'Invite',
      subject: 'You are invited, {{guest_name}}!',
      bodyHtml: '<p>Hi {{guest_name}}</p>',
      bodyText: 'Hi {{guest_name}}',
      createdBy: 'u-1',
    });
    const found = emailTemplatesRepo.findById(row.id)!;
    const out = emailTemplatesRepo.render(found, { guest_name: '<b>Bob</b>' });
    // Subjects are plain-text headers: HTML-looking values stay verbatim (no entities),
    // only control chars are stripped (covered by the header-injection test above).
    expect(out.subject).toBe('You are invited, <b>Bob</b>!');
    expect(out.html).toBe('<p>Hi &lt;b&gt;Bob&lt;/b&gt;</p>');
    expect(out.text).toBe('Hi <b>Bob</b>');
  });
});
