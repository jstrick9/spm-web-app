import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  ConfigProvider, useBranding, useFeatureEnabled, useNavItems,
  usePlatformConfig, useTheme, useWidgetSlot,
} from './ConfigProvider.js';

function Probe() {
  const theme = useTheme();
  const branding = useBranding();
  const nav = useNavItems();
  const slot = useWidgetSlot('venue.dashboard.kpis');
  const reportsOn = useFeatureEnabled('reports');
  return (
    <div>
      <span data-testid="brand">{theme.brand}</span>
      <span data-testid="density">{theme.density}</span>
      <span data-testid="platform">{branding.platformName}</span>
      <span data-testid="nav-len">{nav.length}</span>
      <span data-testid="slot-first">{slot[0]?.id ?? 'none'}</span>
      <span data-testid="reports">{reportsOn ? 'on' : 'off'}</span>
    </div>
  );
}

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  // Wipe inline theme vars between tests
  for (const v of ['--color-brand', '--color-bg', '--height-control']) {
    document.documentElement.style.removeProperty(v);
  }
});

describe('ConfigProvider', () => {
  it('exposes SYSTEM_DEFAULTS when no layers', () => {
    render(<ConfigProvider><Probe /></ConfigProvider>);
    expect(screen.getByTestId('brand').textContent).toBe('74 25 66');
    expect(screen.getByTestId('density').textContent).toBe('comfortable');
    expect(screen.getByTestId('platform').textContent).toMatch(/Wedding Venue/);
    expect(screen.getByTestId('reports').textContent).toBe('on');
  });

  it('org theme overrides brand color', () => {
    render(
      <ConfigProvider org={{ theme: { brand: '5 5 5' } }}>
        <Probe />
      </ConfigProvider>,
    );
    expect(screen.getByTestId('brand').textContent).toBe('5 5 5');
  });

  it('applies the resolved theme as CSS variables on <html>', () => {
    render(
      <ConfigProvider org={{ theme: { brand: '12 34 56' } }}>
        <Probe />
      </ConfigProvider>,
    );
    // useEffect runs after paint; force a flush.
    const brandVar = document.documentElement.style.getPropertyValue('--color-brand');
    expect(brandVar).toBe('12 34 56');
  });

  it('density "compact" sets a 32px control height var', () => {
    render(
      <ConfigProvider org={{ theme: { density: 'compact' } }}>
        <Probe />
      </ConfigProvider>,
    );
    const h = document.documentElement.style.getPropertyValue('--height-control');
    expect(h).toBe('32px');
  });

  it('density "spacious" sets a 48px control height var', () => {
    render(
      <ConfigProvider org={{ theme: { density: 'spacious' } }}>
        <Probe />
      </ConfigProvider>,
    );
    const h = document.documentElement.style.getPropertyValue('--height-control');
    expect(h).toBe('48px');
  });

  it('disabling a feature flag is observable via useFeatureEnabled', () => {
    render(
      <ConfigProvider org={{ layout: { featureFlags: { reports: false } } }}>
        <Probe />
      </ConfigProvider>,
    );
    expect(screen.getByTestId('reports').textContent).toBe('off');
  });

  it('overriding a widget slot replaces the slot content', () => {
    render(
      <ConfigProvider
        org={{
          widgets: {
            'venue.dashboard.kpis': { widgets: [{ id: 'kpi.vacancy' }] },
          },
        }}
      >
        <Probe />
      </ConfigProvider>,
    );
    expect(screen.getByTestId('slot-first').textContent).toBe('kpi.vacancy');
  });

  it('setPreviewOverride is reactive and clearable', () => {
    let api: ReturnType<typeof usePlatformConfig> | null = null;
    function Capture() {
      api = usePlatformConfig();
      return <Probe />;
    }
    render(<ConfigProvider><Capture /></ConfigProvider>);
    expect(screen.getByTestId('brand').textContent).toBe('74 25 66');

    act(() => {
      api!.setPreviewOverride({ theme: { brand: '111 222 33' } });
    });
    expect(screen.getByTestId('brand').textContent).toBe('111 222 33');
    expect(api!.previewActive).toBe(true);

    act(() => {
      api!.setPreviewOverride(null);
    });
    expect(screen.getByTestId('brand').textContent).toBe('74 25 66');
    expect(api!.previewActive).toBe(false);
  });

  it('throws when hooks used outside provider', () => {
    function Naked() { useTheme(); return null; }
    const orig = console.error;
    console.error = () => {};
    expect(() => render(<Naked />)).toThrow(/ConfigProvider/);
    console.error = orig;
  });
});
