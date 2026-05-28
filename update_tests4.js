const fs = require('fs');
const testPath = 'spm-web-app/wedding-app/client/src/screens/events/guests/ImportGuestsDialog.test.tsx';
let code = fs.readFileSync(testPath, 'utf8');

code = code.replace(/screen\.getByTestId\('map-select-0'\)/g, "screen.getAllByRole('combobox')[0]");
code = code.replace(/screen\.getByTestId\('map-select-1'\)/g, "screen.getAllByRole('combobox')[1]");
code = code.replace(/screen\.getByTestId\('map-select-2'\)/g, "screen.getAllByRole('combobox')[2]");

fs.writeFileSync(testPath, code);
