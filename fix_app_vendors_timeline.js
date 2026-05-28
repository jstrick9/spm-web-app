const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { VendorPaymentDialog } from './VendorPaymentDialog';",
  "import { VendorPaymentDialog } from './VendorPaymentDialog';\nimport { VendorTimelineChart } from './VendorTimelineChart';"
);

code = code.replace(
  "<Card>\n          <DataTable \n            columns={columns} \n            data={filtered} \n            getRowKey={v => v.id}\n            emptyMessage={\n               <div className=\"py-12 flex flex-col items-center text-center\">\n                 <Truck className=\"w-12 h-12 text-fg-subtle mb-4\" />\n                 <h3 className=\"text-lg font-medium\">No vendors attached</h3>\n                 <p className=\"text-sm text-fg-muted max-w-sm mt-1 mb-4\">\n                   Add caterers, florists, photographers, and other partners specific to this event.\n                 </p>\n                 <Button variant=\"outline\" onClick={() => setCreateOpen(true)}>Add Vendor</Button>\n               </div>\n            }\n          />\n        </Card>",
  `<Card>
          <DataTable 
            columns={columns} 
            data={filtered} 
            getRowKey={v => v.id}
            emptyMessage={
               <div className="py-12 flex flex-col items-center text-center">
                 <Truck className="w-12 h-12 text-fg-subtle mb-4" />
                 <h3 className="text-lg font-medium">No vendors attached</h3>
                 <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                   Add caterers, florists, photographers, and other partners specific to this event.
                 </p>
                 <Button variant="outline" onClick={() => setCreateOpen(true)}>Add Vendor</Button>
               </div>
            }
          />
        </Card>
        
        {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}`
);

fs.writeFileSync(path, code);
