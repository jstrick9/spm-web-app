import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Accessibility,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  Heart,
  HelpCircle,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { sdk, downloadFile } from '../../sdk';
import { formatDateOnly } from '../../lib/formatDate';
import { venuesSdk } from '../../sdk/venues';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { usePrompt } from '../../ui/usePrompt';
import type { CoupleRequestType } from '../../sdk/couple';

const CouplePostEventCloseout = lazy(() => import('./CouplePostEventCloseout').then((m) => ({ default: m.CouplePostEventCloseout })));
const CoupleReminderCenter = lazy(() => import('./CoupleReminderCenter').then((m) => ({ default: m.CoupleReminderCenter })));
const CoupleAdvancedPlanning = lazy(() => import('./CoupleAdvancedPlanning').then((m) => ({ default: m.CoupleAdvancedPlanning })));


/**
 * Inline per-section load error. The global banner names failed sections;
 * this replaces a section's false "No X yet" empty state with an honest
 * error + retry so the couple never mistakes a network blip for missing data.
 */
function SectionLoadError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft/20 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-warning">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          <strong>{label} couldn’t load.</strong> Check your connection and retry — nothing was changed.
        </p>
        <Button size="xs" variant="outline" onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}

function daysUntil(date?: string | null) {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

function addDays(date?: string | null, offset = 0) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeMetadata(value: unknown): Record<string, any> {
  try { return typeof value === 'string' ? JSON.parse(value) : (value && typeof value === 'object' ? value as Record<string, any> : {}); } catch { return {}; }
}

export function CoupleEventHub({ eventId }: { eventId: string }) {
  const { toast } = useToast();

  /** Authenticated download: plain <a href> cannot send the JWT, so fetch with
   *  the token and hand the Blob to the browser. */
  const downloadAuth = async (url: string, filename?: string) => {
    try {
      await downloadFile(url, { filename });
    } catch (err: any) {
      toast({ title: 'Download failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const qc = useQueryClient();
  const { ask, askForm, askConfirm, promptNode } = usePrompt();
  const { data, isLoading, error } = useQuery({
    queryKey: ['couple-event-hub', eventId],
    queryFn: () => sdk.events.get(eventId),
  });
  const event = data?.event;
  const orgQuery = useQuery({ queryKey: ['couple-org', event?.organization_id], queryFn: () => sdk.orgs.get(event!.organization_id), enabled: !!event?.organization_id });
  const guestsQuery = useQuery({ queryKey: ['couple-guests', eventId], queryFn: () => sdk.couple.guests(eventId), enabled: !!eventId });
  const privacyQuery = useQuery({ queryKey: ['couple-privacy', eventId], queryFn: () => sdk.couple.privacy(eventId), enabled: !!eventId });
  const calendarQuery = useQuery({ queryKey: ['couple-calendar', eventId], queryFn: () => sdk.couple.calendar(eventId), enabled: !!eventId });
  const inboxQuery = useQuery({ queryKey: ['couple-inbox', eventId], queryFn: () => sdk.couple.inbox(eventId), enabled: !!eventId });
  const notificationPrefsQuery = useQuery({ queryKey: ['couple-notification-preferences', eventId], queryFn: () => sdk.couple.notificationPreferences(eventId), enabled: !!eventId });
  const documentsQuery = useQuery({ queryKey: ['couple-documents', eventId], queryFn: () => sdk.couple.documents(eventId), enabled: !!eventId });
  const designQuery = useQuery({ queryKey: ['couple-design', eventId], queryFn: () => sdk.couple.design(eventId), enabled: !!eventId });
  const financeQuery = useQuery({ queryKey: ['couple-finance', eventId], queryFn: () => sdk.couple.finance(eventId), enabled: !!eventId });
  const timelineQuery = useQuery({ queryKey: ['couple-timeline', eventId], queryFn: async () => { const response = await sdk.timeline.coupleSchedule(eventId); return { items: response.schedule.map((item) => ({ ...item, startsAt: item.starts_at, endsAt: item.ends_at })) }; }, enabled: !!eventId });
  const dayOfContactQuery = useQuery({ queryKey: ['day-of-contact', eventId], queryFn: () => sdk.events.dayOfContact(eventId), enabled: !!eventId });
  const coupleUpdatesQuery = useQuery({ queryKey: ['couple-event-updates', eventId], queryFn: () => sdk.events.coupleUpdates(eventId), enabled: !!eventId });
  const acknowledgeUpdateMutation = useMutation({ mutationFn: (updateId: string) => sdk.events.acknowledgeCoupleUpdate(eventId, updateId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-event-updates', eventId] }); toast({ title: 'Update acknowledged', variant: 'success' }); } });
  const venueTemplatesQuery = useQuery({ queryKey: ['couple-venue-templates', eventId], queryFn: () => venuesSdk.eventTemplates(eventId), enabled: !!eventId });
  const finalReviewChangesQuery = useQuery({ queryKey: ['couple-final-review-changes', eventId], queryFn: () => sdk.events.finalReviewChangeRequests(eventId), enabled: !!eventId && event?.status === 'final_review' });
  const finalReviewChangeMutation = useMutation({ mutationFn: (detail: string) => sdk.events.requestFinalReviewChange(eventId, detail), onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-final-review-changes', eventId] }); toast({ title: 'Final Review change request sent', description: 'Your venue manager will make the final decision.', variant: 'success' }); }, onError: (err: any) => toast({ title: 'Could not send change request', description: err?.message || 'Please try again.', variant: 'destructive' }) });
  const layoutsQuery = useQuery({ queryKey: ['couple-layouts', event?.organization_id, eventId], queryFn: () => sdk.layouts.list(event!.organization_id, { eventId }), enabled: !!event?.organization_id });
  const requestsQuery = useQuery({ queryKey: ['couple-requests', eventId], queryFn: () => sdk.couple.listRequests(eventId), enabled: !!eventId });
  const profileQuery = useQuery({ queryKey: ['couple-profile', eventId], queryFn: () => sdk.couple.getProfile(eventId), enabled: !!eventId });
  const planningQuery = useQuery({ queryKey: ['couple-planning', eventId], queryFn: () => sdk.couple.planning(eventId), enabled: !!eventId });
  const guestPortalQuery = useQuery({ queryKey: ['couple-guest-portal', eventId], queryFn: () => sdk.couple.guestPortal(eventId), enabled: !!eventId });
  const coupleTimelineQuery = useQuery({ queryKey: ['couple-timeline-review', eventId], queryFn: () => sdk.couple.timeline(eventId), enabled: !!eventId });
  const coupleLayoutQuery = useQuery({ queryKey: ['couple-layout-review', eventId], queryFn: () => sdk.couple.layout(eventId), enabled: !!eventId });
  const coupleVendorsQuery = useQuery({ queryKey: ['couple-vendor-board', eventId], queryFn: () => sdk.couple.vendors(eventId), enabled: !!eventId });

  // Honest section states: if one of the ~20 parallel section queries
  // fails (transient network blip, server hiccup), the hub used to render
  // "No X yet" as if the data simply didn't exist. Track failures so we
  // can surface exactly which sections failed and retry them.
  const sectionQueries: Array<{ label: string; query: { isError: boolean; refetch: () => unknown } }> = [
    { label: 'guest list', query: guestsQuery },
    { label: 'calendar', query: calendarQuery },
    { label: 'inbox', query: inboxQuery },
    { label: 'documents', query: documentsQuery },
    { label: 'design preferences', query: designQuery },
    { label: 'finance', query: financeQuery },
    { label: 'timeline', query: timelineQuery },
    { label: 'requests', query: requestsQuery },
    { label: 'planning', query: planningQuery },
    { label: 'guest portal', query: guestPortalQuery },
    { label: 'vendor board', query: coupleVendorsQuery },
    { label: 'layout review', query: coupleLayoutQuery },
    { label: 'event updates', query: coupleUpdatesQuery },
    { label: 'day-of contact', query: dayOfContactQuery },
  ];
  const failedSections = sectionQueries.filter((s) => s.query.isError);

  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});
  const [guestDraft, setGuestDraft] = useState<Record<string, string>>({ fullName: '', email: '', householdName: '' });
  const [importCsv, setImportCsv] = useState('fullName,email,phone,householdName,mailingAddress,rsvpStatus,mealChoice\nJane Guest,jane@example.com,555-0100,Smith Family,1 Main St,pending,Chicken');
  const [portalDraft, setPortalDraft] = useState<Record<string, string>>({ welcomeMessage: '', dressCode: '', parkingText: '', shuttleText: '', lodgingText: '', registryLinks: '', kidsPolicy: '', plusOneRules: '', accessibilityNotes: '', guestFaq: '', subEventInstructions: '', travelConcierge: '', language: 'en' });
  const [designDraft, setDesignDraft] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentFileError, setDocumentFileError] = useState<string | null>(null);
  const MAX_DOC_BYTES = 8 * 1024 * 1024;
  const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  const handleDocumentFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentFileError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      setDocumentFileError('Use a PDF, JPG, PNG, or WebP file.');
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setDocumentFileError('Files must be under 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentDraft((p) => ({
        ...p,
        filename: file.name,
        mimeType: file.type,
        dataUri: String(reader.result),
      }));
    };
    reader.onerror = () => setDocumentFileError('Could not read that file. Try again.');
    reader.readAsDataURL(file);
  };

  const uploadChosenDocument = () => {
    if (!documentDraft.dataUri || !documentDraft.filename) return;
    documentUploadMutation.mutate({ filename: documentDraft.filename, dataUri: documentDraft.dataUri, mimeType: documentDraft.mimeType || 'application/pdf' });
  };

  const useSampleDocument = () => {
    setDocumentFileError(null);
    setDocumentDraft((p) => ({ ...p, filename: 'sample-document.pdf', mimeType: 'application/pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==' }));
  };
  const [documentDraft, setDocumentDraft] = useState<Record<string, string>>({ filename: 'wedding-menu.pdf', category: 'menu', visibility: 'couple_venue', notes: 'Menu notes for venue review' });
  const [messageDraft, setMessageDraft] = useState('');
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);
  const [largeTextMode, setLargeTextMode] = useState(() => { try { return localStorage.getItem('wvi_couple_large_text') === 'true'; } catch { return false; } });
  const [accessibilityMode, setAccessibilityMode] = useState(() => { try { return localStorage.getItem('wvi_couple_accessibility_mode') === 'true'; } catch { return false; } });
  const [accessibilityRequest, setAccessibilityRequest] = useState('');
  useEffect(() => { setProfileDraft((profileQuery.data?.profile ?? {}) as Record<string, string>); }, [profileQuery.data?.profile]);
  useEffect(() => { setPortalDraft((p) => ({ ...p, ...(guestPortalQuery.data?.portal.config ?? {}) })); }, [guestPortalQuery.data?.portal.config]);
  useEffect(() => { setDesignDraft((designQuery.data?.preferences ?? {}) as Record<string, string>); }, [designQuery.data?.preferences]);
  useEffect(() => { try { localStorage.setItem('wvi_couple_large_text', String(largeTextMode)); } catch {} }, [largeTextMode]);
  useEffect(() => { try { localStorage.setItem('wvi_couple_accessibility_mode', String(accessibilityMode)); } catch {} }, [accessibilityMode]);
  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsavedDraft]);
  const profileMutation = useMutation({
    mutationFn: () => sdk.couple.updateProfile(eventId, profileDraft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-profile', eventId] }); toast({ title: 'Wedding profile saved', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not save profile', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const requestMutation = useMutation({
    mutationFn: (input: { requestType: CoupleRequestType; targetEmail?: string; targetName?: string; note?: string; metadata?: Record<string, unknown> }) => sdk.couple.createRequest(eventId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-requests', eventId] }); toast({ title: 'Request sent to venue', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not send request', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const planningMutation = useMutation({
    mutationFn: (input: { taskId: string; patch: any }) => sdk.couple.updatePlanningTask(eventId, input.taskId, input.patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-planning', eventId] }); toast({ title: 'Planning checklist updated', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not update checklist', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const guestMutation = useMutation({
    mutationFn: () => sdk.couple.createGuest(eventId, { fullName: guestDraft.fullName, email: guestDraft.email, phone: guestDraft.phone, householdName: guestDraft.householdName, mailingAddress: guestDraft.mailingAddress, mealChoice: guestDraft.mealChoice, rsvpStatus: (guestDraft.rsvpStatus as any) || 'pending', notes: guestDraft.notes, tags: (guestDraft.tags || '').split(',').map((t) => t.trim()).filter(Boolean) as any }),
    onSuccess: () => { setGuestDraft({ fullName: '', email: '', householdName: '' }); qc.invalidateQueries({ queryKey: ['couple-guests', eventId] }); toast({ title: 'Guest added', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not add guest', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const importPreviewMutation = useMutation({
    mutationFn: () => sdk.couple.importPreview(eventId, importCsv),
  });
  const importGuestsMutation = useMutation({
    mutationFn: () => sdk.couple.importGuests(eventId, importCsv),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['couple-guests', eventId] });
      toast({
        title: result.imported > 0 ? `${result.imported} guests imported` : 'No new guests imported',
        description: result.skipped > 0 ? `${result.skipped} row(s) skipped (duplicates or missing names).` : 'Your guest list is up to date.',
        variant: 'success',
      });
    },
    onError: (err: any) => toast({ title: 'Could not import guests', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const portalUpdateMutation = useMutation({
    mutationFn: () => sdk.couple.requestGuestPortalUpdate(eventId, { config: portalDraft, note: 'Couple requested guest RSVP portal content updates before launch.' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-guest-portal', eventId] }); qc.invalidateQueries({ queryKey: ['couple-requests', eventId] }); toast({ title: 'Guest portal update sent for venue approval', variant: 'success' }); },
  });
  const reminderMutation = useMutation({
    mutationFn: () => sdk.couple.requestRsvpReminder(eventId, { audience: 'not_responded', messagePreview: `Reminder: please RSVP for ${event?.title || 'our wedding'} by the RSVP deadline. Meal, dietary, and accessibility notes help us take care of every guest.` }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-guest-portal', eventId] }); toast({ title: 'RSVP reminder request sent for approval', variant: 'success' }); },
  });
  const timelineApprovalMutation = useMutation({
    mutationFn: (status: 'approved' | 'changes_requested') => sdk.couple.setTimelineApproval(eventId, { status, note: status === 'approved' ? 'Approved by couple from wedding hub.' : 'Couple requested timeline changes from wedding hub.' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-timeline-review', eventId] }); toast({ title: 'Timeline response sent', variant: 'success' }); },
  });
  const layoutApprovalMutation = useMutation({
    mutationFn: (status: 'approved' | 'changes_requested') => sdk.couple.setLayoutApproval(eventId, { status, note: status === 'approved' ? 'Approved by couple from wedding hub.' : 'Couple requested layout changes from wedding hub.' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-layout-review', eventId] }); toast({ title: 'Floor plan response sent', variant: 'success' }); },
  });
  const appointmentMutation = useMutation({ 
    mutationFn: (input: { appointmentType: 'tasting' | 'planning_meeting' | 'final_walkthrough' | 'rehearsal' | 'payment' | 'tour' | 'other'; note?: string }) => sdk.couple.requestAppointment(eventId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-calendar', eventId] }); toast({ title: 'Appointment request sent', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not request appointment', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const appointmentStatusMutation = useMutation({
    mutationFn: (input: { id: string; status: 'reschedule_requested' | 'cancel_requested' | 'completed' | 'cancelled' | 'confirmed'; note?: string }) => sdk.couple.updateAppointment(eventId, input.id, { status: input.status, note: input.note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-calendar', eventId] }); toast({ title: 'Appointment updated', variant: 'success' }); },
    onError: (err: any) => toast({
      title: 'Could not update appointment',
      description: err?.code === 'appointment-time-conflict'
        ? 'That time overlaps another meeting on your calendar. Choose a different time.'
        : err?.message || 'Please try again.',
      variant: 'destructive',
    }),
  });
  const appointmentSignoffMutation = useMutation({
    mutationFn: (id: string) => sdk.couple.signoffAppointment(eventId, id, 'Final walkthrough completed by couple.'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-calendar', eventId] }); toast({ title: 'Walkthrough signed off', variant: 'success' }); },
  });
  const inboxMessageMutation = useMutation({ 
    mutationFn: (input: { threadType?: 'venue' | 'planner' | 'urgent' | 'decision'; body: string; urgency?: 'normal' | 'urgent' }) => sdk.couple.sendInboxMessage(eventId, input),
    onSuccess: () => { setMessageDraft(''); qc.invalidateQueries({ queryKey: ['couple-inbox', eventId] }); toast({ title: 'Message sent', variant: 'success' }); },
  });
  const decisionMutation = useMutation({
    mutationFn: (input: { title: string; detail?: string }) => sdk.couple.createDecision(eventId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-inbox', eventId] }); toast({ title: 'Decision thread created', variant: 'success' }); },
  });
  const notificationPrefsMutation = useMutation({
    mutationFn: () => sdk.couple.updateNotificationPreferences(eventId, { digestFrequency: notificationPrefsQuery.data?.preferences.digest_frequency === 'instant' ? 'daily' : 'instant', messageAlerts: true, decisionAlerts: true, dueTaskAlerts: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-notification-preferences', eventId] }); toast({ title: 'Notification preferences saved', variant: 'success' }); },
  });
  const documentUploadMutation = useMutation({ 
    mutationFn: (input: { filename: string; dataUri: string; mimeType: string }) => sdk.couple.uploadDocument(eventId, { filename: input.filename, dataUri: input.dataUri, mimeType: input.mimeType, category: (documentDraft.category as any) || 'other', visibility: (documentDraft.visibility as any) || 'couple_venue', notes: documentDraft.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-documents', eventId] }); toast({ title: 'Document uploaded for venue review', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not upload document', description: err?.message || 'Use a PDF/JPG/PNG/WebP under 8 MB.', variant: 'destructive' }),
  });
  const documentDeleteMutation = useMutation({
    mutationFn: (documentId: string) => sdk.couple.deleteDocument(eventId, documentId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-documents', eventId] }); toast({ title: 'Document removed', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not remove document', description: e.message, variant: 'destructive' }),
  });
  const designMutation = useMutation({
    mutationFn: () => sdk.couple.saveDesign(eventId, designDraft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-design', eventId] }); toast({ title: 'Design preferences saved as draft', variant: 'success' }); },
    onError: (err: any) => toast({ title: 'Could not save design preferences', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });
  const designReviewMutation = useMutation({
    mutationFn: () => sdk.couple.submitDesignReview(eventId, 'Couple submitted design, menu, ceremony, VIP, and mood-board preferences for venue review.'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-design', eventId] }); qc.invalidateQueries({ queryKey: ['couple-requests', eventId] }); toast({ title: 'Design preferences sent for venue review', variant: 'success' }); },
  });
  const financeQuestionMutation = useMutation({
    mutationFn: (question: string) => sdk.couple.askFinanceQuestion(eventId, { question }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-finance', eventId] }); toast({ title: 'Finance question sent to venue', variant: 'success' }); },
  });
  const changeOrderMutation = useMutation({
    mutationFn: (input: { changeType: 'extra_hour' | 'room_block' | 'ceremony_upgrade' | 'bar_package' | 'rental_upgrade' | 'other'; label: string; estimatedAmountCents?: number; note?: string }) => sdk.couple.requestChangeOrder(eventId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-finance', eventId] }); toast({ title: 'Change order request sent', variant: 'success' }); },
  });
  const signContractMutation = useMutation({
    mutationFn: (input: { contractId: string; signature: string }) => sdk.couple.signContract(eventId, input.contractId, input.signature),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-finance', eventId] }); toast({ title: 'Contract signed', variant: 'success' }); },
  });
  const vendorRequestMutation = useMutation({
    mutationFn: (input: { category: string; note?: string; preferredVendorId?: string }) => sdk.couple.requestVendor(eventId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-vendor-board', eventId] }); toast({ title: 'Vendor request sent to venue', variant: 'success' }); },
  });
  const plannerCollabMutation = useMutation({
    mutationFn: (input: { plannerName?: string; plannerEmail?: string; note?: string }) => sdk.couple.requestPlannerCollaboration(eventId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-vendor-board', eventId] }); toast({ title: 'Planner collaboration request sent', variant: 'success' }); },
  });

  const countdown = daysUntil(event?.start_date);
  const metadata = useMemo(() => safeMetadata(event?.metadata), [event?.metadata]);
  const orgSettings = useMemo(() => safeMetadata(orgQuery.data?.organization?.settings), [orgQuery.data?.organization?.settings]);
  const venueName = orgQuery.data?.organization?.name || metadata.venueName || 'Your venue';
  const ceremonySpace = metadata.ceremonySpace || metadata.ceremony_space || 'Ceremony space pending venue confirmation';
  const receptionSpace = metadata.receptionSpace || metadata.reception_space || 'Reception space pending venue confirmation';
  const ceremonyTime = metadata.ceremonyTime || metadata.ceremony_time || metadata.ceremonyStartsAt || 'Ceremony time TBD';
  const receptionTime = metadata.receptionTime || metadata.reception_time || metadata.receptionStartsAt || 'Reception time TBD';
  const venueContact = metadata.venueContactName || metadata.coordinatorName || 'Venue coordinator';
  const venueContactEmail = metadata.venueContactEmail || metadata.coordinatorEmail || orgSettings.supportEmail;
  const plannerContact = metadata.plannerName || metadata.plannerContactName || 'Planner not added yet';
  const emergencyContact = metadata.eventWeekContact || metadata.emergencyContact || 'Event-week contact will appear closer to the wedding';
  const rsvpDeadline = (event as any)?.rsvp_deadline || metadata.rsvpDeadline || addDays(event?.start_date, -30);

  const planningTasks = planningQuery.data?.tasks ?? [];
  const overduePlanning = planningTasks.filter((task) => task.isOverdue);
  const upcomingPlanning = planningTasks.filter((task) => task.isUpcoming);
  const completedPlanning = planningTasks.filter((task) => task.status === 'completed').length;
  const decisionTasks = planningTasks.filter((task) => task.decisionCategory);
  const requests = requestsQuery.data?.requests ?? [];
  const identityVerified = requests.some((r) => r.requestType === 'identity_verification' && r.status === 'approved');
  const pendingVenueQuestion = requests.find((r) => r.requestType === 'venue_question' && r.status === 'pending');
  const pendingChangeRequests = requests.filter((r) => r.requestType === 'event_change_request' && r.status === 'pending');
  const partnerRequest = requests.find((r) => r.requestType === 'partner_invite' && ['pending', 'approved'].includes(r.status));
  const plannerRequest = requests.find((r) => r.requestType === 'planner_request' && ['pending', 'approved'].includes(r.status));
  const accountRecoveryRequest = requests.find((r) => r.requestType === 'account_recovery' && ['pending', 'approved'].includes(r.status));
  const guestPortalUpdateRequest = requests.find((r) => r.requestType === 'guest_portal_update' && ['pending', 'approved'].includes(r.status));
  const rsvpReminderRequest = requests.find((r) => r.requestType === 'rsvp_reminder_request' && ['pending', 'approved'].includes(r.status));

  const guests = guestsQuery.data?.guests ?? [];
  const guestCounts = guestsQuery.data?.counts;
  const totalGuests = guestCounts ? guestCounts.pending + guestCounts.attending + guestCounts.declined + guestCounts.maybe : event?.guest_count || 0;
  const rsvpResolved = guestCounts ? guestCounts.attending + guestCounts.declined + guestCounts.maybe : 0;
  const planningFocus = [
    !layoutsQuery.data?.layouts?.length ? 'Choose a venue-approved starting layout' : null,
    planningTasks.find((task) => task.status !== 'completed')?.title || null,
    guestCounts?.pending ? `Follow up with ${guestCounts.pending} guest${guestCounts.pending === 1 ? '' : 's'} who have not responded` : null,
  ].filter(Boolean).slice(0, 3) as string[];

  const rsvpPct = totalGuests ? Math.round((rsvpResolved / totalGuests) * 100) : 0;
  const missingGuestContactCount = guests.filter((g: any) => !g.email && !g.phone).length;
  const missingAddressesCount = guests.filter((g: any) => !g.mailingAddress).length;

  const contracts = financeQuery.data?.contracts ?? [];
  const signedContracts = contracts.filter((c) => c.status === 'signed').length;
  const openContracts = contracts.filter((c) => c.status !== 'signed').length;
  const balanceCents = financeQuery.data?.totals.openBalanceCents ?? 0;
  const paidCents = financeQuery.data?.totals.paidCents ?? 0;
  const timelineItems = timelineQuery.data?.items ?? [];
  const layouts = layoutsQuery.data?.layouts ?? [];
  const approvedLayout = layouts.some((l: any) => l.approval_status === 'approved');

  const milestones = [
    { id: 'contract', label: 'Contract signed', due: addDays(event?.start_date, -180), done: signedContracts > 0 || contracts.length === 0, owner: 'Couple + venue' },
    { id: 'deposit', label: 'Deposit/payment schedule reviewed', due: addDays(event?.start_date, -150), done: balanceCents === 0 || paidCents > 0, owner: 'Couple' },
    { id: 'guest-list', label: 'Guest list started', due: addDays(event?.start_date, -120), done: totalGuests > 0, owner: 'Couple' },
    { id: 'rsvp', label: 'RSVP deadline', due: rsvpDeadline, done: rsvpPct >= 85, owner: 'Guests + couple' },
    { id: 'menu', label: 'Menu/tasting decisions', due: addDays(event?.start_date, -75), done: Boolean(metadata.menuApproved || metadata.tastingCompleted), owner: 'Couple + venue' },
    { id: 'layout', label: 'Floor plan reviewed', due: addDays(event?.start_date, -45), done: approvedLayout, owner: 'Venue + couple' },
    { id: 'timeline', label: 'Timeline reviewed', due: addDays(event?.start_date, -30), done: timelineItems.length >= 5, owner: 'Venue + planner' },
    { id: 'final-payment', label: 'Final payment', due: addDays(event?.start_date, -21), done: identityVerified && balanceCents === 0, owner: 'Couple' },
    { id: 'walkthrough', label: 'Final walkthrough', due: addDays(event?.start_date, -14), done: Boolean(metadata.finalWalkthroughCompleted), owner: 'Couple + venue' },
    { id: 'rehearsal', label: 'Ceremony rehearsal', due: addDays(event?.start_date, -1), done: Boolean(metadata.rehearsalConfirmed), owner: 'Couple + venue' },
    { id: 'wedding-day', label: 'Wedding day', due: event?.start_date || null, done: false, owner: 'Everyone' },
  ];
  const completedMilestones = milestones.filter((m) => m.done).length;

  const attentionCards = [
    ...(openContracts > 0 ? [{ title: 'Unsigned contract or document', detail: `${openContracts} item(s) still need review/signature.`, severity: 'warning' as const }] : []),
    ...(identityVerified && balanceCents > 0 ? [{ title: 'Open payment balance', detail: `${money(balanceCents)} estimated remaining balance.`, severity: 'warning' as const }] : []),
    ...(!identityVerified ? [{ title: 'Verify identity for private documents', detail: 'Contract and payment details unlock after venue verification.', severity: 'info' as const }] : []),
    ...(missingGuestContactCount > 0 ? [{ title: 'Guest contact info missing', detail: `${missingGuestContactCount} guest(s) are missing email/phone for reminders.`, severity: 'info' as const }] : []),
    ...(missingAddressesCount > 0 ? [{ title: 'Guest mailing addresses incomplete', detail: `${missingAddressesCount} guest(s) may need mailing addresses.`, severity: 'info' as const }] : []),
    ...(rsvpDeadline && daysUntil(rsvpDeadline) !== null && daysUntil(rsvpDeadline)! <= 14 && rsvpPct < 85 ? [{ title: 'RSVP deadline approaching', detail: `${rsvpPct}% responses received; deadline ${formatDateOnly(rsvpDeadline)}.`, severity: 'warning' as const }] : []),
    ...(!approvedLayout ? [{ title: 'Floor plan needs review', detail: 'The venue has not marked a floor plan approved yet.', severity: 'info' as const }] : []),
    ...(timelineItems.length < 5 ? [{ title: 'Timeline still taking shape', detail: 'The venue/planner is still building the schedule milestones.', severity: 'info' as const }] : []),
    ...(overduePlanning.length > 0 ? [{ title: 'Planning checklist overdue', detail: `${overduePlanning.length} planning task(s) need attention.`, severity: 'warning' as const }] : []),
    ...(upcomingPlanning.length > 0 ? [{ title: 'Planning deadline coming up', detail: `${upcomingPlanning.length} task(s) are due in the next 14 days.`, severity: 'info' as const }] : []),
    ...(pendingVenueQuestion ? [{ title: 'Venue question pending', detail: 'Your latest question is waiting on venue response.', severity: 'info' as const }] : []),
  ].slice(0, 5);

  const venueWorkingOn = [
    approvedLayout ? 'Approved floor plan is available for review.' : 'Venue is preparing or approving the floor plan.',
    timelineItems.length >= 5 ? 'Timeline milestones are drafted for couple review.' : 'Venue/planner is building the wedding day schedule.',
    rsvpPct >= 85 ? 'RSVP progress looks strong.' : 'Venue is monitoring RSVP readiness and guest details.',
    openContracts === 0 ? 'Documents currently look clear.' : 'Venue is waiting on document/signature progress.',
  ];

  const profileFields = ['coupleNames','pronouns','primaryPhone','mailingAddress','plannerName','vipFamilyContacts'];
  const profileComplete = Math.round((profileFields.filter((key) => String(profileDraft[key] || '').trim()).length / profileFields.length) * 100);
  const planningProgress = planningTasks.length ? Math.round((completedPlanning / planningTasks.length) * 100) : 0;
  const readiness = Math.round(((completedMilestones / milestones.length) * 45) + (Math.min(100, rsvpPct) * 0.18) + (profileComplete * 0.12) + (planningProgress * 0.15) + (approvedLayout ? 7 : 0) + (timelineItems.length >= 5 ? 3 : 0));
  // If any score source failed to load, show '—' instead of a misleading 0%.
  const readinessQueryFailed = guestsQuery.isError || planningQuery.isError || profileQuery.isError || timelineQuery.isError || coupleLayoutQuery.isError;
  const checklist = milestones.slice(0, 5).map((m) => ({ label: m.label, done: m.done }));
  const completedCount = checklist.filter((item) => item.done).length;
  const confidence = Math.max(readiness, Math.round((completedCount / checklist.length) * 100));
  const nextThree = milestones.filter((item) => !item.done).slice(0, 3).map((m) => ({ label: m.label, done: m.done }));
  const aiGuidance = [
    attentionCards[0]?.title ? `First, handle: ${attentionCards[0].title.toLowerCase()}.` : 'First, review your wedding details and confirm everything still looks right.',
    nextThree[0]?.label ? `Next, ${nextThree[0].label.toLowerCase()}.` : 'Next, preview what guests can see in the RSVP portal.',
    pendingVenueQuestion ? 'Your venue question is already pending; avoid sending duplicates unless details changed.' : 'If anything looks wrong, ask the venue from this dashboard so the request is tracked.',
  ];

  const promptRequest = async (requestType: 'partner_invite' | 'planner_request' | 'account_recovery') => {
    let targetEmail: string | undefined;
    let note: string | undefined;
    if (requestType === 'account_recovery') {
      const values = await askForm({ title: 'Request account recovery', fields: [{ key: 'note', label: 'What happened?', multiline: true }] });
      if (!values) return;
      note = values.note || undefined;
    } else {
      const values = await askForm({
        title: requestType === 'partner_invite' ? 'Invite your partner' : 'Request a planner',
        fields: [
          { key: 'email', label: 'Email address', required: true, placeholder: requestType === 'partner_invite' ? 'partner@example.com' : 'planner@example.com' },
          { key: 'note', label: 'Optional note for the venue', multiline: true },
        ],
      });
      if (!values) return;
      targetEmail = values.email || undefined;
      note = values.note || undefined;
    }
    requestMutation.mutate({ requestType, targetEmail, note });
  };

  const askVenue = async () => {
    const note = await ask({ title: 'Ask the venue', label: 'Your question', multiline: true, required: true });
    if (!note) return;
    requestMutation.mutate({ requestType: 'venue_question', note, metadata: { source: 'couple_dashboard' } });
  };

  const requestEventChange = async (field: string, currentValue: string) => {
    const values = await askForm({
      title: `Update ${field}`,
      fields: [
        { key: 'value', label: `New value for ${field}`, defaultValue: currentValue || '', required: true },
        { key: 'note', label: 'Why are you requesting this change?', multiline: true },
      ],
    });
    if (!values || values.value === currentValue) return;
    requestMutation.mutate({ requestType: 'event_change_request', note: values.note || undefined, metadata: { field, currentValue, requestedValue: values.value, source: 'couple_event_overview' } });
  };

  const submitIdentityCheck = () => {
    requestMutation.mutate({ requestType: 'identity_verification', note: 'Couple requested verification for contract/payment access.', metadata: { confirmedEventTitle: event?.title, confirmedWeddingDate: event?.start_date } });
  };

  const submitAccessibilityNeed = () => {
    if (!accessibilityRequest.trim()) return;
    requestMutation.mutate({ requestType: 'venue_question', note: accessibilityRequest, metadata: { source: 'couple_accessibility_center', kind: 'guest_accessibility_request' } });
    setAccessibilityRequest('');
  };

  const saveOfflineInfoCard = () => {
    const card = {
      eventId,
      title: event?.title,
      weddingDate: event?.start_date,
      venueName,
      ceremonyTime,
      receptionTime,
      ceremonySpace,
      receptionSpace,
      venueContact,
      venueContactEmail,
      plannerContact,
      emergencyContact,
      guestPortal: `#/portal/${eventId}`,
      savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(`wvi_couple_offline_card_${eventId}`, JSON.stringify(card)); } catch {}
    const text = Object.entries(card).map(([key, value]) => `${key}: ${value ?? ''}`).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-wedding-info-${eventId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Offline wedding info card saved', description: 'A copy was saved to this device and downloaded.', variant: 'success' });
  };

  const downloadSummary = () => {
    if (!event) return;
    const summary = [
      `${event.title} — Wedding Summary`,
      `Venue: ${venueName}`,
      `Date: ${formatDateOnly(event.start_date)}`,
      `Ceremony: ${ceremonyTime} · ${ceremonySpace}`,
      `Reception: ${receptionTime} · ${receptionSpace}`,
      `Guests: ${totalGuests || 'TBD'} · RSVP ${rsvpPct}%`,
      `Readiness: ${readiness}%`,
      `Planning checklist: ${completedPlanning}/${planningTasks.length || 0} complete`,
      '',
      'Next steps:',
      ...nextThree.map((step, i) => `${i + 1}. ${step.label}`),
      '',
      'Venue working on:',
      ...venueWorkingOn.map((item) => `- ${item}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wedding-summary-${event.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestVendorRecommendation = async () => {
    const values = await askForm({
      title: 'Request a vendor recommendation',
      fields: [
        { key: 'category', label: 'What category do you need?', required: true, placeholder: 'e.g., florist, photographer, DJ' },
        { key: 'note', label: 'Optional details for the venue', multiline: true },
      ],
    });
    if (!values) return;
    vendorRequestMutation.mutate({ category: values.category, note: values.note || undefined });
  };

  const askVendorQuestion = async (vendorId?: string) => {
    const question = await ask({ title: 'Ask the venue about this vendor', label: 'Your question', multiline: true, required: true });
    if (!question) return;
    await sdk.couple.askVendorQuestion(eventId, { vendorId, question });
    qc.invalidateQueries({ queryKey: ['couple-vendor-board', eventId] });
    toast({ title: 'Vendor question sent to venue', variant: 'success' });
  };

  const requestPlannerCollaboration = async () => {
    const values = await askForm({
      title: 'Connect with a planner',
      fields: [
        { key: 'email', label: 'Planner/coordinator email address', required: true },
        { key: 'name', label: 'Planner/coordinator name', defaultValue: coupleVendorsQuery.data?.planner.name || '' },
        { key: 'note', label: 'Optional note for the venue', multiline: true },
      ],
    });
    if (!values) return;
    plannerCollabMutation.mutate({ plannerName: values.name || undefined, plannerEmail: values.email || undefined, note: values.note || undefined });
  };

  const requestLayoutComment = async (areaLabel?: string, x?: number, y?: number) => {
    const note = await ask({ title: areaLabel ? `Comment for ${areaLabel}` : 'Floor plan change request', label: 'Your comment or request', multiline: true, required: true });
    if (!note) return;
    await sdk.couple.addLayoutComment(eventId, { areaLabel, x, y, note });
    qc.invalidateQueries({ queryKey: ['couple-layout-review', eventId] });
    toast({ title: 'Floor plan comment sent', variant: 'success' });
  };

  const updateFirstUnseatedGuest = async () => {
    const guest = coupleLayoutQuery.data?.seating.unseatedGuests?.[0];
    if (!guest) return toast({ title: 'No unseated guests found', variant: 'success' });
    const tableAssignment = await ask({ title: `Assign a table for ${guest.fullName}`, label: 'Table assignment', defaultValue: guest.tableAssignment || 'Table 1', required: true });
    if (!tableAssignment) return;
    await sdk.couple.updateSeating(eventId, guest.id, { tableAssignment, note: 'Assigned from couple floor plan review' });
    qc.invalidateQueries({ queryKey: ['couple-layout-review', eventId] });
    qc.invalidateQueries({ queryKey: ['couple-guests', eventId] });
    toast({ title: 'Seating updated', variant: 'success' });
  };

  const requestTimelineChange = async (timelineItemId?: string) => {
    const values = await askForm({
      title: 'Request a timeline change',
      fields: [
        { key: 'change', label: 'What change would you like to request?', multiline: true, required: true },
        { key: 'reason', label: 'Optional reason for the venue/planner', multiline: true },
      ],
    });
    if (!values) return;
    const { requestedChange, reason } = { requestedChange: values.change, reason: values.reason || undefined };
    await sdk.couple.requestTimelineChange(eventId, { timelineItemId, requestedChange, reason });
    qc.invalidateQueries({ queryKey: ['couple-timeline-review', eventId] });
    toast({ title: 'Timeline change request sent', variant: 'success' });
  };

  const generateFirstGuestLink = async () => {
    const first = guests[0] as any;
    if (!first?.id) {
      toast({ title: 'Add a guest first', description: 'Secure guest links are generated per guest.', variant: 'destructive' });
      return;
    }
    const link = await sdk.couple.generateGuestPortalLink(eventId, first.id);
    await navigator.clipboard?.writeText(link.url);
    toast({ title: 'Secure guest link copied', description: 'A tokenized link for the first guest was copied.', variant: 'success' });
  };

  const shareSummary = async () => {
    const text = `${event?.title} wedding hub: ${event?.start_date || 'date TBD'}, RSVP ${rsvpPct}%, readiness ${readiness}%.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Wedding summary', text, url: window.location.href });
      else await navigator.clipboard?.writeText(text);
      toast({ title: 'Wedding summary ready to share', variant: 'success' });
    } catch { /* user cancelled */ }
  };

  if (isLoading) return <PageBody><Card><CardContent className="space-y-3 pt-6"><p className="font-semibold text-brand">Opening your private wedding hub…</p><p className="text-sm text-fg-muted">Loading your wedding details, guest list, checklist, documents, messages, and appointments.</p><Skeleton className="h-40 w-full" /></CardContent></Card></PageBody>;
  const requestAppointment = async (appointmentType: 'tasting' | 'planning_meeting' | 'final_walkthrough' | 'rehearsal' | 'payment' | 'tour' | 'other') => {
    const note = await ask({ title: 'Request an appointment', label: 'Preferred dates/times or notes for the venue', multiline: true });
    if (note == null) return;
    appointmentMutation.mutate({ appointmentType, note: note || undefined });
  };

  const requestDecision = async () => {
    const values = await askForm({
      title: 'Decision needed',
      fields: [
        { key: 'title', label: 'Decision title', required: true },
        { key: 'detail', label: 'Details (optional)', multiline: true },
      ],
      confirmLabel: 'Create decision',
    });
    if (!values) return;
    decisionMutation.mutate({ title: values.title, detail: values.detail || undefined });
  };

  if (error || !event) return <PageBody><Card><CardContent className="space-y-2 pt-6 text-sm"><p className="font-semibold text-danger">We could not open this wedding hub.</p><p className="text-fg-muted">Check your invitation link, sign in with the email your venue invited, or contact the venue coordinator for a new link.</p><Button asChild size="sm" variant="outline"><a href="#/">Back to sign in</a></Button></CardContent></Card></PageBody>;

  return (
    <>
      {promptNode}
      <PageHeader
        title="Your wedding hub"
        description="A private, client-safe planning home for your booked wedding."
        actions={<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={shareSummary}><Share2 className="h-4 w-4" /> Share</Button><Button size="sm" variant="outline" onClick={downloadSummary}><Download className="h-4 w-4" /> Save summary</Button><Badge variant="success">Couple access</Badge></div>}
      />
      <PageBody>
        {failedSections.length > 0 && (
          <div role="alert" className="mb-5 rounded-lg border border-warning/40 bg-warning-soft/20 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <strong className="text-warning">Some parts of your hub couldn’t load</strong>
                <p className="mt-1 text-xs text-fg-muted">
                  We couldn’t reach the server for: {failedSections.map((s) => s.label).join(', ')}. Nothing was changed — retry to load them.
                </p>
              </div>
              <Button size="xs" variant="outline" onClick={() => failedSections.forEach((s) => void s.query.refetch())}>
                Retry sections
              </Button>
            </div>
          </div>
        )}
        <div className={`space-y-5 pb-24 md:pb-0 ${largeTextMode ? 'text-lg' : ''} ${accessibilityMode ? 'contrast-more' : ''}`} onInputCapture={() => setHasUnsavedDraft(true)}>
          {dayOfContactQuery.data?.contact?.name && <Card className="border-brand/20"><CardHeader><CardTitle>Day-of contact</CardTitle><CardDescription>Your venue’s Event Week point of contact.</CardDescription></CardHeader><CardContent className="text-sm"><strong>{dayOfContactQuery.data.contact.name}</strong>{dayOfContactQuery.data.contact.hours && <p className="mt-1 text-fg-muted">Available: {dayOfContactQuery.data.contact.hours}</p>}{dayOfContactQuery.data.contact.phone && <p className="mt-1"><a className="text-brand underline" href={`tel:${dayOfContactQuery.data.contact.phone}`}>{dayOfContactQuery.data.contact.phone}</a></p>}{dayOfContactQuery.data.contact.email && <p className="mt-1"><a className="text-brand underline" href={`mailto:${dayOfContactQuery.data.contact.email}`}>{dayOfContactQuery.data.contact.email}</a></p>}{dayOfContactQuery.data.contact.escalation && <p className="mt-2 text-fg-muted">{dayOfContactQuery.data.contact.escalation}</p>}</CardContent></Card>}
          <Card><CardHeader><CardTitle>Event Week updates</CardTitle><CardDescription>Important venue-approved updates for your wedding week.</CardDescription></CardHeader><CardContent className="space-y-2">{coupleUpdatesQuery.isError ? <SectionLoadError label="Event Week updates" onRetry={() => void coupleUpdatesQuery.refetch()} /> : coupleUpdatesQuery.data?.updates?.length ? coupleUpdatesQuery.data.updates.map((update: any) => <div key={update.id} className="rounded border border-border p-3 text-sm"><strong>{update.title}</strong>{update.critical ? <span className="ml-2 text-warning">Action requested</span> : null}<p className="mt-1 text-fg-muted">{update.body}</p>{update.critical && !update.acknowledged_at && <Button className="mt-2" size="xs" onClick={() => acknowledgeUpdateMutation.mutate(update.id)}>I understand</Button>}{update.acknowledged_at && <p className="mt-2 text-xs text-success">Acknowledged</p>}</div>) : <p className="text-sm text-fg-muted">No Event Week updates right now.</p>}</CardContent></Card>
          <Card className="border-brand/30 bg-brand-soft/10"><CardHeader><CardTitle>{event.status === 'final_review' ? 'Final Review handoff' : 'Your planning focus'}</CardTitle><CardDescription>{event.status === 'final_review' ? 'Seven Paths Manor is completing the operational review. Keep any change requests focused and review venue-manager decisions here.' : 'Your next best decisions, kept simple. The venue team handles operations behind the scenes.'}</CardDescription></CardHeader><CardContent>{event.status === 'final_review' ? <p className="text-sm text-fg-muted">Review your approved layout, guest count, and wedding-day schedule. Use the Final Review card below if something needs to change.</p> : planningFocus.length ? <ol className="space-y-2 text-sm">{planningFocus.map((item, index) => <li key={item} className="flex gap-2"><span className="font-semibold text-brand">{index + 1}.</span>{item}</li>)}</ol> : <p className="text-sm text-fg-muted">Your immediate planning decisions are complete. Check your schedule and messages for venue updates.</p>}</CardContent></Card>
          <Card className="border-brand/20 bg-brand-soft/10"><CardHeader><CardTitle>Choose your venue-approved starting plan</CardTitle><CardDescription>Templates are approved by Seven Paths Manor. We recommend options that fit your current guest count; you can still view any option with a capacity note.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{venueTemplatesQuery.data?.templates?.length ? venueTemplatesQuery.data.templates.map((template) => { const spec = template.spec || {}; const min = spec.minGuests ?? 0; const max = spec.maxGuests ?? Infinity; const warning = venueTemplatesQuery.data!.guestCount && (venueTemplatesQuery.data!.guestCount < min || venueTemplatesQuery.data!.guestCount > max); return <div key={template.id} className="rounded-lg border border-border bg-surface p-3"><strong>{template.name}</strong><p className="mt-1 text-xs text-fg-muted">{spec.weddingMoment || 'Wedding layout'} · {spec.serviceStyle || 'Flexible service'}{Number.isFinite(max) ? ` · designed for ${min}-${max} guests` : ''}</p>{warning && <p className="mt-2 text-xs text-warning">Your current guest count may need venue review for this template.</p>}<Button className="mt-3" size="sm" onClick={async () => { try { await venuesSdk.applyEventTemplate(eventId, template.id); qc.invalidateQueries({ queryKey: ['couple-layouts'] }); toast({ title: 'Template applied as your layout proposal', description: 'You can now customize permitted layout objects before venue review.', variant: 'success' }); } catch (err: any) { toast({ title: 'Could not apply template', description: err.message, variant: 'destructive' }); } }}>Use this template</Button></div>; }) : <p className="text-sm text-fg-muted">Seven Paths Manor has not published a template for this event yet. Ask your venue coordinator for options.</p>}</CardContent></Card>
          {event.status === 'final_review' && <Card className="border-warning/30 bg-warning-soft/10"><CardHeader><CardTitle>Final Review with Seven Paths Manor</CardTitle><CardDescription>Your venue team is completing the operational review. You may request a change; your venue manager confirms the final decision.</CardDescription></CardHeader><CardContent className="space-y-3"><Button size="sm" variant="outline" isLoading={finalReviewChangeMutation.isPending} onClick={async () => { const detail = await ask({ title: 'Request a review change', label: 'What would you like the venue to review or change?', multiline: true, required: true }); if (detail) finalReviewChangeMutation.mutate(detail); }}>Request a change</Button>{finalReviewChangesQuery.data?.requests?.length ? <div className="space-y-2">{finalReviewChangesQuery.data.requests.map((request) => <div key={request.id} className="rounded border border-border bg-surface p-2 text-sm"><strong>{request.status.replace('_', ' ')}</strong><p className="mt-1">{request.detail}</p>{request.manager_note && <p className="mt-1 text-fg-muted">Venue manager: {request.manager_note}</p>}</div>)}</div> : <p className="text-sm text-fg-muted">No Final Review change requests yet.</p>}</CardContent></Card>}

          <Card className="overflow-hidden border-brand/20 bg-gradient-to-br from-brand-soft/50 to-surface">
            <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-surface px-3 py-1 text-xs font-bold text-brand"><Heart className="h-3.5 w-3.5" /> Private wedding portal</div>
                <h2 className="font-display text-3xl text-brand-strong">{event.title}</h2>
                <div className="mt-3 grid gap-2 text-sm text-fg-muted sm:grid-cols-2">
                  <p><CalendarDays className="mr-1 inline h-4 w-4" /> {event.start_date || 'Wedding date TBD'}</p>
                  <p><Building2 className="mr-1 inline h-4 w-4" /> {venueName}</p>
                  <p><Clock className="mr-1 inline h-4 w-4" /> {ceremonyTime}</p>
                  <p><Users className="mr-1 inline h-4 w-4" /> {totalGuests || event.guest_count || 'TBD'} guests</p>
                  <p><MapPin className="mr-1 inline h-4 w-4" /> Ceremony: {ceremonySpace}</p>
                  <p><MapPin className="mr-1 inline h-4 w-4" /> Reception: {receptionSpace}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><a href={`#/portal/${event.id}`}>Preview guest RSVP portal</a></Button>
                  <Button asChild size="sm" variant="outline"><a href="#/settings/profile">Account settings</a></Button>
                  <Button size="sm" onClick={askVenue}><MessageCircle className="h-4 w-4" /> Ask the venue</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-border bg-surface/90 p-5 text-center shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Countdown</div>
                  <div className="mt-2 font-display text-6xl text-brand-strong">{countdown ?? '—'}</div>
                  <div className="text-sm text-fg-muted">days until your wedding</div>
                </div>
                <div className="rounded-2xl border border-border bg-surface/90 p-5 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Wedding readiness</div>
                  <div className="mt-2 text-3xl font-bold text-brand">{readinessQueryFailed ? '—' : `${readiness}%`}</div>
                  <div className="mt-2 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-brand" style={{ width: `${readiness}%` }} /></div>
                  <p className="mt-2 text-xs text-fg-muted">Client-friendly score from milestones, RSVP, floor plan, and timeline readiness.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-brand" /> Couple-safe event overview</CardTitle><CardDescription>Client-visible wedding details only. Internal notes, staff assignments, risks, escalations, and audit metadata are intentionally hidden.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  {[
                    ['Wedding date', event.start_date || 'TBD'], ['Ceremony time', ceremonyTime], ['Reception time', receptionTime], ['Ceremony space', ceremonySpace], ['Reception space', receptionSpace], ['Estimated guest count', String(totalGuests || event.guest_count || 'TBD')], ['Package', metadata.packageName || metadata.package || 'Package pending'], ['Contracted hours', metadata.contractedHours || 'Hours pending'], ['Rehearsal time', metadata.rehearsalTime || 'Rehearsal pending'], ['Rain plan', metadata.rainPlanStatus || metadata.rainPlan || 'Rain plan pending'],
                  ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-surface-2 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{label}</div><div className="mt-1 font-semibold text-fg">{value}</div><Button size="xs" variant="ghost" className="mt-1 px-0 text-brand" onClick={() => requestEventChange(label, value)}>Request change</Button></div>)}
                </div>
                {pendingChangeRequests.length > 0 && <div className="rounded-lg border border-warning/30 bg-warning-soft/30 p-3 text-xs text-warning"><strong>Pending venue approval:</strong> {pendingChangeRequests.length} event detail change request(s) waiting on the venue.</div>}
                <p className="text-xs text-fg-muted">Last updated by venue: {metadata.lastVenueUpdateAt || metadata.updatedByVenueAt || (event as any).updated_at || 'Not recorded yet'}.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-brand" /> Wedding profile completeness</CardTitle><CardDescription>Editable couple-owned profile fields for venue planning.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div><div className="flex items-center justify-between text-xs"><span className="font-bold text-fg-subtle uppercase">Profile complete</span><span className="font-bold text-brand">{profileComplete}%</span></div><div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-brand" style={{ width: `${profileComplete}%` }} /></div></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['coupleNames','Couple names'], ['pronouns','Pronouns'], ['primaryPhone','Primary phone'], ['secondaryPhone','Secondary phone'], ['mailingAddress','Mailing address'], ['plannerName','Planner name'], ['plannerEmail','Planner email'], ['plannerPhone','Planner phone'],
                  ].map(([key, label]) => <label key={key} className="text-xs font-bold text-fg-subtle uppercase">{label}<input value={profileDraft[key] || ''} onChange={(e) => setProfileDraft((p) => ({ ...p, [key]: e.target.value }))} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal text-fg" /></label>)}
                </div>
                <label className="text-xs font-bold text-fg-subtle uppercase">VIP family contacts<textarea value={profileDraft.vipFamilyContacts || ''} onChange={(e) => setProfileDraft((p) => ({ ...p, vipFamilyContacts: e.target.value }))} className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm font-normal text-fg" /></label>
                <Button size="sm" onClick={() => profileMutation.mutate()} isLoading={profileMutation.isPending}>Save wedding profile</Button>
                <p className="text-xs text-fg-muted">Last profile update: {profileQuery.data?.lastUpdatedAt || 'Not saved yet'}{profileQuery.data?.lastUpdatedBy ? ` by ${profileQuery.data.lastUpdatedBy}` : ''}.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-brand/20 bg-surface">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4 text-brand" /> Mobile & accessibility tools</CardTitle><CardDescription>Phone-first controls, offline wedding day info, large text, accessibility requests, and language preference.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><Button size="sm" variant={largeTextMode ? 'default' : 'outline'} onClick={() => setLargeTextMode((v) => !v)}>Large text</Button><Button size="sm" variant={accessibilityMode ? 'default' : 'outline'} onClick={() => setAccessibilityMode((v) => !v)}><Accessibility className="h-4 w-4" /> Accessibility mode</Button><Button size="sm" variant="outline" onClick={saveOfflineInfoCard}><Download className="h-4 w-4" /> Offline info card</Button><select value={portalDraft.language || 'en'} onChange={(e) => setPortalDraft((p) => ({ ...p, language: e.target.value }))} className="h-9 rounded-md border border-border bg-surface px-2"><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="zh">中文</option></select></div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]"><textarea value={accessibilityRequest} onChange={(e) => setAccessibilityRequest(e.target.value)} placeholder="Guest accessibility request, mobility note, seating need, interpretation/language need, sensory need, or other support request…" className="min-h-20 rounded-md border border-border bg-surface p-2 text-sm" /><Button size="sm" onClick={submitAccessibilityNeed} disabled={!accessibilityRequest.trim()}>Send accessibility request</Button></div>
              <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted"><strong>Unsaved draft protection:</strong> If you edit a form and try to leave before saving/submitting, the browser will warn you. Use the mobile bottom bar for one-hand access to Ask, RSVP, Guests, Timeline, Docs, and Offline.</div>
            </CardContent>
          </Card>

          <Suspense fallback={<Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>}>
            <CoupleReminderCenter eventId={eventId} />
          </Suspense>

          <Suspense fallback={<Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>}>
            <CouplePostEventCloseout eventId={eventId} venueContactEmail={venueContactEmail} coupleNames={profileDraft.coupleNames} />
          </Suspense>

          <Suspense fallback={<Card><CardContent className="pt-6"><Skeleton className="h-56 w-full" /></CardContent></Card>}>
            <CoupleAdvancedPlanning eventId={eventId} />
          </Suspense>

          <Card className="border-brand/20 bg-brand-soft/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-brand" /> Couple Data Privacy Center</CardTitle><CardDescription>Your account is event-scoped. This policy pack explains what you can access, what is blocked, and how sensitive data is filtered.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success"><strong>Allowed in your wedding hub</strong><ul className="mt-1 list-disc pl-4">{(privacyQuery.data?.policyPack.allowed || []).map((item) => <li key={item}>{item}</li>)}</ul></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><strong>Blocked internal access</strong><ul className="mt-1 list-disc pl-4">{(privacyQuery.data?.policyPack.blocked || []).map((item) => <li key={item}>{item}</li>)}</ul></div></div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Field-level filtering</strong><ul className="mt-1 list-disc pl-4">{Object.entries(privacyQuery.data?.fieldFiltering || {}).map(([key, values]) => <li key={key}>{key}: {values.join(' ')}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Data exports/downloads</strong><div className="mt-1 flex flex-col gap-1">{(privacyQuery.data?.exports || []).map((item) => <a key={item.href} className="font-bold text-brand underline" href={item.href} onClick={(e) => { e.preventDefault(); downloadAuth(item.href, item.label.includes('CSV') ? 'export.csv' : 'packet.txt'); }}>{item.label}</a>)}</div></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Secure guest link strategy</strong><p className="mt-1 text-fg-muted">{privacyQuery.data?.secureGuestLinks || 'Guest links should be tokenized per guest.'}</p><p className="mt-2">Partner/planner controls awaiting approval: {privacyQuery.data?.collaboratorControls.length ?? 0}</p></div></div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-brand/20 bg-brand-soft/10">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-brand" /> AI-style planning assistant</CardTitle><CardDescription>Grounded in your venue-approved wedding data. No internal operations details shown.</CardDescription></CardHeader>
              <CardContent><ol className="space-y-2 text-sm">{aiGuidance.map((item, i) => <li key={item} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-fg">{i + 1}</span><span>{item}</span></li>)}</ol></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" /> Needs your attention</CardTitle><CardDescription>Client-safe items to review first.</CardDescription></CardHeader>
              <CardContent>{attentionCards.length ? <div className="grid gap-2">{attentionCards.map((card) => <div key={card.title} className={`rounded-lg border p-3 text-sm ${card.severity === 'warning' ? 'border-warning/30 bg-warning-soft/30 text-warning' : 'border-border bg-surface-2 text-fg-muted'}`}><strong>{card.title}</strong><p className="mt-1 text-xs">{card.detail}</p></div>)}</div> : <p className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">Nothing urgent needs your attention right now.</p>}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-brand" /> Couple Planning Concierge</CardTitle><CardDescription>What should I do first? Start with these next 3 things.</CardDescription></CardHeader><CardContent><ol className="space-y-2 text-sm">{nextThree.map((item, index) => <li key={item.label} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-fg">{index + 1}</span><span>{item.label}</span></li>)}</ol></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-brand" /> RSVP progress</CardTitle><CardDescription>Client-safe guest response summary.</CardDescription></CardHeader><CardContent>{guestsQuery.isError ? <SectionLoadError label="RSVP progress" onRetry={() => void guestsQuery.refetch()} /> : <><div className="text-3xl font-bold text-brand">{rsvpPct}%</div><p className="mt-1 text-xs text-fg-muted">{rsvpResolved} of {totalGuests || '—'} guests responded. RSVP deadline: {formatDateOnly(rsvpDeadline)}.</p></>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4 text-brand" /> Contract/payment access</CardTitle><CardDescription>{identityVerified ? 'Identity verified.' : 'Verification required for sensitive details.'}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-fg-muted">{identityVerified ? <><p>{signedContracts} signed contract(s), {openContracts} pending.</p><p>Estimated open balance: <strong>{money(balanceCents)}</strong></p></> : <><p>For privacy, contracts and payment summaries unlock after venue identity verification.</p><Button size="sm" variant="outline" onClick={submitIdentityCheck} disabled={requestMutation.isPending || requests.some((r) => r.requestType === 'identity_verification' && r.status === 'pending')}>{requests.some((r) => r.requestType === 'identity_verification' && r.status === 'pending') ? 'Verification pending' : 'Request identity verification'}</Button></>}</CardContent></Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card id="couple-guest-list">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-brand" /> Couple Guest List Center</CardTitle><CardDescription>Manage your event guest list safely without access to other weddings. Dietary/accessibility notes are private planning details, not public guest content.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-5 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{totalGuests || 0}</strong><p className="text-xs text-fg-muted">total</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{rsvpPct}%</strong><p className="text-xs text-fg-muted">RSVP</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{guestsQuery.data?.filters?.missingAddress ?? 0}</strong><p className="text-xs text-warning">missing address</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{guestsQuery.data?.filters?.missingEmail ?? 0}</strong><p className="text-xs text-warning">missing email</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{guestsQuery.data?.filters?.notResponded ?? 0}</strong><p className="text-xs text-fg-muted">not responded</p></div></div>
                <div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-xs text-brand"><strong>Privacy:</strong> Dietary restrictions and accessibility notes are visible to the couple and venue planning team. The venue should share them with catering/event-day staff only when needed for service and guest care.</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {['fullName','email','householdName','mailingAddress','mealChoice','tags'].map((key) => <input key={key} value={guestDraft[key] || ''} onChange={(e) => setGuestDraft((p) => ({ ...p, [key]: e.target.value }))} placeholder={key === 'fullName' ? 'Full name' : key === 'householdName' ? 'Household / party' : key === 'mailingAddress' ? 'Mailing address' : key === 'tags' ? 'Tags: vip,family' : key} className="h-9 rounded-md border border-border bg-surface px-2 text-sm" />)}
                  <select value={guestDraft.rsvpStatus || 'pending'} onChange={(e) => setGuestDraft((p) => ({ ...p, rsvpStatus: e.target.value }))} className="h-9 rounded-md border border-border bg-surface px-2 text-sm"><option value="pending">Pending</option><option value="attending">Attending</option><option value="declined">Declined</option><option value="maybe">Maybe</option></select>
                  <Button size="sm" onClick={() => guestMutation.mutate()} disabled={!guestDraft.fullName} isLoading={guestMutation.isPending}>Add guest</Button>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-border bg-surface-2 p-3"><h4 className="font-bold text-sm">Household manager</h4><div className="mt-2 space-y-1 text-xs text-fg-muted">{(guestsQuery.data?.households || []).slice(0, 6).map((h) => <div key={h.name} className="flex justify-between"><span>{h.name}</span><span>{h.count} guest(s)</span></div>)}</div></div>
                  <div className="rounded-lg border border-border bg-surface-2 p-3"><h4 className="font-bold text-sm">Table assignment review</h4><div className="mt-2 space-y-1 text-xs text-fg-muted">{guests.filter((g: any) => g.tableAssignment || g.seatAssignment).slice(0, 6).map((g: any) => <div key={g.id} className="flex justify-between"><span>{g.fullName}</span><span>{g.tableAssignment || 'No table'} {g.seatAssignment || ''}</span></div>)}{!guests.some((g: any) => g.tableAssignment || g.seatAssignment) && <p>No seating assignments shared yet.</p>}</div></div>
                </div>
                {(guestsQuery.data?.duplicateSuggestions?.length || 0) > 0 && <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><strong>Possible duplicates:</strong> {guestsQuery.data?.duplicateSuggestions.map((d) => d.value).join(', ')}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Guest import concierge</CardTitle><CardDescription>Paste your spreadsheet, preview the cleanup, then import the guest list in one click.</CardDescription></CardHeader>
              <CardContent className="space-y-3"><textarea value={importCsv} onChange={(e) => { setImportCsv(e.target.value); importGuestsMutation.reset(); }} aria-label="Guest list CSV" className="min-h-32 w-full rounded-md border border-border bg-surface p-2 text-xs font-mono" /><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => importPreviewMutation.mutate()} isLoading={importPreviewMutation.isPending}>Preview import</Button>{importPreviewMutation.data && <Button size="sm" onClick={() => importGuestsMutation.mutate()} isLoading={importGuestsMutation.isPending} disabled={importGuestsMutation.isSuccess || importPreviewMutation.data.rowCount === 0}>{importGuestsMutation.isSuccess ? `Imported ${importGuestsMutation.data?.imported ?? 0} guest(s)` : `Import ${importPreviewMutation.data.rowCount} guest(s)`}</Button>}</div>{importPreviewMutation.data && <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><p><strong>{importPreviewMutation.data.rowCount}</strong> rows detected. Nothing saved yet.</p><p>Warnings: {importPreviewMutation.data.warnings.join(' · ') || 'none'}</p><p>Duplicate signals: {importPreviewMutation.data.duplicateSignals.join(', ') || 'none'}</p><p>Household suggestions: {importPreviewMutation.data.householdSuggestions.join(', ') || 'none'}</p>{importGuestsMutation.data?.skipped ? <p className="mt-1 text-warning">Skipped {importGuestsMutation.data.skipped} row(s) — duplicate emails/names or missing names.</p> : null}</div>}<a className="text-xs font-bold text-brand underline" href={`/api/events/${eventId}/couple-guests/export.csv`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-guests/export.csv`, 'couple-guests.csv'); }}>Download privacy-safe guest CSV</a><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted"><strong>Communication preview:</strong> RSVP reminders should mention deadline {rsvpDeadline || 'TBD'}, guest name, RSVP link, meal/accessibility reminder, and venue support contact before sending.</div></CardContent>
            </Card>
          </div>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-brand" /> Couple Calendar & Appointments</CardTitle><CardDescription>Only couple-relevant appointments, deadlines, payment dates, tastings, rehearsal, and walkthrough items are shown.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{calendarQuery.data?.appointments.length ?? 0}</strong><p className="text-xs text-fg-muted">appointments</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{calendarQuery.data?.calendarItems.length ?? 0}</strong><p className="text-xs text-fg-muted">calendar items</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{calendarQuery.data?.appointments.filter((a) => a.status.includes('request')).length ?? 0}</strong><p className="text-xs text-fg-muted">open requests</p></div></div>
              <div className="grid gap-2 lg:grid-cols-2">{(calendarQuery.data?.appointments || []).slice(0, 8).map((appt) => <div key={appt.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{appt.title}</strong><p className="text-xs text-fg-muted">{appt.appointmentType.replace('_', ' ')} · {appt.startsAt || 'time requested'} · {appt.location || 'location TBD'}</p><p className="mt-1 text-xs text-fg-muted">Prep: {appt.preparation.slice(0, 2).join(' · ')}</p></div><Badge variant={appt.status === 'confirmed' ? 'success' : appt.status.includes('request') ? 'warning' : 'outline'}>{appt.status.replace('_', ' ')}</Badge></div><div className="mt-2 flex flex-wrap gap-1"><Button size="xs" variant="outline" onClick={async () => { const note = await ask({ title: 'Reschedule this appointment', label: 'Preferred dates/times or notes', multiline: true, required: true }); if (note) appointmentStatusMutation.mutate({ id: appt.id, status: 'reschedule_requested', note }); }}>Reschedule</Button><Button size="xs" variant="ghost" onClick={() => appointmentStatusMutation.mutate({ id: appt.id, status: 'cancel_requested', note: 'Couple requested cancellation' })}>Cancel</Button>{appt.appointmentType === 'final_walkthrough' && <Button size="xs" onClick={() => appointmentSignoffMutation.mutate(appt.id)}>Sign off</Button>}</div></div>)}</div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Availability windows</strong><ul className="mt-1 list-disc pl-4">{Object.entries(calendarQuery.data?.availabilityWindows || {}).map(([k, v]) => <li key={k}>{k.replace('_', ' ')}: {String(v)}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Upcoming deadlines/payment dates</strong><ul className="mt-1 list-disc pl-4">{(calendarQuery.data?.calendarItems || []).filter((i) => i.source !== 'appointment').slice(0, 6).map((i) => <li key={`${i.source}-${i.id}`}>{i.title} · {formatDateOnly(i.startsAt)}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Appointment preparation</strong><p>Each appointment includes reminder hooks and preparation checklist items for tastings, meetings, walkthroughs, rehearsals, and payment dates.</p></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => requestAppointment('tasting')}>Request tasting</Button><Button size="sm" variant="outline" onClick={() => requestAppointment('planning_meeting')}>Planning meeting</Button><Button size="sm" variant="outline" onClick={() => requestAppointment('final_walkthrough')}>Final walkthrough</Button><Button size="sm" variant="outline" onClick={() => requestAppointment('rehearsal')}>Rehearsal</Button><Button asChild size="sm" variant="outline"><a href={`/api/events/${eventId}/couple-calendar.ics`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-calendar.ics`, 'couple-calendar.ics'); }}>Export calendar</a></Button></div>
            </CardContent>
          </Card>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-brand" /> Couple Inbox & Venue Q&A Center</CardTitle><CardDescription>Venue and planner threads, urgent questions, decision-needed records, read status, response expectations, and searchable policy guidance.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{inboxQuery.data?.notificationSummary.newVenueMessages ?? 0}</strong><p className="text-xs text-fg-muted">new venue messages</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{inboxQuery.data?.notificationSummary.dueTasks ?? 0}</strong><p className="text-xs text-fg-muted">due planning tasks</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{inboxQuery.data?.decisions.length ?? 0}</strong><p className="text-xs text-fg-muted">decision threads</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{inboxQuery.data?.venueContact.expectedResponse || '1 business day'}</strong><p className="text-xs text-fg-muted">expected response</p></div></div>
              <div className="grid gap-2 lg:grid-cols-2">{(inboxQuery.data?.threads || []).map((thread) => <div key={thread.threadId} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{thread.label}</strong><p className="text-xs text-fg-muted">Expected response: {thread.expectedResponse}</p></div><Badge variant={thread.unread ? 'warning' : 'outline'}>{thread.unread} unread</Badge></div><div className="mt-2 max-h-24 overflow-auto space-y-1 text-xs text-fg-muted">{thread.messages.slice(-3).map((m: any) => <p key={m.id}>{m.sender_role}: {m.body}</p>)}{!thread.messages.length && <p>No messages yet.</p>}</div></div>)}</div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Message templates</strong><div className="mt-1 flex flex-wrap gap-1">{(inboxQuery.data?.templates || []).map((template) => <button key={template.id} className="rounded border border-border bg-surface px-2 py-1 text-left" onClick={() => setMessageDraft(template.body)}>{template.label}</button>)}</div></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Searchable FAQ / venue policies</strong><ul className="mt-1 list-disc pl-4">{(inboxQuery.data?.templates ? (inboxQuery.data as any).faq || [] : []).slice?.(0, 0)}{(inboxQuery.data as any)?.faq?.slice(0, 4).map((f: any) => <li key={f.q}>{f.q}: {f.a}</li>) || <li>Venue policy guidance loads here.</li>}</ul></div><div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-xs text-brand whitespace-pre-wrap"><strong>AI answer draft with policy citations</strong>\n{inboxQuery.data?.aiDraft || 'Ask a question to draft a venue-safe reply.'}</div></div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"><textarea value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} placeholder="Write a venue/planner message…" className="min-h-20 rounded-md border border-border bg-surface p-2 text-sm" /><Button size="sm" onClick={() => inboxMessageMutation.mutate({ threadType: 'venue', body: messageDraft })} disabled={!messageDraft}>Send to venue</Button><Button size="sm" variant="outline" onClick={() => inboxMessageMutation.mutate({ threadType: 'urgent', body: messageDraft || 'Urgent venue question', urgency: 'urgent' })}>Urgent</Button><Button size="sm" variant="outline" onClick={requestDecision} isLoading={decisionMutation.isPending}>Decision needed</Button></div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted"><span>Notifications: digest {notificationPrefsQuery.data?.preferences.digest_frequency || 'daily'}</span><Button size="xs" variant="outline" onClick={() => notificationPrefsMutation.mutate()} isLoading={notificationPrefsMutation.isPending}>Toggle instant/daily</Button></div>
            </CardContent>
          </Card>

          <Card id="couple-documents" className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4 text-brand" /> Couple Document Hub</CardTitle><CardDescription>Shared client document hub separate from internal gallery and operations evidence. Uploads support PDF/JPG/PNG/WebP up to 8 MB.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{documentsQuery.data?.documents.length ?? 0}</strong><p className="text-xs text-fg-muted">documents</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{documentsQuery.data?.reviewQueue.length ?? 0}</strong><p className="text-xs text-warning">needs review</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{documentsQuery.data?.postEventGallery.length ?? 0}</strong><p className="text-xs text-fg-muted">post-event gallery</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{Math.round((documentsQuery.data?.maxBytes || 0) / 1024 / 1024) || 8} MB</strong><p className="text-xs text-fg-muted">file limit</p></div></div>
              <div className="grid gap-2 md:grid-cols-5"><input value={documentDraft.filename || ''} onChange={(e) => setDocumentDraft((p) => ({ ...p, filename: e.target.value }))} placeholder="Filename" className="h-9 rounded-md border border-border bg-surface px-2 text-sm" /><select value={documentDraft.category || 'other'} onChange={(e) => setDocumentDraft((p) => ({ ...p, category: e.target.value }))} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">{(documentsQuery.data?.categories || ['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other']).map((c) => <option key={c} value={c}>{c}</option>)}</select><select value={documentDraft.visibility || 'couple_venue'} onChange={(e) => setDocumentDraft((p) => ({ ...p, visibility: e.target.value }))} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">{(documentsQuery.data?.visibilityOptions || ['couple','couple_venue','planner','vendor','guest_visible']).map((v) => <option key={v} value={v}>{v}</option>)}</select><input value={documentDraft.notes || ''} onChange={(e) => setDocumentDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" className="h-9 rounded-md border border-border bg-surface px-2 text-sm" /><div className="flex items-center gap-2"><input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" aria-label="Choose a document file" onChange={handleDocumentFileChosen} /><Button size="sm" variant={documentDraft.dataUri ? 'default' : 'outline'} onClick={() => fileInputRef.current?.click()}>Choose file</Button>{documentDraft.dataUri ? <Button size="sm" onClick={uploadChosenDocument} isLoading={documentUploadMutation.isPending}>Upload</Button> : <Button size="xs" variant="ghost" onClick={useSampleDocument} className="text-xs">Use sample file</Button>}</div></div>{documentFileError && <p className="text-xs text-danger col-span-5 mt-2">{documentFileError}</p>}
              <div className="grid gap-2 lg:grid-cols-2">{documentsQuery.isError ? <SectionLoadError label="Documents" onRetry={() => void documentsQuery.refetch()} /> : (<>{(documentsQuery.data?.documents || []).slice(0, 8).map((doc) => <div key={doc.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{doc.filename}</strong><p className="text-xs text-fg-muted">{doc.category} · {doc.visibility} · v{doc.version}</p>{doc.extractedSummary && <p className="mt-1 whitespace-pre-wrap text-xs text-fg-muted">{doc.extractedSummary}</p>}</div><Badge variant={doc.approvalStatus === 'approved' ? 'success' : doc.approvalStatus === 'changes_requested' ? 'warning' : 'outline'}>{doc.approvalStatus}</Badge><div className="flex shrink-0 gap-1"><Button size="xs" variant="outline" onClick={() => downloadAuth(doc.url, doc.filename)}>Open</Button><Button size="xs" variant="ghost" onClick={() => documentDeleteMutation.mutate(doc.id)} aria-label={`Delete document ${doc.filename}`}><Trash2 className="h-3.5 w-3.5" /></Button></div></div></div>)}</>)}</div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Supported categories</strong><p className="mt-1 text-fg-muted">Inspiration photos, insurance, vendor docs, ceremony docs, playlists, diagrams, permits, guest spreadsheets, menus, contracts, and post-event gallery.</p></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Visibility</strong><p className="mt-1 text-fg-muted">Couple, couple+venue, planner, vendor, or guest-visible. Guest-visible files require venue approval.</p></div><div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-xs text-brand"><strong>AI extraction review</strong><p className="mt-1">Guest lists, contracts, menu notes, ceremony docs, and playlists get deterministic review hints for venue approval.</p></div></div>
              <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><a href={`/api/events/${eventId}/couple-documents/final-packet.txt`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-documents/final-packet.txt`, 'final-packet.txt'); }}>Download final packet</a></Button></div>
            </CardContent>
          </Card>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-brand" /> Couple Design & Preferences</CardTitle><CardDescription>Submit the details venues actually collect: ceremony style, rain plan, floor plan, linens/colors, menu/bar, signage, rentals, music, traditions, VIPs, wedding party, shot list, and mood board.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{designQuery.data?.progress.percent ?? 0}%</strong><p className="text-xs text-fg-muted">form progress</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{designQuery.data?.review.status || 'draft'}</strong><p className="text-xs text-fg-muted">venue review</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{designQuery.data?.moodBoard.length ?? 0}</strong><p className="text-xs text-fg-muted">mood-board links</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{designQuery.data?.venueTemplateHints.length ?? 0}</strong><p className="text-xs text-fg-muted">venue template prompts</p></div></div>
              <div className="grid gap-2 md:grid-cols-3">{[
                ['ceremonyStyle','Ceremony style'], ['rainPlanPreference','Rain plan preference'], ['floorplanPreference','Floor plan preference'], ['linens','Linens'], ['colors','Colors'], ['barMenuNotes','Bar/menu notes'], ['signage','Signage'], ['rentals','Rentals'], ['musicRestrictions','Music restrictions'], ['culturalTraditions','Cultural traditions'], ['tastingMenuSelections','Tasting/menu selections'], ['allergySummary','Allergies summary'], ['ceremonyScriptNotes','Ceremony script notes'], ['processionalNotes','Processional notes'], ['vipFamily','VIP family'], ['weddingParty','Wedding party'], ['photoShotList','Photo shot list'], ['moodBoardLinks','Mood-board image links'],
              ].map(([key, label]) => <label key={key} className="text-xs font-bold text-fg-subtle uppercase">{label}<textarea value={designDraft[key] || ''} onChange={(e) => setDesignDraft((p) => ({ ...p, [key]: e.target.value }))} className="mt-1 min-h-16 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm font-normal text-fg" /></label>)}</div>
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-xs text-brand whitespace-pre-wrap"><strong>AI-assisted design board summary</strong>\n{designQuery.data?.aiSummary || 'Save your preferences to generate a grounded summary for the venue.'}</div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted"><strong>Mood board / venue review</strong><ul className="mt-1 list-disc pl-4">{(designQuery.data?.moodBoard || []).slice(0, 8).map((link) => <li key={link}>{link}</li>)}{!designQuery.data?.moodBoard?.length && <li>Add image links or shared folder URLs in mood-board links.</li>}</ul><p className="mt-2">Review state: {designQuery.data?.review.updatedAt ? `updated ${designQuery.data.review.updatedAt}` : 'not submitted yet'}</p></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => designMutation.mutate()} isLoading={designMutation.isPending}>Save draft</Button><Button size="sm" variant="outline" onClick={() => designReviewMutation.mutate()} isLoading={designReviewMutation.isPending}>Submit for venue review</Button></div>
            </CardContent>
          </Card>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4 text-brand" /> Couple Contract & Payments Center</CardTitle><CardDescription>Client-safe agreement, invoice, receipt, due-date, balance, and add-on approval view. Internal budgets, vendor margins, forecasts, and owner notes are hidden.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{money(financeQuery.data?.totals.contractedCents ?? 0)}</strong><p className="text-xs text-fg-muted">agreement total</p></div><div className="rounded-lg border border-success/30 bg-success-soft p-3"><strong>{money(paidCents)}</strong><p className="text-xs text-success">paid/receipted</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{money(balanceCents)}</strong><p className="text-xs text-warning">open balance</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{financeQuery.data?.changeOrders.length ?? 0}</strong><p className="text-xs text-fg-muted">add-on requests</p></div></div>
              <div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-xs text-brand"><strong>Payment status explanation:</strong> {financeQuery.data?.paymentScheduleExplanation || 'Venue-created payment schedule will appear here.'}</div>
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><h4 className="font-bold">Contracts and signatures</h4><div className="mt-2 space-y-2">{contracts.map((contract) => <div key={contract.id} className="rounded-md border border-border bg-surface p-2"><div className="flex items-start justify-between gap-2"><div><strong>{contract.title}</strong><p className="text-xs text-fg-muted">{contract.nextStep}</p>{contract.signedCertificate && <p className="text-xs text-success">Signed certificate: {contract.signedCertificate.signer} · {formatDateOnly(contract.signedCertificate.signedAt)}</p>}</div><Badge variant={contract.status === 'signed' ? 'success' : 'warning'}>{contract.status}</Badge></div><div className="mt-2 flex flex-wrap gap-1">{contract.clauseExplainers.map((c) => <Badge key={`${contract.id}-${c.label}`} variant="outline">{c.label}</Badge>)}{contract.status !== 'signed' && <Button size="xs" variant="outline" onClick={async () => { const signature = await ask({ title: 'Sign this agreement', label: 'Type your legal signature', required: true, confirmLabel: 'Sign' }); if (signature) signContractMutation.mutate({ contractId: contract.id, signature }); }}>Sign</Button>}</div></div>)}{contracts.length === 0 && <p className="text-xs text-fg-muted">No couple-visible agreement shared yet.</p>}</div></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><h4 className="font-bold">Invoices, receipts, and due dates</h4><div className="mt-2 space-y-2">{(financeQuery.data?.payments || []).map((payment) => <div key={payment.id} className="rounded-md border border-border bg-surface p-2"><div className="flex items-start justify-between gap-2"><div><strong>{payment.label}</strong><p className="text-xs text-fg-muted">{money(payment.amountCents)} · due {formatDateOnly(payment.dueDate)} · {payment.explanation}</p>{payment.receiptUrl && <a className="text-xs text-brand underline" href={payment.receiptUrl}>Download receipt</a>}</div><Badge variant={payment.status === 'completed' ? 'success' : payment.status === 'failed' ? 'danger' : 'warning'}>{payment.status}</Badge></div>{payment.paymentUrl && <a className="mt-1 inline-block text-xs font-bold text-brand underline" href={payment.paymentUrl}>Open payment link</a>}</div>)}{!financeQuery.data?.payments?.length && <p className="text-xs text-fg-muted">No payment links shared yet.</p>}</div></div></div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Refund / cancellation policy</strong><p className="mt-1 text-fg-muted">{financeQuery.data?.refundCancellationPolicy}</p></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Hidden internal finance fields</strong><ul className="mt-1 list-disc pl-4">{(financeQuery.data?.hiddenFields || []).map((field) => <li key={field}>{field}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Payment method vault</strong><p className="mt-1 text-fg-muted">{financeQuery.data?.paymentMethodVault.note || 'Not configured.'}</p></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={async () => { const question = await ask({ title: 'Ask about your invoice or contract', label: 'Your question', multiline: true, required: true }); if (question) financeQuestionMutation.mutate(question); }} isLoading={financeQuestionMutation.isPending}>Ask invoice/contract question</Button><Button size="sm" variant="outline" onClick={async () => { const label = await ask({ title: 'Request an add-on or change order', label: 'What do you want? (extra hour, room block, ceremony upgrade, bar package, rental upgrade)', multiline: true, required: true }); if (label) changeOrderMutation.mutate({ changeType: 'other', label, note: label }); }} isLoading={changeOrderMutation.isPending}>Request add-on/change order</Button><Button asChild size="sm" variant="outline"><a href={`/api/events/${eventId}/couple-finance/packet.txt`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-finance/packet.txt`, 'couple-finance-packet.txt'); }}>Download contract/payment packet</a></Button></div>
            </CardContent>
          </Card>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-brand" /> Client-safe Vendor Team</CardTitle><CardDescription>Couple-visible vendor view. Internal COIs, no-show risk, vendor payments/contracts, and venue-only notes are hidden unless the venue explicitly shares them.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleVendorsQuery.data?.vendors.length ?? 0}</strong><p className="text-xs text-fg-muted">visible vendors</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleVendorsQuery.data?.vendors.filter((v) => v.isPreferred).length ?? 0}</strong><p className="text-xs text-fg-muted">preferred</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleVendorsQuery.data?.requests.length ?? 0}</strong><p className="text-xs text-fg-muted">open requests</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleVendorsQuery.data?.planner.status || 'not connected'}</strong><p className="text-xs text-fg-muted">planner hub</p></div></div>
              <div className="grid gap-2 lg:grid-cols-2">{(coupleVendorsQuery.data?.vendors || []).map((vendor) => <div key={vendor.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{vendor.name}</strong><p className="text-xs text-fg-muted">{vendor.category} · {vendor.confirmedStatus} · contact via {vendor.contactPreference}</p>{vendor.arrival && <p className="text-xs text-fg-muted">Arrival visible to couple: {vendor.arrival}</p>}{vendor.notesForCouple && <p className="mt-1 text-xs text-fg-muted">{vendor.notesForCouple}</p>}</div><Badge variant={vendor.bookedStatus === 'booked' ? 'success' : 'outline'}>{vendor.bookedStatus}</Badge></div><div className="mt-2 flex flex-wrap gap-1">{vendor.visibleDocuments.map((doc) => <Badge key={`${vendor.id}-${doc.title}`} variant="outline">{doc.type}: {doc.title}</Badge>)}{vendor.visibleDocuments.length === 0 && <span className="text-xs text-fg-subtle">No couple-visible documents yet.</span>}<Button size="xs" variant="ghost" onClick={() => askVendorQuestion(vendor.id)}>Ask venue</Button></div></div>)}</div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Hidden from couple view</strong><ul className="mt-1 list-disc pl-4">{(coupleVendorsQuery.data?.hiddenFields || []).map((f) => <li key={f}>{f}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Vendor decision board</strong><div className="mt-1 space-y-1">{(coupleVendorsQuery.data?.comparison || []).map((v) => <div key={v.id} className="flex justify-between"><span>{v.name}</span><span>{v.status}</span></div>)}</div></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Planner collaboration hub</strong><p>{coupleVendorsQuery.data?.planner.name || 'Planner/coordinator not connected yet.'}</p>{coupleVendorsQuery.data?.planner.email && <p>{coupleVendorsQuery.data.planner.email}</p>}<Button size="xs" variant="outline" onClick={requestPlannerCollaboration}>Request planner access</Button></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={requestVendorRecommendation} isLoading={vendorRequestMutation.isPending}>Request vendor recommendation</Button><Button size="sm" variant="outline" onClick={() => askVendorQuestion()}>Ask vendor question</Button>{coupleVendorsQuery.data?.recommendationsEnabled === false && <Badge variant="warning">Venue recommendations disabled</Badge>}</div>
            </CardContent>
          </Card>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-brand" /> Couple Floorplan Review</CardTitle><CardDescription>Review the client-facing floor plan and seating without opening the advanced operations canvas editor.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleLayoutQuery.data?.summary.tables ?? 0}</strong><p className="text-xs text-fg-muted">tables</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleLayoutQuery.data?.summary.assignedSeats ?? 0}/{coupleLayoutQuery.data?.summary.seats ?? 0}</strong><p className="text-xs text-fg-muted">assigned seats</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{coupleLayoutQuery.data?.summary.unseatedGuests ?? 0}</strong><p className="text-xs text-warning">unseated guests</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleLayoutQuery.data?.approval.status?.replace('_', ' ') || 'not requested'}</strong><p className="text-xs text-fg-muted">approval</p></div></div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Visible floor plan areas</strong><ul className="mt-1 list-disc pl-4"><li>Dance floor: {coupleLayoutQuery.data?.visibleItems.danceFloor?.length ?? 0}</li><li>Ceremony seating: {coupleLayoutQuery.data?.visibleItems.ceremonySeating?.length ?? 0}</li><li>Bars/buffet: {(coupleLayoutQuery.data?.visibleItems.bars?.length ?? 0) + (coupleLayoutQuery.data?.visibleItems.buffet?.length ?? 0)}</li><li>Restrooms/entrances/ADA: {(coupleLayoutQuery.data?.visibleItems.restrooms?.length ?? 0) + (coupleLayoutQuery.data?.visibleItems.entrances?.length ?? 0) + (coupleLayoutQuery.data?.visibleItems.adaRoutes?.length ?? 0)}</li><li>Photo booth / DJ-band / sweetheart table: {(coupleLayoutQuery.data?.visibleItems.photoBooth?.length ?? 0) + (coupleLayoutQuery.data?.visibleItems.djBand?.length ?? 0) + (coupleLayoutQuery.data?.visibleItems.sweetheartHeadTable?.length ?? 0)}</li></ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Version compare</strong><ul className="mt-1 list-disc pl-4">{(coupleLayoutQuery.data?.versionHistory || []).map((v) => <li key={`${v.revision}-${v.createdAt}`}>Rev {v.revision}: {v.summary}</li>)}{!coupleLayoutQuery.data?.versionHistory?.length && <li>No shared revisions yet.</li>}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Accessibility / VIP guidance</strong><ul className="mt-1 list-disc pl-4">{(coupleLayoutQuery.data?.guidance || []).map((g) => <li key={g}>{g}</li>)}</ul><p className="mt-2 italic">3D walkthrough: {coupleLayoutQuery.data?.walkthrough3d.note || 'Coming soon.'}</p></div></div>
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Seating chart review</strong><div className="mt-2 space-y-1">{(coupleLayoutQuery.data?.seating.tableAssignments || []).slice(0, 8).map((s) => <div key={s.guestId} className="flex justify-between"><span>{s.fullName}</span><span>{s.tableAssignment || 'TBD'} {s.seatAssignment || ''}</span></div>)}</div>{(coupleLayoutQuery.data?.seating.duplicateSeatAssignments?.length || 0) > 0 && <p className="mt-2 text-warning">Duplicate seat assignments detected.</p>}</div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Comment pins / change requests</strong><div className="mt-2 space-y-1">{(coupleLayoutQuery.data?.comments || []).slice(0, 6).map((c) => <div key={c.id}>• {(c.metadata as any)?.areaLabel || 'General'} — {c.note}</div>)}{!coupleLayoutQuery.data?.comments?.length && <p>No couple comments yet.</p>}</div></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => layoutApprovalMutation.mutate('approved')} isLoading={layoutApprovalMutation.isPending}>Approve floor plan</Button><Button size="sm" variant="outline" onClick={() => layoutApprovalMutation.mutate('changes_requested')}>Request layout changes</Button><Button size="sm" variant="outline" onClick={() => requestLayoutComment('General floor plan')}>Add comment pin</Button><Button size="sm" variant="outline" onClick={updateFirstUnseatedGuest}>Assign first unseated guest</Button><Button asChild size="sm" variant="outline"><a href={`/api/events/${eventId}/couple-layout/seating.csv`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-layout/seating.csv`, 'seating-chart.csv'); }}>Export seating chart</a></Button><Button asChild size="sm" variant="outline"><a href={`/api/events/${eventId}/couple-layout/place-cards.txt`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-layout/place-cards.txt`, 'place-cards.txt'); }}>Export place cards</a></Button></div>
            </CardContent>
          </Card>

          <Card id="couple-timeline-review" className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-brand" /> Couple Timeline Review</CardTitle><CardDescription>Client-facing wedding schedule only. Vendor load-in, strike, staff setup, and internal incident items are hidden by default.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleTimelineQuery.data?.items.length ?? 0}</strong><p className="text-xs text-fg-muted">couple-visible items</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleTimelineQuery.data?.hiddenInternalCount ?? 0}</strong><p className="text-xs text-fg-muted">internal items hidden</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleTimelineQuery.data?.subEvents.length ?? 0}</strong><p className="text-xs text-fg-muted">weekend events</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{coupleTimelineQuery.data?.approval?.status?.replace('_', ' ') || 'not requested'}</strong><p className="text-xs text-fg-muted">approval status</p></div></div>
              <div className="grid gap-2 lg:grid-cols-2">{(coupleTimelineQuery.data?.items || []).slice(0, 10).map((item) => <div key={item.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{item.title}</strong><p className="text-xs text-fg-muted">{item.startsAt} · {item.location || 'Location TBD'} · {item.category}</p>{item.notes && <p className="mt-1 text-xs text-fg-muted">{item.notes}</p>}</div><Button size="xs" variant="ghost" onClick={() => requestTimelineChange(item.id)}>Request change</Button></div></div>)}</div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Wedding weekend / rehearsal</strong><ul className="mt-1 list-disc pl-4">{(coupleTimelineQuery.data?.subEvents || []).slice(0, 6).map((s) => <li key={s.id}>{s.title} · {s.startsAt}</li>)}{!coupleTimelineQuery.data?.subEvents?.length && <li>Wedding weekend events not shared yet.</li>}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Plain-English version history</strong><ul className="mt-1 list-disc pl-4">{(coupleTimelineQuery.data?.versionHistory || []).map((h) => <li key={`${h.at}-${h.summary}`}>{h.summary}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Timeline conflict education</strong><ul className="mt-1 list-disc pl-4">{(coupleTimelineQuery.data?.education || []).slice(0, 4).map((e) => <li key={e}>{e}</li>)}</ul></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => timelineApprovalMutation.mutate('approved')} isLoading={timelineApprovalMutation.isPending}>Approve final timeline</Button><Button size="sm" variant="outline" onClick={() => timelineApprovalMutation.mutate('changes_requested')}>Request timeline changes</Button><Button asChild size="sm" variant="outline"><a href={`/api/events/${eventId}/couple-timeline/export.ics`} onClick={(e) => { e.preventDefault(); downloadAuth(`/api/events/${eventId}/couple-timeline/export.ics`, 'couple-timeline.ics'); }}>Export couple calendar</a></Button><Button size="sm" variant="ghost" onClick={() => requestTimelineChange()}>Request general change</Button></div>
            </CardContent>
          </Card>

          <Card className="border-brand/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-brand" /> Couple Guest Portal QA / Preview Center</CardTitle><CardDescription>Guest RSVP portal is what invited guests see. Couple planning portal is your private planning workspace.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>Guest RSVP portal</strong><p className="text-xs text-fg-muted">{guestPortalQuery.data?.portal.publicUrl || `#/portal/${eventId}`}</p><Badge variant={guestPortalQuery.data?.portal.enabled ? 'success' : 'warning'}>{guestPortalQuery.data?.portal.enabled ? 'enabled' : 'not live'}</Badge></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>Couple planning portal</strong><p className="text-xs text-fg-muted">Private dashboard, checklist, guest list, documents, and venue messages.</p><Badge variant="outline">not guest-visible</Badge></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>Approval</strong><p className="text-xs text-fg-muted">Portal updates require venue approval before going live.</p><Badge variant={guestPortalUpdateRequest?.status === 'pending' ? 'warning' : 'outline'}>{guestPortalQuery.data?.approvalStatus || guestPortalUpdateRequest?.status || 'not requested'}</Badge></div></div>
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success"><strong>Guests will see:</strong><ul className="mt-1 list-disc pl-4">{(guestPortalQuery.data?.guestsWillSee || []).map((item) => <li key={item}>{item}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted"><strong>Guests will not see:</strong><ul className="mt-1 list-disc pl-4">{(guestPortalQuery.data?.guestsWillNotSee || []).map((item) => <li key={item}>{item}</li>)}</ul></div></div>
              <div className="grid gap-2 md:grid-cols-3">{['welcomeMessage','dressCode','parkingText','shuttleText','lodgingText','registryLinks','kidsPolicy','plusOneRules','accessibilityNotes','guestFaq','subEventInstructions','travelConcierge','language'].map((key) => <input key={key} value={portalDraft[key] || ''} onChange={(e) => setPortalDraft((p) => ({ ...p, [key]: e.target.value }))} placeholder={key} className="h-9 rounded-md border border-border bg-surface px-2 text-sm" />)}</div>
              <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>RSVP rules</strong><p>Deadline: {formatDateOnly(guestPortalQuery.data?.portal.rsvpDeadline || rsvpDeadline)}</p><p>Edit window: {guestPortalQuery.data?.portal.editWindowDays ?? 'venue default'} day(s)</p><p>Confirmation email preview: Thanks for your RSVP. Meal, dietary, accessibility, travel, and lodging details are saved.</p></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Mobile QA checklist</strong><ul className="mt-1 list-disc pl-4">{(guestPortalQuery.data?.mobileQa || []).slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Secure links / QR</strong><p>QR payload: {guestPortalQuery.data?.qrPayload || `WVI-RSVP:${eventId}`}</p><Button size="xs" variant="outline" onClick={generateFirstGuestLink}>Copy first guest tokenized link</Button></div></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => portalUpdateMutation.mutate()} isLoading={portalUpdateMutation.isPending}>Request portal content approval</Button><Button size="sm" variant="outline" onClick={() => reminderMutation.mutate()} disabled={!!rsvpReminderRequest} isLoading={reminderMutation.isPending}>{rsvpReminderRequest ? `Reminder ${rsvpReminderRequest.status}` : 'Request RSVP reminder campaign'}</Button><Button asChild size="sm" variant="outline"><a href={`#/portal/${eventId}`}>Open guest preview</a></Button></div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-brand" /> Couple Planning Checklist</CardTitle><CardDescription>Separate from staff tasks. Deadlines come from the venue-controlled {planningQuery.data?.template?.packageKey || 'standard'} template.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{completedPlanning}/{planningTasks.length}</strong><p className="text-xs text-fg-muted">complete</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{overduePlanning.length}</strong><p className="text-xs text-warning">overdue</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{upcomingPlanning.length}</strong><p className="text-xs text-fg-muted">due soon</p></div></div>
                <div className="grid gap-2">{planningTasks.slice(0, 8).map((task) => <div key={task.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>{task.title}</strong><Badge variant={task.owner === 'couple' ? 'default' : 'outline'}>{task.owner}</Badge><Badge variant={task.isOverdue ? 'warning' : task.status === 'completed' ? 'success' : 'outline'}>{task.status.replace('_', ' ')}</Badge><Badge variant={task.approvalStatus === 'approved' ? 'success' : task.approvalStatus === 'pending' ? 'warning' : 'outline'}>{task.approvalStatus.replace('_', ' ')}</Badge></div><p className="mt-1 text-xs text-fg-muted">Due {formatDateOnly(task.dueDate)} · {task.description}</p><p className="mt-1 text-xs text-fg-muted">Attachments: {task.attachments.length} · History: {task.history.length} update(s)</p></div><div className="flex shrink-0 flex-wrap gap-1"><Button size="xs" variant="outline" onClick={() => planningMutation.mutate({ taskId: task.id, patch: { status: 'completed', approvalStatus: task.approvalStatus === 'not_required' ? 'not_required' : 'pending', note: 'Marked complete by couple' } })}>Mark done</Button><Button size="xs" variant="ghost" onClick={async () => { const q = await ask({ title: `Question about ${task.title}`, label: 'Your question', multiline: true, required: true }); if (q) { try { await sdk.couple.askPlanningTaskQuestion(eventId, task.id, q); qc.invalidateQueries({ queryKey: ['couple-requests', eventId] }); toast({ title: 'Question sent to venue', variant: 'success' }); } catch (err: any) { toast({ title: 'Could not send question', description: err?.message || 'Please try again.', variant: 'destructive' }); } } }}>Ask</Button></div></div></div>)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-brand" /> Decision tracker</CardTitle><CardDescription>Ceremony, reception, menu, music, floor plan, decor, signage, transportation, and lodging.</CardDescription></CardHeader>
              <CardContent><div className="space-y-2">{decisionTasks.slice(0, 10).map((task) => <div key={task.id} className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><div className="flex items-center justify-between gap-2"><strong>{String(task.decisionCategory).replace('_', ' ')}</strong><span>{task.status.replace('_', ' ')}</span></div><p className="text-fg-muted">{task.title} · due {task.dueDate || 'TBD'}</p></div>)}</div></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-brand" /> Planning milestone checklist</CardTitle><CardDescription>High-level milestone progress tied to your wedding date.</CardDescription></CardHeader>
              <CardContent><div className="grid gap-2 sm:grid-cols-2">{milestones.map((m) => <div key={m.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong>{m.label}</strong><span className={m.done ? 'text-success' : 'text-fg-subtle'}>{m.done ? '✓' : '○'}</span></div><p className="mt-1 text-xs text-fg-muted">Due {m.due || 'TBD'} · {m.owner}</p></div>)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-brand" /> What the venue is working on</CardTitle><CardDescription>Safe operational transparency without staff-only details.</CardDescription></CardHeader>
              <CardContent><ul className="space-y-2 text-sm text-fg-muted">{venueWorkingOn.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{item}</li>)}</ul></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-brand" /> Your access</CardTitle><CardDescription>Couple accounts are limited to your wedding.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-fg-muted"><p>You can review client-visible wedding details, RSVP progress, guest information, documents, timeline, floor plan, and venue messages for this event.</p><p>You cannot access venue administration, other weddings, staff operations, audit logs, health/risk dashboards, or owner settings.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-4 w-4 text-brand" /> Ask the venue / share access</CardTitle><CardDescription>Request help, invite collaborators, or recover access.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-fg-muted"><div className="grid gap-1"><p>Venue contact: <strong>{venueContact}</strong>{venueContactEmail ? <> · <a className="text-brand underline" href={`mailto:${venueContactEmail}`}>{venueContactEmail}</a></> : null}</p><p>Planner: <strong>{plannerContact}</strong></p><p>Event-week contact: <strong>{emergencyContact}</strong></p></div><div className="grid gap-2"><Button size="sm" onClick={askVenue}><Mail className="h-4 w-4" /> Ask the venue</Button><Button size="sm" variant="outline" onClick={() => promptRequest('partner_invite')} disabled={requestMutation.isPending || !!partnerRequest}><Users className="h-4 w-4" /> {partnerRequest ? `Partner request ${partnerRequest.status}` : 'Invite partner/co-client'}</Button><Button size="sm" variant="outline" onClick={() => promptRequest('planner_request')} disabled={requestMutation.isPending || !!plannerRequest}><CalendarDays className="h-4 w-4" /> {plannerRequest ? `Planner request ${plannerRequest.status}` : 'Request planner/coordinator access'}</Button><Button size="sm" variant="outline" onClick={() => promptRequest('account_recovery')} disabled={requestMutation.isPending || !!accountRecoveryRequest}><FileSignature className="h-4 w-4" /> {accountRecoveryRequest ? `Recovery request ${accountRecoveryRequest.status}` : 'Account recovery / resend invite'}</Button></div></CardContent></Card>
          </div>

          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-2 shadow-lg backdrop-blur md:hidden" aria-label="Couple mobile shortcuts">
            <div className="grid grid-cols-6 gap-1 text-[11px]"><Button size="xs" onClick={askVenue}>Ask</Button><Button size="xs" variant="outline" asChild><a href={`#/portal/${event.id}`}>RSVP</a></Button><Button size="xs" variant="outline" onClick={() => document.getElementById('couple-guest-list')?.scrollIntoView({ behavior: 'smooth' })}>Guests</Button><Button size="xs" variant="outline" onClick={() => document.getElementById('couple-timeline-review')?.scrollIntoView({ behavior: 'smooth' })}>Timeline</Button><Button size="xs" variant="outline" onClick={() => document.getElementById('couple-documents')?.scrollIntoView({ behavior: 'smooth' })}>Docs</Button><Button size="xs" variant="outline" onClick={saveOfflineInfoCard}>Offline</Button></div>
          </nav>
        </div>
      </PageBody>
    </>
  );
}
