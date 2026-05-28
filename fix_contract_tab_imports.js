const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/contracts/EventContractsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { ContractFormDialog } from './ContractFormDialog';",
  "import { ContractFormDialog } from './ContractFormDialog';\nimport { ESignatureDialog } from './ESignatureDialog';\nimport { ContractPrintView } from './ContractPrintView';\nimport { useQuery } from '@tanstack/react-query';\nimport { sdk } from '../../../sdk';"
);

// We need to add the query for event data to generate the template content
code = code.replace(
  "const handleCreate = (data: any) => {",
  `const { data: eventData } = useQuery({ queryKey: ['event', eventId], queryFn: () => sdk.events.get(eventId) });
  const event = eventData?.event;

  const handleCreate = (data: any) => {
    // Generate dummy content for the contract based on CRM data
    const content = \`This Agreement is made entered into on this day by and between Seven Paths Manor ("Venue") and \${data.recipientName} ("Client") for the event "\${event?.title || 'TBD'}" scheduled on \${event?.start_date || 'TBD'}.

1. Services Provided
The Venue agrees to provide access to the facilities and grounds as specified in the event package selected by the Client.

2. Financial Considerations
The total agreed contract value is \${data.amountStr || 'TBD'}. A non-refundable deposit is required to secure the date.

3. Liability & Insurance
The Client agrees to hold the Venue harmless from any damages or liabilities incurred during the event duration.\`;
`
);

code = code.replace(
  "amountCents: data.amountStr ? parseFloat(data.amountStr.replace(/[^0-9.]/g, '')) * 100 : undefined,",
  "amountCents: data.amountStr ? parseFloat(data.amountStr.replace(/[^0-9.]/g, '')) * 100 : undefined,\n        content,"
);

code = code.replace(
  "const [createOpen, setCreateOpen] = useState(false);",
  "const [createOpen, setCreateOpen] = useState(false);\n  const [signContract, setSignContract] = useState<MockContract | null>(null);\n  const [printContract, setPrintContract] = useState<MockContract | null>(null);"
);

// Update mock contracts to include content
code = code.replace(
  "sentAt: new Date(Date.now() - 86400000 * 5).toISOString(),\n      signedAt: new Date(Date.now() - 86400000 * 2).toISOString(),",
  "sentAt: new Date(Date.now() - 86400000 * 5).toISOString(),\n      signedAt: new Date(Date.now() - 86400000 * 2).toISOString(),\n      content: 'Standard Master Venue Agreement.\\n\\nThis constitutes a legally binding document between Seven Paths Manor and Sarah Smith.',\n      signature: 'Sarah Smith'"
);

code = code.replace(
  "sentAt: new Date(Date.now() - 86400000 * 1).toISOString(),\n    }",
  "sentAt: new Date(Date.now() - 86400000 * 1).toISOString(),\n      content: 'Catering Addendum outlining specific dietary restrictions and service schedules.',\n    }"
);

// Add Review & Sign button
code = code.replace(
  "onClick={() => markSent(contract.id)}>Mark as Sent</Button>\n                      )}",
  "onClick={() => markSent(contract.id)}>Mark as Sent</Button>\n                      )}\n                      {contract.status === 'sent' && (\n                        <Button size=\"sm\" onClick={() => setSignContract(contract)}>Review & Sign</Button>\n                      )}"
);

// Add Download button trigger
code = code.replace(
  "onClick={() => toast({ title: 'Downloading PDF...' })}",
  "onClick={() => {\n                            setPrintContract(contract);\n                            setTimeout(() => window.print(), 100);\n                          }}"
);

// Add the Modals & Print view
code = code.replace(
  "</Card>\n          ))\n        )}\n      </div>",
  `</Card>
          ))
        )}
      </div>

      <ESignatureDialog 
         open={!!signContract}
         onOpenChange={(v) => !v && setSignContract(null)}
         contract={signContract}
         onSign={(id, signature) => {
            setContracts(contracts.map(c => c.id === id ? { ...c, status: 'signed', signedAt: new Date().toISOString(), signature } : c));
            toast({ title: 'Contract executed', variant: 'success' });
         }}
      />
      
      <ContractPrintView 
         contract={printContract}
         event={event}
         venueName="Seven Paths Manor"
      />`
);

// Add interface properties
code = code.replace(
  "signedAt?: string;",
  "signedAt?: string;\n  content?: string;\n  signature?: string;"
);

fs.writeFileSync(path, code);
