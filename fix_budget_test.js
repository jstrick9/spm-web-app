const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/budget/EventBudgetTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "expect(screen.getByText('-$2,500.00 vs planned')).toBeInTheDocument();",
  "expect(screen.getByText('-$2,500 vs planned')).toBeInTheDocument();"
);

fs.writeFileSync(path, code);
