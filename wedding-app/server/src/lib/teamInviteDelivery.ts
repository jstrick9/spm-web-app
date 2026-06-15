import { eventsRepo, jobsRepo, integrationsRepo, orgsRepo, rolesRepo } from '../db/repos/index.js';
import type { TeamInvitationRow } from '../db/repos/teamInvitations.js';

function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

export function buildTeamInviteUrl(token: string): string {
  return `${appBaseUrl()}/#/?inviteToken=${encodeURIComponent(token)}`;
}

export async function deliverTeamInvitation(input: { invitation: TeamInvitationRow; token: string }): Promise<{ channel: string; queued: boolean }> {
  const org = orgsRepo.findById(input.invitation.organization_id);
  const role = rolesRepo.findById(input.invitation.role_id);
  const event = input.invitation.event_id ? eventsRepo.findById(input.invitation.event_id) : undefined;
  const inviteUrl = buildTeamInviteUrl(input.token);
  const isCoupleEventInvite = input.invitation.invitation_type === 'event' && role?.key === 'couple';
  const subject = isCoupleEventInvite
    ? `Your private wedding hub invitation for ${event?.title ?? org?.name ?? 'your wedding'}`
    : `You're invited to ${org?.name ?? 'a Wedding Venue Intelligence workspace'}`;
  const opening = isCoupleEventInvite
    ? `You've been invited by ${org?.name ?? 'your venue'} to open your private wedding hub${event?.title ? ` for ${event.title}` : ''}${event?.start_date ? ` on ${event.start_date}` : ''}.`
    : `You've been invited to join ${org?.name ?? 'a venue workspace'} as ${role?.name ?? 'a team member'}.`;
  const text = [
    opening,
    '',
    isCoupleEventInvite ? 'This link creates event-scoped couple access only. It will not create a venue owner/admin workspace.' : '',
    isCoupleEventInvite ? '' : undefined,
    `Accept invitation: ${inviteUrl}`,
    '',
    'If you do not recognize this invitation, you can ignore this email.',
  ].filter((line) => line !== undefined).join('\n');
  const html = `<p>${opening}</p>${isCoupleEventInvite ? '<p>This link creates event-scoped couple access only. It will not create a venue owner/admin workspace.</p>' : ''}<p><a href="${inviteUrl}">Accept invitation</a></p><p>If you do not recognize this invitation, you can ignore this email.</p>`;

  const smtp = org ? integrationsRepo.findByOrgProvider(org.id, 'email_smtp') : undefined;
  if (smtp?.status === 'connected') {
    jobsRepo.enqueue({
      kind: 'email.send',
      organizationId: org!.id,
      payload: { integrationId: smtp.id, to: input.invitation.email, subject, html, text, headers: { 'X-WVI-Email-Type': 'team-invitation' } },
      maxAttempts: 5,
    });
    return { channel: 'smtp', queued: true };
  }

  const webhookUrl = process.env.TEAM_INVITE_WEBHOOK_URL || process.env.WVI_TEAM_INVITE_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.TEAM_INVITE_WEBHOOK_SECRET ? { authorization: `Bearer ${process.env.TEAM_INVITE_WEBHOOK_SECRET}` } : {}) },
      body: JSON.stringify({ type: 'team_invitation.created', to: input.invitation.email, subject, html, text, inviteUrl, expiresAt: input.invitation.expires_at }),
    });
    if (!res.ok) throw new Error(`team invite webhook failed: HTTP ${res.status}`);
    return { channel: 'webhook', queued: false };
  }

  return { channel: 'none', queued: false };
}
