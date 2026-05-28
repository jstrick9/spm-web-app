const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/routes/questions.ts';
let code = fs.readFileSync(path, 'utf8');

// The original requirements specified 6 answer types: text, number, date, boolean, single-select, multi-select.
// Our schema currently only has 'dropdown', 'integer', 'text'. Let's expand it.
code = code.replace(
  "z.enum(['dropdown','integer','text']).optional()",
  "z.enum(['dropdown','integer','text','date','boolean','multiselect']).optional()"
);

fs.writeFileSync(path, code);
