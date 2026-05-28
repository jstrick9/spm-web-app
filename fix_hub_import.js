const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/hub/VendorCommunicationsHub.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { MessageSquareQuote, Send, Search, Bell, Megaphone, FileText, CheckCircle2, ChevronRight } from 'lucide-react';",
  "import { MessageSquareQuote, Send, Search, Bell, Megaphone, FileText, CheckCircle2, ChevronRight, Clock } from 'lucide-react';"
);

fs.writeFileSync(path, code);
