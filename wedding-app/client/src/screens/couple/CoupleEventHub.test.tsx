import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';
import { CoupleEventHub } from './CoupleEventHub';
import { sdk } from '../../sdk';

vi.mock('../../sdk/venues', () => ({
  venuesSdk: { eventTemplates: vi.fn().mockResolvedValue({ templates: [], spaces: [], guestCount: 100 }), applyEventTemplate: vi.fn() },
}));

vi.mock('../../sdk', () => ({
  sdk: {
    questions: { listForEvent: vi.fn().mockResolvedValue({ questions: [] }), listAnswers: vi.fn().mockResolvedValue({ answers: [] }), listQuestionAnswers: vi.fn().mockResolvedValue({ answers: [] }), upsertAnswer: vi.fn().mockResolvedValue({ answer: {} }) },
    events: { dayOfContact: vi.fn().mockResolvedValue({ contact: { name: 'Avery', phone: '555-0100', hours: '8 AM–11 PM' } }), coupleUpdates: vi.fn().mockResolvedValue({ updates: [] }), acknowledgeCoupleUpdate: vi.fn().mockResolvedValue({ ok: true }), viewCoupleUpdate: vi.fn().mockResolvedValue({ ok: true }), get: vi.fn().mockResolvedValue({ event: { id: 'e1', organization_id: 'org1', organizationName: 'Willow Creek Estate', supportEmail: 'help@venue.test', title: 'Taylor & Morgan Wedding', start_date: '2026-09-12', guest_count: 100, metadata: JSON.stringify({ ceremonySpace: 'Garden Lawn', receptionSpace: 'Grand Ballroom', ceremonyTime: '4:30 PM', venueContactName: 'Avery Coordinator' }) } }) },
    orgs: { get: vi.fn().mockResolvedValue({ organization: { id: 'org1', name: 'Willow Creek Estate', settings: JSON.stringify({ supportEmail: 'help@venue.test' }) } }) },
    guests: { list: vi.fn().mockResolvedValue({ guests: [{ id: 'g1', full_name: 'Guest One', email: 'guest@example.com', metadata: '{}' }], counts: { pending: 20, attending: 70, declined: 5, maybe: 5 } }) },
    contracts: { list: vi.fn().mockResolvedValue({ contracts: [{ id: 'c1', status: 'sent' }] }) },
    budget: { list: vi.fn().mockResolvedValue({ items: [], totals: { planned: 1000000, paid: 250000, actual: 1000000 } }) },
    timeline: { list: vi.fn().mockResolvedValue({ items: [{ id: 't1' }, { id: 't2' }] }), coupleSchedule: vi.fn().mockResolvedValue({ schedule: [{ title: 'Ceremony', category: 'ceremony', starts_at: '2026-09-12T16:30:00', ends_at: null, location: 'Garden Lawn' }] }) },
    layouts: { list: vi.fn().mockResolvedValue({ layouts: [{ id: 'l1', approval_status: 'draft' }] }) },
    couple: { advancedPlanning: vi.fn().mockResolvedValue({ plan: {}, progress: { completeCount: 2, total: 16, percent: 13 }, aiConcierge: { mode: 'venue_approved_answers_with_escalation', answers: [{ question: 'What should we prioritize next?', answer: 'Guest care and ceremony details.', approvedByVenue: true }], escalations: [] }, venueLinks: { spaces: [{ id: 'space1', name: 'Garden Lawn' }], inventory: [{ id: 'inv1', name: 'Ivory Linen', category: 'linen', availableCount: 40 }], visibleAddOns: [{ id: 'addon1', name: 'Late-night snack', estimatedCents: 50000 }] }, modules: [{ key: 'visionBoard', label: 'Wedding vision board', priority: 'P2', tiedTo: ['venue spaces', 'venue inventory'] }, { key: 'rainPlan', label: 'Rain-plan decision workflow', priority: 'P2', tiedTo: ['deadline'] }, { key: 'memoryBook', label: 'Memory book/gallery experience', priority: 'P3', tiedTo: ['post-event gallery'] }], exports: [{ label: 'Personalized guest travel microsite packet', href: '/api/events/e1/couple-advanced-planning/travel-microsite.txt' }] }), saveAdvancedPlanning: vi.fn().mockResolvedValue({}), escalateAdvancedPlanning: vi.fn().mockResolvedValue({ request: {} }), reminders: vi.fn().mockResolvedValue({ reminders: [{ key: 'rsvp', title: 'RSVP deadline reminder', body: 'Guests have not responded yet.', dueAt: '2026-08-01', priority: 'medium', channel: 'in_app', recipientRole: 'couple' }], history: [], language: 'couple-friendly', avoidsInternalLanguage: true }), sendReminderDigest: vi.fn().mockResolvedValue({ digest: 'Digest', sent: true, historyId: 'h1' }), privacy: vi.fn().mockResolvedValue({ scope: { eventId: 'e1', eventTitle: 'Taylor & Morgan Wedding', access: 'event_scoped_couple_access_only' }, policyPack: { allowed: ['Private wedding hub'], blocked: ['Venue administration'] }, fieldFiltering: { vendors: ['No COI'], finance: ['No margins'] }, exports: [{ label: 'Guest CSV', href: '/export.csv' }], secureGuestLinks: 'Tokenized per guest', collaboratorControls: [] }), postEvent: vi.fn().mockResolvedValue({ event: { id: 'e1', title: 'Taylor & Morgan Wedding', weddingDate: '2026-09-12', daysSinceWedding: 0 }, closeoutItems: [{ key: 'feedback', label: 'Feedback + NPS survey', status: 'not_started', detail: 'Share feedback.' }, { key: 'review', label: 'Review/testimonial', status: 'available', detail: 'Optional review.' }], finalInvoice: { status: 'open_or_processing', openBalanceCents: 1000000, payments: [] }, damageDeposit: { status: 'pending_venue_closeout', amountCents: 0, note: 'Venue will confirm.' }, survey: null, nps: { score: null, label: 'not_submitted' }, debriefQuestions: ['What went well?', 'What could improve?'], reviewWorkflow: { status: 'ready', platformLinks: {}, consentRequired: true, existingReview: null }, photoSharing: { links: [{ label: 'Photo gallery', url: 'https://example.com/gallery' }], galleryDocuments: [], uploadCategory: 'post_event_gallery' }, thankYouMessage: 'Thank you for celebrating with us.', anniversaryNurture: { optedIn: false, nextTouchDate: '2027-09-12', note: 'Optional anniversary follow-up.' }, requests: [], finalPacketUrl: '/api/events/e1/couple-post-event/final-packet.txt', hiddenInternalFields: ['Incident reports'] }), submitPostEventSurvey: vi.fn().mockResolvedValue({ summary: {}, request: {} }), reportLostItem: vi.fn().mockResolvedValue({ request: {} }), submitReviewWorkflow: vi.fn().mockResolvedValue({ request: {}, review: {} }), calendar: vi.fn().mockResolvedValue({ appointments: [{ id: 'a1', appointmentType: 'tasting', title: 'Menu Tasting', status: 'requested', startsAt: null, endsAt: null, location: null, note: null, preparation: ['Share allergies'], reminders: [], availabilityWindow: 'Weekdays', providerSync: {}, signoff: {}, updatedAt: '2026-01-01' }], calendarItems: [{ source: 'deadline', id: 'task1', title: 'Final count', startsAt: '2026-08-01', endsAt: null, status: 'not_started', type: 'guest_list' }], availabilityWindows: { tasting: 'Weekdays 1-4 PM' }, providerSync: { status: 'not_connected', note: 'Provider sync placeholder' } }), requestAppointment: vi.fn().mockResolvedValue({ appointment: {} }), updateAppointment: vi.fn().mockResolvedValue({ appointment: {} }), signoffAppointment: vi.fn().mockResolvedValue({ appointment: {} }), inbox: vi.fn().mockResolvedValue({ threads: [{ type: 'venue', label: 'Venue Q&A', expectedResponse: '1 business day', threadId: 'e1:couple-venue', unread: 0, messages: [] }], decisions: [], venueContact: { name: 'Avery Coordinator', email: 'help@venue.test', expectedResponse: '1 business day' }, templates: [{ id: 'payment', label: 'Payment question', body: 'Can you explain payment?' }], notificationSummary: { newVenueMessages: 0, dueTasks: 2 }, aiDraft: 'Draft answer: Based on venue policy.' }), sendInboxMessage: vi.fn().mockResolvedValue({ message: {} }), createDecision: vi.fn().mockResolvedValue({ decision: {} }), notificationPreferences: vi.fn().mockResolvedValue({ preferences: { digest_frequency: 'daily' } }), updateNotificationPreferences: vi.fn().mockResolvedValue({ preferences: { digest_frequency: 'instant' } }), documents: vi.fn().mockResolvedValue({ documents: [{ id: 'd1', filename: 'menu.pdf', url: '/uploads/menu.pdf', mimeType: 'application/pdf', category: 'menu', visibility: 'couple_venue', approvalStatus: 'pending', version: 1, notes: 'Menu', extractedSummary: 'Possible menu/tasting document', history: [], reviewedBy: null, reviewedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }], counts: { menu: 1 }, reviewQueue: [], postEventGallery: [], allowedTypes: ['application/pdf'], maxBytes: 8388608, categories: ['menu', 'contract'], visibilityOptions: ['couple_venue', 'planner'] }), uploadDocument: vi.fn().mockResolvedValue({ document: {} }), updateDocument: vi.fn().mockResolvedValue({ document: {} }), uploadDocumentVersion: vi.fn().mockResolvedValue({ document: {} }), deleteDocument: vi.fn().mockResolvedValue({}), design: vi.fn().mockResolvedValue({ preferences: { ceremonyStyle: 'Garden ceremony', colors: 'Ivory and green' }, progress: { completeCount: 2, total: 18, percent: 11 }, review: { status: 'draft', requestId: null, updatedAt: null, updatedBy: null }, moodBoard: ['https://example.com/board'], aiSummary: 'Couple design board summary grounded in submitted venue planning fields:', venueTemplateHints: ['Ceremony style'] }), saveDesign: vi.fn().mockResolvedValue({ preferences: {}, progress: { percent: 20 }, reviewStatus: 'draft', aiSummary: 'Saved' }), submitDesignReview: vi.fn().mockResolvedValue({ request: {} }), finance: vi.fn().mockResolvedValue({ contracts: [{ id: 'c1', title: 'Venue Agreement', status: 'sent', recipientName: 'Taylor', amountCents: 1000000, sentAt: '2026-01-01', signedAt: null, signedCertificate: null, nextStep: 'Review and sign when ready.', clauseExplainers: [{ label: 'Payment schedule', plainLanguage: 'Shows due dates.' }] }], payments: [{ id: 'p1', amountCents: 250000, status: 'pending', dueDate: '2026-08-01', paidAt: null, paymentUrl: null, label: 'Deposit', receiptUrl: null, explanation: 'Payment is pending.' }], totals: { contractedCents: 1000000, scheduledPaymentCents: 250000, paidCents: 0, pendingCents: 250000, openBalanceCents: 1000000 }, refundCancellationPolicy: 'See venue agreement.', paymentScheduleExplanation: 'Client-safe schedule.', hiddenFields: ['Internal venue budget'], changeOrders: [], questions: [], paymentMethodVault: { status: 'not_configured', note: 'Vaulting unavailable.' } }), askFinanceQuestion: vi.fn().mockResolvedValue({ request: {} }), requestChangeOrder: vi.fn().mockResolvedValue({ request: {} }), signContract: vi.fn().mockResolvedValue({ contract: {} }), listRequests: vi.fn().mockResolvedValue({ requests: [], canReview: false }), createRequest: vi.fn().mockResolvedValue({ request: {} }), getProfile: vi.fn().mockResolvedValue({ profile: { coupleNames: 'Taylor and Morgan', primaryPhone: '555-0100' }, lastUpdatedAt: '2026-01-01', lastUpdatedBy: 'couple@example.com' }), updateProfile: vi.fn().mockResolvedValue({ profile: {}, lastUpdatedAt: '2026-01-02', lastUpdatedBy: 'couple@example.com' }), guests: vi.fn().mockResolvedValue({ guests: [{ id: 'g1', fullName: 'Guest One', email: 'guest@example.com', phone: null, householdName: 'Guest Family', mailingAddress: '1 Main St', rsvpStatus: 'attending', mealChoice: 'Chicken', tags: ['family'], tableAssignment: '1', seatAssignment: 'A', roomAssignment: null, dietaryRestrictions: null, accessibilityNotes: null, notes: '', partyName: 'Guest Family', plusOneAllowed: false, allowPortalAccess: true, allowLodgingAccess: false }], counts: { pending: 20, attending: 70, declined: 5, maybe: 5 }, households: [{ name: 'Guest Family', members: [], count: 1 }], filters: { missingAddress: 0, missingEmail: 0, notInvitedYet: 0, notResponded: 20, needsFollowUp: 20 }, duplicateSuggestions: [], privacy: {} }), createGuest: vi.fn().mockResolvedValue({ guest: {} }), updateGuest: vi.fn().mockResolvedValue({ guest: {} }), importPreview: vi.fn().mockResolvedValue({ rowCount: 1, headers: ['fullname'], warnings: [], duplicateSignals: [], householdSuggestions: [], willSave: false }), importGuests: vi.fn().mockResolvedValue({ imported: 3, skipped: 1, warnings: [], duplicateSignals: [] }), guestPortal: vi.fn().mockResolvedValue({ portal: { enabled: false, publicUrl: '#/portal/e1', couplePlanningPortalUrl: '#/couple/events/e1', rsvpDeadline: '2026-08-01', editWindowDays: 7, access: null, config: {} }, approvalStatus: 'not_requested', reminderStatus: 'not_requested', guestsWillSee: ['Welcome message', 'RSVP questions'], guestsWillNotSee: ['Payment details', 'Staff assignments'], mobileQa: ['Open on iPhone', 'Submit test RSVP'], qrPayload: 'WVI-RSVP:e1' }), requestGuestPortalUpdate: vi.fn().mockResolvedValue({ request: {} }), requestRsvpReminder: vi.fn().mockResolvedValue({ request: {} }), generateGuestPortalLink: vi.fn().mockResolvedValue({ url: '#/portal/e1?guest=g1&token=t', token: 't', qrPayload: 'qr' }), timeline: vi.fn().mockResolvedValue({ items: [{ id: 'ct1', title: 'Ceremony', category: 'ceremony', startsAt: '2026-09-12T16:30:00', endsAt: '2026-09-12T17:00:00', durationMin: 30, location: 'Garden Lawn', notes: null }], hiddenInternalCount: 2, subEvents: [{ id: 'se1', title: 'Ceremony Rehearsal', startsAt: '2026-09-11T17:00:00', endsAt: null, inviteOnly: true }], rehearsal: null, approval: { status: 'not_requested', note: null, updatedAt: null }, changeRequests: [], versionHistory: [{ at: '2026-01-01', summary: 'Venue timeline shared for couple review.' }], education: ['Sunset photos: confirm photo timing.'] }), requestTimelineChange: vi.fn().mockResolvedValue({ request: {} }), setTimelineApproval: vi.fn().mockResolvedValue({ approval: { status: 'approved' } }), vendors: vi.fn().mockResolvedValue({ vendors: [{ id: 'v1', name: 'DJ Co', category: 'Music', contactPreference: 'venue-coordinated', publicContactName: 'DJ Sam', publicEmail: null, publicPhone: null, websiteUrl: null, isPreferred: true, bookedStatus: 'booked', confirmedStatus: 'confirmed', arrival: null, notesForCouple: 'Music confirmed.', visibleDocuments: [{ title: 'Ceremony music notes', type: 'ceremony_music', url: null }] }], planner: { name: 'Pat Planner', email: 'pat@example.com', phone: null, status: 'connected' }, requests: [], recommendationsEnabled: true, visibleDocumentTypes: ['menu'], hiddenFields: ['COI / insurance files', 'vendor no-show risk'], comparison: [{ id: 'v1', name: 'DJ Co', category: 'Music', status: 'confirmed', documents: 1 }] }), requestVendor: vi.fn().mockResolvedValue({ request: {} }), askVendorQuestion: vi.fn().mockResolvedValue({ request: {} }), requestPlannerCollaboration: vi.fn().mockResolvedValue({ request: {} }), layout: vi.fn().mockResolvedValue({ layout: { id: 'l1', name: 'Reception Layout', approvalStatus: 'pending', revision: 2, updatedAt: '2026-01-01' }, summary: { tables: 10, seats: 100, assignedSeats: 80, unseatedGuests: 20, duplicateSeatAssignments: 0, vendorZones: 2, exits: 2, adaRoutes: 1 }, visibleItems: { tables: [], seats: [], danceFloor: [{ id: 'df' }], ceremonySeating: [], bars: [], buffet: [], restrooms: [], entrances: [], adaRoutes: [], photoBooth: [], djBand: [], sweetheartHeadTable: [] }, seating: { unseatedGuests: [{ id: 'g2', fullName: 'Unseated Guest' }], duplicateSeatAssignments: [], tableAssignments: [{ guestId: 'g1', fullName: 'Guest One', tableAssignment: '1', seatAssignment: 'A', tags: ['family'] }] }, comments: [], approval: { status: 'not_requested', note: null, updatedAt: null }, versionHistory: [{ revision: 2, createdAt: '2026-01-01', summary: 'Moved dance floor' }], guidance: ['Seat VIP/family guests where they have clear access.'], walkthrough3d: { status: 'concept', note: '3D walkthrough placeholder' } }), addLayoutComment: vi.fn().mockResolvedValue({ request: {} }), setLayoutApproval: vi.fn().mockResolvedValue({ approval: { status: 'approved' } }), updateSeating: vi.fn().mockResolvedValue({ guest: {} }), planning: vi.fn().mockResolvedValue({ template: { packageKey: 'standard', cultureKey: 'default', source: 'venue-controlled-default-deadline-template' }, tasks: [{ id: 'task1', eventId: 'e1', templateKey: 'guest-list-started', title: 'Start guest list', description: 'Add guests', owner: 'couple', dueDate: '2026-06-01', status: 'in_progress', approvalStatus: 'not_required', decisionCategory: 'guest_list', attachments: [], history: [], isOverdue: false, isUpcoming: true, updatedAt: '2026-01-01' }] }), updatePlanningTask: vi.fn().mockResolvedValue({ task: {} }), askPlanningTaskQuestion: vi.fn().mockResolvedValue({ request: {} }) },
  },
}));

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}><ToastProvider>{children}</ToastProvider></QueryClientProvider>;
}

describe('CoupleEventHub', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders production couple dashboard sections without internal operations language', async () => {
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    expect(await screen.findByText('Taylor & Morgan Wedding')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Willow Creek Estate')).toBeInTheDocument());
    expect(screen.getAllByText(/Garden Lawn/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Grand Ballroom/).length).toBeGreaterThan(0);
    expect(screen.getByText('Couple-safe event overview')).toBeInTheDocument();
    expect(screen.getByText('Wedding profile completeness')).toBeInTheDocument();
    expect(screen.getByText('AI-style planning assistant')).toBeInTheDocument();
    expect(screen.getByText('Couple Guest List Center')).toBeInTheDocument();
    expect(screen.getByText('Household manager')).toBeInTheDocument();
    expect(screen.getByText('Guest import concierge')).toBeInTheDocument();
    expect(screen.getByText('Mobile & accessibility tools')).toBeInTheDocument();
    expect(await screen.findByText('Couple Reminder Center')).toBeInTheDocument();
    expect(screen.getByText('Couple Data Privacy Center')).toBeInTheDocument();
    expect(await screen.findByText('Couple Post-Event Closeout')).toBeInTheDocument();
    expect(await screen.findByText('Post-event final packet')).toBeInTheDocument();
    expect(await screen.findByText('Best-in-class couple planning suite')).toBeInTheDocument();
    expect(screen.getByText('Couple AI planning concierge')).toBeInTheDocument();
    expect(screen.getByText('Wedding vision board')).toBeInTheDocument();
    expect(screen.getByText('Couple Calendar & Appointments')).toBeInTheDocument();
    expect(screen.getByText('Couple Inbox & Venue Q&A Center')).toBeInTheDocument();
    expect(screen.getByText('Couple Document Hub')).toBeInTheDocument();
    expect(screen.getByText('Couple Design & Preferences')).toBeInTheDocument();
    expect(screen.getByText('Couple Contract & Payments Center')).toBeInTheDocument();
    expect(screen.getByText('Client-safe Vendor Team')).toBeInTheDocument();
    expect(screen.getAllByText('DJ Co').length).toBeGreaterThan(0);
    expect(screen.getByText('Couple Floorplan Review')).toBeInTheDocument();
    expect(screen.getByText('Couple Timeline Review')).toBeInTheDocument();
    expect(screen.getByText('Couple Guest Portal QA / Preview Center')).toBeInTheDocument();
    expect(screen.getByText('Guest RSVP portal')).toBeInTheDocument();
    expect(screen.getByText('Couple Planning Checklist')).toBeInTheDocument();
    expect(screen.getByText('Decision tracker')).toBeInTheDocument();
    expect(screen.getByText('Planning milestone checklist')).toBeInTheDocument();
    expect(screen.getByText('What the venue is working on')).toBeInTheDocument();
    expect(screen.getByText('Needs your attention')).toBeInTheDocument();
    expect(screen.getByText(/contracts and payment summaries unlock/i)).toBeInTheDocument();
    expect(screen.queryByText(/staff workload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/audit logs/i)).not.toBeNull(); // appears only in access boundary copy, not as a module
  });

  // MODULE-07 CP-05: couples can remove their own documents.
  it('uploads a real chosen file (not only the sample)', async () => {
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await waitFor(() => {
      expect(screen.getByText('menu.pdf')).toBeTruthy();
    });
    const file = new File(['%PDF-1.4 test'], 'contract.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/choose a document file/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect((screen.getByPlaceholderText('Filename') as HTMLInputElement).value).toBe('contract.pdf');
    });
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/ }));
    await waitFor(() => {
      const call = (sdk.couple.uploadDocument as any).mock.calls[0];
      expect(call[1].filename).toBe('contract.pdf');
      expect(call[1].dataUri.startsWith('data:application/pdf;base64,')).toBe(true);
    });
  });

  // MODULE-07 CP-05: couples can remove their own documents.
  it('removes a document via the delete button', async () => {
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await waitFor(() => {
      expect(screen.getByText('menu.pdf')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete document menu\.pdf/i }));
    await waitFor(() => {
      expect(sdk.couple.deleteDocument).toHaveBeenCalledWith('e1', 'd1');
    });
  });

  // Honest section states: a failed section query must not masquerade as
  // "no data" — surface it and allow retry.
  it('shows a retry banner when a section query fails instead of pretending it is empty', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.couple.guests as any).mockRejectedValueOnce(new Error('network down'));
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/couldn.t load/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/guest list/).length).toBeGreaterThanOrEqual(1);

    const callsBefore = (sdk.couple.guests as any).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /retry sections/i }));
    await waitFor(() => {
      expect((sdk.couple.guests as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });
    // Retry succeeds → banner clears.
    await waitFor(() => {
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });
  });

  it('shows an inline per-section error (not a false empty state) when the documents query fails', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.couple.documents as any).mockRejectedValueOnce(new Error('network down'));
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await waitFor(() => {
      expect(screen.getByText(/Documents couldn.t load/i)).toBeTruthy();
    });
    // The false empty state must NOT appear next to the inline error.
    expect(screen.queryByText('No documents yet')).toBeNull();
    // Inline retry re-runs the query.
    const callsBefore = (sdk.couple.documents as any).mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await waitFor(() => {
      expect((sdk.couple.documents as any).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('shows an inline error on the RSVP progress card instead of a misleading 0%', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.couple.guests as any).mockRejectedValueOnce(new Error('network down'));
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await waitFor(() => {
      expect(screen.getByText(/RSVP progress couldn.t load/i)).toBeTruthy();
    });
    // No misleading "0 of — guests responded" figure while the data is unknown,
    // and the readiness card shows "—" instead of a fabricated 0%.
    expect(screen.queryByText(/0 of — guests responded/)).toBeNull();
    expect(screen.queryByText(/guests responded/)).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('guest import concierge: preview then import saves the guest list', async () => {
    const sdkCouple = (await import('../../sdk')).sdk.couple as unknown as Record<string, ReturnType<typeof vi.fn>>;
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    expect(await screen.findByText('Guest import concierge')).toBeInTheDocument();

    // No import button until a preview exists.
    expect(screen.queryByRole('button', { name: /import 1 guest/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));
    const importBtn = await screen.findByRole('button', { name: /import 1 guest/i });
    expect(importBtn).toBeInTheDocument();

    fireEvent.click(importBtn);
    await waitFor(() => expect(sdkCouple.importGuests).toHaveBeenCalledWith('e1', expect.stringContaining('fullName')));
    // Success toast confirms the import.
    expect(await screen.findByText('3 guests imported')).toBeInTheDocument();
  });

  it('guest import concierge: failed import surfaces an error toast, not a crash', async () => {
    const sdkCouple = (await import('../../sdk')).sdk.couple as unknown as Record<string, ReturnType<typeof vi.fn>>;
    sdkCouple.importGuests.mockRejectedValueOnce(new Error('Import failed'));
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    expect(await screen.findByText('Guest import concierge')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }));
    const importBtn = await screen.findByRole('button', { name: /import 1 guest/i });
    fireEvent.click(importBtn);

    expect(await screen.findByText('Could not import guests')).toBeInTheDocument();
  });
});

describe('CoupleEventHub — update read-receipts, guest editing, document metadata editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // restore the default documents payload (other tests override it)
    (sdk.couple.documents as any).mockResolvedValue({
      documents: [{ id: 'd1', filename: 'menu.pdf', url: '/uploads/menu.pdf', mimeType: 'application/pdf', category: 'menu', visibility: 'couple_venue', approvalStatus: 'pending', version: 1, notes: 'Menu', extractedSummary: 'Possible menu/tasting document', history: [], reviewedBy: null, reviewedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      counts: { menu: 1 }, reviewQueue: [], postEventGallery: [], allowedTypes: ['application/pdf'], maxBytes: 8388608,
      categories: ['menu', 'contract'], visibilityOptions: ['couple_venue', 'planner'],
    });
  });

  it('marks every Event Week update as VIEWED once (regression: the venue "viewed X/Y" panel stayed 0 forever)', async () => {
    (sdk.events.coupleUpdates as any).mockResolvedValue({
      updates: [
        { id: 'u1', title: 'Shuttle change', body: 'Pickup moved.', critical: false, acknowledged_at: null },
        { id: 'u2', title: 'Weather plan', body: 'Indoor backup.', critical: true, acknowledged_at: null },
      ],
    });
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await screen.findByText('Shuttle change');
    await waitFor(() => {
      expect(sdk.events.viewCoupleUpdate).toHaveBeenCalledWith('e1', 'u1');
      expect(sdk.events.viewCoupleUpdate).toHaveBeenCalledWith('e1', 'u2');
    });
  });

  it('edits a guest from the guest list (regression: typo fixes needed delete + re-add)', async () => {
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    const editBtn = await screen.findByRole('button', { name: /edit guest guest one/i });
    fireEvent.click(editBtn);
    const dialog = await screen.findByRole('dialog');
    const nameInput = dialog.querySelector('#prompt-fullName') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Guest One Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sdk.couple.updateGuest).toHaveBeenCalledWith(
        'e1',
        'g1',
        expect.objectContaining({ fullName: 'Guest One Renamed', rsvpStatus: 'attending' }),
      );
    });
  });

  it('shows ALL documents when a couple has more than 8 (regression: the 8-cap silently hid older documents forever)', async () => {
    const manyDocs = Array.from({ length: 11 }, (_, i) => ({
      id: `d${i}`, filename: `doc-${i}.pdf`, url: `/u${i}`, mimeType: 'application/pdf',
      category: 'menu' as const, visibility: 'couple_venue' as const, approvalStatus: 'pending' as const,
      version: 1, notes: '', history: [],
    }));
    (sdk.couple.documents as any).mockResolvedValue({
      documents: manyDocs, counts: {}, reviewQueue: [], postEventGallery: [],
      allowedTypes: [], maxBytes: 0, categories: ['menu'], visibilityOptions: ['couple_venue'],
    });
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await screen.findByText('doc-0.pdf');
    // only the first 8 are listed, plus a Show-all affordance
    expect(screen.queryByText('doc-10.pdf')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show all 11 documents/i }));
    expect(screen.getByText('doc-10.pdf')).toBeInTheDocument();
  });

  it('shows ALL timeline items when a couple has more than 10 (regression: the 10-cap silently hid older items forever)', async () => {
    const manyItems = Array.from({ length: 13 }, (_, i) => ({
      id: `ct${i}`, title: `Timeline item ${i}`, category: 'ceremony',
      startsAt: '2026-09-12T16:30:00', endsAt: null, durationMin: 30,
      location: 'Garden Lawn', notes: null,
    }));
    (sdk.couple.timeline as any).mockResolvedValue({
      items: manyItems, hiddenInternalCount: 0, subEvents: [], rehearsal: null,
      approval: { status: 'not_requested', note: null, updatedAt: null },
      changeRequests: [], versionHistory: [], education: [],
    });
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    await screen.findByText('Timeline item 0');
    // only the first 10 are listed, plus a Show-all affordance
    expect(screen.queryByText('Timeline item 12')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show all 13 timeline items/i }));
    expect(screen.getByText('Timeline item 12')).toBeInTheDocument();
  });

  it('edits document metadata via the shared form row (regression: category/visibility were set once and never fixable)', async () => {
    render(<CoupleEventHub eventId="e1" />, { wrapper: wrapper() });
    const editDetails = await screen.findByRole('button', { name: /edit details of menu\.pdf/i });
    fireEvent.click(editDetails);
    const category = await screen.findByLabelText('Document category');
    fireEvent.change(category, { target: { value: 'contract' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(sdk.couple.updateDocument).toHaveBeenCalledWith(
        'e1',
        'd1',
        expect.objectContaining({ category: 'contract' }),
      );
    });
  });
});
