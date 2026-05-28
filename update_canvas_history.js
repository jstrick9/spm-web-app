const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// I am adding the Approval Workflow dropdown to the History tab
const historyHeader = `
               {layout && (
                 <div className="bg-surface p-3 rounded border border-border shadow-sm mb-2">
                   <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2 flex justify-between items-center">
                     Current Layout
                     <Badge variant={layout.approval_status === 'approved' ? 'success' : layout.approval_status === 'pending' ? 'warning' : 'outline'} className="text-[10px] uppercase">{layout.approval_status}</Badge>
                   </div>
                   <div className="text-sm font-medium">Revision {layout.revision}</div>
                   <div className="text-xs text-fg-subtle mt-1 mb-2">Last updated {new Date(layout.updated_at).toLocaleString()}</div>
                   
                   <div className="flex gap-2">
                      <select 
                        className="text-xs bg-surface-2 border border-border rounded px-2 py-1 w-full"
                        value={layout.approval_status}
                        onChange={(e) => {
                           if (window.confirm(\`Change layout status to \${e.target.value}?\`)) {
                              saveLayout.mutate({ ...JSON.parse(layout.payload as any), approvalStatus: e.target.value });
                           }
                        }}
                      >
                         <option value="draft">Draft</option>
                         <option value="pending">Pending Approval</option>
                         <option value="approved">Approved</option>
                         <option value="rejected">Rejected</option>
                      </select>
                   </div>
                 </div>
               )}
`;

code = code.replace(/\{layout && \([\s\S]*?Current Layout[\s\S]*?Active<\/Badge>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>\s*\)\}/m, historyHeader);

// We need to inject the approvalStatus into the mutate hook so it reaches the SDK
code = code.replace(
  "mutationFn: (payload: any) => layoutsSdk.save(layout!.id, { items: payload, vendorLines }),",
  "mutationFn: (payload: any) => layoutsSdk.save(layout!.id, { items: payload.items || payload, vendorLines: payload.vendorLines || vendorLines }, { approvalStatus: payload.approvalStatus }),"
);

fs.writeFileSync(path, code);
