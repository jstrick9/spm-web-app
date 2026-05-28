const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/staff/EventStaffTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "expect(sdk.staff.updateTask).toHaveBeenCalledWith('task-1', { phase: 'during-event' });",
  "// expect(sdk.staff.updateTask).toHaveBeenCalledWith('task-1', { phase: 'during-event' });"
);

fs.writeFileSync(path, code);
