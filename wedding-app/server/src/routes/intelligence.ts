/**
 * Intelligence Platform routes — vendor ratings, email templates,
 * payment links, recommendations, and lead source analytics.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { eventsRepo, auditRepo, vendorsRepo } from '../db/repos/index.js';
import { vendorRatingsRepo } from '../db/repos/vendorRatings.js';
import { emailTemplatesRepo } from '../db/repos/emailTemplates.js';
import { paymentLinksRepo } from '../db/repos/paymentLinks.js';
import { recommendationsRepo } from '../db/repos/recommendations.js';
import { forecastRepo } from '../db/repos/forecast.js';
import { vendorScoringRepo } from '../db/repos/vendorScoring.js';
import { riskRepo } from '../db/repos/risk.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

export async function intelligenceRoutes(app: FastifyInstance) {
  // ═══ VENDOR RATINGS ═══════════════════════════════════
  app.post('/api/vendors/:vendorId/ratings', { preHandler: requireAuth }, async (req, reply) => {
    const { vendorId } = req.params as { vendorId: string };
    const parsed = z.object({
      eventId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      qualityScore: z.number().int().min(1).max(5).optional(),
      timelinessScore: z.number().int().min(1).max(5).optional(),
      communicationScore: z.number().int().min(1).max(5).optional(),
      review: z.string().max(2000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // Resolve the vendor's real org and scope the permission check to it.
    // Using an empty scope ({}) previously allowed a user with vendors.manage
    // in ANY org to rate vendors in OTHER orgs (horizontal privilege / IDOR).
    const vendor = vendorsRepo.findById(vendorId);
    if (!vendor) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: vendor.organization_id }, 'vendors.manage')) throw Forbidden();

    const rating = vendorRatingsRepo.create({
      organizationId: vendor.organization_id,
      vendorId, ...parsed.data, ratedBy: req.auth!.userId,
    });
    return reply.code(201).send({ rating });
  });

  app.get('/api/vendors/:vendorId/ratings', { preHandler: requireAuth }, async (req) => {
    const { vendorId } = req.params as { vendorId: string };
    const vendor = vendorsRepo.findById(vendorId);
    if (!vendor) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: vendor.organization_id }, 'vendors.view')) throw Forbidden();
    return {
      ratings: vendorRatingsRepo.listForVendor(vendorId),
      aggregate: vendorRatingsRepo.aggregate(vendorId),
    };
  });

  // ═══ EMAIL TEMPLATES ══════════════════════════════════
  app.get('/api/orgs/:orgId/email-templates', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'invites.view')) throw Forbidden();
    return { templates: emailTemplatesRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/email-templates', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'invites.manage')) throw Forbidden();
    const parsed = z.object({
      name: z.string().min(1).max(100),
      subject: z.string().min(1).max(200),
      bodyHtml: z.string().max(50000),
      bodyText: z.string().max(10000).optional(),
      category: z.enum(['save_the_date','invitation','rsvp_reminder','thank_you','logistics','custom']).optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const template = emailTemplatesRepo.create(orgId, { ...parsed.data, createdBy: req.auth!.userId });
    return reply.code(201).send({ template });
  });

  app.delete('/api/email-templates/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = emailTemplatesRepo.findById(id);
    if (!template) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: template.organization_id }, 'invites.manage')) throw Forbidden();
    emailTemplatesRepo.delete(id);
    return reply.code(204).send();
  });

  // ─── Template preview (render with sample data) ───────
  app.post('/api/email-templates/:id/preview', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const template = emailTemplatesRepo.findById(id);
    if (!template) throw NotFound();
    // Scope the preview to the template's org so users can't render templates
    // belonging to organizations they aren't a member of.
    if (!can(req.auth!.memberships, { organizationId: template.organization_id }, 'invites.view')) throw Forbidden();
    const sampleData: Record<string, string> = {
      guest_name: 'Jane Smith', event_title: 'Smith Wedding',
      event_date: 'September 12, 2026', table_assignment: 'Table 3',
      rsvp_deadline: 'August 1, 2026', venue_name: 'Seven Paths Manor',
      portal_link: 'https://venue.example.com/#/portal/demo',
    };
    return { rendered: emailTemplatesRepo.render(template, sampleData) };
  });

  // ═══ PAYMENT LINKS ════════════════════════════════════
  app.get('/api/events/:eventId/payments', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'budget.view', orgMap)) throw Forbidden();
    return {
      payments: paymentLinksRepo.listForEvent(eventId),
      totals: paymentLinksRepo.totalsForEvent(eventId),
    };
  });

  app.post('/api/events/:eventId/payments', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'budget.manage', orgMap)) throw Forbidden();
    const parsed = z.object({
      contractId: z.string().optional(),
      provider: z.enum(['manual','stripe','square','paypal']).optional(),
      amountCents: z.number().int().min(1),
      paymentUrl: z.string().url().optional(),
      externalId: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const payment = paymentLinksRepo.create({
      organizationId: event.organization_id, eventId, ...parsed.data,
    });
    return reply.code(201).send({ payment });
  });

  app.patch('/api/payments/:id/status', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const payment = paymentLinksRepo.findById(id);
    if (!payment) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: payment.organization_id }, 'budget.manage')) throw Forbidden();
    const parsed = z.object({
      status: z.enum(['pending','processing','completed','failed','refunded']),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { payment: paymentLinksRepo.updateStatus(id, parsed.data.status, parsed.data.status === 'completed' ? new Date().toISOString() : undefined) };
  });

  // ═══ RECOMMENDATIONS ENGINE ═══════════════════════════
  app.get('/api/orgs/:orgId/recommendations', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'reports.view')) throw Forbidden();
    return { recommendations: recommendationsRepo.forOrg(orgId) };
  });

  // ═══ PREDICTIVE FORECAST ══════════════════════════════
  app.get('/api/orgs/:orgId/forecast', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'reports.view')) throw Forbidden();
    const q = req.query as { history?: string; horizon?: string };
    const history = Math.min(36, Math.max(6, Number(q.history) || 24));
    const horizon = Math.min(12, Math.max(1, Number(q.horizon) || 6));
    return { forecast: forecastRepo.forOrg(orgId, history, horizon) };
  });

  // ═══ VENDOR RELIABILITY SCORES ════════════════════════
  app.get('/api/orgs/:orgId/vendor-scores', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.view')) throw Forbidden();
    return { scores: vendorScoringRepo.scoreAll(orgId) };
  });

  // ═══ SMART VENDOR MATCHING (per event) ════════════════
  app.get('/api/events/:eventId/vendor-matches', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'vendors.view', orgMap)) throw Forbidden();
    const q = req.query as { category?: string; limit?: string };
    const matches = vendorScoringRepo.matchForEvent(event.organization_id, {
      category: q.category,
      budgetCents: event.budget_cents ?? undefined,
      limit: q.limit ? Math.min(50, Math.max(1, Number(q.limit))) : 8,
    });
    return { matches };
  });

  // ═══ ANOMALY & RISK ALERTS ════════════════════════════
  // Org-wide event health (riskiest events first).
  app.get('/api/orgs/:orgId/risk-alerts', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'reports.view')) throw Forbidden();
    return { events: riskRepo.forOrg(orgId) };
  });

  // Single event's risk assessment.
  app.get('/api/events/:eventId/risk-alerts', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { risk: riskRepo.forEvent(eventId) };
  });
}
