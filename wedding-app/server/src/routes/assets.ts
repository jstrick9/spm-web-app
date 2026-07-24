import type { FastifyInstance } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { assetsRepo } from '../db/repos/index.js';
import { privateFilePath } from '../lib/fileStorage.js';
import { Forbidden, NotFound, Unauthorized } from '../lib/errors.js';

function sendAsset(asset: ReturnType<typeof assetsRepo.findById> & {}, reply: any) {
  const path = privateFilePath(asset.storage_key);
  if (!path) return reply.redirect(asset.storage_key);
  if (!existsSync(path)) throw NotFound('asset-file-not-found');
  reply.header('Content-Type', asset.mime_type || 'application/octet-stream');
  reply.header('Content-Disposition', `inline; filename="${asset.original_filename.replace(/[\"\\\r\n]/g, '_')}"`);
  return reply.send(createReadStream(path));
}
export async function assetRoutes(app: FastifyInstance) {
  app.get('/api/assets/:id/content', { preHandler: requireAuth }, async (req, reply) => {
    const asset = assetsRepo.findById((req.params as { id:string }).id);
    if (!asset) throw NotFound('asset-not-found');
    if (!can(req.auth!.memberships, { organizationId: asset.organization_id }, 'org.view')) throw Forbidden();
    return sendAsset(asset, reply);
  });
  app.get('/api/public/assets/:id/content', async (req, reply) => {
    const { id } = req.params as { id:string };
    const token = (req.query as { token?:string }).token;
    const asset = assetsRepo.findById(id);
    if (!asset) throw NotFound('asset-not-found');
    if (asset.visibility === 'public' && asset.publish_status === 'approved') return sendAsset(asset, reply);
    if (!token || !assetsRepo.verifyCapability(id, token)) throw Unauthorized('asset-capability-invalid-or-expired');
    return sendAsset(asset, reply);
  });
}
