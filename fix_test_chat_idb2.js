const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/chat/ChatSystem.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "// expect(await screen.findByText('Hello world!')).toBeInTheDocument();",
  "expect(await screen.findByText('Hello world!')).toBeInTheDocument();"
);

fs.writeFileSync(path, code);
