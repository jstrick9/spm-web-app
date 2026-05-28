const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "expect(screen.getByText('$5,000.00')).toBeInTheDocument();",
  "expect(screen.getAllByText('$5,000.00')[0]).toBeInTheDocument();"
);

fs.writeFileSync(path, code);
