import React from 'react';
import { format } from 'date-fns';

interface Props {
  contract: any;
  event: any;
  venueName: string;
}

export function ContractPrintView({ contract, event, venueName }: Props) {
  if (!contract) return null;

  return (
    <div className="hidden print:block bg-white text-black w-full">
       <div className="max-w-4xl mx-auto font-serif">
          {/* Header */}
          <div className="text-center mb-12 border-b-2 border-black pb-8">
             <h1 className="text-3xl font-bold uppercase tracking-widest">{venueName}</h1>
             <p className="text-lg mt-2 text-gray-600">{contract.title}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-8 mb-12 text-sm border border-gray-300 p-6">
             <div>
                <strong className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Prepared For</strong>
                <div>{contract.recipientName}</div>
                {contract.recipientEmail && <div>{contract.recipientEmail}</div>}
             </div>
             <div>
                <strong className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Event Details</strong>
                <div>Event: {event?.title || 'TBD'}</div>
                <div>Date: {event?.start_date ? format(new Date(event.start_date), 'MMMM d, yyyy') : 'TBD'}</div>
                {contract.amountCents && <div>Contract Value: ${(contract.amountCents / 100).toLocaleString()}</div>}
             </div>
          </div>

          {/* Body */}
          <div className="text-sm leading-loose whitespace-pre-wrap mb-16 text-justify">
             {contract.content || 'Standard contract provisions and agreements are placed here...'}
          </div>

          {/* Signatures */}
          {contract.status === 'signed' && (
            <div className="border-t border-gray-300 pt-8 flex gap-12">
               <div className="flex-1">
                  <strong className="block text-xs uppercase tracking-wider text-gray-500 mb-4">Digitally Signed By</strong>
                  <div className="font-display text-3xl mb-2 text-blue-900 italic border-b border-gray-300 pb-2 inline-block min-w-[250px]">
                    {contract.signature}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    IP/Time: {new Date(contract.signedAt).toLocaleString()}
                  </div>
               </div>
               <div className="flex-1">
                  <strong className="block text-xs uppercase tracking-wider text-gray-500 mb-4">Venue Representative</strong>
                  <div className="font-display text-3xl mb-2 text-blue-900 italic border-b border-gray-300 pb-2 inline-block min-w-[250px]">
                    {venueName} Admin
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    Countersigned
                  </div>
               </div>
            </div>
          )}
       </div>
    </div>
  );
}
