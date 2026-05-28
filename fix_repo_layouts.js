const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/db/repos/layouts.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "visibility: 'private' | 'event' | 'venue' | 'public';",
  "visibility: 'private' | 'event' | 'venue' | 'public';\n  approval_status: 'draft' | 'pending' | 'approved' | 'rejected';"
);

code = code.replace(
  "visibility?: LayoutRow['visibility'];",
  "visibility?: LayoutRow['visibility'];\n  approvalStatus?: LayoutRow['approval_status'];"
);

code = code.replace(
  "(id, organization_id, event_id, venue_id, name, visibility, is_template, payload, created_by, updated_by)",
  "(id, organization_id, event_id, venue_id, name, visibility, approval_status, is_template, payload, created_by, updated_by)"
);

code = code.replace(
  "input.visibility ?? 'event',",
  "input.visibility ?? 'event',\n      input.approvalStatus ?? 'draft',"
);

code = code.replace(
  "const saved = this.update(input.layoutId, { payload: input.payload, updatedBy: input.updatedBy, revision: newRev });",
  "const saved = this.update(input.layoutId, { payload: input.payload, updatedBy: input.updatedBy, revision: newRev, approvalStatus: (input as any).approvalStatus });"
);

code = code.replace(
  "update(id: string, patch: Partial<LayoutInput & { revision: number; updatedBy: string }>): LayoutRow | undefined {",
  "update(id: string, patch: Partial<LayoutInput & { revision: number; updatedBy: string }>): LayoutRow | undefined {"
);

code = code.replace(
  "if (patch.visibility !== undefined) { fields.push('visibility = ?'); values.push(patch.visibility); }",
  "if (patch.visibility !== undefined) { fields.push('visibility = ?'); values.push(patch.visibility); }\n    if (patch.approvalStatus !== undefined) { fields.push('approval_status = ?'); values.push(patch.approvalStatus); }"
);

fs.writeFileSync(path, code);
