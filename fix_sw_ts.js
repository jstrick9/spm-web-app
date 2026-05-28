const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sw.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "declare let self: ServiceWorkerGlobalScope;",
  "// @ts-nocheck\ndeclare let self: any;"
);

fs.writeFileSync(path, code);
