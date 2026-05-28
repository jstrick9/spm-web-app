const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/db/repos/layouts.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "saveRevision(input: {\n    layoutId: string;\n    payload: Record<string, unknown>;\n    updatedBy: string;\n    changeDescription?: string;\n    expectedRevision?: number;\n  }): LayoutRow {",
  "saveRevision(input: {\n    layoutId: string;\n    payload: Record<string, unknown>;\n    updatedBy: string;\n    changeDescription?: string;\n    expectedRevision?: number;\n    approvalStatus?: string;\n  }): LayoutRow {"
);

fs.writeFileSync(path, code);
