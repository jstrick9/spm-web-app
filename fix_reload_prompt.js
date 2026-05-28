const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/ReloadPrompt.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { Toast, ToastDescription, ToastTitle, ToastAction } from './ui/Toast';",
  ""
);

fs.writeFileSync(path, code);
