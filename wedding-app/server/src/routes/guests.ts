import type { FastifyInstance } from 'fastify';
import { guestCoreRoutes } from './guests/core.js';
import { guestPortalRoutes } from './guests/portal.js';

/**
 * Guest routes — decomposed into venue/couple-side guest operations (core)
 * and the public tokenized guest portal (portal), sharing helpers in
 * ./guests/shared.ts. Route paths are disjoint, so registration order does
 * not matter.
 */
export async function guestRoutes(app: FastifyInstance) {
  await guestCoreRoutes(app);
  await guestPortalRoutes(app);
}
