const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/system/AnalyticsDashboard.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';",
  "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';\nimport { ConfigProvider } from '../../config/ConfigProvider';"
);

code = code.replace(
  "<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>",
  "<QueryClientProvider client={queryClient}>\n      <ConfigProvider>\n        {children}\n      </ConfigProvider>\n    </QueryClientProvider>"
);

fs.writeFileSync(path, code);
