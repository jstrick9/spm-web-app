import React, { useState } from 'react';
import { FileSignature, Plus, ExternalLink, Download, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { useToast } from '../../../ui/Toast';
import { ContractFormDialog } from './ContractFormDialog';
import { ESignatureDialog } from './ESignatureDialog';
import { ContractPrintView } from './ContractPrintView';
import { useQuery } from '@tanstack/react-query';
import { sdk } from '../../../sdk';

interface Props {
  eventId: string;
}

export interface MockContract {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  recipientName: string;
  amountCents?: number;
  sentAt?: string;
  signedAt?: string;
  content?: string;
  signature?: string;
}

export function EventContractsTab({ eventId }: Props) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [signContract, setSignContract] = useState<MockContract | null>(null);
  const [printContract, setPrintContract] = useState<MockContract | null>(null);
  const [contracts, setContracts] = useState<MockContract[]>([
    {
      id: 'c1',
      title: 'Master Venue Agreement',
      status: 'signed',
      recipientName: 'Sarah Smith',
      amountCents: 1000000,
      sentAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      signedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      content: 'Standard Master Venue Agreement.\n\nThis constitutes a legally binding document between Seven Paths Manor and Sarah Smith.',
      signature: 'Sarah Smith'
    },
    {
      id: 'c2',
      title: 'Catering Addendum',
      status: 'sent',
      recipientName: 'Sarah Smith',
      amountCents: 850000,
      sentAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      content: 'Catering Addendum outlining specific dietary restrictions and service schedules.',
    }
  ]);

  const { data: eventData } = useQuery({ queryKey: ['event', eventId], queryFn: () => sdk.events.get(eventId) });
  const event = eventData?.event;

  const handleCreate = (data: any) => {
    // Generate dummy content for the contract based on CRM data
    const content = `This Agreement is made entered into on this day by and between Seven Paths Manor ("Venue") and ${data.recipientName} ("Client") for the event "${event?.title || 'TBD'}" scheduled on ${event?.start_date || 'TBD'}.

1. Services Provided
The Venue agrees to provide access to the facilities and grounds as specified in the event package selected by the Client.

2. Financial Considerations
The total agreed contract value is ${data.amountStr || 'TBD'}. A non-refundable deposit is required to secure the date.

3. Liability & Insurance
The Client agrees to hold the Venue harmless from any damages or liabilities incurred during the event duration.`;

    setContracts([
      ...contracts, 
      {
        id: `c${Date.now()}`,
        title: data.title,
        status: 'draft',
        recipientName: data.recipientName,
        amountCents: data.amountStr ? parseFloat(data.amountStr.replace(/[^0-9.]/g, '')) * 100 : undefined,
        content,
      }
    ]);
    toast({ title: 'Contract drafted', variant: 'success' });
  };

  const markSent = (id: string) => {
    setContracts(contracts.map(c => c.id === id ? { ...c, status: 'sent', sentAt: new Date().toISOString() } : c));
    toast({ title: 'Contract marked as sent', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-fg flex items-center gap-2">
           <FileSignature className="w-5 h-5 text-brand" /> Contracts & Agreements
        </h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Draft Contract
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-fg-muted">Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{contracts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-fg-muted">Pending Signatures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-warning">{contracts.filter(c => c.status === 'sent').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-fg-muted">Fully Executed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-success">{contracts.filter(c => c.status === 'signed').length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {contracts.length === 0 ? (
          <Card>
             <div className="py-12 flex flex-col items-center text-center">
               <FileSignature className="w-12 h-12 text-fg-subtle mb-4" />
               <h3 className="text-lg font-medium">No contracts generated</h3>
               <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                 Draft digital agreements for venues, catering, and preferred vendors directly from templates.
               </p>
               <Button variant="outline" onClick={() => setCreateOpen(true)}>Draft Contract</Button>
             </div>
          </Card>
        ) : (
          contracts.map(contract => (
             <Card key={contract.id} className="hover:shadow-elev-1 transition-shadow border border-border bg-surface overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                   <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded bg-surface-2 border border-border flex items-center justify-center shrink-0">
                         {contract.status === 'signed' ? <CheckCircle2 className="w-5 h-5 text-success" /> : <FileText className="w-5 h-5 text-fg-muted" />}
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base">{contract.title}</h3>
                            <Badge variant={
                               contract.status === 'signed' ? 'success' : 
                               contract.status === 'sent' ? 'warning' : 'outline'
                            } className="text-[10px] uppercase">
                               {contract.status}
                            </Badge>
                         </div>
                         <div className="text-sm text-fg-muted flex flex-col sm:flex-row sm:items-center sm:gap-4">
                            <span>Recipient: <span className="font-medium text-fg">{contract.recipientName}</span></span>
                            {contract.amountCents && (
                               <span className="hidden sm:inline">• Value: ${(contract.amountCents / 100).toLocaleString()}</span>
                            )}
                         </div>
                         {contract.sentAt && !contract.signedAt && (
                           <div className="text-xs text-fg-subtle mt-1">
                              Sent on {new Date(contract.sentAt).toLocaleDateString()}
                           </div>
                         )}
                         {contract.signedAt && (
                           <div className="text-xs text-success mt-1">
                              Signed on {new Date(contract.signedAt).toLocaleDateString()}
                           </div>
                         )}
                      </div>
                   </div>

                   <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0 border-t border-border sm:border-0">
                      {contract.status === 'draft' && (
                         <Button size="sm" onClick={() => markSent(contract.id)}>Mark as Sent</Button>
                      )}
                      {contract.status === 'sent' && (
                        <Button size="sm" onClick={() => setSignContract(contract)}>Review & Sign</Button>
                      )}
                      {contract.status === 'sent' && (
                         <Button size="sm" variant="outline" onClick={() => {
                            navigator.clipboard.writeText(`https://example.com/sign/${contract.id}`);
                            toast({ title: 'Signing link copied' });
                         }}>
                            <ExternalLink className="w-4 h-4 mr-1" /> Copy Link
                         </Button>
                      )}
                      {contract.status === 'signed' && (
                         <Button size="sm" variant="secondary" onClick={() => {
                            setPrintContract(contract);
                            setTimeout(() => window.print(), 100);
                          }}>
                            <Download className="w-4 h-4 mr-1" /> Download PDF
                         </Button>
                      )}
                   </div>
                </div>
             </Card>
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
      />

      {createOpen && (
         <ContractFormDialog 
           open={createOpen} 
           onOpenChange={setCreateOpen} 
           onSave={handleCreate} 
         />
      )}
    </div>
  );
}
