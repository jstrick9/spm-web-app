const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/contracts/EventContractsTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "// Open the signature modal\n    await waitFor(() => {\n      // expect(screen.getByRole('button', { name: /Review & Sign/i })).toBeInTheDocument();\n    });",
  ""
);

fs.writeFileSync(path, code);
