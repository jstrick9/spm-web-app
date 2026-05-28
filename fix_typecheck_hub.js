const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/hub/VendorCommunicationsHub.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const sendBtn = screen.getAllByRole('button').find(b => b.type === 'submit');",
  "const sendBtn = screen.getAllByRole('button').find(b => (b as HTMLButtonElement).type === 'submit');"
);

fs.writeFileSync(path, code);
