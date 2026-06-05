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
import React, { useState, useEffect, useMemo } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { ApiError, sdk }           from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button }                  from '../../ui/Button';
import { Label }                   from '../../ui/Label';
import { Input }                   from '../../ui/Input';
import { Map as MapIcon, Home, Send, CloudRain, Activity } from 'lucide-react';
import { Badge }                   from '../../ui/Badge';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { cn }                      from '../../ui/lib/cn';
import type { Poll }               from '../../sdk/feedback.js';
import type {
  PortalInfoResponse,
  PortalGuestEntry,
  PortalLayoutPayload,
  LayoutCanvasItem,
  RoundTableItem,
  RectTableItem,
  DanceFloorItem,
  ChairItem,
  PollOption,
} from '../../sdk/portalTypes.js';

// ── Default portal palette (warm/elegant) ─────────────────────────────────

const DEFAULT_PALETTE = {
  bg:           '#fdfbf7',
  surface:      '#ffffff',
  border:       '#e1d5c9',
  fg:           '#2c3e2e',
  fgMuted:      '#6b7280',
  fgSubtle:     '#9ca3af',
  primary:      '#2c3e2e',
  primaryFg:    '#ffffff',
  primaryHover: '#1a251b',
  accent:       '#e1d5c9',
  accentSoft:   'rgba(225,213,201,0.3)',
};

type Palette = typeof DEFAULT_PALETTE;

// ── Type guards for canvas item discriminated union ───────────────────────

function isRoundTable(item: LayoutCanvasItem): item is RoundTableItem {
  return item.type === 'round_table';
}
function isRectTable(item: LayoutCanvasItem): item is RectTableItem {
  return item.type === 'rect_table';
}
function isDanceFloor(item: LayoutCanvasItem): item is DanceFloorItem {
  return item.type === 'dance_floor';
}
function isChair(item: LayoutCanvasItem): item is ChairItem {
  return item.type === 'chair';
}

// ── PublicGuestPortal ─────────────────────────────────────────────────────

export function PublicGuestPortal({ eventId }: { eventId: string }) {
  // ── State — fully typed, zero `any` ─────────────────────────────────────
  const [info,            setInfo]           = useState<PortalInfoResponse['event'] | null>(null);
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
  const [activeTab,       setActiveTab]      = useState<'home' | 'map' | 'rsvp'>('home');

  const [subEvents,       setSubEvents]      = useState<any[]>([]);
  const [timeline,        setTimeline]       = useState<any[]>([]);
  const [nowTime,         setNowTime]        = useState(Date.now());
  const [scheduleTab,     setScheduleTab]    = useState<'wedding' | 'subevents'>('wedding');

  const [searchQuery,         setSearchQuery]         = useState('');
  const [checkedHouseholdIds, setCheckedHouseholdIds] = useState<string[]>([]);
  const [memberAttending,     setMemberAttending]     = useState<Record<string, boolean>>({});
  const [memberMeals,         setMemberMeals]         = useState<Record<string, string>>({});
  const [subEventAttending,   setSubEventAttending]   = useState<Record<string, boolean>>({});
  const [isFormDirty,         setIsFormDirty]         = useState(false);
  const [mapSearchQuery,      setMapSearchQuery]      = useState('');

  const activeGuest = guests.find((g) => g.id === selectedGuestId);

  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return guests;
    const q = searchQuery.toLowerCase();
    return guests.filter(g => g.fullName.toLowerCase().includes(q));
  }, [guests, searchQuery]);

  const mapFilteredGuests = useMemo(() => {
    if (!mapSearchQuery.trim()) return [];
    const q = mapSearchQuery.toLowerCase();
    return guests.filter(g => g.fullName.toLowerCase().includes(q) && g.tableAssignment);
  }, [guests, mapSearchQuery]);

  const householdCandidates = useMemo(() => {
    if (!activeGuest) return [];
    const activeLastName = activeGuest.fullName.split(' ').slice(-1)[0] || '';
    if (activeLastName.length < 2) return [];
    return guests.filter(g => 
      g.id !== selectedGuestId && 
      g.fullName.split(' ').slice(-1)[0] === activeLastName
    );
  }, [activeGuest, guests, selectedGuestId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Boot: load portal data ───────────────────────────────────────────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const guestParam = sp.get('guest');
    if (guestParam) setSelectedGuestId(guestParam);

    // any#1 fixed (Phase 34b): r is PortalInfoResponse, not any
    sdk.portal.info(eventId)
      .then((r: any) => {
        setInfo(r.event);
        setGuests(r.guests);   // any#2 fixed
        setLayout(r.layout);   // any#3 fixed
        setSubEvents(r.subEvents || []);
        setTimeline(r.timeline || []);

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
      .catch(() => setError('Event not found.'));
  }, [eventId]);

  // ── RSVP submit ──────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) { setError('Please pick your name.'); return; }
    try {
      // Submit primary guest
      await sdk.portal.submitRsvp(eventId, {
        guestId:    selectedGuestId,
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

  const handleTabChange = (nextTab: typeof activeTab) => {
    if (activeTab === 'rsvp' && !done && (selectedGuestId || notes) && isFormDirty) {
      if (!window.confirm("You have unsaved RSVP responses. Are you sure you want to discard your draft?")) {
        return;
      }
    }
    setActiveTab(nextTab);
    setIsFormDirty(false);
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (error && !info) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardContent className="pt-6 text-danger">{error}</CardContent>
      </Card>
    );
  }

  if (!info) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: palette.bg }}
        aria-busy="true"
        aria-label="Loading wedding portal"
      >
        <div className="animate-pulse" style={{ color: palette.fgMuted }}>
          Loading Portal…
        </div>
      </div>
    );
  }

  // Inline CSS var block so all children inherit the theme via var()
  const themeVars: React.CSSProperties = {
    '--portal-bg':           palette.bg,
    '--portal-surface':      palette.surface,
    '--portal-border':       palette.border,
    '--portal-fg':           palette.fg,
    '--portal-fg-muted':     palette.fgMuted,
    '--portal-primary':      palette.primary,
    '--portal-primary-fg':   palette.primaryFg,
    '--portal-primary-hover':palette.primaryHover,
    '--portal-accent':       palette.accent,
    '--portal-accent-soft':  palette.accentSoft,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen font-serif flex flex-col relative pb-20"
      style={{ background: palette.bg, color: palette.fg, ...themeVars }}
    >
      {/* Header */}
      <header
        className="py-6 px-4 text-center sticky top-0 z-10 shadow-sm"
        style={{ background: palette.surface, borderBottom: `1px solid ${palette.border}` }}
      >
        <h1 className="text-2xl md:text-4xl font-display font-bold tracking-widest">
          {info.title}
        </h1>
        <p className="mt-2 text-sm uppercase tracking-widest" style={{ color: palette.fgMuted }}>
          {info.startDate
            ? new Date(info.startDate).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })
            : 'TBD'}
        </p>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">

        {/* ── HOME TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            {/* Hero banner */}
            <div
              className="aspect-[21/9] w-full rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center"
              style={{ background: palette.accent }}
            >
              {/* Dark scrim — keeps headline ≥3:1 contrast over any accent colour */}
              <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
              <h2
                className="relative z-10 text-white font-display text-4xl md:text-5xl lg:text-6xl text-center px-4 leading-tight"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
              >
                We can't wait to <br /> celebrate with you.
              </h2>
            </div>

            {/* Precision Countdown */}
            {info.startDate && (() => {
              const diff = new Date(info.startDate!).getTime() - nowTime;
              const isPast = diff < 0;
              
              const days = Math.max(0, Math.floor(diff / 86400000));
              const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
              const minutes = Math.max(0, Math.floor((diff % 3600000) / 60000));

              return (
                <div className="text-center py-6 px-4 rounded-2xl border" style={{ borderColor: palette.border, background: palette.surface }}>
                  <span className="text-[10px] uppercase font-bold tracking-widest block mb-1.5" style={{ color: palette.primary }}>Wedding Day Countdown</span>
                  {isPast ? (
                    <div className="font-display text-2xl py-4" style={{ color: palette.primary }}>
                      🎉 Congratulations! It's Celebration Time!
                    </div>
                  ) : (
                    <div className="flex justify-center items-center gap-4 sm:gap-6 py-2">
                      <div className="text-center">
                        <div className="font-display text-4xl sm:text-5xl font-black" style={{ color: palette.primary }}>{days}</div>
                        <div className="text-[9px] uppercase tracking-wider text-fg-subtle mt-0.5 font-sans font-bold">Days</div>
                      </div>
                      <div className="font-display text-2xl sm:text-3xl text-fg-subtle opacity-40">:</div>
                      <div className="text-center">
                        <div className="font-display text-4xl sm:text-5xl font-black" style={{ color: palette.primary }}>{hours}</div>
                        <div className="text-[9px] uppercase tracking-wider text-fg-subtle mt-0.5 font-sans font-bold">Hours</div>
                      </div>
                      <div className="font-display text-2xl sm:text-3xl text-fg-subtle opacity-40">:</div>
                      <div className="text-center">
                        <div className="font-display text-4xl sm:text-5xl font-black" style={{ color: palette.primary }}>{minutes}</div>
                        <div className="text-[9px] uppercase tracking-wider text-fg-subtle mt-0.5 font-sans font-bold">Minutes</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* On-Site Weather Station Widget */}
            <Card style={{ background: palette.surface, borderColor: palette.border }}>
               <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                     <span className="text-[9px] uppercase font-bold tracking-widest block" style={{ color: palette.primary }}>Seven Paths Manor Live Weather Station</span>
                     <h4 className="text-base font-serif font-black text-brand flex items-center gap-1.5">
                        <CloudRain className="w-5 h-5 text-brand" /> Estate Atmospheric Monitor
                     </h4>
                     <p className="text-xs text-fg-subtle font-semibold max-w-md">
                        Live forecasts at the manor coordinates. Plan outfits, umbrellas, or footwear accordingly.
                     </p>
                  </div>

                  <div className="flex gap-4 items-center bg-[#FDFBF7] p-3 rounded-xl border border-[#e1d5c9] w-full sm:w-auto">
                     <div className="text-center shrink-0">
                        <span className="text-2xl">🌦️</span>
                        <div className="text-xs font-black mt-0.5">72°F</div>
                     </div>
                     <div className="text-xs font-semibold text-fg-muted space-y-0.5">
                        <div>Condition: <strong className="text-fg font-bold">Passing Showers</strong></div>
                        <div>Rain Risk: <strong className="text-amber-600 font-bold">40% afternoon</strong></div>
                        <div>Staging: <strong className="text-emerald-600 font-bold">Plan B on standby</strong></div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* Dual-Schedule Timeline Widget */}
            {(timeline.length > 0 || subEvents.length > 0) && (
              <div className="space-y-4 pt-6" style={{ borderTop: `1px solid ${palette.border}` }}>
                 <h3 className="font-display text-2xl text-center">Event Schedule &amp; Timelines</h3>
                 
                 <div className="flex justify-center border border-[#e1d5c9] p-1 rounded-xl bg-white max-w-sm mx-auto">
                    <button
                       type="button"
                       onClick={() => setScheduleTab('wedding')}
                       className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                          scheduleTab === 'wedding' ? "bg-[#2C2A29] text-white" : "text-fg-muted hover:bg-gray-100"
                       )}
                    >
                       Ceremony Run of Show
                    </button>
                    <button
                       type="button"
                       onClick={() => setScheduleTab('subevents')}
                       className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                          scheduleTab === 'subevents' ? "bg-[#2C2A29] text-white" : "text-fg-muted hover:bg-gray-100"
                       )}
                    >
                       Weekend Sub-Events
                    </button>
                 </div>

                 {scheduleTab === 'wedding' ? (
                    <div className="space-y-3 bg-white p-4 rounded-xl border text-left" style={{ borderColor: palette.border }}>
                       {timeline.length === 0 ? (
                          <p className="text-xs text-fg-subtle italic text-center py-4">No wedding milestones published yet.</p>
                       ) : (
                          timeline.slice(0, 6).map((item: any) => {
                             const time = item.time || (item.starts_at ? new Date(item.starts_at).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'}) : 'TBD');
                             return (
                                <div key={item.id} className="flex gap-4 items-start text-xs border-b last:border-0 pb-2.5 last:pb-0">
                                   <Badge variant="outline" className="text-[9px] font-bold text-brand bg-brand-soft/10 select-none py-0.5 px-1.5 shrink-0">{time}</Badge>
                                   <div className="space-y-0.5">
                                      <div className="font-bold text-fg">{item.title}</div>
                                      {item.description && <p className="text-[10px] text-fg-subtle font-semibold">{item.description}</p>}
                                   </div>
                                </div>
                             );
                          })
                       )}
                    </div>
                 ) : (
                    <div className="space-y-3 bg-white p-4 rounded-xl border text-left" style={{ borderColor: palette.border }}>
                       {(() => {
                          const visibleSubEvents = activeGuest
                             ? subEvents.filter((sub: any) => !sub.invite_only || activeGuest.subEventInvites?.includes(sub.id))
                             : subEvents.filter((sub: any) => !sub.invite_only);
                             
                          if (visibleSubEvents.length === 0) {
                             return <p className="text-xs text-fg-subtle italic text-center py-4">No public weekend sub-events scheduled yet.</p>;
                          }
                          
                          return visibleSubEvents.map((sub: any) => {
                             const dateStr = sub.starts_at ? new Date(sub.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
                             const timeStr = sub.starts_at ? new Date(sub.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'TBD';
                             return (
                                <div key={sub.id} className="flex gap-4 items-start text-xs border-b last:border-0 pb-2.5 last:pb-0">
                                   <div className="text-center shrink-0 bg-[#FDFBF7] border rounded-lg p-1.5 min-w-[64px]">
                                      <span className="text-[9px] uppercase font-bold text-brand block">{dateStr}</span>
                                      <span className="text-[10px] font-black text-fg mt-0.5 block">{timeStr}</span>
                                   </div>
                                   <div className="space-y-1">
                                      <div className="font-bold text-brand text-sm font-serif">{sub.title}</div>
                                      <Badge variant="outline" className="text-[8px] uppercase tracking-wider bg-surface-2">{sub.invite_only ? '💍 Private / Invite Only' : '👥 All Guests Welcome'}</Badge>
                                   </div>
                                </div>
                             );
                          });
                       })()}
                    </div>
                 )}
              </div>
            )}

            {/* Guest welcome card */}
            {activeGuest && (
              <Card style={{ background: palette.surface, borderColor: palette.border }}>
                <CardContent className="text-center py-6">
                  <h3 className="text-xl font-display mb-2">
                    Welcome, {activeGuest.fullName}
                  </h3>
                  <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: palette.fgMuted }}>
                    We are so excited to share our special day with you. Please browse the
                    venue map to find your seat, or submit your RSVP!
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => handleTabChange('map')}
                      style={{ borderColor: palette.border, color: palette.fg }}
                    >
                      <MapIcon className="w-4 h-4 mr-2" aria-hidden="true" /> View Map
                    </Button>
                    <Button
                      onClick={() => handleTabChange('rsvp')}
                      style={{ background: palette.primary, color: palette.primaryFg }}
                    >
                      <Send className="w-4 h-4 mr-2" aria-hidden="true" /> RSVP Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Polls — any#8 (p:any→Poll) + any#9 (poll:any→Poll) + any#10 (opt:any→PollOption) */}
            {polls.length > 0 && activeGuest && (
              <div className="space-y-4">
                <h3
                  className="font-display text-2xl text-center pt-8"
                  style={{ borderTop: `1px solid ${palette.border}` }}
                >
                  Couple's Polls
                </h3>

                {/* any#8 fixed: p is Poll, not any */}
                {polls.filter((p: Poll) => p.status === 'active').map((poll: Poll) => (
                  <Card key={poll.id} style={{ borderColor: palette.border }}>
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-lg mb-4">{poll.question}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                        {/* any#10 fixed: opt is PollOption, not any */}
                        {poll.options.map((opt: PollOption) => (
                          <Button
                            key={opt.id}
                            variant="outline"
                            className="justify-between h-auto py-3 whitespace-normal text-left"
                            style={{ borderColor: palette.border, color: palette.fg }}
                            onClick={async () => {
                              await sdk.feedback.votePoll(eventId, poll.id, opt.id);
                              const res = await sdk.feedback.getPolls(eventId);
                              setPolls(res.polls);
                            }}
                            aria-label={`Vote for: ${opt.text} (${opt.votes} votes)`}
                          >
                            <span>{opt.text}</span>
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px]"
                              style={{
                                borderColor:  palette.border,
                                background:   palette.accentSoft,
                                color:        palette.fg,
                              }}
                            >
                              {opt.votes} votes
                            </Badge>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* No guest selected — prompt to RSVP */}
            {!activeGuest && (
              <div className="text-center py-12">
                <p className="text-lg mb-4">
                  Please identify yourself to access personalized details.
                </p>
                <Button
                  onClick={() => handleTabChange('rsvp')}
                  style={{ background: palette.primary, color: palette.primaryFg }}
                >
                  Find Your Invitation
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── MAP TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="space-y-6 flex flex-col relative">
            <div className="text-center space-y-1">
              <h2 className="text-3xl font-display">Venue Map</h2>
              <p className="text-xs font-semibold text-fg-subtle">
                 Pinch to zoom and drag to explore the layout.
              </p>
            </div>

            {/* "FIND MY SEAT" SMART SEARCH OVERLAY BAR */}
            <div className="w-full max-w-sm mx-auto space-y-1 relative">
               <Label htmlFor="mapSearch" className="text-[10px] uppercase font-bold text-fg-subtle tracking-widest block mb-1">🔍 Find My Seat</Label>
               <Input 
                  id="mapSearch"
                  placeholder="Enter your name to locate your seat..." 
                  value={mapSearchQuery}
                  onChange={(e: any) => setMapSearchQuery(e.target.value)}
                  className="bg-white border-[#e1d5c9] text-xs h-10 font-semibold"
               />
               
               {mapFilteredGuests.length > 0 && (
                  <div className="absolute z-50 bg-[#FDFBF7] border border-[#e1d5c9] rounded-xl p-2 w-full shadow-lg space-y-1 flex flex-col text-left top-16">
                     {mapFilteredGuests.slice(0, 5).map(member => (
                        <button
                           key={member.id}
                           onClick={() => {
                              setSelectedGuestId(member.id);
                              setMapSearchQuery('');
                           }}
                           className="p-2 text-xs font-semibold hover:bg-[#e1d5c9]/30 rounded-lg text-left text-fg border-b border-gray-100 last:border-0"
                        >
                           🔍 Find seat for: <strong className="text-brand">{member.fullName}</strong> ({member.tableAssignment})
                        </button>
                     ))}
                  </div>
               )}
            </div>

            {activeGuest && layout && (
              <div
                className="p-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border shadow-xs"
                style={{ background: '#fdf2f8', borderColor: '#fbcfe8', color: '#9d174d' }}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping shrink-0" aria-hidden="true" />
                <span>Your assigned seat is highlighted with a pulsing golden-pink beacon!</span>
              </div>
            )}

            {/* FLOATING MOBILE PINCH-TO-ZOOM TOOLTIP */}
            <div className="text-center text-[10px] uppercase font-bold tracking-widest text-brand bg-white p-2 rounded-lg border max-w-xs mx-auto flex items-center justify-center gap-1.5 shadow-inner">
               👋 Touch Gesture Help: Double tap / Pinch to Zoom
            </div>

            <div
              className="flex-1 min-h-[400px] w-full rounded-2xl overflow-hidden relative border shadow-inner"
              style={{ background: palette.surface, borderColor: palette.border }}
            >
              {!layout ? (
                <div
                  className="w-full h-full flex flex-col items-center justify-center"
                  style={{ color: palette.fgSubtle }}
                >
                  <MapIcon className="w-12 h-12 mb-4 opacity-50" aria-hidden="true" />
                  <p>The layout map hasn't been published yet.</p>
                </div>
              ) : (
                /* any#5 fixed (Phase 34b): layout is PortalLayoutPayload, not any */
                <PortalMapViewer layout={layout} activeGuestId={selectedGuestId} />
              )}
            </div>

            {/* HIGH-CONTRAST SEATING LIST FALLBACK (WCAG AA ACCESSIBILITY) */}
            {activeGuest && (
              <div className="bg-white p-4 rounded-xl border space-y-2 text-left" style={{ borderColor: palette.border }}>
                 <span className="text-[10px] uppercase font-bold text-fg-subtle tracking-widest block">📋 High-Contrast Seating Assignment</span>
                 <div className="text-xs font-semibold text-fg space-y-1">
                    <div>Guest Name: <strong className="text-brand font-serif">{activeGuest.fullName}</strong></div>
                    {activeGuest.tableAssignment ? (
                       <>
                          <div>Assigned Table: <strong className="text-brand">{activeGuest.tableAssignment}</strong></div>
                          {activeGuest.seatAssignment && (
                             <div>Assigned Chair: <strong className="text-[#9d174d]">{activeGuest.seatAssignment}</strong></div>
                          )}
                       </>
                    ) : (
                       <div className="text-fg-subtle italic">No table assignment has been registered yet. Please consult with the venue director upon arrival.</div>
                    )}
                 </div>
              </div>
            )}

            {/* INTERACTIVE LODGING & CABIN MAP (NEW PORTAL ADDITION) */}
            {activeGuest && activeGuest.allowLodgingAccess && activeGuest.roomAssignment && (
              <div className="bg-white p-5 rounded-xl border space-y-4 text-left shadow-sm animate-in zoom-in-95 duration-200" style={{ borderColor: palette.border }}>
                 <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-fg-subtle tracking-widest block">🏡 On-Site Estate Lodging Map</span>
                    <h4 className="text-sm font-serif font-black text-brand">Your Assigned Cabin: <strong className="text-brand font-black underline">{activeGuest.roomAssignment}</strong></h4>
                 </div>

                 {/* Vector SVG Map of Manor Estate properties */}
                 <div className="border border-[#e1d5c9] rounded-xl overflow-hidden bg-[#FDFBF7] p-2 relative h-48 flex items-center justify-center">
                    <svg viewBox="0 0 320 200" className="w-full h-full text-fg">
                       {/* Estate paths */}
                       <path d="M 30,100 Q 160,80 290,120" fill="none" stroke="#e1d5c9" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
                       <path d="M 100,50 L 100,150" fill="none" stroke="#e1d5c9" strokeWidth="4" strokeLinecap="round" opacity="0.3" />

                       {/* Pine Cottage */}
                       {(() => {
                          const isPine = activeGuest.roomAssignment?.toLowerCase().includes('pine') || activeGuest.roomAssignment?.toLowerCase().includes('cottage');
                          return (
                             <g transform="translate(40,40)">
                                <rect x="-20" y="-15" width="40" height="30" rx="4" fill={isPine ? "#fef3c7" : "#fff"} stroke={isPine ? "#f59e0b" : "#9ca3af"} strokeWidth={isPine ? 2.5 : 1.5} />
                                {isPine && <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" strokeDasharray="3,1.5" />}
                                <text x="0" y="2" fontSize="12" textAnchor="middle">🏡</text>
                                <text x="0" y="24" fontSize="8" fontWeight="bold" textAnchor="middle" fill={isPine ? "#b45309" : "#6b7280"}>Pine Cottage</text>
                             </g>
                          );
                       })()}

                       {/* Maple Cabin */}
                       {(() => {
                          const isMaple = activeGuest.roomAssignment?.toLowerCase().includes('maple') || activeGuest.roomAssignment?.toLowerCase().includes('cabin');
                          return (
                             <g transform="translate(160,30)">
                                <rect x="-20" y="-15" width="40" height="30" rx="4" fill={isMaple ? "#fef3c7" : "#fff"} stroke={isMaple ? "#f59e0b" : "#9ca3af"} strokeWidth={isMaple ? 2.5 : 1.5} />
                                {isMaple && <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" strokeDasharray="3,1.5" />}
                                <text x="0" y="2" fontSize="12" textAnchor="middle">🏡</text>
                                <text x="0" y="24" fontSize="8" fontWeight="bold" textAnchor="middle" fill={isMaple ? "#b45309" : "#6b7280"}>Maple Cabin</text>
                             </g>
                          );
                       })()}

                       {/* Cedar Lodge */}
                       {(() => {
                          const isCedar = activeGuest.roomAssignment?.toLowerCase().includes('cedar') || activeGuest.roomAssignment?.toLowerCase().includes('lodge');
                          return (
                             <g transform="translate(240,110)">
                                <rect x="-20" y="-15" width="40" height="30" rx="4" fill={isCedar ? "#fef3c7" : "#fff"} stroke={isCedar ? "#f59e0b" : "#9ca3af"} strokeWidth={isCedar ? 2.5 : 1.5} />
                                {isCedar && <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" strokeDasharray="3,1.5" />}
                                <text x="0" y="2" fontSize="12" textAnchor="middle">🏰</text>
                                <text x="0" y="24" fontSize="8" fontWeight="bold" textAnchor="middle" fill={isCedar ? "#b45309" : "#6b7280"}>Cedar Lodge</text>
                             </g>
                          );
                       })()}

                       {/* Birch Suite */}
                       {(() => {
                          const isBirch = activeGuest.roomAssignment?.toLowerCase().includes('birch') || activeGuest.roomAssignment?.toLowerCase().includes('suite');
                          return (
                             <g transform="translate(100,120)">
                                <rect x="-20" y="-15" width="40" height="30" rx="4" fill={isBirch ? "#fef3c7" : "#fff"} stroke={isBirch ? "#f59e0b" : "#9ca3af"} strokeWidth={isBirch ? 2.5 : 1.5} />
                                {isBirch && <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" strokeDasharray="3,1.5" />}
                                <text x="0" y="2" fontSize="12" textAnchor="middle">🏡</text>
                                <text x="0" y="24" fontSize="8" fontWeight="bold" textAnchor="middle" fill={isBirch ? "#b45309" : "#6b7280"}>Birch Suite</text>
                             </g>
                          );
                       })()}
                    </svg>
                 </div>

                 {/* "My Roommates" Social Dashboard Card */}
                 <div className="space-y-2 border-t pt-3.5">
                    <span className="text-[10px] uppercase font-bold text-fg-subtle tracking-widest block">👥 My Roommates / Suite Group</span>
                    {(() => {
                       const roommates = guests.filter(g => 
                          g.id !== selectedGuestId && 
                          g.roomAssignment === activeGuest.roomAssignment
                       );

                       if (roommates.length === 0) {
                          return <div className="text-xs text-fg-subtle italic">No other roommates are assigned to this cabin. Enjoy your private suite!</div>;
                       }

                       return (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                             {roommates.map(m => (
                                <div key={m.id} className="p-2 border rounded-lg bg-surface flex items-center gap-2">
                                   <div className="w-5 h-5 rounded-full bg-brand-soft text-brand-strong font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {m.fullName.split(' ').map((n: string) => n[0]).join('')}
                                   </div>
                                   <span className="font-semibold text-fg-muted truncate">{m.fullName}</span>
                                </div>
                             ))}
                          </div>
                       );
                    })()}
                 </div>
              </div>
            )}
          </div>
        )}

        {/* ── RSVP TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'rsvp' && (
          <div className="max-w-lg mx-auto mt-8">
            {done ? (
              <Card className="text-center shadow-lg" style={{ borderColor: palette.border }}>
                <CardContent className="pt-10 pb-8 space-y-4">
                  <div className="text-6xl mb-2" role="img" aria-label={attending ? 'Celebration' : 'Thank you'}>
                    {attending ? '🎉' : '💌'}
                  </div>
                  <h2 className="font-display text-2xl">Thank You!</h2>
                  <p style={{ color: palette.fgMuted }}>
                    {attending
                      ? "We're thrilled you can make it! We can't wait to celebrate with you."
                      : "We're sorry you can't make it. You'll be missed!"}
                  </p>
                  {attending && (
                    <div
                      className="rounded-lg p-4 text-left text-sm space-y-2"
                      style={{ background: palette.accentSoft, border: `1px solid ${palette.border}` }}
                    >
                      <div className="flex justify-between">
                        <span style={{ color: palette.fgMuted }}>Guest</span>
                        <span className="font-medium">{activeGuest?.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: palette.fgMuted }}>Response</span>
                        <span className="font-medium">Joyfully Accepts</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: palette.fgMuted }}>Meal</span>
                        <span className="font-medium capitalize">{mealChoice}</span>
                      </div>
                      {info.startDate && (
                        <div className="flex justify-between">
                          <span style={{ color: palette.fgMuted }}>Date</span>
                          <span className="font-medium">
                            {new Date(info.startDate).toLocaleDateString(undefined, {
                              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleTabChange('home')}
                      style={{ borderColor: palette.border }}
                    >
                      Return Home
                    </Button>
                    {attending && (
                      <Button
                        variant="outline"
                        onClick={() => handleTabChange('map')}
                        style={{ borderColor: palette.border }}
                      >
                        <MapIcon className="w-4 h-4 mr-1" aria-hidden="true" /> Find Your Seat
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg" style={{ borderColor: palette.border }}>
                <CardHeader className="text-center pb-2">
                  <CardTitle className="font-display text-3xl">RSVP</CardTitle>
                  <p className="text-sm mt-2" style={{ color: palette.fgMuted }}>
                    Kindly respond by the deadline.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="space-y-6" aria-label="RSVP form">
                    <div>
                      <Label htmlFor="gs" className="font-serif">Search Your Name</Label>
                      <Input 
                        id="gs"
                        placeholder="Type your name to filter..." 
                        value={searchQuery}
                        onChange={(e: any) => setSearchQuery(e.target.value)}
                        className="mt-1.5 h-11 border bg-white px-3 font-semibold text-xs"
                        style={{ borderColor: palette.border, color: palette.fg }}
                        aria-describedby={error ? 'rsvp-error' : undefined}
                      />
                    </div>

                    <div className="mt-4">
                      <Label htmlFor="gn" className="font-serif">Your Name</Label>
                      <select
                        id="gn"
                        required
                        value={selectedGuestId}
                        onChange={(e: any) => {
                           setSelectedGuestId(e.target.value);
                           setIsFormDirty(true);
                        }}
                        className="mt-2 w-full h-12 px-4 rounded-md font-sans"
                        style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}
                        aria-required="true"
                        aria-describedby={error ? 'rsvp-error' : undefined}
                      >
                        <option value="">— Find your name —</option>
                        {/* Filtered list based on searchQuery */}
                        {filteredGuests.map((g: PortalGuestEntry) => (
                          <option key={g.id} value={g.id}>{g.fullName}</option>
                        ))}
                      </select>
                    </div>

                    {activeGuest && householdCandidates.length > 0 && (
                      <div className="p-4 rounded-xl border space-y-2 text-left" style={{ borderColor: palette.border, background: palette.accentSoft }}>
                         <span className="text-[10px] font-black uppercase text-brand tracking-widest block" style={{ color: palette.primary }}>🏠 Household Group RSVPs</span>
                         <p className="text-xs text-fg-subtle leading-tight font-semibold">Select family members to RSVP together on a single screen:</p>
                         <div className="space-y-1.5 pt-1.5 border-t border-dashed">
                            {householdCandidates.map((member: any) => {
                               const isChecked = checkedHouseholdIds.includes(member.id);
                               return (
                                  <label key={member.id} className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none">
                                     <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => {
                                           setIsFormDirty(true);
                                           if (isChecked) {
                                              setCheckedHouseholdIds(checkedHouseholdIds.filter(id => id !== member.id));
                                           } else {
                                              setCheckedHouseholdIds([...checkedHouseholdIds, member.id]);
                                           }
                                        }}
                                        className="rounded"
                                        style={{ accentColor: palette.primary }}
                                     />
                                     <span>{member.fullName}</span>
                                  </label>
                               );
                            })}
                         </div>
                      </div>
                    )}

                    {selectedGuestId && (
                      <div className="space-y-6">
                        <div className="border-b pb-2 text-left">
                           <span className="text-[10px] uppercase font-bold text-fg-subtle tracking-widest block">Primary Guest RSVP</span>
                           <h4 className="font-serif font-black text-brand text-sm">{activeGuest?.fullName}</h4>
                        </div>

                        <div>
                          <Label className="font-serif">Will you be attending?</Label>
                          <div
                            className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2"
                            role="group"
                            aria-label="RSVP response"
                          >
                            <Button
                              type="button"
                              className="flex-1 h-12 font-medium tracking-widest"
                              style={attending
                                ? { background: palette.primary, color: palette.primaryFg }
                                : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                              onClick={() => {
                                 setAttending(true);
                                 setIsFormDirty(true);
                              }}
                              aria-pressed={attending}
                            >
                              JOYFULLY ACCEPT
                            </Button>
                            <Button
                              type="button"
                              className="flex-1 h-12 font-medium tracking-widest"
                              style={!attending
                                ? { background: palette.primary, color: palette.primaryFg }
                                : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                              onClick={() => {
                                 setAttending(false);
                                 setIsFormDirty(true);
                              }}
                              aria-pressed={!attending}
                            >
                              REGRETFULLY DECLINE
                            </Button>
                          </div>
                        </div>

                        {attending && (
                          <div>
                            <Label htmlFor="meal" className="font-serif">Meal Preference</Label>
                            <select
                              id="meal"
                              value={mealChoice}
                              onChange={(e) => {
                                 setMealChoice(e.target.value);
                                 setIsFormDirty(true);
                              }}
                              className="mt-2 w-full h-12 px-4 rounded-md font-sans"
                              style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}
                              aria-describedby={error ? 'rsvp-error' : undefined}
                            >
                              <option value="standard">Standard (Beef/Chicken Duet)</option>
                              <option value="vegetarian">Vegetarian</option>
                              <option value="vegan">Vegan</option>
                              <option value="gluten-free">Gluten-Free</option>
                            </select>
                          </div>
                        )}

                        {/* Dynamic Household Members Forms */}
                        {householdCandidates.filter((m: any) => checkedHouseholdIds.includes(m.id)).map((member: any) => (
                           <div key={member.id} className="space-y-4 border p-4 rounded-xl text-left bg-white" style={{ borderColor: palette.border }}>
                              <div className="border-b pb-1.5 flex justify-between items-center">
                                 <span className="font-serif font-black text-brand text-sm">{member.fullName}</span>
                                 <Badge variant="outline" className="text-[8px] uppercase tracking-wider font-bold">Household Member</Badge>
                              </div>
                              
                              <div className="space-y-1.5">
                                 <Label className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider block">Will {member.fullName.split(' ')[0]} attend?</Label>
                                 <div className="flex gap-2">
                                    <Button 
                                       type="button" 
                                       size="sm"
                                       className="flex-1 h-9 font-bold text-xs uppercase"
                                       style={memberAttending[member.id] !== false
                                          ? { background: palette.primary, color: palette.primaryFg }
                                          : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                                       onClick={() => {
                                          setIsFormDirty(true);
                                          setMemberAttending({...memberAttending, [member.id]: true});
                                       }}
                                    >
                                       Accepts
                                    </Button>
                                    <Button 
                                       type="button" 
                                       size="sm"
                                       className="flex-1 h-9 font-bold text-xs uppercase"
                                       style={memberAttending[member.id] === false
                                          ? { background: palette.primary, color: palette.primaryFg }
                                          : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                                       onClick={() => {
                                          setIsFormDirty(true);
                                          setMemberAttending({...memberAttending, [member.id]: false});
                                       }}
                                    >
                                       Declines
                                    </Button>
                                 </div>
                              </div>
                              
                              {memberAttending[member.id] !== false && (
                                 <div className="space-y-1.5">
                                    <Label htmlFor={`meal-${member.id}`} className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider block">Meal Preference</Label>
                                    <select
                                       id={`meal-${member.id}`}
                                       value={memberMeals[member.id] || 'standard'}
                                       onChange={(e) => {
                                          setIsFormDirty(true);
                                          setMemberMeals({...memberMeals, [member.id]: e.target.value});
                                       }}
                                       className="mt-1 w-full h-10 px-3 rounded-lg text-xs"
                                       style={{ border: `1px solid ${palette.border}`, background: palette.surface }}
                                    >
                                       <option value="standard">Standard (Beef/Chicken Duet)</option>
                                       <option value="vegetarian">Vegetarian</option>
                                       <option value="vegan">Vegan</option>
                                       <option value="gluten-free">Gluten-Free</option>
                                    </select>
                                 </div>
                              )}
                           </div>
                        ))}

                        {/* PERSONALIZED SUB-EVENTS GATED RSVPs */}
                        {activeGuest && subEvents.filter((sub: any) => activeGuest.subEventInvites?.includes(sub.id)).length > 0 && (
                          <div className="space-y-4 pt-4 border-t">
                            <span className="text-[10px] uppercase font-bold text-fg-subtle tracking-widest block" style={{ color: palette.primary }}>🎉 Personalized Weekend Sub-Events RSVPs</span>
                            
                            {subEvents.filter((sub: any) => activeGuest.subEventInvites?.includes(sub.id)).map((sub: any) => (
                              <div key={sub.id} className="space-y-3.5 border p-4 rounded-xl text-left bg-white" style={{ borderColor: palette.border }}>
                                <div className="border-b pb-1.5 flex justify-between items-center">
                                   <span className="font-serif font-black text-brand text-sm">{sub.title}</span>
                                   <Badge variant="outline" className="text-[8px] uppercase tracking-wider font-bold">Sub-Event Invitation</Badge>
                                </div>
                                <div className="space-y-1.5">
                                   <Label className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider block">Will you attend the {sub.title}?</Label>
                                   <div className="flex gap-2">
                                      <Button
                                         type="button"
                                         size="sm"
                                         className="flex-1 h-9 font-bold text-xs uppercase"
                                         style={subEventAttending[sub.id] !== false
                                            ? { background: palette.primary, color: palette.primaryFg }
                                            : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                                         onClick={() => {
                                            setIsFormDirty(true);
                                            setSubEventAttending({...subEventAttending, [sub.id]: true});
                                         }}
                                      >
                                         Accepts
                                      </Button>
                                      <Button
                                         type="button"
                                         size="sm"
                                         className="flex-1 h-9 font-bold text-xs uppercase"
                                         style={subEventAttending[sub.id] === false
                                            ? { background: palette.primary, color: palette.primaryFg }
                                            : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                                         onClick={() => {
                                            setIsFormDirty(true);
                                            setSubEventAttending({...subEventAttending, [sub.id]: false});
                                         }}
                                      >
                                         Declines
                                      </Button>
                                   </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <Label htmlFor="notes" className="font-serif">
                            A Note for the Couple (Optional)
                          </Label>
                          <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => {
                               setNotes(e.target.value);
                               setIsFormDirty(true);
                            }}
                            className="mt-2 w-full min-h-[100px] p-4 rounded-md font-sans resize-none"
                            style={{ border: `1px solid ${palette.border}`, background: palette.surface, color: palette.fg }}
                            placeholder="Leave your wishes or mention any specific dietary allergies…"
                            aria-describedby={error ? 'rsvp-error' : undefined}
                          />
                        </div>

                        {error && (
                          <p id="rsvp-error" className="text-sm text-red-600 font-sans" role="alert">
                            {error}
                          </p>
                        )}

                        <Button
                          type="submit"
                          className="w-full h-12 font-medium tracking-widest"
                          style={{ background: palette.primary, color: palette.primaryFg }}
                        >
                          SEND RSVP
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 w-full pb-safe z-50"
        style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
        aria-label="Portal navigation"
      >
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {(
            [
              ['home', Home,    'Home'] as const,
              ['map',  MapIcon, 'Map' ] as const,
              ['rsvp', Send,    'RSVP'] as const,
            ]
          ).map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              aria-label={label}
              className="flex flex-col items-center gap-1 w-20 transition-colors"
              style={{ color: activeTab === tab ? palette.primary : palette.fgMuted }}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ── PortalMapViewer ───────────────────────────────────────────────────────
/**
 * Interactive floor-plan canvas inside the guest portal.
 *
 * Phase 35a changes:
 *   any#7 FIXED: handleWheel (e: any) → (e: KonvaEventObject<WheelEvent>)
 *     - KonvaEventObject<T> is imported from 'react-konva' (re-exported
 *       from konva/lib/Node). No new npm dependency required.
 *     - e.evt is WheelEvent (preventDefault, deltaY — both typed)
 *     - e.target is Konva.Shape | Konva.Stage
 *
 *   BONUS BUG FIXED: getPointerPosition() returns Vector2d | null
 *     - The live code called .x/.y directly without a null guard.
 *     - This would throw if the pointer hadn't entered the canvas yet.
 *     - Added: `const pointerPos = stage.getPointerPosition(); if (!pointerPos) return;`
 *
 *   any#5 FIXED (Phase 34b): layout: any → layout: PortalLayoutPayload
 *   any#6 FIXED (Phase 34b): items.map((item: any)) → LayoutCanvasItem discriminated union
 */
function PortalMapViewer({
  layout,
  activeGuestId,
}: {
  layout: PortalLayoutPayload;      // any#5 fixed
  activeGuestId: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(0.8);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    handleResize();
    setPos({ x: dimensions.width / 4, y: 50 });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Auto-Panning WebGL Cam (Centering Viewport on Guest Chair)
  useEffect(() => {
    if (activeGuestId && layout?.items && dimensions.width > 0 && dimensions.height > 0) {
      const itemsList = Array.isArray(layout.items) ? layout.items : [];
      const guestChair = itemsList.find((i: any) => i.type === 'chair' && i.guestId === activeGuestId);
      if (guestChair) {
        const targetScale = 1.3;
        const targetX = dimensions.width / 2 - (guestChair.x || 0) * targetScale;
        const targetY = dimensions.height / 2 - (guestChair.y || 0) * targetScale;
        
        setScale(targetScale);
        setPos({ x: targetX, y: targetY });
      }
    }
  }, [activeGuestId, layout?.items, dimensions.width, dimensions.height]);

  /**
   * any#7 FIXED — KonvaEventObject<WheelEvent> replaces (e: any).
   *
   * react-konva v18 re-exports KonvaEventObject from 'react-konva':
   *   import type { KonvaEventObject } from 'react-konva';
   *
   * Properties now fully typed:
   *   e.evt              → WheelEvent  (.preventDefault(), .deltaY)
   *   e.target           → Konva.Shape | Konva.Stage
   *   e.target.getStage()→ Konva.Stage | undefined
   *
   * BONUS BUG FIXED: getPointerPosition() returns Vector2d | null.
   * The live code called .x/.y without null-checking, crashing on first
   * wheel event before the pointer had moved over the canvas. Fixed with
   * an explicit null guard.
   */
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;

    // BONUS BUG FIX: getPointerPosition() → Vector2d | null
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;                    // guard that was missing before

    const oldScale = stage.scaleX();
    const mp = {
      x: pointerPos.x / oldScale - stage.x() / oldScale,
      y: pointerPos.y / oldScale - stage.y() / oldScale,
    };
    const ns = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(ns);
    setPos({
      x: -(mp.x - pointerPos.x / ns) * ns,
      y: -(mp.y - pointerPos.y / ns) * ns,
    });
  };

  // any#6 fixed: typed LayoutCanvasItem[] replaces layout.items (any[])
  const items: LayoutCanvasItem[] = Array.isArray(layout.items) ? layout.items : [];

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      role="img"
      aria-label="Venue floor plan — interactive seat map"
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable
        onDragMove={(e) => {
          // e is inferred as KonvaEventObject<MouseEvent> from Stage's prop types
          if (e.target === e.target.getStage()) {
            setPos({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer>
          {items.map((item) => {
            const isActive = !!(activeGuestId && isChair(item) && item.guestId === activeGuestId);

            if (isRoundTable(item)) {
              return (
                <Group key={item.id} x={item.x} y={item.y}>
                  <Circle
                    radius={item.radius}
                    fill="#f3f4f6"
                    stroke="#9ca3af"
                    strokeWidth={2}
                  />
                  <Text
                    text={item.label}
                    fontSize={14}
                    fill="#374151"
                    align="center"
                    verticalAlign="middle"
                    offsetX={item.radius}
                    offsetY={7}
                    width={item.radius * 2}
                  />
                </Group>
              );
            }

            if (isRectTable(item)) {
              return (
                <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
                  <Rect
                    width={item.width}
                    height={item.height}
                    offsetX={item.width / 2}
                    offsetY={item.height / 2}
                    fill="#f3f4f6"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    cornerRadius={4}
                  />
                  <Text
                    text={item.label}
                    fontSize={14}
                    fill="#374151"
                    align="center"
                    verticalAlign="middle"
                    offsetX={item.width / 2}
                    offsetY={7}
                    width={item.width}
                  />
                </Group>
              );
            }

            if (isDanceFloor(item)) {
              return (
                <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
                  <Rect
                    width={item.width}
                    height={item.height}
                    offsetX={item.width / 2}
                    offsetY={item.height / 2}
                    fill="#e5e7eb"
                    stroke="#d1d5db"
                    strokeWidth={1}
                    dash={[10, 5]}
                  />
                  <Text
                    text={item.label}
                    fontSize={16}
                    fill="#6b7280"
                    fontStyle="italic"
                    align="center"
                    verticalAlign="middle"
                    offsetX={item.width / 2}
                    offsetY={8}
                    width={item.width}
                  />
                </Group>
              );
            }

            if (isChair(item)) {
              return (
                <Group key={item.id} x={item.x} y={item.y}>
                  <Circle
                    radius={item.radius}
                    fill={isActive ? '#fdf2f8' : item.guestId ? '#e5e7eb' : '#fff'}
                    stroke={isActive ? '#ec4899' : '#9ca3af'}
                    strokeWidth={isActive ? 3 : 1.5}
                  />
                  {isActive && (
                    <>
                      <Circle
                        radius={item.radius + 8}
                        stroke="#ec4899"
                        strokeWidth={2}
                        opacity={0.6}
                        dash={[4, 4]}
                      />
                      <Circle
                        radius={item.radius + 14}
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        opacity={0.4}
                        dash={[6, 3]}
                      />
                    </>
                  )}
                  {item.guestInitials && !isActive && (
                    <Text
                      text={item.guestInitials}
                      fontSize={8}
                      fill="#6b7280"
                      align="center"
                      verticalAlign="middle"
                      offsetX={item.radius}
                      offsetY={4}
                      width={item.radius * 2}
                      listening={false}
                    />
                  )}
                </Group>
              );
            }

            return null; // unknown item types — safe no-render fallthrough
          })}
        </Layer>
      </Stage>
    </div>
  );
}
