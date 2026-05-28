const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "// Switch to history tab\n    const historyBtn = screen.getByRole('button', { name: /History/i });",
  "// Wait for loading to finish\n    const historyBtn = await screen.findByRole('button', { name: /History/i });"
);

fs.writeFileSync(path, code);
