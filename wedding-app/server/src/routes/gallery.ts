import type { FastifyInstance } from 'fastify';
import { saveDataUri, deleteFile } from "../lib/fileStorage.js";
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { galleryRepo } from '../db/repos/gallery.js';
import { eventsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const imageSchema = z.object({
  filename: z.string().min(1).max(255),
  url: z.string().min(1).max(500000), // data URIs can be large
  category: z.enum(['florals','linens','lighting','vibe','ceremony','reception','other']).optional(),
  caption: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
});

export async function galleryRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/gallery', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'gallery.view', orgMap)) throw Forbidden();
    return {
      images: galleryRepo.listForEvent(eventId),
      counts: galleryRepo.countByCategory(eventId),
    };
  });

  app.post('/api/events/:eventId/gallery', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'gallery.manage', orgMap)) throw Forbidden();
    const parsed = imageSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // Save data URI to disk instead of storing in SQLite
    const savedUrl = saveDataUri(parsed.data.url, 'gallery');
    const image = galleryRepo.create({
      organizationId: event.organization_id, eventId,
      ...parsed.data, url: savedUrl, uploadedBy: req.auth!.userId,
    });
    return reply.code(201).send({ image });
  });

  app.patch('/api/gallery/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const image = galleryRepo.findById(id);
    if (!image) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: image.organization_id }, 'gallery.manage')) throw Forbidden();
    const parsed = z.object({
      category: z.string().optional(),
      caption: z.string().max(500).optional(),
      sortOrder: z.number().int().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { image: galleryRepo.update(id, parsed.data) };
  });

  app.delete('/api/gallery/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const image = galleryRepo.findById(id);
    if (!image) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: image.organization_id }, 'gallery.manage')) throw Forbidden();
    // Clean up the file from disk if it was a local upload
    deleteFile(image.url);
    galleryRepo.delete(id);
    return reply.code(204).send();
  });
}
