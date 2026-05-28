const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/gallery/EventGalleryTab.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventGalleryTab } from './EventGalleryTab';",
  "import { EventGalleryTab } from './EventGalleryTab';\nimport { ToastProvider } from '../../../ui/Toast';"
);

code = code.replace(
  "render(<EventGalleryTab eventId=\"test-event\" />);",
  "render(<ToastProvider><EventGalleryTab eventId=\"test-event\" /></ToastProvider>);"
);

code = code.replace(
  "render(<EventGalleryTab eventId=\"test-event\" />);",
  "render(<ToastProvider><EventGalleryTab eventId=\"test-event\" /></ToastProvider>);"
);

fs.writeFileSync(path, code);
