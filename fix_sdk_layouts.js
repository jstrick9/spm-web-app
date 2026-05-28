const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/layouts.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "opts: { changeDescription?: string; expectedRevision?: number } = {}",
  "opts: { changeDescription?: string; expectedRevision?: number; approvalStatus?: string } = {}"
);

fs.writeFileSync(path, code);
