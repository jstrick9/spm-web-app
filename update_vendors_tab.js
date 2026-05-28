const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { VendorFormDialog } from './VendorFormDialog';",
  "import { VendorFormDialog } from './VendorFormDialog';\nimport { VendorPaymentDialog } from './VendorPaymentDialog';\nimport { CreditCard } from 'lucide-react';"
);

code = code.replace(
  "const [createOpen, setCreateOpen] = useState(false);",
  "const [createOpen, setCreateOpen] = useState(false);\n  const [paymentVendor, setPaymentVendor] = useState<{ id: string; name: string } | null>(null);"
);

// We need to add the "Balance" column and payment action
const columnReplace = `
    {
      id: 'amount',
      header: 'Contract Amount',
      cell: (v) => (
        <div className="text-right tabular-nums">
          {v.contract_amount_cents ? \`$\${(v.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\` : '—'}
        </div>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      cell: (v) => {
        const contract = v.contract_amount_cents || 0;
        const paid = v.amount_paid_cents || 0;
        const balance = contract - paid;
        return (
          <div className="flex flex-col items-end">
             <div className="tabular-nums font-medium">
               {balance > 0 ? \`$\${(balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}\` : balance < 0 ? \`-\$\${(Math.abs(balance) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}\` : '$0.00'}
             </div>
             {paid > 0 && <div className="text-[10px] text-success">Paid: $\${(paid / 100).toLocaleString()}</div>}
             <Button 
               variant="outline" 
               size="xs" 
               className="mt-2 text-[10px] py-1 h-auto"
               onClick={() => setPaymentVendor({ id: v.id, name: v.name })}
             >
               <CreditCard className="w-3 h-3 mr-1" /> Log Payment
             </Button>
          </div>
        )
      }
    }
  ];
`;

code = code.replace(
  /\{\s*id: 'amount',\s*header: 'Contract Amount',[\s\S]*?\}\s*,\s*\];/,
  columnReplace
);

// Add the dialogue component
code = code.replace(
  "{createOpen && (",
  `{paymentVendor && (
        <VendorPaymentDialog
           open={true}
           onOpenChange={(v) => !v && setPaymentVendor(null)}
           vendorId={paymentVendor.id}
           vendorName={paymentVendor.name}
           eventId={eventId}
        />
      )}

      {createOpen && (`
);

fs.writeFileSync(path, code);
