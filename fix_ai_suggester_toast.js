const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "toast({ title: 'Layout Generated', description: `Packed ${tablesNeeded} tables for ${guestCount} guests.`, variant: 'success' });",
  ""
);

fs.writeFileSync(path, code);
