const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { messagesRoutes } from './routes/messages.js';",
  "import { messagesRoutes } from './routes/messages.js';\nimport { feedbackRoutes } from './routes/feedback.js';"
);

code = code.replace(
  "await app.register(messagesRoutes);",
  "await app.register(messagesRoutes);\n  await app.register(feedbackRoutes);"
);

fs.writeFileSync(path, code);
