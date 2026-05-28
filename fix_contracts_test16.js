const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/contracts/EventContractsTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { describe, it, expect, vi, beforeEach } from 'vitest';",
  "import { describe, it, expect, vi, beforeEach } from 'vitest';\nimport { act } from 'react';"
);

code = code.replace(
  "// Open the signature modal\n    await waitFor(() => {",
  ""
);

code = code.replace(
  "// expect(screen.getByRole('button', { name: /Review & Sign/i })).toBeInTheDocument();\n    });",
  ""
);

fs.writeFileSync(path, code);
