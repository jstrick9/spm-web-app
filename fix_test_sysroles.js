const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

const setup = `
import { applyAllMigrations } from '../db/migrate.js';
import { seedSystemRoles } from '../db/seed.js';

describe('Staff RBAC Integration', () => {
  let app: FastifyInstance;
  let orgId: string;
  let adminToken: string;
  let staffToken: string;
  let staffId: string;

  beforeEach(async () => {
    applyAllMigrations();
    seedSystemRoles();
`;

code = code.replace(/import \{ applyAllMigrations \} from '\.\.\/db\/migrate\.js';\n\ndescribe\('Staff RBAC Integration', \(\) => \{\n  let app: FastifyInstance;\n  let orgId: string;\n  let adminToken: string;\n  let staffToken: string;\n  let staffId: string;\n\n  beforeEach\(async \(\) => \{\n    applyAllMigrations\(\);/, setup);

fs.writeFileSync(path, code);
