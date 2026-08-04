import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { vendorsRepo, assetsRepo, auditRepo, orgsRepo, integrationsRepo, jobsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound, Unauthorized } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';
import { assertNoPublicHoneypot, auditPublicSubmission } from '../lib/publicAbuse.js';
import { saveDocumentDataUri, privateFilePath } from '../lib/fileStorage.js';
import { createReadStream, existsSync } from 'node:fs';

const vendorSchema = z.object({
  name:                 z.string().min(1).max(200),
  category:             z.string().max(40).optional(),
  contactName:          z.string().max(200).optional(),
  email:                z.string().email().max(254).optional().or(z.literal('')),
  phone:                z.string().max(40).optional(),
  websiteUrl:           z.string().url().max(2000).optional().or(z.literal('')),
  contractAmountCents:  z.number().int().min(0).optional(),
  isPreferred:          z.boolean().optional(),
  notes:                z.string().max(4000).optional(),
  metadata:             z.record(z.unknown()).optional(),
  eventId:              z.string().nullable().optional(),
});

const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paidAt:      z.string().min(1),
  method:      z.string().max(40).optional(),
  notes:       z.string().max(2000).optional(),
});

const portalTokenSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional().default(30),
});

const portalInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional().default(30),
  message: z.string().max(2000).optional(),
});

const coiUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(['application/pdf','image/jpeg','image/png','image/webp']),
  dataUri: z.string().min(1),
  expiresAt: z.string().optional(),
});

function parseVendorMetadata(metadata: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function publicVendorPortalView(v: NonNullable<ReturnType<typeof vendorsRepo.findById>>) {
  // Keep the unauthenticated portal useful for assigned vendors, but do not
  // disclose internal CRM fields such as notes or private contact details.
  return {
    id: v.id,
    event_id: v.event_id,
    name: v.name,
    category: v.category,
    contract_amount_cents: v.contract_amount_cents,
    amount_paid_cents: v.amount_paid_cents,
    is_preferred: v.is_preferred,
    metadata: (() => {
      const metadata = parseVendorMetadata(v.metadata);
      // Never expose the backing private storage URL through portal payloads.
      delete metadata.coiLink;
      return metadata;
    })(),
  };
}

function portalTokenFrom(req: { query?: unknown; body?: unknown }): string | null {
  const queryToken = (req.query as { token?: unknown } | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();
  const bodyToken = (req.body as { token?: unknown } | undefined)?.token;
  if (typeof bodyToken === 'string' && bodyToken.trim()) return bodyToken.trim();
  return null;
}

function assertValidVendorPortalToken(vendorId: string, token: string | null) {
  if (!token) throw Unauthorized('vendor-portal-token-required');
  const row = vendorsRepo.verifyPortalToken(vendorId, token);
  if (!row) throw Unauthorized('vendor-portal-token-invalid-or-expired');
  return row;
}

function portalExpiresAt(expiresInDays: number): string {
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
}

function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

async function deliverVendorInvite(input: { vendor: NonNullable<ReturnType<typeof vendorsRepo.findById>>; token: string; expiresAt: string; message?: string }) {
  const url = `${appBaseUrl()}/#/vendor/${input.vendor.id}?token=${encodeURIComponent(input.token)}`;
  const subject = `Vendor portal invitation for ${input.vendor.name}`;
  const text = [
    input.message || `Please complete your vendor onboarding details for the event.`,
    '',
    `Open your secure vendor portal: ${url}`,
    `This link expires ${new Date(input.expiresAt).toLocaleString()}.`,
  ].join('\n');
  const html = `<p>${input.message || 'Please complete your vendor onboarding details for the event.'}</p><p><a href="${url}">Open secure vendor portal</a></p><p>This link expires ${new Date(input.expiresAt).toLocaleString()}.</p>`;

  const smtp = integrationsRepo.findByOrgProvider(input.vendor.organization_id, 'email_smtp');
  if (smtp?.status === 'connected' && input.vendor.email) {
    jobsRepo.enqueue({ kind: 'email.send', organizationId: input.vendor.organization_id, payload: { integrationId: smtp.id, to: input.vendor.email, subject, text, html, headers: { 'X-WVI-Email-Type': 'vendor-portal-invite' } } });
    return { channel: 'smtp', queued: true, url };
  }
  const webhookUrl = process.env.VENDOR_INVITE_WEBHOOK_URL || process.env.WVI_VENDOR_INVITE_WEBHOOK_URL;
  if (webhookUrl && input.vendor.email) {
    const res = await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'vendor_portal.invite', to: input.vendor.email, subject, text, html, url, expiresAt: input.expiresAt }) });
    if (!res.ok) throw new Error(`vendor invite webhook failed: HTTP ${res.status}`);
    return { channel: 'webhook', queued: false, url };
  }
  return { channel: 'copy_only', queued: false, url };
}

export async function vendorRoutes(app: FastifyInstance) {
  // ─── Public Portal Endpoints ───────────────────────
  app.get('/api/portal/vendors/:id/info', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    assertValidVendorPortalToken(id, portalTokenFrom(req));
    const currentMeta = parseVendorMetadata(v.metadata);
    vendorsRepo.update(id, { metadata: { ...currentMeta, lastPortalActivityAt: new Date().toISOString() } });
    
    // We need the event and timeline
    let event = null;
    let timeline: any[] = [];
    let layouts: any[] = [];
    
    if (v.event_id) {
       const { eventsRepo, timelineRepo, layoutsRepo } = await import('../db/repos/index.js');
       event = eventsRepo.findById(v.event_id);
       if (event) {
         // VE-04: vendors see a run-of-show, not the venue's internal plan.
         // Strip internal fields from the event, and show each timeline item
         // in full only when it belongs to this vendor; other items keep
         // title/time/location but lose internal notes/metadata.
         const rawTimeline = timelineRepo.listForEvent(v.event_id);
         timeline = rawTimeline.map((item: any) => {
           const isOwn = item.vendor_id === v.id;
           let meta: Record<string, any> = {};
           try { meta = JSON.parse(item.metadata || '{}'); } catch { /* ignore */ }
           return {
             id: item.id,
             title: item.title,
             category: item.category,
             starts_at: item.starts_at,
             ends_at: item.ends_at,
             duration_min: item.duration_min,
             location: item.location,
             vendor_id: item.vendor_id,
             notes: isOwn ? item.notes : (meta.vendorVisibleNotes || null),
             assignedTo: item.assigned_to,
           };
         });
         layouts = layoutsRepo.listForOrg(event.organization_id, { eventId: v.event_id });
         // Never expose internal event metadata (budget, handoff, day-of
         // contact, setup checklist, manager notes) to the vendor portal.
         event = {
           id: event.id,
           organization_id: event.organization_id,
           title: event.title,
           status: event.status,
           start_date: event.start_date,
           end_date: event.end_date,
           venue_id: event.venue_id ?? null,
         };
       }
    }
    
    const org = event ? orgsRepo.findById(event.organization_id) : orgsRepo.findById(v.organization_id);
    const branding = org ? parseVendorMetadata(org.branding) : {};

    return {
      vendor: publicVendorPortalView(v),
      event,
      timeline,
      layouts,
      branding: {
        platformName: typeof branding.platformName === 'string' && branding.platformName.trim() ? branding.platformName : org?.name ?? 'Wedding Venue Intelligence',
        logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : '',
        tagline: typeof branding.tagline === 'string' ? branding.tagline : '',
        brandColor: typeof branding.brandColor === 'string' ? branding.brandColor : '',
        supportEmail: typeof branding.supportEmail === 'string' ? branding.supportEmail : org?.support_email ?? '',
      },
    };
  });

  app.get('/api/orgs/:orgId/vendors', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId } = req.query as { eventId?: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.view')) throw Forbidden();
    return { vendors: vendorsRepo.listForOrg(orgId, { eventId }) };
  });

  app.get('/api/orgs/:orgId/vendor-portal-tokens', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.view')) throw Forbidden();
    return { tokens: vendorsRepo.listPortalTokenSummariesForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/vendors', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.manage')) throw Forbidden();
    const parsed = vendorSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const vendor = vendorsRepo.create(orgId, parsed.data);
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.create', targetType: 'vendor', targetId: vendor.id, ip: req.ip,
    });
    return reply.code(201).send({ vendor });
  });

  app.patch('/api/vendors/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const parsed = vendorSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = vendorsRepo.update(id, parsed.data);
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.update', targetType: 'vendor', targetId: id, ip: req.ip,
      details: { fields: Object.keys(parsed.data) },
    });
    broadcastSSE(v.organization_id, 'vendor.updated', { vendorId: id, eventId: updated?.event_id ?? null }, req.auth!.userId);
    return { vendor: updated };
  });

  app.delete('/api/vendors/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    vendorsRepo.softDelete(id);
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.delete', targetType: 'vendor', targetId: id, ip: req.ip,
      details: { eventId: v.event_id },
    });
    broadcastSSE(v.organization_id, 'vendor.deleted', { vendorId: id, eventId: v.event_id }, req.auth!.userId);
    return reply.code(204).send();
  });

  app.post('/api/vendors/:id/portal-token', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.invite') &&
        !can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();

    const parsed = portalTokenSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    // Rotation policy: generating a new portal link revokes all prior active links.
    vendorsRepo.revokePortalTokens(id);
    const { token, row } = vendorsRepo.createPortalToken(id, {
      expiresAt: portalExpiresAt(parsed.data.expiresInDays),
      createdBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.portal_token.create', targetType: 'vendor', targetId: id, ip: req.ip,
    });
    return reply.code(201).send({ token, tokenId: row.id, expiresAt: row.expires_at });
  });

  app.post('/api/vendors/:id/portal-invite', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.invite') &&
        !can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const parsed = portalInviteSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    vendorsRepo.revokePortalTokens(id);
    const { token, row } = vendorsRepo.createPortalToken(id, { expiresAt: portalExpiresAt(parsed.data.expiresInDays), createdBy: req.auth!.userId });
    const delivery = await deliverVendorInvite({ vendor: v, token, expiresAt: row.expires_at, message: parsed.data.message });
    const meta = parseVendorMetadata(v.metadata);
    vendorsRepo.update(id, { metadata: { ...meta, portalInvitedAt: new Date().toISOString(), portalInviteDelivery: delivery.channel } });
    auditRepo.log({ organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'vendor.portal_invite.send', targetType: 'vendor', targetId: id, ip: req.ip, details: { delivery: delivery.channel, queued: delivery.queued } });
    return reply.code(201).send({ ok: true, tokenId: row.id, expiresAt: row.expires_at, delivery, ...(process.env.NODE_ENV !== 'production' || process.env.TEST_DB === ':memory:' ? { token } : {}) });
  });

  app.delete('/api/vendors/:id/portal-token', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.invite') &&
        !can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    vendorsRepo.revokePortalTokens(id);
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.portal_token.revoke', targetType: 'vendor', targetId: id, ip: req.ip,
    });
    return reply.code(204).send();
  });

  // Payments
  app.get('/api/vendors/:id/payments', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.view')) throw Forbidden();
    return { payments: vendorsRepo.listPayments(id) };
  });

  app.post('/api/vendors/:id/payments', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const payment = vendorsRepo.addPayment(id, parsed.data);
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.payment.add', targetType: 'vendor', targetId: id, ip: req.ip,
      details: { paymentId: payment.id, amountCents: payment.amount_cents, paidAt: payment.paid_at, method: payment.method ?? null },
    });
    broadcastSSE(v.organization_id, 'vendor.payment', { vendorId: id, eventId: v.event_id, amountCents: payment.amount_cents }, req.auth!.userId);
    return reply.code(201).send({ payment });
  });

  // ── Payment correction (VE-07): a mistaken entry must be removable, with
  // the original record preserved in the audit log and the running total
  // decremented (floored at 0).
  app.delete('/api/vendors/:id/payments/:paymentId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, paymentId } = req.params as { id: string; paymentId: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const payment = vendorsRepo.deletePayment(id, paymentId);
    if (!payment) throw NotFound('vendor-payment-not-found');
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.payment.delete', targetType: 'vendor', targetId: id, ip: req.ip,
      details: { paymentId, amountCents: payment.amount_cents, paidAt: payment.paid_at, method: payment.method ?? null, notes: payment.notes ?? null },
    });
    broadcastSSE(v.organization_id, 'vendor.payment', { vendorId: id, eventId: v.event_id, amountCents: -payment.amount_cents, deleted: true }, req.auth!.userId);
    return reply.code(204).send();
  });

  // ── COI review (VE-02): the venue approves or requests changes on an
  // uploaded COI. The vendor portal reflects the decision.
  app.post('/api/vendors/:id/coi-review', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const parsed = z.object({
      status: z.enum(['approved', 'changes_requested']),
      note: z.string().max(2000).optional(),
    }).safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const meta = parseVendorMetadata(v.metadata);
    if (!meta.coiReceived) throw BadRequest('coi-not-received');
    const updated = vendorsRepo.update(id, {
      metadata: {
        ...meta,
        coiVerificationStatus: parsed.data.status,
        coiReviewedAt: new Date().toISOString(),
        coiReviewedBy: req.auth!.email,
        coiReviewNote: parsed.data.note || undefined,
      },
    });
    auditRepo.log({
      organizationId: v.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.coi.review', targetType: 'vendor', targetId: id, ip: req.ip,
      details: { status: parsed.data.status, note: parsed.data.note ?? null },
    });
    broadcastSSE(v.organization_id, 'vendor.updated', { vendorId: id, eventId: v.event_id }, req.auth!.userId);
    return reply.code(200).send({ vendor: updated });
  });

  app.post('/api/portal/vendors/:id/questionnaire', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { vendorsRepo } = await import('../db/repos/index.js');
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: v.organization_id, action: 'vendor.questionnaire.blocked', targetType: 'vendor', targetId: id });
    assertValidVendorPortalToken(id, portalTokenFrom(req));

    const body = { ...((req.body ?? {}) as Record<string, unknown>) };
    delete body.token;
    const parsed = z.record(z.unknown()).safeParse(body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    const meta = parseVendorMetadata(v.metadata);

    meta.questionnaire = {
      ...(meta.questionnaire as Record<string, unknown> || {}),
      ...parsed.data,
      submittedAt: new Date().toISOString()
    };

    const updated = vendorsRepo.update(id, { metadata: meta });
    auditPublicSubmission(req, {
      organizationId: v.organization_id,
      action: 'vendor.questionnaire.submit',
      targetType: 'vendor',
      targetId: id,
      details: { fields: Object.keys(parsed.data).filter(k => k !== 'token') },
    });
    return { ok: true, vendor: updated ? publicVendorPortalView(updated) : null };
  });

  app.post('/api/portal/vendors/:id/coi-upload', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: v.organization_id, action: 'vendor.coi_upload.blocked', targetType: 'vendor', targetId: id });
    assertValidVendorPortalToken(id, portalTokenFrom(req));
    const parsed = coiUploadSchema.extend({ token: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const url = saveDocumentDataUri(parsed.data.dataUri, `vendor_coi_${id}`);
    let coiAssetId: string | undefined;
    if (privateFilePath(url)) {
      const asset = assetsRepo.create({ organization_id: v.organization_id, event_id: v.event_id, owner_type: 'vendor_coi', owner_id: id, storage_key: url, original_filename: parsed.data.fileName, mime_type: parsed.data.mimeType, visibility: 'capability', publish_status: 'approved', created_by: null });
      coiAssetId = asset.id;
    }
    const meta = parseVendorMetadata(v.metadata);
    const updated = vendorsRepo.update(id, { metadata: {
      ...meta,
      coiReceived: true,
      coiLink: url,
      coiFileName: parsed.data.fileName,
      coiMimeType: parsed.data.mimeType,
      coiExpirationDate: parsed.data.expiresAt || (meta.coiExpirationDate as string | undefined),
      coiUploadedAt: new Date().toISOString(),
      coiVerificationStatus: 'pending_review',
      ...(coiAssetId ? { coiAssetId } : {}),
    } });
    auditPublicSubmission(req, { organizationId: v.organization_id, action: 'vendor.coi.upload', targetType: 'vendor', targetId: id, details: { fileName: parsed.data.fileName, mimeType: parsed.data.mimeType } });
    return reply.code(201).send({ ok: true, url, vendor: updated ? publicVendorPortalView(updated) : null });
  });

  app.get('/api/portal/vendors/:id/coi', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const vendor = vendorsRepo.findById(id);
    if (!vendor) throw NotFound();
    assertValidVendorPortalToken(id, portalTokenFrom(req));
    const meta = parseVendorMetadata(vendor.metadata);
    const url = typeof meta.coiLink === 'string' ? meta.coiLink : '';
    if (!url) throw NotFound('coi-not-found');
    const path = privateFilePath(url);
    if (!path) return reply.redirect(url);
    if (!existsSync(path)) throw NotFound('coi-file-not-found');
    reply.header('Content-Type', typeof meta.coiMimeType === 'string' ? meta.coiMimeType : 'application/octet-stream');
    reply.header('Content-Disposition', 'inline; filename="certificate-of-insurance"');
    return reply.send(createReadStream(path));
  });

  app.get('/api/portal/vendors/:id/messages', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    assertValidVendorPortalToken(id, portalTokenFrom(req));
    if (!v.event_id) return { messages: [] };

    const { messagesRepo } = await import('../db/repos/index.js');
    const threadId = `${v.event_id}:vendor-${v.id}`;
    return {
      messages: messagesRepo.listForThread(threadId)
    };
  });

  app.post('/api/portal/vendors/:id/messages', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: v.organization_id, action: 'vendor.message.blocked', targetType: 'vendor', targetId: id });
    assertValidVendorPortalToken(id, portalTokenFrom(req));
    if (!v.event_id) throw BadRequest('Vendor is not linked to any event.');

    const parsed = z.object({
      body: z.string().min(1).max(10000),
      token: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    const { messagesRepo } = await import('../db/repos/index.js');
    const threadId = `${v.event_id}:vendor-${v.id}`;
    const message = messagesRepo.send({
      threadId,
      senderId: v.id,
      senderRole: 'vendor',
      body: parsed.data.body
    });
    auditPublicSubmission(req, {
      organizationId: v.organization_id,
      action: 'vendor.message.send',
      targetType: 'vendor',
      targetId: id,
      details: { threadId },
    });

    return reply.code(201).send({ message });
  });
}
