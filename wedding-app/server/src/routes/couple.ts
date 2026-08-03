import type { FastifyInstance } from 'fastify';
import { couplePlanningRoutes } from './couple/planning.js';
import { coupleGuestsRoutes } from './couple/guests.js';
import { coupleFinanceRoutes } from './couple/finance.js';
import { couplePortalRoutes } from './couple/portal.js';
import { coupleDocumentsRoutes } from './couple/documents.js';
import { couplePostEventRoutes } from './couple/postEvent.js';

/**
 * Couple workspace routes — decomposed into domain modules under routes/couple/
 * (planning, guests, finance, portal, documents, postEvent) so each file stays
 * reviewable. Route paths are disjoint across modules, so registration order
 * does not matter.
 */
export async function coupleRoutes(app: FastifyInstance) {
  await couplePlanningRoutes(app);
  await coupleGuestsRoutes(app);
  await coupleFinanceRoutes(app);
  await couplePortalRoutes(app);
  await coupleDocumentsRoutes(app);
  await couplePostEventRoutes(app);
}
