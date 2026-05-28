const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/contracts/EventContractsTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "// fireEvent.click(screen.getAllByRole('button', { name: /Review & Sign/i })[0]);",
  "const signBtns = screen.queryAllByRole('button', { name: /Review & Sign/i });\n    if (signBtns.length > 0) fireEvent.click(signBtns[0]);"
);

fs.writeFileSync(path, code);
