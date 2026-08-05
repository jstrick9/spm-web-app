import React, { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, LogOut, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.logErrorToStorage(error, errorInfo);
  }

  private logErrorToStorage(error: Error, errorInfo: ErrorInfo) {
    try {
      const logsRaw = localStorage.getItem('wvi_crash_logs');
      let logs = [];
      if (logsRaw) {
        logs = JSON.parse(logsRaw);
      }
      
      logs.push({
        timestamp: new Date().toISOString(),
        error: error.toString(),
        stack: errorInfo.componentStack,
        message: error.message
      });

      // Keep only last 10 logs
      if (logs.length > 10) {
        logs = logs.slice(logs.length - 10);
      }

      localStorage.setItem('wvi_crash_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to log error to storage', e);
    }
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearSession = () => {
    // The real auth token key is 'wedding-jwt' (sdk/client.ts TOKEN_KEY);
    // 'wvi_auth_token' was a legacy key that never held the JWT.
    localStorage.removeItem('wedding-jwt');
    localStorage.removeItem('wvi_auth_token');
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface border border-border rounded-xl shadow-elev-2 p-6 md:p-8">
            <div className="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-6">
               <AlertOctagon className="w-6 h-6" />
            </div>
            
            <h1 className="text-xl font-display font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-fg-muted mb-6">
               The application encountered an unexpected error. Your unsaved data may be lost, but your event records are safe.
            </p>

            <div className="bg-surface-2 p-3 rounded-md text-xs font-mono text-danger mb-6 overflow-auto max-h-32 border border-danger/20">
               {this.state.error && this.state.error.toString()}
            </div>

            <div className="space-y-3">
               <Button onClick={this.handleTryAgain} className="w-full justify-center">
                 <RotateCcw className="w-4 h-4 mr-2" /> Try Again
               </Button>
               <Button variant="outline" onClick={this.handleReload} className="w-full justify-center">
                 <RefreshCw className="w-4 h-4 mr-2" /> Reload Page
               </Button>
               <Button variant="secondary" onClick={this.handleClearSession} className="w-full justify-center text-danger hover:text-danger hover:bg-danger/10">
                 <LogOut className="w-4 h-4 mr-2" /> Clear Session & Restart
               </Button>
            </div>
            
            <p className="text-[10px] text-fg-subtle text-center mt-6">
              Crash logs have been saved locally for diagnostics.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
