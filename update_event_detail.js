const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "<CanvasPage eventId={eventId} />",
  "<CanvasPage event={event} />"
);

fs.writeFileSync(path, code);
