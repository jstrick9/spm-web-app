const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { buildServer } from '../server.js';",
  "import { buildServer } from '../index.js';"
);

fs.writeFileSync(path, code);
