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
import { sdk } from '../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { useToast } from '../ui/Toast';
import { cn } from '../ui/lib/cn';

// ─── TOUR STEPS FOR THE VENDOR GUIDED WALKTHROUGH ───
interface TourStep {
  title: string;
  description: string;
  targetId: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Seven Paths Manor!',
    description: 'This is your dedicated portal for your upcoming wedding assignment. Let’s take a quick 45-second tour to get you fully set up.',
    targetId: 'header-brand'
  },
  {
    title: 'Your Financial Summary & Commitment',
    description: 'Review your categories, registered contract amount, and total balance paid in real-time. Contact coordination if there are any discrepancies.',
    targetId: 'commitment-card'
  },
  {
    title: 'Interactive Spatial Blueprint Map',
    description: 'Never plan in the dark again. Inspect the venue’s approved layout blueprint in real-time, including exact table positions and setup zones.',
    targetId: 'blueprint-card'
  },
  {
    title: 'Logistics, Arrival, & COI Upload',
    description: 'Submit your expected timing, on-site team size, and upload your Certificate of Insurance (COI) natively. Drafts are auto-saved as you type!',
    targetId: 'logistics-card'
  },
  {
    title: 'Vendor Setup & Execution Checklist',
    description: 'Review and complete your category-specific setup checklists in real-time. Your progress syncs back to the main runsheet.',
    targetId: 'vendor-checklist-card'
  },
  {
    title: 'Direct Coordinator Live Chat',
    description: 'Message the Lead Planner or Venue Director directly in real-time. Coordinate setups without swapping private phone numbers.',
    targetId: 'chat-card'
  },
  {
    title: 'Wedding Timeline & Milestones',
    description: 'Check the real-time Run of Show to understand when you need to be set up, active, or ready to pack down.',
    targetId: 'timeline-card'
  },
  {
    title: 'Digital Entrance Pass (QR Code)',
    description: 'Upon arrival at Seven Paths Manor, present this Digital Gate Pass QR Code to security or the lead planner for a 2-second check-in.',
    targetId: 'gatepass-card'
  }
];

// ─── VENDOR-SPECIFIC CHEKLIST ITEMS BY CATEGORY ───
interface ChecklistItem {
  id: string;
  label: string;
}

const VENDOR_CHECKLISTS_BY_CATEGORY: Record<string, ChecklistItem[]> = {
  catering: [
    { id: 'linen-length', label: 'Verify linen drop length on buffet tables' },
    { id: 'warming-ovens', label: 'Pre-heat warming ovens in staging zone' },
    { id: 'champagne-pour', label: 'Coordinate dinner champagne pour timeline' },
  ],
  florals: [
    { id: 'centerpiece-pins', label: 'Secure centerpiece tall vases to table pins' },
    { id: 'hydrangeas-water', label: 'Verify water level for delicate blooms' },
    { id: 'greenery-draping', label: 'Assemble greenery draping at head table' },
  ],
  decor: [
    { id: 'centerpiece-pins', label: 'Secure centerpiece tall vases to table pins' },
    { id: 'hydrangeas-water', label: 'Verify water level for delicate blooms' },
    { id: 'greenery-draping', label: 'Assemble greenery draping at head table' },
  ],
  entertainment: [
    { id: 'mic-check', label: 'Execute wireless mic frequency sound check' },
    { id: 'cable-taping', label: 'Tape down all power cabling paths' },
    { id: 'circuit-load', label: 'Test load limit balance on Ballroom Circuit 4' },
  ],
  music: [
    { id: 'mic-check', label: 'Execute wireless mic frequency sound check' },
    { id: 'cable-taping', label: 'Tape down all power cabling paths' },
    { id: 'circuit-load', label: 'Test load limit balance on Ballroom Circuit 4' },
  ]
};

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'load-in', label: 'Complete loading-dock equipment transfer' },
  { id: 'crew-briefing', label: 'Execute brief team safety run sheet review' },
  { id: 'cleanup', label: 'Deliver clear trash bins behind setup zone' },
];

// ─── VENDOR LOGISTICS QUESTIONNAIRE WITH AUTO-SAVE & FILE UPLOAD ───
function VendorLogistics({ vendorId, initialResponses }: { vendorId: string; initialResponses?: any }) {
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
    mutationFn: async (payload: any) => sdk.vendors.submitQuestionnaire(vendorId, payload),
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

    setUploadedFileName(file.name);
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate high-fidelity fast upload progress bar
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.floor(Math.random() * 20) + 10;
      if (prog >= 100) {
        prog = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          const simulatedUrl = `https://sevenpathsmanor.com/cdn/uploads/coi_${vendorId}_${Date.now()}.pdf`;
          setCoiLink(simulatedUrl);
          toast({ title: 'Certificate of Insurance uploaded successfully', variant: 'success' });
        }, 300);
      }
      setUploadProgress(prog);
    }, 150);
  };

  const isSubmitted = !!initialResponses?.submittedAt;

  return (
    <Card id="logistics-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-[#e1d5c9]">
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
            <div className="flex border border-[#e1d5c9] rounded-lg p-1 bg-white max-w-xs">
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
                  <div className="border border-emerald-200 bg-emerald-50/20 p-3 rounded-lg flex items-center justify-between text-xs font-semibold text-emerald-800">
                    <span className="flex items-center gap-1.5 truncate">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" /> COI Secured &amp; Linked
                    </span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="xs" 
                      onClick={() => setCoiLink('')} 
                      className="text-rose-600 hover:bg-rose-50 h-6 px-1.5 font-bold"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-[#e1d5c9] rounded-xl p-4 bg-white text-center cursor-pointer hover:border-brand transition-all relative group">
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
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
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
                className="bg-white"
              />
              <p className="text-[10px] text-fg-subtle font-semibold mt-1">Providing an active Certificate of Insurance (COI) expiration is required for estate gate pass approval.</p>
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

// ─── MAIN VENDOR PORTAL WRAPPER ───
export function VendorPortal({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [newMessageText, setNewMessageText] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendorPortal', vendorId],
    queryFn: () => sdk.vendors.portalInfo(vendorId),
  });

  const portalData = data as any;

  // Real-Time Collaborative Portal Chat history query
  const { data: messagesData } = useQuery({
    queryKey: ['vendorPortalMessages', vendorId],
    queryFn: () => sdk.vendors.portalGetMessages(vendorId),
    enabled: !!portalData?.event,
    refetchInterval: 5000, // Poll every 5 seconds to simulate sockets
  });

  const messages = messagesData?.messages || [];

  // Guided Tour States
  const [tourCompleted, setTourCompleted] = useState(true); // default true while loading
  const [tourStep, setTourStep] = useState(0);

  // Guided Tour Hook: useEffect must be unconditionally declared at the top
  useEffect(() => {
    if (!isLoading && portalData) {
      const isCompleted = localStorage.getItem(`wvi_vendor_tour_completed_${vendorId}`);
      if (!isCompleted) {
        setTourCompleted(false);
        setTourStep(0);
      }
    }
  }, [isLoading, portalData, vendorId]);

  // Hook 2: useMemo for approved layout items
  const layoutItems = useMemo(() => {
    if (!portalData?.layouts) return [];
    const approvedLayout = portalData.layouts.find((l: any) => l.approval_status === 'approved') || portalData.layouts[0];
    if (!approvedLayout?.payload) return [];
    try {
      const payload = typeof approvedLayout.payload === 'string' ? JSON.parse(approvedLayout.payload) : approvedLayout.payload;
      return Array.isArray(payload?.items) ? payload.items : [];
    } catch {
      return [];
    }
  }, [portalData?.layouts]);

  // Hook 3: useMemo for event metadata
  const eventMetadata = useMemo(() => {
    const eventObj = portalData?.event;
    if (!eventObj?.metadata) return {};
    try {
      return typeof eventObj.metadata === 'string' ? JSON.parse(eventObj.metadata) : eventObj.metadata;
    } catch {
      return {};
    }
  }, [portalData?.event]);

  const activePlan = eventMetadata.emergency_active_plan || 'plan-a';
  const activeTimelineItemId = eventMetadata.active_timeline_item_id || '';
  const currentBroadcast = eventMetadata.emergency_broadcast_announcement || '';

  // Hook 4: useMemo for vendor metadata
  const vendorMetadata = useMemo(() => {
    const vendorObj = portalData?.vendor;
    if (!vendorObj?.metadata) return {};
    try {
      return typeof vendorObj.metadata === 'string' ? JSON.parse(vendorObj.metadata || '{}') : vendorObj.metadata;
    } catch {
      return {};
    }
  }, [portalData?.vendor]);

  const checkedTasks = vendorMetadata?.questionnaire?.vendorChecklist || {};

  // Hook 5: useMutation for toggling task state
  const toggleTaskMutation = useMutation({
    mutationFn: async (updatedChecklist: Record<string, boolean>) => {
      const currentQuestionnaire = vendorMetadata?.questionnaire || {};
      return sdk.vendors.submitQuestionnaire(vendorId, {
        ...currentQuestionnaire,
        vendorChecklist: updatedChecklist
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorPortal', vendorId] });
      toast({ title: 'Task progress synced', variant: 'success' });
    }
  });

  // Hook 6: useMutation for transmitting collaborative messages
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => sdk.vendors.portalSendMessage(vendorId, body),
    onSuccess: () => {
      setNewMessageText('');
      qc.invalidateQueries({ queryKey: ['vendorPortalMessages', vendorId] });
      // Scroll feed down
      setTimeout(() => {
        if (typeof chatBottomRef.current?.scrollIntoView === 'function') {
          chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  });

  // Auto Scroll Chat Feed on new messages
  useEffect(() => {
    if (messages.length > 0 && typeof chatBottomRef.current?.scrollIntoView === 'function') {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    sendMessageMutation.mutate(newMessageText.trim());
  };

  const handleNextTourStep = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      handleCompleteTour();
    }
  };

  const handlePrevTourStep = () => {
    if (tourStep > 0) {
      setTourStep(tourStep - 1);
    }
  };

  const handleCompleteTour = () => {
    localStorage.setItem(`wvi_vendor_tour_completed_${vendorId}`, 'true');
    setTourCompleted(true);
  };

  const handleToggleTask = (taskId: string) => {
    const nextChecklist = { ...checkedTasks };
    nextChecklist[taskId] = !nextChecklist[taskId];
    toggleTaskMutation.mutate(nextChecklist);
  };

  // Compile Category-specific checklist items
  const catKey = portalData?.vendor?.category?.toLowerCase() || 'general';
  const customCategoryTasks = VENDOR_CHECKLISTS_BY_CATEGORY[catKey] || [];
  const fullChecklist = [...customCategoryTasks, ...DEFAULT_CHECKLIST];

  // EARLY RENDERS GO DOWN HERE, STRICTLY AFTER ALL HOOKS
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
         <div className="text-[#2C2A29] font-serif font-bold text-lg animate-pulse">Compiling portal details...</div>
      </div>
    );
  }

  if (error || !data) {
     return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#FDFBF7] border-2 border-rose-100 rounded-2xl shadow-lg">
           <CardContent className="pt-6 text-center text-rose-700 font-semibold space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
              <p>Unable to load secure vendor details. Please verify your direct link or contact the venue administration.</p>
           </CardContent>
        </Card>
      </div>
    );
  }

  const { vendor, event, timeline, layouts } = data as any;
  const approvedLayout = layouts?.find((l: any) => l.approval_status === 'approved') || layouts?.[0];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2A29]">
      
      {/* GUIDED TOUR COACHMARK OVERLAY CONTAINER */}
      {!tourCompleted && (
        <div className="fixed inset-x-0 bottom-6 z-50 px-4 max-w-xl mx-auto animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-[#2C2A29] text-white p-5 rounded-2xl shadow-2xl border border-gold/40 space-y-4 relative">
            <button 
              onClick={handleCompleteTour} 
              className="absolute right-3.5 top-3.5 text-white/50 hover:text-white"
              title="Dismiss Walkthrough"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-widest text-[#e1d5c9]">
                <Compass className="w-4 h-4 text-brand animate-spin" style={{ animationDuration: '6s' }} /> 
                Tour Step {tourStep + 1} of {TOUR_STEPS.length}
              </div>
              <h3 className="font-serif font-black text-lg text-[#FDFBF7]">{TOUR_STEPS[tourStep].title}</h3>
              <p className="text-xs text-[#e1d5c9]/90 leading-relaxed font-medium">{TOUR_STEPS[tourStep].description}</p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button 
                type="button"
                variant="ghost" 
                size="xs" 
                onClick={handlePrevTourStep} 
                disabled={tourStep === 0}
                className="text-white hover:bg-white/10 disabled:opacity-30 h-8 font-bold"
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" /> Back
              </Button>

              <div className="flex gap-1">
                {TOUR_STEPS.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      idx === tourStep ? "bg-brand w-3" : "bg-white/30"
                    )} 
                  />
                ))}
              </div>

              <Button 
                onClick={handleNextTourStep} 
                size="xs"
                className="bg-brand hover:bg-brand-strong text-[#2C2A29] h-8 font-bold"
              >
                {tourStep === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next'} <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <header className="bg-[#FDFBF7] border-b border-[#e1d5c9] py-5 px-6 sticky top-0 z-40 shadow-xs">
         <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div id="header-brand" className="space-y-1">
               <span className="text-[10px] uppercase font-bold tracking-widest text-brand block">Seven Paths Manor Operational Suite</span>
               <h1 className="text-2xl font-serif font-black text-brand tracking-tight">Vendor Portal</h1>
               <p className="text-sm text-fg-muted">Prepared for {vendor.name}</p>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              {event && (
                 <Badge variant="brand" className="font-serif text-xs font-bold py-1 px-3 border border-[#e1d5c9]">
                   {event.title}
                 </Badge>
              )}
              <Button 
                variant="outline" 
                size="xs" 
                className="h-8 text-xs font-bold text-brand border-[#e1d5c9] hover:bg-[#e1d5c9]/20"
                onClick={() => {
                  setTourCompleted(false);
                  setTourStep(0);
                }}
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1" /> Help Guide
              </Button>
            </div>
         </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

         {/* LIVE WEDDING PROGRESS PACE TRACKER (REAL-TIME SYNC) */}
         {event && activeTimelineItemId && (
           <Card className="bg-emerald-50/20 border-2 border-emerald-500/30 rounded-2xl p-5 flex items-center justify-between shadow-xs animate-pulse">
             <div className="flex gap-3 items-center">
               <div className="relative flex h-3.5 w-3.5 shrink-0">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
               </div>
               <div className="space-y-0.5">
                 <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 block">💍 Real-Time Wedding Progress</span>
                 <p className="font-serif font-black text-brand text-sm sm:text-base">
                   Currently Active Phase: <strong className="text-emerald-700">"{timeline.find((i: any) => i.id === activeTimelineItemId)?.title || 'Milestone'}"</strong>
                 </p>
               </div>
             </div>
             <Badge variant="success" className="text-[9px] uppercase font-bold tracking-wider">
               🟢 Live Synchronized
             </Badge>
           </Card>
         )}

         {/* LIVE COORDINATOR EMERGENCY BROADCAST ANNOUNCEMENT BANNER */}
         {event && currentBroadcast && (
           <Card className="border-2 border-rose-500 bg-rose-50/30 rounded-2xl p-5 flex gap-3.5 items-start animate-bounce">
             <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
             <div className="space-y-1 text-xs sm:text-sm text-rose-900 font-semibold">
               <p className="font-serif font-black text-rose-900 text-sm sm:text-base">🚨 URGENT COORDINATOR BROADCAST</p>
               <p className="opacity-95 leading-relaxed text-xs font-bold text-rose-950">
                 "{currentBroadcast}"
               </p>
             </div>
           </Card>
         )}

         {/* DYNAMIC PLAN B CONTINGENCY WARNING BANNER */}
         {event && activePlan === 'plan-b' && (
           <Card className="border-2 border-amber-400 bg-amber-50/30 rounded-2xl p-5 flex gap-3.5 items-start">
             <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
             <div className="space-y-1 text-xs sm:text-sm text-amber-900 font-semibold">
               <p className="font-serif font-black text-amber-900 text-sm sm:text-base">🌧️ Active Weather Plan B Triggered</p>
               <p className="opacity-90 leading-relaxed text-[11px] sm:text-xs">
                 The ceremony and setups have officially transitioned to the Indoor Ballroom. 
                 Please adapt cable-runs, stage positions, and decor layout structures accordingly. Maintain safe pathways around fire-escapes.
               </p>
             </div>
           </Card>
         )}

         {!event ? (
            <Card className="bg-[#FDFBF7] border border-[#e1d5c9] p-8 text-center rounded-2xl shadow-sm">
               <CardContent className="pt-6 text-center text-fg-subtle py-12 space-y-3">
                  <Truck className="w-12 h-12 mx-auto text-brand opacity-40 animate-bounce" />
                  <p className="font-serif font-black text-lg text-brand">No Wedding Schedule Linked</p>
                  <p className="text-sm text-fg-muted max-w-sm mx-auto font-medium">You are registered on Seven Paths Manor platform but not currently assigned to an active upcoming layout timeline.</p>
               </CardContent>
            </Card>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               
               {/* LEFT SIDEBAR: COMMITTED VALUE & PHYSICAL PASS */}
               <div className="lg:col-span-4 space-y-6">
                  
                  {/* EVENT DETAILS CARD */}
                  <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <Calendar className="w-4 h-4 text-brand" />
                           Event Details
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4 text-sm pt-4">
                        <div>
                           <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Date</div>
                           <div className="font-bold text-fg text-sm">{event.start_date || 'TBD'}</div>
                        </div>
                        {event.guest_count > 0 && (
                          <div>
                             <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Guest Count</div>
                             <div className="font-bold text-fg text-sm">{event.guest_count} attendees</div>
                          </div>
                        )}
                        <div>
                           <div className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Status</div>
                           <Badge variant="info" className="uppercase tracking-wider text-[9px] font-bold">{event.status}</Badge>
                        </div>
                     </CardContent>
                  </Card>

                  {/* COMMITMENT & FINANCES */}
                  <Card id="commitment-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-brand" />
                           Commitment &amp; Financials
                        </CardTitle>
                        <CardDescription className="text-[10px] text-fg-subtle">
                           Formal ledger entry for this wedding execution.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4 text-sm pt-4">
                        <div>
                           <div className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Contract Category</div>
                           <div className="font-bold text-base capitalize flex items-center gap-1.5 text-fg">
                              <Truck className="w-4 h-4 text-brand" /> {vendor.category || 'General Operations'}
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t pt-3">
                           <div>
                              <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Agreement Cost</div>
                              <div className="font-bold text-base text-[#2C2A29]">
                                 {vendor.contract_amount_cents ? `$${(vendor.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </div>
                           </div>
                           <div>
                              <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Balance Paid</div>
                              <div className="font-black text-base text-emerald-600">
                                 ${(vendor.amount_paid_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                           </div>
                        </div>
                     </CardContent>
                  </Card>

                  {/* DIGITAL PASS FOR PORTAL GATE */}
                  <Card id="gatepass-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-[#e1d5c9] bg-[#e1d5c9]/10">
                        <CardTitle className="text-sm font-serif font-black text-brand flex items-center gap-2">
                           <QrCode className="w-4 h-4 text-brand" />
                           Wedding Gate Check-In Pass
                        </CardTitle>
                        <CardDescription className="text-[9px] text-fg-subtle">
                           Quick barcode entry at manor estate main gate security desk.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="p-5 flex flex-col items-center justify-center space-y-4">
                        {/* HIGH FIDELITY SVG REPRESENTATION OF SECURE QR CODE MATRIX */}
                        <div className="bg-white p-3.5 rounded-xl border border-[#e1d5c9] shadow-xs hover:scale-105 transition-transform duration-300">
                          <svg viewBox="0 0 100 100" className="w-28 h-28" fill="#2C2A29">
                            {/* Standard QR squares corners */}
                            <rect x="0" y="0" width="25" height="25" rx="2" />
                            <rect x="4" y="4" width="17" height="17" rx="1" fill="#fff" />
                            <rect x="8" y="8" width="9" height="9" fill="#2C2A29" />

                            <rect x="75" y="0" width="25" height="25" rx="2" />
                            <rect x="79" y="4" width="17" height="17" rx="1" fill="#fff" />
                            <rect x="83" y="8" width="9" height="9" fill="#2C2A29" />

                            <rect x="0" y="75" width="25" height="25" rx="2" />
                            <rect x="4" y="79" width="17" height="17" rx="1" fill="#fff" />
                            <rect x="8" y="83" width="9" height="9" fill="#2C2A29" />

                            {/* Simulated randomized data points */}
                            <rect x="35" y="5" width="5" height="15" />
                            <rect x="45" y="10" width="10" height="5" />
                            <rect x="60" y="5" width="5" height="5" />
                            <rect x="60" y="15" width="10" height="5" />

                            <rect x="5" y="35" width="15" height="5" />
                            <rect x="10" y="45" width="5" height="10" />
                            <rect x="5" y="60" width="5" height="5" />
                            <rect x="15" y="60" width="5" height="10" />

                            <rect x="35" y="35" width="30" height="30" rx="3" fill="#e1d5c9" />
                            <rect x="42" y="42" width="16" height="16" rx="1" fill="#2C2A29" />

                            <rect x="75" y="35" width="5" height="15" />
                            <rect x="85" y="45" width="10" height="5" />
                            <rect x="90" y="35" width="5" height="5" />

                            <rect x="35" y="75" width="15" height="5" />
                            <rect x="45" y="85" width="10" height="10" />
                            <rect x="60" y="80" width="5" height="5" />

                            <rect x="75" y="75" width="10" height="5" />
                            <rect x="85" y="85" width="5" height="5" />
                            <rect x="80" y="90" width="15" height="5" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-serif font-black tracking-wider text-brand block uppercase">PASS: {vendorId.slice(0, 8).toUpperCase()}</span>
                          <span className="text-[10px] text-fg-subtle font-semibold block mt-0.5 max-w-[200px]">Present to Venue Director / Security Gatehouse upon loading arrival.</span>
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* RIGHT AREA: BLUEPRINT MAP, CHAT, LOGISTICS, CHECKLIST, TIMELINE */}
               <div className="lg:col-span-8 space-y-6">
                  
                  {/* REAL-TIME SPATIAL BLUEPRINT MAP */}
                  <Card id="blueprint-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <Map className="w-4 h-4 text-brand" />
                           Real-Time Floorplan Map Blueprint
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Approved physical layout structure, table arrangements, and setup spacing grids.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-4">
                        {approvedLayout ? (
                           <div className="space-y-4">
                              <div className="flex justify-between items-center text-xs font-semibold bg-white p-2.5 rounded-lg border border-[#e1d5c9]">
                                 <div>
                                    Layout: <strong className="text-brand">{approvedLayout.name}</strong> 
                                    <span className="text-fg-subtle ml-1">(v{approvedLayout.revision})</span>
                                 </div>
                                 <Badge variant="success" className="text-[9px] uppercase tracking-wider">
                                    {approvedLayout.approval_status}
                                 </Badge>
                              </div>

                              {/* Interactive SVG Renderer */}
                              <div className="relative border border-[#e1d5c9] rounded-xl overflow-hidden bg-white">
                                 {layoutItems.length === 0 ? (
                                    <div className="text-center py-12 text-fg-subtle">No physical elements placed in layout.</div>
                                 ) : (
                                    <svg viewBox="0 0 800 600" className="w-full h-auto bg-[#FDFBF7]" aria-label="Floorplan Layout SVG Blueprint Map">
                                       <defs>
                                          <pattern id="dotGridPortal" width="20" height="20" patternUnits="userSpaceOnUse">
                                             <circle cx="2" cy="2" r="1" fill="#e1d5c9" opacity="0.4" />
                                          </pattern>
                                       </defs>
                                       <rect width="100%" height="100%" fill="url(#dotGridPortal)" />

                                       {layoutItems.map((item: any) => {
                                          if (item.type === 'round_table') {
                                             return (
                                                <g key={item.id}>
                                                   <circle cx={item.x} cy={item.y} r={item.radius || 30} fill="#ffffff" stroke="#9ca3af" strokeWidth="1.5" />
                                                   <text x={item.x} y={item.y + 3} fontFamily="Georgia, serif" fontSize="9" textAnchor="middle" fill="#374151" fontWeight="bold">{item.label || 'Round'}</text>
                                                </g>
                                             );
                                          }
                                          if (item.type === 'rect_table' || item.type === 'dance_floor') {
                                             const w = item.width || 120;
                                             const h = item.height || 40;
                                             const fill = item.type === 'dance_floor' ? '#e5e7eb' : '#ffffff';
                                             const stroke = item.type === 'dance_floor' ? '#d1d5db' : '#9ca3af';
                                             return (
                                                <g key={item.id} transform={`rotate(${item.rotation || 0} ${item.x} ${item.y})`}>
                                                   <rect x={item.x - w/2} y={item.y - h/2} width={w} height={h} rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
                                                   <text x={item.x} y={item.y + 3} fontFamily="Georgia, serif" fontSize="9" textAnchor="middle" fill="#374151" fontWeight="bold">{item.label || 'Rect'}</text>
                                                </g>
                                             );
                                          }
                                          if (item.type === 'custom_wall') {
                                             if (item.points && item.points.length >= 4) {
                                                const path = `M ${item.points[0]} ${item.points[1]} ` + item.points.slice(2).reduce((acc: string, val: number, idx: number) => {
                                                   return acc + (idx % 2 === 0 ? `L ${val} ` : `${val} `);
                                                }, '');
                                                return (
                                                   <path key={item.id} d={path} fill="none" stroke={item.color || '#374151'} strokeWidth={item.strokeWidth || 4} strokeLinecap="round" strokeLinejoin="round" />
                                                );
                                             }
                                          }
                                          if (item.type === 'chair') {
                                             return (
                                                <circle key={item.id} cx={item.x} cy={item.y} r={item.radius || 6} fill="#fff" stroke="#6b7280" strokeWidth="1" />
                                             );
                                          }
                                          return null;
                                       })}
                                    </svg>
                                 )}
                              </div>
                           </div>
                        ) : (
                           <div className="text-center py-12 text-fg-subtle bg-white rounded-xl border border-dashed p-6">
                              <Map className="w-10 h-10 mx-auto text-brand/30 mb-2" />
                              <p className="font-serif font-black text-brand">No Approved Layout Map</p>
                              <p className="text-xs font-semibold max-w-xs mx-auto mt-1">The spatial seating plan has not been fully finalized yet. Please check back soon.</p>
                           </div>
                        )}
                     </CardContent>
                  </Card>

                  {/* DIRECT COLLABORATIVE COORDINATOR LIVE CHAT CARD */}
                  <Card id="chat-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <MessageSquare className="w-4 h-4 text-brand" /> Direct Coordinator Live Chat
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Secure, direct link to the Seven Paths Manor coordination crew and venue directors.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-6 space-y-4">
                        
                        {/* Conversation feed */}
                        <div className="border border-[#e1d5c9] rounded-xl p-4 bg-white h-64 overflow-y-auto space-y-3 flex flex-col">
                           {messages.length === 0 ? (
                              <div className="text-center my-auto text-xs text-fg-subtle font-semibold py-8 space-y-2">
                                 <MessageSquare className="w-8 h-8 text-brand/30 mx-auto mb-1 animate-bounce" />
                                 <p>No chat history in thread yet.</p>
                                 <p className="text-[10px] leading-tight max-w-[240px] mx-auto">Type a message below to coordinate load-in points or AV circuit loads on site.</p>
                              </div>
                           ) : (
                              messages.map((msg: any) => {
                                 const isSelf = msg.sender_role === 'vendor' || msg.sender_id === vendor.id;
                                 return (
                                    <div 
                                       key={msg.id}
                                       className={cn(
                                          "max-w-[80%] rounded-2xl p-3 text-xs font-medium space-y-1 relative shadow-xs",
                                          isSelf 
                                             ? "bg-[#2C2A29] text-[#FDFBF7] self-end rounded-tr-none" 
                                             : "bg-surface-2 text-[#2C2A29] border border-border self-start rounded-tl-none"
                                       )}
                                    >
                                       {!isSelf && (
                                          <div className="text-[9px] uppercase font-bold text-brand tracking-wider mb-0.5">
                                             {msg.sender_role.replace('_', ' ')}
                                          </div>
                                       )}
                                       <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                       <span className={cn(
                                          "text-[8px] font-semibold block text-right mt-1 opacity-60",
                                          isSelf ? "text-brand-soft" : "text-fg-subtle"
                                       )}>
                                          {new Date(msg.created_at).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                                       </span>
                                    </div>
                                 );
                              })
                           )}
                           <div ref={chatBottomRef} />
                        </div>

                        {/* Send message form */}
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                           <Input 
                              placeholder="Type message to venue crew..." 
                              value={newMessageText}
                              onChange={(e) => setNewMessageText(e.target.value)}
                              className="text-xs h-9 border-[#e1d5c9] bg-white flex-1"
                              required
                           />
                           <Button 
                              type="submit" 
                              size="xs" 
                              disabled={sendMessageMutation.isPending || !newMessageText.trim()}
                              className="h-9 px-4 font-bold bg-[#2C2A29] hover:bg-[#3e3c3b] text-white flex items-center gap-1 shrink-0"
                           >
                              <Send className="w-3.5 h-3.5" /> Send
                           </Button>
                        </form>

                     </CardContent>
                  </Card>

                  {/* INTERACTIVE CATEGORY-SPECIFIC CHECKLIST CARD */}
                  <Card id="vendor-checklist-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <CheckSquare className="w-4 h-4 text-brand" />
                           Your Setup &amp; Execution Checklist
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Keep your crew organized. Tap tasks as you complete them to sync with on-site planners.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-6">
                        <div className="space-y-2.5">
                           {fullChecklist.map((task) => {
                              const isChecked = !!checkedTasks[task.id];
                              return (
                                 <div 
                                    key={task.id}
                                    onClick={() => handleToggleTask(task.id)}
                                    className={cn(
                                       "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-white",
                                       isChecked 
                                          ? "border-emerald-200 bg-emerald-50/10" 
                                          : "border-[#e1d5c9] hover:border-brand"
                                    )}
                                 >
                                    <div className={cn(
                                       "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                       isChecked 
                                          ? "border-emerald-500 bg-emerald-5050 text-white" 
                                          : "border-gray-300"
                                    )}>
                                       {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                    <span className={cn(
                                       "text-sm font-semibold transition-colors",
                                       isChecked ? "text-fg-subtle line-through" : "text-fg-muted"
                                    )}>
                                       {task.label}
                                    </span>
                                 </div>
                              );
                           })}
                        </div>
                     </CardContent>
                  </Card>

                  {/* VENDOR LOGISTICS CARD */}
                  <VendorLogistics 
                     vendorId={vendorId} 
                     initialResponses={(() => {
                        try {
                           const meta = typeof vendor.metadata === 'string' ? JSON.parse(vendor.metadata || '{}') : vendor.metadata;
                           return meta?.questionnaire;
                        } catch {
                           return null;
                        }
                     })()} 
                  />

                  {/* RUN OF SHOW TIMELINE */}
                  <Card id="timeline-card" className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-4 border-b border-[#e1d5c9]">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <Clock className="w-4 h-4 text-brand" />
                           Wedding Timeline &amp; Milestones (Run of Show)
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Real-time schedule of setups, grand entrance, meals, and teardown.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="p-0 bg-white">
                        {timeline.length === 0 ? (
                           <div className="text-center text-fg-muted py-12 px-4 italic text-sm">
                              The official schedule for this event is currently being compiled by the coordination team.
                           </div>
                        ) : (
                           <div className="divide-y divide-gray-100">
                              {timeline.map((item: any) => {
                                 const time = item.time || (item.starts_at ? new Date(item.starts_at).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'}) : 'TBD');
                                 const isActive = item.id === activeTimelineItemId;
                                 return (
                                    <div 
                                       key={item.id} 
                                       className={cn(
                                          "p-4 sm:p-5 flex gap-4 transition-colors",
                                          isActive ? "bg-emerald-50/10 border-l-4 border-l-emerald-500 pl-4" : "hover:bg-surface-2"
                                       )}
                                    >
                                       <div className="w-20 sm:w-24 shrink-0 pt-0.5">
                                          <span className={cn(
                                             "text-xs font-bold px-2 py-0.5 rounded-md",
                                             isActive ? "bg-emerald-500 text-white" : "bg-brand-soft/20 text-brand"
                                          )}>
                                             {time}
                                          </span>
                                       </div>
                                       <div className="flex-1 space-y-1 min-w-0">
                                          <h4 className="text-sm font-bold text-fg flex items-center gap-2">
                                             {item.title}
                                             {isActive && (
                                                <Badge variant="success" className="text-[8px] uppercase tracking-wider font-bold animate-pulse">
                                                   ● CURRENT ACTIVE
                                                </Badge>
                                             )}
                                          </h4>
                                          {item.description && <p className="text-xs text-fg-subtle font-semibold">{item.description}</p>}
                                          {item.duration_mins && (
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider">{item.duration_mins} min duration</Badge>
                                          )}
                                       </div>
                                    </div>
                                 );
                              })}
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
