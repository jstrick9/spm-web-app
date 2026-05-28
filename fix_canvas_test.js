const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  '<CanvasPage eventId="test-event" />',
  '<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event" } as any} />'
);

fs.writeFileSync(path, code);
