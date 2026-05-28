const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { DollarSign, Printer, FileSignature, ImageIcon } from 'lucide-react';",
  "import { DollarSign, Printer, FileSignature, ImageIcon, ScanLine } from 'lucide-react';"
);

code = code.replace(
  "<a href={`#/events/${eventId}/run-sheet`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"outline\">\n              <Printer className=\"h-3.5 w-3.5 mr-1\" />\n              Print Run Sheet\n            </Button>\n          </a>\n          </>",
  "<a href={`#/events/${eventId}/run-sheet`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"outline\">\n              <Printer className=\"h-3.5 w-3.5 mr-1\" />\n              Print Run Sheet\n            </Button>\n          </a>\n          <a href={`#/events/${eventId}/check-in`} target=\"_blank\" rel=\"noreferrer\">\n            <Button variant=\"brand\">\n              <ScanLine className=\"h-3.5 w-3.5 mr-1\" />\n              Vendor Check-In\n            </Button>\n          </a>\n          </>"
);

fs.writeFileSync(path, code);
