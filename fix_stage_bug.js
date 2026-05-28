const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// I can see the issue: There are two <Stage elements maybe, or two onDragMoves.
// Let's inspect line 220-235
