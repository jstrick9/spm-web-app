import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Phone, Truck, ShieldCheck, Mail } from 'lucide-react';
import { sdk } from '../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ui/Toast';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { FileUp, CheckCircle } from 'lucide-react';

function VendorLogistics({ vendorId, initialResponses }: { vendorId: string; initialResponses?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [arrivalTime, setArrivalTime] = useState(initialResponses?.arrivalTime || '');
  const [departureTime, setDepartureTime] = useState(initialResponses?.departureTime || '');
  const [teamSize, setTeamSize] = useState(initialResponses?.teamSize || '');
  const [coiLink, setCoiLink] = useState(initialResponses?.coiLink || '');

  const mutation = useMutation({
    mutationFn: async (payload: any) => sdk.vendors.submitQuestionnaire(vendorId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorPortal', vendorId] });
      toast({ title: 'Logistics updated', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ arrivalTime, departureTime, teamSize, coiLink });
  };

  const isSubmitted = !!initialResponses?.submittedAt;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
           <span className="flex items-center gap-2">
             <FileUp className="w-4 h-4 text-brand" /> Logistics Questionnaire
           </span>
           {isSubmitted && <Badge variant="success" className="text-[10px] uppercase">Submitted</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="arr">Expected Arrival Time</Label>
              <Input id="arr" type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="dep">Expected Departure Time</Label>
              <Input id="dep" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} required className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="team">Team Size (Total personnel on site)</Label>
            <Input id="team" type="number" min="1" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="coi">COI Document Link</Label>
            <Input id="coi" type="url" placeholder="https://drive.google.com/..." value={coiLink} onChange={(e) => setCoiLink(e.target.value)} className="mt-1.5" />
            <p className="text-xs text-fg-muted mt-1">Please provide a link to your Certificate of Insurance (Dropbox, Google Drive, etc).</p>
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? 'Saving...' : (isSubmitted ? 'Update Responses' : 'Submit Logistics')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


export function VendorPortal({ vendorId }: { vendorId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendorPortal', vendorId],
    queryFn: () => sdk.vendors.portalInfo(vendorId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
         <div className="text-fg-muted animate-pulse">Loading portal...</div>
      </div>
    );
  }

  if (error || !data) {
     return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
           <CardContent className="pt-6 text-center text-danger">
              Unable to load vendor details. Please verify your portal link.
           </CardContent>
        </Card>
      </div>
    );
  }

  const { vendor, event, timeline } = data as any;

  return (
    <div className="min-h-screen bg-hero-editorial">
      {/* Header */}
      <header className="bg-surface border-b border-border py-4 px-6 sticky top-0 z-10 shadow-sm">
         <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
               <h1 className="text-xl font-display font-semibold text-fg">Vendor Portal</h1>
               <p className="text-sm text-fg-muted">Prepared for {vendor.name}</p>
            </div>
            {event && (
               <Badge variant="brand" className="w-fit self-start sm:self-auto">
                 {event.title}
               </Badge>
            )}
         </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
         {!event ? (
            <Card>
               <CardContent className="pt-6 text-center text-fg-muted py-12">
                  <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>You are not currently assigned to an active event.</p>
               </CardContent>
            </Card>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Left Column: Event Specs */}
               <div className="space-y-6">
                  <Card>
                     <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                           <Calendar className="w-4 h-4 text-brand" />
                           Event Details
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4 text-sm">
                        <div>
                           <div className="text-fg-subtle mb-1">Date</div>
                           <div className="font-medium text-fg">{event.start_date || 'TBD'}</div>
                        </div>
                        {event.guest_count > 0 && (
                          <div>
                             <div className="text-fg-subtle mb-1">Guest Count</div>
                             <div className="font-medium text-fg">{event.guest_count} attendees</div>
                          </div>
                        )}
                        <div>
                           <div className="text-fg-subtle mb-1">Status</div>
                           <Badge variant="info" className="uppercase tracking-wider text-[10px]">{event.status}</Badge>
                        </div>
                     </CardContent>
                  </Card>

                  <Card>
                     <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-brand" />
                           Your Commitment
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4 text-sm">
                        <div>
                           <div className="text-fg-subtle mb-1">Category</div>
                           <div className="font-medium text-fg capitalize">{vendor.category || 'General'}</div>
                        </div>
                        <div>
                           <div className="text-fg-subtle mb-1">Contract Amount</div>
                           <div className="font-medium text-fg">
                              {vendor.contract_amount_cents ? `$${(vendor.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                           </div>
                        </div>
                        <div>
                           <div className="text-fg-subtle mb-1">Balance Paid</div>
                           <div className="font-medium text-success">
                              ${(vendor.amount_paid_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </div>
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* Right Column: Timeline & Logistics */}
               <div className="lg:col-span-2 space-y-6">
                  
                  <VendorLogistics 
                     vendorId={vendorId} 
                     initialResponses={(() => {
                        try {
                           const meta = JSON.parse(vendor.metadata || '{}');
                           return meta.questionnaire;
                        } catch {
                           return null;
                        }
                     })()} 
                  />
                  <Card className="h-full">
                     <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-base flex items-center gap-2">
                           <Clock className="w-4 h-4 text-brand" />
                           Run of Show
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                        {timeline.length === 0 ? (
                           <div className="text-center text-fg-muted py-12 px-4">
                              The timeline for this event hasn't been published yet.
                           </div>
                        ) : (
                           <div className="divide-y divide-border">
                              {timeline.map((item: any, i: number) => (
                                 <div key={item.id} className="p-4 sm:p-6 flex gap-4 hover:bg-surface-2 transition-colors">
                                    <div className="w-20 sm:w-24 flex-shrink-0 pt-0.5">
                                       <span className="text-sm font-semibold text-fg">{item.time}</span>
                                    </div>
                                    <div className="flex-1 space-y-1 min-w-0">
                                       <h4 className="text-sm font-medium text-fg">{item.title}</h4>
                                       {item.description && <p className="text-sm text-fg-muted">{item.description}</p>}
                                       <div className="flex flex-wrap gap-2 mt-2">
                                          {item.duration_mins && (
                                            <Badge variant="outline" className="text-[10px]">{item.duration_mins} min</Badge>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </CardContent>
                  </Card>
               </div>
            </div>
         )}
      </main>
    </div>
  );
}
