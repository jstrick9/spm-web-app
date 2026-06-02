/**
 * PublicGuestPortal — Phase 22: themed using org/event branding.
 *
 * The portal now:
 *   - Fetches the event's platformConfig to get the theme
 *   - Applies CSS custom properties for all colors
 *   - Uses semantic class names instead of hardcoded hex colors
 *   - Supports all 6 curated theme presets
 *   - Falls back to a warm elegant default if no config is set
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

// ─── Default portal palette (warm/elegant) ──────────────
const DEFAULT_PALETTE = {
  bg: '#fdfbf7', surface: '#ffffff', border: '#e1d5c9',
  fg: '#2c3e2e', fgMuted: '#6b7280', fgSubtle: '#9ca3af',
  primary: '#2c3e2e', primaryFg: '#ffffff', primaryHover: '#1a251b',
  accent: '#e1d5c9', accentSoft: 'rgba(225,213,201,0.3)',
};

type Palette = typeof DEFAULT_PALETTE;

export function PublicGuestPortal({ eventId }: { eventId: string }) {
  const [info, setInfo] = useState<{ title: string; startDate: string | null } | null>(null);
  const [guests, setGuests] = useState<Array<any>>([]);
  const [layout, setLayout] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [attending, setAttending] = useState(true);
  const [mealChoice, setMealChoice] = useState('standard');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'rsvp'>('home');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const guestParam = sp.get('guest');
    if (guestParam) setSelectedGuestId(guestParam);

    sdk.portal.info(eventId)
      .then((r: any) => {
        setInfo({ title: r.event.title, startDate: r.event.startDate });
        setGuests(r.guests);
        setLayout(r.layout);
        // Apply theme from the portal info response (no auth needed)
        if (r.theme) {
          const t = r.theme;
          setPalette({
            bg: t.bgColor ?? DEFAULT_PALETTE.bg,
            surface: t.surfaceColor ?? DEFAULT_PALETTE.surface,
            border: t.borderColor ?? DEFAULT_PALETTE.border,
            fg: t.fgColor ?? DEFAULT_PALETTE.fg,
            fgMuted: t.fgMutedColor ?? DEFAULT_PALETTE.fgMuted,
            fgSubtle: t.fgSubtleColor ?? DEFAULT_PALETTE.fgSubtle,
            primary: t.brandColor ?? DEFAULT_PALETTE.primary,
            primaryFg: t.brandFgColor ?? DEFAULT_PALETTE.primaryFg,
            primaryHover: t.brandHoverColor ?? DEFAULT_PALETTE.primaryHover,
            accent: t.accentColor ?? DEFAULT_PALETTE.accent,
            accentSoft: t.accentSoftColor ?? DEFAULT_PALETTE.accentSoft,
          });
        }
        sdk.feedback.getPolls(eventId).then(res => setPolls(res.polls)).catch(() => {});
      })
      .catch(() => setError('Event not found.'));
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) { setError('Please pick your name.'); return; }
    try {
      await sdk.portal.submitRsvp(eventId, { guestId: selectedGuestId, attending, mealChoice, notes: notes || undefined });
      setDone(true);
    } catch (err) { setError((err as ApiError).message); }
  }

  if (error && !info) return <Card className="max-w-md mx-auto mt-20"><CardContent className="pt-6 text-danger">{error}</CardContent></Card>;
  if (!info) return <div className="min-h-screen flex items-center justify-center" style={{ background: palette.bg }}><div className="animate-pulse" style={{ color: palette.fgMuted }}>Loading Portal...</div></div>;

  const activeGuest = guests.find(g => g.id === selectedGuestId);

  // Inline style vars so all children inherit the theme
  const themeVars: React.CSSProperties = {
    '--portal-bg': palette.bg,
    '--portal-surface': palette.surface,
    '--portal-border': palette.border,
    '--portal-fg': palette.fg,
    '--portal-fg-muted': palette.fgMuted,
    '--portal-primary': palette.primary,
    '--portal-primary-fg': palette.primaryFg,
    '--portal-primary-hover': palette.primaryHover,
    '--portal-accent': palette.accent,
    '--portal-accent-soft': palette.accentSoft,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen font-serif flex flex-col relative pb-20" style={{ background: palette.bg, color: palette.fg, ...themeVars }}>
      {/* Header */}
      <header className="py-6 px-4 text-center sticky top-0 z-10 shadow-sm" style={{ background: palette.surface, borderBottom: `1px solid ${palette.border}` }}>
        <h1 className="text-2xl md:text-4xl font-display font-bold tracking-widest">{info.title}</h1>
        <p className="mt-2 text-sm uppercase tracking-widest" style={{ color: palette.fgMuted }}>
          {info.startDate ? new Date(info.startDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}
        </p>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
        {/* ─── HOME TAB ──────────────────────────────────── */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            {/* Hero banner */}
            <div className="aspect-[21/9] w-full rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center" style={{ background: palette.accent }}>
              {/* Darker scrim + text shadow so the white headline keeps >=3:1
                  contrast over ANY theme accent color (light accents like the
                  default blush failed at 2.28:1 with the old bg-black/20). */}
              <div className="absolute inset-0 bg-black/45" />
              <h2
                className="relative z-10 text-white font-display text-4xl md:text-5xl lg:text-6xl text-center px-4 leading-tight"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
              >
                We can't wait to <br /> celebrate with you.
              </h2>
            </div>

            {/* Wedding countdown */}
            {info.startDate && (() => {
              const days = Math.max(0, Math.ceil((new Date(info.startDate!).getTime() - Date.now()) / 86400000));
              const isPast = new Date(info.startDate!).getTime() < Date.now();
              return (
                <div className="text-center py-8" style={{ color: palette.fg }}>
                  <div className="font-display text-7xl md:text-8xl tracking-tight" style={{ color: palette.primary }}>
                    {isPast ? "🎉" : days}
                  </div>
                  <p className="mt-3 text-lg tracking-widest uppercase" style={{ color: palette.fgMuted }}>
                    {isPast ? "Congratulations!" : days === 1 ? "day to go" : "days until the wedding"}
                  </p>
                </div>
              );
            })()}

            {/* Guest welcome card */}
            {activeGuest && (
              <Card style={{ background: palette.surface, borderColor: palette.border }}>
                <CardContent className="text-center py-6">
                  <h3 className="text-xl font-display mb-2">Welcome, {activeGuest.fullName}</h3>
                  <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: palette.fgMuted }}>
                    We are so excited to share our special day with you. Please browse the venue map to find your seat, or submit your RSVP!
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Button variant="outline" onClick={() => setActiveTab('map')} style={{ borderColor: palette.border, color: palette.fg }}>
                      <MapIcon className="w-4 h-4 mr-2" /> View Map
                    </Button>
                    <Button onClick={() => setActiveTab('rsvp')} style={{ background: palette.primary, color: palette.primaryFg }}>
                      <Send className="w-4 h-4 mr-2" /> RSVP Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Polls */}
            {polls.length > 0 && activeGuest && (
              <div className="space-y-4">
                <h3 className="font-display text-2xl text-center pt-8" style={{ borderTop: `1px solid ${palette.border}` }}>Couple's Polls</h3>
                {polls.filter((p: any) => p.status === 'active').map((poll: any) => (
                  <Card key={poll.id} style={{ borderColor: palette.border }}>
                    <CardContent className="p-6">
                      <h4 className="font-semibold text-lg mb-4">{poll.question}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {poll.options.map((opt: any) => (
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
                          >
                            <span>{opt.text}</span>
                            <Badge variant="outline" className="ml-2 text-[10px]" style={{ borderColor: palette.border, background: palette.accentSoft, color: palette.fg }}>
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

            {!activeGuest && (
              <div className="text-center py-12">
                <p className="text-lg mb-4">Please identify yourself to access personalized details.</p>
                <Button onClick={() => setActiveTab('rsvp')} style={{ background: palette.primary, color: palette.primaryFg }}>
                  Find Your Invitation
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── MAP TAB ───────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="space-y-6 flex flex-col">
            <div className="text-center">
              <h2 className="text-3xl font-display">Venue Map</h2>
              <p className="mt-2" style={{ color: palette.fgMuted }}>Pinch to zoom and drag to explore the layout.</p>
            </div>
            {activeGuest && layout && (
              <div className="p-4 rounded-lg flex items-center justify-center gap-2 text-sm" style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', color: '#9d174d' }}>
                <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse" />
                <span className="font-medium">Your seat is highlighted in pink!</span>
              </div>
            )}
            <div className="flex-1 min-h-[500px] w-full rounded-xl overflow-hidden shadow-sm relative" style={{ background: palette.surface, border: `1px solid ${palette.border}` }}>
              {!layout ? (
                <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: palette.fgSubtle }}>
                  <MapIcon className="w-12 h-12 mb-4 opacity-50" />
                  <p>The layout map hasn't been published yet.</p>
                </div>
              ) : (
                <PortalMapViewer layout={layout} activeGuestId={selectedGuestId} />
              )}
            </div>
          </div>
        )}

        {/* ─── RSVP TAB ──────────────────────────────────── */}
        {activeTab === 'rsvp' && (
          <div className="max-w-lg mx-auto mt-8">
            {done ? (
              <Card className="text-center shadow-lg" style={{ borderColor: palette.border }}>
                <CardContent className="pt-10 pb-8 space-y-4">
                  <div className="text-6xl mb-2">{attending ? '🎉' : '💌'}</div>
                  <h2 className="font-display text-2xl">Thank You!</h2>
                  <p style={{ color: palette.fgMuted }}>
                    {attending
                      ? "We're thrilled you can make it! We can't wait to celebrate with you."
                      : "We're sorry you can't make it. You'll be missed!"}
                  </p>
                  {attending && (
                    <div className="rounded-lg p-4 text-left text-sm space-y-2" style={{ background: palette.accentSoft, border: `1px solid ${palette.border}` }}>
                      <div className="flex justify-between">
                        <span style={{ color: palette.fgMuted }}>Guest</span>
                        <span className="font-medium">{activeGuest?.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: palette.fgMuted }}>Response</span>
                        <span className="font-medium">{attending ? 'Joyfully Accepts' : 'Regretfully Declines'}</span>
                      </div>
                      {attending && (
                        <div className="flex justify-between">
                          <span style={{ color: palette.fgMuted }}>Meal</span>
                          <span className="font-medium capitalize">{mealChoice}</span>
                        </div>
                      )}
                      {info.startDate && (
                        <div className="flex justify-between">
                          <span style={{ color: palette.fgMuted }}>Date</span>
                          <span className="font-medium">{new Date(info.startDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    <Button variant="outline" onClick={() => setActiveTab('home')} style={{ borderColor: palette.border }}>Return Home</Button>
                    {attending && (
                      <Button variant="outline" onClick={() => setActiveTab('map')} style={{ borderColor: palette.border }}>
                        <MapIcon className="w-4 h-4 mr-1" /> Find Your Seat
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg" style={{ borderColor: palette.border }}>
                <CardHeader className="text-center pb-2">
                  <CardTitle className="font-display text-3xl">RSVP</CardTitle>
                  <p className="text-sm mt-2" style={{ color: palette.fgMuted }}>Kindly respond by the deadline.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="space-y-6">
                    <div>
                      <Label htmlFor="gn" className="font-serif">Your Name</Label>
                      <select
                        id="gn" required value={selectedGuestId}
                        onChange={(e) => setSelectedGuestId(e.target.value)}
                        className="mt-2 w-full h-12 px-4 rounded-md font-sans"
                        style={{ border: `1px solid ${palette.border}`, background: palette.surface }}
                      >
                        <option value="">— Find your name —</option>
                        {guests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
                      </select>
                    </div>

                    {selectedGuestId && (
                      <div className="space-y-6">
                        <div>
                          <Label className="font-serif">Will you be attending?</Label>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2">
                            <Button type="button" className="flex-1 h-12 font-medium tracking-widest"
                              style={attending ? { background: palette.primary, color: palette.primaryFg } : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                              onClick={() => setAttending(true)}>JOYFULLY ACCEPT</Button>
                            <Button type="button" className="flex-1 h-12 font-medium tracking-widest"
                              style={!attending ? { background: palette.primary, color: palette.primaryFg } : { background: palette.surface, color: palette.fg, border: `1px solid ${palette.border}` }}
                              onClick={() => setAttending(false)}>REGRETFULLY DECLINE</Button>
                          </div>
                        </div>

                        {attending && (
                          <div>
                            <Label htmlFor="meal" className="font-serif">Meal Preference</Label>
                            <select id="meal" value={mealChoice} onChange={(e) => setMealChoice(e.target.value)}
                              className="mt-2 w-full h-12 px-4 rounded-md font-sans"
                              style={{ border: `1px solid ${palette.border}`, background: palette.surface }}>
                              <option value="standard">Standard (Beef/Chicken Duet)</option>
                              <option value="vegetarian">Vegetarian</option>
                              <option value="vegan">Vegan</option>
                              <option value="gluten-free">Gluten-Free</option>
                            </select>
                          </div>
                        )}

                        <div>
                          <Label htmlFor="notes" className="font-serif">A Note for the Couple (Optional)</Label>
                          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                            className="mt-2 w-full min-h-[100px] p-4 rounded-md font-sans resize-none"
                            style={{ border: `1px solid ${palette.border}`, background: palette.surface }}
                            placeholder="Leave your wishes or mention any specific dietary allergies..." />
                        </div>

                        {error && <p className="text-sm text-red-600 font-sans">{error}</p>}
                        <Button type="submit" className="w-full h-12 font-medium tracking-widest"
                          style={{ background: palette.primary, color: palette.primaryFg }}>
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full pb-safe z-50" style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}>
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {([['home', Home, 'Home'], ['map', MapIcon, 'Map'], ['rsvp', Send, 'RSVP']] as const).map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              className="flex flex-col items-center gap-1 w-20 transition-colors"
              /* fgMuted (#6b7280, ~4.8:1 on white) meets WCAG AA for the small
                 nav labels; fgSubtle (#9ca3af) failed at 2.53:1. */
              style={{ color: activeTab === tab ? palette.primary : palette.fgMuted }}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── Map Viewer (unchanged logic, themed seat highlight) ──
function PortalMapViewer({ layout, activeGuestId }: { layout: any; activeGuestId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(0.8);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    handleResize();
    setPos({ x: dimensions.width / 4, y: 50 });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const mp = { x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale, y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale };
    const ns = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(ns);
    setPos({ x: -(mp.x - stage.getPointerPosition().x / ns) * ns, y: -(mp.y - stage.getPointerPosition().y / ns) * ns });
  };

  const items = Array.isArray(layout.items) ? layout.items : [];

  return (
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing">
      <Stage width={dimensions.width} height={dimensions.height} onWheel={handleWheel}
        scaleX={scale} scaleY={scale} x={pos.x} y={pos.y} draggable
        onDragMove={(e) => { if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() }); }}>
        <Layer>
          {items.map((item: any) => {
            const isActive = activeGuestId && item.guestId === activeGuestId;
            if (item.type === 'round_table') return (
              <Group key={item.id} x={item.x} y={item.y}>
                <Circle radius={item.radius} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} />
                <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={item.radius||0} offsetY={7} width={(item.radius||0)*2} />
              </Group>
            );
            if (item.type === 'rect_table') return (
              <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
                <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} cornerRadius={4} />
                <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={7} width={item.width} />
              </Group>
            );
            if (item.type === 'dance_floor') return (
              <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
                <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#e5e7eb" stroke="#d1d5db" strokeWidth={1} dash={[10,5]} />
                <Text text={item.label} fontSize={16} fill="#6b7280" fontStyle="italic" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={8} width={item.width} />
              </Group>
            );
            if (item.type === 'chair') return (
              <Group key={item.id} x={item.x} y={item.y}>
                <Circle radius={item.radius} fill={isActive ? "#fdf2f8" : item.guestId ? "#e5e7eb" : "#fff"} stroke={isActive ? "#ec4899" : "#9ca3af"} strokeWidth={isActive ? 3 : 1.5} />
                {isActive && <Circle radius={item.radius+8} stroke="#ec4899" strokeWidth={2} opacity={0.5} dash={[4,4]} />}
                {item.guestInitials && !isActive && <Text text={item.guestInitials} fontSize={8} fill="#6b7280" align="center" verticalAlign="middle" offsetX={item.radius} offsetY={4} width={item.radius*2} listening={false} />}
              </Group>
            );
            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
}
