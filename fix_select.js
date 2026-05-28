const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/guests/ImportGuestsDialog.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /onChange=\{e => \{\s*const val = e\.target\.value;\s*setMapping\(\(prev: any\) => \(\{\s*\.\.\.prev,\s*\[idx\]: val \|\| undefined\s*\}\)\);\s*\}\}/g,
  "onValueChange={(val: string) => {\n                  setMapping((prev: any) => ({\n                    ...prev,\n                    [idx]: val || undefined\n                  }));\n                }}"
);

fs.writeFileSync(path, code);
