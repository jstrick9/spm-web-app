import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppStatusBar } from './AppStatusBar';

describe('AppStatusBar', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<AppStatusBar items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders status items with title and description', () => {
    render(
      <AppStatusBar
        items={[
          {
            id: 'one',
            kind: 'warning',
            title: 'Safe Mode is active',
            description: 'Advanced actions are limited until recovery is reviewed.',
          },
        ]}
      />,
    );

    expect(screen.getByText('Safe Mode is active')).toBeInTheDocument();
    expect(
      screen.getByText(/advanced actions are limited until recovery is reviewed/i),
    ).toBeInTheDocument();
  });

  it('renders and triggers action buttons', async () => {
    const user = userEvent.setup();
    const onOpenRecovery = vi.fn();
    const onDismiss = vi.fn();

    render(
      <AppStatusBar
        items={[
          {
            id: 'one',
            kind: 'warning',
            title: 'Layout revision conflict',
            description: 'A newer revision of this layout is available.',
            actions: [
              { label: 'Open Recovery Tools', onClick: onOpenRecovery },
              { label: 'Dismiss', onClick: onDismiss },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /open recovery tools/i }));
    expect(onOpenRecovery).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('supports multiple status items', () => {
    render(
      <AppStatusBar
        items={[
          {
            id: 'one',
            kind: 'info',
            title: 'Editing revision 4',
          },
          {
            id: 'two',
            kind: 'error',
            title: 'Backup import failed',
            description: 'The bundle checksum did not match.',
          },
        ]}
      />,
    );

    expect(screen.getByText('Editing revision 4')).toBeInTheDocument();
    expect(screen.getByText('Backup import failed')).toBeInTheDocument();
    expect(screen.getByText(/checksum did not match/i)).toBeInTheDocument();
  });
});