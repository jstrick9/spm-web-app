const fs = require('fs');
const path2 = 'spm-web-app/wedding-app/client/src/screens/events/vendors/VendorTimelineChart.tsx';
let code2 = fs.readFileSync(path2, 'utf8');

code2 = code2.replace(/title=\{\`\\\$\{span\.title\} \(\\\$\{format\(parseISO\(span\.starts_at\), 'h:mm a'\)\}\)\`\}/g, "title={`${span.title} (${format(parseISO(span.starts_at), 'h:mm a')})`}");

fs.writeFileSync(path2, code2);
