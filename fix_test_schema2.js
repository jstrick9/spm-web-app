const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "app = await buildApp();",
  "applyAllMigrations();\n    app = await buildApp();"
);

fs.writeFileSync(path, code);
