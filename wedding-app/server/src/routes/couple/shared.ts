import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { can, type Membership } from '../../lib/rbac.js';
import { auditRepo, assetsRepo, catalogRepo, contractsRepo, coupleAppointmentsRepo, coupleDocumentsRepo, couplePlanningRepo, coupleRequestsRepo, eventsRepo, guestsRepo, layoutsRepo, inventoryRepo, jobsRepo, messagesRepo, paymentLinksRepo, portalConfigRepo, rolesRepo, subEventsRepo, timelineRepo, usersRepo, vendorsRepo, venuesRepo } from '../../db/repos/index.js';
import { saveDocumentDataUri, privateFilePath } from '../../lib/fileStorage.js';
import { createReadStream, existsSync } from 'node:fs';
import { db } from '../../db/database.js';
import { uuid } from '../../lib/crypto.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';

export const createRequestSchema = z.object({
  requestType: z.enum(['partner_invite', 'planner_request', 'account_recovery', 'identity_verification','venue_question','event_change_request','guest_portal_update','rsvp_reminder_request']),
  targetEmail: z.string().email().optional(),
  targetName: z.string().max(120).optional(),
  note: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled']),
  note: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const coupleTimelineChangeSchema = z.object({
  timelineItemId: z.string().optional(),
  requestedChange: z.string().min(1).max(2000),
  reason: z.string().max(2000).optional(),
});

export const coupleTimelineApprovalSchema = z.object({
  status: z.enum(['approved', 'changes_requested']),
  note: z.string().max(2000).optional(),
});

export const coupleLayoutCommentSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  areaLabel: z.string().max(200).optional(),
  note: z.string().min(1).max(2000),
});

export const coupleLayoutApprovalSchema = z.object({
  status: z.enum(['approved', 'changes_requested']),
  note: z.string().max(2000).optional(),
});

export const appointmentRequestSchema = z.object({
  appointmentType: z.enum(['tasting','planning_meeting','final_walkthrough','rehearsal','payment','tour','other']),
  title: z.string().max(200).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  location: z.string().max(300).optional(),
  note: z.string().max(2000).optional(),
  availabilityWindow: z.string().max(500).optional(),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(['reschedule_requested','cancel_requested','completed','cancelled','confirmed']),
  note: z.string().max(2000).optional(),
});

export const appointmentSignoffSchema = z.object({
  note: z.string().max(2000).optional(),
});

export const coupleInboxMessageSchema = z.object({ 
  threadType: z.enum(['venue', 'planner', 'urgent', 'decision']).default('venue'),
  body: z.string().min(1).max(10000),
  urgency: z.enum(['normal','urgent']).default('normal'),
});

export const coupleDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
});

export const notificationPrefsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['instant','daily','weekly','off']).optional(),
  quietHours: z.record(z.unknown()).optional(),
  decisionAlerts: z.boolean().optional(),
  dueTaskAlerts: z.boolean().optional(),
  messageAlerts: z.boolean().optional(),
});

export const postEventSurveySchema = z.object({
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

export const postEventLostItemSchema = z.object({
  itemDescription: z.string().min(1).max(1200),
  lastSeenLocation: z.string().max(500).optional(),
  contactPreference: z.enum(['email','phone','either']).default('email'),
  contactValue: z.string().max(254).optional(),
});

export const postEventReviewSchema = z.object({
  platform: z.enum(['google','the_knot','weddingwire','zola','other']).default('google'),
  rating: z.number().int().min(1).max(5).optional(),
  testimonial: z.string().max(2000).optional(),
  permissionToPublish: z.boolean().optional(),
  reviewerName: z.string().max(160).optional(),
});

export const postEventReviewLinksSchema = z.object({
  google: z.string().url().optional().or(z.literal('')),
  theKnot: z.string().url().optional().or(z.literal('')),
  weddingwire: z.string().url().optional().or(z.literal('')),
  zola: z.string().url().optional().or(z.literal('')),
  other: z.string().url().optional().or(z.literal('')),
});

export const postEventBulkActionSchema = z.object({
  requestIds: z.array(z.string()).min(1).max(50),
  status: z.enum(['pending','approved','rejected','completed','cancelled']).optional(),
  assignedTo: z.string().email().optional().or(z.literal('')),
  slaDays: z.number().int().min(1).max(30).optional(),
  note: z.string().max(2000).optional(),
});

export const postEventFollowUpSchema = z.object({
  requestIds: z.array(z.string()).min(1).max(50),
  channel: z.enum(['email','sms','in_app']).default('email'),
  message: z.string().min(1).max(2000),
});


export const advancedPlanningSchema = z.object({
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

export const conciergeEscalationSchema = z.object({
  question: z.string().min(1).max(2000),
  moduleKey: z.string().max(80).optional(),
  urgency: z.enum(['normal','time_sensitive']).default('normal'),
});

export const coupleDocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  dataUri: z.string().min(1).max(2_000_000),
  mimeType: z.string().max(120).optional(),
  category: z.enum(['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other']),
  visibility: z.enum(['couple','couple_venue','planner','vendor','guest_visible']).default('couple_venue'),
  notes: z.string().max(2000).optional(),
});

export const coupleDocumentUpdateSchema = z.object({
  category: z.enum(['inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other']).optional(),
  visibility: z.enum(['couple','couple_venue','planner','vendor','guest_visible']).optional(),
  approvalStatus: z.enum(['draft','pending','approved','changes_requested','rejected']).optional(),
  notes: z.string().max(2000).optional(),
});

export const financeQuestionSchema = z.object({ 
  sourceType: z.enum(['contract','invoice','payment','change_order','general']).default('general'),
  sourceId: z.string().optional(),
  question: z.string().min(1).max(2000),
});

export const changeOrderSchema = z.object({
  changeType: z.enum(['extra_hour','room_block','ceremony_upgrade','bar_package','rental_upgrade','other']),
  label: z.string().min(1).max(200),
  estimatedAmountCents: z.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
});

export const coupleContractSignSchema = z.object({
  signature: z.string().min(1).max(500),
});

export const coupleSeatingSchema = z.object({
  tableAssignment: z.string().max(60).optional().nullable(),
  seatAssignment: z.string().max(60).optional().nullable(),
  note: z.string().max(1000).optional(),
});

export const coupleGuestSchema = z.object({
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

export const importPreviewSchema = z.object({
  csv: z.string().min(1).max(200_000),
});

export const updatePlanningTaskSchema = z.object({
  status: z.enum(['not_started','in_progress','completed','blocked']).optional(),
  approvalStatus: z.enum(['not_required','pending','approved','changes_requested']).optional(),
  dueDate: z.string().optional().nullable(),
  attachments: z.array(z.object({ name: z.string().max(200), url: z.string().max(2000).optional(), note: z.string().max(1000).optional() })).optional(),
  note: z.string().max(2000).optional(),
});

export const coupleDesignPreferencesSchema = z.object({
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

export const coupleProfileSchema = z.object({
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

export function parseEventMetadata(event: { metadata: string }): Record<string, any> {
  try { return JSON.parse(event.metadata || '{}'); } catch { return {}; }
}

export function isCoupleTimelineItem(item: ReturnType<typeof timelineRepo.listForEvent>[number]) {
  const category = String(item.category || '').toLowerCase();
  const title = `${item.title} ${item.notes || ''}`.toLowerCase();
  const hidden = ['vendor_arrival', 'load_out', 'load_in', 'prep', 'setup', 'strike', 'staff', 'incident', 'internal'];
  return !hidden.some((term) => category.includes(term) || title.includes(term));
}

export function safeTimelineItem(item: ReturnType<typeof timelineRepo.listForEvent>[number]) {
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

export function layoutItems(layout: ReturnType<typeof layoutsRepo.listForOrg>[number] | null | undefined): Array<Record<string, any>> {
  if (!layout) return [];
  try {
    const payload = typeof layout.payload === 'string' ? JSON.parse(layout.payload || '{}') : layout.payload;
    return Array.isArray(payload.items) ? payload.items : [];
  } catch { return []; }
}

export function itemLabel(item: Record<string, any>) {
  return String(item.label || item.name || item.title || item.type || 'Item');
}

export function summarizeLayoutItem(item: Record<string, any>) {
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

export function extractDocumentSummary(input: { filename: string; category: string; notes?: string }) {
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

export function safeDocument(row: ReturnType<typeof coupleDocumentsRepo.listForEvent>[number]) {
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

export function contractClauseExplainers(content: string) {
  const lower = content.toLowerCase();
  const clauses: Array<{ label: string; plainLanguage: string }> = [];
  if (/payment|deposit|balance|installment/.test(lower)) clauses.push({ label: 'Payment schedule', plainLanguage: 'Shows when deposits, installments, or final balance are expected.' });
  if (/cancel|refund|non-refundable/.test(lower)) clauses.push({ label: 'Cancellation / refund', plainLanguage: 'Explains what happens if the event is cancelled or changed.' });
  if (/overtime|extra hour|additional hour/.test(lower)) clauses.push({ label: 'Extra time / overtime', plainLanguage: 'Explains costs or approval needed for extra event time.' });
  if (/damage|security deposit/.test(lower)) clauses.push({ label: 'Damage / security deposit', plainLanguage: 'Explains deposit, damage, or post-event charge policies.' });
  if (/alcohol|bar/.test(lower)) clauses.push({ label: 'Bar / alcohol', plainLanguage: 'Explains venue requirements for alcohol service and bar packages.' });
  return clauses;
}

export function safeContract(row: ReturnType<typeof contractsRepo.listForEvent>[number]) {
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

export function safePayment(row: ReturnType<typeof paymentLinksRepo.listForEvent>[number]) {
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

export function designSummary(preferences: Record<string, any>) {
  const filled = Object.entries(preferences).filter(([, value]) => String(value ?? '').trim()).map(([key, value]) => `${key}: ${String(value).slice(0, 120)}`);
  if (filled.length === 0) return 'No design preferences submitted yet. Start with ceremony style, rain plan, colors, menu/bar notes, music, traditions, and VIP/photo details.';
  return [
    'Couple design board summary grounded in submitted venue planning fields:',
    ...filled.slice(0, 8).map((item) => `• ${item.replace(/([A-Z])/g, ' $1').toLowerCase()}`),
  ].join('\n');
}

export function safeVendor(row: ReturnType<typeof vendorsRepo.listForOrg>[number]) {
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

export function safeGuest(row: ReturnType<typeof guestsRepo.listForEvent>[number]) {
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

export function parseCsvLine(line: string): string[] {
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

export function safeRequest(row: ReturnType<typeof coupleRequestsRepo.listForEvent>[number]) {
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


export function couplePostEventSummary(input: {
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

export function addYears(date: string, years: number) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}


export function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function enrichPostEventRequest(request: ReturnType<typeof safeRequest>) {
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

export function coupleReminderItems(input: {
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



export function defaultAdvancedPlanning() {
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

export function advancedPlanningProgress(plan: Record<string, any>) {
  const keys = Object.keys(defaultAdvancedPlanning());
  const complete = keys.filter((key) => JSON.stringify(plan[key] ?? {}) !== JSON.stringify((defaultAdvancedPlanning() as any)[key] ?? {})).length;
  return { completeCount: complete, total: keys.length, percent: keys.length ? Math.round((complete / keys.length) * 100) : 0 };
}

export function normalizedAdvancedSections(eventId: string) {
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

export function upsertAdvancedSection(table: string, event: NonNullable<ReturnType<typeof eventsRepo.findById>>, payload: unknown, userId: string, privacyScope?: string) {
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

export function upsertNormalizedAdvancedSections(event: NonNullable<ReturnType<typeof eventsRepo.findById>>, data: Record<string, unknown>, userId: string) {
  if ('ceremony' in data) upsertAdvancedSection('couple_ceremony_plans', event, data.ceremony, userId);
  if ('weddingParty' in data) upsertAdvancedSection('couple_wedding_party_plans', event, data.weddingParty, userId);
  if ('vipNotes' in data) upsertAdvancedSection('couple_vip_notes_plans', event, data.vipNotes, userId, String((data.vipNotes as any)?.privacy || 'venue_planner_only'));
  if ('transportation' in data) upsertAdvancedSection('couple_transportation_plans', event, data.transportation, userId);
  if ('memoryBook' in data) upsertAdvancedSection('couple_memory_book_plans', event, data.memoryBook, userId);
}

export function coupleAdvancedPlanningSummary(event: NonNullable<ReturnType<typeof eventsRepo.findById>>, userId: string) {
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

export function connectedIntegrationId(organizationId: string, provider: string) {
  const row = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = ? AND status = 'connected' LIMIT 1`).get(organizationId, provider) as { id: string } | undefined;
  return row?.id ?? null;
}

export function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}


/**
 * MODULE-07 CP-01: couple-owned data may be written by (a) the couple member
 * themselves (event-scoped 'couple' role) or (b) venue roles with events.edit
 * (planner/manager/owner/admin) acting in a support capacity. View-only roles
 * (staff) can READ couple data via events.view but must not edit it.
 */
export function canWriteCoupleData(
  memberships: ReadonlyArray<Membership & { roleKey?: string }>,
  eventId: string,
  orgMap: Record<string, string>,
): boolean {
  if (memberships.some((m) => m.eventId === eventId && String(m.roleKey ?? '').toLowerCase() === 'couple')) return true;
  return can(memberships, { eventId }, 'events.edit', orgMap);
}
