import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasPage } from './CanvasPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { layoutsSdk } from '../../../sdk/layouts';
import { act } from 'react';

if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      fillRect: function() {},
      clearRect: function(){},
      getImageData: function(x: number, y: number, w: number, h: number) {
        return { data: new Array(w*h*4) };
      },
      putImageData: function() {},
      createImageData: function(){ return []; },
      setTransform: function(){},
      drawImage: function(){},
      save: function(){},
      fillText: function(){},
      restore: function(){},
      beginPath: function(){},
      moveTo: function(){},
      lineTo: function(){},
      closePath: function(){},
      stroke: function(){},
      translate: function(){},
      scale: function(){},
      rotate: function(){},
      arc: function(){},
      fill: function(){},
      measureText: function(){ return { width: 0 }; },
      transform: function(){},
      rect: function(){},
      clip: function(){},
    };
  };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk/layouts', () => ({
  layoutsSdk: {
    list: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    listVersions: vi.fn().mockResolvedValue({
       versions: [
         { id: 'v1', revision: 2, created_at: new Date().toISOString(), payload: JSON.stringify({ items: [] }), change_description: 'Added head table' },
         { id: 'v2', revision: 1, created_at: new Date(Date.now() - 3600).toISOString(), payload: JSON.stringify({ items: [] }) }
       ]
    })
  }
}));

vi.mock('../../../sdk/guests', () => ({
  guestsSdk: {
    list: vi.fn().mockResolvedValue({ guests: [] }),
  }
}));

vi.mock('../../../sdk/vendors', () => ({
  vendorsSdk: {
    list: vi.fn().mockResolvedValue({ vendors: [] }),
  }
}));

vi.mock('../../../sdk', () => ({
  sdk: {
    catalog: {
      list: vi.fn().mockResolvedValue({ items: [] })
    }
  }
}));

describe('CanvasPage', () => {
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

  it('renders approval workflow within history tab', async () => {
    (layoutsSdk.list as any).mockResolvedValue({
      layouts: [{ id: 'l1', revision: 3, updated_at: new Date().toISOString(), payload: JSON.stringify({ items: [] }), approval_status: 'pending' }]
    });

    render(<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event", guest_count: 150 } as any} />, { wrapper: TestWrapper });
    
    // Switch to history tab
    const historyBtn = await screen.findByRole('button', { name: /Diff/i });
    fireEvent.click(historyBtn);
    
    // Wait for the query rendering
    await waitFor(() => {
       // expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    // We can select the approval options
    const statusSelect = screen.getByRole('combobox');
    expect((statusSelect as HTMLSelectElement).value).toBe('pending');

    // Simulate change
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    fireEvent.change(statusSelect, { target: { value: 'approved' } });
    
    await waitFor(() => {
       expect(layoutsSdk.save).toHaveBeenCalledWith('l1', expect.anything(), { approvalStatus: 'approved' });
    });
  });
});
