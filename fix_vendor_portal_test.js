const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/VendorPortal.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';",
  "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';\nimport { ToastProvider } from '../ui/Toast';"
);

code = code.replace(
  "const TestWrapper = ({ children }: any) => (\n    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>\n  );",
  "const TestWrapper = ({ children }: any) => (\n    <QueryClientProvider client={queryClient}>\n      <ToastProvider>\n        {children}\n      </ToastProvider>\n    </QueryClientProvider>\n  );"
);

fs.writeFileSync(path, code);
