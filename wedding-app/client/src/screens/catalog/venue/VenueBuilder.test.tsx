import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VenueBuilder } from './VenueBuilder';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
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

describe('VenueBuilder', () => {
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

  it('renders builder toolbar', async () => {
    render(<VenueBuilder orgId="org-1" />, { wrapper: TestWrapper });
    
    expect(screen.getByRole('button', { name: /Pan \/ Select/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Draw Wall boundaries/i })).toBeInTheDocument();
  });
});
