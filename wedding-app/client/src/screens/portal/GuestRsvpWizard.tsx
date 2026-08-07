import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { sdk } from '../../sdk';
import { useI18n } from '../../i18n/I18nContext';
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
  const [receipt, setReceipt] = useState<{ rsvpId: string; summary: string[]; lateSubmission?: boolean } | null>(null);
  const [emailReminderConsent, setEmailReminderConsent] = useState(false);
  const [smsReminderConsent, setSmsReminderConsent] = useState(false);
  const { t } = useI18n();
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
    if (step === 'identify' && !selectedGuestId) return setError(t('rsvp.errorIdentify'));
    if (step === 'attendance' && !attendingStatus) return setError(t('rsvp.errorAttendance'));
    setStep(steps[Math.min(stepIndex + 1, steps.length - 1)]);
  }

  async function submit() {
    setError('');
    if (!selectedGuestId) return setError(t('rsvp.errorGuest'));
    try {
      const subEventRSVPs = Object.fromEntries(Object.entries(subEventStatuses).map(([id, status]) => [id, status === 'attending' ? true : status === 'declined' ? false : 'unsure']));
      if (step === 'review' && !privacyAcknowledged) return setError(t('rsvp.errorPrivacy'));
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
        t('rsvp.mealLine', { meal: mealChoice }),
        dietaryRestrictions ? t('rsvp.dietaryLine', { dietary: dietaryRestrictions }) : t('rsvp.dietaryNone'),
        allergies ? t('rsvp.allergiesLine', { allergies, severity: allergySeverity }) : t('rsvp.allergiesNone'),
        beveragePreference ? t('rsvp.beverageLine', { beverage: beveragePreference }) : t('rsvp.beverageNone'),
        plusOneName ? t('rsvp.plusOneLine', { name: plusOneName }) : t('rsvp.plusOneNone'),
        Number(childGuestCount) > 0 ? t('rsvp.childrenLine', { count: childGuestCount }) : t('rsvp.childrenNone'),
        ...invitedSubEvents.map((sub: any) => `${sub.title}: ${subEventStatuses[sub.id] || 'unsure'}`),
      ];
      try { localStorage.removeItem(draftKey); } catch {}
      setReceipt({ rsvpId: response.rsvpId, summary, lateSubmission: response.lateSubmission === true });
      setStep('confirm');
    } catch (err) {
      const apiErr = err as Error & { kind?: string; code?: string };
      if (apiErr.code === 'portal-token-required' || apiErr.code === 'portal-token-invalid' || apiErr.code === 'portal-token-required-for-rsvp-edit') {
        setError(t('rsvp.errorToken'));
      } else {
        setError(apiErr.kind === 'offline' || apiErr.code === 'network-error'
          ? t('rsvp.errorNetwork')
          : apiErr.message || t('rsvp.errorGeneric'));
      }
    }
  }

  if (step === 'confirm' && receipt) {
    return <Card className="shadow-lg text-center" style={{ borderColor: palette.border }}><CardHeader><CardTitle className="font-display text-3xl">{t('rsvp.saved')}</CardTitle><CardDescription style={{ color: palette.fgMuted }}>{t('rsvp.savedDescription')}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border p-4 text-left text-sm" style={{ borderColor: palette.border, background: palette.accentSoft }}>{receipt.summary.map((line) => <div key={line} className="py-1">{line}</div>)}</div>{receipt.lateSubmission && <div className="rounded-xl border border-warning/40 bg-warning-soft/20 p-3 text-left text-xs text-warning"><strong>{t('rsvp.lateNoticeTitle')}</strong><p className="mt-1" style={{ color: palette.fgMuted }}>{t('rsvp.lateNoticeBody')}</p></div>}<div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={onReturnHome}>{t('rsvp.returnHome')}</Button>{isAttending && <Button variant="outline" onClick={onFindSeat}><MapIcon className="w-4 h-4 mr-1" /> {t('rsvp.findSeat')}</Button>}<Button onClick={() => setStep('identify')}>{t('rsvp.editResponse')}</Button></div></CardContent></Card>;
  }

  return (
    <Card className="shadow-lg" style={{ borderColor: palette.border }}>
      <CardHeader className="text-center pb-2"><CardTitle className="font-display text-3xl">{t('rsvp.guidedTitle')}</CardTitle><CardDescription style={{ color: palette.fgMuted }}>{t('rsvp.steps', { current: stepIndex + 1, total: steps.length })}</CardDescription></CardHeader>
      <CardContent><form className="space-y-5" aria-label={t('rsvp.form')} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%`, background: palette.primary }} /></div>
        {step === 'identify' && <section className="space-y-4"><Label htmlFor="gs">{t('rsvp.searchName')}</Label><Input id="gs" aria-label={t('rsvp.searchName')} placeholder={t('rsvp.searchPlaceholder')} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); onDirty?.(); }} /><Label htmlFor="gn">{t('rsvp.yourName')}</Label><select id="gn" aria-label={t('rsvp.yourName')} required value={selectedGuestId} onChange={(e) => selectGuest(e.target.value)} className="w-full h-12 px-4 rounded-md" style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}><option value="">— {t('rsvp.findName')} —</option>{filteredGuests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}</select>{guestToken ? <p className="text-xs text-success">{t('rsvp.verifiedLink')}</p> : <p className="text-xs" style={{ color: palette.fgMuted }}>{t('rsvp.editHint')}</p>}</section>}
        {step === 'attendance' && <section className="space-y-4"><Label>{t('rsvp.attendQuestion')}</Label><div className="grid gap-2 sm:grid-cols-3">{(['attending','declined','unsure'] as const).map((status) => <Button key={status} type="button" variant={attendingStatus === status ? 'default' : 'outline'} onClick={() => { setAttendingStatus(status); onDirty?.(); }}>{status === 'attending' ? t('rsvp.joyfullyAccept') : status === 'declined' ? t('rsvp.regretfullyDecline') : t('rsvp.unsure')}</Button>)}</div>{attendingStatus === 'declined' && <textarea value={notes} onChange={(e) => { setNotes(e.target.value); onDirty?.(); }} placeholder={t('rsvp.privateNotePlaceholder')} className="min-h-24 w-full rounded-md border p-3" style={{ borderColor: palette.border, background: palette.surface, color: palette.fg }} />}</section>}
        {step === 'party' && <section className="space-y-4"><div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>{t('rsvp.plusOne')}</strong><p className="text-xs" style={{ color: palette.fgMuted }}>{t('rsvp.plusOneHint')}</p><Input className="mt-2" value={plusOneName} onChange={(e) => { setPlusOneName(e.target.value); onDirty?.(); }} placeholder={t('rsvp.plusOneName')} /></div><div className="rounded-xl border p-3" style={{ borderColor: palette.border }}><strong>{t('rsvp.childrenTitle')}</strong><Input className="mt-2" type="number" min="0" value={childGuestCount} onChange={(e) => { setChildGuestCount(e.target.value); onDirty?.(); }} /></div>{householdCandidates.length > 0 && <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>{t('rsvp.householdTitle')}</strong><p className="text-xs" style={{ color: palette.fgMuted }}>{t('rsvp.householdCopy')}</p>{householdCandidates.map((member) => <label key={member.id} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={householdIds.includes(member.id)} onChange={() => setHouseholdIds((ids) => ids.includes(member.id) ? ids.filter((id) => id !== member.id) : [...ids, member.id])} /> <span>{member.fullName} · {member.rsvpStatus || 'pending'} · {member.inviteStatus || 'invited'}</span></label>)}<Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => void sdk.portal.requestHelp(eventId, { kind: 'other', guestId: activeGuest?.id, name: activeGuest?.fullName, message: `Household correction requested for ${activeGuest?.householdName || activeGuest?.partyName || activeGuest?.fullName}.` })}>{t('rsvp.householdWrong')}</Button></div>}</section>}
        {step === 'meal' && <section className="space-y-4"><div className="rounded-xl border p-3 text-xs" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>{t('rsvp.privacyLabel')}:</strong> {t('rsvp.privacyMeal')}</div>{!mealChoicesConfigured && <div className="rounded-xl border p-3 text-xs" style={{ borderColor: palette.border }}><strong>{t('rsvp.mealNotFinalizedTitle')}.</strong> {t('rsvp.mealNotFinalized')}</div>}<Label htmlFor="meal">{t('rsvp.meal')}</Label><select id="meal" value={mealChoice} onChange={(e) => { setMealChoice(e.target.value); onDirty?.(); }} className="w-full h-12 px-4 rounded-md" style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}>{mealOptions.map((option: any) => <option key={option.id} value={option.id}>{option.label}{option.description ? ` — ${option.description}` : ""}</option>)}</select>{householdIds.length > 0 && <div className="space-y-2"><strong>{t('rsvp.perPersonMeals')}</strong>{householdIds.map((id) => { const member = guests.find((g) => g.id === id); return <div key={id} className="grid gap-1 text-xs rounded-lg border p-2" style={{ borderColor: palette.border }}><label>{member?.fullName || id}<select value={memberMeals[id] || mealChoice} onChange={(e) => setMemberMeals({ ...memberMeals, [id]: e.target.value })} className="mt-1 h-9 w-full rounded-md border px-2">{mealOptions.map((option: any) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><textarea value={memberAccessibility[id] || ''} onChange={(e) => setMemberAccessibility({ ...memberAccessibility, [id]: e.target.value })} className="min-h-16 rounded-md border p-2" placeholder={t('rsvp.householdNote')} /></div>; })}</div>}<Input value={dietaryRestrictions} onChange={(e) => { setDietaryRestrictions(e.target.value); onDirty?.(); }} placeholder={t('rsvp.dietaryPlaceholder')} /><Input value={allergies} onChange={(e) => { setAllergies(e.target.value); onDirty?.(); }} placeholder={t('rsvp.allergiesPlaceholder')} /><div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">{t('rsvp.allergySeverity')}<select value={allergySeverity} onChange={(e) => setAllergySeverity(e.target.value as any)} className="mt-1 h-10 w-full rounded-md border px-2"><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label><label className="text-sm">{t('rsvp.beverage')}<Input className="mt-1" value={beveragePreference} onChange={(e) => setBeveragePreference(e.target.value)} placeholder={t('rsvp.beveragePlaceholder')} /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={crossContaminationWarning} onChange={(e) => setCrossContaminationWarning(e.target.checked)} /> {t('rsvp.crossContamination')}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={severeAllergyContact} onChange={(e) => setSevereAllergyContact(e.target.checked)} /> {t('rsvp.severeAllergy')}</label><textarea value={accessibilityNeeds} onChange={(e) => { setAccessibilityNeeds(e.target.value); onDirty?.(); }} className="min-h-20 w-full rounded-md border p-3" style={{ borderColor: palette.border, background: palette.surface, color: palette.fg }} placeholder={t('rsvp.accessibilityPlaceholder')} /><textarea value={notes} onChange={(e) => { setNotes(e.target.value); onDirty?.(); }} className="min-h-20 w-full rounded-md border p-3" style={{ borderColor: palette.border, background: palette.surface, color: palette.fg }} placeholder={t('rsvp.notePlaceholder')} />{invitedSubEvents.length > 0 && <div className="space-y-2"><strong>{t('rsvp.invitedSubEvents')}</strong>{invitedSubEvents.map((sub: any) => <div key={sub.id} className="rounded-lg border p-3" style={{ borderColor: palette.border }}><div className="font-bold">{sub.title}</div><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['attending','declined','unsure'] as const).map((status) => <Button key={status} type="button" size="sm" variant={(subEventStatuses[sub.id] || 'unsure') === status ? 'default' : 'outline'} onClick={() => { onDirty?.(); setSubEventStatuses({ ...subEventStatuses, [sub.id]: status }); }}>{status}</Button>)}</div></div>)}</div>}</section>}
        {step === 'review' && <section className="space-y-3"><h3 className="font-bold">{t('rsvp.review')}</h3>{[activeGuest?.fullName, t('rsvp.responseLine', { status: t(attendingStatus === 'attending' ? 'common.attending' : attendingStatus === 'declined' ? 'common.declined' : 'common.unsure') }), t('rsvp.mealLine', { meal: mealChoice }), dietaryRestrictions ? t('rsvp.dietaryLine', { dietary: dietaryRestrictions }) : t('rsvp.dietaryNone'), allergies ? t('rsvp.allergiesLine', { allergies, severity: allergySeverity }) : t('rsvp.allergiesNone'), beveragePreference ? t('rsvp.beverageLine', { beverage: beveragePreference }) : t('rsvp.beverageNone'), plusOneName ? `Plus-one: ${plusOneName}` : 'Plus-one: none', Number(childGuestCount) > 0 ? `Children: ${childGuestCount}` : 'Children: none', notes ? t('rsvp.noteLine', { note: notes }) : t('rsvp.noNote')].filter(Boolean).map((line) => <div key={line} className="rounded-lg border p-2 text-sm" style={{ borderColor: palette.border }}>{line}</div>)}{invitedSubEvents.map((sub: any) => <div key={sub.id} className="rounded-lg border p-2 text-sm" style={{ borderColor: palette.border }}>{sub.title}: {subEventStatuses[sub.id] || 'unsure'}</div>)}<div className="rounded-xl border p-3 space-y-2" style={{ borderColor: palette.border, background: palette.accentSoft }}><strong>{t('rsvp.privacyNotice')}</strong><p className="text-xs" style={{ color: palette.fgMuted }}>{guestPrivacy?.summary || 'Your RSVP details are used only to plan and host this event.'}</p><ul className="list-disc pl-5 text-xs" style={{ color: palette.fgMuted }}><li>{guestPrivacy?.visibility.rsvp || 'Attendance is visible to the couple and venue team.'}</li><li>{guestPrivacy?.visibility.meal || 'Meal, dietary, allergy, accessibility, lodging, and notes are shared only with authorized event contacts as needed.'}</li><li>{guestPrivacy?.retention || 'Guest records are retained according to venue policy.'}</li></ul><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={privacyAcknowledged} onChange={(e) => setPrivacyAcknowledged(e.target.checked)} /> {t('rsvp.privacyAck')}</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={emailReminderConsent} onChange={(e) => setEmailReminderConsent(e.target.checked)} /> {guestPrivacy?.consent.emailReminderLabel || t('rsvp.emailConsent')}</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={smsReminderConsent} onChange={(e) => setSmsReminderConsent(e.target.checked)} /> {guestPrivacy?.consent.smsReminderLabel || t('rsvp.smsConsent')}</label></div></section>}
        {error && <p id="rsvp-error" className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-between gap-2"><Button type="button" variant="outline" disabled={stepIndex === 0} onClick={() => setStep(steps[Math.max(0, stepIndex - 1)])}>{t('common.back')}</Button>{step === 'review' ? <Button type="submit">{t('rsvp.submit')}</Button> : <Button type="button" onClick={next}>{t('common.continue')}</Button>}</div></form>
      </CardContent>
    </Card>
  );
}
