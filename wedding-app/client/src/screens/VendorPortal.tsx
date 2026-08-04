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

import { VendorLogistics } from './vendor/VendorLogistics';
import { VendorTourOverlay } from './vendor/vendorSections/VendorTourOverlay';
import { VendorHeader } from './vendor/vendorSections/VendorHeader';
import { VendorMainBody } from './vendor/vendorSections/VendorMainBody';

// ─── TOUR STEPS FOR THE VENDOR GUIDED WALKTHROUGH ───
interface TourStep {
  title: string;
  description: string;
  targetId: string;
}

function buildTourSteps(venueName: string): TourStep[] {
  return [
  {
    title: `Welcome to ${venueName}!`,
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
    description: `Upon arrival at ${venueName}, present this Digital Gate Pass QR Code to security or the lead planner for a 2-second check-in.`,
    targetId: 'gatepass-card'
  }
];
}

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

function hexToRgbTriplet(hex?: string): string | null {
  if (!hex) return null;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

function brandedPortalStyle(brandColor?: string): React.CSSProperties | undefined {
  const rgb = hexToRgbTriplet(brandColor);
  return rgb ? ({ '--color-brand': rgb } as React.CSSProperties) : undefined;
}

// ─── VENDOR LOGISTICS QUESTIONNAIRE WITH AUTO-SAVE & FILE UPLOAD ───

// ─── MAIN VENDOR PORTAL WRAPPER ───
export function VendorPortal({ vendorId, token }: { vendorId: string; token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [newMessageText, setNewMessageText] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendorPortal', vendorId, token],
    queryFn: () => sdk.vendors.portalInfo(vendorId, token),
    enabled: !!token,
  });

  const portalData = data as any;
  const branding = portalData?.branding || {};
  const venueName = branding.platformName || 'Wedding Venue Intelligence';
  const tourSteps = useMemo(() => buildTourSteps(venueName), [venueName]);

  // Real-Time Collaborative Portal Chat history query
  const { data: messagesData } = useQuery({
    queryKey: ['vendorPortalMessages', vendorId, token],
    queryFn: () => sdk.vendors.portalGetMessages(vendorId, token),
    enabled: !!portalData?.event && !!token,
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
      }, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorPortal', vendorId] });
      toast({ title: 'Task progress synced', variant: 'success' });
    }
  });

  // Hook 6: useMutation for transmitting collaborative messages
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => sdk.vendors.portalSendMessage(vendorId, body, token),
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
    if (tourStep < tourSteps.length - 1) {
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
  const completedChecklist = fullChecklist.filter(item => checkedTasks[item.id]).length;
  const portalCompletionItems = [vendorMetadata.arrivalTime, vendorMetadata.departureTime, vendorMetadata.teamSize, vendorMetadata.coiLink || vendorMetadata.coiReceived, vendorMetadata.coiExpiration || vendorMetadata.coiExpirationDate, completedChecklist >= Math.ceil(fullChecklist.length / 2)];
  const portalCompletionPct = Math.round((portalCompletionItems.filter(Boolean).length / portalCompletionItems.length) * 100);
  const unreadPlannerMessages = messages.filter((m: any) => m.sender_role !== 'vendor' && !m.read_at).length;

  // EARLY RENDERS GO DOWN HERE, STRICTLY AFTER ALL HOOKS
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
         <div className="text-fg font-serif font-bold text-lg animate-pulse">Compiling portal details...</div>
      </div>
    );
  }

  if (error || !data) {
     return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-bg border-2 border-danger/20 rounded-2xl shadow-lg">
           <CardContent className="pt-6 text-center text-danger font-semibold space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-danger" />
              <p>Unable to load secure vendor details. Please verify your direct link or contact the venue administration.</p>
           </CardContent>
        </Card>
      </div>
    );
  }

  const { vendor, event, timeline, layouts } = data as any;
  const approvedLayout = layouts?.find((l: any) => l.approval_status === 'approved') || layouts?.[0];
  const portalStyle = brandedPortalStyle(branding.brandColor);

  return (
    <div className="min-h-screen bg-bg text-fg" style={portalStyle}>
      
      {/* GUIDED TOUR COACHMARK OVERLAY CONTAINER */}
      <VendorTourOverlay tourCompleted={tourCompleted} tourStep={tourStep} tourSteps={tourSteps} handleNextTourStep={handleNextTourStep} handlePrevTourStep={handlePrevTourStep} handleCompleteTour={handleCompleteTour} />

      {/* HEADER SECTION */}
      <VendorHeader setTourCompleted={setTourCompleted} setTourStep={setTourStep} vendor={vendor} event={event} venueName={venueName} />

      {/* MAIN LAYOUT */}
      <VendorMainBody newMessageText={newMessageText} setNewMessageText={setNewMessageText} chatBottomRef={chatBottomRef} data={data} vendor={vendor} event={event} timeline={timeline} messages={messages} layoutItems={layoutItems} activePlan={activePlan} activeTimelineItemId={activeTimelineItemId} currentBroadcast={currentBroadcast} vendorMetadata={vendorMetadata} checkedTasks={checkedTasks} sendMessageMutation={sendMessageMutation} handleSendMessage={handleSendMessage} handleToggleTask={handleToggleTask} fullChecklist={fullChecklist} portalCompletionPct={portalCompletionPct} unreadPlannerMessages={unreadPlannerMessages} approvedLayout={approvedLayout} vendorId={vendorId} token={token} />
    </div>
  );
}

