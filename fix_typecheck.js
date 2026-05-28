const fs = require('fs');

const path1 = 'spm-web-app/wedding-app/client/src/screens/checkin/VendorCheckInApp.tsx';
let code1 = fs.readFileSync(path1, 'utf8');
code1 = code1.replace("status === 'departed' ? 'secondary' : 'success'", "status === 'departed' ? 'info' : 'success'");
fs.writeFileSync(path1, code1);

const path2 = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code2 = fs.readFileSync(path2, 'utf8');
code2 = code2.replace("<Button variant=\"brand\">", "<Button variant=\"default\">");
fs.writeFileSync(path2, code2);
