const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { render, screen, fireEvent } from '@testing-library/react';",
  "import { render, screen, fireEvent } from '@testing-library/react';\nimport { act } from 'react';"
);

fs.writeFileSync(path, code);
