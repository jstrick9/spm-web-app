const fs = require('fs');
const path2 = 'spm-web-app/wedding-app/client/src/screens/events/vendors/VendorTimelineChart.tsx';
let code2 = fs.readFileSync(path2, 'utf8');

const regex = /title=\{\`\\\$\{span\.title\} \(\\\$\{format\(parseISO\(span\.starts_at\), 'h:mm a'\)\}\)\`\}/g;
code2 = code2.replace(regex, "title={`${span.title} (${format(parseISO(span.starts_at), 'h:mm a')})`}");

// I will just replace the exact line 167 manually by scanning the file and splicing
const lines = code2.split('\n');
lines[166] = "                               title={`${span.title} (${format(parseISO(span.starts_at), 'h:mm a')})`}";
code2 = lines.join('\n');

fs.writeFileSync(path2, code2);
