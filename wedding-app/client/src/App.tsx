/**
 * POC app — single-file React UI that exercises every server endpoint.
 *
 * Three "screens":
 *   1. Login / Register  (when no JWT)
 *   2. Dashboard         (events list, guest list, RSVPs, audit)
 *   3. Public Guest Portal  (no auth, accessed via #/portal/<eventId>)
 *
 * Styles are inline (matches the original app's preview constraints).
 * This is intentionally minimal so the architecture is the star.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { ApiError, api, getToken, setToken } from './lib/api';

// ─── shared inline styles ────────────────────────────────────
const card: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  maxWidth: 720,
  margin: '24px auto',
};
const btn: CSSProperties = {
  background: '#4A1942',
  color: 'white',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 14,
};
const btnSecondary: CSSProperties = { ...btn, background: '#e5e7eb', color: '#1f2937' };
const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 12,
};
const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' };
const errStyle: CSSProperties = { color: '#dc2626', fontSize: 13, marginBottom: 12 };

// ─── data shapes (mirror server repos) ───────────────────────
interface User { id: string; email: string; fullName?: string; }
interface Org  { id: string; name: string; slug: string; }
interface Event { id: string; organization_id: string; title: string; start_date: string | null; status: string; }
interface Guest { id: string; full_name: string; email: string | null; rsvp_status: string; plus_one_allowed: number; }
interface Rsvp  { id: string; guest_name?: string; attending: number; meal_choice: string | null; submitted_at: string; notes: string | null; }

// ─── tiny hash-router (avoids react-router dep for POC) ──────
function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const fn = () => setHash(window.location.hash);
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return hash;
}

// ════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════
export default function App() {
  const hash = useHash();
  const portalMatch = hash.match(/^#\/portal\/([^/?]+)/);
  if (portalMatch) return <GuestPortal eventId={portalMatch[1]} />;
  return <PlatformApp />;
}

// ════════════════════════════════════════════════════════════
// PLATFORM (authenticated)
// ════════════════════════════════════════════════════════════
function PlatformApp() {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setBootstrapped(true); return; }
      try {
        const me = await api.get<{ user: User }>('/api/auth/me');
        setUser(me.user);
      } catch {
        setToken(null);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  if (!bootstrapped) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;

  if (!user) return <AuthScreen onAuth={setUser} />;

  return <Dashboard user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}

// ─── Auth (login + register tabs) ────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('wedding123');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const body = mode === 'login'
        ? { email, password }
        : { email, password, fullName, orgName };
      const res = await api.post<{ token: string; user: User }>(
        `/api/auth/${mode}`,
        body,
        { auth: false },
      );
      setToken(res.token);
      onAuth(res.user);
    } catch (err) {
      const e = err as ApiError;
      setError(
        e.code === 'invalid-credentials' ? 'Email or password is incorrect.' :
        e.code === 'email-already-registered' ? 'That email is already registered.' :
        e.code === 'invalid-input' ? 'Please check the form fields.' :
        `Error: ${e.message}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...card, marginTop: 80, maxWidth: 420 }}>
      <h1 style={{ margin: '0 0 4px', color: '#4A1942' }}>Wedding Venue POC</h1>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Self-hosted backend, SQLite on disk.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setMode('login')}
          style={mode === 'login' ? btn : btnSecondary}
        >Log in</button>
        <button
          onClick={() => setMode('register')}
          style={mode === 'register' ? btn : btnSecondary}
        >Create account</button>
      </div>

      <form onSubmit={submit}>
        {mode === 'register' && (
          <>
            <label style={label}>Your name</label>
            <input style={input} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <label style={label}>Venue / organization name</label>
            <input style={input} value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
          </>
        )}
        <label style={label}>Email</label>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label style={label}>Password</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <div style={errStyle}>{error}</div>}
        <button type="submit" style={{ ...btn, width: '100%' }} disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 16, marginBottom: 0 }}>
        Demo seed: <code>owner@demo.local</code> / <code>wedding123</code>
      </p>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────
function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ organizations: Org[] }>('/api/orgs').then((r) => {
      setOrgs(r.organizations);
      if (r.organizations[0]) setActiveOrgId(r.organizations[0].id);
    });
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    api.get<{ events: Event[] }>(`/api/orgs/${activeOrgId}/events`).then((r) => {
      setEvents(r.events);
      if (r.events[0] && !activeEventId) setActiveEventId(r.events[0].id);
    });
  }, [activeOrgId]);

  return (
    <>
      <header style={{
        background: '#4A1942', color: 'white', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <strong>Wedding Venue POC</strong>
          <span style={{ marginLeft: 12, opacity: 0.7, fontSize: 13 }}>
            Signed in as {user.email}
          </span>
        </div>
        <button onClick={onLogout} style={btnSecondary}>Log out</button>
      </header>

      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Your Organizations</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => { setActiveOrgId(o.id); setActiveEventId(null); }}
              style={o.id === activeOrgId ? btn : btnSecondary}
            >{o.name}</button>
          ))}
        </div>
      </div>

      {activeOrgId && (
        <EventsSection
          orgId={activeOrgId}
          events={events}
          activeEventId={activeEventId}
          onSelectEvent={setActiveEventId}
          onCreate={(e) => setEvents((prev) => [...prev, e])}
        />
      )}

      {activeEventId && <GuestsSection eventId={activeEventId} />}
      {activeEventId && <RsvpsSection eventId={activeEventId} />}
      {activeEventId && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Public Guest Portal Link</h3>
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Share this URL — no login required for guests.
          </p>
          <code style={{
            display: 'block', padding: 12, background: '#f3f4f6',
            borderRadius: 6, wordBreak: 'break-all',
          }}>
            {window.location.origin}/#/portal/{activeEventId}
          </code>
          <a
            href={`#/portal/${activeEventId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...btn, display: 'inline-block', marginTop: 12, textDecoration: 'none' }}
          >Open portal in new tab</a>
        </div>
      )}
    </>
  );
}

// ─── Events section ──────────────────────────────────────────
function EventsSection({
  orgId, events, activeEventId, onSelectEvent, onCreate,
}: {
  orgId: string;
  events: Event[];
  activeEventId: string | null;
  onSelectEvent: (id: string) => void;
  onCreate: (e: Event) => void;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ event: Event }>('/api/events', {
        organizationId: orgId,
        title,
        startDate: startDate || undefined,
      });
      onCreate(res.event);
      onSelectEvent(res.event.id);
      setTitle(''); setStartDate('');
    } finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Events</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map((e) => (
          <li key={e.id} style={{ marginBottom: 8 }}>
            <button
              onClick={() => onSelectEvent(e.id)}
              style={{
                ...(e.id === activeEventId ? btn : btnSecondary),
                width: '100%', textAlign: 'left',
              }}
            >
              <strong>{e.title}</strong>
              <span style={{ opacity: 0.7, marginLeft: 12 }}>
                {e.start_date ?? 'no date'} · {e.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={create} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginTop: 16 }}>
        <label style={label}>New event title</label>
        <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label style={label}>Start date (optional)</label>
        <input style={input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <button type="submit" style={btn} disabled={busy || !title}>
          {busy ? '…' : 'Create event'}
        </button>
      </form>
    </div>
  );
}

// ─── Guests section ──────────────────────────────────────────
function GuestsSection({ eventId }: { eventId: string }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { reload(); /* eslint-disable-line */ }, [eventId]);
  async function reload() {
    const r = await api.get<{ guests: Guest[] }>(`/api/events/${eventId}/guests`);
    setGuests(r.guests);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/guests', {
        eventId,
        fullName,
        email: email || undefined,
      });
      setFullName(''); setEmail('');
      await reload();
    } finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Guests</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>RSVP</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((g) => (
            <tr key={g.id} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: 8 }}>{g.full_name}</td>
              <td style={{ padding: 8, color: '#6b7280' }}>{g.email ?? '—'}</td>
              <td style={{ padding: 8 }}>
                <span style={rsvpBadge(g.rsvp_status)}>{g.rsvp_status}</span>
              </td>
            </tr>
          ))}
          {guests.length === 0 && (
            <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>No guests yet.</td></tr>
          )}
        </tbody>
      </table>
      <form onSubmit={add} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginTop: 16 }}>
        <label style={label}>Add guest</label>
        <input style={input} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input style={input} type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" style={btn} disabled={busy || !fullName}>
          {busy ? '…' : 'Add guest'}
        </button>
      </form>
    </div>
  );
}

function rsvpBadge(status: string): CSSProperties {
  const colors: Record<string, [string, string]> = {
    pending:   ['#fef3c7', '#92400e'],
    attending: ['#d1fae5', '#065f46'],
    declined:  ['#fee2e2', '#991b1b'],
    maybe:     ['#dbeafe', '#1e40af'],
  };
  const [bg, fg] = colors[status] ?? colors.pending;
  return {
    background: bg, color: fg, padding: '2px 8px', borderRadius: 99,
    fontSize: 12, fontWeight: 500,
  };
}

// ─── RSVPs section ───────────────────────────────────────────
function RsvpsSection({ eventId }: { eventId: string }) {
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);

  useEffect(() => {
    const tick = () => api.get<{ rsvps: Rsvp[] }>(`/api/events/${eventId}/rsvps`).then((r) => setRsvps(r.rsvps));
    tick();
    const id = setInterval(tick, 5000); // simple polling — production would use SSE/websocket
    return () => clearInterval(id);
  }, [eventId]);

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Live RSVP Submissions</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>
        Refreshes every 5 seconds.
      </p>
      {rsvps.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>
          No RSVPs yet. Open the guest portal in another tab to submit one.
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rsvps.map((r) => (
          <li key={r.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{r.guest_name ?? '(unknown guest)'}</strong>
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                {new Date(r.submitted_at).toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>
              {r.attending ? '✅ Attending' : '❌ Not attending'}
              {r.meal_choice ? ` · ${r.meal_choice}` : ''}
              {r.notes ? <div style={{ marginTop: 4, color: '#6b7280' }}>"{r.notes}"</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PUBLIC GUEST PORTAL  (no auth)
// ════════════════════════════════════════════════════════════
function GuestPortal({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<{ title: string; startDate: string | null } | null>(null);
  const [guests, setGuests] = useState<Array<{ id: string; fullName: string }>>([]);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [attending, setAttending] = useState(true);
  const [mealChoice, setMealChoice] = useState('standard');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Public endpoint: no auth header sent (api.ts gates on { auth: false }).
    // Returns the event AND a sparse {id, fullName} list of invited guests
    // so the guest can pick their name from a dropdown.
    api.get<{
      event: { id: string; title: string; startDate: string | null };
      guests: Array<{ id: string; fullName: string }>;
    }>(`/api/portal/${eventId}/info`, { auth: false })
      .then((r) => {
        setEvent({ title: r.event.title, startDate: r.event.startDate });
        setGuests(r.guests);
      })
      .catch(() => setError('Event not found. Check the URL.'));
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) {
      setError('Please pick your name from the list above.');
      return;
    }
    try {
      await api.post(
        `/api/portal/${eventId}/rsvp`,
        {
          guestId: selectedGuestId,
          attending,
          mealChoice,
          notes: notes || undefined,
        },
        { auth: false },
      );
      setDone(true);
    } catch (err) {
      const e = err as ApiError;
      setError(
        e.code === 'guest-not-in-event' ? 'That guest is not on the list for this event.' :
        e.code === 'portal-access-revoked' ? 'Portal access has been revoked for that guest.' :
        `Submission failed: ${e.message}`
      );
    }
  }

  if (error) return <div style={{ ...card, marginTop: 80 }}><p style={errStyle}>{error}</p></div>;
  if (!event) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;

  if (done) {
    return (
      <div style={{ ...card, marginTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💌</div>
        <h2>Thank you!</h2>
        <p>Your RSVP for <strong>{event.title}</strong> has been received.</p>
      </div>
    );
  }

  return (
    <div style={{ ...card, marginTop: 60 }}>
      <h1 style={{ color: '#4A1942', marginTop: 0 }}>{event.title}</h1>
      <p style={{ color: '#6b7280' }}>
        {event.startDate ? `On ${event.startDate}.` : ''} Please RSVP below.
      </p>
      <form onSubmit={submit}>
        <label style={label}>Your name (so we can match your invitation)</label>
        <select
          style={input}
          value={selectedGuestId}
          onChange={(e) => setSelectedGuestId(e.target.value)}
          required
        >
          <option value="">— pick your name —</option>
          {guests.map((g) => (
            <option key={g.id} value={g.id}>{g.fullName}</option>
          ))}
        </select>
        {guests.length === 0 && (
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: -8 }}>
            No guests have been added to this event yet.
          </p>
        )}

        <label style={label}>Will you attend?</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => setAttending(true)}
            style={attending ? btn : btnSecondary}>✅ Yes</button>
          <button type="button" onClick={() => setAttending(false)}
            style={!attending ? btn : btnSecondary}>❌ No</button>
        </div>

        {attending && (
          <>
            <label style={label}>Meal preference</label>
            <select style={input} value={mealChoice} onChange={(e) => setMealChoice(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="gluten-free">Gluten-free</option>
            </select>
          </>
        )}

        <label style={label}>Notes (allergies, accessibility, well-wishes)</label>
        <textarea
          style={{ ...input, minHeight: 80 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <div style={errStyle}>{error}</div>}

        <button type="submit" style={{ ...btn, width: '100%' }}>Submit RSVP</button>
      </form>
    </div>
  );
}
