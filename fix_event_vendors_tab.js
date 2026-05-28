const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { DataTable, type Column } from '../../../ui/DataTable';",
  "import { DataTable, type Column } from '../../../ui/DataTable';\nimport { Link } from 'lucide-react';"
);

code = code.replace(
  "<div className=\"flex flex-col text-sm text-fg-muted\">\n          {v.contact_name ? <span>{v.contact_name}</span> : null}\n          <div className=\"flex gap-2 items-center mt-1\">\n            {v.email && <a href={`mailto:${v.email}`} className=\"text-brand hover:underline\" aria-label=\"Email\"><Mail className=\"w-3.5 h-3.5\" /></a>}\n            {v.phone && <a href={`tel:${v.phone}`} className=\"text-brand hover:underline\" aria-label=\"Phone\"><Phone className=\"w-3.5 h-3.5\" /></a>}\n            {v.website_url && <a href={v.website_url} target=\"_blank\" rel=\"noreferrer\" className=\"text-brand hover:underline\" aria-label=\"Website\"><ExternalLink className=\"w-3.5 h-3.5\" /></a>}\n          </div>\n        </div>",
  `<div className="flex flex-col text-sm text-fg-muted">
          {v.contact_name ? <span>{v.contact_name}</span> : null}
          <div className="flex gap-2 items-center mt-1">
            {v.email && <a href={\`mailto:\${v.email}\`} className="text-brand hover:underline" aria-label="Email"><Mail className="w-3.5 h-3.5" /></a>}
            {v.phone && <a href={\`tel:\${v.phone}\`} className="text-brand hover:underline" aria-label="Phone"><Phone className="w-3.5 h-3.5" /></a>}
            {v.website_url && <a href={v.website_url} target="_blank" rel="noreferrer" className="text-brand hover:underline" aria-label="Website"><ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>
          <div className="mt-2">
            <a href={\`#/vendor/\${v.id}\`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase font-medium text-brand tracking-wider hover:underline">
               <Link className="w-3 h-3" /> Vendor Portal Link
            </a>
          </div>
        </div>`
);

fs.writeFileSync(path, code);
