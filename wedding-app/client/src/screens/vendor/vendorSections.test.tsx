import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={queryClient}><ToastProvider>{node}</ToastProvider></QueryClientProvider>
);
import { VendorTourOverlay } from './vendorSections/VendorTourOverlay';
import { VendorHeader } from './vendorSections/VendorHeader';
import { VendorMainBody } from './vendorSections/VendorMainBody';

/**
 * Direct component tests for the extracted VendorPortal sections.
 * Each section renders standalone with props (the container owns all state).
 */

const noop = () => {};
const setState = (v: any) => { void v; };

const TOUR_STEPS = [
  { title: 'Welcome to Oak Manor!', description: 'Your dedicated portal for your upcoming wedding assignment.', targetId: 'header-brand' },
  { title: 'Your Financial Summary', description: 'Review contract amount and balance paid.', targetId: 'commitment-card' },
  { title: 'Timeline & Logistics', description: 'Submit arrival timing and upload COI.', targetId: 'timeline-card' },
];

function tourProps(over: Partial<Parameters<typeof VendorTourOverlay>[0]> = {}) {
  return {
    tourCompleted: false,
    tourStep: 0,
    tourSteps: TOUR_STEPS,
    handleNextTourStep: noop,
    handlePrevTourStep: noop,
    handleCompleteTour: noop,
    ...over,
  };
}

function headerProps(over: Partial<Parameters<typeof VendorHeader>[0]> = {}) {
  return {
    setTourCompleted: setState as any,
    setTourStep: setState as any,
    vendor: { id: 'v1', name: 'DJ Dave', category: 'dj' } as any,
    event: { id: 'e1', title: 'Smith & Jones Wedding' } as any,
    venueName: 'Oak Manor',
    ...over,
  };
}

function mainBodyProps(over: Partial<Parameters<typeof VendorMainBody>[0]> = {}) {
  return {
    newMessageText: '',
    setNewMessageText: setState as any,
    chatBottomRef: { current: null } as any,
    data: null as any,
    vendor: { id: 'v1', name: 'DJ Dave', category: 'dj' } as any,
    event: { id: 'e1', title: 'Smith & Jones Wedding' } as any,
    timeline: [] as any,
    messages: [] as any,
    layoutItems: [] as any,
    activePlan: null as any,
    activeTimelineItemId: null as any,
    currentBroadcast: null as any,
    vendorMetadata: {} as any,
    checkedTasks: [] as any,
    sendMessageMutation: { isPending: false, mutate: noop } as any,
    handleSendMessage: noop as any,
    handleToggleTask: noop as any,
    fullChecklist: [] as any,
    portalCompletionPct: 50,
    unreadPlannerMessages: 0,
    approvedLayout: null as any,
    vendorId: 'v1',
    token: 'tok',
    ...over,
  };
}

// ── VendorTourOverlay ─────────────────────────────────────
describe('VendorTourOverlay', () => {
  it('renders the current tour step with progress dots', () => {
    render(<VendorTourOverlay {...tourProps()} />);
    expect(screen.getByText('Welcome to Oak Manor!')).toBeInTheDocument();
    expect(screen.getByText(/tour step 1 of 3/i)).toBeInTheDocument();
  });

  it('hides entirely when the tour is completed', () => {
    render(<VendorTourOverlay {...tourProps({ tourCompleted: true })} />);
    expect(screen.queryByText(/tour step/i)).not.toBeInTheDocument();
  });

  it('wires back/next/finish handlers', async () => {
    const user = userEvent.setup();
    const handleNextTourStep = vi.fn();
    const handlePrevTourStep = vi.fn();
    const handleCompleteTour = vi.fn();
    render(<VendorTourOverlay {...tourProps({
      tourStep: 1,
      handleNextTourStep, handlePrevTourStep, handleCompleteTour,
    })} />);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(handlePrevTourStep).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(handleNextTourStep).toHaveBeenCalledTimes(1);
  });

  it('shows Finish Tour on the last step (wired to next-step handler)', async () => {
    const user = userEvent.setup();
    const handleNextTourStep = vi.fn();
    render(<VendorTourOverlay {...tourProps({
      tourStep: 2, handleNextTourStep,
    })} />);
    await user.click(screen.getByRole('button', { name: /finish tour/i }));
    expect(handleNextTourStep).toHaveBeenCalled();
  });

  it('fires handleCompleteTour from the dismiss button', async () => {
    const user = userEvent.setup();
    const handleCompleteTour = vi.fn();
    render(<VendorTourOverlay {...tourProps({ handleCompleteTour })} />);
    await user.click(screen.getByTitle('Dismiss Walkthrough'));
    expect(handleCompleteTour).toHaveBeenCalled();
  });
});

// ── VendorHeader ──────────────────────────────────────────
describe('VendorHeader', () => {
  it('renders the venue name, portal title, and event title', () => {
    render(<VendorHeader {...headerProps()} />);
    expect(screen.getByText(/oak manor vendor operations/i)).toBeInTheDocument();
    expect(screen.getByText('Vendor Portal')).toBeInTheDocument();
    expect(screen.getByText(/smith & jones wedding/i)).toBeInTheDocument();
  });

  it('shows the vendor name from vendor metadata', () => {
    render(<VendorHeader {...headerProps()} />);
    expect(screen.getByText(/DJ Dave/i)).toBeInTheDocument();
  });
});

// ── VendorMainBody ────────────────────────────────────────
describe('VendorMainBody', () => {
  it('renders the onboarding checklist with completion percentage', () => {
    render(wrap(<VendorMainBody {...mainBodyProps({ portalCompletionPct: 50 })} />));
    expect(screen.getByText(/vendor onboarding checklist/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders the commitment & financials card', () => {
    render(wrap(<VendorMainBody {...mainBodyProps({
      vendorMetadata: { contract_amount_cents: 250000, paid_amount_cents: 100000 } as any,
    })} />));
    expect(screen.getByText(/commitment & financials/i)).toBeInTheDocument();
  });

  it('shows the checklist card when fullChecklist is provided', () => {
    render(wrap(<VendorMainBody {...mainBodyProps({
      fullChecklist: [{ id: 'c1', label: 'Upload COI', checked: false }, { id: 'c2', label: 'Confirm arrival', checked: true }] as any,
    })} />));
    expect(screen.getByText(/your setup & execution checklist/i)).toBeInTheDocument();
  });
});
