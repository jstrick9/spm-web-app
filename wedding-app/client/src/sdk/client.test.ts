import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFile, setToken, ApiError } from './client';

describe('downloadFile (authenticated downloads)', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalWindowOpen = window.open;

  beforeEach(() => {
    localStorage.clear();
    setToken('jwt-abc');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.open = originalWindowOpen;
  });

  it('sends the JWT and downloads the blob with the server filename', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['hello'], { type: 'text/plain' }), {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="guests.csv"' },
      }),
    );
    globalThis.fetch = fetchMock as any;
    const click = vi.fn();
    const remove = vi.fn();
    const create = vi.fn(() => 'blob:xyz');
    URL.createObjectURL = create as any;
    URL.revokeObjectURL = vi.fn() as any;
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click, remove,
    } as any);
    vi.spyOn(document.body, 'appendChild').mockReturnValue({} as any);

    await downloadFile('/api/orgs/o1/export/guests.csv');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/orgs/o1/export/guests.csv');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it('throws ApiError (not a raw fetch error) on non-OK responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'forbidden', message: 'nope' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    ) as any;

    await expect(downloadFile('/api/events/e1/export.ics')).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
      code: 'forbidden',
    });
  });

  it('maps network failures to offline ApiError', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as any;
    await expect(downloadFile('/api/events/e1/export.ics')).rejects.toMatchObject({
      kind: 'offline',
      status: 0,
      code: 'network-error',
    });
  });

  it('opens the blob in a new tab when open: true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['pdf'], { type: 'application/pdf' }), { status: 200 }),
    ) as any;
    URL.createObjectURL = vi.fn(() => 'blob:coi') as any;
    URL.revokeObjectURL = vi.fn() as any;
    const open = vi.fn();
    window.open = open as any;

    await downloadFile('/api/assets/a1/content', { open: true });

    expect(open).toHaveBeenCalledWith('blob:coi', '_blank', 'noopener');
    expect(ApiError).toBeDefined();
  });
});
