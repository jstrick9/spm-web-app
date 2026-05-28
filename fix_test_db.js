const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

const setup = `
import { applyAllMigrations } from '../db/migrate.js';

describe('Staff RBAC Integration', () => {
  let app: FastifyInstance;
  
  beforeEach(async () => {
    applyAllMigrations();
`;

code = code.replace(/describe\('Staff RBAC Integration', \(\) => \{\s*let app: FastifyInstance;/, setup);

fs.writeFileSync(path, code);
