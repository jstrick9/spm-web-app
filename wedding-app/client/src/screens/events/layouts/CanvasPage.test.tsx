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

  it('toggles the interactive canvas help guide and show spacing rings checkbox', async () => {
    (layoutsSdk.list as any).mockResolvedValue({
      layouts: [{ id: 'l1', revision: 3, updated_at: new Date().toISOString(), payload: JSON.stringify({ items: [] }), approval_status: 'pending' }]
    });

    render(<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event", guest_count: 150 } as any} />, { wrapper: TestWrapper });

    // Check Spacing Safety Rings checkbox is present
    const ringsCheckbox = screen.getByRole('checkbox', { name: /Spacing Safety Rings/i });
    expect(ringsCheckbox).toBeInTheDocument();
    expect(ringsCheckbox).toBeChecked();

    // Toggle spacing rings
    fireEvent.click(ringsCheckbox);
    expect(ringsCheckbox).not.toBeChecked();

    // Check Help Guide is not visible initially
    expect(screen.queryByText(/📖 Interactive Canvas User Guide/i)).not.toBeInTheDocument();

    // Find Help Guide Button and click
    const helpBtn = screen.getByRole('button', { name: /Help Guide/i });
    fireEvent.click(helpBtn);

    // Verify Help Guide displays
    expect(screen.getByText(/📖 Interactive Canvas User Guide/i)).toBeInTheDocument();
  });

  it('opens the AI Smart Seating Auto-Arranger dialog', async () => {
    (layoutsSdk.list as any).mockResolvedValue({
      layouts: [{ id: 'l1', revision: 3, updated_at: new Date().toISOString(), payload: JSON.stringify({ items: [] }), approval_status: 'pending' }]
    });

    render(<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event", guest_count: 150 } as any} />, { wrapper: TestWrapper });

    // Verify dialog is not open initially
    expect(screen.queryByText(/AI Smart Seating Auto-Arranger/i)).not.toBeInTheDocument();

    // Click AI Smart Seating button
    const smartSeatingBtn = screen.getByRole('button', { name: /AI Smart Seating/i });
    fireEvent.click(smartSeatingBtn);

    // Verify dialog displays
    expect(screen.getByText(/AI Smart Seating Auto-Arranger/i)).toBeInTheDocument();
    expect(screen.getByText(/Seating Affinity Rule/i)).toBeInTheDocument();
  });

  it('allows dropping a sticky note pin onto the canvas', async () => {
    (layoutsSdk.list as any).mockResolvedValue({
      layouts: [{ id: 'l1', revision: 3, updated_at: new Date().toISOString(), payload: JSON.stringify({ items: [] }), approval_status: 'pending' }]
    });

    render(<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event", guest_count: 150 } as any} />, { wrapper: TestWrapper });

    // Click Drop Sticky Note Pin button
    const dropPinBtn = screen.getByRole('button', { name: /Drop Sticky Note Pin/i });
    fireEvent.click(dropPinBtn);

    // Verify Sticky Note properties are displayed in sidebar
    expect(screen.getByText(/Sticky Note Comment/i)).toBeInTheDocument();
    expect(screen.getByText(/Author \/ Signer/i)).toBeInTheDocument();
    expect(screen.getByText(/Note Comment Text/i)).toBeInTheDocument();
  });

  it('supports quick adding pre-cooked vendor zones and placing power outlet pins', async () => {
    (layoutsSdk.list as any).mockResolvedValue({
      layouts: [{ id: 'l1', revision: 3, updated_at: new Date().toISOString(), payload: JSON.stringify({ items: [] }), approval_status: 'pending' }]
    });

    render(<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event", guest_count: 150 } as any} />, { wrapper: TestWrapper });

    // Switch to Vendors tab
    const vendorsBtn = await screen.findByRole('button', { name: /Vendors/i });
    fireEvent.click(vendorsBtn);

    // Verify Quick Vendor Setup Blocks section is visible
    expect(screen.getByText('Quick Vendor Setup Blocks')).toBeInTheDocument();

    // Click "🔨 Catering Zone" quick-add button
    const cateringBtn = screen.getByRole('button', { name: /🔨 Catering Zone/i });
    fireEvent.click(cateringBtn);

    // Switch to Items (Catalog) tab to verify Power Outlet items are present
    const catalogBtn = screen.getByRole('button', { name: /Items/i });
    fireEvent.click(catalogBtn);

    expect(screen.getByText('⚡ 120V Power Outlet')).toBeInTheDocument();
    expect(screen.getByText('🔌 High-Voltage Source')).toBeInTheDocument();
    
    // Click "⚡ 120V Power Outlet" catalog add button
    const addOutletBtn = screen.getByText('⚡ 120V Power Outlet');
    fireEvent.click(addOutletBtn);
  });
});
