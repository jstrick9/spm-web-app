import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const announceMock = vi.fn();

vi.mock('./LiveRegion', () => ({
  announce: (message: string) => announceMock(message),
}));

import { ToastContainer, showToast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a toast when showToast is called', async () => {
    render(<ToastContainer />);

    await act(async () => {
      showToast('Saved successfully', 'success');
    });

    expect(await screen.findByText('Saved successfully')).toBeInTheDocument();
  });

  it('announces toast messages to the live region bridge', async () => {
    render(<ToastContainer />);

    await act(async () => {
      showToast('Collaboration warning', 'warning');
    });

    await waitFor(() => {
      expect(announceMock).toHaveBeenCalledWith('Collaboration warning');
    });
  });

  it('deduplicates identical toasts within the dedupe window', async () => {
    render(<ToastContainer />);

    await act(async () => {
      showToast('Duplicate message', 'info');
      showToast('Duplicate message', 'info');
    });

    const messages = await screen.findAllByText('Duplicate message');
    expect(messages).toHaveLength(1);
  });

  it('does not deduplicate different toast types for different messages', async () => {
    render(<ToastContainer />);

    await act(async () => {
      showToast('First message', 'info');
      showToast('Second message', 'warning');
    });

    expect(await screen.findByText('First message')).toBeInTheDocument();
    expect(await screen.findByText('Second message')).toBeInTheDocument();
  });
});