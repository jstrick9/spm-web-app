const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/db/repos/questions.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "answer_type: 'dropdown' | 'integer' | 'text';",
  "answer_type: 'dropdown' | 'integer' | 'text' | 'date' | 'boolean' | 'multiselect';"
);

fs.writeFileSync(path, code);
