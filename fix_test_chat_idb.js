const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/chat/ChatSystem.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const idbMock = `
// Mock IndexedDB
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
`;

code = code.replace("import { describe, it, expect, vi, beforeEach } from 'vitest';", idbMock);

fs.writeFileSync(path, code);
