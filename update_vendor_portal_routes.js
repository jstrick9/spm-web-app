const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/vendors.ts';
let code = fs.readFileSync(path, 'utf8');

const updateRoute = `
  app.post('/api/portal/vendors/:id/questionnaire', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { vendorsRepo } = await import('../db/repos/index.js');
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();

    const parsed = z.record(z.unknown()).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(v.metadata);
    } catch { }

    meta.questionnaire = {
      ...(meta.questionnaire as Record<string, unknown> || {}),
      ...parsed.data,
      submittedAt: new Date().toISOString()
    };

    const updated = vendorsRepo.update(id, { metadata: meta });
    return { ok: true, vendor: updated };
  });
}
`;

code = code.replace(/}\s*$/, updateRoute);
fs.writeFileSync(path, code);
