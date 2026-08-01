/**
 * Sync Control Panel.
 *
 * Mount it inside the admin section. Shows live:
 *   - Server reachability (green/red dot)
 *   - Per-domain feature flag toggles (local / dual / server)
 *   - Pending write queue size + breakdown
 *   - Recent requests (last 20, success/error)
 *   - Recent sync conflicts (with reason)
 *
 * Doubles as a smoke-test runner: a button hits /api/health and shows
 * the result inline.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import {
  ALL_DOMAINS, type Domain, type DomainMode,
} from '../dual-write/featureFlags.js';
import { useFeatureFlags } from '../dual-write/FeatureFlagsContext.js';
import { useSyncStatus } from '../dual-write/useSyncStatus.js';
import { drain, clear as clearQueue } from '../dual-write/writeQueue.js';
import { sdk } from '../sdk/index.js';

// ─── Styles (inline so it works without any CSS framework) ─────
const card: CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
};
const sectionTitle: CSSProperties = {
  fontSize: 14, fontWeight: 600, textTransform: 'uppercase',
  color: '#6b7280', letterSpacing: '0.05em', marginBottom: 12,
};
const pill: CSSProperties = {
  padding: '3px 10px', borderRadius: 99, fontSize: 12,
  fontWeight: 500, display: 'inline-block',
};
const btnBase: CSSProperties = {
  padding: '6px 12px', borderRadius: 6, fontSize: 13,
  border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff',
};

const MODE_COLORS: Record<DomainMode, { bg: string; fg: string }> = {
  local:  { bg: '#fef3c7', fg: '#92400e' },
  dual:   { bg: '#dbeafe', fg: '#1e40af' },
  server: { bg: '#d1fae5', fg: '#065f46' },
};

export function ControlPanel() {
  const { flags, setFlag, setAll, reset } = useFeatureFlags();
  const status = useSyncStatus();
  const [healthMsg, setHealthMsg] = useState<string>('');

  const queueBreakdown = useMemo(() => {
    return Object.entries(status.queueByDomain)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [status.queueByDomain]);

  async function runHealthCheck() {
    setHealthMsg('Checking...');
    try {
      // Tiny SDK shortcut: hit /api/health via the same fetch wrapper
      const res = await fetch('/api/health');
      const body = await res.json();
      setHealthMsg(`OK - schema v${body.schemaVersion ?? '?'} at ${body.ts ?? ''}`);
    } catch (e) {
      setHealthMsg(`Unreachable: ${(e as Error).message}`);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0, color: '#4A1942' }}>Sync Control Panel</h2>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Live status of the dual-write layer and per-domain feature flags.
        Visible to org owners; intended as both a debugging surface and a
        production health check.
      </p>

      {/* ── Server status ───────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Server</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              ...pill,
              background: status.serverReachable ? '#d1fae5' : '#fee2e2',
              color:      status.serverReachable ? '#065f46' : '#991b1b',
            }}
          >
            {status.serverReachable ? '● Reachable' : '○ Unreachable'}
          </span>
          <button style={btnBase} onClick={runHealthCheck}>Run health check</button>
          {healthMsg && (
            <span style={{ fontSize: 13, color: '#6b7280' }}>{healthMsg}</span>
          )}
        </div>
      </div>

      {/* ── Feature flags ───────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Domain Modes</div>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
          Per-domain control of whether reads/writes hit localStorage,
          the server, or both. Switch a domain to <code>dual</code> to
          start mirroring; switch to <code>server</code> when you trust
          the data has migrated.
        </p>
        <p style={{ fontSize: 12, color: '#92400e', marginTop: 0, marginBottom: 16 }}>
          These diagnostic switches are browser-local troubleshooting controls. They do not change shared server configuration and should be reset after investigation.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button style={btnBase} onClick={() => setAll('local')}>All local</button>
          <button style={btnBase} onClick={() => setAll('dual')}>All dual</button>
          <button style={btnBase} onClick={() => setAll('server')}>All server</button>
          <button style={btnBase} onClick={reset}>Reload from disk</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: 8, fontSize: 13, color: '#6b7280' }}>Domain</th>
              <th style={{ padding: 8, fontSize: 13, color: '#6b7280' }}>Mode</th>
              <th style={{ padding: 8, fontSize: 13, color: '#6b7280' }}>Switch to</th>
            </tr>
          </thead>
          <tbody>
            {ALL_DOMAINS.map((d) => {
              const mode = flags[d];
              const color = MODE_COLORS[mode];
              return (
                <tr key={d} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 13 }}>{d}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ ...pill, background: color.bg, color: color.fg }}>
                      {mode}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['local','dual','server'] as DomainMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setFlag(d, m)}
                          disabled={m === mode}
                          style={{
                            ...btnBase, fontSize: 12, padding: '3px 8px',
                            opacity: m === mode ? 0.5 : 1,
                            cursor: m === mode ? 'default' : 'pointer',
                          }}
                        >{m}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Write queue ─────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Offline Write Queue</div>
        {status.queueSize === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            Empty — all writes have synced to the server.
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0, marginBottom: 12 }}>
              <strong>{status.queueSize}</strong> pending {status.queueSize === 1 ? 'write' : 'writes'} waiting to replay.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {queueBreakdown.map(([d, n]) => (
                <li key={d} style={{ fontSize: 13, padding: '4px 0' }}>
                  <code>{d}</code> &mdash; {n}
                </li>
              ))}
            </ul>
          </>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={btnBase}
            onClick={() => { void drain(); }}
            disabled={status.queueSize === 0}
          >Force replay now</button>
          <button
            style={{ ...btnBase, color: '#991b1b' }}
            onClick={() => {
              if (confirm(`Discard ${status.queueSize} pending writes?`)) clearQueue();
            }}
            disabled={status.queueSize === 0}
          >Discard queue</button>
        </div>
      </div>

      {/* ── Recent conflicts ────────────────────────── */}
      {status.recentConflicts.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Recent Sync Conflicts</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {status.recentConflicts.map((c) => (
              <li key={c.clientId} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#991b1b' }}>●</span>{' '}
                <code>{c.domain}.{c.op}</code> {' — '}
                <span style={{ color: '#6b7280' }}>{c.reason}</span>{' '}
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  {new Date(c.ts).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recent requests ─────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Recent Requests ({status.recentRequests.length})</div>
        {status.recentRequests.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            No requests yet. Interact with the app to populate this.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: 6, color: '#6b7280' }}>Time</th>
                <th style={{ padding: 6, color: '#6b7280' }}>Method</th>
                <th style={{ padding: 6, color: '#6b7280' }}>Path</th>
                <th style={{ padding: 6, color: '#6b7280' }}>Status</th>
                <th style={{ padding: 6, color: '#6b7280' }}>ms</th>
              </tr>
            </thead>
            <tbody>
              {status.recentRequests.slice(0, 20).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: 6, color: '#6b7280' }}>
                    {new Date(r.ts).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: 6, fontFamily: 'monospace', color: '#4b5563' }}>{r.method}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{r.path}</td>
                  <td style={{ padding: 6, color: r.ok ? '#065f46' : '#991b1b', fontWeight: 500 }}>
                    {r.status || r.errorCode || 'fail'}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{r.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
