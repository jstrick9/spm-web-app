import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformStudio } from './PlatformStudio';
import { ConfigProvider } from '../config/ConfigProvider';
import { ToastProvider } from '../ui/Toast';
import { http, HttpResponse, server } from '../test/server';
import { setToken } from '../sdk/client';
import { THEME_PRESETS } from '../config/presets';

const ORG_ID = 'org-x';

function harness(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setToken('test-token');
  // Default: empty server config
  server.use(
    http.get('/api/orgs/:orgId/config', () => HttpResponse.json({ config: {} })),
  );
});

describe('PlatformStudio', () => {
  it('renders the page header and all 6 presets', async () => {
    render(harness(<PlatformStudio orgId={ORG_ID} onSaved={() => {}} />));
    expect(await screen.findByRole('heading', { name: /Platform Studio/i })).toBeInTheDocument();
    for (const preset of THEME_PRESETS) {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    }
  });

  it('PUTs the preset to the server when Apply is clicked', async () => {
    let putBody: unknown;
    server.use(
      http.put('/api/orgs/:orgId/config', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ config: putBody });
      }),
    );
    const onSaved = vi.fn();
    render(harness(<PlatformStudio orgId={ORG_ID} onSaved={onSaved} />));
    // Click the first Apply button
    const buttons = await screen.findAllByRole('button', { name: /Apply to organization/i });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // The PUT body should include the theme block
    expect(putBody).toMatchObject({ theme: expect.any(Object) });
  });

  it('shows the "Active" badge for the currently applied preset', async () => {
    const aubergine = THEME_PRESETS[0];   // classic-aubergine
    server.use(
      http.get('/api/orgs/:orgId/config', () =>
        HttpResponse.json({ config: { theme: { brand: aubergine.config.theme!.brand } } })),
    );
    render(harness(<PlatformStudio orgId={ORG_ID} onSaved={() => {}} />));
    expect(await screen.findByText('Active')).toBeInTheDocument();
  });

  it('surfaces a toast on save failure', async () => {
    server.use(
      http.put('/api/orgs/:orgId/config', () =>
        HttpResponse.json({ error: 'server-error' }, { status: 500 })),
    );
    render(harness(<PlatformStudio orgId={ORG_ID} onSaved={() => {}} />));
    const buttons = await screen.findAllByRole('button', { name: /Apply to organization/i });
    await userEvent.click(buttons[0]);
    expect(await screen.findByText(/Could not save/i)).toBeInTheDocument();
  });
});
