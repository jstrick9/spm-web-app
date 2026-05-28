const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/sdk/index.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { questionsSdk } from './questions.js';",
  "import { questionsSdk } from './questions.js';\nimport { feedbackSdk } from './feedback.js';"
);

code = code.replace(
  "questions: questionsSdk,",
  "questions: questionsSdk,\n  feedback: feedbackSdk,"
);

code = code.replace(
  "questionsSdk,",
  "questionsSdk, feedbackSdk,"
);

fs.writeFileSync(path, code);
