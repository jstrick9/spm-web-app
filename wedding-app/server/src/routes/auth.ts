import type { FastifyInstance } from 'fastify';
import { BadRequest, NotFound } from '../lib/errors.js';
import { z } from 'zod';
import { hashPassword, verifyPassword, needsRehash } from '../lib/crypto.js';
import { slugify } from '../lib/slug.js';
import { auditRepo, eventsRepo, integrationsRepo, jobsRepo, orgsRepo, rolesRepo, teamInvitationsRepo, usersRepo } from '../db/repos/index.js';
import { passwordResetTokensRepo } from '../db/repos/passwordResetTokens.js';
import { deliverPasswordReset } from '../lib/passwordResetDelivery.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/database.js';

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  fullName: z.string().min(1).max(120),
  orgName: z.string().min(1).max(120).optional(),
  accountRole: z.enum(['venue_owner', 'venue_manager', 'planner', 'vendor', 'couple']).optional(),
  inviteToken: z.string().min(20).max(300).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email().max(254),
});

const passwordResetCompleteSchema = z.object({
  token: z.string().min(20).max(300),
  newPassword: z.string().min(8).max(200),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email().max(254),
});

const magicLinkCompleteSchema = z.object({
  token: z.string().min(20).max(300),
});

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/invitations/:token', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = z.object({ token: z.string().min(20).max(300) }).safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-input' });
    const invitation = teamInvitationsRepo.findValidByToken(parsed.data.token);
    if (!invitation) return reply.code(404).send({ error: 'invite-not-found' });
    const org = orgsRepo.findById(invitation.organization_id);
    const role = rolesRepo.findById(invitation.role_id);
    const event = invitation.event_id ? eventsRepo.findById(invitation.event_id) : undefined;
    const branding = (() => { try { return org?.branding ? JSON.parse(org.branding) as Record<string, unknown> : {}; } catch { return {}; } })();
    const supportEmail = typeof branding.supportEmail === 'string' ? branding.supportEmail : '';
    const isCoupleEventInvite = invitation.invitation_type === 'event' && role?.key === 'couple';
    return {
      invitation: {
        email: invitation.email,
        type: invitation.invitation_type,
        organizationId: invitation.organization_id,
        organizationName: org?.name ?? 'Invited organization',
        venueName: org?.name ?? 'Your venue',
        eventId: invitation.event_id,
        eventTitle: event?.title ?? null,
        eventDate: event?.start_date ?? null,
        roleId: invitation.role_id,
        roleKey: role?.key ?? 'member',
        roleName: role?.name ?? 'Team Member',
        roleDescription: role?.description ?? 'Join this venue workspace with the assigned permissions.',
        supportEmail,
        accessSummary: isCoupleEventInvite
          ? {
              can: ['Open your private wedding hub', 'Review wedding details, guest list, RSVP progress, timeline, documents, and venue messages for your event'],
              cannot: ['Access venue administration', 'View other weddings', 'See internal staff operations, audit logs, or owner settings'],
            }
          : {
              can: ['Join this venue workspace with the assigned role permissions'],
              cannot: ['Access areas outside the permissions assigned by the venue'],
            },
        expiresAt: invitation.expires_at,
      },
    };
  });

  app.post('/api/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid-input', issues: parsed.error.issues });
    }
    if (usersRepo.findByEmail(parsed.data.email)) {
      return reply.code(409).send({ error: 'email-already-registered' });
    }
    const invitation = parsed.data.inviteToken ? teamInvitationsRepo.findValidByToken(parsed.data.inviteToken) : undefined;
    if (!invitation && parsed.data.accountRole === 'couple') {
      return reply.code(400).send({
        error: 'couple-invite-required',
        message: 'Booked couples should use the invitation link sent by the venue so access is limited to their wedding.',
      });
    }
    if (!invitation && !parsed.data.orgName) {
      return reply.code(400).send({ error: 'organization-required' });
    }
    if (invitation && invitation.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
      return reply.code(400).send({ error: 'invite-email-mismatch' });
    }

    const pwd = hashPassword(parsed.data.password);
    const user = usersRepo.create({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: pwd.passwordHash,
      passwordSalt: pwd.passwordSalt,
      passwordIterations: pwd.iterations,
    });
    let orgId: string;
    let acceptedEventId: string | null = null;
    if (invitation) {
      orgId = invitation.organization_id;
      if (invitation.invitation_type === 'event' && invitation.event_id) {
        eventsRepo.addMember({ eventId: invitation.event_id, userId: user.id, roleId: invitation.role_id });
        acceptedEventId = invitation.event_id;
      } else {
        orgsRepo.addMember({ orgId, userId: user.id, roleId: invitation.role_id, invitedBy: invitation.invited_by ?? undefined });
      }
      teamInvitationsRepo.markAccepted(invitation.id);
    } else {
      orgId = orgsRepo.createWithOwner({
        name: parsed.data.orgName!,
        slug: `${slugify(parsed.data.orgName!)}-${user.id.slice(0, 6)}`,
        ownerId: user.id,
      });
    }
    auditRepo.log({
      organizationId: orgId, actorUserId: user.id, actorLabel: user.email,
      action: invitation ? 'user.register.accept_invite' : 'user.register', ip: req.ip, userAgent: req.headers['user-agent'],
      details: { accountRole: parsed.data.accountRole ?? 'venue_owner', inviteId: invitation?.id, invitationType: invitation?.invitation_type, eventId: acceptedEventId },
    });
    const token = app.jwt.sign({ sub: user.id, email: user.email, sv: user.session_version });
    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      organizationId: orgId,
      eventId: acceptedEventId,
      redirectTo: acceptedEventId ? `/couple/events/${acceptedEventId}` : undefined,
    });
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-input' });

    const user = usersRepo.findByEmail(parsed.data.email);
    if (!user) {
      // Anti-timing-attack dummy hash
      verifyPassword(parsed.data.password, {
        passwordHash: 'A'.repeat(44),
        passwordSalt: 'AAAAAAAAAAAAAAAAAAAAAA==',
      });
      return reply.code(401).send({ error: 'invalid-credentials' });
    }
    if (user.status !== 'active') return reply.code(403).send({ error: 'account-disabled' });
    if (usersRepo.isLocked(user)) return reply.code(429).send({ error: 'account-locked' });

    const ok = verifyPassword(parsed.data.password, {
      passwordHash: user.password_hash,
      passwordSalt: user.password_salt,
      iterations: user.password_iterations ?? undefined,
    });
    if (!ok) {
      usersRepo.recordFailedLogin(user.id);
      auditRepo.log({
        actorUserId: user.id, actorLabel: user.email,
        action: 'user.login.failed', ip: req.ip, userAgent: req.headers['user-agent'],
      });
      return reply.code(401).send({ error: 'invalid-credentials' });
    }
    usersRepo.clearFailedLogin(user.id);
    // Rehash-on-login: transparently upgrade legacy-work-factor hashes without
    // invalidating the session about to be issued.
    if (needsRehash({ iterations: user.password_iterations })) {
      const upgraded = hashPassword(parsed.data.password);
      usersRepo.upgradePasswordHash(user.id, upgraded.passwordHash, upgraded.passwordSalt, upgraded.iterations);
      auditRepo.log({
        actorUserId: user.id, actorLabel: user.email,
        action: 'user.password.rehashed', ip: req.ip,
        details: { fromIterations: user.password_iterations ?? 120000, toIterations: upgraded.iterations },
      });
    }
    auditRepo.log({
      actorUserId: user.id, actorLabel: user.email,
      action: 'user.login', ip: req.ip, userAgent: req.headers['user-agent'],
    });
    const token = app.jwt.sign({ sub: user.id, email: user.email, sv: user.session_version });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name },
    });
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    return {
      user: { id: req.auth!.userId, email: req.auth!.email },
      memberships: req.auth!.memberships,
    };
  });

  app.post('/api/auth/magic-link/request', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = magicLinkRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-input' });
    const user = usersRepo.findByEmail(parsed.data.email);
    let magicToken: string | undefined;
    let expiresAt: string | undefined;
    if (user?.status === 'active') {
      const hasCoupleAccess = db.prepare(
        `SELECT 1 FROM event_memberships em JOIN roles r ON r.id = em.role_id WHERE em.user_id = ? AND em.status = 'active' AND r.key = 'couple' LIMIT 1`,
      ).get(user.id);
      if (hasCoupleAccess) {
        const token = passwordResetTokensRepo.create(user.id, 15 * 60 * 1000);
        magicToken = token.token;
        expiresAt = token.expiresAt;
        const firstCoupleEvent = db.prepare(
          `SELECT e.id AS event_id, e.organization_id, e.title FROM event_memberships em JOIN roles r ON r.id = em.role_id JOIN events e ON e.id = em.event_id WHERE em.user_id = ? AND em.status = 'active' AND r.key = 'couple' AND e.deleted_at IS NULL ORDER BY e.start_date IS NULL, e.start_date LIMIT 1`,
        ).get(user.id) as { event_id: string; organization_id: string; title: string } | undefined;
        const baseUrl = (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
        const magicUrl = `${baseUrl}/#/magic-link?token=${encodeURIComponent(token.token)}`;
        const smtp = firstCoupleEvent ? integrationsRepo.findByOrgProvider(firstCoupleEvent.organization_id, 'email_smtp') : undefined;
        let delivery: Record<string, unknown> = { channel: 'none', queued: false };
        if (smtp?.status === 'connected' && firstCoupleEvent) {
          jobsRepo.enqueue({
            kind: 'email.send',
            organizationId: firstCoupleEvent.organization_id,
            payload: {
              integrationId: smtp.id,
              to: user.email,
              subject: `Sign in to your wedding hub${firstCoupleEvent.title ? ` for ${firstCoupleEvent.title}` : ''}`,
              text: `Use this one-time link to sign in to your private wedding hub. It expires in 15 minutes.\n\n${magicUrl}`,
              html: `<p>Use this one-time link to sign in to your private wedding hub. It expires in 15 minutes.</p><p><a href="${magicUrl}">Open wedding hub</a></p>`,
              headers: { 'X-WVI-Email-Type': 'couple-magic-link' },
            },
            maxAttempts: 5,
          });
          delivery = { channel: 'smtp', queued: true };
        }
        auditRepo.log({ actorUserId: user.id, actorLabel: user.email, action: 'user.magic_link.request', targetType: 'user', targetId: user.id, ip: req.ip, userAgent: req.headers['user-agent'], details: { ...delivery, eventId: firstCoupleEvent?.event_id } });
      }
    }
    const body: Record<string, unknown> = { ok: true, message: 'If a booked-couple account exists for that email, a sign-in link will be sent.' };
    if (magicToken && (process.env.NODE_ENV !== 'production' || process.env.TEST_DB === ':memory:')) {
      body.magicToken = magicToken;
      body.expiresAt = expiresAt;
    }
    return reply.send(body);
  });

  app.post('/api/auth/magic-link/complete', { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = magicLinkCompleteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-input' });
    const reset = passwordResetTokensRepo.findValidByToken(parsed.data.token);
    if (!reset) return reply.code(400).send({ error: 'invalid-magic-link' });
    const user = usersRepo.findById(reset.user_id);
    if (!user || user.status !== 'active') return reply.code(400).send({ error: 'invalid-magic-link' });
    const firstCoupleEvent = db.prepare(
      `SELECT em.event_id FROM event_memberships em JOIN roles r ON r.id = em.role_id JOIN events e ON e.id = em.event_id WHERE em.user_id = ? AND em.status = 'active' AND r.key = 'couple' AND e.deleted_at IS NULL ORDER BY e.start_date IS NULL, e.start_date LIMIT 1`,
    ).get(user.id) as { event_id: string } | undefined;
    if (!firstCoupleEvent) return reply.code(400).send({ error: 'not-a-couple-account' });
    passwordResetTokensRepo.markUsed(reset.id);
    auditRepo.log({ actorUserId: user.id, actorLabel: user.email, action: 'user.magic_link.login', targetType: 'user', targetId: user.id, ip: req.ip, userAgent: req.headers['user-agent'], details: { eventId: firstCoupleEvent.event_id } });
    const token = app.jwt.sign({ sub: user.id, email: user.email, sv: user.session_version });
    return reply.send({ token, user: { id: user.id, email: user.email, fullName: user.full_name }, eventId: firstCoupleEvent.event_id, redirectTo: `/couple/events/${firstCoupleEvent.event_id}` });
  });

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (req) => {
    // Optionally invalidate all sessions on logout. Here we just record it.
    auditRepo.log({
      actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'user.logout', ip: req.ip,
    });
    return { ok: true };
  });

  // ─── Password reset request/complete ───────────────────
  app.post('/api/auth/password-reset/request', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-input' });

    const user = usersRepo.findByEmail(parsed.data.email);
    let resetToken: string | undefined;
    let expiresAt: string | undefined;

    if (user?.status === 'active') {
      const token = passwordResetTokensRepo.create(user.id);
      resetToken = token.token;
      expiresAt = token.expiresAt;
      let deliveryDetails: Record<string, unknown>;
      try {
        const delivery = await deliverPasswordReset({
          userId: user.id,
          email: user.email,
          fullName: user.full_name,
          token: token.token,
          expiresAt: token.expiresAt,
        });
        deliveryDetails = { delivery: delivery.channel, queued: delivery.queued };
      } catch (err) {
        // Preserve non-enumerating semantics for the public endpoint. Operations
        // can find delivery failures in audit logs without exposing anything to
        // the requester.
        deliveryDetails = { delivery: 'failed', error: (err as Error).message };
      }
      auditRepo.log({
        actorUserId: user.id,
        actorLabel: user.email,
        action: 'user.password.reset.request',
        targetType: 'user',
        targetId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: deliveryDetails,
      });
    }

    const body: Record<string, unknown> = {
      ok: true,
      message: 'If an account exists for that email, a password reset link will be sent.',
    };
    if (resetToken && (process.env.NODE_ENV !== 'production' || process.env.TEST_DB === ':memory:')) {
      body.resetToken = resetToken;
      body.expiresAt = expiresAt;
    }
    return reply.send(body);
  });

  app.post('/api/auth/password-reset/complete', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = passwordResetCompleteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-input' });

    const reset = passwordResetTokensRepo.findValidByToken(parsed.data.token);
    if (!reset) return reply.code(400).send({ error: 'invalid-reset-token' });

    const user = usersRepo.findById(reset.user_id);
    if (!user || user.status !== 'active') return reply.code(400).send({ error: 'invalid-reset-token' });

    const pwd = hashPassword(parsed.data.newPassword);
    usersRepo.changePassword(user.id, pwd.passwordHash, pwd.passwordSalt, pwd.iterations);
    passwordResetTokensRepo.markUsed(reset.id);
    auditRepo.log({
      actorUserId: user.id,
      actorLabel: user.email,
      action: 'user.password.reset.complete',
      targetType: 'user',
      targetId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return reply.send({ ok: true });
  });

  // ─── Change password ──────────────────────────────────
  app.post("/api/auth/change-password", { preHandler: requireAuth, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const parsed = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(200),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest("invalid-input", parsed.error.issues);

    const user = usersRepo.findById(req.auth!.userId);
    if (!user) throw NotFound();

    const valid = verifyPassword(parsed.data.currentPassword, {
      passwordHash: user.password_hash, passwordSalt: user.password_salt,
      iterations: user.password_iterations ?? undefined,
    });
    if (!valid) return { error: "invalid-current-password" };

    const pwd = hashPassword(parsed.data.newPassword);
    usersRepo.changePassword(req.auth!.userId, pwd.passwordHash, pwd.passwordSalt, pwd.iterations);
    auditRepo.log({
      actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: "user.password.change", ip: req.ip,
    });
    return { ok: true };
  });

  // ─── Update profile ───────────────────────────────────
  app.patch("/api/auth/profile", { preHandler: requireAuth }, async (req) => {
    const parsed = z.object({
      fullName: z.string().min(1).max(200).optional(),
      phone: z.string().max(40).optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest("invalid-input", parsed.error.issues);
    usersRepo.updateProfile(req.auth!.userId, parsed.data);
    const user = usersRepo.findById(req.auth!.userId);
    return { user: { id: user!.id, email: user!.email, fullName: user!.full_name, phone: user!.phone } };
  });

}
