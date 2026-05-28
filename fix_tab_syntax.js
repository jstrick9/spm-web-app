const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "</Card>\n        \n        {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}\n      )}",
  "</Card>\n          {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}\n        </>\n      )}"
);

fs.writeFileSync(path, code);

const path2 = 'spm-web-app/wedding-app/client/src/screens/events/vendors/VendorTimelineChart.tsx';
let code2 = fs.readFileSync(path2, 'utf8');
code2 = code2.replace(
  "title={`\\${span.title} (\\${format(parseISO(span.starts_at), 'h:mm a')})`}",
  "title={`${span.title} (${format(parseISO(span.starts_at), 'h:mm a')})`}"
);
code2 = code2.replace(
  "style={{ left: `\\${(i / (END_HOUR - START_HOUR)) * 100}%` }}",
  "style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }}"
);
code2 = code2.replace(
  "{START_HOUR + i > 12 ? `\\${START_HOUR + i - 12}pm` : START_HOUR + i === 12 ? '12pm' : `\\${START_HOUR + i}am`}",
  "{START_HOUR + i > 12 ? `${START_HOUR + i - 12}pm` : START_HOUR + i === 12 ? '12pm' : `${START_HOUR + i}am`}"
);
code2 = code2.replace(
  "style={{ left: `\\${(i / (END_HOUR - START_HOUR)) * 100}%` }}",
  "style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }}"
);
code2 = code2.replace(
  "msg: `\\${a.vendorName} and \\${b.vendorName} are scheduled to arrive/prep simultaneously at \\${format(parseISO(a.starts_at), 'h:mm a')}`",
  "msg: `${a.vendorName} and ${b.vendorName} are scheduled to arrive/prep simultaneously at ${format(parseISO(a.starts_at), 'h:mm a')}`"
);
code2 = code2.replace(
  "style={{ left: `\\${span.leftPct}%`, width: `\\${span.widthPct}%` }}",
  "style={{ left: `${span.leftPct}%`, width: `${span.widthPct}%` }}"
);

fs.writeFileSync(path2, code2);
