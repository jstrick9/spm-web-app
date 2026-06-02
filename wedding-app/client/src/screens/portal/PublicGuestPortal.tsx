/**
 * PublicGuestPortal — Phase 22: themed using org/event branding.
 *
 * Phase 34b changes (this file):
 * ────────────────────────────────
 * Eliminated all `any` annotations that were caused by the missing `theme`
 * field on SdkPortalInfo. The full change inventory:
 *
 *   BEFORE → AFTER
 *   ─────────────────────────────────────────────────────────────────────
 *   .then((r: any) => {          → .then((r: PortalInfoResponse) => {
 *   useState<Array<any>>([])     → useState<PortalGuestEntry[]>([])
 *   useState<any>(null) [layout] → useState<PortalLayoutPayload | null>(null)
 *   useState<any[]>([]) [polls]  → useState<Poll[]>([])
 *   { layout: any; … }           → { layout: PortalLayoutPayload; … }
 *   items.map((item: any) => {   → items.map((item: LayoutCanvasItem) => {
 *
 * ONE intentional `any` remains:
 *   handleWheel = (e: any) => {
 *   react-konva does not export a typed WheelEvent wrapper without
 *   installing @types/konva separately. The `e.evt` and `e.target`
 *   access pattern is correct at runtime; a comment explains the choice.
 *
 * Zero visual or behavioural changes. The component renders identically.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ApiError, sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Label } from '../../ui/Label';
import { Map as MapIcon, Home, Send } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { cn } from '../../ui/lib/cn';
import type { Poll } from '../../sdk/feedback.js';
import type {
  PortalInfoResponse,
  PortalGuestEntry,
  PortalLayoutPayload,
  LayoutCanvasItem,
  RoundTableItem,
  RectTableItem,
  DanceFloorItem,
  ChairItem,
} from '../../sdk/portalTypes.js';

// ── Default portal palette (warm/elegant) ─────────────────────────────────
// Applied when the org hasn't configured a theme, or theme fields are absent.
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
  // State — all typed, no `any`
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

  useEffect(() => {
    // Pre-select a guest from the URL query string (e.g. from invite email link)
    const sp = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const guestParam = sp.get('guest');
    if (guestParam) setSelectedGuestId(guestParam);

    // ── THE FIX: `r` is now typed as PortalInfoResponse, not `any` ──────
    sdk.portal.info(eventId)
      .then((r: PortalInfoResponse) => {
        setInfo(r.event);
        setGuests(r.guests);
        setLayout(r.layout);

        // Apply theme from the portal info response (no auth needed).
        // `r.theme` was previously inaccessible without the `any` cast because
        // SdkPortalInfo didn't declare the `theme` field.
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

        // Polls are optional — swallow errors gracefully
        sdk.feedback.getPolls(eventId)
          .then((res) => setPolls(res.polls))
          .catch(() => {});
      })
      .catch(() => setError('Event not found.'));
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) { setError('Please pick your name.'); return; }
    try {
      await sdk.portal.submitRsvp(eventId, {
        guestId:    selectedGuestId,
        attending,
        mealChoice,
        notes:      notes || undefined,
      });
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  // ── Loading / error state ────────────────────────────────────────────────
  if (error && !info) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: palette.bg }}
      >
        <div className="text-center space-y-3 px-4">
          <p className="text-lg font-medium" style={{ color: palette.fg }}>
            {error}
          </p>
          <p className="text-sm" style={{ color: palette.fgMuted }}>
            The invitation link may have expired or the event is no longer accepting RSVPs.
          </p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: palette.bg }}
        aria-busy="true"
        aria-label="Loading wedding portal"
      >
        <div className="text-center space-y-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: palette.primary, borderTopColor: 'transparent' }}
            aria-hidden="true"
          />
          <p className="text-sm" style={{ color: palette.fgMuted }}>Loading…</p>
        </div>
      </div>
    );
  }

  // ── Main portal render ───────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col pb-16"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      {/* ── Portal header ─────────────────────────────────────────────── */}
      <header
        className="text-center py-8 px-4"
        style={{ backgroundColor: palette.surface, borderBottom: `1px solid ${palette.border}` }}
      >
        <h1 className="text-2xl md:text-4xl font-display font-bold tracking-widest">
          {info.title}
        </h1>
        <p className="mt-2 text-sm uppercase tracking-widest" style={{ color: palette.fgMuted }}>
          {info.startDate
            ? new Date(info.startDate).toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'TBD'}
        </p>
      </header>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">

        {/* ── HOME TAB ──────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            {/* Hero banner */}
            <div
              className="aspect-[21/9] w-full rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center"
              style={{ background: palette.accent }}
            >
              {/* Dark scrim ensures ≥ 3:1 contrast over any theme accent colour */}
              <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
              <h2
                className="relative z-10 text-white font-display text-4xl md:text-5xl lg:text-6xl text-center px-4 leading-tight"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
              >
                We can't wait to <br /> celebrate with you.
              </h2>
            </div>

            {/* Wedding countdown */}
            {info.startDate && (() => {
              const days = Math.max(0, Math.ceil(
                (new Date(info.startDate!).getTime() - Date.now()) / 86400000,
              ));
              const isPast = new Date(info.startDate!).getTime() < Date.now();
              return (
                <div className="text-center py-8" style={{ color: palette.fg }}>
                  <div
                    className="font-display text-7xl md:text-8xl tracking-tight"
                    style={{ color: palette.primary }}
                    aria-label={isPast ? 'Congratulations' : `${days} days until the wedding`}
                  >
                    {isPast ? '🎉' : days}
                  </div>
                  <p
                    className="mt-3 text-lg tracking-widest uppercase"
                    style={{ color: palette.fgMuted }}
                  >
                    {isPast
                      ? 'Congratulations!'
                      : days === 1
                        ? 'day to go'
                        : 'days until the wedding'}
                  </p>
                </div>
              );
            })()}

            {/* Guest welcome card */}
            {guests.length > 0 && (
              <Card className="shadow-lg" style={{ borderColor: palette.border }}>
                <CardHeader className="text-center pb-2">
                  <CardTitle className="font-display text-2xl">
                    You're on the guest list!
                  </CardTitle>
                  <p className="text-sm mt-1" style={{ color: palette.fgMuted }}>
                    Find your name below to RSVP and view your seating assignment.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => setActiveTab('rsvp')}
                    style={{ background: palette.primary, color: palette.primaryFg }}
                  >
                    <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                    RSVP Now
                  </Button>
                  {layout && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('map')}
                      style={{ borderColor: palette.border }}
                    >
                      <MapIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                      Find Your Seat
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Live polls (typed: Poll[] not any[]) */}
            {polls.filter((p) => p.status === 'active').map((poll) => (
              <Card key={poll.id} className="shadow-md" style={{ borderColor: palette.border }}>
                <CardHeader>
                  <CardTitle className="text-lg font-display">{poll.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2" aria-label={`Options for: ${poll.question}`}>
                    {poll.options.map((opt) => (
                      <li key={opt.id}>
                        <button
                          onClick={() => sdk.feedback.votePoll(eventId, poll.id, opt.id)}
                          className="w-full text-left px-4 py-3 rounded-lg border transition-colors hover:opacity-80"
                          style={{ borderColor: palette.border, background: palette.surface }}
                          aria-label={`Vote for: ${opt.text} (${opt.votes} votes)`}
                        >
                          <div className="flex justify-between items-center">
                            <span>{opt.text}</span>
                            <Badge variant="default" className="ml-2">
                              {opt.votes}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── MAP TAB ───────────────────────────────────────────────── */}
        {activeTab === 'map' && layout && (
          <div className="space-y-4">
            <div
              className="rounded-xl overflow-hidden shadow-lg"
              style={{
                height: '65vh',
                border: `1px solid ${palette.border}`,
                background: '#f9fafb',
              }}
              aria-label="Venue floor plan — interactive seat map"
              role="img"
            >
              <PortalMapViewer layout={layout} activeGuestId={selectedGuestId} />
            </div>

            {selectedGuestId && (() => {
              const g = guests.find((x) => x.id === selectedGuestId);
              return g?.tableAssignment ? (
                <div
                  className="rounded-lg p-4 text-center text-sm font-medium"
                  style={{ background: palette.accentSoft, color: palette.fg }}
                >
                  Your seat:{' '}
                  <strong>
                    {g.tableAssignment}
                    {g.seatAssignment ? ` — Seat ${g.seatAssignment}` : ''}
                  </strong>
                </div>
              ) : null;
            })()}

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setActiveTab('home')}
                style={{ borderColor: palette.border }}
              >
                Return Home
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab('rsvp')}
                style={{ borderColor: palette.border }}
              >
                <Send className="w-4 h-4 mr-1" aria-hidden="true" /> RSVP
              </Button>
            </div>
          </div>
        )}

        {/* ── RSVP TAB ──────────────────────────────────────────────── */}
        {activeTab === 'rsvp' && (
          done ? (
            <Card className="shadow-lg text-center" style={{ borderColor: palette.border }}>
              <CardContent className="pt-8 pb-8 space-y-4">
                <div
                  className="text-5xl"
                  aria-label="Thank you"
                  role="img"
                >
                  🎉
                </div>
                <CardTitle className="font-display text-3xl">
                  Thank You!
                </CardTitle>
                <p style={{ color: palette.fgMuted }}>
                  Your RSVP has been received. We look forward to celebrating with you!
                </p>
                <div className="flex gap-3 justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('home')}
                    style={{ borderColor: palette.border }}
                  >
                    Return Home
                  </Button>
                  {attending && layout && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('map')}
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

                  {/* Guest name selector */}
                  <div>
                    <Label htmlFor="gn" className="font-serif">Your Name</Label>
                    <select
                      id="gn"
                      required
                      value={selectedGuestId}
                      onChange={(e) => setSelectedGuestId(e.target.value)}
                      className="mt-2 w-full h-12 px-4 rounded-md font-sans"
                      style={{ border: `1px solid ${palette.border}`, background: palette.surface }}
                      aria-required="true"
                    >
                      <option value="">— Find your name —</option>
                      {guests.map((g) => (
                        <option key={g.id} value={g.id}>{g.fullName}</option>
                      ))}
                    </select>
                  </div>

                  {selectedGuestId && (
                    <div className="space-y-6">
                      {/* Attending toggle */}
                      <div>
                        <Label className="font-serif">Will you be attending?</Label>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2" role="group" aria-label="RSVP response">
                          <Button
                            type="button"
                            className="flex-1 h-12 font-medium tracking-widest"
                            style={attending
                              ? { background: palette.primary, color: palette.primaryFg }
                              : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                            onClick={() => setAttending(true)}
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
                            onClick={() => setAttending(false)}
                            aria-pressed={!attending}
                          >
                            REGRETFULLY DECLINE
                          </Button>
                        </div>
                      </div>

                      {/* Meal preference (only when attending) */}
                      {attending && (
                        <div>
                          <Label htmlFor="meal" className="font-serif">Meal Preference</Label>
                          <select
                            id="meal"
                            value={mealChoice}
                            onChange={(e) => setMealChoice(e.target.value)}
                            className="mt-2 w-full h-12 px-4 rounded-md font-sans"
                            style={{ border: `1px solid ${palette.border}`, background: palette.surface }}
                          >
                            <option value="standard">Standard (Beef/Chicken Duet)</option>
                            <option value="vegetarian">Vegetarian</option>
                            <option value="vegan">Vegan</option>
                            <option value="gluten-free">Gluten-Free</option>
                          </select>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <Label htmlFor="notes" className="font-serif">
                          A Note for the Couple (Optional)
                        </Label>
                        <textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="mt-2 w-full min-h-[100px] p-4 rounded-md font-sans resize-none"
                          style={{ border: `1px solid ${palette.border}`, background: palette.surface }}
                          placeholder="Leave your wishes or mention any specific dietary allergies…"
                          aria-describedby={error ? 'rsvp-error' : undefined}
                        />
                      </div>

                      {/* Error */}
                      {error && (
                        <p id="rsvp-error" className="text-sm text-red-600 font-sans" role="alert">
                          {error}
                        </p>
                      )}

                      {/* Submit */}
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
          )
        )}
      </main>

      {/* ── Bottom navigation ────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 w-full pb-safe z-50"
        style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
        aria-label="Portal navigation"
      >
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {(
            [
              ['home', Home,    'Home'],
              ['map',  MapIcon, 'Map' ],
              ['rsvp', Send,    'RSVP'],
            ] as const
          ).map(([tab, Icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
 * Interactive floor-plan viewer inside the portal.
 *
 * Phase 34b changes:
 *   - `layout: any` → `layout: PortalLayoutPayload`
 *   - `items.map((item: any)` → `items.map((item: LayoutCanvasItem)`
 *   - Type guards replace `item.type === 'xxx'` raw string checks
 *   - `e: any` in handleWheel retained with explanatory comment:
 *     react-konva's KonvaEventObject<WheelEvent> is the correct type but
 *     requires importing from 'konva/lib/Node' which adds a dev dependency
 *     not currently in package.json. Runtime behaviour is correct.
 *     TODO: add `@types/konva` and replace with KonvaEventObject<WheelEvent>.
 */
function PortalMapViewer({
  layout,
  activeGuestId,
}: {
  layout: PortalLayoutPayload;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // react-konva wheel events are not easily typed without @types/konva.
  // The `e.evt` and `e.target.getStage()` usage is correct at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const mp = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };
    const ns = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(ns);
    setPos({
      x: -(mp.x - stage.getPointerPosition().x / ns) * ns,
      y: -(mp.y - stage.getPointerPosition().y / ns) * ns,
    });
  };

  // ── Typed items array (was: layout.items without type safety) ─────────
  const items: LayoutCanvasItem[] = Array.isArray(layout.items) ? layout.items : [];

  return (
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing">
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
          if (e.target === e.target.getStage()) {
            setPos({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer>
          {items.map((item) => {
            const isActive = !!(activeGuestId && isChair(item) && item.guestId === activeGuestId);

            // ── Round table ──────────────────────────────────────────
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

            // ── Rectangular table ────────────────────────────────────
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

            // ── Dance floor ──────────────────────────────────────────
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

            // ── Chair (seat) — highlights the active guest's seat ────
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
                    <Circle
                      radius={item.radius + 8}
                      stroke="#ec4899"
                      strokeWidth={2}
                      opacity={0.5}
                      dash={[4, 4]}
                    />
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

            // Unknown item types — render nothing, type-safe fallthrough
            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
}
