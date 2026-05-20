import { z } from 'zod';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { auditRepo, orgsRepo, usersRepo } from '../db/repos.js';
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
function slugify(s) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}
export async function authRoutes(app) {
    // ─── POST /api/auth/register ────────────────────────────────
    app.post('/api/auth/register', async (req, reply) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid-input', issues: parsed.error.issues });
        }
        const { email, password, fullName, orgName } = parsed.data;
        if (usersRepo.findByEmail(email)) {
            return reply.code(409).send({ error: 'email-already-registered' });
        }
        const pwd = hashPassword(password);
        const user = usersRepo.create({
            email,
            fullName,
            passwordHash: pwd.passwordHash,
            passwordSalt: pwd.passwordSalt,
        });
        const orgId = orgsRepo.createWithOwner({
            name: orgName,
            slug: `${slugify(orgName)}-${user.id.slice(0, 6)}`,
            ownerId: user.id,
        });
        auditRepo.log({
            organizationId: orgId,
            actorUserId: user.id,
            actorLabel: user.email,
            action: 'user.register',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        const token = app.jwt.sign({
            sub: user.id,
            email: user.email,
            sv: user.session_version,
        });
        return reply.code(201).send({
            token,
            user: { id: user.id, email: user.email, fullName: user.full_name },
            organizationId: orgId,
        });
    });
    // ─── POST /api/auth/login ───────────────────────────────────
    app.post('/api/auth/login', async (req, reply) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid-input' });
        }
        const { email, password } = parsed.data;
        const user = usersRepo.findByEmail(email);
        // Constant-time-ish: still hash a dummy password to avoid leaking
        // whether the email is registered via response timing.
        if (!user) {
            verifyPassword(password, {
                passwordHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                passwordSalt: 'AAAAAAAAAAAAAAAAAAAAAA==',
            });
            return reply.code(401).send({ error: 'invalid-credentials' });
        }
        if (user.status !== 'active') {
            return reply.code(403).send({ error: 'account-disabled' });
        }
        const ok = verifyPassword(password, {
            passwordHash: user.password_hash,
            passwordSalt: user.password_salt,
        });
        if (!ok) {
            auditRepo.log({
                actorUserId: user.id,
                actorLabel: user.email,
                action: 'user.login.failed',
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return reply.code(401).send({ error: 'invalid-credentials' });
        }
        auditRepo.log({
            actorUserId: user.id,
            actorLabel: user.email,
            action: 'user.login',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        const token = app.jwt.sign({
            sub: user.id,
            email: user.email,
            sv: user.session_version,
        });
        return reply.send({
            token,
            user: { id: user.id, email: user.email, fullName: user.full_name },
        });
    });
    // ─── GET /api/auth/me ───────────────────────────────────────
    app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
        return {
            user: { id: req.auth.userId, email: req.auth.email },
            memberships: req.auth.memberships,
        };
    });
}
//# sourceMappingURL=auth.js.map