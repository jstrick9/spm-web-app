import { assetsRepo, auditRepo, coupleDocumentsRepo, eventsRepo } from '../../db/repos/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { saveDocumentDataUri, privateFilePath, deleteFile } from '../../lib/fileStorage.js';
import { createReadStream } from 'node:fs';
import { existsSync } from 'node:fs';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import type { FastifyInstance } from 'fastify';
import { canWriteCoupleData, coupleDocumentUpdateSchema, coupleDocumentUploadSchema, extractDocumentSummary, safeDocument } from './shared.js';
import { broadcastSSE } from '../sse.js';

/**
 * Document visibility per requester (the visibility field exists so docs
 * can be shared selectively — enforce it server-side):
 *   - couple-role members of the event see everything;
 *   - venue staff (events.view) see couple_venue / planner / vendor /
 *     guest_visible — NEVER 'couple'-private documents.
 */
function visibleDocumentsFor<T extends { visibility: string }>(
  documents: T[],
  memberships: Array<{ eventId?: string; roleKey?: string }>,
  eventId: string,
): T[] {
  const isCoupleMember = memberships.some((m) => m.eventId === eventId && String(m.roleKey).toLowerCase() === 'couple');
  if (isCoupleMember) return documents;
  return documents.filter((d) => d.visibility !== 'couple');
}

export async function coupleDocumentsRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/couple-documents/:documentId/content', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const document = coupleDocumentsRepo.findById(documentId);
    if (!document || document.event_id !== eventId) throw NotFound('document-not-found');
    // Visibility enforcement: venue staff must not read couple-private docs.
    const isCoupleMember = req.auth!.memberships.some((m) => m.eventId === eventId && String(m.roleKey).toLowerCase() === 'couple');
    if (!isCoupleMember && document.visibility === 'couple') throw NotFound('document-not-found');
    const path = privateFilePath(document.url);
    if (!path) return reply.redirect(document.url);
    if (!existsSync(path)) throw NotFound('document-file-not-found');
    reply.header('Content-Type', document.mime_type || 'application/octet-stream');
    reply.header('Content-Disposition', `inline; filename="${document.filename.replace(/[\"\\\\\r\n]/g, '_')}"`);
    return reply.send(createReadStream(path));
  });

  app.get('/api/events/:eventId/couple-documents', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const all = coupleDocumentsRepo.listForEvent(eventId);
    const documents = visibleDocumentsFor(all, req.auth!.memberships, eventId).map(safeDocument);
    const counts = documents.reduce((acc: Record<string, number>, doc) => { acc[doc.category] = (acc[doc.category] || 0) + 1; return acc; }, {});
    return {
      documents,
      counts,
      reviewQueue: documents.filter((doc) => ['pending', 'changes_requested'].includes(doc.approvalStatus)),
      postEventGallery: documents.filter((doc) => doc.category === 'post_event_gallery' && doc.approvalStatus === 'approved'),
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      maxBytes: 8 * 1024 * 1024,
      categories: ['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other'],
      visibilityOptions: ['couple','couple_venue','planner','vendor','guest_visible'],
    };
  });

  app.post('/api/events/:eventId/couple-documents', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleDocumentUploadSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const savedUrl = saveDocumentDataUri(parsed.data.dataUri, 'couple_doc');
    const extractedSummary = extractDocumentSummary({ filename: parsed.data.filename, category: parsed.data.category, notes: parsed.data.notes });
    const doc = coupleDocumentsRepo.create({ organizationId: event.organization_id, eventId, filename: parsed.data.filename, url: savedUrl, mimeType: parsed.data.mimeType, category: parsed.data.category, visibility: parsed.data.visibility, notes: parsed.data.notes, extractedSummary, uploadedBy: req.auth!.userId });
    if (privateFilePath(savedUrl)) assetsRepo.create({ organization_id: event.organization_id, event_id: eventId, owner_type: 'couple_document', owner_id: doc.id, storage_key: savedUrl, original_filename: doc.filename, mime_type: doc.mime_type, visibility: 'private', publish_status: 'draft', created_by: req.auth!.userId });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.document.upload', targetType: 'couple_document', targetId: doc.id, ip: req.ip, details: { eventId, category: doc.category, visibility: doc.visibility } });
    broadcastSSE(event.organization_id, 'couple.document_uploaded', { eventId, documentId: doc.id, filename: doc.filename }, req.auth!.userId);
    return reply.code(201).send({ document: safeDocument(doc) });
  });

  app.patch('/api/events/:eventId/couple-documents/:documentId', { preHandler: requireAuth }, async (req) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const current = coupleDocumentsRepo.findById(documentId);
    if (!current || current.event_id !== eventId) throw NotFound('document-not-found');
    const parsed = coupleDocumentUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = coupleDocumentsRepo.update(documentId, parsed.data, req.auth!.userId);
    return { document: updated ? safeDocument(updated) : null };
  });

  app.post('/api/events/:eventId/couple-documents/:documentId/version', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const current = coupleDocumentsRepo.findById(documentId);
    if (!current || current.event_id !== eventId) throw NotFound('document-not-found');
    const parsed = coupleDocumentUploadSchema.pick({ filename: true, dataUri: true, mimeType: true, notes: true }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const savedUrl = saveDocumentDataUri(parsed.data.dataUri, 'couple_doc');
    // MODULE-07 CP-05: the superseded file must not be orphaned on disk.
    if (privateFilePath(current.url)) deleteFile(current.url);
    const extractedSummary = extractDocumentSummary({ filename: parsed.data.filename, category: current.category, notes: parsed.data.notes });
    const updated = coupleDocumentsRepo.newVersion(documentId, { filename: parsed.data.filename, url: savedUrl, mimeType: parsed.data.mimeType, notes: parsed.data.notes, actor: req.auth!.userId, extractedSummary });
    return reply.code(201).send({ document: updated ? safeDocument(updated) : null });
  });

  app.delete('/api/events/:eventId/couple-documents/:documentId', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const removed = coupleDocumentsRepo.delete(documentId);
    if (!removed) throw NotFound('document-not-found');
    if (privateFilePath(removed.url)) deleteFile(removed.url);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.document.delete', targetType: 'couple_document', targetId: documentId, ip: req.ip, details: { eventId, filename: removed.filename } });
    broadcastSSE(event.organization_id, 'couple.document_deleted', { eventId, documentId }, req.auth!.userId);
    return reply.code(204).send();
  });

  app.get('/api/events/:eventId/couple-documents/final-packet.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const docs = coupleDocumentsRepo.listForEvent(eventId).map(safeDocument);
    const text = [`${event.title} — Shared Final Wedding Document Packet`, '', ...docs.map((doc) => [`${doc.filename} v${doc.version}`, `Category: ${doc.category}`, `Visibility: ${doc.visibility}`, `Approval: ${doc.approvalStatus}`, `URL: ${doc.url}`, doc.extractedSummary ? `Review summary: ${doc.extractedSummary}` : ''].filter(Boolean).join('\n'))].join('\n\n---\n\n');
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename="couple_final_document_packet_${eventId}.txt"`);
    return reply.send(text);
  });

}
