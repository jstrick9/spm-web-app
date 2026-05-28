const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/contracts/EventContractsTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "// fireEvent.click(screen.getAllByRole('button', { name: /Review & Sign/i })[0]);",
  ""
);

code = code.replace(
  "// expect(screen.getByText(/Review & Sign: DJ Agreement/i)).toBeInTheDocument();",
  ""
);

code = code.replace(
  "// const checkbox = screen.getByRole('checkbox');",
  ""
);

code = code.replace(
  "// const sigInput = screen.getByLabelText(/Type Full Legal Name/i);",
  ""
);

fs.writeFileSync(path, code);
