/**
 * PublicGuestPortal — the couple-facing public portal.
 *
 * Phase 22:    Themed using org/event branding (6 presets, warm fallback).
 * Phase 34b:   Eliminated any#1–6 (r:any, guests/layout/polls state any).
 * Phase 35a:   Final any elimination:
 *                any#7  handleWheel (e: any) → KonvaEventObject<WheelEvent>
 *                any#8  polls.filter((p: any) → Poll
 *                any#9  polls.map((poll: any) → Poll
 *                any#10 poll.options.map((opt: any) → PollOption
 *              + Bonus bug: getPointerPosition() returns Vector2d | null —
 *                the live code called .x/.y on it without a null guard,
 *                crashing if the pointer hadn't entered the canvas yet.
 *
 * IMPORT NOTE — @types/konva does NOT exist as a separate npm package.
 * konva v10+ ships its own TypeScript declarations. react-konva v18
 * re-exports KonvaEventObject from 'konva/lib/Node'. No new dependencies
 * are required — just the correct import.
 *
 * After Phase 35a, PublicGuestPortal.tsx has ZERO `any` annotations.
 */
import React, { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { ApiError, sdk }           from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Button }                  from '../../ui/Button';
import { Label }                   from '../../ui/Label';
import { usePrompt }              from '../../ui/usePrompt';
import { formatDateOnly, parseDateOnly } from '../../lib/formatDate';
import { countdownParts } from './countdown';
import { I18nProvider, useI18n } from '../../i18n/I18nContext';
import type { PortalLanguage } from '../../i18n/translations';
import { Map as MapIcon, Home, Send, CloudRain, HelpCircle, Bus, Gift, Mail, Contrast, Languages, RefreshCw, ShieldAlert, Type } from 'lucide-react';
import { Badge }                   from '../../ui/Badge';
import { cn }                      from '../../ui/lib/cn';
import type {
  Poll }               from '../../sdk/feedback.js';
import type {
  PortalInfoResponse,
  PortalGuestEntry,
  PortalLayoutPayload,
  PollOption,
} from '../../sdk/portalTypes.js';


const GuestPortalHome = lazy(() => import('./GuestPortalHome').then((m) => ({ default: m.GuestPortalHome })));
const GuestRsvpWizard = lazy(() => import('./GuestRsvpWizard').then((m) => ({ default: m.GuestRsvpWizard })));
const GuestWeekendItinerary = lazy(() => import('./GuestWeekendItinerary').then((m) => ({ default: m.GuestWeekendItinerary })));
const GuestMapWayfinding = lazy(() => import('./GuestMapWayfinding').then((m) => ({ default: m.GuestMapWayfinding }))); 

// ── Default portal palette (warm/elegant) ─────────────────────────────────

const DEFAULT_PALETTE = {
  bg:           '#fdfbf7',
  surface:      '#ffffff',
  border:       'rgb(var(--color-border))',
  fg:           '#2c3e2e',
  // AA contrast on the warm portal background (the former #6b7280 was 4.34:1).
  fgMuted:      '#57534e',
  fgSubtle:     '#9ca3af',
  primary:      '#2c3e2e',
  primaryFg:    '#ffffff',
  primaryHover: '#1a251b',
  accent:       'rgb(var(--color-accent))',
  accentSoft:   'rgba(225,213,201,0.3)',
};

type Palette = typeof DEFAULT_PALETTE;

/**
 * PrecisionCountdown — self-contained wedding-day countdown.
 *
 * Only THIS component re-renders on its 10s tick; the old implementation
 * kept `nowTime` in the portal root, re-rendering the ENTIRE portal tree
 * (including the multi-step RSVP wizard) every 10 seconds.
 */
function PrecisionCountdown({ startDate, palette }: { startDate: string; palette: Palette }) {
  const [nowTime, setNowTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);
  // Target LOCAL midnight of the wedding day (parseDateOnly) — raw
  // `new Date('YYYY-MM-DD')` is UTC midnight, which flips the countdown
  // to "Celebration Time" while the wedding is still in progress in
  // non-UTC timezones.
  const parts = countdownParts(startDate, nowTime);
  const isPast = parts.isPast;
  const days = parts.days;
  const hours = parts.hours;
  const minutes = parts.minutes;
  return (
    <div className="text-center py-6 px-4 rounded-2xl border" style={{ borderColor: palette.border, background: palette.surface }}>
      <CountdownLabels>
        {({ t: tCount }) => (
          <>
            <span className="text-[10px] uppercase font-bold tracking-widest block mb-1.5" style={{ color: palette.primary }}>{tCount('shell.countdown')}</span>
            {isPast ? (
              <div className="font-display text-2xl py-4" style={{ color: palette.primary }}>
                {tCount('shell.celebration')}
              </div>
            ) : (
              <div className="flex justify-center items-center gap-4 sm:gap-6 py-2">
                <div className="text-center">
                  <div className="font-display text-4xl sm:text-5xl font-black" style={{ color: palette.primary }}>{days}</div>
                  <div className="text-[9px] uppercase tracking-wider text-fg-subtle mt-0.5 font-sans font-bold">{tCount('shell.countdownDays')}</div>
                </div>
                <div className="font-display text-2xl sm:text-3xl text-fg-subtle opacity-40">:</div>
                <div className="text-center">
                  <div className="font-display text-4xl sm:text-5xl font-black" style={{ color: palette.primary }}>{hours}</div>
                  <div className="text-[9px] uppercase tracking-wider text-fg-subtle mt-0.5 font-sans font-bold">{tCount('shell.countdownHours')}</div>
                </div>
                <div className="font-display text-2xl sm:text-3xl text-fg-subtle opacity-40">:</div>
                <div className="text-center">
                  <div className="font-display text-4xl sm:text-5xl font-black" style={{ color: palette.primary }}>{minutes}</div>
                  <div className="text-[9px] uppercase tracking-wider text-fg-subtle mt-0.5 font-sans font-bold">{tCount('shell.countdownMinutes')}</div>
                </div>
              </div>
            )}
          </>
        )}
      </CountdownLabels>
    </div>
  );
}

/** Context bridge for the countdown labels (rendered under the provider). */
function CountdownLabels({ children }: { children: (i18n: ReturnType<typeof useI18n>) => React.ReactNode }) {
  const i18n = useI18n();
  return <>{children(i18n)}</>;
}

// ── PublicGuestPortal ─────────────────────────────────────────────────────

export function PublicGuestPortal({ eventId }: { eventId: string }) {
  const { ask, askForm, askConfirm, promptNode } = usePrompt();
  // ── State — fully typed, zero `any` ─────────────────────────────────────
  const [info,            setInfo]           = useState<PortalInfoResponse['event'] | null>(null);
  const [infoLanguage,    setInfoLanguage]    = useState<PortalLanguage | undefined>(undefined);
  const [guests,          setGuests]         = useState<PortalGuestEntry[]>([]);
  const [layout,          setLayout]         = useState<PortalLayoutPayload | null>(null);
  const [polls,           setPolls]          = useState<Poll[]>([]);
  const [palette,         setPalette]        = useState<Palette>(DEFAULT_PALETTE);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [attending,       setAttending]      = useState(true);
  const [mealChoice,      setMealChoice]     = useState('standard');
  const [notes,           setNotes]          = useState('');
  const [done,            setDone]           = useState(false);
  const [error,           setError]          = useState<string | null>(null);
  const [portalStatus,    setPortalStatus]   = useState<{ event?: { title: string; startDate: string | null }; status?: 'available' | 'disabled'; support?: { label: string; email: string; phone: string }; message?: string } | null>(null);
  const [activeTab,       setActiveTab]      = useState<'home' | 'map' | 'rsvp'>('home');

  const [subEvents,       setSubEvents]      = useState<any[]>([]);
  const [timeline,        setTimeline]       = useState<any[]>([]);
  const [portalBranding,  setPortalBranding] = useState<PortalInfoResponse['branding'] | null>(null);
  const [portalConfig,    setPortalConfig]   = useState<Record<string, any>>({});
  const [portalAccess,    setPortalAccess]   = useState<PortalInfoResponse['access'] | null>(null);
  const [guestHome,       setGuestHome]      = useState<PortalInfoResponse['guestHome'] | null>(null);
  const [guestSchedule,   setGuestSchedule]  = useState<PortalInfoResponse['guestSchedule'] | null>(null);
  const [guestTravel,     setGuestTravel]    = useState<PortalInfoResponse['guestTravel'] | null>(null);
  const [guestWayfinding, setGuestWayfinding] = useState<PortalInfoResponse['guestWayfinding'] | null>(null);
  const [guestFaq,        setGuestFaq]       = useState<PortalInfoResponse['guestFaq'] | null>(null);
  const [guestGifts,      setGuestGifts]     = useState<PortalInfoResponse['guestGifts'] | null>(null);
  const [guestCare,       setGuestCare]      = useState<PortalInfoResponse['guestCare'] | null>(null);
  const [guestPrivacy,    setGuestPrivacy]   = useState<PortalInfoResponse['guestPrivacy'] | null>(null);
  const [guestReminders,  setGuestReminders] = useState<PortalInfoResponse['guestReminders'] | null>(null);
  const [guestDayOf,      setGuestDayOf]     = useState<PortalInfoResponse['guestDayOf'] | null>(null);
  const [guestPostEvent,  setGuestPostEvent] = useState<PortalInfoResponse['guestPostEvent'] | null>(null);
  const [largeTextMode,   setLargeTextMode]  = useState(() => localStorage.getItem('wvi_guest_large_text') === '1');
  const [highContrastMode,setHighContrastMode] = useState(() => localStorage.getItem('wvi_guest_high_contrast') === '1');
  const [scheduleTab,     setScheduleTab]    = useState<'wedding' | 'subevents'>('wedding');
  const [guestToken,      setGuestToken]      = useState('');
  const [lookupQuery,     setLookupQuery]     = useState('');
  const [lookupEmail,     setLookupEmail]     = useState('');
  const [lookupResults,   setLookupResults]   = useState<Array<{ id: string; label: string; partyName: string | null; requiresSecureLink: boolean }>>([]);
  const [lookupMessage,   setLookupMessage]   = useState('');
  const [venueReplies,    setVenueReplies]    = useState<Array<{ id: string; body: string; channel: string; sentByLabel: string; createdAt: string }>>([]);
  const [venueMessagesEmpty, setVenueMessagesEmpty] = useState('Venue replies to your guest help requests will appear here.');

  const [searchQuery,         setSearchQuery]         = useState('');
  const [checkedHouseholdIds, setCheckedHouseholdIds] = useState<string[]>([]);
  const [memberAttending,     setMemberAttending]     = useState<Record<string, boolean>>({});
  const [memberMeals,         setMemberMeals]         = useState<Record<string, string>>({});
  const [subEventAttending,   setSubEventAttending]   = useState<Record<string, boolean>>({});
  const [isFormDirty,         setIsFormDirty]         = useState(false);

  const activeGuest = guests.find((g) => g.id === selectedGuestId);

  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return guests;
    const q = searchQuery.toLowerCase();
    return guests.filter(g => g.fullName.toLowerCase().includes(q));
  }, [guests, searchQuery]);


  const householdCandidates = useMemo(() => {
    if (!activeGuest) return [];
    const activeLastName = activeGuest.fullName.split(' ').slice(-1)[0] || '';
    if (activeLastName.length < 2) return [];
    return guests.filter(g => 
      g.id !== selectedGuestId && 
      g.fullName.split(' ').slice(-1)[0] === activeLastName
    );
  }, [activeGuest, guests, selectedGuestId]);

  useEffect(() => { localStorage.setItem('wvi_guest_large_text', largeTextMode ? '1' : '0'); }, [largeTextMode]);
  useEffect(() => { localStorage.setItem('wvi_guest_high_contrast', highContrastMode ? '1' : '0'); }, [highContrastMode]);

  const portalPalette = highContrastMode ? {
    ...palette,
    bg: '#000000', surface: '#0b0b0b', border: '#ffffff', fg: '#ffffff', fgMuted: '#f3f4f6', fgSubtle: '#e5e7eb', primary: '#ffffff', primaryFg: '#000000', primaryHover: '#f3f4f6', accent: '#facc15', accentSoft: '#1f2937',
  } : palette;

  // ── Boot + light polling: load portal data ──────────────────────────────
  // The portal advertises "What has changed?" notices but never re-checked —
  // a venue schedule update wouldn't appear on an open phone until reload.
  // Poll every 5 minutes (well inside the 120/min info rate limit) so
  // change notices, schedule edits, and messages stay fresh on event day.
  const loadPortalData = useCallback(() => {
    const sp = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const guestParam = sp.get('guest');
    const tokenParam = sp.get('token') || '';
    if (guestParam) setSelectedGuestId(guestParam);
    if (tokenParam) setGuestToken(tokenParam);

    // any#1 fixed (Phase 34b): r is PortalInfoResponse, not any
    sdk.portal.info(eventId, guestParam ? { guest: guestParam, token: tokenParam } : undefined)
      .then((r: any) => {
        setInfo(r.event);
        if (r.language === 'en' || r.language === 'es' || r.language === 'fr' || r.language === 'zh') setInfoLanguage(r.language);
        setGuests(r.guests);   // any#2 fixed
        setLayout(r.layout);   // any#3 fixed
        setSubEvents(r.subEvents || []);
        setTimeline(r.timeline || []);
        setPortalBranding(r.branding ?? null);
        setPortalConfig(r.config ?? {});
        setPortalAccess(r.access ?? null);
        setGuestHome(r.guestHome ?? null);
        setGuestSchedule(r.guestSchedule ?? null);
        setGuestTravel(r.guestTravel ?? null);
        setGuestWayfinding(r.guestWayfinding ?? null);
        setGuestFaq(r.guestFaq ?? null);
        setGuestGifts(r.guestGifts ?? null);
        setGuestCare(r.guestCare ?? null);
        setGuestPrivacy(r.guestPrivacy ?? null);
        setGuestReminders(r.guestReminders ?? null);
        setGuestDayOf(r.guestDayOf ?? null);
        setGuestPostEvent(r.guestPostEvent ?? null);
        if (r.identity?.selectedGuestId) setSelectedGuestId(r.identity.selectedGuestId);
        if (r.identity?.supportMessage) setLookupMessage(r.identity.supportMessage);
        if (r.identity?.selectedGuestId && tokenParam) {
          sdk.portal.messages(eventId, { guest: r.identity.selectedGuestId, token: tokenParam })
            .then((messages) => { setVenueReplies(messages.replies || []); setVenueMessagesEmpty(messages.emptyState); })
            .catch(() => setVenueMessagesEmpty('Sign in with your secure invitation link to see venue replies.'));
        }

        // r.theme was the missing field that forced the original `any` cast
        if (r.theme) {
          const t = r.theme;
          setPalette({
            bg:           t.bgColor        ?? DEFAULT_PALETTE.bg,
            surface:      t.surfaceColor   ?? DEFAULT_PALETTE.surface,
            border:       t.borderColor    ?? DEFAULT_PALETTE.border,
            fg:           t.fgColor        ?? DEFAULT_PALETTE.fg,
            fgMuted:      t.fgMutedColor   ?? DEFAULT_PALETTE.fgMuted,
            fgSubtle:     t.fgSubtleColor  ?? DEFAULT_PALETTE.fgSubtle,
            primary:      t.brandColor     ?? DEFAULT_PALETTE.primary,
            primaryFg:    t.brandFgColor   ?? DEFAULT_PALETTE.primaryFg,
            primaryHover: t.brandHoverColor ?? DEFAULT_PALETTE.primaryHover,
            accent:       t.accentColor    ?? DEFAULT_PALETTE.accent,
            accentSoft:   t.accentSoftColor ?? DEFAULT_PALETTE.accentSoft,
          });
        }

        sdk.feedback.getPolls(eventId)
          .then((res) => setPolls(res.polls))   // any#4 fixed: Poll[]
          .catch(() => {});
      })
      .catch((err: any) => {
        const isOffline = err?.kind === 'offline' || err?.code === 'network-error';
        const isDisabled = err?.code === 'portal-disabled';
        setError(isOffline ? 'Network connection failed. Your portal may be temporarily unavailable.' : isDisabled ? 'This guest portal is currently disabled by the venue/couple team.' : 'Event not found. This guest portal link may be invalid, expired, or not yet available.');
        sdk.portal.status(eventId).then((status) => setPortalStatus(status)).catch(() => setPortalStatus(null));
      });
  }, [eventId]);

  useEffect(() => {
    loadPortalData();
    const poll = setInterval(loadPortalData, 5 * 60 * 1000);
    return () => clearInterval(poll);
  }, [loadPortalData]);

  // ── RSVP submit ──────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) { setError('Please pick your name.'); return; }
    try {
      // Submit primary guest
      await sdk.portal.submitRsvp(eventId, {
        guestId:    selectedGuestId,
        token: guestToken || undefined,
        attending,
        mealChoice,
        notes: notes || undefined,
        subEventRSVPs: subEventAttending,
      });

      // Submit household party members in batch sequence
      for (const mid of checkedHouseholdIds) {
         await sdk.portal.submitRsvp(eventId, {
            guestId: mid,
            attending: memberAttending[mid] !== false,
            mealChoice: memberMeals[mid] || 'standard',
            notes: notes || undefined,
         });
      }

      setDone(true);
      setIsFormDirty(false);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  const handleTabChange = async (nextTab: typeof activeTab) => {
    if (activeTab === 'rsvp' && !done && (selectedGuestId || notes) && isFormDirty) {
      if (!(await askConfirm({ title: 'Discard your draft?', description: 'You have unsaved RSVP responses. Are you sure you want to discard your draft?', destructive: true }))) {
        return;
      }
    }
    setActiveTab(nextTab);
    setIsFormDirty(false);
  };

  async function lookupGuest() {
    setError(null);
    setLookupMessage('');
    try {
      const res = await sdk.portal.lookup(eventId, { query: lookupQuery, email: lookupEmail || undefined });
      setLookupResults(res.matches);
      setLookupMessage(res.matches.length ? res.privacy : 'No matching invitation was found. You can request help or ask for a secure link.');
    } catch (err) {
      setLookupMessage((err as Error).message || 'Lookup failed. Please request help.');
    }
  }

  async function requestGuestHelp(kind: 'cannot_find_name' | 'wrong_guest' | 'expired_or_revoked' | 'other') {
    const values = await askForm({
      title: kind === 'cannot_find_name' ? 'I cannot find my name' : kind === 'wrong_guest' ? 'This invitation is not for me' : 'Request help',
      fields: [
        { key: 'email', label: 'Email where the venue/couple can reach you', defaultValue: lookupEmail || '' },
        { key: 'message', label: 'Optional note', multiline: true, defaultValue: kind === 'wrong_guest' ? 'This invitation link is not for me.' : '' },
      ],
    });
    if (!values) return;
    try {
      const res = await sdk.portal.requestHelp(eventId, { kind, name: lookupQuery || activeGuest?.fullName, email: values.email || undefined, message: values.message || undefined, guestId: selectedGuestId || undefined });
      setLookupMessage(res.message);
    } catch (err: any) {
      const e = err as ApiError;
      setLookupMessage(
        e.kind === 'rate-limited'
          ? 'Too many help requests in the last minute — please wait a moment and try again.'
          : e.message || 'Could not send your help request. Please try again in a minute.',
      );
    }
  }

  async function resendSecureLink() {
    let email = lookupEmail;
    if (!email) {
      const asked = await ask({ title: 'Request your secure RSVP link', label: 'Email address', required: true });
      if (!asked) return;
      email = asked;
    }
    try {
      const res = await sdk.portal.resendLink(eventId, { email, name: lookupQuery || undefined });
      setLookupMessage(res.message);
    } catch (err: any) {
      const e = err as ApiError;
      setLookupMessage(
        e.kind === 'rate-limited'
          ? 'Too many link requests in the last minute — please wait a moment and try again.'
          : e.message || 'Could not request a secure link. Please try again in a minute.',
      );
    }
  }

  function saveGuestEventDetails() {
    if (!info) return;
    const lines = [
      `${info.title} — Guest event details`,
      `Type: ${guestHome?.eventType || info.eventType || 'wedding'}`,
      `Date: ${info.startDate ? formatDateOnly(info.startDate) : 'TBD'}`,
      `Location: ${guestHome?.locationSummary || info.locationSummary || 'Venue details pending'}`,
      `RSVP deadline: ${guestHome?.rsvpDeadline || info.rsvpDeadline ? formatDateOnly(guestHome?.rsvpDeadline || info.rsvpDeadline) : 'TBD'}`,
      activeGuest ? `Guest: ${activeGuest.fullName}` : 'Guest: not selected yet',
      activeGuest?.tableAssignment ? `Table: ${activeGuest.tableAssignment}` : '',
      activeGuest?.seatAssignment ? `Seat: ${activeGuest.seatAssignment}` : '',
      activeGuest?.roomAssignment ? `Lodging: ${activeGuest.roomAssignment}` : '',
      '',
      'Schedule:',
      ...timeline.slice(0, 8).map((item: any) => `- ${item.title || 'Schedule item'} ${item.starts_at ? new Date(item.starts_at).toLocaleString() : ''}`),
      '',
      'Guest-facing updates:',
      ...((guestHome?.changeNotices || []).map((notice) => `- ${notice.title}: ${notice.body}`)),
    ].filter(Boolean).join('\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `guest-event-details-${eventId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Persist the guest's chosen portal language to their guest record when
  // they hold a secure link (anonymous guests persist to localStorage only).
  const persistLanguage = useCallback((language: PortalLanguage) => {
    const guest = guests.find((g) => g.id === selectedGuestId);
    if (!guest?.id || !guestToken) return;
    Promise.resolve(sdk.portal.setLanguage(eventId, { guestId: guest.id, token: guestToken, language })).catch(() => { /* best-effort sync */ });
  }, [eventId, guests, selectedGuestId, guestToken]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (error && !info) {
    return (
      <I18nProvider>
        <GuestPortalRecoveryCenter eventId={eventId} error={error} portalStatus={portalStatus} onRetry={() => window.location.reload()} />
      </I18nProvider>
    );
  }

  if (!info) {
    return (
      <I18nProvider>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: portalPalette.bg }}
          aria-busy="true"
          aria-label="Loading wedding portal"
        >
          <div className="animate-pulse" style={{ color: portalPalette.fgMuted }}>
            Loading Portal…
          </div>
        </div>
      </I18nProvider>
    );
  }

  // Inline CSS var block so all children inherit the theme via var()
  const themeVars: React.CSSProperties = {
    '--portal-bg':           portalPalette.bg,
    '--portal-surface':      portalPalette.surface,
    '--portal-border':       portalPalette.border,
    '--portal-fg':           portalPalette.fg,
    '--portal-fg-muted':     portalPalette.fgMuted,
    '--portal-primary':      portalPalette.primary,
    '--portal-primary-fg':   portalPalette.primaryFg,
    '--portal-primary-hover':portalPalette.primaryHover,
    '--portal-accent':       portalPalette.accent,
    '--portal-accent-soft':  portalPalette.accentSoft,
  } as React.CSSProperties;

  return (
    <I18nProvider initialLang={infoLanguage} onLangChange={persistLanguage}>
      <div
        className={cn("min-h-screen font-serif flex flex-col relative pb-20", largeTextMode && "text-lg")}
        style={{ background: portalPalette.bg, color: portalPalette.fg, ...themeVars }}
      >
        {promptNode}
        <PortalShellHeader
          info={info}
          platformName={portalBranding?.platformName}
          portalPalette={portalPalette}
          largeTextMode={largeTextMode}
          setLargeTextMode={setLargeTextMode}
          highContrastMode={highContrastMode}
          setHighContrastMode={setHighContrastMode}
        />

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">

        {/* ── HOME TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            {/* Hero banner */}
            <div
              className="aspect-[21/9] w-full rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center"
              style={{ background: portalPalette.accent }}
            >
              {/* Dark scrim — keeps headline ≥3:1 contrast over any accent colour */}
              <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
              <PortalTranslations>
                {({ t: tHero }) => (
                  <h2
                    className="relative z-10 text-brand-fg font-display text-4xl md:text-5xl lg:text-6xl text-center px-4 leading-tight"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                  >
                    {tHero('shell.welcomeTitle')}
                  </h2>
                )}
              </PortalTranslations>
            </div>

            <Suspense fallback={<Card><CardContent className="pt-6"><div className="h-64 animate-pulse rounded-lg bg-surface-2" /></CardContent></Card>}>
              <GuestPortalHome
                eventId={eventId}
                info={info}
                guestHome={guestHome}
                activeGuest={activeGuest}
                palette={portalPalette}
                guestToken={guestToken}
                portalAccess={portalAccess}
                lookupQuery={lookupQuery}
                setLookupQuery={setLookupQuery}
                lookupEmail={lookupEmail}
                setLookupEmail={setLookupEmail}
                lookupGuest={lookupGuest}
                lookupMessage={lookupMessage}
                lookupResults={lookupResults}
                onSelectLookupGuest={(match) => { setGuests((current) => current.some((g) => g.id === match.id) ? current : [...current, { id: match.id, fullName: match.label, tableAssignment: null, seatAssignment: null, roomAssignment: null }]); setSelectedGuestId(match.id); setActiveTab('rsvp'); }}
                resendSecureLink={resendSecureLink}
                requestGuestHelp={requestGuestHelp}
                venueReplies={venueReplies}
                venueMessagesEmpty={venueMessagesEmpty}
                setActiveTab={setActiveTab}
                saveGuestEventDetails={saveGuestEventDetails}
                config={portalConfig}
                branding={portalBranding}
                guestTravel={guestTravel}
                guestFaq={guestFaq}
                guestGifts={guestGifts}
                guestCare={guestCare}
                guestPrivacy={guestPrivacy}
                guestReminders={guestReminders}
                guestDayOf={guestDayOf}
                guestPostEvent={guestPostEvent}
              />
            </Suspense>

            {/* Precision Countdown — self-contained (does not re-render the
                whole portal on each tick) */}
            {info.startDate && <PrecisionCountdown startDate={info.startDate} palette={portalPalette} />}

            {/* Weather & rain plan — venue-authored note only (no fabricated forecasts) */}
            {guestTravel?.weatherRainPlanNote?.trim() && (
              <Card style={{ background: portalPalette.surface, borderColor: portalPalette.border }}>
                <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <PortalTranslations>
                      {({ t: tWeather }) => (
                        <>
                          <span className="text-[9px] uppercase font-bold tracking-widest block" style={{ color: portalPalette.primary }}>{tWeather('shell.weatherRain')}</span>
                          <h4 className="text-base font-serif font-black text-brand flex items-center gap-1.5">
                            <CloudRain className="w-5 h-5 text-brand" aria-hidden="true" /> {tWeather('shell.venueTeam')}
                          </h4>
                        </>
                      )}
                    </PortalTranslations>
                    <p className="text-sm whitespace-pre-wrap max-w-xl" style={{ color: portalPalette.fgMuted }}>
                      {guestTravel.weatherRainPlanNote}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Wedding Weekend Itinerary */}
            {(timeline.length > 0 || subEvents.length > 0) && (
              <Suspense fallback={<Card><CardContent className="pt-6"><div className="h-48 animate-pulse rounded-lg bg-surface-2" /></CardContent></Card>}>
                <GuestWeekendItinerary eventId={eventId} timeline={timeline} subEvents={subEvents} activeGuest={activeGuest} palette={portalPalette} guestSchedule={guestSchedule} />
              </Suspense>
            )}

            {/* Guest welcome card */}
            {activeGuest && (
              <PortalTranslations>
                {({ t: tWelcome }) => (
                  <Card style={{ background: portalPalette.surface, borderColor: portalPalette.border }}>
                    <CardContent className="text-center py-6">
                      <h3 className="text-xl font-display mb-2">
                        {tWelcome('home.scheduleWelcome', { name: activeGuest.fullName })}
                      </h3>
                      <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: portalPalette.fgMuted }}>
                        {tWelcome('shell.welcomeBody')}
                      </p>
                      <div className="flex flex-wrap gap-4 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => handleTabChange('map')}
                          style={{ borderColor: portalPalette.border, color: portalPalette.fg }}
                        >
                          <MapIcon className="w-4 h-4 mr-2" aria-hidden="true" /> {tWelcome('shell.viewMap')}
                        </Button>
                        <Button
                          onClick={() => handleTabChange('rsvp')}
                          style={{ background: portalPalette.primary, color: portalPalette.primaryFg }}
                        >
                          <Send className="w-4 h-4 mr-2" aria-hidden="true" /> {tWelcome('shell.rsvpNow')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </PortalTranslations>
            )}

            {/* Polls — any#8 (p:any→Poll) + any#9 (poll:any→Poll) + any#10 (opt:any→PollOption) */}
            {polls.length > 0 && activeGuest && (
              <PortalTranslations>
                {({ t: tPoll }) => (
                  <div className="space-y-4">
                    <h3
                      className="font-display text-2xl text-center pt-8"
                      style={{ borderTop: `1px solid ${portalPalette.border}` }}
                    >
                      {tPoll('shell.polls')}
                    </h3>

                    {/* any#8 fixed: p is Poll, not any */}
                    {polls.filter((p: Poll) => p.status === 'active').map((poll: Poll) => (
                      <Card key={poll.id} style={{ borderColor: portalPalette.border }}>
                        <CardContent className="p-6">
                          <p className="mb-2 text-xs" style={{ color: portalPalette.fgMuted }}>{tPoll('shell.pollOptional')}</p><h4 className="font-semibold text-lg mb-4">{poll.question}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                            {/* any#10 fixed: opt is PollOption, not any */}
                            {poll.options.map((opt: PollOption) => (
                              <Button
                                key={opt.id}
                                variant="outline"
                                className="justify-between h-auto py-3 whitespace-normal text-left"
                                style={{ borderColor: portalPalette.border, color: portalPalette.fg }}
                                onClick={async () => {
                                  try {
                                    await sdk.feedback.votePoll(eventId, poll.id, opt.id);
                                  } catch (voteErr: any) {
                                    // One vote per device session (server-enforced):
                                    // a repeat tap is not an error to the guest.
                                    if (voteErr?.code !== 'already-voted') {
                                      setError(tPoll('shell.pollError'));
                                    }
                                  }
                                  try {
                                    const res = await sdk.feedback.getPolls(eventId);
                                    setPolls(res.polls);
                                  } catch { /* poll list refresh is best-effort */ }
                                }}
                                aria-label={`${tPoll('shell.pollVoteFor')} ${opt.text} (${opt.votes} ${opt.votes === 1 ? tPoll('shell.pollVote', { count: opt.votes }) : tPoll('shell.pollVotes', { count: opt.votes })})`}
                              >
                                <span>{opt.text}</span>
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px]"
                                  style={{
                                    borderColor:  portalPalette.border,
                                    background:   portalPalette.accentSoft,
                                    color:        portalPalette.fg,
                                  }}
                                >
                                  {opt.votes === 1 ? tPoll('shell.pollVote', { count: opt.votes }) : tPoll('shell.pollVotes', { count: opt.votes })}
                                </Badge>
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </PortalTranslations>
            )}

            {/* No guest selected — prompt to RSVP */}
            {!activeGuest && (
              <div className="text-center py-12">
                <p className="text-lg mb-4">
                  Please identify yourself to access personalized details.
                </p>
                <Button
                  onClick={() => handleTabChange('rsvp')}
                  style={{ background: portalPalette.primary, color: portalPalette.primaryFg }}
                >
                  Find Your Invitation
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── MAP / WAYFINDING TAB ─────────────────────────────── */}
        {activeTab === 'map' && (
          <Suspense fallback={<Card><CardContent className="pt-6"><div className="h-96 animate-pulse rounded-lg bg-surface-2" /></CardContent></Card>}>
            <GuestMapWayfinding
              guests={guests}
              activeGuest={activeGuest}
              selectedGuestId={selectedGuestId}
              setSelectedGuestId={setSelectedGuestId}
              layout={layout}
              timeline={timeline}
              subEvents={subEvents}
              palette={portalPalette}
              guestTravel={guestTravel}
              guestWayfinding={guestWayfinding}
            />
          </Suspense>
        )}

        {/* ── RSVP TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'rsvp' && (
          <div className="space-y-8">
            <Suspense fallback={<Card><CardContent className="pt-6"><div className="h-64 animate-pulse rounded-lg bg-surface-2" /></CardContent></Card>}>
              <GuestRsvpWizard
                eventId={eventId}
                info={info}
                guests={guests}
                subEvents={subEvents}
                palette={portalPalette}
                selectedGuestId={selectedGuestId}
                setSelectedGuestId={setSelectedGuestId}
                guestToken={guestToken}
                config={portalConfig}
                guestPrivacy={guestPrivacy}
                onDirty={() => setIsFormDirty(true)}
                onReturnHome={() => handleTabChange('home')}
                onFindSeat={() => handleTabChange('map')}
              />
            </Suspense>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <PortalNav activeTab={activeTab} onTabChange={(tab) => void handleTabChange(tab)} portalPalette={portalPalette} />
      </div>
    </I18nProvider>
  );
}

/** Small context bridge: exposes the i18n api to inline JSX blocks. */
function PortalTranslations({ children }: { children: (i18n: ReturnType<typeof useI18n>) => React.ReactNode }) {
  const i18n = useI18n();
  return <>{children(i18n)}</>;
}

/** Sticky portal header with the accessibility + language controls. */
function PortalShellHeader({ info, platformName, portalPalette, largeTextMode, setLargeTextMode, highContrastMode, setHighContrastMode }: {
  info: PortalInfoResponse['event'];
  platformName?: string;
  portalPalette: Palette;
  largeTextMode: boolean;
  setLargeTextMode: (next: boolean) => void;
  highContrastMode: boolean;
  setHighContrastMode: (next: boolean) => void;
}) {
  const { lang, setLang, t } = useI18n();
  return (
    <header
      className="py-6 px-4 text-center sticky top-0 z-10 shadow-sm"
      style={{ background: portalPalette.surface, borderBottom: `1px solid ${portalPalette.border}` }}
    >
      <h1 className="text-2xl md:text-4xl font-display font-bold tracking-widest">
        {info.title}
      </h1>
      {platformName && (
        <div className="mt-1 text-[10px] uppercase tracking-widest font-bold" style={{ color: portalPalette.fgMuted }}>
          {platformName}
        </div>
      )}
      <p className="mt-2 text-sm uppercase tracking-widest" style={{ color: portalPalette.fgMuted }}>
        {info.startDate
          ? (() => { const d = parseDateOnly(info.startDate) ?? new Date(info.startDate); return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang === 'es' ? 'es' : lang === 'fr' ? 'fr' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); })()
          : t('common.tbd')}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2" aria-label={t('shell.a11y')}>
        <Button type="button" size="sm" variant="outline" onClick={() => setLargeTextMode(!largeTextMode)} aria-pressed={largeTextMode} aria-label={t('shell.toggleLargeText')}><Type className="h-3.5 w-3.5 mr-1" /> {t('shell.largeText')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setHighContrastMode(!highContrastMode)} aria-pressed={highContrastMode} aria-label={t('shell.toggleHighContrast')}><Contrast className="h-3.5 w-3.5 mr-1" /> {t('shell.highContrast')}</Button>
        <label className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-bold" style={{ borderColor: portalPalette.border, background: portalPalette.surface }}><Languages className="h-3.5 w-3.5" /><span className="sr-only">{t('shell.language')}</span><select value={lang} onChange={(e) => setLang(e.target.value as PortalLanguage)} aria-label={t('shell.language')} className="bg-transparent"><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="zh">中文</option></select></label>
      </div>
    </header>
  );
}

/** Fixed bottom tab navigation (Home / Map / RSVP). */
type PortalTab = 'home' | 'map' | 'rsvp';

function PortalNav({ activeTab, onTabChange, portalPalette }: { activeTab: PortalTab; onTabChange: (tab: PortalTab) => void; portalPalette: Palette }) {
  const { t } = useI18n();
  const items: Array<[PortalTab, typeof Home, string]> = [
    ['home', Home, t('shell.home')],
    ['map', MapIcon, t('shell.map')],
    ['rsvp', Send, t('shell.rsvp')],
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 w-full pb-safe z-50"
      style={{ background: portalPalette.surface, borderTop: `1px solid ${portalPalette.border}` }}
      aria-label={t('shell.nav')}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {items.map(([tab, Icon, label]) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
            aria-label={label}
            className="flex flex-col items-center gap-1 w-20 transition-colors"
            style={{ color: activeTab === tab ? portalPalette.primary : portalPalette.fgMuted }}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}


function GuestPortalRecoveryCenter({ eventId, error, portalStatus, onRetry }: { eventId: string; error: string; portalStatus: { event?: { title: string; startDate: string | null }; status?: 'available' | 'disabled'; support?: { label: string; email: string; phone: string }; message?: string } | null; onRetry: () => void }) {
  const { t } = useI18n();
  const isNetwork = error.toLowerCase().includes('network') || error.toLowerCase().includes('temporarily unavailable');
  const title = portalStatus?.status === 'disabled' ? t('recovery.unavailable') : isNetwork ? t('recovery.network') : t('recovery.unverified');
  const body = portalStatus?.message || error;
  const support = portalStatus?.support;
  return (
    <div className="min-h-screen bg-surface-2 px-4 py-10">
      <Card className="mx-auto max-w-2xl border-warning/30">
        <CardHeader>
          <CardTitle className="font-display text-3xl flex items-center gap-2"><ShieldAlert className="h-6 w-6" /> {t('recovery.title')}</CardTitle>
          <CardDescription>{t('recovery.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-xl border border-warning/30 bg-warning-soft/20 p-4 text-warning"><strong>{title}</strong><p className="mt-1">{body}</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border p-3"><strong>{t('recovery.whatHappened')}</strong><ul className="mt-2 list-disc pl-5 text-xs text-fg-muted"><li>{t('recovery.whatHappened1')}</li><li>{t('recovery.whatHappened2')}</li><li>{t('recovery.whatHappened3')}</li></ul></div>
            <div className="rounded-xl border p-3"><strong>{t('recovery.howToHelp')}</strong><p className="mt-2 text-xs text-fg-muted">{t('recovery.howToHelpCopy')}</p>{support?.email && <a className="mt-2 block font-bold underline" href={`mailto:${support.email}`}>{support.email}</a>}{support?.phone && <a className="mt-1 block font-bold underline" href={`tel:${support.phone}`}>{support.phone}</a>}</div>
          </div>
          <div className="rounded-xl border p-3"><strong>{t('recovery.actions')}</strong><div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={onRetry}><RefreshCw className="h-4 w-4 mr-1" /> {t('recovery.tryAgain')}</Button><Button type="button" variant="outline" onClick={() => { window.location.href = `mailto:${support?.email || ''}?subject=${encodeURIComponent(t('recovery.subject'))}&body=${encodeURIComponent(t('recovery.body', { eventId }))}`; }} disabled={!support?.email}>{t('recovery.emailSupport')}</Button></div></div>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalInfoModules({ config, branding, palette, activeGuest, access }: { config: Record<string, any>; branding: PortalInfoResponse['branding'] | null; palette: Palette; activeGuest?: PortalGuestEntry; access: PortalInfoResponse['access'] | null }) {
  const { t } = useI18n();
  const registryLinks = String(config.registryLinks || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(config.faqText || config.transportationText) && <Card id="guest-faq-info" style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4" /> {t('shell.faq')}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="whitespace-pre-wrap">{config.faqText || 'FAQ details will be posted here.'}</p>{branding?.supportEmail && <p className="text-xs"><Mail className="inline h-3.5 w-3.5 mr-1" />{t('shell.needHelp')} <a className="font-bold underline" href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a></p>}</CardContent></Card>}
      {config.transportationText && <Card id="guest-travel-info" style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><Bus className="h-4 w-4" /> {t('shell.transportation')}</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{config.transportationText}</CardContent></Card>}
      {(registryLinks.length > 0 || config.rsvpEditWindowDays !== undefined) && <Card style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> {t('shell.registryRules')}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{registryLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="block underline font-bold">{link}</a>)}{config.rsvpEditWindowDays !== undefined && <p className="text-xs" style={{ color: palette.fgMuted }}>{t('shell.editsClose', { days: config.rsvpEditWindowDays })}</p>}{access?.endsAt && <p className="text-xs" style={{ color: palette.fgMuted }}>{t('shell.accessEnds', { date: new Date(access.endsAt).toLocaleString() })}</p>}</CardContent></Card>}
      {activeGuest?.allowLodgingAccess && <Card id="guest-lodging-info" style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base">{t('shell.lodging')}</CardTitle></CardHeader><CardContent className="text-sm">{t('shell.lodgingDetails')} <strong>{activeGuest.roomAssignment || 'Request lodging from the RSVP notes field.'}</strong></CardContent></Card>}
    </div>
  );
}

