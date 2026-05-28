const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/invites/EventInvitesTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "toast({ title: 'No guests', description: 'Add guests to your event first.', variant: 'warning' });",
  "toast({ title: 'No guests', description: 'Add guests to your event first.', variant: 'destructive' });"
);

fs.writeFileSync(path, code);
