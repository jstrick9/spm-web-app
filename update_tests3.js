const fs = require('fs');
const testPath = 'spm-web-app/wedding-app/client/src/screens/events/guests/ImportGuestsDialog.test.tsx';
let code = fs.readFileSync(testPath, 'utf8');

const setup = `
if (typeof File !== 'undefined' && !File.prototype.text) {
  File.prototype.text = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(this);
    });
  };
}

describe('ImportGuestsDialog', () => {
`;

code = code.replace(/describe\('ImportGuestsDialog', \(\) => \{/g, setup);
code = code.replace(/fireEvent\.change\(input, \{ target: \{ files: \[file\] \} \}\);/g, "await userEvent.upload(input, file);");
code = code.replace(/const f = new File\(\[content\], name, \{ type: 'text\/csv' \}\);\n    f\.text = \(\) => Promise\.resolve\(content\);\n    return f;/g, "return new File([content], name, { type: 'text/csv' });");

fs.writeFileSync(testPath, code);
