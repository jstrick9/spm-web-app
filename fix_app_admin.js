const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { ControlPanel } from './components/ControlPanel';",
  "import { ControlPanel } from './components/ControlPanel';\nimport { AdminPanel } from './screens/system/admin/AdminPanel';"
);

code = code.replace(
  "if (path === '/system') {\n    return (\n      <>\n        <PageHeader title=\"System\" description=\"Diagnostics, sync, and feature flags for the dual-write layer.\" />\n        <PageBody>\n          <Card><CardContent className=\"pt-6\"><ControlPanel /></CardContent></Card>\n        </PageBody>\n      </>\n    );\n  }",
  "if (path === '/system') {\n    if (!orgId) return <Loading />;\n    return <AdminPanel orgId={orgId} />;\n  }"
);

fs.writeFileSync(path, code);
