const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/routes/guests.ts';
let code = fs.readFileSync(path, 'utf8');

const imports = `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, eventsRepo, guestsRepo, rsvpRepo, portalConfigRepo, layoutsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';

const guestSchema = z.object({`;

code = code.replace(/import type \{ FastifyInstance \} from 'fastify';[\s\S]*?const guestSchema = z\.object\(\{/m, imports);

fs.writeFileSync(path, code);
