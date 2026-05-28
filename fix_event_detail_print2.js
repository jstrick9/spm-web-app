const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "actions={\n          <a href={`#/portal/${eventId}`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"outline\">\n              <ExternalLink className=\"h-3.5 w-3.5\" />\n              View guest portal\n            </Button>\n          </a>\n          <a href={`#/events/${eventId}/run-sheet`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"outline\">\n              <Printer className=\"h-3.5 w-3.5 mr-1\" />\n              Print Run Sheet\n            </Button>\n          </a>\n        }",
  "actions={\n          <>\n          <a href={`#/portal/${eventId}`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"outline\">\n              <ExternalLink className=\"h-3.5 w-3.5\" />\n              View guest portal\n            </Button>\n          </a>\n          <a href={`#/events/${eventId}/run-sheet`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"outline\">\n              <Printer className=\"h-3.5 w-3.5 mr-1\" />\n              Print Run Sheet\n            </Button>\n          </a>\n          </>\n        }"
);

fs.writeFileSync(path, code);
