import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function BuggyComponent() {
  throw new Error('Test crash');
  return <div>Won't render</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Prevent vitest from failing the test suite due to intended console.error output from React boundary capture
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children if no error', () => {
    render(<ErrorBoundary><div>Safe</div></ErrorBoundary>);
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('catches errors and renders fallback UI', () => {
    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Test crash/i)).toBeInTheDocument();
    
    // Check buttons
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear Session/i })).toBeInTheDocument();
  });

  it('logs errors to localStorage', () => {
    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    const logsStr = localStorage.getItem('wvi_crash_logs');
    expect(logsStr).toBeTruthy();
    
    const logs = JSON.parse(logsStr!);
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Test crash');
  });

  it('allows Try Again recovery', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Rerender with safe component
    rerender(
      <ErrorBoundary>
        <div>Recovered!</div>
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    
    expect(screen.getByText('Recovered!')).toBeInTheDocument();
  });
});
