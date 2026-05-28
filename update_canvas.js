const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "interface Props {\n  eventId: string;\n}",
  "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { layoutsSdk } from '../../../sdk/layouts';\nimport type { SdkEvent, SdkLayout } from '../../../sdk/types';\nimport { Loader2 } from 'lucide-react';\n\ninterface Props {\n  event: SdkEvent;\n}"
);

code = code.replace(
  "export function CanvasPage({ eventId }: Props) {",
  "export function CanvasPage({ event }: Props) {"
);

fs.writeFileSync(path, code);
