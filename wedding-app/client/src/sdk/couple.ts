import { api } from './client.js';

export type CoupleRequestType = 'partner_invite' | 'planner_request' | 'account_recovery' | 'identity_verification' | 'venue_question' | 'event_change_request' | 'guest_portal_update' | 'rsvp_reminder_request' | 'vendor_request' | 'vendor_question' | 'planner_collaboration' | 'finance_question' | 'change_order_request' | 'design_preferences_review' | 'decision_needed' | 'post_event_lost_item' | 'post_event_feedback' | 'review_testimonial_request';
export type CoupleRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface CoupleRequest {
  id: string;
  organizationId: string;
  eventId: string;
  requesterUserId: string | null;
  requestType: CoupleRequestType;
  status: CoupleRequestStatus;
  targetEmail: string | null;
  targetName: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoupleProfile {
  coupleNames?: string;
  pronouns?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  mailingAddress?: string;
  plannerName?: string;
  plannerEmail?: string;
  plannerPhone?: string;
  vipFamilyContacts?: string;
}

export interface CouplePlanningTask {
  id: string;
  eventId: string;
  templateKey: string;
  title: string;
  description: string | null;
  owner: 'couple' | 'venue' | 'planner' | 'vendor';
  dueDate: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'changes_requested';
  decisionCategory: 'ceremony' | 'reception' | 'menu' | 'music' | 'floor_plan' | 'decor' | 'signage' | 'transportation' | 'lodging' | 'documents' | 'guest_list' | 'timeline' | 'other' | null;
  attachments: Array<{ name: string; url?: string; note?: string }>;
  history: Array<{ at: string; actor: string; action: string; note?: string }>;
  isOverdue: boolean;
  isUpcoming: boolean;
  updatedAt: string;
}

export interface CoupleGuest {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  partyName: string | null;
  householdName: string;
  mailingAddress: string;
  mealChoice: string;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
  dietaryRestrictions: string | null;
  accessibilityNotes: string | null;
  notes: string;
  tags: string[];
  tableAssignment: string | null;
  seatAssignment: string | null;
  roomAssignment: string | null;
  plusOneAllowed: boolean;
  allowPortalAccess: boolean;
  allowLodgingAccess: boolean;
}

export interface CoupleReminder {
  key: string;
  title: string;
  body: string;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  channel: 'in_app' | 'email' | 'sms' | 'digest';
  recipientRole: 'couple' | 'partner' | 'planner';
}

export interface CoupleReminderSummary {
  reminders: CoupleReminder[];
  history: Array<Record<string, any>>;
  language: string;
  avoidsInternalLanguage: boolean;
}

export interface CouplePrivacySummary {
  scope: { eventId: string; eventTitle: string; access: string };
  policyPack: { allowed: string[]; blocked: string[] };
  fieldFiltering: Record<string, string[]>;
  exports: Array<{ label: string; href: string }>;
  secureGuestLinks: string;
  collaboratorControls: CoupleRequest[];
}


export interface CoupleAdvancedPlanningSummary {
  plan: Record<string, any>;
  progress: { completeCount: number; total: number; percent: number };
  storage?: { normalizedSections: string[]; metadataSections: string[] };
  aiConcierge: { mode: string; answers: Array<{ question: string; answer: string; approvedByVenue: boolean }>; escalations: CoupleRequest[] };
  venueLinks: { spaces: Array<Record<string, any>>; inventory: Array<Record<string, any>>; visibleAddOns: Array<Record<string, any>> };
  modules: Array<{ key: string; label: string; priority: 'P2' | 'P3'; tiedTo: string[] }>;
  exports: Array<{ label: string; href: string }>;
}

export interface CouplePostEventSummary {
  event: { id: string; title: string; weddingDate: string | null; daysSinceWedding: number | null };
  closeoutItems: Array<{ key: string; label: string; status: string; detail: string }>;
  finalInvoice: { status: string; openBalanceCents: number; payments: Array<Record<string, any>> };
  damageDeposit: { status: string; amountCents: number; note: string };
  survey: Record<string, any> | null;
  nps: { score: number | null; label: string };
  debriefQuestions: string[];
  reviewWorkflow: { status: string; platformLinks: Record<string, string>; consentRequired: boolean; existingReview: Record<string, any> | null };
  photoSharing: { links: Array<{ label: string; url: string }>; galleryDocuments: Array<Record<string, any>>; uploadCategory: 'post_event_gallery' };
  thankYouMessage: string;
  anniversaryNurture: { optedIn: boolean; nextTouchDate: string | null; note: string };
  requests: CoupleRequest[];
  finalPacketUrl: string;
  hiddenInternalFields: string[];
}

export interface CouplePostEventSurveyInput {
  npsScore: number;
  overallRating?: number;
  whatWentWell?: string;
  whatCouldImprove?: string;
  teamShoutouts?: string;
  privateFeedback?: string;
  publicTestimonial?: string;
  mayUseTestimonial?: boolean;
  permissionToContact?: boolean;
  photoGalleryUrl?: string;
  memoryShareUrl?: string;
  anniversaryOptIn?: boolean;
}

export interface CouplePostEventReviewQueue {
  event: { id: string; title: string; weddingDate: string | null };
  requests: Array<CoupleRequest & { assignment?: { assignedTo: string | null; assignedAt: string | null; assignedBy: string | null }; sla?: { dueAt: string | null; status: string }; followUp?: { lastFollowUpAt: string | null; lastFollowUpChannel: string | null; followUpCount: number } }>;
  openRequests: Array<CoupleRequest & { assignment?: { assignedTo: string | null; assignedAt: string | null; assignedBy: string | null }; sla?: { dueAt: string | null; status: string }; followUp?: { lastFollowUpAt: string | null; lastFollowUpChannel: string | null; followUpCount: number } }>;
  reviewLinks: Record<string, string>;
  configuredReviewLinks: number;
  nps: { totalResponses: number; averageScore: number | null; promoters: number; detractors: number };
  closeoutApprovals: { lostItemsOpen: number; testimonialsAwaitingConsent: number; feedbackToDebrief: number };
  privacyBoundaries: string[];
}

export interface CoupleAppointment {
  id: string;
  appointmentType: 'tasting' | 'planning_meeting' | 'final_walkthrough' | 'rehearsal' | 'payment' | 'tour' | 'other';
  title: string;
  status: 'requested' | 'confirmed' | 'reschedule_requested' | 'cancel_requested' | 'completed' | 'cancelled';
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  note: string | null;
  preparation: string[];
  reminders: Array<Record<string, unknown>>;
  availabilityWindow: string | null;
  providerSync: Record<string, unknown>;
  signoff: Record<string, unknown>;
  updatedAt: string;
}

export interface CoupleCalendarSummary {
  appointments: CoupleAppointment[];
  calendarItems: Array<{ source: string; id: string; title: string; startsAt: string | null; endsAt: string | null; status: string; type: string }>;
  availabilityWindows: Record<string, string>;
  providerSync: { status: string; note: string };
}

export interface CoupleInboxSummary {
  threads: Array<{ type: string; label: string; expectedResponse: string; threadId: string; unread: number; messages: any[] }>;
  decisions: CoupleRequest[];
  venueContact: { name: string; email: string | null; expectedResponse: string };
  templates: Array<{ id: string; label: string; body: string }>;
  notificationSummary: { newVenueMessages: number; dueTasks: number };
  aiDraft: string;
}

export interface CoupleNotificationPreferences {
  email_enabled?: 0 | 1;
  sms_enabled?: 0 | 1;
  in_app_enabled?: 0 | 1;
  digest_frequency?: 'instant' | 'daily' | 'weekly' | 'off';
  quiet_hours?: string;
  decision_alerts?: 0 | 1;
  due_task_alerts?: 0 | 1;
  message_alerts?: 0 | 1;
}

export interface CoupleDocument {
  id: string;
  filename: string;
  url: string;
  mimeType: string | null;
  category: 'inspiration_photo' | 'insurance' | 'vendor_doc' | 'ceremony_doc' | 'playlist' | 'diagram' | 'permit' | 'guest_list' | 'menu' | 'contract' | 'post_event_gallery' | 'other';
  visibility: 'couple' | 'couple_venue' | 'planner' | 'vendor' | 'guest_visible';
  approvalStatus: 'draft' | 'pending' | 'approved' | 'changes_requested' | 'rejected';
  version: number;
  notes: string | null;
  extractedSummary: string | null;
  history: Array<{ at: string; actor: string; action: string; note?: string }>;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoupleDocumentsSummary {
  documents: CoupleDocument[];
  counts: Record<string, number>;
  reviewQueue: CoupleDocument[];
  postEventGallery: CoupleDocument[];
  allowedTypes: string[];
  maxBytes: number;
  categories: string[];
  visibilityOptions: string[];
}

export interface CoupleDesignPreferences {
  ceremonyStyle?: string;
  rainPlanPreference?: string;
  floorplanPreference?: string;
  linens?: string;
  colors?: string;
  barMenuNotes?: string;
  signage?: string;
  rentals?: string;
  musicRestrictions?: string;
  culturalTraditions?: string;
  tastingMenuSelections?: string;
  allergySummary?: string;
  ceremonyScriptNotes?: string;
  processionalNotes?: string;
  vipFamily?: string;
  weddingParty?: string;
  photoShotList?: string;
  moodBoardLinks?: string;
}

export interface CoupleDesignSummary {
  preferences: CoupleDesignPreferences;
  progress: { completeCount: number; total: number; percent: number };
  storage?: { normalizedSections: string[]; metadataSections: string[] };
  review: { status: string; requestId: string | null; updatedAt: string | null; updatedBy: string | null };
  moodBoard: string[];
  aiSummary: string;
  venueTemplateHints: string[];
}

export interface CoupleFinanceSummary {
  contracts: Array<{ id: string; title: string; status: string; recipientName: string; amountCents: number | null; sentAt: string | null; signedAt: string | null; signedCertificate: any; nextStep: string; clauseExplainers: Array<{ label: string; plainLanguage: string }> }>;
  payments: Array<{ id: string; amountCents: number; status: string; dueDate: string | null; paidAt: string | null; paymentUrl: string | null; label: string; receiptUrl: string | null; explanation: string }>;
  totals: { contractedCents: number; scheduledPaymentCents: number; paidCents: number; pendingCents: number; openBalanceCents: number };
  refundCancellationPolicy: string;
  paymentScheduleExplanation: string;
  hiddenFields: string[];
  changeOrders: CoupleRequest[];
  questions: CoupleRequest[];
  paymentMethodVault: { status: string; note: string };
}

export interface CoupleVendorSummary {
  id: string;
  name: string;
  category: string;
  contactPreference: string;
  publicContactName: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  websiteUrl: string | null;
  isPreferred: boolean;
  bookedStatus: string;
  confirmedStatus: string;
  arrival: string | null;
  notesForCouple: string;
  visibleDocuments: Array<{ title: string; type: string; url: string | null }>;
}

export interface CoupleVendorBoard {
  vendors: CoupleVendorSummary[];
  planner: { name: string | null; email: string | null; phone: string | null; status: string };
  requests: CoupleRequest[];
  recommendationsEnabled: boolean;
  visibleDocumentTypes: string[];
  hiddenFields: string[];
  comparison: Array<{ id: string; name: string; category: string; status: string; documents: number }>;
}

export interface CoupleLayoutSummary {
  layout: { id: string; name: string; approvalStatus: string; revision: number; updatedAt: string } | null;
  summary: { tables: number; seats: number; assignedSeats: number; unseatedGuests: number; duplicateSeatAssignments: number; vendorZones: number; exits: number; adaRoutes: number };
  visibleItems: Record<string, Array<Record<string, any>>>;
  seating: { unseatedGuests: CoupleGuest[]; duplicateSeatAssignments: string[]; tableAssignments: Array<{ guestId: string; fullName: string; tableAssignment: string | null; seatAssignment: string | null; tags: string[] }> };
  comments: CoupleRequest[];
  approval: { status: string; note: string | null; updatedAt: string | null; updatedBy?: string };
  versionHistory: Array<{ revision: number; createdAt: string; summary: string }>;
  guidance: string[];
  walkthrough3d: { status: string; note: string };
}

export interface CoupleTimelineItem {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  durationMin: number | null;
  location: string | null;
  notes: string | null;
}

export interface CoupleTimelineSummary {
  items: CoupleTimelineItem[];
  hiddenInternalCount: number;
  subEvents: Array<{ id: string; title: string; startsAt: string; endsAt: string | null; inviteOnly: boolean }>;
  rehearsal: any;
  approval: { status: string; note: string | null; updatedAt: string | null; updatedBy?: string };
  changeRequests: CoupleRequest[];
  versionHistory: Array<{ at: string; summary: string }>;
  education: string[];
}

export interface CoupleGuestPortalSummary {
  portal: { enabled: boolean; publicUrl: string; couplePlanningPortalUrl: string; rsvpDeadline: string | null; editWindowDays: number | null; access: any; config: Record<string, any> };
  approvalStatus: string;
  reminderStatus: string;
  guestsWillSee: string[];
  guestsWillNotSee: string[];
  mobileQa: string[];
  qrPayload: string;
}

export const coupleSdk = {
  reminders(eventId: string): Promise<CoupleReminderSummary> {
    return api.get(`/api/events/${eventId}/couple-reminders`);
  },
  sendReminderDigest(eventId: string): Promise<{ digest: string; sent: boolean; historyId: string }> {
    return api.post(`/api/events/${eventId}/couple-reminders/digest`, {});
  },
  privacy(eventId: string): Promise<CouplePrivacySummary> {
    return api.get(`/api/events/${eventId}/couple-privacy`);
  },
  advancedPlanning(eventId: string): Promise<CoupleAdvancedPlanningSummary> {
    return api.get(`/api/events/${eventId}/couple-advanced-planning`);
  },
  saveAdvancedPlanning(eventId: string, input: Record<string, unknown>): Promise<CoupleAdvancedPlanningSummary> {
    return api.patch(`/api/events/${eventId}/couple-advanced-planning`, input);
  },
  escalateAdvancedPlanning(eventId: string, input: { question: string; moduleKey?: string; urgency?: 'normal' | 'time_sensitive' }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-advanced-planning/concierge/escalate`, input);
  },
  postEvent(eventId: string): Promise<CouplePostEventSummary> {
    return api.get(`/api/events/${eventId}/couple-post-event`);
  },
  submitPostEventSurvey(eventId: string, input: CouplePostEventSurveyInput): Promise<{ summary: CouplePostEventSummary; request: CoupleRequest }> {
    return api.patch(`/api/events/${eventId}/couple-post-event/survey`, input);
  },
  reportLostItem(eventId: string, input: { itemDescription: string; lastSeenLocation?: string; contactPreference?: 'email' | 'phone' | 'either'; contactValue?: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-post-event/lost-item`, input);
  },
  submitReviewWorkflow(eventId: string, input: { platform?: 'google' | 'the_knot' | 'weddingwire' | 'zola' | 'other'; rating?: number; testimonial?: string; permissionToPublish?: boolean; reviewerName?: string }): Promise<{ request: CoupleRequest; review: Record<string, any> }> {
    return api.post(`/api/events/${eventId}/couple-post-event/review`, input);
  },
  postEventReviewQueue(eventId: string): Promise<CouplePostEventReviewQueue> {
    return api.get(`/api/events/${eventId}/couple-post-event/review-queue`);
  },
  updatePostEventReviewLinks(eventId: string, input: Record<string, string>): Promise<{ reviewLinks: Record<string, string>; updatedAt: string; updatedBy: string }> {
    return api.patch(`/api/events/${eventId}/couple-post-event/review-links`, input);
  },
  bulkUpdatePostEventReviewQueue(eventId: string, input: { requestIds: string[]; status?: CoupleRequestStatus; assignedTo?: string; slaDays?: number; note?: string }): Promise<{ updated: CouplePostEventReviewQueue['requests']; count: number }> {
    return api.patch(`/api/events/${eventId}/couple-post-event/review-queue/bulk`, input);
  },
  queuePostEventFollowUp(eventId: string, input: { requestIds: string[]; channel?: 'email' | 'sms' | 'in_app'; message: string }): Promise<{ queued: Array<{ requestId: string; historyId: string; jobId: string | null; dispatchStatus: string; recipient: string | null }>; count: number; channel: string; dispatchedJobs: number }> {
    return api.post(`/api/events/${eventId}/couple-post-event/review-queue/follow-up`, input);
  },
  calendar(eventId: string): Promise<CoupleCalendarSummary> {
    return api.get(`/api/events/${eventId}/couple-calendar`);
  },
  requestAppointment(eventId: string, input: { appointmentType: CoupleAppointment['appointmentType']; title?: string; startsAt?: string; endsAt?: string; location?: string; note?: string; availabilityWindow?: string }): Promise<{ appointment: CoupleAppointment }> {
    return api.post(`/api/events/${eventId}/couple-appointments`, input);
  },
  updateAppointment(eventId: string, appointmentId: string, input: { status: CoupleAppointment['status']; note?: string }): Promise<{ appointment: CoupleAppointment }> {
    return api.patch(`/api/events/${eventId}/couple-appointments/${appointmentId}`, input);
  },
  signoffAppointment(eventId: string, appointmentId: string, note?: string): Promise<{ appointment: CoupleAppointment }> {
    return api.post(`/api/events/${eventId}/couple-appointments/${appointmentId}/signoff`, { note });
  },
  inbox(eventId: string): Promise<CoupleInboxSummary> {
    return api.get(`/api/events/${eventId}/couple-inbox`);
  },
  sendInboxMessage(eventId: string, input: { threadType?: 'venue' | 'planner' | 'urgent' | 'decision'; body: string; urgency?: 'normal' | 'urgent' }): Promise<{ message: any }> {
    return api.post(`/api/events/${eventId}/couple-inbox/messages`, input);
  },
  createDecision(eventId: string, input: { title: string; detail?: string; dueDate?: string }): Promise<{ decision: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-inbox/decisions`, input);
  },
  notificationPreferences(eventId: string): Promise<{ preferences: CoupleNotificationPreferences }> {
    return api.get(`/api/events/${eventId}/couple-notification-preferences`);
  },
  updateNotificationPreferences(eventId: string, input: { emailEnabled?: boolean; smsEnabled?: boolean; inAppEnabled?: boolean; digestFrequency?: 'instant' | 'daily' | 'weekly' | 'off'; quietHours?: Record<string, unknown>; decisionAlerts?: boolean; dueTaskAlerts?: boolean; messageAlerts?: boolean }): Promise<{ preferences: CoupleNotificationPreferences }> {
    return api.patch(`/api/events/${eventId}/couple-notification-preferences`, input);
  },
  documents(eventId: string): Promise<CoupleDocumentsSummary> {
    return api.get(`/api/events/${eventId}/couple-documents`);
  },
  uploadDocument(eventId: string, input: { filename: string; dataUri: string; mimeType?: string; category: CoupleDocument['category']; visibility?: CoupleDocument['visibility']; notes?: string }): Promise<{ document: CoupleDocument }> {
    return api.post(`/api/events/${eventId}/couple-documents`, input);
  },
  updateDocument(eventId: string, documentId: string, input: Partial<{ category: CoupleDocument['category']; visibility: CoupleDocument['visibility']; approvalStatus: CoupleDocument['approvalStatus']; notes: string }>): Promise<{ document: CoupleDocument | null }> {
    return api.patch(`/api/events/${eventId}/couple-documents/${documentId}`, input);
  },
  uploadDocumentVersion(eventId: string, documentId: string, input: { filename: string; dataUri: string; mimeType?: string; notes?: string }): Promise<{ document: CoupleDocument | null }> {
    return api.post(`/api/events/${eventId}/couple-documents/${documentId}/version`, input);
  },
  templateGallery(eventId: string): Promise<{ templates: Array<{ id: string; name: string; moment: string; serviceStyle: string | null; minGuests: number; maxGuests: number; recommended: boolean; description: string; venueId: string | null }>; guestCount: number; spaces: Array<{ id: string; name: string; category: string; capacity: number }> }> { return api.get(`/api/events/${eventId}/couple-template-gallery`); },
  design(eventId: string): Promise<CoupleDesignSummary> {
    return api.get(`/api/events/${eventId}/couple-design`);
  },
  saveDesign(eventId: string, input: CoupleDesignPreferences): Promise<{ preferences: CoupleDesignPreferences; progress: { percent: number }; reviewStatus: string; aiSummary: string }> {
    return api.patch(`/api/events/${eventId}/couple-design`, input);
  },
  submitDesignReview(eventId: string, note?: string): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-design/submit-review`, { note });
  },
  finance(eventId: string): Promise<CoupleFinanceSummary> {
    return api.get(`/api/events/${eventId}/couple-finance`);
  },
  askFinanceQuestion(eventId: string, input: { sourceType?: 'contract' | 'invoice' | 'payment' | 'change_order' | 'general'; sourceId?: string; question: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-finance/question`, input);
  },
  requestChangeOrder(eventId: string, input: { changeType: 'extra_hour' | 'room_block' | 'ceremony_upgrade' | 'bar_package' | 'rental_upgrade' | 'other'; label: string; estimatedAmountCents?: number; note?: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-finance/change-order`, input);
  },
  signContract(eventId: string, contractId: string, signature: string): Promise<{ contract: CoupleFinanceSummary['contracts'][number] | null }> {
    return api.post(`/api/events/${eventId}/couple-finance/contracts/${contractId}/sign`, { signature });
  },
  vendors(eventId: string): Promise<CoupleVendorBoard> {
    return api.get(`/api/events/${eventId}/couple-vendors`);
  },
  requestVendor(eventId: string, input: { category: string; note?: string; preferredVendorId?: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-vendors/request`, input);
  },
  askVendorQuestion(eventId: string, input: { vendorId?: string; question: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-vendors/question`, input);
  },
  requestPlannerCollaboration(eventId: string, input: { plannerName?: string; plannerEmail?: string; note?: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-planner/collaboration-request`, input);
  },
  layout(eventId: string): Promise<CoupleLayoutSummary> {
    return api.get(`/api/events/${eventId}/couple-layout`);
  },
  addLayoutComment(eventId: string, input: { x?: number; y?: number; areaLabel?: string; note: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-layout/comment`, input);
  },
  setLayoutApproval(eventId: string, input: { status: 'approved' | 'changes_requested'; note?: string }): Promise<{ approval: CoupleLayoutSummary['approval'] }> {
    return api.post(`/api/events/${eventId}/couple-layout/approval`, input);
  },
  updateSeating(eventId: string, guestId: string, input: { tableAssignment?: string | null; seatAssignment?: string | null; note?: string }): Promise<{ guest: CoupleGuest | null }> {
    return api.patch(`/api/events/${eventId}/couple-guests/${guestId}/seating`, input);
  },
  timeline(eventId: string): Promise<CoupleTimelineSummary> {
    return api.get(`/api/events/${eventId}/couple-timeline`);
  },
  requestTimelineChange(eventId: string, input: { timelineItemId?: string; requestedChange: string; reason?: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-timeline/request-change`, input);
  },
  setTimelineApproval(eventId: string, input: { status: 'approved' | 'changes_requested'; note?: string }): Promise<{ approval: CoupleTimelineSummary['approval'] }> {
    return api.post(`/api/events/${eventId}/couple-timeline/approval`, input);
  },
  guestPortal(eventId: string): Promise<CoupleGuestPortalSummary> {
    return api.get(`/api/events/${eventId}/couple-guest-portal`);
  },
  requestGuestPortalUpdate(eventId: string, input: { config: Record<string, unknown>; note?: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-guest-portal/request-update`, input);
  },
  requestRsvpReminder(eventId: string, input: { sendAt?: string; audience?: 'not_responded' | 'missing_meal' | 'all_guests'; messagePreview: string }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-guest-portal/reminder-request`, input);
  },
  generateGuestPortalLink(eventId: string, guestId: string): Promise<{ url: string; token: string; qrPayload: string }> {
    return api.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {});
  },
  guests(eventId: string): Promise<{ guests: CoupleGuest[]; counts: Record<string, number>; households: Array<{ name: string; members: CoupleGuest[]; count: number }>; filters: Record<string, number>; duplicateSuggestions: Array<{ signal: string; value: string; guests: Array<{ id: string; fullName: string }> }>; privacy: Record<string, string> }> {
    return api.get(`/api/events/${eventId}/couple-guests`);
  },
  createGuest(eventId: string, input: Partial<CoupleGuest> & { fullName: string }): Promise<{ guest: CoupleGuest }> {
    return api.post(`/api/events/${eventId}/couple-guests`, input);
  },
  updateGuest(eventId: string, guestId: string, input: Partial<CoupleGuest>): Promise<{ guest: CoupleGuest | null }> {
    return api.patch(`/api/events/${eventId}/couple-guests/${guestId}`, input);
  },
  importPreview(eventId: string, csv: string): Promise<{ rowCount: number; headers: string[]; warnings: string[]; duplicateSignals: string[]; householdSuggestions: string[]; willSave: boolean }> {
    return api.post(`/api/events/${eventId}/couple-guests/import-preview`, { csv });
  },
  planning(eventId: string): Promise<{ tasks: CouplePlanningTask[]; template: { packageKey: string; cultureKey: string; source: string } }> {
    return api.get(`/api/events/${eventId}/couple-planning`);
  },
  updatePlanningTask(eventId: string, taskId: string, input: Partial<{ status: CouplePlanningTask['status']; approvalStatus: CouplePlanningTask['approvalStatus']; dueDate: string | null; attachments: CouplePlanningTask['attachments']; note: string }>): Promise<{ task: CouplePlanningTask }> {
    return api.patch(`/api/events/${eventId}/couple-planning/${taskId}`, input);
  },
  askPlanningTaskQuestion(eventId: string, taskId: string, question: string): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-planning/${taskId}/question`, { question });
  },
  getProfile(eventId: string): Promise<{ profile: CoupleProfile; lastUpdatedAt: string | null; lastUpdatedBy: string | null }> {
    return api.get(`/api/events/${eventId}/couple-profile`);
  },
  updateProfile(eventId: string, profile: CoupleProfile): Promise<{ profile: CoupleProfile; lastUpdatedAt: string | null; lastUpdatedBy: string | null }> {
    return api.patch(`/api/events/${eventId}/couple-profile`, profile);
  },
  listRequests(eventId: string): Promise<{ requests: CoupleRequest[]; canReview: boolean }> {
    return api.get(`/api/events/${eventId}/couple-requests`);
  },
  createRequest(eventId: string, input: { requestType: CoupleRequestType; targetEmail?: string; targetName?: string; note?: string; metadata?: Record<string, unknown> }): Promise<{ request: CoupleRequest }> {
    return api.post(`/api/events/${eventId}/couple-requests`, input);
  },
  updateRequest(eventId: string, requestId: string, input: { status: CoupleRequestStatus; note?: string; metadata?: Record<string, unknown> }): Promise<{ request: CoupleRequest }> {
    return api.patch(`/api/events/${eventId}/couple-requests/${requestId}`, input);
  },
};
