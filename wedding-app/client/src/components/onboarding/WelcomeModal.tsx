import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Heart,
  Map,
  MessageCircle,
  MonitorPlay,
  QrCode,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import type { SdkMembership } from '../../sdk/types';
import type { PartialPlatformConfig } from '../../config/schema';
import { sdk } from '../../sdk';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/lib/cn';

interface Props {
  memberships: SdkMembership[];
  orgId?: string | null;
  userConfig?: PartialPlatformConfig;
  onUserConfigChanged?: (config: PartialPlatformConfig) => void;
  onComplete: () => void;
}

type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

interface TourSlide {
  id: string;
  roles: string[];
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  cta?: string;
  checklistStep?: string;
  sandbox?: boolean;
}

const OWNER_SLIDES: TourSlide[] = [
  {
    id: 'owner-venue-setup',
    roles: ['owner', 'admin'],
    title: 'Start with your venue setup',
    description: 'Add your venue identity, spaces, capacity, rules, and catalog basics so every event starts with the right defaults.',
    icon: <ClipboardList className="h-14 w-14 text-brand" />,
    href: '#/system/platform',
    cta: 'Take me to setup',
    checklistStep: 'Venue setup',
  },
  {
    id: 'owner-event-pipeline',
    roles: ['owner', 'admin', 'manager', 'planner'],
    title: 'Build your event pipeline',
    description: 'Track leads, holds, booked weddings, planning work, and completed events without mixing demo data into real operations.',
    icon: <CalendarDays className="h-14 w-14 text-brand" />,
    href: '#/events',
    cta: 'Create first event',
    checklistStep: 'Event pipeline',
    sandbox: true,
  },
  {
    id: 'owner-guest-portal',
    roles: ['owner', 'admin', 'manager', 'planner'],
    title: 'Open the guest portal workflow',
    description: 'Use guest portals for RSVP collection, dietary needs, lodging visibility, and couple-facing event information.',
    icon: <Users className="h-14 w-14 text-brand" />,
    href: '#/guests',
    cta: 'Review guests',
    checklistStep: 'Guest portal',
  },
  {
    id: 'owner-vendor-portal',
    roles: ['owner', 'admin', 'manager', 'planner'],
    title: 'Invite vendors into their portal',
    description: 'Vendors can submit logistics, answer questionnaires, communicate with your team, and provide COI information.',
    icon: <Truck className="h-14 w-14 text-brand" />,
    href: '#/vendors',
    cta: 'Open vendors',
    checklistStep: 'Vendor portal',
  },
  {
    id: 'owner-health-command',
    roles: ['owner', 'admin', 'manager', 'planner'],
    title: 'Use the Event Health Command Center',
    description: 'See risk alerts, timeline readiness, RSVP lag, guest duplicates, vendor reliability, and recommended next actions.',
    icon: <Activity className="h-14 w-14 text-brand" />,
    href: '#/intelligence',
    cta: 'View health center',
    checklistStep: 'Health command',
  },
  {
    id: 'owner-day-of-check-in',
    roles: ['owner', 'admin', 'manager', 'planner', 'staff'],
    title: 'Run day-of check-in confidently',
    description: 'Use check-in views, run sheets, staff tasks, and vendor arrivals to coordinate wedding day operations.',
    icon: <QrCode className="h-14 w-14 text-brand" />,
    href: '#/calendar',
    cta: 'See day-of tools',
    checklistStep: 'Day-of readiness',
  },
  {
    id: 'owner-learning-center',
    roles: ['owner', 'admin', 'manager', 'planner'],
    title: 'Learn in short, focused lessons',
    description: 'Use the owner learning center for quick video/GIF-style guides: setup, first event, portals, health checks, and day-of operations.',
    icon: <MonitorPlay className="h-14 w-14 text-brand" />,
    href: '#/system/platform',
    cta: 'Open learning center',
    checklistStep: 'Learning center',
  },
];

const MANAGER_SLIDES: TourSlide[] = [
  {
    id: 'manager-quick-start',
    roles: ['manager'],
    title: 'Manager quick start: first 30 minutes',
    description: 'Start with today’s events, the open operations queue, vendor readiness, guest exceptions, staff coverage, and anything that needs owner/admin escalation.',
    icon: <ShieldCheck className="h-14 w-14 text-brand" />,
    href: '#/',
    cta: 'Open manager checklist',
    checklistStep: 'Manager quick start',
  },
  {
    id: 'manager-event-ops',
    roles: ['manager'],
    title: 'Review event operations before event week',
    description: 'Open an event workspace to confirm timeline, layout readiness, guest exceptions, staff tasks, vendor logistics, and emergency plan status.',
    icon: <CalendarDays className="h-14 w-14 text-brand" />,
    href: '#/events',
    cta: 'Review events',
    checklistStep: 'Event operations',
  },
  {
    id: 'manager-vendor-status',
    roles: ['manager'],
    title: 'Confirm vendor status and load-in readiness',
    description: 'Check arrival times, COIs, unread messages, portal activity, quick call/SMS contacts, and day-of check-in readiness.',
    icon: <Truck className="h-14 w-14 text-brand" />,
    href: '#/vendors',
    cta: 'Open vendor board',
    checklistStep: 'Vendor readiness',
  },
  {
    id: 'manager-guest-issues',
    roles: ['manager'],
    title: 'Work guest exceptions before they become event-day problems',
    description: 'Review missing RSVPs, dietary/accessibility notes, VIPs, seating gaps, lodging issues, and guest communication needs.',
    icon: <Users className="h-14 w-14 text-brand" />,
    href: '#/guests',
    cta: 'Review guest issues',
    checklistStep: 'Guest exceptions',
  },
  {
    id: 'manager-day-of-command',
    roles: ['manager'],
    title: 'Run event day from phone or tablet',
    description: 'Use Run Sheet, Vendor Check-In, Staff Command Center, guest lookup, incident reporting, and emergency contacts with offline/sync visibility.',
    icon: <QrCode className="h-14 w-14 text-brand" />,
    href: '#/calendar',
    cta: 'Open day-of tools',
    checklistStep: 'Day-of command',
  },
  {
    id: 'manager-health-escalation',
    roles: ['manager'],
    title: 'Use health alerts to decide what to fix or escalate',
    description: 'Health actions explain operational risk. Fix what your role permits and escalate finance/admin/legal blockers to the owner or admin.',
    icon: <Activity className="h-14 w-14 text-brand" />,
    href: '#/intelligence',
    cta: 'View health actions',
    checklistStep: 'Escalations',
  },
  {
    id: 'manager-training-center',
    roles: ['manager'],
    title: 'Learn with micro-lessons and examples',
    description: 'Use the Help Center training modules for BEO, SLA, load-in, strike, captain mode, escalation, incidents, and readiness.',
    icon: <MonitorPlay className="h-14 w-14 text-brand" />,
    href: '#/',
    cta: 'Open help center',
    checklistStep: 'Training center',
  },
];

const COUPLE_SLIDES: TourSlide[] = [
  {
    id: 'couple-welcome', roles: ['couple'], title: 'Your private wedding hub',
    description: 'Start with your wedding details, planning checklist, guest list, RSVP progress, documents, timeline, floor plan, and venue messages in one couple-friendly place.',
    icon: <Heart className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'Open wedding hub', checklistStep: 'Wedding hub',
  },
  {
    id: 'couple-first-three', roles: ['couple'], title: 'What should I do first?',
    description: 'Begin with the next 3 things: confirm your wedding details, review your guest/RSVP status, and check documents or messages that need your attention.',
    icon: <ClipboardList className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'See next steps', checklistStep: 'First steps',
  },
  {
    id: 'couple-rsvp', roles: ['couple'], title: 'Understand how RSVP works',
    description: 'Use guest list and RSVP tools to track who has responded, collect meal/dietary/accessibility notes, and preview exactly what guests can see before you share the RSVP link.',
    icon: <Users className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'Review RSVP guidance', checklistStep: 'RSVP',
  },
  {
    id: 'couple-floor-plan', roles: ['couple'], title: 'Review your floor plan safely',
    description: 'Couples review the floor plan, seating, tables, ceremony/reception spaces, and requested changes without seeing internal venue operations or staff-only setup details.',
    icon: <Map className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'Open floor plan help', checklistStep: 'Floor plan',
  },
  {
    id: 'couple-documents', roles: ['couple'], title: 'Know how documents and signatures work',
    description: 'Find contracts, invoices, shared documents, change requests, and signature steps with clear explanations of what is pending, approved, or waiting on the venue.',
    icon: <FileSignature className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'Review documents', checklistStep: 'Documents',
  },
  {
    id: 'couple-messages', roles: ['couple'], title: 'Message the venue with confidence',
    description: 'Use venue messages for questions, changes, and approvals. You will see client-friendly status and support guidance instead of internal health or operations terminology.',
    icon: <MessageCircle className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'Open messages guidance', checklistStep: 'Venue messages',
  },
  {
    id: 'couple-learning', roles: ['couple'], title: 'Keep learning at your pace',
    description: 'Use the persistent couple help center for RSVP, floor plans, documents, venue messages, what guests can see, and wedding planning glossary terms.',
    icon: <MonitorPlay className="h-14 w-14 text-brand" />, href: '#/couple/events/:eventId', cta: 'Open help center', checklistStep: 'Help center',
  },
];

const OTHER_SLIDES: TourSlide[] = [
  {
    id: 'vendor-welcome', roles: ['vendor'], title: 'Your vendor portal',
    description: 'Review logistics, submit questionnaires, share documents, and communicate with the venue team.',
    icon: <Truck className="h-14 w-14 text-brand" />, href: '#/vendors', cta: 'Open portal',
  },
  {
    id: 'staff-welcome', roles: ['staff'], title: 'Day-of staff operations',
    description: 'Use assigned tasks, timeline milestones, and check-in tools to keep the event moving.',
    icon: <ShieldCheck className="h-14 w-14 text-brand" />, href: '#/calendar', cta: 'View assignments',
  },
];

function highestRole(memberships: SdkMembership[]): string {
  const roleKeys = memberships.map((m) => m.roleKey);
  if (roleKeys.includes('owner')) return 'owner';
  if (roleKeys.includes('admin')) return 'admin';
  if (roleKeys.includes('manager')) return 'manager';
  if (roleKeys.includes('planner')) return 'planner';
  if (roleKeys.includes('couple')) return 'couple';
  if (roleKeys.includes('vendor')) return 'vendor';
  if (roleKeys.includes('staff')) return 'staff';
  return 'guest';
}

function orgKey(orgId?: string | null): string {
  return orgId || 'personal';
}

export function WelcomeModal({ memberships, orgId, userConfig, onUserConfigChanged, onComplete }: Props) {
  const { toast } = useToast();
  const role = highestRole(memberships);
  const key = orgKey(orgId);
  const storedState = (userConfig as any)?.onboarding?.welcomeTourByOrg?.[key] as { status?: TourStatus; currentSlide?: number; completedSlides?: string[] } | undefined;
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(storedState?.currentSlide ?? 0);
  const [saving, setSaving] = useState(false);

  // Once the user (or a spec/API) closes the tour — Finish, Resume later,
  // Take me there, or dismiss — the config write that follows must NOT
  // re-trigger the open effect. Only a fresh mount or an explicit restart
  // may auto-open it again.
  const intentionallyClosedRef = useRef(false);

  const coupleEventId = memberships.find((m) => m.roleKey === 'couple' && m.eventId)?.eventId;
  const slides = useMemo(() => {
    const source = role === 'manager' ? MANAGER_SLIDES : role === 'couple' ? COUPLE_SLIDES : (role === 'owner' || role === 'admin' || role === 'planner' ? OWNER_SLIDES : OTHER_SLIDES);
    return source.filter((s) => s.roles.includes(role));
  }, [role]);

  async function saveState(patch: { status: TourStatus; currentSlide?: number; completedSlides?: string[] }) {
    if (!orgId) return;
    const nextConfig: PartialPlatformConfig = {
      ...(userConfig ?? {}),
      onboarding: {
        ...((userConfig as any)?.onboarding ?? {}),
        welcomeTourByOrg: {
          ...((userConfig as any)?.onboarding?.welcomeTourByOrg ?? {}),
          [key]: {
            status: patch.status,
            currentSlide: patch.currentSlide ?? slide,
            completedSlides: patch.completedSlides ?? storedState?.completedSlides ?? [],
            startedAt: storedState?.status ? undefined : new Date().toISOString(),
            ...(patch.status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
            ...(patch.status === 'dismissed' ? { dismissedAt: new Date().toISOString() } : {}),
            ...(patch.status === 'in_progress' ? { resumedAt: new Date().toISOString() } : {}),
          },
        },
      } as any,
    };
    setSaving(true);
    try {
      const saved = await sdk.platformConfig.putUserPreferences(nextConfig);
      onUserConfigChanged?.(saved.config);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    // userConfig loads asynchronously. Until it has ARRIVED we cannot know
    // whether the user completed/dismissed the tour, so auto-opening in that
    // window would flash the modal open for completed users (and let a stray
    // Escape write in_progress server-side). Wait for the config — fresh
    // users still get the tour because the server returns an (empty) config
    // object, not undefined.
    if (!orgId || slides.length === 0 || userConfig === undefined) return;
    if (intentionallyClosedRef.current) return;
    const status = storedState?.status ?? 'not_started';
    if (status === 'completed' || status === 'dismissed') {
      // The user already finished/dismissed the tour. IMPORTANT: userConfig
      // loads async — never open when the real config says completed.
      setOpen(false);
      return;
    }
    setSlide(Math.min(storedState?.currentSlide ?? 0, slides.length - 1));
    setOpen(true);
  }, [orgId, slides.length, userConfig, storedState?.status, storedState?.currentSlide]);

  useEffect(() => {
    const restart = () => {
      intentionallyClosedRef.current = false;
      setSlide(0);
      setOpen(true);
      void saveState({ status: 'in_progress', currentSlide: 0, completedSlides: [] });
    };
    window.addEventListener('wvi:restart-welcome-tour', restart);
    return () => window.removeEventListener('wvi:restart-welcome-tour', restart);
  });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && slide < slides.length - 1) setSlide((s) => s + 1);
      if (e.key === 'ArrowLeft' && slide > 0) setSlide((s) => s - 1);
      // Escape is handled by the Dialog itself (DismissableLayer) which
      // routes through onOpenChange → dismiss(). Handling it here too would
      // double-write the preference.
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, slide, slides.length]);

  async function completeTour() {
    intentionallyClosedRef.current = true;
    const completedSlides = slides.map((s) => s.id);
    await saveState({ status: 'completed', currentSlide: slides.length - 1, completedSlides });
    setOpen(false);
    onComplete();
  }

  async function resumeLater() {
    // Explicit in-tour button: the user wants to CONTINUE later, so keep
    // status in_progress (reopens on the next login at the same slide).
    intentionallyClosedRef.current = true;
    await saveState({ status: 'in_progress', currentSlide: slide, completedSlides: slides.slice(0, slide).map((s) => s.id) });
    setOpen(false);
    onComplete();
  }

  async function dismiss() {
    // Escape / backdrop click / close button: the user just wants it GONE.
    // Persist 'dismissed' so it never auto-reopens — writing 'in_progress'
    // here is what made the tour "occasionally reappear".
    intentionallyClosedRef.current = true;
    await saveState({ status: 'dismissed', currentSlide: slide, completedSlides: slides.slice(0, slide).map((s) => s.id) });
    setOpen(false);
    onComplete();
  }

  async function restartTour() {
    intentionallyClosedRef.current = false;
    setSlide(0);
    await saveState({ status: 'in_progress', currentSlide: 0, completedSlides: [] });
  }

  async function takeMeThere() {
    intentionallyClosedRef.current = true;
    const current = slides[slide];
    if (current.sandbox) {
      localStorage.setItem('wvi_demo_mode', 'true');
      localStorage.setItem('wvi_first_event_walkthrough', 'true');
      toast({ title: 'Sandbox learning mode started', description: 'Use this event flow for practice before entering real wedding operations.', variant: 'success' });
    }
    await saveState({ status: 'in_progress', currentSlide: slide, completedSlides: slides.slice(0, slide + 1).map((s) => s.id) });
    if (current.href) window.location.hash = current.href.replace(':eventId', coupleEventId || '').replace(/^#/, '');
    setOpen(false);
    onComplete();
  }

  if (!open || slides.length === 0) return null;
  const currentSlide = slides[slide];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void dismiss(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-surface border-none shadow-2xl" aria-label="Welcome tour">
        <div className="relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-surface-2">
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${((slide + 1) / slides.length) * 100}%` }} />
          </div>

          <div className="grid gap-0 md:grid-cols-[220px_1fr]">
            <aside className="hidden md:block border-r border-border bg-surface-2/60 p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-fg-muted font-bold mb-3">{role === 'couple' ? 'Wedding hub tour' : '5 steps to go live'}</div>
              {slides.slice(0, 7).map((s, i) => (
                <button key={s.id} onClick={() => setSlide(Math.min(i, slides.length - 1))} className={cn('w-full rounded-lg px-3 py-2 text-left text-xs border', slide === i ? 'border-brand bg-brand-soft/60 text-brand font-bold' : 'border-border bg-surface text-fg-muted')}>
                  {i + 1}. {s.checklistStep ?? s.title}
                </button>
              ))}
            </aside>
            <main>
              <div className="p-8 text-center min-h-[360px] flex flex-col items-center justify-center" key={currentSlide.id}>
                <div className="mb-5 rounded-full bg-brand-soft/50 p-4">{currentSlide.icon}</div>
                <DialogTitle className="text-2xl font-display font-semibold mb-3">{currentSlide.title}</DialogTitle>
                <DialogDescription className="text-fg-muted leading-relaxed max-w-md">{currentSlide.description}</DialogDescription>
                {(currentSlide.id === 'owner-learning-center' || currentSlide.id === 'couple-learning') && (
                  <div className="mt-5 grid gap-2 text-xs text-left sm:grid-cols-2">
                    {(currentSlide.id === 'couple-learning'
                      ? ['RSVP import walkthrough', 'Seating review walkthrough', 'Timeline approval walkthrough', 'Payment/signature walkthrough', 'Final walkthrough prep']
                      : ['Setup basics', 'First event creation', 'Guest/Vendor portals', 'Health checks']
                    ).map((lesson) => (
                      <div key={lesson} className="rounded-lg border border-border bg-surface-2 p-2 flex items-center gap-2"><MonitorPlay className="h-3.5 w-3.5 text-brand" /> {lesson}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface-2/50 border-t border-border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1.5 justify-center sm:justify-start">
                  {slides.map((_, i) => (
                    <button key={i} type="button" onClick={() => setSlide(i)} aria-label={`Go to slide ${i + 1} of ${slides.length}`} aria-current={i === slide ? 'step' : undefined} className={cn('h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', i === slide ? 'bg-brand w-6' : 'bg-border hover:bg-brand/50 w-2')} />
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={resumeLater} disabled={saving}>Resume later</Button>
                  <Button variant="outline" size="sm" onClick={restartTour} disabled={saving}>Restart tour</Button>
                  <Button variant="outline" size="sm" onClick={takeMeThere} disabled={saving}>{currentSlide.cta ?? 'Take me there'}</Button>
                  {slide === slides.length - 1 ? (
                    <Button onClick={completeTour} disabled={saving}><CheckCircle2 className="h-4 w-4" /> Finish tour</Button>
                  ) : (
                    <Button onClick={() => setSlide((s) => s + 1)} disabled={saving}>Next <Sparkles className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
