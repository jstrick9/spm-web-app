const fs = require('fs');

const path2 = 'spm-web-app/wedding-app/client/src/screens/events/vendors/VendorTimelineChart.tsx';
let code2 = fs.readFileSync(path2, 'utf8');

code2 = code2.replace(/style=\{\{ left: \\`\\\$\{\(i \/ \(END_HOUR - START_HOUR\)\) \* 100\}%\\` \}\}/g, "style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }}");
code2 = code2.replace(/\{START_HOUR \+ i > 12 \? \\`\\\$\{START_HOUR \+ i - 12\}pm\\` : START_HOUR \+ i === 12 \? '12pm' : \\`\\\$\{START_HOUR \+ i\}am\\`\}/g, "{START_HOUR + i > 12 ? `${START_HOUR + i - 12}pm` : START_HOUR + i === 12 ? '12pm' : `${START_HOUR + i}am`}");
code2 = code2.replace(/msg: \\`\\\$\{a\.vendorName\} and \\\$\{b\.vendorName\} are scheduled to arrive\/prep simultaneously at \\\$\{format\(parseISO\(a\.starts_at\), 'h:mm a'\)\}\\`/g, "msg: `${a.vendorName} and ${b.vendorName} are scheduled to arrive/prep simultaneously at ${format(parseISO(a.starts_at), 'h:mm a')}`");
code2 = code2.replace(/className=\{\\`absolute top-2 h-6 rounded-sm shadow-sm flex items-center px-2 overflow-hidden text-\[9px\] font-medium text-white transition-transform hover:scale-y-110 cursor-pointer \\\$\{isConflict \? 'bg-danger border border-danger\/50' : 'bg-brand'}\\`\}/g, "className={`absolute top-2 h-6 rounded-sm shadow-sm flex items-center px-2 overflow-hidden text-[9px] font-medium text-white transition-transform hover:scale-y-110 cursor-pointer ${isConflict ? 'bg-danger border border-danger/50' : 'bg-brand'}`}");
code2 = code2.replace(/style=\{\{ left: \\`\\\$\{span\.leftPct\}%\\`, width: \\`\\\$\{span\.widthPct\}%\\` \}\}/g, "style={{ left: `${span.leftPct}%`, width: `${span.widthPct}%` }}");
code2 = code2.replace(/title=\{\`\\\$\{span\.title\} \(\\\$\{format\(parseISO\(span\.starts_at\), 'h:mm a'\)\}\)\`\}/g, "title={`${span.title} (${format(parseISO(span.starts_at), 'h:mm a')})`}");

fs.writeFileSync(path2, code2);
