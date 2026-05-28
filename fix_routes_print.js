const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventDetail } from './screens/events/EventDetail';",
  "import { EventDetail } from './screens/events/EventDetail';\nimport { RunSheet } from './screens/events/runsheet/RunSheet';"
);

code = code.replace(
  "const detail = matchPath('/events/:eventId', path);\n  if (detail) return <EventDetail eventId={detail.eventId} user={user} />;",
  "const runsheet = matchPath('/events/:eventId/run-sheet', path);\n  if (runsheet) return <RunSheet eventId={runsheet.eventId} />;\n\n  const detail = matchPath('/events/:eventId', path);\n  if (detail) return <EventDetail eventId={detail.eventId} user={user} />;"
);

fs.writeFileSync(path, code);
