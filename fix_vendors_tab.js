const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { DataTable, type ColumnDef } from '../../../ui/DataTable';",
  "import { DataTable, type Column } from '../../../ui/DataTable';"
);

code = code.replace(
  "const columns: ColumnDef<SdkVendor>[] = [",
  "const columns: Column<SdkVendor>[] = ["
);

code = code.replace(
  "keyExtractor={v => v.id}",
  "getRowKey={v => v.id}"
);

code = code.replace(
  /emptyState=\{([\s\S]*?)\}/,
  "emptyMessage={$1}"
);

fs.writeFileSync(path, code);
