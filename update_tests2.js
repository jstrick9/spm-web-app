const fs = require('fs');
const testPath = 'spm-web-app/wedding-app/client/src/screens/events/guests/ImportGuestsDialog.test.tsx';
let code = fs.readFileSync(testPath, 'utf8');

code = code.replace(/await userEvent\.upload\(input, file\);/g, "fireEvent.change(input, { target: { files: [file] } });");

fs.writeFileSync(testPath, code);
