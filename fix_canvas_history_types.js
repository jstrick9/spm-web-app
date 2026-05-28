const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const versions = versionsData?.versions || [];",
  "const versions = (versionsData as any)?.versions || [];"
);

code = code.replace(
  "import { Button } from '../../../ui/Button';",
  "import { Button } from '../../../ui/Button';\nimport { Badge } from '../../../ui/Badge';"
);

code = code.replace(
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight } from 'lucide-react';",
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X } from 'lucide-react';"
);

fs.writeFileSync(path, code);
