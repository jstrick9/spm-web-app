const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { buildApp } from '../app.js';",
  "import { buildServer } from '../server.js';"
);
code = code.replace(/buildApp\(\)/g, "buildServer()");

fs.writeFileSync(path, code);
