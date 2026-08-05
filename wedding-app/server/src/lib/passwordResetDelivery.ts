import { jobsRepo, integrationsRepo, orgsRepo, emailTemplatesRepo } from '../db/repos/index.js';
import { appPublicBaseUrl } from '../lib/appBaseUrl.js';

export type PasswordResetDeliveryResult =
  | { channel: 'smtp'; queued: true; integrationId: string }
  | { channel: 'webhook'; queued: false; status: number }
  | { channel: 'none'; queued: false; reason: string };

function appBaseUrl(): string {
  return appPublicBaseUrl();
}

export function buildPasswordResetUrl(token: string): string {
  return `${appBaseUrl()}/#/reset-password?token=${encodeURIComponent(token)}`;
}

function emailBody(input: { fullName: string; resetUrl: string; expiresAt: string }) {
  const expires = new Date(input.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const greeting = input.fullName?.trim() ? input.fullName.trim() : 'there';
  const text = [
    `Hi ${greeting},`,
    '',
    'We received a request to reset your Wedding Venue Intelligence password.',
    `Reset your password: ${input.resetUrl}`,
    '',
    `This link expires ${expires}. If you did not request this, you can ignore this email.`,
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#241723;max-width:640px;margin:0 auto;padding:24px">
      <h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1>
      <p>Hi ${escapeHtml(greeting)},</p>
      <p>We received a request to reset your Wedding Venue Intelligence password.</p>
      <p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#4A1942;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Reset password</a></p>
      <p style="font-size:13px;color:#6b5f68">This link expires ${escapeHtml(expires)}. If you did not request this, you can ignore this email.</p>
    </div>`;
  return { subject: 'Reset your Wedding Venue Intelligence password', text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function deliverPasswordReset(input: {
  userId: string;
  email: string;
  fullName: string;
  token: string;
  expiresAt: string;
}): Promise<PasswordResetDeliveryResult> {
  const resetUrl = buildPasswordResetUrl(input.token);
  const org = orgsRepo.listForUser(input.userId)[0];
  const expires = new Date(input.expiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const template = org
    ? emailTemplatesRepo.listForOrg(org.id).find((t) => /password\s*reset/i.test(t.name))
    : undefined;
  const body = template
    ? emailTemplatesRepo.render(template, {
        user_name: input.fullName || 'there',
        reset_url: resetUrl,
        reset_link: resetUrl,
        expires_at: expires,
        venue_name: org?.name ?? 'your venue',
      })
    : emailBody({ fullName: input.fullName, resetUrl, expiresAt: input.expiresAt });

  if (org) {
    const smtp = integrationsRepo.findByOrgProvider(org.id, 'email_smtp');
    if (smtp?.status === 'connected') {
      jobsRepo.enqueue({
        kind: 'email.send',
        organizationId: org.id,
        payload: {
          integrationId: smtp.id,
          to: input.email,
          subject: body.subject,
          html: body.html,
          text: body.text,
          headers: { 'X-WVI-Email-Type': 'password-reset' },
        },
        maxAttempts: 5,
      });
      return { channel: 'smtp', queued: true, integrationId: smtp.id };
    }
  }

  const webhookUrl = process.env.PASSWORD_RESET_WEBHOOK_URL || process.env.WVI_PASSWORD_RESET_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.PASSWORD_RESET_WEBHOOK_SECRET
          ? { authorization: `Bearer ${process.env.PASSWORD_RESET_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        type: 'password_reset.requested',
        to: input.email,
        subject: body.subject,
        html: body.html,
        text: body.text,
        resetUrl,
        expiresAt: input.expiresAt,
      }),
    });
    if (!res.ok) throw new Error(`password reset webhook failed: HTTP ${res.status}`);
    return { channel: 'webhook', queued: false, status: res.status };
  }

  return { channel: 'none', queued: false, reason: org ? 'no-connected-smtp-or-webhook' : 'no-user-organization' };
}
