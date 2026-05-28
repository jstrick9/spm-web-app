const fs = require('fs');

const path2 = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code2 = fs.readFileSync(path2, 'utf8');

const regex = /<Card>\n          <DataTable[\s\S]*?<\/Card>\n          \{vendors\.length > 0 && <VendorTimelineChart eventId=\{eventId\} \/>\}\n        <\/>\n      \)\}<\/div>/m;

code2 = code2.replace(regex, `<Card>
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
      )}

      {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}`);

fs.writeFileSync(path2, code2);
