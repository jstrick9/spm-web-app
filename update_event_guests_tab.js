const fs = require('fs');

const tabPath = 'spm-web-app/wedding-app/client/src/screens/events/guests/EventGuestsTab.tsx';
let tabCode = fs.readFileSync(tabPath, 'utf8');

tabCode = tabCode.replace(
  "import { GuestFormDialog } from './GuestFormDialog';",
  "import { GuestFormDialog } from './GuestFormDialog';\nimport { ImportGuestsDialog } from './ImportGuestsDialog';"
);

tabCode = tabCode.replace(
  "const [createOpen, setCreateOpen] = useState(false);",
  "const [createOpen, setCreateOpen] = useState(false);\n  const [importOpen, setImportOpen] = useState(false);"
);

tabCode = tabCode.replace(
  "onAddClick={() => setCreateOpen(true)}",
  "onAddClick={() => setCreateOpen(true)}\n        onImportClick={() => setImportOpen(true)}"
);

tabCode = tabCode.replace(
  "<GuestFormDialog",
  "<ImportGuestsDialog\n        eventId={eventId}\n        open={importOpen}\n        onOpenChange={setImportOpen}\n        onImported={() => query.refetch()}\n      />\n\n      <GuestFormDialog"
);

fs.writeFileSync(tabPath, tabCode);
