import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationCenter } from './NotificationCenter';

vi.mock('../../lib/router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}));

const enable = vi.fn();
const disable = vi.fn();

let pushState: {
  supported: boolean; enabled: boolean; serverConfigured: boolean | null;
  busy: boolean; error: string | null; enable: typeof enable; disable: typeof disable;
};

vi.mock('../../lib/usePushNotifications', () => ({
  usePushNotifications: () => pushState,
}));

function openDropdown(memberships = [{ roleId: 'sys_owner', roleKey: 'owner', roleName: 'Owner', organizationId: 'org-1' }]) {
  render(<NotificationCenter memberships={memberships as never} />);
  fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
}

describe('NotificationCenter browser push toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    enable.mockReset();
    disable.mockReset();
    pushState = {
      supported: true, enabled: false, serverConfigured: true,
      busy: false, error: null, enable, disable,
    };
  });

  it('shows the browser push section with an off toggle', () => {
    openDropdown();
    expect(screen.getByText('Browser push')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: /enable browser push notifications/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('enable() is called when the toggle is switched on', () => {
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: /enable browser push notifications/i }));
    expect(enable).toHaveBeenCalledTimes(1);
  });

  it('shows the on state and calls disable() when switched off', () => {
    pushState = { supported: true, enabled: true, serverConfigured: true, busy: false, error: null, enable, disable };
    openDropdown();
    expect(screen.getByText(/even when this tab is closed/i)).toBeTruthy();
    const toggle = screen.getByRole('button', { name: /disable browser push notifications/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it('explains the admin step when the server has no VAPID keys', () => {
    pushState = { supported: true, enabled: false, serverConfigured: false, busy: false, error: null, enable, disable };
    openDropdown();
    expect(screen.getByText(/VAPID keys/i)).toBeTruthy();
  });

  it('surfaces the hook error with role=alert', () => {
    pushState = { supported: true, enabled: false, serverConfigured: true, busy: false, error: 'Notifications were blocked.', enable, disable };
    openDropdown();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Notifications were blocked.');
  });

  it('shows Not supported in browsers without the Push API', () => {
    pushState = { supported: false, enabled: false, serverConfigured: true, busy: false, error: null, enable, disable };
    openDropdown();
    expect(screen.getByText('Not supported')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /push notifications/i })).toBeNull();
  });
});
