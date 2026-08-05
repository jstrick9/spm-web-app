import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { sdk } from '../../sdk';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import type { PortalGuestEntry, PortalInfoResponse } from '../../sdk/portalTypes';

type Palette = { bg: string; surface: string; border: string; fg: string; fgMuted: string; fgSubtle: string; primary: string; primaryFg: string; primaryHover: string; accent: string; accentSoft: string };
type RsvpStep = 'identify' | 'attendance' | 'party' | 'meal' | 'review' | 'confirm';

export function GuestRsvpWizard({
  eventId, info, guests, subEvents, palette, selectedGuestId, setSelectedGuestId, guestToken, config, guestPrivacy, onDirty, onReturnHome, onFindSeat,
}: {
  eventId: string;
  info: PortalInfoResponse['event'];
  guests: PortalGuestEntry[];
  subEvents: any[];
  palette: Palette;
  selectedGuestId: string;
  setSelectedGuestId: (id: string) => void;
  guestToken: string;
  config?: Record<string, any>;
  guestPrivacy?: PortalInfoResponse['guestPrivacy'] | null;
  onDirty?: () => void;
  onReturnHome: () => void;
  onFindSeat: () => void;
}) {
  const [step, setStep] = useState<RsvpStep>('identify');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendingStatus, setAttendingStatus] = useState<'attending' | 'declined' | 'unsure'>('attending');
  const [mealChoice, setMealChoice] = useState('standard');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [allergySeverity, setAllergySeverity] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none');
  const [crossContaminationWarning, setCrossContaminationWarning] = useState(false);
  const [severeAllergyContact, setSevereAllergyContact] = useState(false);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [beveragePreference, setBeveragePreference] = useState('');
  const [notes, setNotes] = useState('');
  const [plusOneName, setPlusOneName] = useState('');
  const [childGuestCount, setChildGuestCount] = useState('0');
  const [householdIds, setHouseholdIds] = useState<string[]>([]);
  const [memberMeals, setMemberMeals] = useState<Record<string, string>>({});
  const [memberAccessibility, setMemberAccessibility] = useState<Record<string, string>>({});
  const [subEventStatuses, setSubEventStatuses] = useState<Record<string, 'attending' | 'declined' | 'unsure'>>({});
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ rsvpId: string; summary: string[] } | null>(null);
  const [emailReminderConsent, setEmailReminderConsent] = useState(false);
  const [smsReminderConsent, setSmsReminderConsent] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);

  const activeGuest = guests.find((g) => g.id === selectedGuestId);
  const filteredGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? guests.filter((g) => g.fullName.toLowerCase().includes(q)) : guests;
  }, [guests, searchQuery]);
  const householdCandidates = useMemo(() => {
    if (!activeGuest?.householdAuthorized || !activeGuest.householdId) return [];
    return guests.filter((g) => g.id !== activeGuest.id && g.householdAuthorized && g.householdId === activeGuest.householdId);
  }, [activeGuest, guests]);
  const invitedSubEvents = useMemo(() => activeGuest ? subEvents.filter((sub: any) => !sub.invite_only || activeGuest.subEventInvites?.includes(sub.id)) : [], [activeGuest, subEvents]);
  const mealChoicesConfigured = Array.isArray(config?.mealOptions) && config!.mealOptions.length > 0;
  const mealOptions = useMemo(() => mealChoicesConfigured ? config!.mealOptions : [
    { id: 'standard', label: 'Standard entrée', description: 'Venue default' },
    { id: 'vegetarian', label: 'Vegetarian entrée', description: 'No meat or fish' },
    { id: 'vegan', label: 'Vegan entrée', description: 'No animal products' },
    { id: 'gluten_free', label: 'Gluten-free entrée', description: 'Gluten-sensitive option' },
    { id: 'nut_free', label: 'Nut-free meal', description: 'Avoid nuts where possible' },
    { id: 'kids_meal', label: 'Kids meal', description: 'Child-friendly portion' },
    { id: 'vendor_meal', label: 'Vendor meal', description: 'For approved vendor guests' },
  ], [config, mealChoicesConfigured]);

  const draftKey = `wvi_guest_rsvp_draft_${eventId}_${selectedGuestId || 'anonymous'}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setAttendingStatus(draft.attendingStatus || 'attending');
      setMealChoice(draft.mealChoice || 'standard');
      setDietaryRestrictions(draft.dietaryRestrictions || '');
      setAllergies(draft.allergies || '');
      setAllergySeverity(draft.allergySeverity || 'none');
      setCrossContaminationWarning(!!draft.crossContaminationWarning);
      setSevereAllergyContact(!!draft.severeAllergyContact);
      setAccessibilityNeeds(draft.accessibilityNeeds || '');
      setBeveragePreference(draft.beveragePreference || '');
      setNotes(draft.notes || '');
      setPlusOneName(draft.plusOneName || '');
      setChildGuestCount(draft.childGuestCount || '0');
      setHouseholdIds(Array.isArray(draft.householdIds) ? draft.householdIds : []);
      setMemberMeals(draft.memberMeals || {});
      setMemberAccessibility(draft.memberAccessibility || {});
      setSubEventStatuses(draft.subEventStatuses || {});
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ attendingStatus, mealChoice, dietaryRestrictions, allergies, allergySeverity, crossContaminationWarning, severeAllergyContact, accessibilityNeeds, beveragePreference, notes, plusOneName, childGuestCount, householdIds, memberMeals, memberAccessibility, subEventStatuses })); } catch {}
  }, [draftKey, attendingStatus, mealChoice, dietaryRestrictions, allergies, allergySeverity, crossContaminationWarning, severeAllergyContact, accessibilityNeeds, beveragePreference, notes, plusOneName, childGuestCount, householdIds, memberMeals, memberAccessibility, subEventStatuses]);

  const steps: RsvpStep[] = ['identify', 'attendance', 'party', 'meal', 'review', 'confirm'];
  const stepIndex = steps.indexOf(step);
  const isAttending = attendingStatus === 'attending';

  function selectGuest(id: string) {
    setSelectedGuestId(id);
    onDirty?.();
  }

  function next() {
    setError('');
    if (step === 'identify' && !selectedGuestId) return setError('Please choose your name or request help if you cannot find it.');
    if (step === 'attendance' && !attendingStatus) return setError('Please choose attending, declined, or unsure.');
    setStep(steps[Math.min(stepIndex + 1, steps.length - 1)]);
  }

  async function submit() {
    setError('');
    if (!selectedGuestId) return setError('Please choose your name before submitting.');
    try {
      const subEventRSVPs = Object.fromEntries(Object.entries(subEventStatuses).map(([id, status]) => [id, status === 'attending' ? true : status === 'declined' ? false : 'unsure']));
      if (step === 'review' && !privacyAcknowledged) return setError('Please review and acknowledge the guest privacy notice before submitting.');
      const response = await sdk.portal.submitRsvp(eventId, {
        guestId: selectedGuestId,
        token: guestToken || undefined,
        emailReminderConsent,
        smsReminderConsent,
        attending: attendingStatus === 'attending',
        // 'unsure' → server status 'maybe' (recorded as maybe, not declined)
        status: attendingStatus === 'unsure' ? 'maybe' : undefined,
        mealChoice,
        plusOneName: plusOneName || undefined,
        dietaryNotes: dietaryRestrictions || undefined,
        allergies: allergies || undefined,
        allergySeverity,
        crossContaminationWarning,
        beveragePreference: beveragePreference || undefined,
        severeAllergyContact,
        specialNeeds: [accessibilityNeeds, Number(childGuestCount) > 0 ? `Child guests noted: ${childGuestCount}` : ''].filter(Boolean).join(' | ') || undefined,
        notes: attendingStatus === 'declined' ? `Declined with note: ${notes || 'No note provided.'}` : notes || undefined,
        subEventRSVPs: subEventRSVPs as any,
      });
      for (const id of householdIds) {
        await sdk.portal.submitRsvp(eventId, { guestId: id, attending: true, mealChoice: memberMeals[id] || mealChoice, dietaryNotes: dietaryRestrictions || undefined, allergies: allergies || undefined, allergySeverity, crossContaminationWarning, beveragePreference: beveragePreference || undefined, severeAllergyContact, specialNeeds: memberAccessibility[id] || accessibilityNeeds || undefined, token: guestToken || undefined });
      }
      const summary = [
        `Guest: ${activeGuest?.fullName || 'Selected guest'}`,
        `Response: ${attendingStatus}`,
        `Meal: ${mealChoice}`,
        dietaryRestrictions ? `Dietary: ${dietaryRestrictions}` : 'Dietary: none',
        allergies ? `Allergies: ${allergies} (${allergySeverity})` : 'Allergies: none',
        beveragePreference ? `Beverage: ${beveragePreference}` : 'Beverage: no preference',
        plusOneName ? `Plus-one: ${plusOneName}` : 'Plus-one: none provided',
        Number(childGuestCount) > 0 ? `Children/age notes: ${childGuestCount}` : 'Children/age notes: none',
        ...invitedSubEvents.map((sub: any) => `${sub.title}: ${subEventStatuses[sub.id] || 'unsure'}`),
      ];
      try { localStorage.removeItem(draftKey); } catch {}
      setReceipt({ rsvpId: response.rsvpId, summary });
      setStep('confirm');
    } catch (err) {
      const apiErr = err as Error & { kind?: string; code?: string };
      if (apiErr.code === 'portal-token-required' || apiErr.code === 'portal-token-invalid' || apiErr.code === 'portal-token-required-for-rsvp-edit') {
        setError('To RSVP you need the secure link from your invitation. Use “I cannot find my name” or “Request your secure link” on the home screen, or ask the couple/venue for your link.');
      } else {
        setError(apiErr.kind === 'offline' || apiErr.code === 'network-error'
          ? 'Network failure: your RSVP draft is still saved locally on this device. Reconnect and retry when ready.'
          : apiErr.message || 'Could not submit RSVP. Please review required fields and try again.');
      }
    }
  }

  if (step === 'confirm' && receipt) {
    return <Card className="shadow-lg text-center" style={{ borderColor: palette.border }}><CardHeader><CardTitle className="font-display text-3xl">RSVP saved</CardTitle><CardDescription style={{ color: palette.fgMuted }}>Your response was recorded. If your invitation has email/SMS, a confirmation receipt may be sent by the venue.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border p-4 text-left text-sm" style={{ borderColor: palette.border, background: palette.accentSoft }}>{receipt.summary.map((line) => <div key={line} className="py-1">{line}</div>)}</div><div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={onReturnHome}>Return Home</Button>{isAttending && <Button variant="outline" onClick={onFindSeat}><MapIcon className="w-4 h-4 mr-1" /> Find Your Seat</Button>}<Button onClick={() => setStep('identify')}>Edit response</Button></div></CardContent></Card>;
  }

  return (
    <Card className="shadow-lg" style={{ borderColor: palette.border }}>
      <CardHeader className="text-center pb-2"><CardTitle className="font-display text-3xl">Guided RSVP</CardTitle><CardDescription style={{ color: palette.fgMuted }}>Step {stepIndex + 1} of {steps.length}: identify guest → event attendance → party → meal/accessibility → review → submit.</CardDescription></CardHeader>
      <CardContent><form className="space-y-5" aria-label="RSVP form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%`, background: palette.primary }} /></div>
        {step === 'identify' && <section className="space-y-4"><Label htmlFor="gs">Search your name</Label><Input id="gs" aria-label="Search your name" placeholder="Type your name to filter..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); onDirty?.(); }} /><Label htmlFor="gn">Your name</Label><select id="gn" aria-label="Your Name" required value={selectedGuestId} onChange={(e) => selectGuest(e.target.value)} className="w-full h-12 px-4 rounded-md" style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}><option value="">— Find your name —</option>{filteredGuests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}</select>{guestToken ? <p className="text-xs text-success">Secure invitation link verified for RSVP editing.</p> : <p className="text-xs" style={{ color: palette.fgMuted }}>If you are editing an existing RSVP, use your secure invitation link.</p>}</section>}
        {step === 'attendance' && <section className="space-y-4"><Label>Will you attend the main event?</Label><div className="grid gap-2 sm:grid-cols-3">{(['attending','declined','unsure'] as const).map((status) => <Button key={status} type="button" variant={attendingStatus === status ? 'default' : 'outline'} onClick={() => { setAttendingStatus(status); onDirty?.(); }}>{status === 'attending' ? 'Joyfully accept' : status === 'declined' ? 'Regretfully decline' : 'Unsure'}</Button>)}</div>{attendingStatus === 'declined' && <textarea value={notes} onChange={(e) => { setNotes(e.target.value); onDirty?.(); }} placeholder="Optional private note for the couple" className="min-h-24 w-full rounded-md border p-3" style={{ borderColor: palette.border, background: palette.surface, color: palette.fg }} />}</section>}
        {step === 'party' && <section className="space-y-4"><div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>Plus-one</strong><p className="text-xs" style={{ color: palette.fgMuted }}>If your invitation allows a plus-one, add their name. Otherwise leave blank.</p><Input className="mt-2" value={plusOneName} onChange={(e) => { setPlusOneName(e.target.value); onDirty?.(); }} placeholder="Plus-one name, if invited" /></div><div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>Children / age-related notes</strong><Input className="mt-2" type="number" min="0" value={childGuestCount} onChange={(e) => { setChildGuestCount(e.target.value); onDirty?.(); }} /></div>{householdCandidates.length > 0 && <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>Authorized household RSVP</strong><p className="text-xs" style={{ color: palette.fgMuted }}>Only guests grouped on your invitation are shown here. This prevents accidental RSVP changes for unrelated guests with the same last name.</p>{householdCandidates.map((member) => <label key={member.id} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={householdIds.includes(member.id)} onChange={() => setHouseholdIds((ids) => ids.includes(member.id) ? ids.filter((id) => id !== member.id) : [...ids, member.id])} /> <span>{member.fullName} · {member.rsvpStatus || 'pending'} · {member.inviteStatus || 'invited'}</span></label>)}<Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => void sdk.portal.requestHelp(eventId, { kind: 'other', guestId: activeGuest?.id, name: activeGuest?.fullName, message: `Household correction requested for ${activeGuest?.householdName || activeGuest?.partyName || activeGuest?.fullName}.` })}>This household list is wrong</Button></div>}</section>}
        {step === 'meal' && <section className="space-y-4"><div className="rounded-xl border p-3 text-xs" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>Privacy:</strong> dietary, allergy, beverage, and accessibility details are shared with the couple, venue, and catering team only as needed for guest care.</div>{!mealChoicesConfigured && <div className="rounded-xl border p-3 text-xs" style={{ borderColor: palette.border }}><strong>Meal choices not finalized yet.</strong> We are showing general defaults so you can still note dietary needs; the venue/couple may confirm final meal options later.</div>}<Label htmlFor="meal">Meal choice</Label><select id="meal" value={mealChoice} onChange={(e) => { setMealChoice(e.target.value); onDirty?.(); }} className="w-full h-12 px-4 rounded-md" style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}>{mealOptions.map((option: any) => <option key={option.id} value={option.id}>{option.label}{option.description ? ` — ${option.description}` : ""}</option>)}</select>{householdIds.length > 0 && <div className="space-y-2"><strong>Per-person household meals/accessibility</strong>{householdIds.map((id) => { const member = guests.find((g) => g.id === id); return <div key={id} className="grid gap-1 text-xs rounded-lg border p-2" style={{ borderColor: palette.border }}><label>{member?.fullName || id}<select value={memberMeals[id] || mealChoice} onChange={(e) => setMemberMeals({ ...memberMeals, [id]: e.target.value })} className="mt-1 h-9 w-full rounded-md border px-2">{mealOptions.map((option: any) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><textarea value={memberAccessibility[id] || ''} onChange={(e) => setMemberAccessibility({ ...memberAccessibility, [id]: e.target.value })} className="min-h-16 rounded-md border p-2" placeholder="Accessibility or dietary note for this household member" /></div>; })}</div>}<Input value={dietaryRestrictions} onChange={(e) => { setDietaryRestrictions(e.target.value); onDirty?.(); }} placeholder="Dietary restrictions (vegetarian, kosher-style, no pork, etc.)" /><Input value={allergies} onChange={(e) => { setAllergies(e.target.value); onDirty?.(); }} placeholder="Allergies (nuts, shellfish, dairy, etc.)" /><div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Allergy severity<select value={allergySeverity} onChange={(e) => setAllergySeverity(e.target.value as any)} className="mt-1 h-10 w-full rounded-md border px-2"><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label><label className="text-sm">Beverage preference<Input className="mt-1" value={beveragePreference} onChange={(e) => setBeveragePreference(e.target.value)} placeholder="Non-alcoholic, mocktail, NA beer..." /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={crossContaminationWarning} onChange={(e) => setCrossContaminationWarning(e.target.checked)} /> Cross-contamination is a concern</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={severeAllergyContact} onChange={(e) => setSevereAllergyContact(e.target.checked)} /> I have a severe allergy; please contact me</label><textarea value={accessibilityNeeds} onChange={(e) => { setAccessibilityNeeds(e.target.value); onDirty?.(); }} className="min-h-20 w-full rounded-md border p-3" style={{ borderColor: palette.border, background: palette.surface, color: palette.fg }} placeholder="Accessibility needs (mobility, seating, sensory, interpretation/language)..." /><textarea value={notes} onChange={(e) => { setNotes(e.target.value); onDirty?.(); }} className="min-h-20 w-full rounded-md border p-3" style={{ borderColor: palette.border, background: palette.surface, color: palette.fg }} placeholder="General note for the couple (optional)" />{invitedSubEvents.length > 0 && <div className="space-y-2"><strong>Invited sub-events</strong>{invitedSubEvents.map((sub: any) => <div key={sub.id} className="rounded-lg border p-3" style={{ borderColor: palette.border }}><div className="font-bold">{sub.title}</div><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['attending','declined','unsure'] as const).map((status) => <Button key={status} type="button" size="sm" variant={(subEventStatuses[sub.id] || 'unsure') === status ? 'default' : 'outline'} onClick={() => { onDirty?.(); setSubEventStatuses({ ...subEventStatuses, [sub.id]: status }); }}>{status}</Button>)}</div></div>)}</div>}</section>}
        {step === 'review' && <section className="space-y-3"><h3 className="font-bold">Review before submitting</h3>{[activeGuest?.fullName, `Main event: ${attendingStatus}`, `Meal: ${mealChoice}`, dietaryRestrictions ? `Dietary: ${dietaryRestrictions}` : 'Dietary: none', allergies ? `Allergies: ${allergies} (${allergySeverity})` : 'Allergies: none', beveragePreference ? `Beverage: ${beveragePreference}` : 'Beverage: no preference', plusOneName ? `Plus-one: ${plusOneName}` : 'Plus-one: none', Number(childGuestCount) > 0 ? `Children: ${childGuestCount}` : 'Children: none', notes ? `Note: ${notes}` : 'No note'].filter(Boolean).map((line) => <div key={line} className="rounded-lg border p-2 text-sm" style={{ borderColor: palette.border }}>{line}</div>)}{invitedSubEvents.map((sub: any) => <div key={sub.id} className="rounded-lg border p-2 text-sm" style={{ borderColor: palette.border }}>{sub.title}: {subEventStatuses[sub.id] || 'unsure'}</div>)}<div className="rounded-xl border p-3 space-y-2" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>Guest privacy notice</strong><p className="text-xs" style={{ color: palette.fgMuted }}>{guestPrivacy?.summary || 'Your RSVP details are used only to plan and host this event.'}</p><ul className="list-disc pl-5 text-xs" style={{ color: palette.fgMuted }}><li>{guestPrivacy?.visibility.rsvp || 'Attendance is visible to the couple and venue team.'}</li><li>{guestPrivacy?.visibility.meal || 'Meal, dietary, allergy, accessibility, lodging, and notes are shared only with authorized event contacts as needed.'}</li><li>{guestPrivacy?.retention || 'Guest records are retained according to venue policy.'}</li></ul><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={privacyAcknowledged} onChange={(e) => setPrivacyAcknowledged(e.target.checked)} /> I understand who can see my RSVP, meal, allergy, accessibility, lodging, and note details.</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={emailReminderConsent} onChange={(e) => setEmailReminderConsent(e.target.checked)} /> {guestPrivacy?.consent.emailReminderLabel || 'I agree to receive event email reminders and RSVP follow-up messages.'}</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={smsReminderConsent} onChange={(e) => setSmsReminderConsent(e.target.checked)} /> {guestPrivacy?.consent.smsReminderLabel || 'I agree to receive event SMS/text reminders if my phone number is on file.'}</label></div></section>}
        {error && <p id="rsvp-error" className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-between gap-2"><Button type="button" variant="outline" disabled={stepIndex === 0} onClick={() => setStep(steps[Math.max(0, stepIndex - 1)])}>Back</Button>{step === 'review' ? <Button type="submit">Submit RSVP</Button> : <Button type="button" onClick={next}>Continue</Button>}</div></form>
      </CardContent>
    </Card>
  );
}
