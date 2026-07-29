import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VenueBuilder } from './VenueBuilder';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

vi.mock('../../../sdk/venues', () => ({
  venuesSdk: { list: vi.fn().mockResolvedValue({ venues: [{ id: 'venue-1', name: 'Garden Hall', width: 40, height: 30, capacity: 120, approval_status: 'approved', master_layout: '{}' }] }), create: vi.fn(), update: vi.fn(), delete: vi.fn(), scaffoldVersions: vi.fn().mockResolvedValue({ versions: [] }) }
}));

vi.mock('../../../sdk', () => ({
  sdk: {
    inventory: { list: vi.fn().mockResolvedValue({ items: [{ id: 'chair-1', name: 'Gold chairs' }] }) },
    catalog: {
      list: vi.fn().mockResolvedValue({ 
        items: [
          { id: 'v1', name: 'Venue Structural Walls', spec: JSON.stringify({ type: 'structural', lines: [{ id: 'l1', points: [0, 0, 100, 0, 100, 100, 0, 100, 0, 0] }] }) }
        ] 
      }),
      create: vi.fn(),
      update: vi.fn(),
    }
  }
}));

if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      fillRect() {}, clearRect(){},
      getImageData(x: number, y: number, w: number, h: number) { return { data: new Array(w*h*4) }; },
      putImageData(){}, createImageData(){ return []; },
      setTransform(){}, drawImage(){}, save(){}, fillText(){}, restore(){},
      beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, stroke(){},
      translate(){}, scale(){}, rotate(){}, arc(){}, fill(){},
      measureText(){ return { width: 0 }; }, transform(){}, rect(){}, clip(){},
    };
  };
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('VenueBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the guided template editor with capacity and object controls', async () => {
    const user = userEvent.setup();
    render(<VenueBuilder orgId="org-1" />, { wrapper: makeWrapper() });
    await user.click(await screen.findByText(/Garden Hall · 40×30/i));
    const saveTemplate = screen.getByRole('button', { name: /Save layout as template/i });
    expect(saveTemplate).toBeEnabled();
    await user.click(saveTemplate);
    expect(screen.getByRole('region', { name: /Venue template editor/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum guests')).toHaveValue(120);
    expect(screen.getByText('Gold chairs')).toBeInTheDocument();
  });

  it('renders builder toolbar', async () => {
    render(<VenueBuilder orgId="org-1" />, { wrapper: makeWrapper() });
    
    // The toolbar has "Select" and "Wall" buttons
    expect(screen.getByRole('button', { name: /Select/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wall/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Venue Space Setup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Measure the space/i })).toBeInTheDocument();
  });
});
