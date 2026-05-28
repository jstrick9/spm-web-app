const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/system/AnalyticsDashboard.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "className={\\`flex items-center \\${revGrowth >= 0 ? 'text-success' : 'text-danger'} font-medium\\`}",
  "className={`flex items-center ${revGrowth >= 0 ? 'text-success' : 'text-danger'} font-medium`}"
);

code = code.replace(
  "style={{ width: \\`\\${score}%\\` }}",
  "style={{ width: `${score}%` }}"
);

fs.writeFileSync(path, code);
