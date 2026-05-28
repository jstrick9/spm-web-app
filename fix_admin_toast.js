const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/system/admin/AdminPanel.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "toast({ title: 'Import restricted', description: 'Contact system administrator to restore from snapshot.', variant: 'warning' });",
  "toast({ title: 'Import restricted', description: 'Contact system administrator to restore from snapshot.', variant: 'destructive' });"
);

fs.writeFileSync(path, code);
