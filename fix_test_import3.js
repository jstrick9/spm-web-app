const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { buildServer } from '../index.js';",
  "import { buildApp } from '../index.js';"
);
code = code.replace(/buildServer\(\)/g, "buildApp()");

fs.writeFileSync(path, code);
