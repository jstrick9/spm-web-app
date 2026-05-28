const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/db/repos/layouts.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "expectedRevision?: number;  // optimistic concurrency\n  }): LayoutRow {",
  "expectedRevision?: number;  // optimistic concurrency\n    approvalStatus?: string;\n  }): LayoutRow {"
);

fs.writeFileSync(path, code);
