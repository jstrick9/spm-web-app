const fs = require('fs');
const testPath = 'spm-web-app/wedding-app/client/src/screens/events/guests/ImportGuestsDialog.test.tsx';
let code = fs.readFileSync(testPath, 'utf8');

const replacement = `
  function createCsvFile(content: string, name = 'test.csv') {
    const f = new File([content], name, { type: 'text/csv' });
    f.text = () => Promise.resolve(content);
    return f;
  }
`;

code = code.replace(
  /function createCsvFile\(content: string, name = 'test.csv'\) \{\n    return new File\(\[content\], name, \{ type: 'text\/csv' \}\);\n  \}/g,
  replacement
);

fs.writeFileSync(testPath, code);
