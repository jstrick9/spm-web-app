const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/VendorPortal.tsx';
let code = fs.readFileSync(path, 'utf8');

// We need to add a logistics questionnaire to the right column, either below or above timeline
const logisticsCode = `
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
`;

code = code.replace(
  "import { Button } from '../ui/Button';",
  "import { Button } from '../ui/Button';\n" + logisticsCode
);

code = code.replace(
  "         {!event ? (",
  "         {!event ? ("
);

code = code.replace(
  "               {/* Right Column: Timeline */}",
  `               {/* Right Column: Timeline & Logistics */}
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
                  />`
);

code = code.replace(
  "               {/* Right Column: Timeline */}\n               <div className=\"lg:col-span-2 space-y-6\">",
  ""
);

fs.writeFileSync(path, code);
