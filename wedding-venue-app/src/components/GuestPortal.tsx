// src/components/GuestPortal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import SafeImage from './SafeImage';
import {
  Venue,
  LodgingFloor,
  LodgingRoom,
  RSVPSubmission,
  GuestPortalConfig,
  GuestPortalGuestRecord,
  PortalScheduleItem,
  PortalWayfindingPoint,
} from '../types';
import {
  clearGuestPortalSession,
  findGuestInEvent,
  getGuestPortalConfig,
  getPortalGuests,
  getPortalGuestsForEvent,
  getPortalRSVPSubmissions,
  getPortalRSVPSubmissionsForEvent,
  getPortalVenues,
  isGuestPortalEventActive,
  loadGuestPortalSession,
  normalizeEventKey,
  saveGuestPortalSession,
  setPortalRSVPSubmissions,
} from '../utils/guestPortal';
import { verifySecret } from '../utils/auth';
import {
  guestCanAccessLodging,
  guestCanAccessPortal,
  guestCanSubmitRSVP,
  guestCanViewMap,
  guestCanViewSchedule,
} from '../utils/guestAccess';

interface GuestPortalProps {
  guestToken?: string;
  onExitPortal: () => void;
}

type TabId = 'home' | 'map' | 'schedule' | 'wayfinding' | 'rsvp' | 'lodging';

interface PortalData {
  venues: Venue[];
  guests: GuestPortalGuestRecord[];
  submissions: RSVPSubmission[];
}

const GuestPortal: React.FC<GuestPortalProps> = ({ guestToken, onExitPortal }) => {
  const [config, setConfig] = useState<GuestPortalConfig | null>(null);
  const [portalData, setPortalData] = useState<PortalData>({
    venues: [],
    guests: [],
    submissions: [],
  });

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isAuthed, setIsAuthed] = useState(false);

  const [eventInput, setEventInput] = useState('');
  const [guestIdentifier, setGuestIdentifier] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [activeEventName, setActiveEventName] = useState('');
  const [resolvedGuestId, setResolvedGuestId] = useState<string | null>(null);

  const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState<RSVPSubmission | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedWayfindingFrom, setSelectedWayfindingFrom] = useState<string | 'entrance'>(
    'entrance',
  );
  const [selectedWayfindingTo, setSelectedWayfindingTo] = useState<string | ''>('');
  const [wayfindingResult, setWayfindingResult] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const loadedConfig = getGuestPortalConfig();
      setConfig(loadedConfig);

      const venues = getPortalVenues();
      const guests = getPortalGuests();
      const submissions = getPortalRSVPSubmissions();

      setPortalData({
        venues,
        guests,
        submissions,
      });

      if (loadedConfig && isGuestPortalEventActive(loadedConfig)) {
        const session = loadGuestPortalSession(loadedConfig, loadedConfig.eventTitle);
        if (session) {
          setIsAuthed(true);
          setActiveEventName(loadedConfig.eventTitle || '');
          setResolvedGuestId(session.guestId || null);
          setEventInput(loadedConfig.eventTitle || '');
        } else {
          clearGuestPortalSession();
        }
      } else {
        clearGuestPortalSession();
      }
    } catch {
      // ignore
    }
  }, []);

  const eventStartDate = config?.eventStartDate ? new Date(config.eventStartDate) : null;
  const eventEndDate = config?.eventEndDate ? new Date(config.eventEndDate) : null;
  const today = new Date();

  const daysUntilEvent = eventStartDate
    ? Math.max(
        0,
        Math.ceil((eventStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      )
    : null;

  const isMultiDay = !!config?.isMultiDay && !!eventEndDate && !!eventStartDate;
  const rsvpDeadline = (config as any)?.rsvpDeadlineDate
    ? new Date((config as any).rsvpDeadlineDate)
    : null;
  const rsvpClosed = rsvpDeadline ? today > rsvpDeadline : false;

  const scopedGuests = useMemo(() => {
    if (!activeEventName) return portalData.guests;
    return getPortalGuestsForEvent(activeEventName);
  }, [activeEventName, portalData.guests]);

  const scopedSubmissions = useMemo(() => {
    if (!activeEventName) return portalData.submissions;
    return getPortalRSVPSubmissionsForEvent(activeEventName);
  }, [activeEventName, portalData.submissions]);

  const identifiedGuest = useMemo(() => {
    if (resolvedGuestId) {
      return scopedGuests.find((g) => g.id === resolvedGuestId);
    }

    if (guestToken) {
      return scopedGuests.find((g) => g.token === guestToken);
    }

    return undefined;
  }, [resolvedGuestId, guestToken, scopedGuests]);

  const guestRSVP = useMemo(() => {
    if (!identifiedGuest) return undefined;
    return scopedSubmissions.find((s) => s.guestId === identifiedGuest.id);
  }, [identifiedGuest, scopedSubmissions]);

  const activeEventLabel = activeEventName || config?.eventTitle || '';

  const requiresPortalPassword = !!(
    config?.portalPassword || (config as any)?.portalPasswordHash
  );

  const needsEventScopedSignIn = !isAuthed;

  const handleGuestPortalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    setPasswordError('');

    if (!config) {
      setPasswordError('Guest portal is not configured.');
      return;
    }

    if (!isGuestPortalEventActive(config)) {
      setPasswordError('This guest portal is no longer available.');
      return;
    }

    const enteredEventKey = normalizeEventKey(eventInput);
    const configuredEventKey = normalizeEventKey(config.eventTitle || '');

    if (!enteredEventKey || enteredEventKey !== configuredEventKey) {
      setPasswordError('Event not found or not available.');
      return;
    }

    const guest = findGuestInEvent(config.eventTitle, guestIdentifier);

    if (!guest || !guestCanAccessPortal(guest, config.eventTitle)) {
      setPasswordError('Guest not found for this event.');
      return;
    }

    if (requiresPortalPassword) {
      const trimmedPassword = passwordInput.trim();

      if (config.portalPasswordHash && config.portalPasswordSalt) {
        const isValid = await verifySecret(trimmedPassword, {
          hash: config.portalPasswordHash,
          salt: config.portalPasswordSalt,
        });

        if (!isValid) {
          setPasswordError('Incorrect password. Please try again.');
          return;
        }
      } else if (config.portalPassword && trimmedPassword !== config.portalPassword) {
        // Legacy plaintext path - retained only for migration. Schedule removal.
        // TODO(security): Remove plaintext fallback after all configs are migrated to portalPasswordHash.
        console.warn('[SECURITY] Guest portal authenticated against legacy plaintext password. Please re-save the portal password in Admin to migrate to hashed storage.');
        setPasswordError('Incorrect password. Please try again.');
        return;
      }
    }

    setIsAuthed(true);
    setActiveEventName(config.eventTitle || eventInput.trim());
    setResolvedGuestId(guest.id);
    saveGuestPortalSession(config, guest.token, config.eventTitle, guest.id);
    setPasswordError('');
  };

  const [rsvpForm, setRsvpForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    attending: 'yes' as 'yes' | 'no',
    attendingDays: [] as string[],
    mealChoice: 'standard',
    plusOne: false,
    plusOneName: '',
    plusOneMealChoice: 'standard',
    dietaryNotes: '',
    specialNeeds: '',
    notes: '',
  });

  useEffect(() => {
    if (config && !isGuestPortalEventActive(config)) {
      clearGuestPortalSession();
      setIsAuthed(false);
      setResolvedGuestId(null);
    }
  }, [config]);

  useEffect(() => {
    if (!identifiedGuest && !guestRSVP) return;

    setRsvpForm((prev) => ({
      ...prev,
      fullName: guestRSVP?.fullName || identifiedGuest?.name || prev.fullName,
      email: guestRSVP?.email || identifiedGuest?.email || prev.email,
      phone: guestRSVP?.phone || prev.phone,
      attending: guestRSVP?.attending === false ? 'no' : 'yes',
      attendingDays: guestRSVP?.attendingDays || prev.attendingDays,
      mealChoice: guestRSVP?.mealChoice || prev.mealChoice,
      plusOne: !!guestRSVP?.plusOneName,
      plusOneName: guestRSVP?.plusOneName || prev.plusOneName,
      plusOneMealChoice: guestRSVP?.plusOneMealChoice || prev.plusOneMealChoice,
      dietaryNotes: guestRSVP?.dietaryNotes || prev.dietaryNotes,
      specialNeeds: guestRSVP?.specialNeeds || prev.specialNeeds,
      notes: guestRSVP?.notes || prev.notes,
    }));
  }, [identifiedGuest, guestRSVP]);

  const handleRSVPChange = (field: keyof typeof rsvpForm, value: any) => {
    setRsvpForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRSVPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsvpForm.fullName.trim() || !rsvpForm.email.trim() || !identifiedGuest) return;

    setIsSubmittingRSVP(true);

    const eventName = activeEventName || config?.eventTitle || '';
    const eventKey = normalizeEventKey(eventName);

    const newSubmission: RSVPSubmission = {
      id: guestRSVP?.id || `rsvp-${Date.now()}`,
      guestId: identifiedGuest.id,
      eventName,
      eventKey,
      fullName: rsvpForm.fullName.trim(),
      email: rsvpForm.email.trim(),
      phone: rsvpForm.phone.trim(),
      attending: rsvpForm.attending === 'yes',
      attendingDays: rsvpForm.attending === 'yes' ? rsvpForm.attendingDays : [],
      mealChoice: rsvpForm.attending === 'yes' ? rsvpForm.mealChoice : undefined,
      plusOneName:
        rsvpForm.plusOne && rsvpForm.attending === 'yes'
          ? rsvpForm.plusOneName.trim()
          : undefined,
      plusOneMealChoice:
        rsvpForm.plusOne && rsvpForm.attending === 'yes'
          ? rsvpForm.plusOneMealChoice
          : undefined,
      dietaryNotes: rsvpForm.dietaryNotes.trim() || undefined,
      specialNeeds: rsvpForm.specialNeeds.trim() || undefined,
      notes: rsvpForm.notes.trim() || undefined,
      submittedAt: new Date().toISOString(),
    };

    const updatedSubmissions = guestRSVP
      ? portalData.submissions.map((s) => (s.id === guestRSVP.id ? newSubmission : s))
      : [newSubmission, ...portalData.submissions];

    setPortalData((prev) => ({ ...prev, submissions: updatedSubmissions }));
    setPortalRSVPSubmissions(updatedSubmissions);

    setRsvpSuccess(newSubmission);
    setIsSubmittingRSVP(false);
  };

  const handleAddToCalendar = (item: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime?: string;
  }) => {
    const dtStart = new Date(item.startTime);
    const dtEnd = item.endTime
      ? new Date(item.endTime)
      : new Date(dtStart.getTime() + 60 * 60 * 1000);

    const formatICSDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const escapeICS = (value: string) =>
      value
        .replace(/\\/g, '\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION=2.0',
      'PRODID:-//Wedding Layout Planner//Guest Portal//EN',
      'BEGIN:VEVENT',
      `UID:${item.id}@wedding-layout-planner`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(dtStart)}`,
      `DTEND:${formatICSDate(dtEnd)}`,
      `SUMMARY:${escapeICS(item.title)}`,
      item.location ? `LOCATION:${escapeICS(item.location)}` : '',
      item.description ? `DESCRIPTION:${escapeICS(item.description)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/\s+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGetDirections = () => {
    if (!selectedWayfindingTo) {
      setWayfindingResult(['Please select a destination.']);
      return;
    }

    const fromLabel =
      selectedWayfindingFrom === 'entrance' ? 'Entrance' : selectedWayfindingFrom;
    const toLabel = selectedWayfindingTo;

    setWayfindingResult([
      `Start at ${fromLabel}.`,
      `Walk straight towards ${toLabel}.`,
      'Follow on-site signage for final guidance.',
    ]);
  };

  const lodgingVenues = useMemo(
    () => portalData.venues.filter((v) => v.category === 'lodging'),
    [portalData.venues],
  );

  const guestRoomInfo = useMemo(() => {
    if (!identifiedGuest || !identifiedGuest.roomId) return null;

    const roomId = identifiedGuest.roomId;
    let foundVenue: Venue | null = null;
    let foundFloor: LodgingFloor | null = null;
    let foundRoom: LodgingRoom | null = null;

    for (const v of lodgingVenues) {
      if (!v.floors) continue;

      for (const f of v.floors) {
        const r = f.rooms.find((room) => room.id === roomId);
        if (r) {
          foundVenue = v;
          foundFloor = f;
          foundRoom = r;
          break;
        }
      }

      if (foundRoom) break;
    }

    if (!foundVenue || !foundFloor || !foundRoom) return null;
    return { venue: foundVenue, floor: foundFloor, room: foundRoom };
  }, [identifiedGuest, lodgingVenues]);

  const renderHomeTab = () => {
    return (
      <div className="space-y-4 pb-24">
        {config?.heroImageUrl && (
          <div className="relative w-full h-48 rounded-xl overflow-hidden shadow">
            <SafeImage
              src={config.heroImageUrl}
              alt={config.eventTitle || 'Event hero image'}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 text-sm">
                  Hero image unavailable
                </div>
              }
            />
            <div className="absolute inset-0 bg-black/40 flex items-end">
              <div className="p-4 text-white">
                <h1 className="text-xl font-semibold">
                  {config.eventTitle || 'Wedding Celebration'}
                </h1>
                {eventStartDate && (
                  <p className="text-sm opacity-90">
                    {eventStartDate.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {eventEndDate && ` – ${eventEndDate.toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-4 space-y-2">
          {identifiedGuest && (
            <p className="text-sm text-gray-700">
              Welcome, <span className="font-semibold">{identifiedGuest.name}</span>!
            </p>
          )}

          {config?.welcomeMessage && (
            <div className="prose prose-sm max-w-none text-gray-800">
              {config.welcomeMessage.split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          )}

          {daysUntilEvent !== null && (
            <p className="text-sm text-indigo-600 font-medium">
              {daysUntilEvent === 0
                ? 'Today is the big day!'
                : `${daysUntilEvent} day${daysUntilEvent === 1 ? '' : 's'} until the celebration`}
            </p>
          )}
        </div>

        {isMultiDay && eventStartDate && eventEndDate && (
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">Event Days</h2>
            <p className="text-sm text-gray-700">
              {eventStartDate.toLocaleDateString()} – {eventEndDate.toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {config?.showMap && guestCanViewMap(identifiedGuest, activeEventLabel) && (
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              aria-current={activeTab === 'map' ? 'page' : undefined}
              className="bg-white rounded-xl shadow p-3 flex flex-col items-start justify-between min-h-[80px]"
            >
              <span className="text-2xl mb-1">🗺️</span>
              <span className="text-sm font-medium text-gray-800">View Map</span>
            </button>
          )}

          {config?.showRSVP && guestCanSubmitRSVP(identifiedGuest, activeEventLabel) && (
            <button
              type="button"
              onClick={() => setActiveTab('rsvp')}
              aria-current={activeTab === 'rsvp' ? 'page' : undefined}
              className="bg-white rounded-xl shadow p-3 flex flex-col items-start justify-between min-h-[80px]"
            >
              <span className="text-2xl mb-1">📝</span>
              <span className="text-sm font-medium text-gray-800">RSVP Now</span>
            </button>
          )}

          {config?.showSchedule && guestCanViewSchedule(identifiedGuest, activeEventLabel) && (
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              aria-current={activeTab === 'schedule' ? 'page' : undefined}
              className="bg-white rounded-xl shadow p-3 flex flex-col items-start justify-between min-h-[80px]"
            >
              <span className="text-2xl mb-1">📅</span>
              <span className="text-sm font-medium text-gray-800">View Schedule</span>
            </button>
          )}

          {config?.showWayfinding && (
            <button
              type="button"
              onClick={() => setActiveTab('wayfinding')}
              aria-current={activeTab === 'wayfinding' ? 'page' : undefined}
              className="bg-white rounded-xl shadow p-3 flex flex-col items-start justify-between min-h-[80px]"
            >
              <span className="text-2xl mb-1">🧭</span>
              <span className="text-sm font-medium text-gray-800">Getting Around</span>
            </button>
          )}
        </div>

        {identifiedGuest && (identifiedGuest.tableId || identifiedGuest.roomId) && (
          <div className="bg-white rounded-xl shadow p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-800">Your Details</h2>
            {identifiedGuest.tableId && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Table:</span> {identifiedGuest.tableId}
              </p>
            )}
            {identifiedGuest.roomId && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Room:</span> {identifiedGuest.roomId}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderVenueMapTab = () => {
    if (!config?.showMap) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-sm text-gray-700">Venue map is not available.</p>
          </div>
        </div>
      );
    }

    const enabledCategories = config.enabledVenueCategories || [];
    const venuesToShow = portalData.venues.filter((v) =>
      enabledCategories.length ? enabledCategories.includes(v.category) : true,
    );

    return (
      <div className="space-y-4 pb-24">
        {venuesToShow.map((venue) => (
          <div key={venue.id} className="bg-white rounded-xl shadow p-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">{venue.name}</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 capitalize">
                {venue.category}
              </span>
            </div>

            {/* Venue info card — shows whatever metadata is available */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2 text-xs text-gray-700">
              {venue.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{venue.description}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {venue.capacity > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-gray-400">👥</span>
                    Capacity: <strong>{venue.capacity}</strong>
                  </span>
                )}
                {venue.width > 0 && venue.height > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-gray-400">📐</span>
                    {venue.width} × {venue.height} ft
                  </span>
                )}
              </div>

              {/* Show assigned table/room info for this guest if available */}
              {identifiedGuest?.tableId && (
                <div className="mt-2 flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2">
                  <span className="text-pink-500 text-base">📍</span>
                  <span className="text-pink-700 font-medium text-xs">
                    Your seat is at Table {identifiedGuest.tableId}
                  </span>
                </div>
              )}
              {identifiedGuest?.roomId && venue.category === 'lodging' && (
                <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-blue-500 text-base">🛏️</span>
                  <span className="text-blue-700 font-medium text-xs">
                    Your room: {identifiedGuest.roomId}
                  </span>
                </div>
              )}

              {/* Images if available */}
              {venue.imageUrl && (
                <SafeImage
                  src={venue.imageUrl}
                  alt={venue.name}
                  className="w-full rounded-lg object-cover max-h-48 mt-2"
                  fallback={
                    <div className="w-full h-24 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mt-2 text-xs text-gray-500">
                      Venue image unavailable
                    </div>
                  }
                />
              )}

              {!venue.imageUrl && (
                <div className="w-full h-24 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center mt-2">
                  <span className="text-3xl opacity-40">🏛️</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {venuesToShow.length === 0 && (
          <div className="bg-white rounded-xl shadow p-4 mt-4 text-center space-y-2">
            <p className="text-2xl">🗺️</p>
            <p className="text-sm font-medium text-gray-700">Venue map coming soon</p>
            <p className="text-xs text-gray-500">
              The venue coordinator will publish location details here.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderScheduleTab = () => {
    if (!config?.showSchedule) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-sm text-gray-700">Schedule is not available.</p>
          </div>
        </div>
      );
    }

    // B-09 fix: read schedule items from config instead of a hardcoded empty array.
    const scheduleItems: PortalScheduleItem[] = config.scheduleItems ?? [];

    if (!scheduleItems.length) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4 text-center space-y-2">
            <p className="text-2xl">📅</p>
            <p className="text-sm font-medium text-gray-700">Schedule coming soon</p>
            <p className="text-xs text-gray-500">
              The venue coordinator will publish the event timeline here. Check back closer to the event date!
            </p>
          </div>
        </div>
      );
    }

    const days = isMultiDay
      ? Array.from(new Set(scheduleItems.map((i) => i.dayIndex || 0)))
      : [0];

    const itemsForDay = (dayIdx: number) =>
      scheduleItems
        .filter((i) => (isMultiDay ? (i.dayIndex || 0) === dayIdx : true))
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );

    return (
      <div className="space-y-4 pb-24">
        {isMultiDay && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {days.map((d, idx) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDayIndex(d)}
                className={`px-3 py-1.5 text-xs rounded-full border ${
                  selectedDayIndex === d
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                Day {idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 mt-2">
          {itemsForDay(selectedDayIndex).map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow p-4 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">
                    {new Date(item.startTime).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {item.endTime &&
                      ` – ${new Date(item.endTime).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`}
                  </p>
                  <p
                    className={`text-sm ${
                      item.isHighlight
                        ? 'font-semibold text-indigo-700'
                        : 'font-medium text-gray-800'
                    }`}
                  >
                    {item.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddToCalendar(item)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 text-indigo-700"
                >
                  Add to Calendar
                </button>
              </div>

              {item.location && (
                <p className="text-xs text-gray-600">Location: {item.location}</p>
              )}
              {item.description && (
                <p className="text-xs text-gray-600">{item.description}</p>
              )}
            </div>
          ))}

          {itemsForDay(selectedDayIndex).length === 0 && (
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-700">No schedule items for this day yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWayfindingTab = () => {
    if (!config?.showWayfinding) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-sm text-gray-700">Wayfinding is not available.</p>
          </div>
        </div>
      );
    }

    // B-09 fix: read wayfinding points from config.
    const wayfindingPoints: PortalWayfindingPoint[] = config.wayfindingPoints ?? [];
    const hasWayfindingPoints = wayfindingPoints.length > 0;

    if (!hasWayfindingPoints) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4 text-center space-y-2">
            <p className="text-2xl">🧭</p>
            <p className="text-sm font-medium text-gray-700">Directions coming soon</p>
            <p className="text-xs text-gray-500">
              Venue maps and turn-by-turn directions will be available here. Contact the venue for early access.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 pb-24">
        <div className="bg-white rounded-xl shadow p-4 mt-4">
          <div className="relative w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500">
            <span>Wayfinding map with pins and paths will appear here.</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-700">From</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={selectedWayfindingFrom}
                onChange={(e) =>
                  setSelectedWayfindingFrom(
                    e.target.value === 'entrance' ? 'entrance' : e.target.value,
                  )
                }
              >
                <option value="entrance">Entrance</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-700">To</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={selectedWayfindingTo}
                onChange={(e) => setSelectedWayfindingTo(e.target.value)}
              >
                <option value="">Select destination</option>
                {wayfindingPoints.map((pt) => (
                  <option key={pt.id} value={pt.label}>{pt.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGetDirections}
              className="w-full mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
            >
              Get Directions
            </button>
          </div>

          {wayfindingResult && (
            <div className="mt-4 bg-indigo-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-indigo-800">Directions</p>
              <ul className="text-xs text-indigo-900 list-disc list-inside space-y-1">
                {wayfindingResult.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRSVPTab = () => {
    if (!config?.showRSVP) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-sm text-gray-700">RSVP is not available.</p>
          </div>
        </div>
      );
    }

    if (rsvpClosed && !guestRSVP) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800">RSVP period has closed.</p>
            {rsvpDeadline && (
              <p className="text-sm text-gray-700">
                The RSVP deadline was{' '}
                {rsvpDeadline.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                .
              </p>
            )}
          </div>
        </div>
      );
    }

    if (rsvpSuccess) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4 space-y-3 relative overflow-hidden">
            <div className="absolute -top-4 -left-4 w-16 h-16 bg-pink-200 rounded-full opacity-60" />
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-200 rounded-full opacity-60" />

            <div className="relative space-y-2">
              <p className="text-sm font-semibold text-gray-800">
                Thank you for your RSVP!
              </p>
              <p className="text-sm text-gray-700">
                We&apos;ve recorded your response for{' '}
                <span className="font-medium">{rsvpSuccess.fullName}</span>.
              </p>

              <div className="text-xs text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold">Attending:</span>{' '}
                  {rsvpSuccess.attending ? 'Yes' : 'No'}
                </p>

                {rsvpSuccess.attending && rsvpSuccess.mealChoice && (
                  <p>
                    <span className="font-semibold">Meal:</span>{' '}
                    {rsvpSuccess.mealChoice}
                  </p>
                )}

                {rsvpSuccess.plusOneName && (
                  <p>
                    <span className="font-semibold">Plus One:</span>{' '}
                    {rsvpSuccess.plusOneName}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setRsvpSuccess(null)}
                className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
              >
                Edit RSVP
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="pb-24">
        <form
          onSubmit={handleRSVPSubmit}
          className="bg-white rounded-xl shadow p-4 mt-4 space-y-4"
        >
          {config?.rsvpMessage && (
            <div className="text-sm text-gray-700">
              {config.rsvpMessage.split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          )}

          <div className="space-y-2">
	    <label
  					htmlFor="guest-rsvp-full-name"
  					className="text-xs font-medium text-gray-700"
	    >
  					Full Name<span className="text-red-500">*</span>
	          </label>
	    <input
  					id="guest-rsvp-full-name"
  					type="text"
  					className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
  					value={rsvpForm.fullName}
  					onChange={(e) => handleRSVPChange('fullName', e.target.value)}
  					required
	           />
          </div>

          <div className="space-y-2">
	    <label
  					htmlFor="guest-rsvp-email"
  					className="text-xs font-medium text-gray-700"
	    >
  					Email<span className="text-red-500">*</span>
	    </label>
	          <input
  					id="guest-rsvp-email"
  					type="email"
  					className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
  					value={rsvpForm.email}
  					onChange={(e) => handleRSVPChange('email', e.target.value)}
  					required
	          />
          </div>

          <div className="space-y-2">
	    <label
  					htmlFor="guest-rsvp-phone"
  					className="text-xs font-medium text-gray-700"
	    >
  					Phone
	          </label>
	          <input
  					id="guest-rsvp-phone"
  					type="tel"
  					className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
  					value={rsvpForm.phone}
  					onChange={(e) => handleRSVPChange('phone', e.target.value)}
	    />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              Will you be attending?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleRSVPChange('attending', 'yes')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                  rsvpForm.attending === 'yes'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-800 border-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleRSVPChange('attending', 'no')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                  rsvpForm.attending === 'no'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-800 border-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {rsvpForm.attending === 'yes' && (
            <>
              {isMultiDay && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700">
                    Which days will you attend?
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={rsvpForm.attendingDays.includes('day1')}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          handleRSVPChange(
                            'attendingDays',
                            checked
                              ? Array.from(new Set([...rsvpForm.attendingDays, 'day1']))
                              : rsvpForm.attendingDays.filter((d) => d !== 'day1'),
                          );
                        }}
                      />
                      Day 1
                    </label>
                  </div>
                </div>
              )}

              <div className="space-y-2">
		<label
  						htmlFor="guest-rsvp-meal-choice"
  						className="text-xs font-medium text-gray-700"
		>
  						Meal choice
		</label>
		<select
  						id="guest-rsvp-meal-choice"
  						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
  						value={rsvpForm.mealChoice}
  						onChange={(e) => handleRSVPChange('mealChoice', e.target.value)}
		>
                  <option value="standard">Standard</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="gluten-free">Gluten-free</option>
                  <option value="kids">Kids</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={rsvpForm.plusOne}
                    onChange={(e) => handleRSVPChange('plusOne', e.target.checked)}
                  />
                  Bringing a plus one?
                </label>

                {rsvpForm.plusOne && (
                  <div className="space-y-2 mt-2">
                    <input
                      type="text"
                      placeholder="Plus one full name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={rsvpForm.plusOneName}
                      onChange={(e) => handleRSVPChange('plusOneName', e.target.value)}
                    />
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={rsvpForm.plusOneMealChoice}
                      onChange={(e) =>
                        handleRSVPChange('plusOneMealChoice', e.target.value)
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="gluten-free">Gluten-free</option>
                      <option value="kids">Kids</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
		<label
  						htmlFor="guest-rsvp-dietary-notes"
  						className="text-xs font-medium text-gray-700"
		>
  						Dietary restrictions or allergies
		</label>
		<textarea
  						id="guest-rsvp-dietary-notes"
  						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px]"
  						value={rsvpForm.dietaryNotes}
  						onChange={(e) => handleRSVPChange('dietaryNotes', e.target.value)}
		/>
              </div>

              <div className="space-y-2">
		<label
  						htmlFor="guest-rsvp-special-needs"
  						className="text-xs font-medium text-gray-700"
		>
  						Accessibility or special needs
		</label>
		<textarea
  						id="guest-rsvp-special-needs"
  						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px]"
  						value={rsvpForm.specialNeeds}
  						onChange={(e) => handleRSVPChange('specialNeeds', e.target.value)}
		/>
              </div>
            </>
          )}

          <div className="space-y-2">
            <label
  					htmlFor="guest-rsvp-notes"
  					className="text-xs font-medium text-gray-700"
	    >
  					Message to the couple
	    </label>
	          <textarea
  					id="guest-rsvp-notes"
  					className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px]"
  					value={rsvpForm.notes}
 					 onChange={(e) => handleRSVPChange('notes', e.target.value)}
	           />
          </div>

          <button
            type="submit"
            disabled={isSubmittingRSVP}
            className="w-full mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {isSubmittingRSVP ? 'Submitting...' : 'Submit RSVP'}
          </button>
        </form>
      </div>
    );
  };

  const renderLodgingTab = () => {
    if (!config?.showLodging) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-sm text-gray-700">Lodging information is not available.</p>
          </div>
        </div>
      );
    }

    if (!lodgingVenues.length) {
      return (
        <div className="pb-24">
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-sm text-gray-700">Lodging details will be shared soon.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 pb-24">
        {guestRoomInfo && (
          <div className="bg-white rounded-xl shadow p-4 mt-4 space-y-1">
            <p className="text-sm font-semibold text-gray-800">
              Your Room: {guestRoomInfo.room.name}
            </p>
            <p className="text-xs text-gray-700">
              Venue: {guestRoomInfo.venue.name}
            </p>
            <p className="text-xs text-gray-700">
              Floor: {guestRoomInfo.floor.name}
            </p>
          </div>
        )}

        {lodgingVenues.map((venue) => (
          <div key={venue.id} className="bg-white rounded-xl shadow p-4 mt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">{venue.name}</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                Lodging
              </span>
            </div>

            <div className="relative w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500">
              <span>Lodging floor plan preview.</span>
              {guestRoomInfo && guestRoomInfo.venue.id === venue.id && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500 animate-ping" />
                  <div className="absolute text-xs font-semibold text-emerald-700 bg-white/80 px-2 py-1 rounded-full shadow">
                    Your Room
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-800">Rooms</p>
              <p className="text-xs text-gray-600">
                Room list and amenities will appear here based on saved lodging layout.
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHomeTab();
      case 'map':
        return renderVenueMapTab();
      case 'schedule':
        return renderScheduleTab();
      case 'wayfinding':
        return renderWayfindingTab();
      case 'rsvp':
        return renderRSVPTab();
      case 'lodging':
        return renderLodgingTab();
      default:
        return null;
    }
  };

  const renderSignInGate = () => {
    // Determine if portal has a known status to surface in the sign-in UI
    const portalUnavailable = config && !isGuestPortalEventActive(config);
    const portalNotConfigured = !config;

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100 flex flex-col">
        <header className="px-4 pt-4 pb-2 flex items-center justify-between bg-white/60 backdrop-blur-sm border-b border-indigo-100">
          <button
            type="button"
            onClick={onExitPortal}
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
            aria-label="Return to login screen"
          >
            ← Back to Login
          </button>
          <h1 className="text-sm font-semibold text-gray-800">🌸 Guest Portal</h1>
          <div className="w-24" />
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm space-y-4">
            {/* Hero card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center space-y-1">
              <div className="text-4xl mb-2">💍</div>
              <h2 className="text-lg font-bold text-gray-900">
                {config?.eventTitle || 'Wedding Guest Portal'}
              </h2>
              {config?.eventStartDate && (
                <p className="text-xs text-gray-500">
                  {new Date(config.eventStartDate).toLocaleDateString(undefined, {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                  {config?.eventEndDate &&
                    config.eventEndDate !== config.eventStartDate &&
                    ` – ${new Date(config.eventEndDate).toLocaleDateString(undefined, {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}`}
                </p>
              )}
            </div>

            {/* Status banners */}
            {portalNotConfigured && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <strong>Portal not yet configured.</strong> Please contact the venue coordinator for your event access details.
              </div>
            )}
            {portalUnavailable && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
                <strong>Guest access has closed.</strong> Access is available until the day after the event ends. Contact the venue coordinator if you need assistance.
              </div>
            )}

            {/* Sign-in form */}
            <form
              onSubmit={(e) => { void handleGuestPortalSignIn(e); }}
              className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
              aria-label="Guest portal sign-in"
            >
              <div>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  Enter your event name and the email or name your venue has on file to access RSVP, schedule, lodging, and directions.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4 text-[11px] text-gray-600">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="font-semibold text-gray-800">📝 RSVP</div>
                    <div>Confirm attendance and meal choices.</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="font-semibold text-gray-800">📅 Schedule</div>
                    <div>See the latest event timing and highlights.</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="font-semibold text-gray-800">🗺️ Map</div>
                    <div>Review locations, wayfinding, and arrival details.</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="font-semibold text-gray-800">🛏️ Lodging</div>
                    <div>Check room assignments when lodging is enabled.</div>
                  </div>
                </div>

                <label
                  htmlFor="guest-portal-event"
                  className="text-sm font-semibold text-gray-800 block mb-1"
                >
                  Event Name or Code
                </label>
                <input
                  id="guest-portal-event"
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  value={eventInput}
                  onChange={(e) => setEventInput(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  placeholder={config?.eventTitle ? config.eventTitle : 'e.g. Smith-Johnson Wedding'}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-portal-guest-identifier"
                  className="text-sm font-semibold text-gray-800 block mb-1"
                >
                  Guest Email or Name
                </label>
                <input
                  id="guest-portal-guest-identifier"
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  value={guestIdentifier}
                  onChange={(e) => setGuestIdentifier(e.target.value)}
                  autoComplete="off"
                  placeholder="jane@example.com or Jane Smith"
                />
              </div>

              {requiresPortalPassword && (
                <div>
                  <label
                    htmlFor="guest-portal-password"
                    className="text-sm font-semibold text-gray-800 block mb-1"
                  >
                    Portal Password
                  </label>
                  <input
                    id="guest-portal-password"
                    type="password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter the event password"
                  />
                </div>
              )}

              {passwordError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  <span className="text-red-500 text-sm mt-0.5">⚠</span>
                  <p className="text-xs text-red-700">{passwordError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!eventInput.trim() || !guestIdentifier.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Access My Portal →
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 pb-4">
              Need help? Contact your venue coordinator.
            </p>
          </div>
        </main>
      </div>
    );
  };

  // FIX: Show the sign-in gate first so guests always have a form to interact with.
  // Config / activity errors are surfaced as form-level messages in handleGuestPortalSignIn.
  if (needsEventScopedSignIn) {
    return renderSignInGate();
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-sm w-full text-center space-y-3">
          <div className="text-3xl">🌸</div>
          <p className="text-base font-semibold text-gray-800">Portal Not Configured</p>
          <p className="text-sm text-gray-600">
            The guest portal has not been set up yet. Please contact the venue coordinator for access details.
          </p>
          <button
            type="button"
            onClick={onExitPortal}
            className="mt-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!isGuestPortalEventActive(config)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-sm w-full text-center space-y-3">
          <div className="text-3xl">📅</div>
          <p className="text-base font-semibold text-gray-800">
            Guest Portal Has Closed
          </p>
          <p className="text-sm text-gray-600 text-center">
            Guest access automatically closes the day after the event ends. We hope you had a wonderful time celebrating!
          </p>
          <button
            type="button"
            onClick={onExitPortal}
            className="mt-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const showMapTab = !!config.showMap;
  const showScheduleTab = !!config.showSchedule;
  const showWayfindingTab = !!config.showWayfinding;
  const showRSVPTab = !!config.showRSVP;
     const showLodgingTab =
           !!config.showLodging &&
    	 lodgingVenues.length > 0 &&
    	   guestCanAccessLodging(
      	   	identifiedGuest,
      	   	activeEventName || config.eventTitle || '',
     );
  const tabPanelId = `guest-portal-panel-${activeTab}`;
  const desktopTabProps = (tabId: TabId) => ({
    role: 'tab' as const,
    id: `guest-portal-tab-${tabId}`,
    'aria-selected': activeTab === tabId,
    'aria-controls': `guest-portal-panel-${tabId}`,
    type: 'button' as const,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 px-4 pt-3 pb-3 flex items-center justify-between bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <button
          type="button"
          onClick={onExitPortal}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Return to login screen"
        >
          ← Exit
        </button>
        <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[55%] text-center">
          🌸 {config.eventTitle || 'Guest Portal'}
        </h1>
        {identifiedGuest ? (
          <span className="text-xs text-gray-500 truncate max-w-[80px] text-right">
            Hi, {identifiedGuest.name.split(' ')[0]}!
          </span>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <nav className="hidden md:flex px-4 pb-2 gap-2 text-xs" role="tablist" aria-label="Guest portal sections">
        <button
          {...desktopTabProps('home')}
          onClick={() => setActiveTab('home')}
          className={`px-3 py-1.5 rounded-full ${
            activeTab === 'home'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          🏠 Home
        </button>

        {showMapTab && (
          <button
            {...desktopTabProps('map')}
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-full ${
              activeTab === 'map'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            🗺️ Venue Map
          </button>
        )}

        {showScheduleTab && (
          <button
            {...desktopTabProps('schedule')}
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 rounded-full ${
              activeTab === 'schedule'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            📅 Schedule
          </button>
        )}

        {showWayfindingTab && (
          <button
            {...desktopTabProps('wayfinding')}
            onClick={() => setActiveTab('wayfinding')}
            className={`px-3 py-1.5 rounded-full ${
              activeTab === 'wayfinding'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            🧭 Getting Around
          </button>
        )}

        {showRSVPTab && (
          <button
            {...desktopTabProps('rsvp')}
            onClick={() => setActiveTab('rsvp')}
            className={`px-3 py-1.5 rounded-full ${
              activeTab === 'rsvp'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            📝 RSVP
          </button>
        )}

        {showLodgingTab && (
          <button
            {...desktopTabProps('lodging')}
            onClick={() => setActiveTab('lodging')}
            className={`px-3 py-1.5 rounded-full ${
              activeTab === 'lodging'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            🛏️ Lodging
          </button>
        )}
      </nav>

      <main
        className="flex-1 px-4 pt-2 pb-20 md:pb-6 overflow-y-auto"
        role="tabpanel"
        id={tabPanelId}
        aria-labelledby={`guest-portal-tab-${activeTab}`}
        tabIndex={0}
      >
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-gray-200 shadow-sm" aria-label="Guest portal sections">
        <div className="flex justify-around py-1">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-current={activeTab === 'home' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center px-2 py-1 min-w-[64px] ${
              activeTab === 'home' ? 'text-indigo-600' : 'text-gray-500'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span className="text-[11px]">Home</span>
          </button>

          {showMapTab && (
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              aria-current={activeTab === 'map' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center px-2 py-1 min-w-[64px] ${
                activeTab === 'map' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">🗺️</span>
              <span className="text-[11px]">Map</span>
            </button>
          )}

          {showScheduleTab && (
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              aria-current={activeTab === 'schedule' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center px-2 py-1 min-w-[64px] ${
                activeTab === 'schedule' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">📅</span>
              <span className="text-[11px]">Schedule</span>
            </button>
          )}

          {showWayfindingTab && (
            <button
              type="button"
              onClick={() => setActiveTab('wayfinding')}
              aria-current={activeTab === 'wayfinding' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center px-2 py-1 min-w-[64px] ${
                activeTab === 'wayfinding' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">🧭</span>
              <span className="text-[11px]">Around</span>
            </button>
          )}

          {showRSVPTab && (
            <button
              type="button"
              onClick={() => setActiveTab('rsvp')}
              aria-current={activeTab === 'rsvp' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center px-2 py-1 min-w-[64px] ${
                activeTab === 'rsvp' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">📝</span>
              <span className="text-[11px]">RSVP</span>
            </button>
          )}

          {showLodgingTab && (
            <button
              type="button"
              onClick={() => setActiveTab('lodging')}
              aria-current={activeTab === 'lodging' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center px-2 py-1 min-w-[64px] ${
                activeTab === 'lodging' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">🛏️</span>
              <span className="text-[11px]">Lodging</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

export default GuestPortal;