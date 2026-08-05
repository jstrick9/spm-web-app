import { auditRepo, coupleDocumentsRepo, eventsRepo, guestsRepo, jobsRepo, layoutsRepo, orgsRepo, portalConfigRepo, rsvpRepo, subEventsRepo, timelineRepo } from '../../db/repos/index.js';
import { appPublicBaseUrl } from '../../lib/appBaseUrl.js';
import { db } from '../../db/database.js';
import { hashPassword, verifyPassword, uuid } from '../../lib/crypto.js';
import { can } from '../../lib/rbac.js';
import { broadcastSSE } from '../sse.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { privateFilePath } from '../../lib/fileStorage.js';
import { createReadStream, existsSync } from 'node:fs';
import { assertNoPublicHoneypot, auditPublicSubmission, publicRequestFingerprint } from '../../lib/publicAbuse.js';
import type { FastifyInstance } from 'fastify';
import { rsvpSchema, guestLookupSchema, guestHelpSchema, guestQuestionSchema, guestAccessibilityRequestSchema, guestPrivacyRequestSchema, guestReminderPreferencesSchema, guestDayOfHelpSchema, guestMemorySubmissionSchema, guestPostEventFeedbackSchema, guestResendSchema, guestMetadata, guestHouseholdKey, publicGuest, publicGuestDirectory, normalizeGuestPostEvent, normalizeGuestDayOf, normalizeGuestReminders, normalizeGuestPrivacy, normalizeGuestCare, normalizeGuestGifts, normalizeGuestFaq, normalizeWayfindingLabels, safeGuestLayoutPayload, verifyGuestPortalToken, activeSmtpIntegrationId, activeSmsIntegrationId, addDaysIso, escapeHtml, isGuestTimelineItem, safeGuestTimelineItem, eventTimezone, guestCalendarIcs, safeGuestHelpRequest, safeGuestHelpReply } from './shared.js';

export async function guestPortalRoutes(app: FastifyInstance) {
  app.get('/api/portal/:eventId/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const org = orgsRepo.findById(event.organization_id);
    let brandingConfig: Record<string, any> = {};
    try {
      const settings = org ? (typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings) : {};
      const branding = org ? (typeof org.branding === 'string' ? JSON.parse(org.branding || '{}') : org.branding) : {};
      brandingConfig = settings?.platformConfig?.branding ?? branding ?? {};
    } catch {}
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const supportEmail = String(portalConfig.supportEmail || brandingConfig.supportEmail || org?.support_email || '');
    const supportPhone = String(portalConfig.supportPhone || brandingConfig.supportPhone || '');
    const enabled = cfg ? !!cfg.enabled : true;
    return {
      event: { id: event.id, title: event.title, startDate: event.start_date },
      status: enabled ? 'available' : 'disabled',
      support: { label: String(portalConfig.supportLabel || brandingConfig.platformName || org?.name || 'venue/couple team'), email: supportEmail, phone: supportPhone },
      message: enabled ? 'Guest portal is available.' : String(portalConfig.portalDisabledMessage || 'This guest portal is currently disabled by the venue/couple team.'),
      recovery: {
        requestNewLink: true,
        helpKinds: ['expired_or_revoked','cannot_find_name','wrong_guest','other'],
      },
    };
  });

  app.get('/api/portal/:eventId/info', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const cfg = portalConfigRepo.getForEvent(eventId) as { enabled: number; password_hash: string | null } | undefined;
    const requiresPassword = !!cfg?.password_hash;
    // Security: return 404 if portal is explicitly disabled
    if (cfg && !cfg.enabled) throw NotFound("portal-disabled");
    const q = req.query as { guest?: string; token?: string };
    const requestedGuest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenStatus = requestedGuest && requestedGuest.event_id === eventId ? verifyGuestPortalToken(requestedGuest, q.token) : q.guest ? 'invalid' as const : 'missing' as const;
    const tokenGuest = requestedGuest && requestedGuest.event_id === eventId && tokenStatus === 'valid' ? requestedGuest : null;
    const portalConfig = cfg ? (typeof (cfg as any).config === 'string' ? JSON.parse((cfg as any).config || '{}') : ((cfg as any).config || {})) : {};
    const genericDirectoryEnabled = portalConfig.allowGenericGuestDirectory === true;
    const householdKey = tokenGuest ? guestHouseholdKey(tokenGuest) : '';
    const allowHouseholdRsvp = portalConfig.allowHouseholdRsvp !== false;
    const householdGuests = tokenGuest && householdKey && allowHouseholdRsvp
      ? guestsRepo.listForEvent(eventId).filter((g) => g.allow_portal_access && guestHouseholdKey(g) === householdKey)
      : [];
    const guestList = tokenGuest
      ? (householdGuests.length ? householdGuests : [tokenGuest]).map((g) => publicGuest(g, true, !!householdKey && allowHouseholdRsvp))
      : genericDirectoryEnabled
        // Privacy: the directory shows names only (id + fullName + party
        // name). RSVP status, seating, lodging, and sub-event data are
        // personal and stay hidden until a valid invitation token is shown.
        ? guestsRepo.listForEvent(eventId).filter((g) => g.allow_portal_access).map((g) => publicGuestDirectory(g))
        : [];
    // Include org theme for portal styling
    const org = orgsRepo.findById(event.organization_id);
    let themeConfig = null;
    let brandingConfig: Record<string, unknown> = {};
    if (org) {
      try {
        const settings = typeof org.settings === "string" ? JSON.parse(org.settings) : org.settings;
        const branding = typeof org.branding === "string" ? JSON.parse(org.branding || '{}') : org.branding;
        themeConfig = settings?.platformConfig?.theme ?? null;
        brandingConfig = settings?.platformConfig?.branding ?? branding ?? {};
      } catch {}
    }
    // Include layout for the map viewer
    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layoutPayload = layouts.length > 0 ? (typeof layouts[0].payload === "string" ? JSON.parse(layouts[0].payload) : layouts[0].payload) : null;
    
    const { subEventsRepo, timelineRepo } = await import('../../db/repos/index.js');
    const subEvents = subEventsRepo.listForEvent(eventId).map((sub) => {
      const meta = (() => { try { return JSON.parse(sub.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
      const invited = tokenGuest ? (!sub.invite_only || !!db.prepare(`SELECT 1 FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(tokenGuest.id, sub.id)) : !sub.invite_only;
      const rsvpRow = tokenGuest ? db.prepare(`SELECT rsvp_status FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(tokenGuest.id, sub.id) as { rsvp_status: string } | undefined : undefined;
      return {
        ...sub,
        metadata: meta,
        eventType: meta.eventType || (sub.title.toLowerCase().includes('rehearsal') ? 'rehearsal_dinner' : sub.title.toLowerCase().includes('brunch') ? 'brunch' : sub.title.toLowerCase().includes('welcome') ? 'welcome_party' : sub.title.toLowerCase().includes('after') ? 'after_party' : 'sub_event'),
        location: meta.location || meta.venueName || meta.address || null,
        dressCode: meta.dressCode || null,
        host: meta.host || null,
        parking: meta.parking || null,
        dietaryFields: meta.dietaryFields || meta.dietary || null,
        lateArrivalInstructions: meta.lateArrivalInstructions || null,
        contactName: meta.contactName || null,
        contactEmail: meta.contactEmail || null,
        helpText: meta.helpText || null,
        itineraryStatus: invited ? 'invited' : 'not_on_your_itinerary',
        guestRsvpStatus: rsvpRow?.rsvp_status || null,
        calendarUrl: `/api/portal/${eventId}/sub-events/${sub.id}.ics${tokenGuest && q.token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(q.token)}` : ''}`,
      };
    });
    const rawTimeline = timelineRepo.listForEvent(eventId);
    const timeline = rawTimeline.filter(isGuestTimelineItem).map(safeGuestTimelineItem);

    const eventMetadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const eventType = String(eventMetadata.eventType || eventMetadata.guestEventType || (event.title.toLowerCase().includes('rehearsal') ? 'rehearsal_dinner' : 'wedding'));
    const locationSummary = eventMetadata.guestLocation || eventMetadata.venueAddress || eventMetadata.location || org?.name || 'Venue details pending';
    const changeNotices = Array.isArray(portalConfig.changeNotices) ? portalConfig.changeNotices : Array.isArray(eventMetadata.guestChangeNotices) ? eventMetadata.guestChangeNotices : [];
    const identityPayload = {
      mode: tokenGuest ? 'tokenized' : 'lookup_required',
      tokenStatus,
      selectedGuestId: tokenGuest?.id ?? null,
      guestDirectoryExposed: genericDirectoryEnabled,
      supportMessage: tokenStatus === 'invalid' ? 'This guest link could not be verified. Please request a new link.' : tokenStatus === 'revoked' ? 'This guest link is no longer active. Please contact the venue or couple for help.' : null,
    };
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.view', targetType: 'event', targetId: eventId, details: { mode: identityPayload.mode, tokenStatus, guestId: tokenGuest?.id || requestedGuest?.id || null, guestDirectoryExposed: genericDirectoryEnabled } });
    if (tokenStatus === 'invalid' || tokenStatus === 'revoked') {
      auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.token_failed', targetType: 'guest', targetId: requestedGuest?.id || eventId, details: { tokenStatus, eventId } });
    }

    return {
      event: {
        id: event.id, title: event.title,
        startDate: event.start_date, endDate: event.end_date,
        eventType,
        locationSummary,
        rsvpDeadline: event.rsvp_deadline || eventMetadata.rsvpDeadline || portalConfig.rsvpDeadline || null,
        lastUpdatedAt: (event as any).updated_at || event.created_at,
      },
      portalEnabled: !!cfg?.enabled,
      requiresPassword,
      guests: guestList,
      layout: safeGuestLayoutPayload(layoutPayload, tokenGuest, portalConfig),
      theme: themeConfig,
      branding: {
        platformName: typeof brandingConfig.platformName === 'string' && brandingConfig.platformName.trim()
          ? brandingConfig.platformName
          : org?.name ?? 'Wedding Venue Intelligence',
        logoUrl: typeof brandingConfig.logoUrl === 'string' ? brandingConfig.logoUrl : '',
        tagline: typeof brandingConfig.tagline === 'string' ? brandingConfig.tagline : '',
        supportEmail: typeof brandingConfig.supportEmail === 'string' ? brandingConfig.supportEmail : org?.support_email ?? '',
      },
      config: portalConfig,
      access: cfg ? {
        startsAt: (cfg as any).access_starts_at ?? null,
        endsAt: (cfg as any).access_ends_at ?? null,
        gracePeriodHours: (cfg as any).grace_period_hours ?? null,
      } : null,
      identity: identityPayload,
      guestExperience: {
        welcomeTitle: 'Welcome, guest',
        can: ['RSVP securely', 'Review schedule and invited events', 'Find travel, lodging, and venue details', 'View your seating details when shared', 'Ask for help if your invitation looks wrong'],
        cannot: ['Access couple planning tools', 'See venue staff operations', 'See contracts, payments, or private couple notes'],
      },
      guestHome: {
        eventType,
        locationSummary,
        primaryActions: ['RSVP', 'Schedule', 'Directions', 'Lodging', 'FAQ', 'Contact'],
        rsvpDeadline: event.rsvp_deadline || eventMetadata.rsvpDeadline || portalConfig.rsvpDeadline || null,
        editWindowDays: portalConfig.rsvpEditWindowDays ?? null,
        lastUpdatedAt: (event as any).updated_at || event.created_at,
        changeNotices: changeNotices.map((notice: any, index: number) => ({ id: String(notice.id || `notice-${index}`), title: String(notice.title || 'Guest information updated'), body: String(notice.body || notice.message || notice), category: String(notice.category || 'general'), updatedAt: String(notice.updatedAt || notice.date || (event as any).updated_at || event.created_at) })).slice(0, 8),
      },
      guestSchedule: {
        timezone: eventTimezone(eventMetadata),
        ceremonyArrivalTime: eventMetadata.ceremonyArrivalTime || portalConfig.ceremonyArrivalTime || null,
        ceremonyStartTime: eventMetadata.ceremonyTime || eventMetadata.ceremonyStartTime || portalConfig.ceremonyStartTime || null,
        receptionEndTime: eventMetadata.receptionEndTime || portalConfig.receptionEndTime || null,
        shuttleDepartureTime: eventMetadata.shuttleDepartureTime || portalConfig.shuttleDepartureTime || null,
        afterPartyTime: eventMetadata.afterPartyTime || portalConfig.afterPartyTime || null,
        calendarUrl: `/api/portal/${eventId}/calendar.ics${tokenGuest && q.token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(q.token)}` : ''}`,
        hiddenInternalCount: rawTimeline.length - timeline.length,
        changeAlerts: changeNotices.filter((notice: any) => ['schedule','timeline','ceremony','reception','shuttle','rain_plan'].includes(String(notice.category || '').toLowerCase())).slice(0, 5),
      },
      guestTravel: {
        venueAddress: portalConfig.venueAddress || eventMetadata.venueAddress || locationSummary,
        mapUrl: portalConfig.mapUrl || eventMetadata.mapUrl || '',
        parkingEntrance: portalConfig.parkingEntrance || eventMetadata.parkingEntrance || '',
        dropoffPoint: portalConfig.dropoffPoint || eventMetadata.dropoffPoint || '',
        rideshareInstructions: portalConfig.rideshareInstructions || eventMetadata.rideshareInstructions || '',
        shuttleSchedule: portalConfig.shuttleSchedule || eventMetadata.shuttleSchedule || portalConfig.transportationText || '',
        shuttlePickupLocation: portalConfig.shuttlePickupLocation || eventMetadata.shuttlePickupLocation || '',
        shuttleDropoffLocation: portalConfig.shuttleDropoffLocation || eventMetadata.shuttleDropoffLocation || '',
        lastShuttleReminder: portalConfig.lastShuttleReminder || eventMetadata.lastShuttleReminder || '',
        roomBlockDetails: portalConfig.roomBlockDetails || eventMetadata.roomBlockDetails || '',
        accessibleParking: portalConfig.accessibleParking || eventMetadata.accessibleParking || '',
        mobilityDropoff: portalConfig.mobilityDropoff || eventMetadata.mobilityDropoff || '',
        destinationTravelFaq: portalConfig.destinationTravelFaq || eventMetadata.destinationTravelFaq || '',
        weatherRainPlanNote: portalConfig.weatherRainPlanNote || eventMetadata.weatherRainPlanNote || '',
        offlineCardUrl: `/api/portal/${eventId}/travel-card.txt${tokenGuest && q.token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(q.token)}` : ''}`,
      },
      guestPostEvent: normalizeGuestPostEvent(portalConfig, eventMetadata, event, {
        galleryDocuments: coupleDocumentsRepo.listForEvent(eventId)
          .filter((d) => d.category === 'post_event_gallery' && d.visibility === 'guest_visible' && d.approval_status === 'approved')
          .map((d) => ({ id: d.id, filename: d.filename, mimeType: d.mime_type, url: `/api/portal/${eventId}/post-event-gallery/${d.id}`, notes: d.notes })),
      }),
      guestDayOf: normalizeGuestDayOf(portalConfig, eventMetadata, eventId, tokenGuest, q.token),
      guestReminders: normalizeGuestReminders(portalConfig, eventMetadata, event.organization_id, eventId, tokenGuest),
      guestPrivacy: normalizeGuestPrivacy(portalConfig, eventMetadata, identityPayload),
      guestCare: normalizeGuestCare(portalConfig, eventMetadata),
      guestGifts: normalizeGuestGifts(portalConfig, eventMetadata),
      guestFaq: normalizeGuestFaq(portalConfig, eventMetadata),
      guestWayfinding: {
        seatingPrivacyMode: portalConfig.seatingPrivacyMode === 'personal_only' || portalConfig.showOnlyPersonalSeat === true ? 'personal_only' : 'full_chart',
        labels: normalizeWayfindingLabels(portalConfig, eventMetadata),
        indoorMapNote: portalConfig.indoorRainPlanMapNote || eventMetadata.indoorRainPlanMapNote || '',
        outdoorMapNote: portalConfig.outdoorMapNote || eventMetadata.outdoorMapNote || '',
        accessibilityRouteDetails: portalConfig.accessibilityRouteDetails || eventMetadata.accessibilityRouteDetails || portalConfig.adaRouteLabel || '',
        arPreviewUrl: portalConfig.arPreviewUrl || eventMetadata.arPreviewUrl || '',
        arPreviewDescription: portalConfig.arPreviewDescription || eventMetadata.arPreviewDescription || '',
      },
      subEvents,
      timeline,
    };
  });

  // Guest-visible post-event gallery documents. The venue explicitly opts a
  // document in (category post_event_gallery + visibility guest_visible +
  // approved); only those are streamed, and only with nosniff headers so a
  // mislabeled file can never render as HTML in a guest browser.
  app.get('/api/portal/:eventId/post-event-gallery/:documentId', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId, documentId } = req.params as { eventId: string; documentId: string };
    const document = coupleDocumentsRepo.findById(documentId);
    if (!document || document.event_id !== eventId) throw NotFound('document-not-found');
    if (document.category !== 'post_event_gallery' || document.visibility !== 'guest_visible' || document.approval_status !== 'approved') throw NotFound('document-not-found');
    const path = privateFilePath(document.url);
    if (!path || !existsSync(path)) throw NotFound('document-file-not-found');
    reply.header('Content-Type', document.mime_type || 'application/octet-stream');
    reply.header('Content-Disposition', `inline; filename="${document.filename.replace(/[\"\\\r\n]/g, '_')}"`);
    return reply.send(createReadStream(path));
  });

  app.post('/api/portal/:eventId/lookup', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.lookup.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestLookupSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const query = parsed.data.query.trim().toLowerCase();
    const email = parsed.data.email?.trim().toLowerCase();
    const matches = guestsRepo.listForEvent(eventId)
      .filter((g) => g.allow_portal_access && (email ? g.email?.toLowerCase() === email : g.full_name.toLowerCase().includes(query)))
      .slice(0, 5)
      .map((g) => ({ id: g.id, label: g.full_name.replace(/(^\S+)\s+(.).*$/, '$1 $2.'), partyName: g.party_name || null, requiresSecureLink: true }));
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.lookup', targetType: 'event', targetId: eventId, details: { resultCount: matches.length, emailProvided: !!email } });
    if (matches.length === 0) auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.lookup_failed', targetType: 'event', targetId: eventId, details: { emailProvided: !!email, queryLength: query.length } });
    return { matches, privacy: 'For privacy, generic lookup only shows limited matches. Use your invitation link or request a secure link to RSVP.' };
  });

  app.post('/api/portal/:eventId/help-request', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.help_request.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestHelpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const id = uuid();
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const guestId = guest?.event_id === eventId ? guest.id : null;
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, created_ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.kind, parsed.data.name || null, parsed.data.email || null, parsed.data.message || null, req.ip, req.headers['user-agent'] || null);
    auditRepo.log({ organizationId: event.organization_id, action: 'portal.guest_help_request', targetType: 'guest_help_request', targetId: id, ip: req.ip, userAgent: req.headers['user-agent'], details: { kind: parsed.data.kind, name: parsed.data.name, email: parsed.data.email, guestId, message: parsed.data.message } });
    return reply.code(201).send({ ok: true, requestId: id, message: 'Your request was sent. The venue or couple can help confirm your invitation details.' });
  });

  app.post('/api/portal/:eventId/reminder-preferences', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.reminder_preferences.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestReminderPreferencesSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const guest = guestsRepo.findById(parsed.data.guestId);
    if (!guest || guest.event_id !== eventId) throw BadRequest('guest-not-in-event');
    if (verifyGuestPortalToken(guest, parsed.data.token) !== 'valid') throw new (await import('../../lib/errors.js')).HttpError(403, 'portal-token-invalid');
    const meta = guestMetadata(guest);
    const reminderPreferences = {
      ...(typeof meta.reminderPreferences === 'object' && meta.reminderPreferences ? meta.reminderPreferences : {}),
      emailOptIn: parsed.data.emailOptIn === true,
      smsOptIn: parsed.data.smsOptIn === true,
      confirmationPreference: parsed.data.confirmationPreference || 'email',
      reminderTypes: parsed.data.reminderTypes || [],
      quietHoursStart: parsed.data.quietHoursStart || '21:00',
      quietHoursEnd: parsed.data.quietHoursEnd || '08:00',
      language: parsed.data.language || 'en',
      updatedAt: new Date().toISOString(),
    };
    guestsRepo.update(guest.id, { metadata: { ...meta, reminderPreferences } });
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    let jobId: string | null = null;
    let dispatchStatus = 'preferences_saved';
    if (parsed.data.sendInfo) {
      const travel = {
        venueAddress: portalConfig.venueAddress || '',
        parkingEntrance: portalConfig.parkingEntrance || '',
        dropoffPoint: portalConfig.dropoffPoint || '',
        rideshareInstructions: portalConfig.rideshareInstructions || '',
        shuttleSchedule: portalConfig.shuttleSchedule || portalConfig.transportationText || '',
      };
      const scheduleText = `Helpful ${event.title} guest information\n\nSchedule: Check your guest portal for the latest ceremony, reception, and shuttle times.\n\nDirections: ${travel.venueAddress || 'Venue address pending'}\nParking: ${travel.parkingEntrance || 'Parking details pending'}\nDrop-off: ${travel.dropoffPoint || 'Drop-off details pending'}\nRideshare: ${travel.rideshareInstructions || 'Rideshare details pending'}\nShuttle: ${travel.shuttleSchedule || 'Shuttle details pending'}`;
      if ((reminderPreferences.confirmationPreference === 'email' || reminderPreferences.confirmationPreference === 'both') && reminderPreferences.emailOptIn && guest.email) {
        const smtpId = activeSmtpIntegrationId(event.organization_id);
        if (smtpId) { const job = jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: guest.email, subject: `${event.title} guest info`, text: scheduleText, html: `<p>${escapeHtml(scheduleText).replace(/\n/g, '<br/>')}</p>` } }); jobId = job.id; dispatchStatus = 'email_job_queued'; }
        else dispatchStatus = 'email_provider_not_connected';
      } else if ((reminderPreferences.confirmationPreference === 'sms' || reminderPreferences.confirmationPreference === 'both') && reminderPreferences.smsOptIn && guest.phone) {
        const smsId = activeSmsIntegrationId(event.organization_id);
        if (smsId) { const job = jobsRepo.enqueue({ kind: 'sms.send', organizationId: event.organization_id, payload: { integrationId: smsId, to: guest.phone, body: scheduleText.slice(0, 1000) } }); jobId = job.id; dispatchStatus = 'sms_job_queued'; }
        else dispatchStatus = 'sms_provider_not_connected';
      } else dispatchStatus = 'missing_opt_in_or_contact';
    }
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.reminder_preferences', targetType: 'guest', targetId: guest.id, details: { emailOptIn: reminderPreferences.emailOptIn, smsOptIn: reminderPreferences.smsOptIn, confirmationPreference: reminderPreferences.confirmationPreference, sendInfo: parsed.data.sendInfo || null, dispatchStatus, jobId } });
    return reply.send({ ok: true, preferences: reminderPreferences, message: parsed.data.sendInfo ? 'Reminder preferences saved and guest info delivery was requested.' : 'Reminder preferences saved.', dispatchStatus, jobId });
  });

  app.post('/api/portal/:eventId/privacy-request', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.privacy_request.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestPrivacyRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.privacyContactEmail || portalConfig.guestQuestionContactEmail || '').trim() || null;
    const message = [`Guest privacy/data request`, `Type: ${parsed.data.requestType}`, `Token status: ${tokenStatus}`, '', parsed.data.message].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(3), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.privacy_request', targetType: 'guest_help_request', targetId: id, details: { requestType: parsed.data.requestType, guestId, assignedTo: !!assignedTo, tokenStatus } });
    return reply.code(201).send({ ok: true, requestId: id, message: `Your privacy/data request was sent to the ${portalConfig.privacyContactLabel || 'venue/couple privacy contact'}.` });
  });

  app.post('/api/portal/:eventId/accessibility-request', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.accessibility_request.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestAccessibilityRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.accessibilityContactEmail || portalConfig.guestQuestionContactEmail || '').trim() || null;
    const sections = [
      ['Mobility', parsed.data.mobility],
      ['Seating', parsed.data.seating],
      ['Sensory', parsed.data.sensory],
      ['Interpretation / language', parsed.data.interpretationLanguage],
      ['Service animal', parsed.data.serviceAnimal],
      ['Dietary / allergy', parsed.data.dietaryAllergy],
      ['Caregiver', parsed.data.caregiver],
      ['Contact preference', parsed.data.contactPreference],
      ['Phone', parsed.data.phone],
      ['Additional notes', parsed.data.notes],
    ].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `${label}: ${value}`).join('\n');
    const message = ['Accessibility & care request', '', sections || 'Guest requested accessibility/care follow-up.'].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(1), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.accessibility_request', targetType: 'guest_help_request', targetId: id, details: { guestId, assignedTo: !!assignedTo, contactPreference: parsed.data.contactPreference } });
    return reply.code(201).send({ ok: true, requestId: id, message: `Your accessibility and care request was sent to the ${portalConfig.accessibilityContactLabel || 'venue accessibility contact'}.` });
  });

  app.post('/api/portal/:eventId/question', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.question.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestQuestionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    if (portalConfig.guestQuestionsEnabled === false) throw BadRequest('guest-questions-disabled');
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.guestQuestionContactEmail || '').trim() || null;
    const message = [`Guest question`, `Category: ${parsed.data.category}`, `Language: ${parsed.data.language || 'en'}`, '', parsed.data.question].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(2), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.guest_question', targetType: 'guest_help_request', targetId: id, details: { category: parsed.data.category, language: parsed.data.language || 'en', guestId, assignedTo: !!assignedTo } });
    return reply.code(201).send({ ok: true, requestId: id, message: `Your question was sent to the ${portalConfig.guestQuestionContactLabel || 'venue/couple team'}.` });
  });

  app.post('/api/portal/:eventId/resend-link', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.resend_link.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestResendSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const email = parsed.data.email.trim().toLowerCase();
    const guest = guestsRepo.listForEvent(eventId).find((g) => g.email?.toLowerCase() === email && (!parsed.data.name || g.full_name.toLowerCase().includes(parsed.data.name.toLowerCase().split(' ')[0])));
    let queued = false;
    // Only rotate the guest's portal token when a delivery job can actually be
    // enqueued — rotating without delivery would invalidate their existing
    // link and leave them with nothing (GU-04).
    const smtpId = activeSmtpIntegrationId(event.organization_id);
    if (guest && guest.allow_portal_access && smtpId) {
      const token = guestsRepo.rotatePortalToken(guest.id);
      const baseUrl = appPublicBaseUrl();
      const url = `${baseUrl}/#/portal/${eventId}?guest=${encodeURIComponent(guest.id)}&token=${encodeURIComponent(token)}`;
      jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: email, subject: `${event.title} RSVP link`, text: `Open your secure RSVP link: ${url}`, html: `<p>Open your secure RSVP link:</p><p><a href="${escapeHtml(url)}">RSVP for ${escapeHtml(event.title)}</a></p>` } });
      queued = true;
    }
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.resend_link', targetType: 'event', targetId: eventId, details: { matched: !!guest, queued, rotated: queued } });
    return reply.code(202).send({ ok: true, queued, message: 'If that email matches an invited guest, a secure RSVP link will be sent.' });
  });

  app.post('/api/portal/:eventId/memory-submission', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.memory_submission.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestMemorySubmissionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (!parsed.data.consent) throw BadRequest('photo-consent-required');
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const message = ['Guest memory/photo submission', `Photo/link: ${parsed.data.photoUrl || 'not provided'}`, `Caption: ${parsed.data.caption || ''}`, 'Moderation status: pending_review'].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, status, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, 'open', ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, addDaysIso(3), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.memory_submission', targetType: 'guest_help_request', targetId: id, details: { guestId, hasPhotoUrl: !!parsed.data.photoUrl, tokenStatus } });
    return reply.code(201).send({ ok: true, requestId: id, moderationStatus: 'pending_review', message: 'Your memory/photo submission was received and will be reviewed before sharing.' });
  });

  app.post('/api/portal/:eventId/guest-feedback', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.guest_feedback.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestPostEventFeedbackSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const meta = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const feedback = { id: uuid(), source: 'guest_portal', guestId, name: parsed.data.name || guest?.full_name || 'Guest', npsScore: parsed.data.npsScore, comment: parsed.data.comment || '', consentToContact: !!parsed.data.consentToContact, submittedAt: new Date().toISOString() };
    eventsRepo.update(eventId, { metadata: { ...meta, guestPostEventFeedback: [...(Array.isArray(meta.guestPostEventFeedback) ? meta.guestPostEventFeedback : []), feedback] } });
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.guest_feedback', targetType: 'event', targetId: eventId, details: { guestId, npsScore: parsed.data.npsScore, tokenStatus } });
    return reply.code(201).send({ ok: true, feedback, message: 'Thank you for sharing guest feedback.' });
  });

  app.post('/api/portal/:eventId/day-of-help', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.day_of_help.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestDayOfHelpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.dayOfContactEmail || portalConfig.accessibilityContactEmail || portalConfig.guestQuestionContactEmail || '').trim() || null;
    const label = parsed.data.kind === 'running_late' ? 'Guest running late' : 'Guest needs day-of help';
    const message = [label, `Token status: ${tokenStatus}`, parsed.data.message || 'No additional message provided.'].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(0), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.day_of_help', targetType: 'guest_help_request', targetId: id, details: { kind: parsed.data.kind, guestId, assignedTo: !!assignedTo, tokenStatus } });
    return reply.code(201).send({ ok: true, requestId: id, message: parsed.data.kind === 'running_late' ? 'Thanks for letting us know. The venue/couple team can see that you are running late.' : 'Your day-of help request was sent to the venue/couple team.' });
  });

  app.get('/api/portal/:eventId/guest-pass.txt', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenValid = guest && guest.event_id === eventId && verifyGuestPortalToken(guest, q.token) === 'valid';
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const org = orgsRepo.findById(event.organization_id);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const lines = [
      `${event.title} — Offline guest event-day pass`,
      `Guest: ${tokenValid ? guest!.full_name : 'Use secure link for personalized pass'}`,
      `Date: ${event.start_date || 'TBD'}`,
      `Address: ${portalConfig.venueAddress || metadata.venueAddress || metadata.location || org?.name || 'TBD'}`,
      `Table: ${tokenValid ? (guest!.table_assignment || 'Not assigned yet') : 'Use secure link'}`,
      `Seat: ${tokenValid ? (guest!.seat_assignment || 'Not assigned yet') : 'Use secure link'}`,
      `Lodging: ${tokenValid ? (guest!.room_assignment || 'Not assigned') : 'Use secure link'}`,
      `Shuttle: ${portalConfig.shuttleSchedule || portalConfig.transportationText || 'TBD'}`,
      `Parking: ${portalConfig.parkingEntrance || 'TBD'}`,
      `Drop-off: ${portalConfig.dropoffPoint || 'TBD'}`,
      `Contact: ${portalConfig.dayOfContactLabel || portalConfig.guestQuestionContactLabel || 'venue/couple team'} ${portalConfig.dayOfContactPhone || portalConfig.dayOfContactEmail || ''}`,
      `Staff help code: WVI-GUEST-HELP:${eventId}:${tokenValid ? guest!.id : 'anonymous'}`,
    ].join('\n');
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.guest_pass_export', targetType: 'event', targetId: eventId, details: { tokenized: !!tokenValid } });
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="guest-event-day-pass-${eventId}.txt"`).send(lines);
  });

  app.get('/api/portal/:eventId/travel-card.txt', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenValid = guest && guest.event_id === eventId && verifyGuestPortalToken(guest, q.token) === 'valid';
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const org = orgsRepo.findById(event.organization_id);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const locationSummary = metadata.guestLocation || metadata.venueAddress || metadata.location || org?.name || 'Venue details pending';
    const travel = {
      venueAddress: portalConfig.venueAddress || metadata.venueAddress || locationSummary,
      mapUrl: portalConfig.mapUrl || metadata.mapUrl || '',
      parkingEntrance: portalConfig.parkingEntrance || metadata.parkingEntrance || '',
      dropoffPoint: portalConfig.dropoffPoint || metadata.dropoffPoint || '',
      rideshareInstructions: portalConfig.rideshareInstructions || metadata.rideshareInstructions || '',
      shuttleSchedule: portalConfig.shuttleSchedule || metadata.shuttleSchedule || portalConfig.transportationText || '',
      shuttlePickupLocation: portalConfig.shuttlePickupLocation || metadata.shuttlePickupLocation || '',
      shuttleDropoffLocation: portalConfig.shuttleDropoffLocation || metadata.shuttleDropoffLocation || '',
      lastShuttleReminder: portalConfig.lastShuttleReminder || metadata.lastShuttleReminder || '',
      roomBlockDetails: portalConfig.roomBlockDetails || metadata.roomBlockDetails || '',
      accessibleParking: portalConfig.accessibleParking || metadata.accessibleParking || '',
      mobilityDropoff: portalConfig.mobilityDropoff || metadata.mobilityDropoff || '',
      destinationTravelFaq: portalConfig.destinationTravelFaq || metadata.destinationTravelFaq || '',
      weatherRainPlanNote: portalConfig.weatherRainPlanNote || metadata.weatherRainPlanNote || '',
    };
    const lines = [
      `${event.title} — Offline guest travel card`,
      `Guest: ${tokenValid ? guest!.full_name : 'Use your secure link for personalized details'}`,
      `Date: ${event.start_date || 'TBD'}`,
      `Venue/address: ${travel.venueAddress || 'TBD'}`,
      `Map link: ${travel.mapUrl || 'TBD'}`,
      `Parking entrance: ${travel.parkingEntrance || 'TBD'}`,
      `Drop-off point: ${travel.dropoffPoint || 'TBD'}`,
      `Rideshare: ${travel.rideshareInstructions || 'TBD'}`,
      `Shuttle schedule: ${travel.shuttleSchedule || 'TBD'}`,
      `Shuttle pickup: ${travel.shuttlePickupLocation || 'TBD'}`,
      `Shuttle drop-off: ${travel.shuttleDropoffLocation || 'TBD'}`,
      `Last shuttle reminder: ${travel.lastShuttleReminder || 'TBD'}`,
      `Lodging/room block: ${tokenValid && guest?.room_assignment ? guest.room_assignment : travel.roomBlockDetails || 'TBD'}`,
      `Accessible parking: ${travel.accessibleParking || 'TBD'}`,
      `Mobility drop-off: ${travel.mobilityDropoff || 'TBD'}`,
      `Weather/rain plan: ${travel.weatherRainPlanNote || 'Check portal for latest venue updates.'}`,
      '',
      'If details look incomplete, contact the couple or venue from your invitation.',
    ].join('\n');
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.travel_card_export', targetType: 'event', targetId: eventId, details: { tokenized: !!tokenValid } });
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="guest-travel-card-${eventId}.txt"`).send(lines);
  });

  app.get('/api/portal/:eventId/calendar.ics', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenValid = guest && guest.event_id === eventId && verifyGuestPortalToken(guest, q.token) === 'valid';
    const { subEventsRepo, timelineRepo } = await import('../../db/repos/index.js');
    const rawTimeline = timelineRepo.listForEvent(eventId);
    const timeline = rawTimeline.filter(isGuestTimelineItem).map(safeGuestTimelineItem);
    const subEvents = subEventsRepo.listForEvent(eventId).filter((sub: any) => !sub.invite_only || (tokenValid && db.prepare(`SELECT 1 FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(guest!.id, sub.id)));
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })();
    const ics = guestCalendarIcs({ event, timeline, subEvents, metadata });
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.calendar_export', targetType: 'event', targetId: eventId, details: { tokenized: !!tokenValid, timelineItems: timeline.length, subEvents: subEvents.length } });
    return reply.header('content-type', 'text/calendar; charset=utf-8').header('content-disposition', `attachment; filename="guest-schedule-${eventId}.ics"`).send(ics);
  });

  app.get('/api/portal/:eventId/sub-events/:subEventId.ics', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId, subEventId } = req.params as { eventId: string; subEventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const sub = db.prepare(`SELECT * FROM sub_events WHERE id = ? AND event_id = ?`).get(subEventId, eventId) as any;
    if (!sub) throw NotFound('sub-event-not-found');
    if (sub.invite_only) {
      const q = req.query as { guest?: string; token?: string };
      const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
      if (!guest || guest.event_id !== eventId || verifyGuestPortalToken(guest, q.token) !== 'valid') return reply.code(403).send({ error: 'guest-token-required' });
      const invited = db.prepare(`SELECT 1 FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(guest.id, subEventId);
      if (!invited) return reply.code(403).send({ error: 'not-on-your-itinerary' });
    }
    const meta = (() => { try { return JSON.parse(sub.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const dt = (value: string | null) => value ? new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') : '';
    const description = [meta.helpText, meta.parking ? `Parking: ${meta.parking}` : '', meta.dressCode ? `Dress code: ${meta.dressCode}` : '', meta.lateArrivalInstructions ? `Late arrival: ${meta.lateArrivalInstructions}` : ''].filter(Boolean).join('\\n');
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Wedding Venue Intelligence//Guest Portal//EN','BEGIN:VEVENT',`UID:${sub.id}@wvi`,`SUMMARY:${String(sub.title).replace(/\n/g, ' ')}`,`DTSTART:${dt(sub.starts_at)}`,sub.ends_at ? `DTEND:${dt(sub.ends_at)}` : '',meta.location ? `LOCATION:${String(meta.location).replace(/\n/g, ' ')}` : '',`DESCRIPTION:${description.replace(/\n/g, '\\n')}`,'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
    return reply.header('content-type', 'text/calendar; charset=utf-8').header('content-disposition', `attachment; filename="${sub.id}.ics"`).send(ics);
  });

  app.get('/api/portal/:eventId/messages', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    if (!q.guest) throw BadRequest('guest-required');
    const guest = guestsRepo.findById(q.guest);
    if (!guest || guest.event_id !== eventId) throw BadRequest('guest-not-in-event');
    const tokenStatus = verifyGuestPortalToken(guest, q.token);
    if (tokenStatus !== 'valid') return reply.code(403).send({ error: tokenStatus === 'revoked' ? 'portal-access-revoked' : 'portal-token-required' });
    const helpRequests = db.prepare(`SELECT * FROM guest_help_requests WHERE event_id = ? AND guest_id = ? ORDER BY created_at DESC LIMIT 20`).all(eventId, guest.id).map(safeGuestHelpRequest);
    const replies = db.prepare(`SELECT * FROM guest_help_request_replies WHERE event_id = ? AND guest_id = ? AND visible_to_guest = 1 ORDER BY created_at DESC LIMIT 50`).all(eventId, guest.id).map(safeGuestHelpReply);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.messages.view', targetType: 'guest', targetId: guest.id, details: { eventId, replies: replies.length } });
    return { helpRequests, replies, tokenStatus, emptyState: 'Venue replies to your guest help requests will appear here.' };
  });

  app.post('/api/portal/:eventId/verify-password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    assertNoPublicHoneypot(req, { organizationId: event?.organization_id, action: 'portal.verify_password.blocked', targetType: 'event', targetId: eventId });
    const { password } = (req.body ?? {}) as { password?: string };
    const cfg = portalConfigRepo.getForEvent(eventId) as { password_hash: string | null; password_salt: string | null } | undefined;
    if (!cfg?.password_hash || !cfg.password_salt) return { ok: true }; // no password set
    if (!password) { auditPublicSubmission(req, { organizationId: event?.organization_id, action: 'portal.verify_password_failed', targetType: 'event', targetId: eventId, details: { reason: 'missing_password' } }); return reply.code(401).send({ ok: false }); }
    const ok = verifyPassword(password, {
      passwordHash: cfg.password_hash, passwordSalt: cfg.password_salt,
    });
    auditPublicSubmission(req, { organizationId: event?.organization_id, action: ok ? 'portal.verify_password' : 'portal.verify_password_failed', targetType: 'event', targetId: eventId, details: { ok } });
    return reply.code(ok ? 200 : 401).send({ ok });
  });

  app.post('/api/portal/:eventId/rsvp', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'rsvp.blocked', targetType: 'event', targetId: eventId });
    const parsed = rsvpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    if (parsed.data.guestId) {
      const g = guestsRepo.findById(parsed.data.guestId);
      if (!g || g.event_id !== eventId) throw BadRequest('guest-not-in-event');
      if (!g.allow_portal_access) throw new (await import('../../lib/errors.js')).HttpError(403, 'portal-access-revoked');
      const prior = db.prepare(`SELECT COUNT(*) AS n FROM rsvp_submissions WHERE guest_id = ?`).get(g.id) as { n: number };
      // RSVP edit window: when the couple configures rsvpEditWindowDays and
      // the event has an rsvp_deadline, edits close at deadline + window.
      if (prior.n > 0) {
        const cfg = portalConfigRepo.getForEvent(eventId) as { config?: string } | undefined;
        const portalConfig = cfg ? (() => { try { return JSON.parse(String(cfg.config || '{}')); } catch { return {}; } })() : {};
        const editWindowDays = Number(portalConfig.rsvpEditWindowDays ?? 0);
        if (event.rsvp_deadline && editWindowDays > 0) {
          const windowEnd = new Date(`${event.rsvp_deadline}T23:59:59`);
          if (!Number.isNaN(windowEnd.getTime())) windowEnd.setDate(windowEnd.getDate() + editWindowDays);
          if (!Number.isNaN(windowEnd.getTime()) && Date.now() > windowEnd.getTime()) {
            auditPublicSubmission(req, { organizationId: event.organization_id, action: 'rsvp.edit_window_closed', targetType: 'guest', targetId: g.id, details: { eventId, rsvpDeadline: event.rsvp_deadline, editWindowDays, windowEnd: windowEnd.toISOString() } });
            throw new (await import('../../lib/errors.js')).HttpError(403, 'rsvp-edit-window-closed');
          }
        }
      }
      // Token validity: the guest's own invitation token, OR a household
      // member's token (one invite per household — the client submits the
      // primary's link token for every member of the party).
      const tokenValidForGuest = parsed.data.token ? verifyGuestPortalToken(g, parsed.data.token) === 'valid' : false;
      const tokenValidForHousehold = (() => {
        if (tokenValidForGuest || !parsed.data.token) return false;
        const householdKey = guestHouseholdKey(g);
        if (!householdKey) return false;
        return guestsRepo.listForEvent(eventId).some(
          (m) => m.id !== g.id && guestHouseholdKey(m) === householdKey && verifyGuestPortalToken(m, parsed.data.token) === 'valid',
        );
      })();
      const authorized = tokenValidForGuest || tokenValidForHousehold;
      if (g.portal_token_hash && (parsed.data.token || prior.n > 0) && !authorized) {
        auditPublicSubmission(req, { organizationId: event.organization_id, action: 'rsvp.suspicious_submit', targetType: 'guest', targetId: g.id, details: { reason: prior.n > 0 ? 'edit_token_required_or_invalid' : 'token_invalid', priorCount: prior.n } });
        throw new (await import('../../lib/errors.js')).HttpError(403, prior.n > 0 ? 'portal-token-required-for-rsvp-edit' : 'portal-token-invalid');
      }
      // RSVP integrity: an RSVP must come from the guest's INVITATION LINK
      // (or a household member's link). Guests without any issued token were
      // never invited via secure link (the default for imported guests) —
      // accepting a tokenless RSVP would let anyone who finds a guest's ID
      // via public lookup submit/change attendance on their behalf (spoofed
      // headcounts for catering/seating). Such guests use the lookup →
      // request-secure-link flow instead.
      if (!g.portal_token_hash && !authorized) {
        auditPublicSubmission(req, { organizationId: event.organization_id, action: 'rsvp.no_token_hash', targetType: 'guest', targetId: g.id, details: { eventId, reason: 'guest_never_issued_secure_link' } });
        throw new (await import('../../lib/errors.js')).HttpError(403, 'portal-token-required');
      }
    }

    const isRsvpEdit = parsed.data.guestId ? ((db.prepare(`SELECT COUNT(*) AS n FROM rsvp_submissions WHERE guest_id = ?`).get(parsed.data.guestId) as { n: number }).n > 0) : false;
    const rsvpId = rsvpRepo.submit({
      organizationId: event.organization_id, eventId,
      guestId: parsed.data.guestId,
      attending: parsed.data.attending,
      status: parsed.data.status,
      attendingDays: parsed.data.attendingDays,
      mealChoice: parsed.data.mealChoice,
      plusOneName: parsed.data.plusOneName,
      plusOneMealChoice: parsed.data.plusOneMealChoice,
      dietaryNotes: [parsed.data.dietaryNotes, parsed.data.allergies ? `Allergies: ${parsed.data.allergies}` : '', parsed.data.allergySeverity ? `Severity: ${parsed.data.allergySeverity}` : '', parsed.data.crossContaminationWarning ? 'Cross-contamination warning requested' : '', parsed.data.severeAllergyContact ? 'Severe allergy: please contact guest' : ''].filter(Boolean).join(' | ') || undefined,
      specialNeeds: [parsed.data.specialNeeds, parsed.data.beveragePreference ? `Beverage preference: ${parsed.data.beveragePreference}` : ''].filter(Boolean).join(' | ') || undefined,
      notes: [parsed.data.notes, parsed.data.emailReminderConsent ? 'Email reminder consent: yes' : 'Email reminder consent: no', parsed.data.smsReminderConsent ? 'SMS reminder consent: yes' : 'SMS reminder consent: no'].filter(Boolean).join(' | ') || undefined,
      ip: req.ip, userAgent: req.headers['user-agent'],
    });

    if (parsed.data.guestId && (parsed.data.severeAllergyContact || parsed.data.allergySeverity === 'severe')) {
      const alertId = uuid();
      const g = guestsRepo.findById(parsed.data.guestId);
      db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, status, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, 'open', ?, ?, ?)`).run(
        alertId,
        event.organization_id,
        eventId,
        parsed.data.guestId,
        g?.full_name || null,
        g?.email || null,
        `Severe allergy follow-up requested. Allergies: ${parsed.data.allergies || 'not specified'}. Severity: ${parsed.data.allergySeverity || 'severe'}. Cross-contamination concern: ${parsed.data.crossContaminationWarning ? 'yes' : 'no'}.`,
        addDaysIso(1),
        req.ip,
        req.headers['user-agent'] || null,
      );
      auditRepo.log({ organizationId: event.organization_id, action: 'portal.severe_allergy_alert', targetType: 'guest_help_request', targetId: alertId, ip: req.ip, userAgent: req.headers['user-agent'], details: { eventId, guestId: parsed.data.guestId, allergySeverity: parsed.data.allergySeverity, crossContaminationWarning: parsed.data.crossContaminationWarning } });
    }

    if (parsed.data.subEventRSVPs && parsed.data.guestId) {
      const { db } = await import('../../db/database.js');
      for (const [subId, attends] of Object.entries(parsed.data.subEventRSVPs)) {
         const status = attends === true || attends === 'attending' ? 'accepted' : attends === false || attends === 'declined' ? 'declined' : 'maybe';
         db.prepare(
            `UPDATE guest_sub_event_invitations 
             SET rsvp_status = ? 
             WHERE guest_id = ? AND sub_event_id = ?`
         ).run(status, parsed.data.guestId, subId);
      }
    }

    auditPublicSubmission(req, {
      organizationId: event.organization_id,
      action: 'rsvp.submit',
      targetType: 'rsvp',
      targetId: rsvpId,
      details: { eventId, attending: parsed.data.attending, guestId: parsed.data.guestId ?? null, edit: isRsvpEdit, tokenized: !!parsed.data.token, emailReminderConsent: parsed.data.emailReminderConsent === true, smsReminderConsent: parsed.data.smsReminderConsent === true },
    });
    if (isRsvpEdit) auditPublicSubmission(req, { organizationId: event.organization_id, action: 'rsvp.edit', targetType: 'rsvp', targetId: rsvpId, details: { eventId, guestId: parsed.data.guestId ?? null, tokenized: !!parsed.data.token } });
    // Preserve the historical audit action used by existing reports/tests while
    // also writing the explicit public.* telemetry event above.
    auditRepo.log({
      organizationId: event.organization_id, action: 'rsvp.submit',
      targetType: 'rsvp', targetId: rsvpId, ip: req.ip, userAgent: req.headers['user-agent'],
    });
    const confirmation: { emailJobId?: string; smsJobId?: string; status: string } = { status: 'not_available' };
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    if (guest) {
      const summaryText = [`${event.title} RSVP confirmation`, `Response: ${parsed.data.attending ? 'Attending' : 'Not attending'}`, parsed.data.mealChoice ? `Meal: ${parsed.data.mealChoice}` : '', parsed.data.plusOneName ? `Plus-one: ${parsed.data.plusOneName}` : '', parsed.data.notes ? `Note: ${parsed.data.notes}` : ''].filter(Boolean).join('\n');
      if (guest.email) {
        const smtpId = activeSmtpIntegrationId(event.organization_id);
        if (smtpId) {
          const job = jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: guest.email, subject: `${event.title} RSVP confirmation`, text: summaryText, html: `<p>${escapeHtml(summaryText).replace(/\n/g, '<br/>')}</p>` } });
          confirmation.emailJobId = job.id;
          confirmation.status = 'queued';
        }
      }
      if (guest.phone) {
        const smsId = activeSmsIntegrationId(event.organization_id);
        if (smsId) {
          const job = jobsRepo.enqueue({ kind: 'sms.send', organizationId: event.organization_id, payload: { integrationId: smsId, to: guest.phone, body: summaryText.slice(0, 1000) } });
          confirmation.smsJobId = job.id;
          confirmation.status = 'queued';
        }
      }
    }
    broadcastSSE(event.organization_id, "rsvp.submitted", { rsvpId, eventId, attending: parsed.data.attending });
    return reply.code(201).send({ ok: true, rsvpId, confirmation });
  });

}
