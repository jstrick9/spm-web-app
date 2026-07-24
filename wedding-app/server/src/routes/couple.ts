import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, assetsRepo, catalogRepo, contractsRepo, coupleAppointmentsRepo, coupleDocumentsRepo, couplePlanningRepo, coupleRequestsRepo, eventsRepo, guestsRepo, layoutsRepo, inventoryRepo, jobsRepo, messagesRepo, paymentLinksRepo, portalConfigRepo, rolesRepo, subEventsRepo, timelineRepo, usersRepo, vendorsRepo, venuesRepo } from '../db/repos/index.js';
import { saveDocumentDataUri, privateFilePath } from '../lib/fileStorage.js';
import { createReadStream, existsSync } from 'node:fs';
import { db } from '../db/database.js';
import { uuid } from '../lib/crypto.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const createRequestSchema = z.object({
  requestType: z.enum(['partner_invite', 'planner_request', 'account_recovery', 'identity_verification','venue_question','event_change_request','guest_portal_update','rsvp_reminder_request']),
  targetEmail: z.string().email().optional(),
  targetName: z.string().max(120).optional(),
  note: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled']),
  note: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const coupleTimelineChangeSchema = z.object({
  timelineItemId: z.string().optional(),
  requestedChange: z.string().min(1).max(2000),
  reason: z.string().max(2000).optional(),
});

const coupleTimelineApprovalSchema = z.object({
  status: z.enum(['approved', 'changes_requested']),
  note: z.string().max(2000).optional(),
});

const coupleLayoutCommentSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  areaLabel: z.string().max(200).optional(),
  note: z.string().min(1).max(2000),
});

const coupleLayoutApprovalSchema = z.object({
  status: z.enum(['approved', 'changes_requested']),
  note: z.string().max(2000).optional(),
});

const appointmentRequestSchema = z.object({
  appointmentType: z.enum(['tasting','planning_meeting','final_walkthrough','rehearsal','payment','tour','other']),
  title: z.string().max(200).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  location: z.string().max(300).optional(),
  note: z.string().max(2000).optional(),
  availabilityWindow: z.string().max(500).optional(),
});

const appointmentStatusSchema = z.object({
  status: z.enum(['reschedule_requested','cancel_requested','completed','cancelled','confirmed']),
  note: z.string().max(2000).optional(),
});

const appointmentSignoffSchema = z.object({
  note: z.string().max(2000).optional(),
});

const coupleInboxMessageSchema = z.object({ 
  threadType: z.enum(['venue', 'planner', 'urgent', 'decision']).default('venue'),
  body: z.string().min(1).max(10000),
  urgency: z.enum(['normal','urgent']).default('normal'),
});

const coupleDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
});

const notificationPrefsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['instant','daily','weekly','off']).optional(),
  quietHours: z.record(z.unknown()).optional(),
  decisionAlerts: z.boolean().optional(),
  dueTaskAlerts: z.boolean().optional(),
  messageAlerts: z.boolean().optional(),
});

const postEventSurveySchema = z.object({
  npsScore: z.number().int().min(0).max(10),
  overallRating: z.number().int().min(1).max(5).optional(),
  whatWentWell: z.string().max(2500).optional(),
  whatCouldImprove: z.string().max(2500).optional(),
  teamShoutouts: z.string().max(1500).optional(),
  privateFeedback: z.string().max(2500).optional(),
  publicTestimonial: z.string().max(1500).optional(),
  mayUseTestimonial: z.boolean().optional(),
  permissionToContact: z.boolean().optional(),
  photoGalleryUrl: z.string().url().optional().or(z.literal('')),
  memoryShareUrl: z.string().url().optional().or(z.literal('')),
  anniversaryOptIn: z.boolean().optional(),
});

const postEventLostItemSchema = z.object({
  itemDescription: z.string().min(1).max(1200),
  lastSeenLocation: z.string().max(500).optional(),
  contactPreference: z.enum(['email','phone','either']).default('email'),
  contactValue: z.string().max(254).optional(),
});

const postEventReviewSchema = z.object({
  platform: z.enum(['google','the_knot','weddingwire','zola','other']).default('google'),
  rating: z.number().int().min(1).max(5).optional(),
  testimonial: z.string().max(2000).optional(),
  permissionToPublish: z.boolean().optional(),
  reviewerName: z.string().max(160).optional(),
});

const postEventReviewLinksSchema = z.object({
  google: z.string().url().optional().or(z.literal('')),
  theKnot: z.string().url().optional().or(z.literal('')),
  weddingwire: z.string().url().optional().or(z.literal('')),
  zola: z.string().url().optional().or(z.literal('')),
  other: z.string().url().optional().or(z.literal('')),
});

const postEventBulkActionSchema = z.object({
  requestIds: z.array(z.string()).min(1).max(50),
  status: z.enum(['pending','approved','rejected','completed','cancelled']).optional(),
  assignedTo: z.string().email().optional().or(z.literal('')),
  slaDays: z.number().int().min(1).max(30).optional(),
  note: z.string().max(2000).optional(),
});

const postEventFollowUpSchema = z.object({
  requestIds: z.array(z.string()).min(1).max(50),
  channel: z.enum(['email','sms','in_app']).default('email'),
  message: z.string().min(1).max(2000),
});


const advancedPlanningSchema = z.object({
  visionBoard: z.record(z.unknown()).optional(),
  budgetEstimator: z.record(z.unknown()).optional(),
  ceremony: z.record(z.unknown()).optional(),
  weddingParty: z.record(z.unknown()).optional(),
  vipNotes: z.record(z.unknown()).optional(),
  photoShotList: z.record(z.unknown()).optional(),
  music: z.record(z.unknown()).optional(),
  signage: z.record(z.unknown()).optional(),
  transportation: z.record(z.unknown()).optional(),
  accessibility: z.record(z.unknown()).optional(),
  culturalTraditions: z.record(z.unknown()).optional(),
  rainPlan: z.record(z.unknown()).optional(),
  travelMicrosite: z.record(z.unknown()).optional(),
  weddingWeekendMode: z.record(z.unknown()).optional(),
  vendorMarketplace: z.record(z.unknown()).optional(),
  memoryBook: z.record(z.unknown()).optional(),
});

const conciergeEscalationSchema = z.object({
  question: z.string().min(1).max(2000),
  moduleKey: z.string().max(80).optional(),
  urgency: z.enum(['normal','time_sensitive']).default('normal'),
});

const coupleDocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  dataUri: z.string().min(1).max(2_000_000),
  mimeType: z.string().max(120).optional(),
  category: z.enum(['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other']),
  visibility: z.enum(['couple','couple_venue','planner','vendor','guest_visible']).default('couple_venue'),
  notes: z.string().max(2000).optional(),
});

const coupleDocumentUpdateSchema = z.object({
  category: z.enum(['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other']).optional(),
  visibility: z.enum(['couple','couple_venue','planner','vendor','guest_visible']).optional(),
  approvalStatus: z.enum(['draft','pending','approved','changes_requested','rejected']).optional(),
  notes: z.string().max(2000).optional(),
});

const financeQuestionSchema = z.object({ 
  sourceType: z.enum(['contract','invoice','payment','change_order','general']).default('general'),
  sourceId: z.string().optional(),
  question: z.string().min(1).max(2000),
});

const changeOrderSchema = z.object({
  changeType: z.enum(['extra_hour','room_block','ceremony_upgrade','bar_package','rental_upgrade','other']),
  label: z.string().min(1).max(200),
  estimatedAmountCents: z.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
});

const coupleContractSignSchema = z.object({
  signature: z.string().min(1).max(500),
});

const coupleSeatingSchema = z.object({
  tableAssignment: z.string().max(60).optional().nullable(),
  seatAssignment: z.string().max(60).optional().nullable(),
  note: z.string().max(1000).optional(),
});

const coupleGuestSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(254).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  partyName: z.string().max(200).optional(),
  mailingAddress: z.string().max(500).optional(),
  mealChoice: z.string().max(120).optional(),
  rsvpStatus: z.enum(['pending','attending','declined','maybe']).optional(),
  dietaryRestrictions: z.string().max(2000).optional(),
  accessibilityNotes: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.enum(['vip','family','wedding_party','child','vendor_meal','accessibility_support','shuttle','lodging'])).optional(),
  householdName: z.string().max(200).optional(),
  plusOneAllowed: z.boolean().optional(),
});

const importPreviewSchema = z.object({
  csv: z.string().min(1).max(200_000),
});

const updatePlanningTaskSchema = z.object({
  status: z.enum(['not_started','in_progress','completed','blocked']).optional(),
  approvalStatus: z.enum(['not_required','pending','approved','changes_requested']).optional(),
  dueDate: z.string().optional().nullable(),
  attachments: z.array(z.object({ name: z.string().max(200), url: z.string().max(2000).optional(), note: z.string().max(1000).optional() })).optional(),
  note: z.string().max(2000).optional(),
});

const coupleDesignPreferencesSchema = z.object({
  ceremonyStyle: z.string().max(500).optional(),
  rainPlanPreference: z.string().max(500).optional(),
  floorplanPreference: z.string().max(500).optional(),
  linens: z.string().max(500).optional(),
  colors: z.string().max(500).optional(),
  barMenuNotes: z.string().max(1200).optional(),
  signage: z.string().max(1200).optional(),
  rentals: z.string().max(1200).optional(),
  musicRestrictions: z.string().max(1200).optional(),
  culturalTraditions: z.string().max(1200).optional(),
  tastingMenuSelections: z.string().max(1200).optional(),
  allergySummary: z.string().max(1200).optional(),
  ceremonyScriptNotes: z.string().max(1200).optional(),
  processionalNotes: z.string().max(1200).optional(),
  vipFamily: z.string().max(1200).optional(),
  weddingParty: z.string().max(1200).optional(),
  photoShotList: z.string().max(1200).optional(),
  moodBoardLinks: z.string().max(3000).optional(),
});

const coupleProfileSchema = z.object({
  coupleNames: z.string().max(240).optional(),
  pronouns: z.string().max(120).optional(),
  primaryPhone: z.string().max(60).optional(),
  secondaryPhone: z.string().max(60).optional(),
  mailingAddress: z.string().max(500).optional(),
  plannerName: z.string().max(160).optional(),
  plannerEmail: z.string().email().optional().or(z.literal('')),
  plannerPhone: z.string().max(60).optional(),
  vipFamilyContacts: z.string().max(1200).optional(),
});

function parseEventMetadata(event: { metadata: string }): Record<string, any> {
  try { return JSON.parse(event.metadata || '{}'); } catch { return {}; }
}

function isCoupleTimelineItem(item: ReturnType<typeof timelineRepo.listForEvent>[number]) {
  const category = String(item.category || '').toLowerCase();
  const title = `${item.title} ${item.notes || ''}`.toLowerCase();
  const hidden = ['vendor_arrival', 'load_out', 'load_in', 'prep', 'setup', 'strike', 'staff', 'incident', 'internal'];
  return !hidden.some((term) => category.includes(term) || title.includes(term));
}

function safeTimelineItem(item: ReturnType<typeof timelineRepo.listForEvent>[number]) {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    durationMin: item.duration_min,
    location: item.location,
    notes: item.notes,
  };
}

function layoutItems(layout: ReturnType<typeof layoutsRepo.listForOrg>[number] | null | undefined): Array<Record<string, any>> {
  if (!layout) return [];
  try {
    const payload = typeof layout.payload === 'string' ? JSON.parse(layout.payload || '{}') : layout.payload;
    return Array.isArray(payload.items) ? payload.items : [];
  } catch { return []; }
}

function itemLabel(item: Record<string, any>) {
  return String(item.label || item.name || item.title || item.type || 'Item');
}

function summarizeLayoutItem(item: Record<string, any>) {
  const type = String(item.type || 'item');
  const label = itemLabel(item);
  return {
    id: String(item.id || `${type}-${label}`),
    type,
    label,
    x: Number(item.x || 0),
    y: Number(item.y || 0),
    width: Number(item.width || item.radius ? (item.width || Number(item.radius) * 2) : 0),
    height: Number(item.height || item.radius ? (item.height || Number(item.radius) * 2) : 0),
    guestId: item.guestId ?? null,
    guestName: item.guestName ?? null,
  };
}

function extractDocumentSummary(input: { filename: string; category: string; notes?: string }) {
  const haystack = `${input.filename} ${input.category} ${input.notes || ''}`.toLowerCase();
  const hints: string[] = [];
  if (/guest|rsvp|spreadsheet|csv/.test(haystack)) hints.push('Possible guest list spreadsheet: review names, emails, household groups, RSVP status, meal choices, and accessibility notes before import.');
  if (/contract|agreement|pdf/.test(haystack)) hints.push('Possible contract/agreement: review payment schedule, cancellation/refund, overtime, and signature status.');
  if (/menu|tasting|allerg/.test(haystack)) hints.push('Possible menu/tasting document: review menu selections, allergies, bar notes, and catering questions.');
  if (/ceremony|script|processional/.test(haystack)) hints.push('Possible ceremony document: review processional order, readings, music cues, and officiant notes.');
  if (/playlist|music/.test(haystack)) hints.push('Possible music/playlist document: review must-play, do-not-play, ceremony music, and special dances.');
  if (/permit|insurance/.test(haystack)) hints.push('Possible compliance document: venue should verify approval/expiration before event day.');
  return hints.length ? hints.join('\n') : 'Document uploaded for venue review. No automated extraction hints matched; review filename, notes, and category.';
}

function safeDocument(row: ReturnType<typeof coupleDocumentsRepo.listForEvent>[number]) {
  return {
    id: row.id,
    filename: row.filename,
    url: `/api/events/${row.event_id}/couple-documents/${row.id}/content`,
    mimeType: row.mime_type,
    category: row.category,
    visibility: row.visibility,
    approvalStatus: row.approval_status,
    version: row.version,
    notes: row.notes,
    extractedSummary: row.extracted_summary,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    history: (() => { try { return JSON.parse(row.history || '[]'); } catch { return []; } })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contractClauseExplainers(content: string) {
  const lower = content.toLowerCase();
  const clauses: Array<{ label: string; plainLanguage: string }> = [];
  if (/payment|deposit|balance|installment/.test(lower)) clauses.push({ label: 'Payment schedule', plainLanguage: 'Shows when deposits, installments, or final balance are expected.' });
  if (/cancel|refund|non-refundable/.test(lower)) clauses.push({ label: 'Cancellation / refund', plainLanguage: 'Explains what happens if the event is cancelled or changed.' });
  if (/overtime|extra hour|additional hour/.test(lower)) clauses.push({ label: 'Extra time / overtime', plainLanguage: 'Explains costs or approval needed for extra event time.' });
  if (/damage|security deposit/.test(lower)) clauses.push({ label: 'Damage / security deposit', plainLanguage: 'Explains deposit, damage, or post-event charge policies.' });
  if (/alcohol|bar/.test(lower)) clauses.push({ label: 'Bar / alcohol', plainLanguage: 'Explains venue requirements for alcohol service and bar packages.' });
  return clauses;
}

function safeContract(row: ReturnType<typeof contractsRepo.listForEvent>[number]) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    recipientName: row.recipient_name,
    amountCents: row.amount_cents,
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    signedCertificate: row.signed_at ? { signer: row.recipient_name, signedAt: row.signed_at, signerIp: row.signer_ip } : null,
    nextStep: row.status === 'signed' ? 'Signed copy is on file.' : row.status === 'sent' ? 'Review and sign when ready.' : 'Venue is preparing this document.',
    clauseExplainers: contractClauseExplainers(row.content || ''),
  };
}

function safePayment(row: ReturnType<typeof paymentLinksRepo.listForEvent>[number]) {
  const metadata = (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
  return {
    id: row.id,
    amountCents: row.amount_cents,
    status: row.status,
    dueDate: metadata.dueDate || metadata.due_date || null,
    paidAt: row.paid_at,
    paymentUrl: row.payment_url,
    label: metadata.label || metadata.title || 'Payment',
    receiptUrl: metadata.receiptUrl || null,
    explanation: row.status === 'completed' ? 'Payment received.' : row.status === 'processing' ? 'Payment is processing.' : row.status === 'failed' ? 'Payment failed; contact the venue.' : 'Payment is pending.',
  };
}

function designSummary(preferences: Record<string, any>) {
  const filled = Object.entries(preferences).filter(([, value]) => String(value ?? '').trim()).map(([key, value]) => `${key}: ${String(value).slice(0, 120)}`);
  if (filled.length === 0) return 'No design preferences submitted yet. Start with ceremony style, rain plan, colors, menu/bar notes, music, traditions, and VIP/photo details.';
  return [
    'Couple design board summary grounded in submitted venue planning fields:',
    ...filled.slice(0, 8).map((item) => `• ${item.replace(/([A-Z])/g, ' $1').toLowerCase()}`),
  ].join('\n');
}

function safeVendor(row: ReturnType<typeof vendorsRepo.listForOrg>[number]) {
  const metadata = (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
  const coupleVisibleDocs = Array.isArray(metadata.coupleVisibleDocuments) ? metadata.coupleVisibleDocuments : [];
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contactPreference: metadata.coupleContactPreference || metadata.contactPreference || (row.email ? 'email' : row.phone ? 'phone' : 'venue-coordinated'),
    publicContactName: metadata.coupleVisibleContactName || row.contact_name || null,
    publicEmail: metadata.shareEmailWithCouple ? row.email : null,
    publicPhone: metadata.sharePhoneWithCouple ? row.phone : null,
    websiteUrl: row.website_url,
    isPreferred: !!row.is_preferred,
    bookedStatus: metadata.coupleBookedStatus || (row.event_id ? 'booked' : 'recommended'),
    confirmedStatus: metadata.coupleConfirmedStatus || metadata.status || 'pending venue confirmation',
    arrival: metadata.shareArrivalWithCouple ? (metadata.arrivalTime || metadata.arrival_time || null) : null,
    notesForCouple: metadata.notesForCouple || '',
    visibleDocuments: coupleVisibleDocs.filter((doc: any) => doc && typeof doc === 'object').map((doc: any) => ({ title: String(doc.title || 'Document'), type: String(doc.type || 'document'), url: doc.url ? String(doc.url) : null })),
  };
}

function safeGuest(row: ReturnType<typeof guestsRepo.listForEvent>[number]) {
  const metadata = (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    partyName: row.party_name,
    householdName: metadata.householdName || row.party_name || '',
    mailingAddress: metadata.mailingAddress || metadata.address || '',
    mealChoice: metadata.mealChoice || '',
    rsvpStatus: row.rsvp_status,
    dietaryRestrictions: row.dietary_restrictions,
    accessibilityNotes: row.accessibility_notes,
    notes: metadata.coupleNotes || '',
    tags: Array.isArray(metadata.coupleGuestTags) ? metadata.coupleGuestTags : [],
    tableAssignment: row.table_assignment,
    seatAssignment: row.seat_assignment,
    roomAssignment: row.room_assignment,
    plusOneAllowed: !!row.plus_one_allowed,
    allowPortalAccess: !!row.allow_portal_access,
    allowLodgingAccess: !!row.allow_lodging_access,
    createdAt: row.created_at,
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function safeRequest(row: ReturnType<typeof coupleRequestsRepo.listForEvent>[number]) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    requesterUserId: row.requester_user_id,
    requestType: row.request_type,
    status: row.status,
    targetEmail: row.target_email,
    targetName: row.target_name,
    note: row.note,
    metadata: (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })(),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


function couplePostEventSummary(input: {
  event: NonNullable<ReturnType<typeof eventsRepo.findById>>;
  userId: string;
}) {
  const { event, userId } = input;
  const metadata = parseEventMetadata(event);
  const postEvent = metadata.couplePostEvent ?? {};
  const requests = coupleRequestsRepo.listForRequester(event.id, userId).map(safeRequest);
  const postEventRequests = requests.filter((r) => ['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(r.requestType));
  const documents = coupleDocumentsRepo.listForEvent(event.id);
  const payments = paymentLinksRepo.listForEvent(event.id).map(safePayment);
  const contracts = contractsRepo.listForEvent(event.id).map(safeContract);
  const finalInvoice = {
    status: payments.some((p) => p.status !== 'completed') ? 'open_or_processing' : payments.length ? 'paid' : 'not_available',
    openBalanceCents: payments.filter((p) => p.status !== 'completed').reduce((sum, p) => sum + p.amountCents, 0),
    payments,
  };
  const damageDeposit = {
    status: postEvent.damageDepositStatus || metadata.damageDepositStatus || 'pending_venue_closeout',
    amountCents: Number(postEvent.damageDepositCents ?? metadata.damageDepositCents ?? 0),
    note: postEvent.damageDepositNote || 'The venue will confirm any refundable damage/security deposit after post-event inspection and final invoice reconciliation.',
  };
  const survey = postEvent.survey ?? null;
  const review = postEvent.review ?? null;
  // Public post-event summaries may include only explicitly guest-visible,
  // approved gallery documents; private storage paths are never emitted.
  const galleryDocs = documents
    .filter((d) => d.category === 'post_event_gallery' && d.visibility === 'guest_visible' && d.approval_status === 'approved')
    .map((d) => ({ id: d.id, filename: d.filename, url: `/api/events/${event.id}/couple-documents/${d.id}/content`, approvalStatus: d.approval_status, notes: d.notes }));
  const photoLinks = [
    ...(postEvent.photoGalleryUrl ? [{ label: 'Photo gallery', url: postEvent.photoGalleryUrl }] : []),
    ...(postEvent.memoryShareUrl ? [{ label: 'Memory/photo sharing link', url: postEvent.memoryShareUrl }] : []),
    ...galleryDocs.map((d) => ({ label: d.filename, url: d.url })),
  ];
  const closeoutItems = [
    { key: 'thank-you', label: 'Thank-you message', status: postEvent.thankYouSentAt ? 'sent' : 'ready', detail: postEvent.thankYouMessage || `Thank you for celebrating at ${metadata.venueName || 'our venue'}. We are grateful to have hosted your wedding.` },
    { key: 'lost-items', label: 'Lost item check', status: postEventRequests.some((r) => r.requestType === 'post_event_lost_item' && ['pending','approved'].includes(r.status)) ? 'pending' : 'available', detail: 'Report anything missing and the venue can track the search.' },
    { key: 'damage-deposit', label: 'Damage/security deposit', status: damageDeposit.status, detail: damageDeposit.note },
    { key: 'final-invoice', label: 'Final invoice / receipts', status: finalInvoice.status, detail: finalInvoice.openBalanceCents > 0 ? `$${(finalInvoice.openBalanceCents / 100).toLocaleString()} still open or processing.` : 'No open client-safe payment balance detected.' },
    { key: 'feedback', label: 'Feedback + NPS survey', status: survey ? 'submitted' : 'not_started', detail: survey ? `NPS ${survey.npsScore}/10 submitted.` : 'Share what went well and what the venue can improve.' },
    { key: 'photos', label: 'Photo/gallery and memories', status: photoLinks.length ? 'available' : 'waiting_on_links', detail: photoLinks.length ? `${photoLinks.length} memory link(s) available.` : 'Add or request gallery/memory-sharing links.' },
    { key: 'review', label: 'Review/testimonial', status: review ? 'submitted' : 'available', detail: review ? `Review draft saved for ${review.platform}.` : 'Optional public review workflow with consent controls.' },
    { key: 'anniversary', label: 'Anniversary/future event nurture', status: postEvent.anniversaryOptIn ? 'opted_in' : 'optional', detail: postEvent.anniversaryOptIn ? 'You opted in to anniversary/future celebration follow-up.' : 'Optional anniversary note or future celebration reminders.' },
  ];
  return {
    event: { id: event.id, title: event.title, weddingDate: event.start_date, daysSinceWedding: event.start_date ? Math.max(0, Math.floor((Date.now() - new Date(`${event.start_date}T12:00:00`).getTime()) / 86400000)) : null },
    closeoutItems,
    finalInvoice,
    damageDeposit,
    survey,
    nps: survey ? { score: survey.npsScore, label: survey.npsScore >= 9 ? 'promoter' : survey.npsScore >= 7 ? 'passive' : 'detractor' } : { score: null, label: 'not_submitted' },
    debriefQuestions: [
      'What moment felt most special or best supported by the venue?',
      'Was anything confusing before, during, or after the wedding?',
      'What should the venue improve for future couples?',
      'Were communication, timeline, layout, food/beverage, and guest care expectations clear?',
      'Would you recommend the venue to another couple? Why or why not?',
    ],
    reviewWorkflow: {
      status: review ? 'submitted' : 'ready',
      platformLinks: postEvent.reviewLinks || metadata.reviewLinks || { google: '', theKnot: '', weddingwire: '', zola: '' },
      consentRequired: true,
      existingReview: review,
    },
    photoSharing: { links: photoLinks, galleryDocuments: galleryDocs, uploadCategory: 'post_event_gallery' },
    thankYouMessage: postEvent.thankYouMessage || `Thank you for trusting ${metadata.venueName || 'the venue'} with your wedding celebration. We hope your day felt joyful, cared for, and memorable.`,
    anniversaryNurture: { optedIn: !!postEvent.anniversaryOptIn, nextTouchDate: event.start_date ? addYears(event.start_date, 1) : null, note: 'Optional couple-friendly follow-up for anniversary dinner, vow renewal, shower, or future family celebration.' },
    requests: postEventRequests,
    finalPacketUrl: `/api/events/${event.id}/couple-post-event/final-packet.txt`,
    hiddenInternalFields: ['Incident reports', 'Staff performance notes', 'Internal damage assessment notes', 'Vendor disputes', 'Owner revenue/margin notes'],
  };
}

function addYears(date: string, years: number) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}


function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function enrichPostEventRequest(request: ReturnType<typeof safeRequest>) {
  const metadata = request.metadata as Record<string, any>;
  const today = new Date().toISOString().slice(0, 10);
  const slaDueAt = metadata.slaDueAt || null;
  return {
    ...request,
    assignment: {
      assignedTo: metadata.assignedTo || null,
      assignedAt: metadata.assignedAt || null,
      assignedBy: metadata.assignedBy || null,
    },
    sla: {
      dueAt: slaDueAt,
      status: request.status === 'completed' || request.status === 'cancelled' ? 'closed' : slaDueAt && slaDueAt < today ? 'overdue' : slaDueAt === today ? 'due_today' : slaDueAt ? 'on_track' : 'unassigned',
    },
    followUp: {
      lastFollowUpAt: metadata.lastFollowUpAt || null,
      lastFollowUpChannel: metadata.lastFollowUpChannel || null,
      followUpCount: Number(metadata.followUpCount || 0),
    },
  };
}

function coupleReminderItems(input: {
  event: ReturnType<typeof eventsRepo.findById>;
  guests: ReturnType<typeof guestsRepo.listForEvent>;
  planning: ReturnType<typeof couplePlanningRepo.listForEvent>;
  payments: ReturnType<typeof paymentLinksRepo.listForEvent>;
  contracts: ReturnType<typeof contractsRepo.listForEvent>;
  documents: ReturnType<typeof coupleDocumentsRepo.listForEvent>;
  appointments: ReturnType<typeof coupleAppointmentsRepo.listForEvent>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const rsvpDeadline = input.event?.rsvp_deadline || (() => { try { return JSON.parse(input.event?.metadata || '{}').rsvpDeadline; } catch { return null; } })();
  const pendingGuests = input.guests.filter((g) => g.rsvp_status === 'pending').length;
  const reminders: Array<{ key: string; title: string; body: string; dueAt: string | null; priority: 'high' | 'medium' | 'low'; channel: 'in_app' | 'email' | 'sms' | 'digest'; recipientRole: 'couple' | 'partner' | 'planner' }> = [];
  if (rsvpDeadline && pendingGuests > 0) reminders.push({ key: 'rsvp-deadline', title: 'RSVP deadline reminder', body: `${pendingGuests} guest(s) have not responded yet. Review your RSVP reminder plan before ${rsvpDeadline}.`, dueAt: rsvpDeadline, priority: rsvpDeadline < today ? 'high' : 'medium', channel: 'in_app', recipientRole: 'couple' });
  for (const payment of input.payments.filter((p) => p.status !== 'completed')) {
    const meta = (() => { try { return JSON.parse(payment.metadata || '{}'); } catch { return {}; } })();
    reminders.push({ key: `payment-${payment.id}`, title: meta.label || 'Payment due', body: `A payment of $${(payment.amount_cents / 100).toLocaleString()} is ${payment.status}. Due date: ${meta.dueDate || 'ask the venue'}.`, dueAt: meta.dueDate || null, priority: meta.dueDate && meta.dueDate < today ? 'high' : 'medium', channel: 'in_app', recipientRole: 'couple' });
  }
  for (const contract of input.contracts.filter((c) => c.status !== 'signed')) reminders.push({ key: `contract-${contract.id}`, title: 'Document signature needed', body: `${contract.title} is ${contract.status}. Review next steps in Contract & Payments.`, dueAt: contract.sent_at, priority: 'medium', channel: 'in_app', recipientRole: 'couple' });
  for (const doc of input.documents.filter((d) => ['pending', 'changes_requested'].includes(d.approval_status)).slice(0, 5)) reminders.push({ key: `document-${doc.id}`, title: 'Document review needed', body: `${doc.filename} is ${doc.approval_status.replace('_', ' ')}. Check the Document Hub for venue feedback.`, dueAt: doc.updated_at?.slice(0, 10) || null, priority: doc.approval_status === 'changes_requested' ? 'high' : 'low', channel: 'in_app', recipientRole: 'couple' });
  for (const appt of input.appointments.filter((a) => a.starts_at && a.status !== 'completed').slice(0, 5)) reminders.push({ key: `appointment-${appt.id}`, title: 'Upcoming appointment', body: `${appt.title} is scheduled for ${appt.starts_at}. Review the preparation checklist.`, dueAt: appt.starts_at?.slice(0, 10) || null, priority: 'medium', channel: 'in_app', recipientRole: 'couple' });
  const finalCount = input.planning.find((t) => t.template_key === 'final-count' && t.status !== 'completed');
  if (finalCount) reminders.push({ key: 'final-count', title: 'Final guest count deadline', body: `Final guest count is due ${finalCount.due_date || 'soon'}. Confirm RSVP, meals, vendor meals, children, and accessibility notes.`, dueAt: finalCount.due_date, priority: finalCount.due_date && finalCount.due_date < today ? 'high' : 'medium', channel: 'in_app', recipientRole: 'couple' });
  const missingProfile = (() => { try { const p = JSON.parse(input.event?.metadata || '{}').coupleProfile || {}; return !p.primaryPhone || !p.mailingAddress; } catch { return true; } })();
  if (missingProfile) reminders.push({ key: 'profile-nudge', title: 'Smart nudge: complete your wedding profile', body: 'Add phone, mailing address, planner contact, and VIP notes so the venue has the right client details.', dueAt: null, priority: 'low', channel: 'in_app', recipientRole: 'couple' });
  return reminders;
}



function defaultAdvancedPlanning() {
  return {
    visionBoard: { mood: '', colors: '', linkedVenueSpaceIds: [] },
    budgetEstimator: { selectedAddOns: [], targetCents: 0 },
    ceremony: { processional: [], readers: [], music: '', rituals: '', officiantNotes: '' },
    weddingParty: { members: [], rehearsalReminder: true, arrivalReminder: true },
    vipNotes: { notes: [], privacy: 'venue_planner_only' },
    photoShotList: { mustHave: [], family: [], details: [] },
    music: { mustPlay: [], doNotPlay: [], specialDances: [] },
    signage: { checklist: [], stationeryNotes: '' },
    transportation: { shuttles: [], lodgingBlocks: [], vipTransport: '' },
    accessibility: { guestCare: [], mobility: '', language: '', sensory: '' },
    culturalTraditions: { templates: [], notes: '' },
    rainPlan: { preference: '', decisionDeadline: '', communicationDraft: '' },
    travelMicrosite: { enabled: false, welcome: '', travelTips: '', lodging: '', schedule: '' },
    weddingWeekendMode: { enabled: false, contactsPinned: true, offlinePacket: true },
    vendorMarketplace: { categories: [], recommendationNotes: '' },
    memoryBook: { enabled: false, prompts: [], galleryLinks: [] },
  };
}

function advancedPlanningProgress(plan: Record<string, any>) {
  const keys = Object.keys(defaultAdvancedPlanning());
  const complete = keys.filter((key) => JSON.stringify(plan[key] ?? {}) !== JSON.stringify((defaultAdvancedPlanning() as any)[key] ?? {})).length;
  return { completeCount: complete, total: keys.length, percent: keys.length ? Math.round((complete / keys.length) * 100) : 0 };
}

function normalizedAdvancedSections(eventId: string) {
  const read = (table: string, hasPrivacy = false) => {
    const row = db.prepare(`SELECT payload${hasPrivacy ? ', privacy_scope' : ''} FROM ${table} WHERE event_id = ?`).get(eventId) as { payload: string; privacy_scope?: string } | undefined;
    if (!row) return undefined;
    try {
      const payload = JSON.parse(row.payload || '{}');
      return row.privacy_scope ? { ...payload, privacy: row.privacy_scope } : payload;
    } catch { return undefined; }
  };
  return {
    ceremony: read('couple_ceremony_plans'),
    weddingParty: read('couple_wedding_party_plans'),
    vipNotes: read('couple_vip_notes_plans', true),
    transportation: read('couple_transportation_plans'),
    memoryBook: read('couple_memory_book_plans'),
  };
}

function upsertAdvancedSection(table: string, event: NonNullable<ReturnType<typeof eventsRepo.findById>>, payload: unknown, userId: string, privacyScope?: string) {
  if (privacyScope !== undefined) {
    db.prepare(`INSERT INTO ${table} (event_id, organization_id, payload, privacy_scope, updated_by) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET payload = excluded.payload, privacy_scope = excluded.privacy_scope, updated_by = excluded.updated_by, updated_at = datetime('now')`)
      .run(event.id, event.organization_id, JSON.stringify(payload ?? {}), privacyScope, userId);
    return;
  }
  db.prepare(`INSERT INTO ${table} (event_id, organization_id, payload, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET payload = excluded.payload, updated_by = excluded.updated_by, updated_at = datetime('now')`)
    .run(event.id, event.organization_id, JSON.stringify(payload ?? {}), userId);
}

function upsertNormalizedAdvancedSections(event: NonNullable<ReturnType<typeof eventsRepo.findById>>, data: Record<string, unknown>, userId: string) {
  if ('ceremony' in data) upsertAdvancedSection('couple_ceremony_plans', event, data.ceremony, userId);
  if ('weddingParty' in data) upsertAdvancedSection('couple_wedding_party_plans', event, data.weddingParty, userId);
  if ('vipNotes' in data) upsertAdvancedSection('couple_vip_notes_plans', event, data.vipNotes, userId, String((data.vipNotes as any)?.privacy || 'venue_planner_only'));
  if ('transportation' in data) upsertAdvancedSection('couple_transportation_plans', event, data.transportation, userId);
  if ('memoryBook' in data) upsertAdvancedSection('couple_memory_book_plans', event, data.memoryBook, userId);
}

function coupleAdvancedPlanningSummary(event: NonNullable<ReturnType<typeof eventsRepo.findById>>, userId: string) {
  const metadata = parseEventMetadata(event);
  const normalized = normalizedAdvancedSections(event.id);
  const plan = { ...defaultAdvancedPlanning(), ...(metadata.coupleAdvancedPlanning ?? {}), ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)) };
  const venues = venuesRepo.listForOrg(event.organization_id).map((v) => ({ id: v.id, name: v.name, category: v.category, environment: v.environment, capacity: v.capacity }));
  const inventory = inventoryRepo.listForOrg(event.organization_id).filter((i) => i.owner_type === 'venue' && i.available_count > 0).slice(0, 30).map((i) => ({ id: i.id, name: i.name, category: i.category, availableCount: i.available_count, condition: i.condition }));
  const visibleAddOns = [
    ...catalogRepo.listForOrg(event.organization_id, 'template').filter((item) => item.visible).slice(0, 10).map((item) => ({ id: item.id, name: item.name, source: 'catalog_template', estimatedCents: Number((item.spec as any)?.estimatedCents || 0), description: String((item.spec as any)?.description || '') })),
    ...inventory.filter((item) => ['linen','centerpiece','lighting','av'].includes(item.category)).slice(0, 10).map((item) => ({ id: item.id, name: item.name, source: 'venue_inventory', estimatedCents: 0, description: `${item.availableCount} available` })),
  ];
  const requests = coupleRequestsRepo.listForRequester(event.id, userId).map(safeRequest).filter((r) => (r.metadata as any)?.source === 'couple_advanced_planning');
  const conciergeAnswers = [
    { question: 'Can we use the outdoor space for ceremony photos?', answer: venues.some((v) => v.environment !== 'indoor') ? 'Your venue has outdoor-capable spaces. Confirm timing, weather, and access rules with the venue before publishing guest-facing instructions.' : 'No outdoor venue space is configured yet. Ask the venue to confirm photo locations.', approvedByVenue: true },
    { question: 'What should we prioritize next?', answer: 'Focus on guest care, ceremony details, transportation/lodging, rain-plan decision timing, music restrictions, and photo shot-list approvals.', approvedByVenue: true },
  ];
  return {
    plan,
    progress: advancedPlanningProgress(plan),
    storage: { normalizedSections: ['ceremony','weddingParty','vipNotes','transportation','memoryBook'], metadataSections: ['visionBoard','budgetEstimator','photoShotList','music','signage','accessibility','culturalTraditions','rainPlan','travelMicrosite','weddingWeekendMode','vendorMarketplace'] },
    aiConcierge: { mode: 'venue_approved_answers_with_escalation', answers: conciergeAnswers, escalations: requests },
    venueLinks: { spaces: venues, inventory, visibleAddOns },
    modules: [
      { key: 'visionBoard', label: 'Wedding vision board', priority: 'P2', tiedTo: ['venue spaces', 'venue inventory'] },
      { key: 'budgetEstimator', label: 'Couple-visible add-on budget estimator', priority: 'P2', tiedTo: ['client-safe add-ons only'] },
      { key: 'ceremony', label: 'Ceremony planning', priority: 'P2', tiedTo: ['processional', 'readers', 'music', 'rituals', 'officiant notes'] },
      { key: 'weddingParty', label: 'Wedding party manager', priority: 'P2', tiedTo: ['attire', 'contacts', 'arrival/rehearsal reminders'] },
      { key: 'vipNotes', label: 'VIP/family dynamics with privacy controls', priority: 'P2', tiedTo: ['venue/planner-only notes'] },
      { key: 'photoShotList', label: 'Photo shot-list builder', priority: 'P2', tiedTo: ['must-have photos'] },
      { key: 'music', label: 'Music must-play / do-not-play', priority: 'P2', tiedTo: ['DJ/band handoff'] },
      { key: 'signage', label: 'Signage/stationery checklist', priority: 'P2', tiedTo: ['welcome signs', 'bar/menu/table signage'] },
      { key: 'transportation', label: 'Transportation and lodging coordinator', priority: 'P2', tiedTo: ['shuttles', 'room blocks'] },
      { key: 'accessibility', label: 'Accessibility and guest care center', priority: 'P2', tiedTo: ['mobility', 'language', 'sensory', 'dietary'] },
      { key: 'culturalTraditions', label: 'Cultural/tradition templates', priority: 'P2', tiedTo: ['ceremony and reception traditions'] },
      { key: 'rainPlan', label: 'Rain-plan decision workflow', priority: 'P2', tiedTo: ['deadline', 'guest communication draft'] },
      { key: 'travelMicrosite', label: 'Personalized guest travel microsite', priority: 'P3', tiedTo: ['guest-facing travel content'] },
      { key: 'weddingWeekendMode', label: 'Wedding weekend mobile app mode', priority: 'P3', tiedTo: ['offline contacts', 'schedule', 'guest care'] },
      { key: 'vendorMarketplace', label: 'Couple vendor marketplace', priority: 'P3', tiedTo: ['venue-approved recommendations'] },
      { key: 'memoryBook', label: 'Memory book/gallery experience', priority: 'P3', tiedTo: ['post-event gallery'] },
    ],
    exports: [{ label: 'Personalized guest travel microsite packet', href: `/api/events/${event.id}/couple-advanced-planning/travel-microsite.txt` }],
  };
}

function connectedIntegrationId(organizationId: string, provider: string) {
  const row = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = ? AND status = 'connected' LIMIT 1`).get(organizationId, provider) as { id: string } | undefined;
  return row?.id ?? null;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}

export async function coupleRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/couple-advanced-planning', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.advanced_planning.view', targetType: 'event', targetId: eventId, ip: req.ip });
    return coupleAdvancedPlanningSummary(event, req.auth!.userId);
  });

  app.patch('/api/events/:eventId/couple-advanced-planning', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = advancedPlanningSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    upsertNormalizedAdvancedSections(event, parsed.data as Record<string, unknown>, req.auth!.userId);
    const metadata = parseEventMetadata(event);
    const normalizedKeys = ['ceremony','weddingParty','vipNotes','transportation','memoryBook'];
    const metadataPatch = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => !normalizedKeys.includes(key)));
    const nextPlan = { ...(metadata.coupleAdvancedPlanning ?? {}), ...metadataPatch };
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleAdvancedPlanning: nextPlan, coupleAdvancedPlanningUpdatedAt: new Date().toISOString(), coupleAdvancedPlanningUpdatedBy: req.auth!.email } } as never);
    const refreshed = eventsRepo.findById(eventId)!;
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.advanced_planning.update', targetType: 'event', targetId: eventId, ip: req.ip, details: { fields: Object.keys(parsed.data) } });
    return coupleAdvancedPlanningSummary(refreshed, req.auth!.userId);
  });

  app.post('/api/events/:eventId/couple-advanced-planning/concierge/escalate', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = conciergeEscalationSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'venue_question', note: parsed.data.question, metadata: { source: 'couple_advanced_planning', moduleKey: parsed.data.moduleKey, urgency: parsed.data.urgency, needsVenueApprovedAnswer: true } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.advanced_planning.escalate', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId, moduleKey: parsed.data.moduleKey } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-advanced-planning/travel-microsite.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const summary = coupleAdvancedPlanningSummary(event, req.auth!.userId);
    const plan = summary.plan as any;
    const packet = [
      `${event.title} — Personalized guest travel microsite packet`,
      `Wedding date: ${event.start_date || 'TBD'}`,
      '',
      `Welcome: ${plan.travelMicrosite?.welcome || 'Welcome family and friends.'}`,
      `Travel tips: ${plan.travelMicrosite?.travelTips || 'Venue travel guidance pending.'}`,
      `Lodging: ${plan.travelMicrosite?.lodging || 'Room block/lodging details pending.'}`,
      `Weekend schedule: ${plan.travelMicrosite?.schedule || 'Weekend schedule pending.'}`,
      '',
      `Transportation: ${JSON.stringify(plan.transportation || {})}`,
      `Accessibility and guest care: ${JSON.stringify(plan.accessibility || {})}`,
      `Rain-plan communication: ${plan.rainPlan?.communicationDraft || 'Rain-plan communication pending.'}`,
      '',
      'Privacy note: VIP/family dynamics notes and couple-only planning notes are excluded from this guest-facing packet.',
    ].join('\n');
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="guest-travel-microsite-${eventId}.txt"`).send(packet);
  });

  app.get('/api/events/:eventId/couple-post-event', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.view', targetType: 'event', targetId: eventId, ip: req.ip });
    return couplePostEventSummary({ event, userId: req.auth!.userId });
  });

  app.patch('/api/events/:eventId/couple-post-event/survey', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = postEventSurveySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const survey = { ...parsed.data, submittedAt: new Date().toISOString(), submittedBy: req.auth!.email };
    const updatedMetadata = {
      ...metadata,
      couplePostEvent: {
        ...(metadata.couplePostEvent ?? {}),
        survey,
        photoGalleryUrl: parsed.data.photoGalleryUrl || metadata.couplePostEvent?.photoGalleryUrl,
        memoryShareUrl: parsed.data.memoryShareUrl || metadata.couplePostEvent?.memoryShareUrl,
        anniversaryOptIn: parsed.data.anniversaryOptIn ?? metadata.couplePostEvent?.anniversaryOptIn,
      },
    };
    eventsRepo.update(eventId, { metadata: updatedMetadata } as never);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'post_event_feedback', status: 'completed', note: parsed.data.privateFeedback || parsed.data.whatCouldImprove || parsed.data.whatWentWell || 'Post-event survey submitted', metadata: { source: 'couple_post_event_closeout', npsScore: parsed.data.npsScore, overallRating: parsed.data.overallRating, mayUseTestimonial: !!parsed.data.mayUseTestimonial } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.survey_submit', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId, npsScore: parsed.data.npsScore } });
    const refreshed = eventsRepo.findById(eventId)!;
    return { summary: couplePostEventSummary({ event: refreshed, userId: req.auth!.userId }), request: safeRequest(request) };
  });

  app.post('/api/events/:eventId/couple-post-event/lost-item', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = postEventLostItemSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'post_event_lost_item', note: parsed.data.itemDescription, metadata: { source: 'couple_post_event_closeout', lastSeenLocation: parsed.data.lastSeenLocation, contactPreference: parsed.data.contactPreference, contactValue: parsed.data.contactValue } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.lost_item', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-post-event/review', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = postEventReviewSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const review = { ...parsed.data, submittedAt: new Date().toISOString(), submittedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, couplePostEvent: { ...(metadata.couplePostEvent ?? {}), review } } } as never);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'review_testimonial_request', status: parsed.data.permissionToPublish ? 'completed' : 'pending', note: parsed.data.testimonial || `Review workflow started for ${parsed.data.platform}`, metadata: { source: 'couple_post_event_closeout', platform: parsed.data.platform, rating: parsed.data.rating, permissionToPublish: !!parsed.data.permissionToPublish, reviewerName: parsed.data.reviewerName } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_submit', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId, platform: parsed.data.platform } });
    return reply.code(201).send({ request: safeRequest(request), review });
  });

  app.get('/api/events/:eventId/couple-post-event/review-queue', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const requests = coupleRequestsRepo.listForEvent(eventId).map(safeRequest).filter((r) => ['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(r.requestType)).map(enrichPostEventRequest);
    const openRequests = requests.filter((r) => ['pending','approved'].includes(r.status));
    const feedback = requests.filter((r) => r.requestType === 'post_event_feedback');
    const npsScores = feedback.map((r) => Number((r.metadata as any)?.npsScore)).filter((n) => Number.isFinite(n));
    return {
      event: { id: event.id, title: event.title, weddingDate: event.start_date },
      requests,
      openRequests,
      reviewLinks: metadata.couplePostEvent?.reviewLinks || metadata.reviewLinks || { google: '', theKnot: '', weddingwire: '', zola: '', other: '' },
      configuredReviewLinks: Object.values(metadata.couplePostEvent?.reviewLinks || metadata.reviewLinks || {}).filter(Boolean).length,
      nps: {
        totalResponses: npsScores.length,
        averageScore: npsScores.length ? Math.round((npsScores.reduce((a, b) => a + b, 0) / npsScores.length) * 10) / 10 : null,
        promoters: npsScores.filter((score) => score >= 9).length,
        detractors: npsScores.filter((score) => score <= 6).length,
      },
      closeoutApprovals: {
        lostItemsOpen: openRequests.filter((r) => r.requestType === 'post_event_lost_item').length,
        testimonialsAwaitingConsent: requests.filter((r) => r.requestType === 'review_testimonial_request' && !(r.metadata as any)?.permissionToPublish).length,
        feedbackToDebrief: feedback.length,
      },
      privacyBoundaries: ['Do not expose internal incident reports in couple replies.', 'Keep staff performance notes and owner financial/margin notes out of couple-facing packets.', 'Use testimonial text only when permissionToPublish/mayUseTestimonial is true.'],
    };
  });

  app.patch('/api/events/:eventId/couple-post-event/review-links', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const parsed = postEventReviewLinksSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const couplePostEvent = { ...(metadata.couplePostEvent ?? {}), reviewLinks: parsed.data, reviewLinksUpdatedAt: new Date().toISOString(), reviewLinksUpdatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, couplePostEvent } } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_links_update', targetType: 'event', targetId: eventId, ip: req.ip, details: { configured: Object.values(parsed.data).filter(Boolean).length } });
    return { reviewLinks: parsed.data, updatedAt: couplePostEvent.reviewLinksUpdatedAt, updatedBy: couplePostEvent.reviewLinksUpdatedBy };
  });

  app.patch('/api/events/:eventId/couple-post-event/review-queue/bulk', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const parsed = postEventBulkActionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = [] as Array<ReturnType<typeof enrichPostEventRequest>>;
    for (const requestId of parsed.data.requestIds) {
      const current = coupleRequestsRepo.findById(requestId);
      if (!current || current.event_id !== eventId || !['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(current.request_type)) continue;
      const currentMetadata = (() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
      const nextMetadata = {
        ...currentMetadata,
        ...(parsed.data.assignedTo ? { assignedTo: parsed.data.assignedTo, assignedAt: new Date().toISOString(), assignedBy: req.auth!.email } : {}),
        ...(parsed.data.slaDays ? { slaDays: parsed.data.slaDays, slaDueAt: addDaysIso(parsed.data.slaDays) } : {}),
        ...(parsed.data.note ? { venueQueueNote: parsed.data.note } : {}),
        lastBulkActionAt: new Date().toISOString(),
        lastBulkActionBy: req.auth!.email,
      };
      const row = coupleRequestsRepo.updateStatus(requestId, parsed.data.status || current.status, req.auth!.userId, nextMetadata);
      if (row) updated.push(enrichPostEventRequest(safeRequest(row)));
    }
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_queue_bulk', targetType: 'event', targetId: eventId, ip: req.ip, details: { count: updated.length, status: parsed.data.status, assignedTo: parsed.data.assignedTo, slaDays: parsed.data.slaDays } });
    return { updated, count: updated.length };
  });

  app.post('/api/events/:eventId/couple-post-event/review-queue/follow-up', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const parsed = postEventFollowUpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const queued = [] as Array<{ requestId: string; historyId: string; jobId: string | null; dispatchStatus: string; recipient: string | null }>;
    const smtpIntegrationId = parsed.data.channel === 'email' ? connectedIntegrationId(event.organization_id, 'email_smtp') : null;
    const smsIntegrationId = parsed.data.channel === 'sms' ? connectedIntegrationId(event.organization_id, 'sms_twilio') : null;
    for (const requestId of parsed.data.requestIds) {
      const current = coupleRequestsRepo.findById(requestId);
      if (!current || current.event_id !== eventId || !['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(current.request_type)) continue;
      const currentMetadata = (() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
      const requester = current.requester_user_id ? usersRepo.findById(current.requester_user_id) : null;
      const recipient = parsed.data.channel === 'email'
        ? (requester?.email || (typeof currentMetadata.contactValue === 'string' && currentMetadata.contactValue.includes('@') ? currentMetadata.contactValue : null))
        : parsed.data.channel === 'sms'
          ? (requester?.phone || (typeof currentMetadata.contactValue === 'string' ? currentMetadata.contactValue : null))
          : null;
      const historyId = uuid();
      let jobId: string | null = null;
      let dispatchStatus = parsed.data.channel === 'in_app' ? 'in_app_queued' : 'provider_not_configured';
      if (parsed.data.channel === 'email' && smtpIntegrationId && recipient) {
        const job = jobsRepo.enqueue({
          kind: 'email.send',
          organizationId: event.organization_id,
          payload: {
            integrationId: smtpIntegrationId,
            to: recipient,
            subject: `${event.title} post-event closeout follow-up`,
            text: parsed.data.message,
            html: `<p>${htmlEscape(parsed.data.message).replace(/\n/g, '<br/>')}</p>`,
          },
        });
        jobId = job.id;
        dispatchStatus = 'email_job_queued';
      } else if (parsed.data.channel === 'email' && !recipient) {
        dispatchStatus = 'missing_email_recipient';
      } else if (parsed.data.channel === 'email' && !smtpIntegrationId) {
        dispatchStatus = 'email_provider_not_connected';
      } else if (parsed.data.channel === 'sms' && smsIntegrationId && recipient) {
        const job = jobsRepo.enqueue({
          kind: 'sms.send',
          organizationId: event.organization_id,
          payload: {
            integrationId: smsIntegrationId,
            to: recipient,
            body: parsed.data.message,
          },
        });
        jobId = job.id;
        dispatchStatus = 'sms_job_queued';
      } else if (parsed.data.channel === 'sms' && !recipient) {
        dispatchStatus = 'missing_sms_recipient';
      } else if (parsed.data.channel === 'sms' && !smsIntegrationId) {
        dispatchStatus = 'sms_provider_not_connected';
      }
      db.prepare(`INSERT INTO couple_notification_history (id, organization_id, event_id, user_id, reminder_key, title, body, channel, status, recipient_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'couple')`).run(historyId, event.organization_id, eventId, current.requester_user_id, `post-event-follow-up-${requestId}`, 'Post-event closeout follow-up', parsed.data.message, parsed.data.channel);
      coupleRequestsRepo.updateStatus(requestId, current.status, req.auth!.userId, { ...currentMetadata, lastFollowUpAt: new Date().toISOString(), lastFollowUpBy: req.auth!.email, lastFollowUpChannel: parsed.data.channel, followUpCount: Number(currentMetadata.followUpCount || 0) + 1, lastFollowUpMessagePreview: parsed.data.message.slice(0, 240), lastFollowUpJobId: jobId, lastFollowUpDispatchStatus: dispatchStatus });
      queued.push({ requestId, historyId, jobId, dispatchStatus, recipient });
    }
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_queue_follow_up', targetType: 'event', targetId: eventId, ip: req.ip, details: { count: queued.length, channel: parsed.data.channel, dispatched: queued.filter((q) => q.jobId).length } });
    return reply.code(201).send({ queued, count: queued.length, channel: parsed.data.channel, dispatchedJobs: queued.filter((q) => q.jobId).length });
  });

  app.get('/api/events/:eventId/couple-post-event/final-packet.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const summary = couplePostEventSummary({ event, userId: req.auth!.userId });
    const packet = [
      `${event.title} — Post-event final packet`,
      `Wedding date: ${event.start_date || 'TBD'}`,
      '',
      'Closeout checklist',
      ...summary.closeoutItems.map((item) => `- ${item.label}: ${item.status} — ${item.detail}`),
      '',
      `Final invoice status: ${summary.finalInvoice.status}`,
      `Open balance: $${(summary.finalInvoice.openBalanceCents / 100).toLocaleString()}`,
      `Damage/security deposit: ${summary.damageDeposit.status} — ${summary.damageDeposit.note}`,
      '',
      `NPS / feedback: ${summary.nps.label}${summary.nps.score === null ? '' : ` (${summary.nps.score}/10)`}`,
      `Review workflow: ${summary.reviewWorkflow.status}`,
      '',
      'Memory/photo links',
      ...(summary.photoSharing.links.length ? summary.photoSharing.links.map((link) => `- ${link.label}: ${link.url}`) : ['- No post-event gallery links have been added yet.']),
      '',
      `Thank-you message: ${summary.thankYouMessage}`,
      `Anniversary/future event nurture: ${summary.anniversaryNurture.optedIn ? 'opted in' : 'optional'}`,
      '',
      'Privacy note: This packet excludes internal incident reports, staff performance notes, vendor disputes, and owner financial details.',
    ].join('\n');
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.final_packet', targetType: 'event', targetId: eventId, ip: req.ip });
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="post-event-final-packet-${eventId}.txt"`).send(packet);
  });

  app.get('/api/events/:eventId/couple-reminders', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const planning = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date });
    const reminders = coupleReminderItems({ event, guests: guestsRepo.listForEvent(eventId), planning, payments: paymentLinksRepo.listForEvent(eventId), contracts: contractsRepo.listForEvent(eventId), documents: coupleDocumentsRepo.listForEvent(eventId), appointments: coupleAppointmentsRepo.listForEvent(eventId) });
    const history = db.prepare(`SELECT * FROM couple_notification_history WHERE event_id = ? AND (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC LIMIT 100`).all(eventId, req.auth!.userId);
    return { reminders, history, language: 'couple-friendly', avoidsInternalLanguage: true };
  });

  app.post('/api/events/:eventId/couple-reminders/digest', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const planning = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date });
    const reminders = coupleReminderItems({ event, guests: guestsRepo.listForEvent(eventId), planning, payments: paymentLinksRepo.listForEvent(eventId), contracts: contractsRepo.listForEvent(eventId), documents: coupleDocumentsRepo.listForEvent(eventId), appointments: coupleAppointmentsRepo.listForEvent(eventId) });
    const digest = [`${event.title} — Wedding planning digest`, '', ...reminders.slice(0, 10).map((r) => `- ${r.title}: ${r.body}`)].join('\n');
    const id = uuid();
    db.prepare(`INSERT INTO couple_notification_history (id, organization_id, event_id, user_id, reminder_key, title, body, channel, status, recipient_role) VALUES (?, ?, ?, ?, ?, ?, ?, 'digest', 'sent', 'couple')`).run(id, event.organization_id, eventId, req.auth!.userId, 'planning-digest', 'Wedding planning digest', digest);
    return reply.code(201).send({ digest, sent: true, historyId: id });
  });

  app.get('/api/events/:eventId/couple-privacy', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.privacy.view', targetType: 'event', targetId: eventId, ip: req.ip });
    return {
      scope: { eventId, eventTitle: event.title, access: 'event_scoped_couple_access_only' },
      policyPack: {
        allowed: ['Private wedding hub', 'Client-safe event details', 'Guest list center for this wedding', 'RSVP portal preview', 'Client-safe timeline/floorplan/vendor/finance/document views', 'Venue/planner messaging'],
        blocked: ['Venue administration', 'Other weddings', 'Org-wide guest/vendor/event lists', 'Staff operations', 'Audit logs', 'Health/intelligence dashboards', 'Internal budgets', 'Vendor margins', 'Owner finance notes'],
      },
      fieldFiltering: {
        vendors: ['No COI/no-show risk/internal vendor payments unless venue explicitly shares client-safe documents.'],
        finance: ['Only client-safe contracts, invoices, receipts, due dates, balances, and policies. No internal budget/margins/forecasts.'],
        guests: ['Guest notes, allergies, accessibility requests, and meal choices are event-scoped and only shared with venue/planner/vendor teams as needed for service.'],
        staffAuditHealth: ['Staff, audit, and operational health records are not exposed in the couple hub.'],
      },
      exports: [
        { label: 'Privacy-safe guest CSV', href: `/api/events/${eventId}/couple-guests/export.csv` },
        { label: 'Contract/payment packet', href: `/api/events/${eventId}/couple-finance/packet.txt` },
        { label: 'Final document packet', href: `/api/events/${eventId}/couple-documents/final-packet.txt` },
        { label: 'Couple calendar', href: `/api/events/${eventId}/couple-calendar.ics` },
      ],
      secureGuestLinks: 'Guest RSVP links can be generated per guest with tokenized portal access. Do not share admin/couple planning links with guests.',
      collaboratorControls: requests.filter((r) => ['partner_invite', 'planner_request', 'planner_collaboration'].includes(r.requestType)),
    };
  });

  app.get('/api/events/:eventId/couple-calendar', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const appointments = coupleAppointmentsRepo.listForEvent(eventId).map((a) => ({
      id: a.id,
      appointmentType: a.appointment_type,
      title: a.title,
      status: a.status,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      location: a.location,
      note: a.note,
      preparation: (() => { try { return JSON.parse(a.preparation || '[]'); } catch { return []; } })(),
      reminders: (() => { try { return JSON.parse(a.reminders || '[]'); } catch { return []; } })(),
      availabilityWindow: a.availability_window,
      providerSync: (() => { try { return JSON.parse(a.provider_sync || '{}'); } catch { return {}; } })(),
      signoff: (() => { try { return JSON.parse(a.signoff || '{}'); } catch { return {}; } })(),
      updatedAt: a.updated_at,
    }));
    const planning = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date, packageKey: metadata.package || metadata.packageName, cultureKey: metadata.cultureKey });
    const payments = paymentLinksRepo.listForEvent(eventId);
    const calendarItems = [
      ...appointments.map((a) => ({ source: 'appointment', id: a.id, title: a.title, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, type: a.appointmentType })),
      ...planning.filter((t) => t.due_date).map((t) => ({ source: 'deadline', id: t.id, title: t.title, startsAt: t.due_date, endsAt: t.due_date, status: t.status, type: t.decision_category || 'planning' })),
      ...payments.map((p) => ({ source: 'payment', id: p.id, title: (() => { try { return JSON.parse(p.metadata || '{}').label || 'Payment due'; } catch { return 'Payment due'; } })(), startsAt: (() => { try { return JSON.parse(p.metadata || '{}').dueDate || null; } catch { return null; } })(), endsAt: null, status: p.status, type: 'payment' })),
      event.start_date ? { source: 'wedding', id: event.id, title: event.title, startsAt: event.start_date, endsAt: event.end_date, status: event.status, type: 'wedding_day' } : null,
    ].filter(Boolean);
    const availabilityWindows = metadata.coupleAppointmentAvailability || {
      tasting: 'Tuesdays–Thursdays, 1–4 PM, subject to venue confirmation',
      planning_meeting: 'Weekdays, 10 AM–4 PM',
      final_walkthrough: 'Two weeks before wedding week, weekday mornings preferred',
      rehearsal: 'Usually the day before the wedding, venue-confirmed time',
    };
    return { appointments, calendarItems, availabilityWindows, providerSync: { status: 'not_connected', note: 'Scheduling provider sync placeholder; venue can connect Calendly/Google/Microsoft later.' } };
  });

  app.post('/api/events/:eventId/couple-appointments', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = appointmentRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const appointment = coupleAppointmentsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, ...parsed.data });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.appointment.request', targetType: 'couple_appointment', targetId: appointment.id, ip: req.ip, details: { eventId, appointmentType: appointment.appointment_type } });
    return reply.code(201).send({ appointment });
  });

  app.patch('/api/events/:eventId/couple-appointments/:appointmentId', { preHandler: requireAuth }, async (req) => {
    const { eventId, appointmentId } = req.params as { eventId: string; appointmentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const appointment = coupleAppointmentsRepo.findById(appointmentId);
    if (!appointment || appointment.event_id !== eventId) throw NotFound('appointment-not-found');
    const parsed = appointmentStatusSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { appointment: coupleAppointmentsRepo.updateStatus(appointmentId, parsed.data.status, parsed.data.note) };
  });

  app.post('/api/events/:eventId/couple-appointments/:appointmentId/signoff', { preHandler: requireAuth }, async (req) => {
    const { eventId, appointmentId } = req.params as { eventId: string; appointmentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const appointment = coupleAppointmentsRepo.findById(appointmentId);
    if (!appointment || appointment.event_id !== eventId) throw NotFound('appointment-not-found');
    const parsed = appointmentSignoffSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { appointment: coupleAppointmentsRepo.signoff(appointmentId, { signedBy: req.auth!.email, note: parsed.data.note }) };
  });

  app.get('/api/events/:eventId/couple-calendar.ics', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const appts = coupleAppointmentsRepo.listForEvent(eventId).filter((a) => a.starts_at);
    const events = appts.map((a) => ['BEGIN:VEVENT', `UID:${a.id}@wvi-couple-calendar`, `DTSTAMP:${now}`, `DTSTART:${String(a.starts_at).replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, a.ends_at ? `DTEND:${String(a.ends_at).replace(/[-:]/g, '').replace(/\.\d{3}/, '')}` : '', `SUMMARY:${a.title.replace(/[,;\\]/g, ' ')}`, a.location ? `LOCATION:${a.location.replace(/[,;\\]/g, ' ')}` : '', 'END:VEVENT'].filter(Boolean).join('\r\n'));
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Venue Intelligence Couple Calendar//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="couple_calendar_${eventId}.ics"`);
    return reply.send(ics);
  });

  app.get('/api/events/:eventId/couple-inbox', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const threadDefs = [
      { type: 'venue', label: 'Venue Q&A', expectedResponse: metadata.venueResponseTime || '1 business day' },
      { type: 'planner', label: 'Planner thread', expectedResponse: metadata.plannerResponseTime || '1 business day' },
      { type: 'urgent', label: 'Urgent venue questions', expectedResponse: metadata.urgentResponseTime || 'same business day' },
      { type: 'decision', label: 'Decision needed', expectedResponse: 'tracked until resolved' },
    ];
    const threads = threadDefs.map((thread) => {
      const threadId = `${eventId}:couple-${thread.type}`;
      const messages = messagesRepo.listForThread(threadId, 20);
      return { ...thread, threadId, unread: messagesRepo.unreadCount(threadId, req.auth!.userId), messages };
    });
    const decisions = coupleRequestsRepo.listForEvent(eventId).map(safeRequest).filter((r) => r.requestType === 'decision_needed');
    const org = await Promise.resolve(null).then(() => db.prepare(`SELECT settings, branding FROM organizations WHERE id = ?`).get(event.organization_id) as any);
    const settings = (() => { try { return JSON.parse(org?.settings || '{}'); } catch { return {}; } })();
    const policies = settings?.admin?.venuePolicies || settings?.venuePolicies || [];
    const faq = [
      { q: 'Who sees my messages?', a: 'Venue/planner messages are visible to authorized venue collaborators assigned to your wedding.' },
      { q: 'When should I mark something urgent?', a: 'Use urgent for time-sensitive questions that affect contracts, guest care, safety, final count, or event-week decisions.' },
      ...policies.slice(0, 8).map((p: any) => ({ q: p.label || p.key || 'Venue policy', a: p.value || p.ownerHelp || 'Ask the venue for details.' })),
    ];
    return {
      threads,
      decisions,
      venueContact: { name: metadata.venueContactName || 'Venue coordinator', email: metadata.venueContactEmail || settings?.supportEmail || null, expectedResponse: metadata.venueResponseTime || '1 business day' },
      templates: [
        { id: 'guest_count', label: 'Guest count question', body: 'Can you confirm how final guest count changes affect seating, catering, and invoice timing?' },
        { id: 'payment', label: 'Payment question', body: 'Can you help us understand our next payment due date, balance, or receipt?' },
        { id: 'vendor', label: 'Vendor question', body: 'Can you confirm whether this vendor detail is approved by the venue?' },
        { id: 'timeline', label: 'Timeline change', body: 'We would like to request a timeline change. What is the venue/planner approval process?' },
        { id: 'layout', label: 'Layout change', body: 'We have a floor plan or seating question. Can you review the requested change?' },
        { id: 'accessibility', label: 'Accessibility need', body: 'We have a guest accessibility need to confirm. What details should we provide?' },
      ],
      notificationSummary: { newVenueMessages: threads.reduce((sum, t) => sum + t.unread, 0), dueTasks: couplePlanningRepo.listForEvent(eventId).filter((t) => t.due_date && t.status !== 'completed').length },
      aiDraft: 'Draft answer: Based on venue policy, ask the venue to confirm the specific deadline, approval owner, and whether this affects guest-facing details. Escalate urgent event-week or accessibility issues to the coordinator.',
    };
  });

  app.post('/api/events/:eventId/couple-inbox/messages', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'messages.send', orgMap)) throw Forbidden();
    const parsed = coupleInboxMessageSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const threadType = parsed.data.urgency === 'urgent' ? 'urgent' : parsed.data.threadType;
    const message = messagesRepo.send({ threadId: `${eventId}:couple-${threadType}`, senderId: req.auth!.userId, senderRole: 'couple', body: parsed.data.body });
    return reply.code(201).send({ message });
  });

  app.post('/api/events/:eventId/couple-inbox/decisions', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'decision_needed', note: parsed.data.detail, metadata: { title: parsed.data.title, dueDate: parsed.data.dueDate, source: 'couple_inbox' } });
    return reply.code(201).send({ decision: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-notification-preferences', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const existing = db.prepare(`SELECT * FROM couple_notification_preferences WHERE event_id = ? AND user_id = ?`).get(eventId, req.auth!.userId) as any;
    if (existing) return { preferences: existing };
    const id = uuid();
    db.prepare(`INSERT INTO couple_notification_preferences (id, organization_id, event_id, user_id) VALUES (?, ?, ?, ?)`).run(id, event.organization_id, eventId, req.auth!.userId);
    return { preferences: db.prepare(`SELECT * FROM couple_notification_preferences WHERE id = ?`).get(id) };
  });

  app.patch('/api/events/:eventId/couple-notification-preferences', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = notificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const id = (db.prepare(`SELECT id FROM couple_notification_preferences WHERE event_id = ? AND user_id = ?`).get(eventId, req.auth!.userId) as any)?.id || uuid();
    db.prepare(`INSERT OR IGNORE INTO couple_notification_preferences (id, organization_id, event_id, user_id) VALUES (?, ?, ?, ?)`).run(id, event.organization_id, eventId, req.auth!.userId);
    const p = parsed.data;
    db.prepare(`UPDATE couple_notification_preferences SET email_enabled = COALESCE(?, email_enabled), sms_enabled = COALESCE(?, sms_enabled), in_app_enabled = COALESCE(?, in_app_enabled), digest_frequency = COALESCE(?, digest_frequency), quiet_hours = COALESCE(?, quiet_hours), decision_alerts = COALESCE(?, decision_alerts), due_task_alerts = COALESCE(?, due_task_alerts), message_alerts = COALESCE(?, message_alerts), updated_at = datetime('now') WHERE id = ?`)
      .run(p.emailEnabled === undefined ? null : Number(p.emailEnabled), p.smsEnabled === undefined ? null : Number(p.smsEnabled), p.inAppEnabled === undefined ? null : Number(p.inAppEnabled), p.digestFrequency ?? null, p.quietHours ? JSON.stringify(p.quietHours) : null, p.decisionAlerts === undefined ? null : Number(p.decisionAlerts), p.dueTaskAlerts === undefined ? null : Number(p.dueTaskAlerts), p.messageAlerts === undefined ? null : Number(p.messageAlerts), id);
    return { preferences: db.prepare(`SELECT * FROM couple_notification_preferences WHERE id = ?`).get(id) };
  });

  app.get('/api/events/:eventId/couple-documents/:documentId/content', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const document = coupleDocumentsRepo.findById(documentId);
    if (!document || document.event_id !== eventId) throw NotFound('document-not-found');
    const path = privateFilePath(document.url);
    if (!path) return reply.redirect(document.url);
    if (!existsSync(path)) throw NotFound('document-file-not-found');
    reply.header('Content-Type', document.mime_type || 'application/octet-stream');
    reply.header('Content-Disposition', `inline; filename="${document.filename.replace(/[\"\\\\\r\n]/g, '_')}"`);
    return reply.send(createReadStream(path));
  });

  app.get('/api/events/:eventId/couple-documents', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const documents = coupleDocumentsRepo.listForEvent(eventId).map(safeDocument);
    const counts = documents.reduce((acc: Record<string, number>, doc) => { acc[doc.category] = (acc[doc.category] || 0) + 1; return acc; }, {});
    return {
      documents,
      counts,
      reviewQueue: documents.filter((doc) => ['pending', 'changes_requested'].includes(doc.approvalStatus)),
      postEventGallery: documents.filter((doc) => doc.category === 'post_event_gallery' && doc.approvalStatus === 'approved'),
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      maxBytes: 8 * 1024 * 1024,
      categories: ['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other'],
      visibilityOptions: ['couple','couple_venue','planner','vendor','guest_visible'],
    };
  });

  app.post('/api/events/:eventId/couple-documents', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleDocumentUploadSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const savedUrl = saveDocumentDataUri(parsed.data.dataUri, 'couple_doc');
    const extractedSummary = extractDocumentSummary({ filename: parsed.data.filename, category: parsed.data.category, notes: parsed.data.notes });
    const doc = coupleDocumentsRepo.create({ organizationId: event.organization_id, eventId, filename: parsed.data.filename, url: savedUrl, mimeType: parsed.data.mimeType, category: parsed.data.category, visibility: parsed.data.visibility, notes: parsed.data.notes, extractedSummary, uploadedBy: req.auth!.userId });
    if (privateFilePath(savedUrl)) assetsRepo.create({ organization_id: event.organization_id, event_id: eventId, owner_type: 'couple_document', owner_id: doc.id, storage_key: savedUrl, original_filename: doc.filename, mime_type: doc.mime_type, visibility: 'private', publish_status: 'draft', created_by: req.auth!.userId });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.document.upload', targetType: 'couple_document', targetId: doc.id, ip: req.ip, details: { eventId, category: doc.category, visibility: doc.visibility } });
    return reply.code(201).send({ document: safeDocument(doc) });
  });

  app.patch('/api/events/:eventId/couple-documents/:documentId', { preHandler: requireAuth }, async (req) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const current = coupleDocumentsRepo.findById(documentId);
    if (!current || current.event_id !== eventId) throw NotFound('document-not-found');
    const parsed = coupleDocumentUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = coupleDocumentsRepo.update(documentId, parsed.data, req.auth!.userId);
    return { document: updated ? safeDocument(updated) : null };
  });

  app.post('/api/events/:eventId/couple-documents/:documentId/version', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const current = coupleDocumentsRepo.findById(documentId);
    if (!current || current.event_id !== eventId) throw NotFound('document-not-found');
    const parsed = coupleDocumentUploadSchema.pick({ filename: true, dataUri: true, mimeType: true, notes: true }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const savedUrl = saveDocumentDataUri(parsed.data.dataUri, 'couple_doc');
    const extractedSummary = extractDocumentSummary({ filename: parsed.data.filename, category: current.category, notes: parsed.data.notes });
    const updated = coupleDocumentsRepo.newVersion(documentId, { filename: parsed.data.filename, url: savedUrl, mimeType: parsed.data.mimeType, notes: parsed.data.notes, actor: req.auth!.userId, extractedSummary });
    return reply.code(201).send({ document: updated ? safeDocument(updated) : null });
  });

  app.get('/api/events/:eventId/couple-documents/final-packet.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const docs = coupleDocumentsRepo.listForEvent(eventId).map(safeDocument);
    const text = [`${event.title} — Shared Final Wedding Document Packet`, '', ...docs.map((doc) => [`${doc.filename} v${doc.version}`, `Category: ${doc.category}`, `Visibility: ${doc.visibility}`, `Approval: ${doc.approvalStatus}`, `URL: ${doc.url}`, doc.extractedSummary ? `Review summary: ${doc.extractedSummary}` : ''].filter(Boolean).join('\n'))].join('\n\n---\n\n');
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename="couple_final_document_packet_${eventId}.txt"`);
    return reply.send(text);
  });

  app.get('/api/events/:eventId/couple-design', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const preferences = metadata.coupleDesignPreferences ?? {};
    const reviewRequest = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest).find((r) => r.requestType === 'design_preferences_review' && ['pending', 'approved', 'rejected'].includes(r.status));
    const fields = Object.keys(coupleDesignPreferencesSchema.shape);
    const completeCount = fields.filter((field) => String(preferences[field] ?? '').trim()).length;
    return {
      preferences,
      progress: { completeCount, total: fields.length, percent: Math.round((completeCount / fields.length) * 100) },
      review: { status: reviewRequest?.status ?? metadata.coupleDesignReviewStatus ?? 'draft', requestId: reviewRequest?.id ?? null, updatedAt: metadata.coupleDesignUpdatedAt ?? null, updatedBy: metadata.coupleDesignUpdatedBy ?? null },
      moodBoard: String(preferences.moodBoardLinks || '').split(/\n|,/).map((s) => s.trim()).filter(Boolean),
      aiSummary: designSummary(preferences),
      venueTemplateHints: ['Ceremony style', 'Rain plan preference', 'Floorplan preference', 'Linens and colors', 'Bar/menu notes', 'Signage and rentals', 'Music restrictions', 'Cultural traditions', 'VIP family / wedding party / photo shot list'],
    };
  });

  app.patch('/api/events/:eventId/couple-design', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleDesignPreferencesSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const preferences = { ...(metadata.coupleDesignPreferences ?? {}), ...parsed.data };
    const updatedMetadata = { ...metadata, coupleDesignPreferences: preferences, coupleDesignReviewStatus: 'draft', coupleDesignUpdatedAt: new Date().toISOString(), coupleDesignUpdatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: updatedMetadata } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.design.save_draft', targetType: 'event', targetId: eventId, ip: req.ip, details: { fields: Object.keys(parsed.data) } });
    return { preferences, progress: { percent: Math.round((Object.values(preferences).filter((v) => String(v ?? '').trim()).length / Object.keys(coupleDesignPreferencesSchema.shape).length) * 100) }, reviewStatus: 'draft', aiSummary: designSummary(preferences) };
  });

  app.post('/api/events/:eventId/couple-design/submit-review', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ note: z.string().max(2000).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'design_preferences_review', note: parsed.data.note, metadata: { source: 'couple_design_preferences', preferences: metadata.coupleDesignPreferences ?? {}, aiSummary: designSummary(metadata.coupleDesignPreferences ?? {}) } });
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleDesignReviewStatus: 'pending', coupleDesignReviewRequestId: request.id, coupleDesignUpdatedAt: new Date().toISOString(), coupleDesignUpdatedBy: req.auth!.email } } as never);
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-finance', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const contracts = contractsRepo.listForEvent(eventId).map(safeContract);
    const payments = paymentLinksRepo.listForEvent(eventId).map(safePayment);
    const totalContracted = contracts.reduce((sum, c) => sum + (c.amountCents || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.amountCents, 0);
    const paid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amountCents, 0);
    const pending = payments.filter((p) => ['pending', 'processing'].includes(p.status)).reduce((sum, p) => sum + p.amountCents, 0);
    const openBalance = Math.max(0, Math.max(totalContracted, totalPayments) - paid);
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest).filter((r) => ['finance_question', 'change_order_request'].includes(r.requestType));
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.finance.view', targetType: 'event', targetId: eventId, ip: req.ip, details: { contractCount: contracts.length, paymentCount: payments.length } });
    return {
      contracts,
      payments,
      totals: { contractedCents: totalContracted, scheduledPaymentCents: totalPayments, paidCents: paid, pendingCents: pending, openBalanceCents: openBalance },
      refundCancellationPolicy: metadata.refundCancellationPolicy || metadata.cancellationPolicy || 'Ask the venue to confirm cancellation/refund policy for your agreement.',
      paymentScheduleExplanation: 'This is a client-safe schedule from venue-created invoices/payment links. Internal budgets, vendor margins, revenue forecasts, and owner finance notes are hidden.',
      hiddenFields: ['Internal venue budget', 'Vendor margins', 'Revenue forecast', 'Owner finance notes', 'Internal payment reconciliation notes'],
      changeOrders: requests.filter((r) => r.requestType === 'change_order_request'),
      questions: requests.filter((r) => r.requestType === 'finance_question'),
      paymentMethodVault: { status: 'not_configured', note: 'Payment method vaulting requires a connected payment provider and venue policy approval.' },
    };
  });

  app.post('/api/events/:eventId/couple-finance/question', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = financeQuestionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'finance_question', note: parsed.data.question, metadata: { sourceType: parsed.data.sourceType, sourceId: parsed.data.sourceId, source: 'couple_finance_center' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-finance/change-order', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = changeOrderSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'change_order_request', note: parsed.data.note, metadata: { changeType: parsed.data.changeType, label: parsed.data.label, estimatedAmountCents: parsed.data.estimatedAmountCents, source: 'couple_finance_center' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-finance/contracts/:contractId/sign', { preHandler: requireAuth }, async (req) => {
    const { eventId, contractId } = req.params as { eventId: string; contractId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const contract = contractsRepo.findById(contractId);
    if (!contract || contract.event_id !== eventId) throw NotFound('contract-not-found');
    const parsed = coupleContractSignSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = contractsRepo.update(contractId, { status: 'signed', signedAt: new Date().toISOString(), signature: parsed.data.signature, signerIp: req.ip });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.contract.sign', targetType: 'contract', targetId: contractId, ip: req.ip });
    return { contract: updated ? safeContract(updated) : null };
  });

  app.get('/api/events/:eventId/couple-finance/packet.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const contracts = contractsRepo.listForEvent(eventId).map(safeContract);
    const payments = paymentLinksRepo.listForEvent(eventId).map(safePayment);
    const text = [`${event.title} — Contract & Payment Packet`, '', 'Contracts:', ...contracts.map((c) => `- ${c.title}: ${c.status}${c.signedAt ? ` signed ${c.signedAt}` : ''}`), '', 'Payments / receipts:', ...payments.map((p) => `- ${p.label}: ${p.status} ${p.amountCents / 100} due ${p.dueDate || 'TBD'}${p.paidAt ? ` paid ${p.paidAt}` : ''}`)].join('\n');
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename="couple_contract_payment_packet_${eventId}.txt"`);
    return reply.send(text);
  });

  app.get('/api/events/:eventId/couple-vendors', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const vendors = vendorsRepo.listForOrg(event.organization_id, { eventId }).map(safeVendor);
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    return {
      vendors,
      planner: {
        name: metadata.plannerName || metadata.plannerContactName || null,
        email: metadata.plannerEmail || null,
        phone: metadata.plannerPhone || null,
        status: requests.find((r) => r.requestType === 'planner_collaboration')?.status || (metadata.plannerName ? 'connected' : 'not_connected'),
      },
      requests: requests.filter((r) => ['vendor_request', 'vendor_question', 'planner_collaboration'].includes(r.requestType)),
      recommendationsEnabled: metadata.preferredVendorRecommendationsEnabled !== false,
      visibleDocumentTypes: ['menu', 'floorplan', 'ceremony_music', 'floral_proposal', 'photography_shot_list'],
      hiddenFields: ['COI / insurance files', 'vendor no-show risk', 'internal vendor payment details', 'vendor contract amount', 'internal venue/vendor notes'],
      comparison: vendors.map((v) => ({ id: v.id, name: v.name, category: v.category, status: v.confirmedStatus, documents: v.visibleDocuments.length })),
    };
  });

  app.post('/api/events/:eventId/couple-vendors/request', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ category: z.string().min(1).max(120), note: z.string().max(2000).optional(), preferredVendorId: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'vendor_request', note: parsed.data.note, metadata: { category: parsed.data.category, preferredVendorId: parsed.data.preferredVendorId, source: 'couple_vendor_board' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-vendors/question', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ vendorId: z.string().optional(), question: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'vendor_question', note: parsed.data.question, metadata: { vendorId: parsed.data.vendorId, source: 'couple_vendor_board' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-planner/collaboration-request', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ plannerName: z.string().max(160).optional(), plannerEmail: z.string().email().optional(), note: z.string().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'planner_collaboration', targetEmail: parsed.data.plannerEmail, targetName: parsed.data.plannerName, note: parsed.data.note, metadata: { source: 'couple_planner_hub' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-layout', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layout = layouts[0] ?? null;
    const items = layoutItems(layout);
    const summarized = items.map(summarizeLayoutItem);
    const guests = guestsRepo.listForEvent(eventId).map(safeGuest);
    const tables = summarized.filter((i) => ['round_table', 'rect_table', 'table'].includes(i.type));
    const seats = summarized.filter((i) => ['chair', 'seat'].includes(i.type));
    const assignedSeatGuestIds = seats.map((s) => s.guestId).filter(Boolean) as string[];
    const duplicateSeatAssignments = Array.from(new Set(assignedSeatGuestIds.filter((id, index, arr) => arr.indexOf(id) !== index)));
    const unseatedGuests = guests.filter((g) => !g.tableAssignment && !assignedSeatGuestIds.includes(g.id));
    const comments = coupleRequestsRepo.listForEvent(eventId).map(safeRequest).filter((r) => r.requestType === 'event_change_request' && (r.metadata as any)?.source === 'couple_layout_comment');
    const versions = layout ? layoutsRepo.listVersions(layout.id).slice(0, 5).map((v) => ({ revision: v.revision, createdAt: v.created_at, summary: v.change_description || `Revision ${v.revision} saved` })) : [];
    return {
      layout: layout ? { id: layout.id, name: layout.name, approvalStatus: layout.approval_status, revision: layout.revision, updatedAt: layout.updated_at } : null,
      summary: {
        tables: tables.length,
        seats: seats.length,
        assignedSeats: assignedSeatGuestIds.length,
        unseatedGuests: unseatedGuests.length,
        duplicateSeatAssignments: duplicateSeatAssignments.length,
        vendorZones: summarized.filter((i) => i.type === 'vendor_zone').length,
        exits: summarized.filter((i) => /exit/i.test(i.type) || /exit/i.test(i.label)).length,
        adaRoutes: summarized.filter((i) => /ada|access|aisle|walkway/i.test(`${i.type} ${i.label}`)).length,
      },
      visibleItems: {
        tables,
        seats,
        danceFloor: summarized.filter((i) => /dance/i.test(`${i.type} ${i.label}`)),
        ceremonySeating: summarized.filter((i) => /ceremony/i.test(`${i.type} ${i.label}`)),
        bars: summarized.filter((i) => /bar/i.test(`${i.type} ${i.label}`)),
        buffet: summarized.filter((i) => /buffet|catering/i.test(`${i.type} ${i.label}`)),
        restrooms: summarized.filter((i) => /restroom|bathroom/i.test(`${i.type} ${i.label}`)),
        entrances: summarized.filter((i) => /entrance|entry|exit/i.test(`${i.type} ${i.label}`)),
        adaRoutes: summarized.filter((i) => /ada|access|aisle|walkway/i.test(`${i.type} ${i.label}`)),
        photoBooth: summarized.filter((i) => /photo/i.test(`${i.type} ${i.label}`)),
        djBand: summarized.filter((i) => /dj|band|music/i.test(`${i.type} ${i.label}`)),
        sweetheartHeadTable: summarized.filter((i) => /sweetheart|head table|family table/i.test(`${i.type} ${i.label}`)),
      },
      seating: { unseatedGuests, duplicateSeatAssignments, tableAssignments: guests.filter((g) => g.tableAssignment || g.seatAssignment).map((g) => ({ guestId: g.id, fullName: g.fullName, tableAssignment: g.tableAssignment, seatAssignment: g.seatAssignment, tags: g.tags })) },
      comments,
      approval: metadata.coupleLayoutApproval ?? { status: 'not_requested', updatedAt: null, note: null },
      versionHistory: versions,
      guidance: ['Seat VIP/family guests where they have clear ceremony/reception access.', 'Confirm ADA routes before final seating.', 'Place guests needing mobility support near accessible paths, restrooms, and exits.', 'Use venue/planner approval before treating seating as final.'],
      walkthrough3d: { status: 'concept', note: '3D walkthrough placeholder; use the visual preview and venue floor walk for now.' },
    };
  });

  app.post('/api/events/:eventId/couple-layout/comment', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleLayoutCommentSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'event_change_request', note: parsed.data.note, metadata: { source: 'couple_layout_comment', x: parsed.data.x, y: parsed.data.y, areaLabel: parsed.data.areaLabel } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-layout/approval', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleLayoutApprovalSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const approval = { status: parsed.data.status, note: parsed.data.note ?? null, updatedAt: new Date().toISOString(), updatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleLayoutApproval: approval, layoutLastUpdatedAt: approval.updatedAt } } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.layout.approval', targetType: 'event', targetId: eventId, ip: req.ip, details: approval });
    return { approval };
  });

  app.patch('/api/events/:eventId/couple-guests/:guestId/seating', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guest = guestsRepo.findById(guestId);
    if (!guest || guest.event_id !== eventId) throw NotFound('guest-not-found');
    const parsed = coupleSeatingSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = guestsRepo.update(guestId, { tableAssignment: parsed.data.tableAssignment ?? undefined, seatAssignment: parsed.data.seatAssignment ?? undefined });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.seating.update', targetType: 'guest', targetId: guestId, ip: req.ip, details: { eventId, tableAssignment: parsed.data.tableAssignment, seatAssignment: parsed.data.seatAssignment, note: parsed.data.note } });
    return { guest: updated ? safeGuest(updated) : null };
  });

  app.get('/api/events/:eventId/couple-layout/seating.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const headers = ['Guest','Household','Table','Seat','Tags','Accessibility'];
    const rows = guestsRepo.listForEvent(eventId).map(safeGuest).map((g) => [g.fullName, g.householdName, g.tableAssignment ?? '', g.seatAssignment ?? '', g.tags.join('|'), g.accessibilityNotes ?? '']);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="couple_seating_chart_${eventId}.csv"`);
    return reply.send(csv);
  });

  app.get('/api/events/:eventId/couple-layout/place-cards.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const text = guestsRepo.listForEvent(eventId).map(safeGuest).map((g) => `${g.fullName}\nTable: ${g.tableAssignment || 'TBD'}${g.seatAssignment ? ` · Seat: ${g.seatAssignment}` : ''}\n`).join('\n---\n');
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename="place_cards_${eventId}.txt"`);
    return reply.send(text);
  });

  app.get('/api/events/:eventId/couple-timeline', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const allItems = timelineRepo.listForEvent(eventId);
    const items = allItems.filter(isCoupleTimelineItem).map(safeTimelineItem);
    const subEvents = subEventsRepo.listForEvent(eventId).map((s) => ({ id: s.id, title: s.title, startsAt: s.starts_at, endsAt: s.ends_at, inviteOnly: !!s.invite_only }));
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    const changeRequests = requests.filter((r) => r.requestType === 'event_change_request' && (r.metadata as any)?.source === 'couple_timeline');
    return {
      items,
      hiddenInternalCount: allItems.length - items.length,
      subEvents,
      rehearsal: subEvents.find((s) => /rehearsal/i.test(s.title)) ?? metadata.rehearsalTimeline ?? null,
      approval: metadata.coupleTimelineApproval ?? { status: 'not_requested', updatedAt: null, note: null },
      changeRequests,
      versionHistory: [
        { at: metadata.timelineLastUpdatedAt || (event as any).updated_at || event.created_at, summary: 'Venue timeline shared for couple review.' },
        ...changeRequests.slice(0, 5).map((r) => ({ at: r.createdAt, summary: `Couple requested timeline change: ${r.note || (r.metadata as any)?.requestedChange || 'change requested'}` })),
      ],
      education: [
        'Sunset photos: confirm photo timing against sunset before finalizing ceremony/cocktail hour.',
        'Photography windows: leave enough buffer for family, wedding party, and couple portraits.',
        'Catering service timing: dinner, speeches, and dances should align with meal service and room reset needs.',
        'Venue noise cutoff: last call, final song, and send-off must respect venue quiet-hour rules.',
      ],
    };
  });

  app.post('/api/events/:eventId/couple-timeline/request-change', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleTimelineChangeSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'event_change_request', note: parsed.data.reason || parsed.data.requestedChange, metadata: { source: 'couple_timeline', timelineItemId: parsed.data.timelineItemId, requestedChange: parsed.data.requestedChange } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-timeline/approval', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleTimelineApprovalSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const approval = { status: parsed.data.status, note: parsed.data.note ?? null, updatedAt: new Date().toISOString(), updatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleTimelineApproval: approval, timelineLastUpdatedAt: approval.updatedAt } } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.timeline.approval', targetType: 'event', targetId: eventId, ip: req.ip, details: approval });
    return { approval };
  });

  app.get('/api/events/:eventId/couple-timeline/export.ics', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const events = timelineRepo.listForEvent(eventId).filter(isCoupleTimelineItem).map((item) => {
      const start = item.starts_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const end = (item.ends_at || item.starts_at).replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      return ['BEGIN:VEVENT', `UID:${item.id}@wvi-couple`, `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${item.title.replace(/[,;\\]/g, ' ')}`, item.location ? `LOCATION:${item.location.replace(/[,;\\]/g, ' ')}` : '', 'END:VEVENT'].filter(Boolean).join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Venue Intelligence Couple Timeline//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="couple_timeline_${eventId}.ics"`);
    return reply.send(ics);
  });

  app.get('/api/events/:eventId/couple-guest-portal', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const config = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    const approval = requests.find((r) => r.requestType === 'guest_portal_update' && ['pending','approved'].includes(r.status));
    const reminder = requests.find((r) => r.requestType === 'rsvp_reminder_request' && ['pending','approved'].includes(r.status));
    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return {
      portal: {
        enabled: !!cfg?.enabled,
        publicUrl: `${baseUrl}/#/portal/${eventId}`,
        couplePlanningPortalUrl: `${baseUrl}/#/couple/events/${eventId}`,
        rsvpDeadline: config.rsvpDeadline || parseEventMetadata(event).rsvpDeadline || event.rsvp_deadline || null,
        editWindowDays: config.rsvpEditWindowDays ?? null,
        access: cfg ? { startsAt: cfg.access_starts_at ?? null, endsAt: cfg.access_ends_at ?? null, gracePeriodHours: cfg.grace_period_hours ?? null } : null,
        config,
      },
      approvalStatus: approval?.status ?? 'not_requested',
      reminderStatus: reminder?.status ?? 'not_requested',
      guestsWillSee: ['Welcome message', 'Schedule and sub-events shared by the venue', 'RSVP questions', 'Meal/dietary/accessibility fields', 'Travel, registry, dress code, parking, shuttle, hotel/lodging, FAQ, and seating if enabled'],
      guestsWillNotSee: ['Couple planning checklist', 'Private couple profile', 'Venue internal notes', 'Staff assignments', 'Payment details', 'Audit logs', 'Other weddings'],
      mobileQa: ['Open the guest RSVP portal on iPhone Safari', 'Open on Android Chrome', 'Submit a test RSVP for one household', 'Confirm registry/travel links open', 'Confirm accessibility/dietary notes are clear', 'Confirm edit-window/deadline copy is visible'],
      qrPayload: `WVI-RSVP:${eventId}:${event.slug}`,
    };
  });

  app.post('/api/events/:eventId/couple-guest-portal/request-update', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ config: z.record(z.unknown()), note: z.string().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'guest_portal_update', note: parsed.data.note, metadata: { config: parsed.data.config, source: 'couple_guest_portal_editor' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-guest-portal/reminder-request', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ sendAt: z.string().optional(), audience: z.enum(['not_responded','missing_meal','all_guests']).default('not_responded'), messagePreview: z.string().max(2000) }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'rsvp_reminder_request', note: parsed.data.messagePreview, metadata: { sendAt: parsed.data.sendAt, audience: parsed.data.audience, source: 'couple_rsvp_reminder_builder' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-guests/:guestId/portal-link', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guest = guestsRepo.findById(guestId);
    if (!guest || guest.event_id !== eventId) throw NotFound('guest-not-found');
    const token = guestsRepo.rotatePortalToken(guestId);
    guestsRepo.update(guestId, { allowPortalAccess: true });
    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const url = `${baseUrl}/#/portal/${eventId}?guest=${encodeURIComponent(guestId)}&token=${encodeURIComponent(token)}`;
    return { url, token, qrPayload: `WVI-GUEST:${eventId}:${guestId}:${token.slice(0, 10)}` };
  });

  app.get('/api/events/:eventId/couple-guests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guests = guestsRepo.listForEvent(eventId).map(safeGuest);
    const counts = guestsRepo.countByStatus(eventId);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.guests.view', targetType: 'event', targetId: eventId, ip: req.ip, details: { guestCount: guests.length } });
    const householdMap = new Map<string, typeof guests>();
    for (const guest of guests) {
      const key = guest.householdName || guest.partyName || guest.fullName;
      householdMap.set(key, [...(householdMap.get(key) ?? []), guest]);
    }
    const duplicateSuggestions = Array.from(new Map(guests.filter((g) => g.email).map((g) => [String(g.email).toLowerCase(), guests.filter((x) => x.email && String(x.email).toLowerCase() === String(g.email).toLowerCase())])).entries())
      .filter(([, matches]) => matches.length > 1)
      .map(([email, matches]) => ({ signal: 'email', value: email, guests: matches.map((g) => ({ id: g.id, fullName: g.fullName })) }));
    return {
      guests,
      counts,
      households: Array.from(householdMap.entries()).map(([name, members]) => ({ name, members, count: members.length })),
      filters: {
        missingAddress: guests.filter((g) => !g.mailingAddress).length,
        missingEmail: guests.filter((g) => !g.email).length,
        notInvitedYet: guests.filter((g) => !g.allowPortalAccess).length,
        notResponded: guests.filter((g) => g.rsvpStatus === 'pending').length,
        needsFollowUp: guests.filter((g) => g.rsvpStatus === 'pending' || !g.email || !g.mailingAddress).length,
      },
      duplicateSuggestions,
      privacy: {
        dietaryRestrictions: 'Visible to the couple and venue planning team. Share with catering only when needed for service.',
        accessibilityNotes: 'Visible to the couple and venue planning team. Share with event-day staff only for guest care.',
        coupleNotes: 'Internal couple/venue planning note. Not shown to public guests by default.',
      },
    };
  });

  app.post('/api/events/:eventId/couple-guests', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleGuestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = { mailingAddress: parsed.data.mailingAddress, mealChoice: parsed.data.mealChoice, coupleNotes: parsed.data.notes, coupleGuestTags: parsed.data.tags ?? [], householdName: parsed.data.householdName || parsed.data.partyName };
    const guest = guestsRepo.create(event.organization_id, eventId, {
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone,
      partyName: parsed.data.householdName || parsed.data.partyName,
      rsvpStatus: parsed.data.rsvpStatus,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      accessibilityNotes: parsed.data.accessibilityNotes,
      plusOneAllowed: parsed.data.plusOneAllowed,
      metadata,
    });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.guest.create', targetType: 'guest', targetId: guest.id, ip: req.ip, details: { eventId } });
    return reply.code(201).send({ guest: safeGuest(guest) });
  });

  app.patch('/api/events/:eventId/couple-guests/:guestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const current = guestsRepo.findById(guestId);
    if (!current || current.event_id !== eventId) throw NotFound('guest-not-found');
    const parsed = coupleGuestSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const currentMeta = (() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })();
    const metadata = { ...currentMeta, mailingAddress: parsed.data.mailingAddress ?? currentMeta.mailingAddress, mealChoice: parsed.data.mealChoice ?? currentMeta.mealChoice, coupleNotes: parsed.data.notes ?? currentMeta.coupleNotes, coupleGuestTags: parsed.data.tags ?? currentMeta.coupleGuestTags ?? [], householdName: parsed.data.householdName ?? currentMeta.householdName };
    const updated = guestsRepo.update(guestId, {
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone,
      partyName: parsed.data.householdName || parsed.data.partyName,
      rsvpStatus: parsed.data.rsvpStatus,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      accessibilityNotes: parsed.data.accessibilityNotes,
      plusOneAllowed: parsed.data.plusOneAllowed,
      metadata,
    });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.guest.update', targetType: 'guest', targetId: guestId, ip: req.ip, details: { eventId } });
    return { guest: updated ? safeGuest(updated) : null };
  });

  app.post('/api/events/:eventId/couple-guests/import-preview', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = importPreviewSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const lines = parsed.data.csv.trim().split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0] || '').map((h) => h.toLowerCase().replace(/\s+/g, ''));
    const rows = lines.slice(1).map(parseCsvLine);
    const existing = guestsRepo.listForEvent(eventId).map(safeGuest);
    const warnings: string[] = [];
    const required = ['fullname'];
    for (const field of required) if (!headers.includes(field)) warnings.push(`Missing required column: ${field}`);
    if (!headers.includes('email')) warnings.push('Email column is recommended for RSVP reminders.');
    if (!headers.includes('mailingaddress')) warnings.push('Mailing address column is recommended for invitations/save-the-dates.');
    const seenNames = new Set<string>();
    const duplicates: string[] = [];
    rows.forEach((row) => {
      const name = row[headers.indexOf('fullname')]?.toLowerCase();
      const email = row[headers.indexOf('email')]?.toLowerCase();
      if (name && seenNames.has(name)) duplicates.push(name);
      if (name) seenNames.add(name);
      if (email && existing.some((g) => String(g.email || '').toLowerCase() === email)) duplicates.push(email);
    });
    return { rowCount: rows.length, headers, warnings, duplicateSignals: Array.from(new Set(duplicates)).slice(0, 25), householdSuggestions: rows.map((row) => row[headers.indexOf('householdname')] || row[headers.indexOf('partyname')]).filter(Boolean).slice(0, 25), willSave: false };
  });

  app.get('/api/events/:eventId/couple-guests/export.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guests = guestsRepo.listForEvent(eventId).map(safeGuest);
    const headers = ['Full Name','Email','Phone','Household','Mailing Address','RSVP','Meal Choice','Dietary','Accessibility','Tags','Table','Seat','Room'];
    const rows = guests.map((g) => [g.fullName, g.email ?? '', g.phone ?? '', g.householdName, g.mailingAddress, g.rsvpStatus, g.mealChoice, g.dietaryRestrictions ?? '', g.accessibilityNotes ?? '', g.tags.join('|'), g.tableAssignment ?? '', g.seatAssignment ?? '', g.roomAssignment ?? '']);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="couple_guest_list_${eventId}.csv"`);
    return reply.send(csv);
  });

  app.get('/api/events/:eventId/couple-planning', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const tasks = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date, packageKey: metadata.package || metadata.packageName, cultureKey: metadata.cultureKey });
    const today = new Date().toISOString().slice(0, 10);
    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        eventId: t.event_id,
        templateKey: t.template_key,
        title: t.title,
        description: t.description,
        owner: t.owner,
        dueDate: t.due_date,
        status: t.status,
        approvalStatus: t.approval_status,
        decisionCategory: t.decision_category,
        attachments: (() => { try { return JSON.parse(t.attachments || '[]'); } catch { return []; } })(),
        history: (() => { try { return JSON.parse(t.history || '[]'); } catch { return []; } })(),
        isOverdue: !!t.due_date && t.due_date < today && t.status !== 'completed',
        isUpcoming: !!t.due_date && t.due_date >= today && t.due_date <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) && t.status !== 'completed',
        updatedAt: t.updated_at,
      })),
      template: { packageKey: metadata.package || metadata.packageName || 'standard', cultureKey: metadata.cultureKey || 'default', source: 'venue-controlled-default-deadline-template' },
    };
  });

  app.patch('/api/events/:eventId/couple-planning/:taskId', { preHandler: requireAuth }, async (req) => {
    const { eventId, taskId } = req.params as { eventId: string; taskId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = updatePlanningTaskSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const task = couplePlanningRepo.findById(taskId);
    if (!task || task.event_id !== eventId) throw NotFound('task-not-found');
    const updated = couplePlanningRepo.update(taskId, parsed.data, req.auth!.email);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.planning_task.update', targetType: 'couple_planning_task', targetId: taskId, ip: req.ip, details: { eventId, status: parsed.data.status, approvalStatus: parsed.data.approvalStatus } });
    return { task: updated };
  });

  app.post('/api/events/:eventId/couple-planning/:taskId/question', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, taskId } = req.params as { eventId: string; taskId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const task = couplePlanningRepo.findById(taskId);
    if (!task || task.event_id !== eventId) throw NotFound('task-not-found');
    const parsed = z.object({ question: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'venue_question', note: parsed.data.question, metadata: { source: 'couple_planning_task', taskId, taskTitle: task.title } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-profile', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    return {
      profile: metadata.coupleProfile ?? {},
      lastUpdatedAt: metadata.coupleProfileUpdatedAt ?? null,
      lastUpdatedBy: metadata.coupleProfileUpdatedBy ?? null,
    };
  });

  app.patch('/api/events/:eventId/couple-profile', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleProfileSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const nextProfile = { ...(metadata.coupleProfile ?? {}), ...parsed.data };
    const updatedMetadata = {
      ...metadata,
      coupleProfile: nextProfile,
      coupleProfileUpdatedAt: new Date().toISOString(),
      coupleProfileUpdatedBy: req.auth!.email,
    };
    eventsRepo.update(eventId, { metadata: updatedMetadata } as never);
    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'couple.profile.update',
      targetType: 'event',
      targetId: eventId,
      ip: req.ip,
      details: { fields: Object.keys(parsed.data) },
    });
    return { profile: nextProfile, lastUpdatedAt: updatedMetadata.coupleProfileUpdatedAt, lastUpdatedBy: updatedMetadata.coupleProfileUpdatedBy };
  });

  app.get('/api/events/:eventId/couple-requests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const canReview = can(req.auth!.memberships, { eventId }, 'events.members.invite', orgMap) || can(req.auth!.memberships, { eventId }, 'events.edit', orgMap);
    const rows = canReview ? coupleRequestsRepo.listForEvent(eventId) : coupleRequestsRepo.listForRequester(eventId, req.auth!.userId);
    return { requests: rows.map(safeRequest), canReview };
  });

  app.post('/api/events/:eventId/couple-requests', { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (['partner_invite', 'planner_request'].includes(parsed.data.requestType) && !parsed.data.targetEmail) {
      throw BadRequest('target-email-required');
    }
    const request = coupleRequestsRepo.create({
      organizationId: event.organization_id,
      eventId,
      requesterUserId: req.auth!.userId,
      requestType: parsed.data.requestType,
      targetEmail: parsed.data.targetEmail,
      targetName: parsed.data.targetName,
      note: parsed.data.note,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        submittedByRole: req.auth!.memberships.find((m) => m.eventId === eventId)?.roleKey ?? 'member',
      },
    });
    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'couple.request.create',
      targetType: 'couple_portal_request',
      targetId: request.id,
      ip: req.ip,
      details: { eventId, requestType: request.request_type, targetEmail: request.target_email },
    });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.patch('/api/events/:eventId/couple-requests/:requestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.members.invite', orgMap) && !can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = updateRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const current = coupleRequestsRepo.findById(requestId);
    if (!current || current.event_id !== eventId) throw NotFound('request-not-found');
    const metadata = { ...(() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })(), ...(parsed.data.metadata ?? {}), reviewNote: parsed.data.note };
    const updated = coupleRequestsRepo.updateStatus(requestId, parsed.data.status, req.auth!.userId, metadata)!;

    if (parsed.data.status === 'approved' && updated.request_type === 'partner_invite' && updated.target_email) {
      const existing = usersRepo.findByEmail(updated.target_email);
      const coupleRole = rolesRepo.findByKey(null, 'couple');
      if (existing && coupleRole) eventsRepo.addMember({ eventId, userId: existing.id, roleId: coupleRole.id });
    }
    if (parsed.data.status === 'approved' && updated.request_type === 'planner_request' && updated.target_email) {
      const existing = usersRepo.findByEmail(updated.target_email);
      const plannerRole = rolesRepo.findByKey(null, 'planner');
      if (existing && plannerRole) eventsRepo.addMember({ eventId, userId: existing.id, roleId: plannerRole.id });
    }

    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'couple.request.update',
      targetType: 'couple_portal_request',
      targetId: requestId,
      ip: req.ip,
      details: { eventId, requestType: updated.request_type, status: updated.status },
    });
    return { request: safeRequest(updated) };
  });
}
