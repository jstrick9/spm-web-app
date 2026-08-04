import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Truck, 
  ShieldCheck, 
  Mail, 
  FileUp, 
  CheckCircle, 
  Compass, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  QrCode, 
  FileText, 
  UploadCloud, 
  HelpCircle, 
  Check, 
  Map, 
  AlertCircle,
  Sparkles,
  CheckSquare,
  Activity,
  MessageSquare,
  Send
} from 'lucide-react';
import { sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';

export function VendorLogistics({ vendorId, token, initialResponses }: { vendorId: string; token: string; initialResponses?: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Load from localStorage draft if available, otherwise fall back to initialResponses
  const draftKey = `wvi_vendor_logistics_draft_${vendorId}`;
  const savedDraft = useMemo(() => {
    try {
      const data = localStorage.getItem(draftKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, [draftKey]);

  const [arrivalTime, setArrivalTime] = useState(savedDraft?.arrivalTime || initialResponses?.arrivalTime || '');
  const [departureTime, setDepartureTime] = useState(savedDraft?.departureTime || initialResponses?.departureTime || '');
  const [teamSize, setTeamSize] = useState(savedDraft?.teamSize || initialResponses?.teamSize || '');
  const [coiLink, setCoiLink] = useState(savedDraft?.coiLink || initialResponses?.coiLink || '');
  const [coiExpiration, setCoiExpiration] = useState(savedDraft?.coiExpiration || initialResponses?.coiExpiration || '');

  // File Upload State Simulation
  const [coiUploadMode, setCoiUploadMode] = useState<'link' | 'upload'>(coiLink && !coiLink.includes('/uploads/coi_') ? 'link' : 'upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Auto-save draft on input change
  useEffect(() => {
    const draft = { arrivalTime, departureTime, teamSize, coiLink, coiExpiration };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [arrivalTime, departureTime, teamSize, coiLink, coiExpiration, draftKey]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => sdk.vendors.submitQuestionnaire(vendorId, payload, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorPortal', vendorId] });
      // Clean draft upon successful submission
      localStorage.removeItem(draftKey);
      toast({ title: 'Logistics details submitted successfully', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ arrivalTime, departureTime, teamSize, coiLink, coiExpiration });
  };

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Unsupported COI file type', description: 'Upload a PDF, JPG, PNG, or WebP file.', variant: 'destructive' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'COI file too large', description: 'Upload a file under 8 MB.', variant: 'destructive' });
      return;
    }

    setUploadedFileName(file.name);
    setIsUploading(true);
    setUploadProgress(15);
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) setUploadProgress(Math.max(15, Math.round((evt.loaded / evt.total) * 70)));
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast({ title: 'Could not read COI file', variant: 'destructive' });
    };
    reader.onload = async () => {
      try {
        setUploadProgress(80);
        const res = await sdk.vendors.uploadCoi(vendorId, token, {
          fileName: file.name,
          mimeType: file.type,
          dataUri: String(reader.result),
          expiresAt: coiExpiration || undefined,
        });
        setUploadProgress(100);
        setCoiLink(res.url);
        qc.invalidateQueries({ queryKey: ['vendorPortal', vendorId] });
        toast({ title: 'Certificate of Insurance uploaded for review', description: 'Venue staff can now verify the COI.', variant: 'success' });
      } catch (err: any) {
        toast({ title: 'COI upload failed', description: err.message, variant: 'destructive' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const isSubmitted = !!initialResponses?.submittedAt;

  return (
    <Card id="logistics-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-base font-serif font-black text-brand flex items-center justify-between">
           <span className="flex items-center gap-2">
             <FileUp className="w-4 h-4 text-brand" /> Logistics Questionnaire
           </span>
           {isSubmitted && <Badge variant="success" className="text-[9px] uppercase font-bold tracking-wider">Submitted</Badge>}
        </CardTitle>
        <CardDescription className="text-xs text-fg-subtle">
           Required details for physical gate clearance and loading dock schedules.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="arr" className="text-xs font-bold text-fg-muted uppercase tracking-wider">Expected Arrival Time</Label>
              <Input id="arr" type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="dep" className="text-xs font-bold text-fg-muted uppercase tracking-wider">Expected Departure Time</Label>
              <Input id="dep" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} required className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="team" className="text-xs font-bold text-fg-muted uppercase tracking-wider">Team Size (On-site staff count)</Label>
            <Input id="team" type="number" min="1" placeholder="e.g. 4 crew members" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} required className="mt-1.5" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">Certificate of Insurance (COI)</Label>
            <div className="flex border border-border rounded-lg p-1 bg-surface max-w-xs">
              <Button 
                type="button" 
                variant={coiUploadMode === 'upload' ? 'secondary' : 'ghost'} 
                size="xs" 
                className="flex-1 text-xs font-bold"
                onClick={() => setCoiUploadMode('upload')}
              >
                File Upload
              </Button>
              <Button 
                type="button" 
                variant={coiUploadMode === 'link' ? 'secondary' : 'ghost'} 
                size="xs" 
                className="flex-1 text-xs font-bold"
                onClick={() => setCoiUploadMode('link')}
              >
                Document Link
              </Button>
            </div>

            {coiUploadMode === 'link' ? (
              <div className="mt-2 space-y-1.5">
                <Input id="coi" type="url" placeholder="https://drive.google.com/your-coi-pdf" value={coiLink} onChange={(e) => setCoiLink(e.target.value)} />
                <p className="text-[10px] text-fg-subtle font-semibold">Provide a secure share link to your PDF from Dropbox, OneDrive, or Google Drive.</p>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                {coiLink ? (
                  <div className="border border-success/30 bg-success-soft/20 p-3 rounded-lg flex items-center justify-between text-xs font-semibold text-success">
                    <span className="flex items-center gap-1.5 truncate">
                      <Check className="w-4 h-4 text-success shrink-0" /> COI Secured &amp; Linked
                    </span>
                    {initialResponses?.coiVerificationStatus === 'approved' && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">
                        ✓ Verified by venue
                      </span>
                    )}
                    {initialResponses?.coiVerificationStatus === 'changes_requested' && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">
                        Changes requested
                      </span>
                    )}
                    {(!initialResponses?.coiVerificationStatus || initialResponses?.coiVerificationStatus === 'pending_review') && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Pending venue review
                      </span>
                    )}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="xs" 
                      onClick={() => setCoiLink('')} 
                      className="text-danger hover:bg-danger-soft h-6 px-1.5 font-bold"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-4 bg-surface text-center cursor-pointer hover:border-brand transition-all relative group">
                    <input 
                      type="file" 
                      accept=".pdf,image/*" 
                      onChange={handleSimulatedUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
                    />
                    <UploadCloud className="w-8 h-8 text-brand/40 mx-auto mb-2 group-hover:text-brand transition-colors" />
                    <span className="text-xs font-bold block text-fg-muted group-hover:text-fg transition-colors">Drag &amp; Drop or Click to Upload</span>
                    <span className="text-[10px] text-fg-subtle font-semibold block mt-0.5">PDF or Image up to 5MB</span>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-brand uppercase">
                      <span>Uploading {uploadedFileName}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-brand h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <Label htmlFor="coiExpiration" className="text-xs font-bold text-fg-muted uppercase tracking-wider block mb-1.5">COI Expiration Date</Label>
              <Input 
                id="coiExpiration" 
                type="date" 
                value={coiExpiration} 
                onChange={(e) => setCoiExpiration(e.target.value)} 
                className="bg-surface"
              />
              <p className="text-[10px] text-fg-subtle font-semibold mt-1">Providing an active Certificate of Insurance (COI) expiration is required for venue gate pass approval.</p>
            </div>
          </div>

          <Button type="submit" disabled={mutation.isPending || isUploading} className="w-full font-bold">
            {mutation.isPending ? 'Saving...' : (isSubmitted ? 'Update Responses' : 'Submit Logistics')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
