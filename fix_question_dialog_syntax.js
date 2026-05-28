const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/system/questions/QuestionFormDialog.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "placeholder={\\`Option \\${idx + 1}\\`}",
  "placeholder={`Option ${idx + 1}`}"
);

fs.writeFileSync(path, code);
