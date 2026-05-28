const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/staff/EventStaffTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "task.priority === 'critical' ? 'destructive' :",
  "task.priority === 'critical' ? 'danger' :"
);

fs.writeFileSync(path, code);
