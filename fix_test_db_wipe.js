const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

const replacement = `
  beforeEach(async () => {
    // Ensure DB tables exist! 
    const dbPath = require('path').join(__dirname, '../../../data/wedding.db');
    if (require('fs').existsSync(dbPath)) require('fs').unlinkSync(dbPath);
    
    applyAllMigrations();
    seedSystemRoles();
`;

code = code.replace(/beforeEach\(async \(\) => \{\n    applyAllMigrations\(\);\n    seedSystemRoles\(\);/, replacement);

fs.writeFileSync(path, code);
