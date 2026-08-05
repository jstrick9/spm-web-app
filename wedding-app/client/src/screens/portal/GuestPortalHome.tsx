import { useEffect, useMemo, useState } from 'react';
import { Accessibility, Bell, Bus, Camera, Clock, Download, Ear, Eye, Gift, HelpCircle, Images, Languages, LockKeyhole, Mail, MapPin, MessageCircle, QrCode, Search, Send, ShieldCheck, Smartphone, Star, Trash2, Umbrella, UserRoundCheck, ExternalLink } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { sdk } from '../../sdk';
import { formatDateOnly } from '../../lib/formatDate';
import type { PortalGuestEntry, PortalInfoResponse } from '../../sdk/portalTypes';

type Palette = {
  bg: string;
  surface: string;
  border: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  primary: string;
  primaryFg: string;
  primaryHover: string;
  accent: string;
  accentSoft: string;
};

type LookupMatch = { id: string; label: string; partyName: string | null; requiresSecureLink: boolean };
type ActiveTab = 'home' | 'map' | 'rsvp';

export function GuestPortalHome({
  eventId,
  info,
  guestHome,
  activeGuest,
  palette,
  guestToken,
  guestLanguage,
  setGuestLanguage,
  portalAccess,
  lookupQuery,
  setLookupQuery,
  lookupEmail,
  setLookupEmail,
  lookupGuest,
  lookupMessage,
  lookupResults,
  onSelectLookupGuest,
  resendSecureLink,
  requestGuestHelp,
  venueReplies,
  venueMessagesEmpty,
  setActiveTab,
  saveGuestEventDetails,
  config,
  branding,
  guestTravel,
  guestFaq,
  guestGifts,
  guestCare,
  guestPrivacy,
  guestReminders,
  guestDayOf,
  guestPostEvent,
}: {
  eventId: string;
  info: PortalInfoResponse['event'];
  guestHome: PortalInfoResponse['guestHome'] | null;
  activeGuest?: PortalGuestEntry;
  palette: Palette;
  guestToken: string;
  guestLanguage: string;
  setGuestLanguage: (value: string) => void;
  portalAccess: PortalInfoResponse['access'] | null;
  lookupQuery: string;
  setLookupQuery: (value: string) => void;
  lookupEmail: string;
  setLookupEmail: (value: string) => void;
  lookupGuest: () => void | Promise<void>;
  lookupMessage: string;
  lookupResults: LookupMatch[];
  onSelectLookupGuest: (match: LookupMatch) => void;
  resendSecureLink: () => void | Promise<void>;
  requestGuestHelp: (kind: 'cannot_find_name' | 'wrong_guest' | 'expired_or_revoked' | 'other') => void | Promise<void>;
  venueReplies: Array<{ id: string; body: string; channel: string; sentByLabel: string; createdAt: string }>;
  venueMessagesEmpty: string;
  setActiveTab: (tab: ActiveTab) => void;
  saveGuestEventDetails: () => void;
  config: Record<string, any>;
  branding: PortalInfoResponse['branding'] | null;
  guestTravel: PortalInfoResponse['guestTravel'] | null;
  guestFaq: PortalInfoResponse['guestFaq'] | null;
  guestGifts: PortalInfoResponse['guestGifts'] | null;
  guestCare: PortalInfoResponse['guestCare'] | null;
  guestPrivacy: PortalInfoResponse['guestPrivacy'] | null;
  guestReminders: PortalInfoResponse['guestReminders'] | null;
  guestDayOf: PortalInfoResponse['guestDayOf'] | null;
  guestPostEvent: PortalInfoResponse['guestPostEvent'] | null;
}) {
  return (
    <>
      <GuestEventDashboard
        info={info}
        guestHome={guestHome}
        activeGuest={activeGuest}
        palette={palette}
        setActiveTab={setActiveTab}
        saveGuestEventDetails={saveGuestEventDetails}
      />
      <GuestStartHere
        palette={palette}
        guestToken={guestToken}
        guestLanguage={guestLanguage}
        setGuestLanguage={setGuestLanguage}
        portalAccess={portalAccess}
        lookupQuery={lookupQuery}
        setLookupQuery={setLookupQuery}
        lookupEmail={lookupEmail}
        setLookupEmail={setLookupEmail}
        lookupGuest={lookupGuest}
        lookupMessage={lookupMessage}
        lookupResults={lookupResults}
        onSelectLookupGuest={onSelectLookupGuest}
        resendSecureLink={resendSecureLink}
        requestGuestHelp={requestGuestHelp}
      />
      <GuestVenueMessages palette={palette} replies={venueReplies} emptyState={venueMessagesEmpty} />
      <GuestMemoryPhotoSharing eventId={eventId} activeGuest={activeGuest} guestToken={guestToken} palette={palette} guestPostEvent={guestPostEvent} />
      <GuestEventDayMobileMode eventId={eventId} info={info} activeGuest={activeGuest} guestToken={guestToken} palette={palette} guestTravel={guestTravel} guestDayOf={guestDayOf} branding={branding} setActiveTab={setActiveTab} />
      <GuestReminderPreferences eventId={eventId} activeGuest={activeGuest} guestToken={guestToken} guestLanguage={guestLanguage} palette={palette} guestReminders={guestReminders} />
      <GuestPrivacyConsent eventId={eventId} activeGuest={activeGuest} guestToken={guestToken} palette={palette} guestPrivacy={guestPrivacy} />
      <GuestAccessibilityCareCenter eventId={eventId} activeGuest={activeGuest} guestToken={guestToken} palette={palette} guestCare={guestCare} guestTravel={guestTravel} guestLanguage={guestLanguage} />
      <GuestFaqEtiquette eventId={eventId} activeGuest={activeGuest} guestToken={guestToken} guestLanguage={guestLanguage} palette={palette} branding={branding} guestFaq={guestFaq} config={config} />
      <GuestTravelDirectionsCards eventId={eventId} config={config} branding={branding} palette={palette} activeGuest={activeGuest} guestTravel={guestTravel} guestGifts={guestGifts} />
    </>
  );
}

function GuestEventDashboard({ info, guestHome, activeGuest, palette, setActiveTab, saveGuestEventDetails }: {
  info: PortalInfoResponse['event'];
  guestHome: PortalInfoResponse['guestHome'] | null;
  activeGuest?: PortalGuestEntry;
  palette: Palette;
  setActiveTab: (tab: ActiveTab) => void;
  saveGuestEventDetails: () => void;
}) {
  return (
    <Card style={{ background: palette.surface, borderColor: palette.border }}>
      <CardHeader>
        <CardTitle className="font-display text-2xl">Guest Event Home</CardTitle>
        <CardDescription style={{ color: palette.fgMuted }}>Everything you need as a guest: RSVP, schedule, directions, lodging, FAQ, and contact help.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryTile label="Event type" value={String(guestHome?.eventType || info.eventType || 'wedding').replace(/_/g, ' ')} palette={palette} />
          <SummaryTile label="Date / time" value={info.startDate ? new Date(info.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'} palette={palette} />
          <SummaryTile label="Location" value={guestHome?.locationSummary || info.locationSummary || 'Venue details pending'} palette={palette} />
          <SummaryTile label="Last updated" value={guestHome?.lastUpdatedAt || info.lastUpdatedAt ? new Date((guestHome?.lastUpdatedAt || info.lastUpdatedAt)!).toLocaleDateString() : 'Recently'} palette={palette} />
        </div>
        {(guestHome?.rsvpDeadline || info.rsvpDeadline || guestHome?.editWindowDays !== null) && <div className="rounded-xl border border-warning/30 bg-warning-soft/20 p-3 text-warning"><strong>RSVP deadline:</strong> {formatDateOnly(guestHome?.rsvpDeadline || info.rsvpDeadline) || 'Check invitation'}{guestHome?.editWindowDays != null ? ` · Edits may close ${guestHome.editWindowDays} day(s) before the event.` : ''}</div>}
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Button type="button" aria-label="Open RSVP" onClick={() => setActiveTab('rsvp')}>RSVP</Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById('guest-schedule-info')?.scrollIntoView({ behavior: 'smooth' })}>Schedule</Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById('guest-travel-info')?.scrollIntoView({ behavior: 'smooth' })}>Directions</Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById('guest-lodging-info')?.scrollIntoView({ behavior: 'smooth' })}>Lodging</Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById('guest-faq-info')?.scrollIntoView({ behavior: 'smooth' })}>FAQ</Button>
          <Button type="button" variant="outline" onClick={saveGuestEventDetails}>Save details</Button>
        </div>
        {activeGuest && <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>Your personalized itinerary</strong><p style={{ color: palette.fgMuted }}>RSVP as {activeGuest.fullName}{activeGuest.tableAssignment ? ` · Table ${activeGuest.tableAssignment}` : ''}{activeGuest.seatAssignment ? ` · Seat ${activeGuest.seatAssignment}` : ''}{activeGuest.roomAssignment ? ` · Lodging ${activeGuest.roomAssignment}` : ''}.</p></div>}
        {(guestHome?.changeNotices || []).length > 0 && <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>What has changed?</strong><div className="mt-2 space-y-2">{(guestHome?.changeNotices || []).slice(0, 4).map((notice) => <div key={notice.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: palette.border }}><div className="font-bold">{notice.title}</div><p style={{ color: palette.fgMuted }}>{notice.body}</p><span style={{ color: palette.fgMuted }}>{new Date(notice.updatedAt).toLocaleString()}</span></div>)}</div></div>}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><span className="text-[10px] uppercase font-bold" style={{ color: palette.fgMuted }}>{label}</span><p className="font-bold">{value}</p></div>;
}

function GuestStartHere({ palette, guestToken, guestLanguage, setGuestLanguage, portalAccess, lookupQuery, setLookupQuery, lookupEmail, setLookupEmail, lookupGuest, lookupMessage, lookupResults, onSelectLookupGuest, resendSecureLink, requestGuestHelp }: {
  palette: Palette;
  guestToken: string;
  guestLanguage: string;
  setGuestLanguage: (value: string) => void;
  portalAccess: PortalInfoResponse['access'] | null;
  lookupQuery: string;
  setLookupQuery: (value: string) => void;
  lookupEmail: string;
  setLookupEmail: (value: string) => void;
  lookupGuest: () => void | Promise<void>;
  lookupMessage: string;
  lookupResults: LookupMatch[];
  onSelectLookupGuest: (match: LookupMatch) => void;
  resendSecureLink: () => void | Promise<void>;
  requestGuestHelp: (kind: 'cannot_find_name' | 'wrong_guest' | 'expired_or_revoked' | 'other') => void | Promise<void>;
}) {
  return (
    <Card style={{ background: palette.surface, borderColor: palette.border }}>
      <CardHeader>
        <CardTitle className="font-display text-2xl">Guest Welcome / Start Here</CardTitle>
        <CardDescription style={{ color: palette.fgMuted }}>This is the guest RSVP and event information portal — not the couple, planner, or venue staff login.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>1. RSVP securely</strong><p style={{ color: palette.fgMuted }}>Use your invitation link or look up your invitation safely.</p></div>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>2. Review details</strong><p style={{ color: palette.fgMuted }}>Schedule, directions, lodging, seating, FAQ, and registry info appear here when shared.</p></div>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>3. Get help</strong><p style={{ color: palette.fgMuted }}>If your name or link looks wrong, send a private help request.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Label className="text-xs uppercase tracking-wider">Language</Label><select value={guestLanguage} onChange={(e) => setGuestLanguage(e.target.value)} className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} aria-label="Guest portal language"><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="zh">中文</option></select>{guestToken ? <Badge variant="success">Secure invitation link</Badge> : <Badge variant="outline">Generic portal lookup</Badge>}</div>
        {lookupMessage && <p className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning">{lookupMessage}</p>}
        {!guestToken && !portalAccess?.endsAt && <p className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning">For privacy, guests should use their secure invitation link. Generic lookup is limited and may require a link resend.</p>}
        {!guestToken && <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>Find your invitation safely</strong><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)} placeholder="Your name" aria-label="Guest lookup name" /><Input value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} placeholder="Email for secure link" aria-label="Guest lookup email" /><Button type="button" onClick={() => lookupGuest()} disabled={lookupQuery.trim().length < 2}>Look up</Button></div>{lookupMessage && <p className="text-xs" style={{ color: palette.fgMuted }}>{lookupMessage}</p>}{lookupResults.length > 0 && <div className="space-y-1">{lookupResults.map((match) => <button key={match.id} type="button" className="block w-full rounded-lg border p-2 text-left text-xs" style={{ borderColor: palette.border, background: palette.surface }} onClick={() => onSelectLookupGuest(match)}>Possible match: <strong>{match.label}</strong>{match.partyName ? ` · ${match.partyName}` : ''} — secure link recommended</button>)}</div>}<div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => resendSecureLink()}>Request secure link</Button><Button type="button" size="sm" variant="ghost" onClick={() => requestGuestHelp('cannot_find_name')}>I cannot find my name</Button><Button type="button" size="sm" variant="ghost" onClick={() => requestGuestHelp('wrong_guest')}>This link is not me</Button></div></div>}
        {guestToken && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => requestGuestHelp('wrong_guest')}>This link is not me</Button><Button type="button" size="sm" variant="ghost" onClick={() => requestGuestHelp('expired_or_revoked')}>Link problem / need help</Button></div>}
      </CardContent>
    </Card>
  );
}

function GuestVenueMessages({ palette, replies, emptyState }: { palette: Palette; replies: Array<{ id: string; body: string; channel: string; sentByLabel: string; createdAt: string }>; emptyState: string }) {
  return <Card style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="font-display text-xl">Messages from venue</CardTitle><CardDescription style={{ color: palette.fgMuted }}>Replies to your guest help requests and invitation-link questions appear here when you use your secure guest link.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{replies.length ? replies.slice(0, 5).map((reply) => <div key={reply.id} className="rounded-lg border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{reply.sentByLabel || 'Venue team'}</strong><Badge variant="outline">{reply.channel}</Badge></div><p className="mt-1 whitespace-pre-wrap">{reply.body}</p><p className="mt-1 text-xs" style={{ color: palette.fgMuted }}>{new Date(reply.createdAt).toLocaleString()}</p></div>) : <p className="rounded-lg border border-dashed p-3 text-sm" style={{ borderColor: palette.border, color: palette.fgMuted }}>{emptyState}</p>}</CardContent></Card>;
}







export function GuestMemoryPhotoSharing({ eventId, activeGuest, guestToken, palette, guestPostEvent }: { eventId: string; activeGuest?: PortalGuestEntry; guestToken: string; palette: Palette; guestPostEvent: PortalInfoResponse['guestPostEvent'] | null }) {
  const post = guestPostEvent || { enabled: true, afterEvent: false, thankYouTitle: 'Thank you for celebrating with us', thankYouMessage: 'We are grateful you joined the celebration.', links: [], uploadEnabled: true, moderationCopy: 'Guest-submitted photos/links are reviewed before sharing.', consentCopy: 'By submitting a photo/link, you confirm you have permission to share it and understand it may be reviewed before publication.', feedbackEnabled: true, npsQuestion: 'How likely are you to recommend this venue guest experience to another guest?' };
  const [photoUrl, setPhotoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('');
  const [score, setScore] = useState(10);
  const [comment, setComment] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const submitPhoto = async () => {
    if (!photoConsent) return setPhotoStatus('Please confirm photo sharing consent before submitting.');
    if (!photoUrl.trim() && !caption.trim()) return setPhotoStatus('Add a photo/gallery link or a memory caption before submitting.');
    try { const res = await sdk.portal.submitMemory(eventId, { guestId: activeGuest?.id, token: guestToken || undefined, name: activeGuest?.fullName, photoUrl: photoUrl || undefined, caption, consent: photoConsent }); setPhotoStatus(res.message); setPhotoUrl(''); setCaption(''); setPhotoConsent(false); }
    catch { setPhotoStatus('Could not submit that memory/photo link. Please try again.'); }
  };
  const submitFeedback = async () => {
    try { const res = await sdk.portal.submitGuestFeedback(eventId, { guestId: activeGuest?.id, token: guestToken || undefined, name: activeGuest?.fullName, npsScore: score, comment, consentToContact: contactConsent }); setFeedbackStatus(res.message); setComment(''); }
    catch { setFeedbackStatus('Could not submit feedback. Please try again.'); }
  };
  if (!post.enabled) return null;
  return <Card id="guest-memory-photo-sharing" style={{ background: palette.surface, borderColor: palette.border }} aria-label="Guest Memory and Photo Sharing"><CardHeader><CardTitle className="font-display text-2xl flex items-center gap-2"><Images className="h-5 w-5" /> Guest Memories, Photos & Feedback</CardTitle><CardDescription>{post.afterEvent ? post.thankYouMessage : 'After the event, gallery and memory sharing details will appear here when enabled.'}</CardDescription></CardHeader><CardContent className="space-y-4 text-sm"><div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>{post.thankYouTitle}</strong><p className="mt-1" style={{ color: palette.fgMuted }}>{post.thankYouMessage}</p></div>{post.galleryDocuments && post.galleryDocuments.length > 0 && <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong className="flex items-center gap-2"><Images className="h-4 w-4" /> Photos from your day</strong><p className="mt-1 text-xs" style={{ color: palette.fgMuted }}>Approved photos shared by the couple and venue.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{post.galleryDocuments.map((doc) => <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer noopener" className="rounded-xl border p-3 font-bold underline" style={{ borderColor: palette.border }}><ExternalLink className="inline h-4 w-4 mr-1" />{doc.filename}{doc.notes ? <span className="block mt-1 text-xs font-normal no-underline" style={{ color: palette.fgMuted }}>{doc.notes}</span> : null}</a>)}</div></div>}
{post.links.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{post.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer noopener" className="rounded-xl border p-3 font-bold underline" style={{ borderColor: palette.border }}><ExternalLink className="inline h-4 w-4 mr-1" />{link.label}{link.description && <p className="mt-1 text-xs font-normal no-underline" style={{ color: palette.fgMuted }}>{link.description}</p>}</a>)}</div>}{post.uploadEnabled && <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: palette.border }}><strong className="flex items-center gap-2"><Camera className="h-4 w-4" /> Share a memory or photo link</strong><p className="text-xs" style={{ color: palette.fgMuted }}>{post.moderationCopy}</p><Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo/gallery link (Google Photos, iCloud, Dropbox, etc.)" aria-label="Guest photo link" /><textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-20 w-full rounded-md border p-2" style={{ borderColor: palette.border, background: palette.surface }} placeholder="Memory caption or note" aria-label="Guest memory caption" /><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} /> {post.consentCopy}</label><div className="flex gap-2 items-center"><Button type="button" onClick={submitPhoto}>Submit for review</Button>{photoStatus && <span className="text-xs" style={{ color: palette.fgMuted }}>{photoStatus}</span>}</div></div>}{post.feedbackEnabled && <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: palette.border }}><strong className="flex items-center gap-2"><Star className="h-4 w-4" /> Guest post-event feedback</strong><label className="text-sm">{post.npsQuestion}<Input type="number" min="0" max="10" value={score} onChange={(e) => setScore(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} aria-label="Guest NPS score" /></label><textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-20 w-full rounded-md border p-2" style={{ borderColor: palette.border, background: palette.surface }} placeholder="Optional: what worked well or what would improve the guest experience?" aria-label="Guest post-event feedback comment" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contactConsent} onChange={(e) => setContactConsent(e.target.checked)} /> Venue/couple may contact me about this feedback.</label><div className="flex gap-2 items-center"><Button type="button" onClick={submitFeedback}>Submit feedback</Button>{feedbackStatus && <span className="text-xs" style={{ color: palette.fgMuted }}>{feedbackStatus}</span>}</div></div>}</CardContent></Card>;
}

function GuestEventDayMobileMode({ eventId, info, activeGuest, guestToken, palette, guestTravel, guestDayOf, branding, setActiveTab }: { eventId: string; info: PortalInfoResponse['event']; activeGuest?: PortalGuestEntry; guestToken: string; palette: Palette; guestTravel: PortalInfoResponse['guestTravel'] | null; guestDayOf: PortalInfoResponse['guestDayOf'] | null; branding: PortalInfoResponse['branding'] | null; setActiveTab: (tab: ActiveTab) => void }) {
  const dayOf = guestDayOf || { enabled: true, title: 'Wedding day quick card', contactLabel: 'venue/couple team', contactPhone: '', contactEmail: branding?.supportEmail || '', offlinePassUrl: `/api/portal/${eventId}/guest-pass.txt`, staffHelpUrl: '', qrPayload: `WVI-GUEST-HELP:${eventId}:${activeGuest?.id || 'anonymous'}`, pushAvailable: true, pushCopy: 'Allow browser notifications for rain-plan or shuttle changes on event day.' };
  const [status, setStatus] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const sendHelp = async (kind: 'running_late' | 'need_help') => {
    try {
      const res = await sdk.portal.dayOfHelp(eventId, { guestId: activeGuest?.id, token: guestToken || undefined, kind, name: activeGuest?.fullName, email: undefined, message: kind === 'running_late' ? 'Guest tapped running late from event-day mode.' : 'Guest tapped need help from event-day mode.' });
      setStatus(res.message);
    } catch { setStatus('Could not send that quick action. Please use the contact details below.'); }
  };
  const enablePush = async () => {
    if (typeof Notification === 'undefined') return setPushStatus('Browser notifications are not available on this device.');
    const permission = await Notification.requestPermission();
    setPushStatus(permission === 'granted' ? 'Browser notifications enabled for this device.' : 'Browser notifications were not enabled.');
  };
  return (
    <Card id="guest-event-day-mobile-mode" style={{ background: palette.surface, borderColor: palette.border }} aria-label="Guest Event-Day Mobile Mode">
      <CardHeader><CardTitle className="font-display text-2xl flex items-center gap-2"><Smartphone className="h-5 w-5" /> Guest Event-Day Mobile Mode</CardTitle><CardDescription>{dayOf.title}: compact details for arrival, seating, shuttle, help, and offline access.</CardDescription></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <DayOfTile label="Address" value={guestTravel?.venueAddress || info.locationSummary || 'Address pending'} palette={palette} />
          <DayOfTile label="Schedule" value={info.startDate ? new Date(info.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Schedule pending'} palette={palette} />
          <DayOfTile label="Table / seat" value={activeGuest?.tableAssignment ? `${activeGuest.tableAssignment}${activeGuest.seatAssignment ? ` · Seat ${activeGuest.seatAssignment}` : ''}` : 'Seat not assigned yet'} palette={palette} />
          <DayOfTile label="Shuttle" value={guestTravel?.shuttleSchedule || 'Shuttle details pending'} palette={palette} />
          <DayOfTile label="Contact" value={[dayOf.contactLabel, dayOf.contactPhone || dayOf.contactEmail].filter(Boolean).join(' · ') || 'Contact pending'} palette={palette} />
          <button type="button" className="rounded-xl border p-3 text-left" style={{ borderColor: palette.border }} onClick={() => document.getElementById('guest-faq-info')?.scrollIntoView({ behavior: 'smooth' })}><div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>FAQ</div><p className="mt-1 font-semibold">Open guest FAQ</p></button>
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => sendHelp('running_late')}>Running late</Button><Button type="button" variant="outline" onClick={() => sendHelp('need_help')}>Need help</Button><Button type="button" variant="outline" onClick={() => setActiveTab('map')}>Find map/table</Button><Button asChild type="button" variant="outline"><a href={dayOf.offlinePassUrl} download><Download className="h-4 w-4 mr-1" /> Offline guest pass</a></Button></div>
        <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong className="flex items-center gap-2"><Bell className="h-4 w-4" /> Rain-plan / shuttle browser notifications</strong><p className="mt-1 text-xs" style={{ color: palette.fgMuted }}>{dayOf.pushCopy}</p><div className="mt-2 flex flex-wrap gap-2 items-center"><Button type="button" size="sm" variant="outline" onClick={enablePush}>Enable browser notifications</Button>{pushStatus && <span className="text-xs" style={{ color: palette.fgMuted }}>{pushStatus}</span>}</div></div>
        <div className="grid gap-3 md:grid-cols-[10rem_1fr] items-center rounded-xl border p-3" style={{ borderColor: palette.border }}><div className="flex flex-col items-center gap-1"><QrCode className="h-4 w-4" /><StaffHelpQr payload={dayOf.qrPayload} /></div><div><strong>Staff help QR</strong><p className="mt-1 text-xs" style={{ color: palette.fgMuted }}>Show this code to venue staff so they can help find your RSVP/table without browsing the guest list aloud.</p><code className="mt-2 block break-all rounded bg-black/5 p-2 text-xs">{dayOf.qrPayload}</code></div></div>
        {status && <p className="rounded-lg border p-2 text-xs" style={{ borderColor: palette.border, color: palette.fgMuted }}>{status}</p>}
      </CardContent>
    </Card>
  );
}

function DayOfTile({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>{label}</div><p className="mt-1 font-semibold">{value}</p></div>;
}

function StaffHelpQr({ payload }: { payload: string }) {
  // REAL QR encoding (was a decorative pseudo-pattern that no scanner
  // could read, despite the UI claiming staff can scan it to find the
  // guest's RSVP/table). Uses the same QR library semantics as any
  // standard reader; the plain-text payload stays visible as a fallback.
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('qrcode').then((QRCode) => {
      // SVG-string output — no canvas dependency, works in every browser
      // and in test environments.
      QRCode.toString(payload, { type: 'svg', width: 320, margin: 1 })
        .then((svg: string) => {
          if (cancelled) return;
          setDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
        })
        .catch(() => { /* leave fallback text visible */ });
    });
    return () => { cancelled = true; };
  }, [payload]);
  if (!dataUrl) {
    return <div className="h-32 w-32 rounded bg-white p-1 flex items-center justify-center text-[10px] text-fg-muted">Generating QR…</div>;
  }
  return <img src={dataUrl} alt="Venue staff help QR code" className="h-32 w-32 rounded bg-white p-1" />;
}

function GuestReminderPreferences({ eventId, activeGuest, guestToken, guestLanguage, palette, guestReminders }: { eventId: string; activeGuest?: PortalGuestEntry; guestToken: string; guestLanguage: string; palette: Palette; guestReminders: PortalInfoResponse['guestReminders'] | null }) {
  const defaults = guestReminders || { providers: { emailConnected: false, smsConnected: false }, defaults: { rsvpReminderEnabled: true, scheduleReminderEnabled: true, rainPlanReminderEnabled: true, shuttleReminderEnabled: true, dayBeforeReminderEnabled: true, dayOfReminderEnabled: true, guestFriendlyCopy: 'We will only send helpful guest reminders such as RSVP deadlines, schedule updates, rain-plan changes, directions, shuttle times, and day-of arrival details.' }, preferences: { emailOptIn: false, smsOptIn: false, confirmationPreference: 'email' as const, reminderTypes: ['rsvp','schedule','rain_plan','shuttle'], quietHoursStart: '21:00', quietHoursEnd: '08:00', language: guestLanguage || 'en' }, actions: { scheduleAvailable: true, directionsAvailable: true, preferencesUrl: '' } };
  const [emailOptIn, setEmailOptIn] = useState(defaults.preferences.emailOptIn);
  const [smsOptIn, setSmsOptIn] = useState(defaults.preferences.smsOptIn);
  const [confirmationPreference, setConfirmationPreference] = useState<'email' | 'sms' | 'both' | 'none'>(defaults.preferences.confirmationPreference);
  const [quietHoursStart, setQuietHoursStart] = useState(defaults.preferences.quietHoursStart);
  const [quietHoursEnd, setQuietHoursEnd] = useState(defaults.preferences.quietHoursEnd);
  const [language, setLanguage] = useState(defaults.preferences.language || guestLanguage || 'en');
  const [reminderTypes, setReminderTypes] = useState<string[]>(defaults.preferences.reminderTypes || []);
  const [status, setStatus] = useState('');
  const toggle = (type: string) => setReminderTypes((items) => items.includes(type) ? items.filter((item) => item !== type) : [...items, type]);
  const save = async (sendInfo?: 'schedule' | 'directions') => {
    if (!activeGuest?.id || !guestToken) return setStatus('Use your secure invitation link to save reminder preferences.');
    try {
      const res = await sdk.portal.saveReminderPreferences(eventId, { guestId: activeGuest.id, token: guestToken, emailOptIn, smsOptIn, confirmationPreference, reminderTypes: reminderTypes as any, quietHoursStart, quietHoursEnd, language, sendInfo });
      setStatus(`${res.message} ${res.dispatchStatus ? `(${res.dispatchStatus})` : ''}`.trim());
    } catch { setStatus('Could not save reminder preferences. Please try again from your secure invitation link.'); }
  };
  const options = [
    ['rsvp', 'RSVP deadline'], ['schedule', 'Schedule updates'], ['rain_plan', 'Rain-plan changes'], ['shuttle', 'Shuttle reminders'], ['directions', 'Directions'], ['day_before', 'Day-before reminder'], ['day_of', 'Day-of reminder'],
  ];
  return <Card id="guest-reminder-preferences-info" style={{ background: palette.surface, borderColor: palette.border }} aria-label="Guest Reminder Preferences"><CardHeader><CardTitle className="font-display text-2xl flex items-center gap-2"><Bell className="h-5 w-5" /> Guest Reminder Preferences</CardTitle><CardDescription>{defaults.defaults.guestFriendlyCopy}</CardDescription></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>Available channels</strong><p className="mt-1">Email provider: {defaults.providers.emailConnected ? 'Connected' : 'Not connected yet'}</p><p>SMS provider: {defaults.providers.smsConnected ? 'Connected' : 'Not connected yet'}</p></div><div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong className="flex items-center gap-2"><Clock className="h-4 w-4" /> Quiet hours</strong><div className="mt-2 grid grid-cols-2 gap-2"><Input value={quietHoursStart} onChange={(e) => setQuietHoursStart(e.target.value)} aria-label="Reminder quiet hours start" placeholder="21:00" /><Input value={quietHoursEnd} onChange={(e) => setQuietHoursEnd(e.target.value)} aria-label="Reminder quiet hours end" placeholder="08:00" /></div></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className="flex items-start gap-2 rounded-lg border p-2" style={{ borderColor: palette.border }}><input type="checkbox" checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)} /> Email reminders</label><label className="flex items-start gap-2 rounded-lg border p-2" style={{ borderColor: palette.border }}><input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} /> SMS/text reminders</label><label className="text-sm">Preferred channel<select value={confirmationPreference} onChange={(e) => setConfirmationPreference(e.target.value as any)} className="mt-1 h-10 w-full rounded-md border px-2" style={{ borderColor: palette.border, background: palette.surface }} aria-label="Reminder channel preference"><option value="email">Email</option><option value="sms">SMS</option><option value="both">Both</option><option value="none">None</option></select></label><label className="text-sm">Language<select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 h-10 w-full rounded-md border px-2" style={{ borderColor: palette.border, background: palette.surface }} aria-label="Reminder language preference"><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="zh">中文</option></select></label></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{options.map(([type, label]) => <label key={type} className="flex items-start gap-2 rounded-lg border p-2" style={{ borderColor: palette.border }}><input type="checkbox" checked={reminderTypes.includes(type)} onChange={() => toggle(type)} /> {label}</label>)}</div><div className="flex flex-wrap gap-2 items-center"><Button type="button" onClick={() => save()}>Save reminder preferences</Button><Button type="button" variant="outline" onClick={() => save('schedule')}><Send className="h-4 w-4 mr-1" /> Send me the schedule</Button><Button type="button" variant="outline" onClick={() => save('directions')}><Send className="h-4 w-4 mr-1" /> Send me directions</Button>{status && <span className="text-xs" style={{ color: palette.fgMuted }}>{status}</span>}</div></CardContent></Card>;
}

function GuestPrivacyConsent({ eventId, activeGuest, guestToken, palette, guestPrivacy }: { eventId: string; activeGuest?: PortalGuestEntry; guestToken: string; palette: Palette; guestPrivacy: PortalInfoResponse['guestPrivacy'] | null }) {
  const privacy = guestPrivacy || { summary: 'Your RSVP details are used only to plan and host this event.', visibility: { rsvp: 'Attendance is visible to the couple and venue team.', meal: 'Meal details are shared with catering as needed.', allergy: 'Allergy details are shared only for guest safety.', accessibility: 'Accessibility requests are shared with the team coordinating support.', lodging: 'Lodging details are shared only when needed.', notes: 'Private notes are visible to authorized event contacts.' }, consent: { emailReminderLabel: 'I agree to receive event email reminders.', smsReminderLabel: 'I agree to receive event SMS/text reminders.' }, retention: 'Guest records are retained according to venue policy.', correctionDeletion: { enabled: true, contactLabel: 'venue/couple privacy contact', contactEmail: '' }, antiAbuse: 'Use your secure invitation link and do not share guest portal links publicly.', access: { mode: 'lookup_required', tokenStatus: 'missing', guestDirectoryExposed: false, privateWeddingDefault: true } };
  const [requestType, setRequestType] = useState<'update_contact' | 'delete_contact' | 'data_question' | 'consent_change'>('update_contact');
  const [name, setName] = useState(activeGuest?.fullName || '');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const send = async () => {
    if (message.trim().length < 3) return setStatus('Please describe what you want updated or deleted.');
    try {
      const res = await sdk.portal.requestPrivacy(eventId, { guestId: activeGuest?.id, token: guestToken || undefined, name: name || activeGuest?.fullName, email: email || undefined, requestType, message: message.trim() });
      setStatus(res.message || 'Your privacy/data request was sent.');
      setMessage('');
    } catch { setStatus('We could not send that privacy request. Please try again or contact the venue/couple.'); }
  };
  return (
    <Card id="guest-privacy-consent-info" style={{ background: palette.surface, borderColor: palette.border }} aria-label="Guest Privacy and Consent">
      <CardHeader><CardTitle className="font-display text-2xl flex items-center gap-2"><LockKeyhole className="h-5 w-5" /> Guest Privacy & Consent</CardTitle><CardDescription>{privacy.summary}</CardDescription></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: privacy.access.privateWeddingDefault ? palette.accentSoft : palette.surface }}><strong>Guest-list privacy:</strong> {privacy.access.privateWeddingDefault ? 'Private wedding mode is on by default — broad guest-list browsing is not exposed unless the venue explicitly enables it.' : 'This portal may expose a limited guest directory because the venue enabled generic lookup.'}<p className="mt-1 text-xs" style={{ color: palette.fgMuted }}>Link status: {privacy.access.tokenStatus}. {privacy.antiAbuse}</p></div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <PrivacyTile label="RSVP" value={privacy.visibility.rsvp} palette={palette} />
          <PrivacyTile label="Meal" value={privacy.visibility.meal} palette={palette} />
          <PrivacyTile label="Allergy" value={privacy.visibility.allergy} palette={palette} />
          <PrivacyTile label="Accessibility" value={privacy.visibility.accessibility} palette={palette} />
          <PrivacyTile label="Lodging" value={privacy.visibility.lodging} palette={palette} />
          <PrivacyTile label="Notes" value={privacy.visibility.notes} palette={palette} />
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>Data retention</strong><p className="mt-1" style={{ color: palette.fgMuted }}>{privacy.retention}</p></div>
        {privacy.correctionDeletion.enabled && <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete/update my contact info</strong><p className="text-xs" style={{ color: palette.fgMuted }}>Requests route to the {privacy.correctionDeletion.contactLabel}. This does not remove records the venue must retain for legal, accounting, safety, or event operations.</p><div className="grid gap-2 sm:grid-cols-3"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for follow-up" /><select className="h-10 rounded-md border px-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} value={requestType} onChange={(e) => setRequestType(e.target.value as typeof requestType)} aria-label="Privacy request type"><option value="update_contact">Update contact info</option><option value="delete_contact">Delete contact info</option><option value="consent_change">Change reminder consent</option><option value="data_question">Data/privacy question</option></select></div><textarea className="min-h-20 w-full rounded-md border p-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what contact info should be updated/deleted or what privacy question you have." aria-label="Privacy request message" /><div className="flex flex-wrap gap-2 items-center"><Button type="button" onClick={send}>Send privacy request</Button>{privacy.correctionDeletion.contactEmail && <a className="text-xs font-bold underline" href={`mailto:${privacy.correctionDeletion.contactEmail}`}>Email privacy contact</a>}{status && <span className="text-xs" style={{ color: palette.fgMuted }}>{status}</span>}</div></div>}
      </CardContent>
    </Card>
  );
}

function PrivacyTile({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>{label}</div><p className="mt-1">{value}</p></div>;
}

function GuestAccessibilityCareCenter({ eventId, activeGuest, guestToken, palette, guestCare, guestTravel, guestLanguage }: { eventId: string; activeGuest?: PortalGuestEntry; guestToken: string; palette: Palette; guestCare: PortalInfoResponse['guestCare'] | null; guestTravel: PortalInfoResponse['guestTravel'] | null; guestLanguage: string }) {
  const care = guestCare || { contact: { label: 'venue accessibility contact', email: '', phone: '', helpText: 'Share accessibility and care needs so the venue can prepare before arrival.' }, details: { accessibleParking: guestTravel?.accessibleParking || '', accessibleEntrance: '', accessibleRestroom: '', accessibleSeating: '', accessibleRoute: '', mobilityDropoff: guestTravel?.mobilityDropoff || '' }, requestTypes: [], portalPreferences: { largeText: true, highContrast: true, languageSelector: true } };
  const [name, setName] = useState(activeGuest?.fullName || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobility, setMobility] = useState('');
  const [seating, setSeating] = useState('');
  const [sensory, setSensory] = useState('');
  const [interpretationLanguage, setInterpretationLanguage] = useState('');
  const [serviceAnimal, setServiceAnimal] = useState('');
  const [dietaryAllergy, setDietaryAllergy] = useState('');
  const [caregiver, setCaregiver] = useState('');
  const [contactPreference, setContactPreference] = useState<'email' | 'phone' | 'text' | 'in_app'>('email');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');

  const submit = async () => {
    if (![mobility, seating, sensory, interpretationLanguage, serviceAnimal, dietaryAllergy, caregiver, notes].some((v) => v.trim())) {
      setStatus('Please tell us what accessibility or care support would help.');
      return;
    }
    try {
      const res = await sdk.portal.requestAccessibility(eventId, { guestId: activeGuest?.id, token: guestToken || undefined, name: name || activeGuest?.fullName, email: email || undefined, phone: phone || undefined, mobility, seating, sensory, interpretationLanguage, serviceAnimal, dietaryAllergy, caregiver, contactPreference, notes });
      setStatus(res.message || 'Your accessibility and care request was sent.');
      setMobility(''); setSeating(''); setSensory(''); setInterpretationLanguage(''); setServiceAnimal(''); setDietaryAllergy(''); setCaregiver(''); setNotes('');
    } catch {
      setStatus('We could not send that accessibility request. Please try again or use the accessibility contact.');
    }
  };

  return (
    <Card id="guest-accessibility-care-info" style={{ background: palette.surface, borderColor: palette.border }} aria-label="Guest Accessibility and Care Center">
      <CardHeader>
        <CardTitle className="font-display text-2xl flex items-center gap-2"><Accessibility className="h-5 w-5" /> Guest Accessibility & Care Center</CardTitle>
        <CardDescription>{care.contact.helpText}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <CareDetail label="Accessible parking" value={care.details.accessibleParking || guestTravel?.accessibleParking} palette={palette} />
          <CareDetail label="Accessible entrance" value={care.details.accessibleEntrance} palette={palette} />
          <CareDetail label="Accessible restroom" value={care.details.accessibleRestroom} palette={palette} />
          <CareDetail label="Accessible seating" value={care.details.accessibleSeating} palette={palette} />
          <CareDetail label="Accessible route" value={care.details.accessibleRoute} palette={palette} />
          <CareDetail label="Mobility drop-off" value={care.details.mobilityDropoff || guestTravel?.mobilityDropoff} palette={palette} />
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}>
          <strong className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Accessibility contact</strong>
          <p className="mt-1">Questions and requests route to the {care.contact.label}.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">{care.contact.email && <a className="font-bold underline" href={`mailto:${care.contact.email}`}>{care.contact.email}</a>}{care.contact.phone && <a className="font-bold underline" href={`tel:${care.contact.phone}`}>{care.contact.phone}</a>}</div>
        </div>
        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: palette.border }}>
          <div className="grid gap-2 sm:grid-cols-3"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Accessibility request name" /><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for follow-up" aria-label="Accessibility request email" /><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone / text number" aria-label="Accessibility request phone" /></div>
          <div className="grid gap-2 md:grid-cols-2">
            <CareTextarea icon={<Accessibility className="h-4 w-4" />} label="Mobility needs" value={mobility} setValue={setMobility} placeholder="Wheelchair, walker, uneven ground, drop-off help..." />
            <CareTextarea icon={<UserRoundCheck className="h-4 w-4" />} label="Seating needs" value={seating} setValue={setSeating} placeholder="Aisle seat, companion seating, closer seating, shade..." />
            <CareTextarea icon={<Ear className="h-4 w-4" />} label="Sensory needs" value={sensory} setValue={setSensory} placeholder="Quiet area, lower stimulation, hearing/visual support..." />
            <CareTextarea icon={<Languages className="h-4 w-4" />} label="Interpretation / language" value={interpretationLanguage} setValue={setInterpretationLanguage} placeholder={`Preferred language, interpreter request, current shell: ${guestLanguage}`} />
            <CareTextarea icon={<Eye className="h-4 w-4" />} label="Service animal" value={serviceAnimal} setValue={setServiceAnimal} placeholder="Service animal access, relief area, seating space..." />
            <CareTextarea icon={<Umbrella className="h-4 w-4" />} label="Dietary / allergy care" value={dietaryAllergy} setValue={setDietaryAllergy} placeholder="Allergy severity, cross-contact, meal coordination..." />
            <CareTextarea icon={<UserRoundCheck className="h-4 w-4" />} label="Caregiver / attendant" value={caregiver} setValue={setCaregiver} placeholder="Caregiver attendance, seating, arrival support..." />
            <CareTextarea icon={<MessageCircle className="h-4 w-4" />} label="Anything else" value={notes} setValue={setNotes} placeholder="Private care note for venue/couple team..." />
          </div>
          <div className="flex flex-wrap items-center gap-2"><Label className="text-xs font-bold uppercase">Preferred follow-up</Label><select value={contactPreference} onChange={(e) => setContactPreference(e.target.value as typeof contactPreference)} className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} aria-label="Accessibility request contact preference"><option value="email">Email</option><option value="phone">Phone</option><option value="text">Text</option><option value="in_app">Portal message</option></select><Button type="button" onClick={submit}>Send accessibility request</Button>{status && <span className="text-xs" style={{ color: palette.fgMuted }}>{status}</span>}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CareDetail({ label, value, palette }: { label: string; value?: string; palette: Palette }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>{label}</div><p className="mt-1">{value || 'Details pending.'}</p></div>;
}

function CareTextarea({ icon, label, value, setValue, placeholder }: { icon: React.ReactNode; label: string; value: string; setValue: (value: string) => void; placeholder: string }) {
  return <label className="block text-xs font-bold"><span className="mb-1 flex items-center gap-1">{icon}{label}</span><textarea className="min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm font-normal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={label} /></label>;
}

function GuestFaqEtiquette({ eventId, activeGuest, guestToken, guestLanguage, palette, branding, guestFaq, config }: { eventId: string; activeGuest?: PortalGuestEntry; guestToken: string; guestLanguage: string; palette: Palette; branding: PortalInfoResponse['branding'] | null; guestFaq: PortalInfoResponse['guestFaq'] | null; config: Record<string, any> }) {
  const fallbackFaq = guestFaq || {
    dressCode: { summary: String(config.dressCodeSummary || config.dressCode || 'Dress code details have not been posted yet.'), examples: String(config.dressCodeExamples || ''), weather: String(config.dressCodeWeather || ''), rainPlan: String(config.dressCodeRainPlan || config.weatherRainPlanNote || '') },
    policies: { kidsPolicy: String(config.kidsPolicy || 'Kids policy has not been posted yet.'), plusOneRules: String(config.plusOneRules || 'Please only bring guests listed on your invitation.'), phonePhotoPolicy: String(config.phonePhotoPolicy || 'Ceremony phone/photo policy has not been posted yet.'), smokingVapingPolicy: String(config.smokingVapingPolicy || 'Smoking/vaping policy has not been posted yet.'), barAlcoholPolicy: String(config.barAlcoholPolicy || 'Bar/alcohol policy has not been posted yet.') },
    categories: ['Dress code', 'Arrival', 'Kids & plus-ones', 'Ceremony', 'Reception'],
    items: [],
    multilingual: { availableLanguages: [{ code: 'en', label: 'English' }] },
    askQuestion: { enabled: true, contactLabel: 'venue/couple team' },
  };
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [language, setLanguage] = useState(guestLanguage || fallbackFaq.multilingual.availableLanguages[0]?.code || 'en');
  const [questionCategory, setQuestionCategory] = useState(fallbackFaq.categories[0] || 'General');
  const [questionName, setQuestionName] = useState(activeGuest?.fullName || '');
  const [questionEmail, setQuestionEmail] = useState('');
  const [questionBody, setQuestionBody] = useState('');
  const [questionStatus, setQuestionStatus] = useState('');

  const faqItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fallbackFaq.items.filter((item) => {
      const translation = item.translations?.[language];
      const question = translation?.question || item.question;
      const answer = translation?.answer || item.answer;
      const categoryOk = category === 'All' || item.category === category;
      const queryOk = !q || `${question} ${answer} ${item.category}`.toLowerCase().includes(q);
      return categoryOk && queryOk;
    });
  }, [fallbackFaq.items, query, category, language]);

  const submitQuestion = async () => {
    if (questionBody.trim().length < 3) {
      setQuestionStatus('Please enter your question before sending.');
      return;
    }
    try {
      const res = await sdk.portal.askQuestion(eventId, { guestId: activeGuest?.id, token: guestToken || undefined, name: questionName || activeGuest?.fullName, email: questionEmail || undefined, category: questionCategory, language, question: questionBody.trim() });
      setQuestionStatus(res.message || 'Your question was sent.');
      setQuestionBody('');
    } catch {
      setQuestionStatus('We could not send that question. Please try again or email the venue/couple contact.');
    }
  };

  return (
    <Card id="guest-faq-info" style={{ background: palette.surface, borderColor: palette.border }}>
      <CardHeader>
        <CardTitle className="font-display text-2xl flex items-center gap-2"><HelpCircle className="h-5 w-5" /> Guest FAQ & Etiquette</CardTitle>
        <CardDescription style={{ color: palette.fgMuted }}>Dress code, guest policies, searchable FAQs, and a safe way to ask the venue/couple team a question.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: palette.border, background: palette.accentSoft }}>
            <div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>Dress code</div>
            <p className="font-semibold">{fallbackFaq.dressCode.summary}</p>
            {fallbackFaq.dressCode.examples && <p><strong>Examples:</strong> {fallbackFaq.dressCode.examples}</p>}
            {fallbackFaq.dressCode.weather && <p><Umbrella className="inline h-4 w-4 mr-1" /><strong>Weather:</strong> {fallbackFaq.dressCode.weather}</p>}
            {fallbackFaq.dressCode.rainPlan && <p><strong>Rain plan:</strong> {fallbackFaq.dressCode.rainPlan}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <PolicyTile label="Kids policy" value={fallbackFaq.policies.kidsPolicy} palette={palette} />
            <PolicyTile label="Plus-one rules" value={fallbackFaq.policies.plusOneRules} palette={palette} />
            <PolicyTile label="Phone / photo policy" value={fallbackFaq.policies.phonePhotoPolicy} palette={palette} />
            <PolicyTile label="Smoking / vaping" value={fallbackFaq.policies.smokingVapingPolicy} palette={palette} />
            <PolicyTile label="Bar / alcohol" value={fallbackFaq.policies.barAlcoholPolicy} palette={palette} />
          </div>
        </div>

        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: palette.border }}>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Label className="sr-only" htmlFor="guestFaqSearch">Search FAQ</Label>
            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4" style={{ color: palette.fgMuted }} /><Input id="guestFaqSearch" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search FAQ, dress code, arrival, bar, kids..." className="pl-8" /></div>
            <select className="h-10 rounded-md border px-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="FAQ category"><option>All</option>{fallbackFaq.categories.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="h-10 rounded-md border px-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="FAQ language">{fallbackFaq.multilingual.availableLanguages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
          </div>
          <div className="space-y-2">
            {faqItems.length ? faqItems.map((item) => {
              const translation = item.translations?.[language];
              return <details key={item.id} className="rounded-lg border p-3" style={{ borderColor: palette.border }}><summary className="cursor-pointer font-bold">{translation?.question || item.question} <span className="ml-2 text-[10px] uppercase" style={{ color: palette.fgMuted }}>{item.category}</span></summary><p className="mt-2 whitespace-pre-wrap" style={{ color: palette.fgMuted }}>{translation?.answer || item.answer}</p></details>;
            }) : <p className="rounded-lg border border-dashed p-3" style={{ borderColor: palette.border, color: palette.fgMuted }}>No FAQ entries match that search yet. Try another term or ask a question below.</p>}
          </div>
        </div>

        {fallbackFaq.askQuestion.enabled && <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: palette.border, background: palette.accentSoft }}>
          <div><strong className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Ask a question</strong><p className="text-xs" style={{ color: palette.fgMuted }}>Questions are routed to the {fallbackFaq.askQuestion.contactLabel} for an approved response.</p></div>
          <div className="grid gap-2 sm:grid-cols-3"><Input value={questionName} onChange={(e) => setQuestionName(e.target.value)} placeholder="Your name" /><Input value={questionEmail} onChange={(e) => setQuestionEmail(e.target.value)} placeholder="Email for reply" /><select className="h-10 rounded-md border px-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} value={questionCategory} onChange={(e) => setQuestionCategory(e.target.value)} aria-label="Question category">{fallbackFaq.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          <textarea className="min-h-24 w-full rounded-md border p-2 text-sm" style={{ borderColor: palette.border, background: palette.surface }} value={questionBody} onChange={(e) => setQuestionBody(e.target.value)} placeholder="Ask about dress code, arrival, kids, photos, bar, accessibility, or anything unclear..." />
          <div className="flex flex-wrap items-center gap-2"><Button type="button" onClick={submitQuestion}>Send question</Button>{branding?.supportEmail && <a className="text-xs underline font-bold" href={`mailto:${branding.supportEmail}`}>Email support instead</a>}{questionStatus && <span className="text-xs" style={{ color: palette.fgMuted }}>{questionStatus}</span>}</div>
        </div>}
      </CardContent>
    </Card>
  );
}

function PolicyTile({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>{label}</div><p className="mt-1">{value}</p></div>;
}


function GuestRegistryGifts({ config, palette, guestGifts }: { config: Record<string, any>; palette: Palette; guestGifts: PortalInfoResponse['guestGifts'] | null }) {
  const fallbackLinks = String(config.registryLinks || '').split(',').map((url, index) => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    let label = `Registry ${index + 1}`;
    try {
      const host = new URL(trimmed).hostname.replace(/^www\./, '');
      label = host.split('.')[0]?.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || label;
    } catch {}
    return { id: `registry-${index}`, type: 'registry' as const, label, url: trimmed, description: '' };
  }).filter(Boolean) as NonNullable<PortalInfoResponse['guestGifts']>['links'];
  const gifts = guestGifts || { links: fallbackLinks, cardsGiftTableLocation: String(config.cardsGiftTableLocation || ''), note: String(config.registryGiftNote || ''), externalLinkWarning: 'Gift and registry links open in a new tab on an external website. Only use links shared by the couple or venue.' };
  const grouped = {
    registry: gifts.links.filter((link) => link.type === 'registry' || link.type === 'website' || link.type === 'other'),
    honeymoon: gifts.links.filter((link) => link.type === 'honeymoon' || link.type === 'cash'),
    charity: gifts.links.filter((link) => link.type === 'charity'),
  };
  return (
    <Card id="guest-registry-gifts-info" style={{ background: palette.surface, borderColor: palette.border }}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Registry & Gifts</CardTitle>
        <CardDescription>Gift links shared by the couple, plus where to place cards or physical gifts at the venue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {gifts.note && <p className="rounded-lg border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}>{gifts.note}</p>}
        {gifts.cardsGiftTableLocation ? <p><strong>Cards / gifts table:</strong> {gifts.cardsGiftTableLocation}</p> : <p style={{ color: palette.fgMuted }}>Cards/gifts table location has not been posted yet.</p>}
        <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><strong>External link safety:</strong> {gifts.externalLinkWarning}</div>
        {gifts.links.length ? <div className="grid gap-3 sm:grid-cols-3">
          <GiftLinkGroup title="Registry links" links={grouped.registry} palette={palette} />
          <GiftLinkGroup title="Honeymoon / cash fund" links={grouped.honeymoon} palette={palette} />
          <GiftLinkGroup title="Charitable donations" links={grouped.charity} palette={palette} />
        </div> : <p style={{ color: palette.fgMuted }}>Registry, honeymoon fund, or donation links have not been shared yet.</p>}
      </CardContent>
    </Card>
  );
}

function GiftLinkGroup({ title, links, palette }: { title: string; links: NonNullable<PortalInfoResponse['guestGifts']>['links']; palette: Palette }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><div className="text-[10px] uppercase font-black tracking-widest" style={{ color: palette.fgMuted }}>{title}</div>{links.length ? <div className="mt-2 space-y-2">{links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer noopener" className="block rounded-lg border p-2 font-bold underline" style={{ borderColor: palette.border }} aria-label={`${link.label} opens in a new tab`}><span className="inline-flex items-center gap-1">{link.label}<ExternalLink className="h-3 w-3" aria-hidden="true" /></span>{link.description && <p className="mt-1 text-xs font-normal no-underline" style={{ color: palette.fgMuted }}>{link.description}</p>}</a>)}</div> : <p className="mt-2 text-xs" style={{ color: palette.fgMuted }}>Not shared.</p>}</div>;
}

function GuestTravelDirectionsCards({ eventId, config, branding, palette, activeGuest, guestTravel, guestGifts }: { eventId: string; config: Record<string, any>; branding: PortalInfoResponse['branding'] | null; palette: Palette; activeGuest?: PortalGuestEntry; guestTravel: PortalInfoResponse['guestTravel'] | null; guestGifts: PortalInfoResponse['guestGifts'] | null }) {
  const travel = guestTravel || {} as NonNullable<PortalInfoResponse['guestTravel']>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card id="guest-travel-info" style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Guest Travel & Directions</CardTitle><CardDescription>Address, map, parking, drop-off, rideshare, and accessibility details.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Venue/address:</strong> {travel.venueAddress || 'Venue address not posted yet.'}</p>{travel.mapUrl ? <a className="font-bold underline" href={travel.mapUrl} target="_blank" rel="noreferrer">Open map directions</a> : <p style={{ color: palette.fgMuted }}>Map link not posted yet.</p>}<p><strong>Parking entrance:</strong> {travel.parkingEntrance || 'Parking entrance details pending.'}</p><p><strong>Drop-off:</strong> {travel.dropoffPoint || 'Drop-off point pending.'}</p><p><strong>Rideshare:</strong> {travel.rideshareInstructions || 'Rideshare instructions pending.'}</p><p><strong>Accessible parking:</strong> {travel.accessibleParking || 'Accessible parking details pending.'}</p><p><strong>Mobility drop-off:</strong> {travel.mobilityDropoff || 'Mobility drop-off details pending.'}</p><Button asChild size="sm" variant="outline"><a href={travel.offlineCardUrl || `/api/portal/${eventId}/travel-card.txt`} download>Download offline travel card</a></Button></CardContent></Card>
      <Card id="guest-lodging-info" style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><Bus className="h-4 w-4" /> Shuttle / lodging</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Shuttle schedule:</strong> {travel.shuttleSchedule || 'Shuttle schedule not posted yet.'}</p><p><strong>Pickup:</strong> {travel.shuttlePickupLocation || 'Pickup location pending.'}</p><p><strong>Drop-off:</strong> {travel.shuttleDropoffLocation || 'Drop-off location pending.'}</p><p><strong>Last shuttle:</strong> {travel.lastShuttleReminder || 'Last shuttle reminder pending.'}</p>{activeGuest?.allowLodgingAccess ? <p><strong>Your lodging:</strong> {activeGuest.roomAssignment || travel.roomBlockDetails || 'Request lodging from the RSVP notes field.'}</p> : <p><strong>Room block/lodging:</strong> {travel.roomBlockDetails || 'No guest-specific lodging details are available for this invitation yet.'}</p>}</CardContent></Card>
      <Card id="guest-travel-faq-info" style={{ background: palette.surface, borderColor: palette.border }}><CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Destination travel FAQ</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="whitespace-pre-wrap">{travel.destinationTravelFaq || config.faqText || 'Destination travel FAQ, dress code, kids policy, phone policy, and arrival instructions have not been posted yet.'}</p><p><strong>Weather / rain plan:</strong> {travel.weatherRainPlanNote || 'Weather and rain-plan travel notes will appear here if needed.'}</p>{branding?.supportEmail && <p className="text-xs"><Mail className="inline h-3.5 w-3.5 mr-1" />Need help? <a className="font-bold underline" href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a></p>}</CardContent></Card>
      <GuestRegistryGifts config={config} palette={palette} guestGifts={guestGifts} />
    </div>
  );
}
