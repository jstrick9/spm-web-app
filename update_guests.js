const fs = require('fs');

const guestsRepoPath = 'spm-web-app/wedding-app/server/src/db/repos/guests.ts';
let repoCode = fs.readFileSync(guestsRepoPath, 'utf8');

// Add bulkCreate to guestsRepo
const bulkCreateFn = `
  bulkCreate(orgId: string, eventId: string, mode: 'skip' | 'replace' | 'append', inputs: GuestInput[]) {
    return db.transaction(() => {
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const existing = this.listForEvent(eventId);
      const byEmail = new Map<string, GuestRow>();
      for (const g of existing) {
        if (g.email) {
          byEmail.set(g.email.toLowerCase(), g);
        }
      }

      for (const input of inputs) {
        const emailKey = input.email ? input.email.toLowerCase() : null;
        let match = emailKey ? byEmail.get(emailKey) : undefined;
        
        if (match && mode === 'skip') {
          skipped++;
          continue;
        }
        
        if (match && mode === 'replace') {
          this.update(match.id, input);
          updated++;
          continue;
        }
        
        // append or no match
        this.create(orgId, eventId, input);
        inserted++;
      }
      return { inserted, updated, skipped };
    })();
  },
`;

repoCode = repoCode.replace('create(orgId: string, eventId: string, input: GuestInput): GuestRow {', bulkCreateFn + '\n  create(orgId: string, eventId: string, input: GuestInput): GuestRow {');
fs.writeFileSync(guestsRepoPath, repoCode);

const routesPath = 'spm-web-app/wedding-app/server/src/routes/guests.ts';
let routesCode = fs.readFileSync(routesPath, 'utf8');

const bulkRoute = `
  app.post('/api/events/:eventId/guests/bulk', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
    
    const bulkSchema = z.object({
      mode: z.enum(['skip', 'replace', 'append']),
      guests: z.array(guestSchema),
    });
    
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    
    const result = guestsRepo.bulkCreate(event.organization_id, eventId, parsed.data.mode, parsed.data.guests);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.bulk_create',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    return reply.code(201).send(result);
  });
`;

routesCode = routesCode.replace("app.post('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req, reply) => {", bulkRoute + "\n  app.post('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req, reply) => {");

fs.writeFileSync(routesPath, routesCode);
