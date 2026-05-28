import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VendorCheckInApp } from './VendorCheckInApp';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

// Mock the QR Scanner because it requires browser DOM globals not present in jsdom
vi.mock('html5-qrcode', () => {
  return {
    Html5QrcodeScanner: class {
      render(onSuccess: any, onError: any) {
        // We'll simulate a scan by placing a hidden button we can click in the DOM
        const reader = document.getElementById('reader');
        if (reader) {
          const btn = document.createElement('button');
          btn.innerHTML = 'Simulate Scan';
          btn.onclick = () => onSuccess('v1');
          reader.appendChild(btn);
        }
      }
      clear() {}
    }
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../sdk', () => ({
  sdk: {
    vendors: {
      list: vi.fn().mockResolvedValue({ 
        vendors: [
          { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
          { id: 'v2', name: 'Food Co', category: 'Catering' }
        ] 
      }),
    }
  }
}));

describe('VendorCheckInApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('allows scanning a QR code to check in a vendor', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('DJ Snake')).toBeInTheDocument();
    
    // Open scanner
    const scanBtn = screen.getByRole('button', { name: /Scan/i });
    fireEvent.click(scanBtn);
    
    expect(screen.getByText('Scan Vendor Pass')).toBeInTheDocument();
    
    // Simulate the scan triggering success inside the mock
    await waitFor(() => {
       const simulateBtn = screen.getByText('Simulate Scan');
       fireEvent.click(simulateBtn);
    });
    
    // Status should immediately jump to arrived!
    await waitFor(() => {
      expect(screen.getByText('DJ Snake Checked In!')).toBeInTheDocument();
      // Should now show arrived badge
      expect(screen.getByText('arrived')).toBeInTheDocument();
    });
  });
});
