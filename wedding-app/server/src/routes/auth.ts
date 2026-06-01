import type { FastifyInstance } from 'fastify';
import { BadRequest, NotFound } from '../lib/errors.js';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { slugify } from '../lib/slug.js';
import { auditRepo, orgsRepo, usersRepo } from '../db/repos/index.js';
import { requireAuth } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  fullName: z.string().min(1).max(120),
  orgName: z.string().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid-input', issues: parsed.error.issues });
    }
    if (usersRepo.findByEmail(parsed.data.email)) {
      return reply.code(409).send({ error: 'email-already-registered' });
    }
    const pwd = hashPassword(parsed.data.password);
    const user = usersRepo.create({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: pwd.passwordHash,
      passwordSalt: pwd.passwordSalt,
    });
    const orgId = orgsRepo.createWithOwner({
      name: parsed.data.orgName,
      slug: `${slugify(parsed.data.orgName)}-${user.id.slice(0, 6)}`,
      ownerId: user.id,
    });
    auditRepo.log({
      organizationId: orgId, actorUserId: user.id, actorLabel: user.email,
      action: 'user.register', ip: req.ip, userAgent: req.headers['user-agent'],
    });
    const token = app.jwt.sign({ sub: user.id, email: user.email, sv: user.session_version });
    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      organizationId: orgId,
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

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (req) => {
    // Optionally invalidate all sessions on logout. Here we just record it.
    auditRepo.log({
      actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'user.logout', ip: req.ip,
    });
    return { ok: true };
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
    });
    if (!valid) return { error: "invalid-current-password" };

    const pwd = hashPassword(parsed.data.newPassword);
    usersRepo.changePassword(req.auth!.userId, pwd.passwordHash, pwd.passwordSalt);
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
