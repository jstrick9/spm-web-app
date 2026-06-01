/**
 * NotFoundPage — shown when a route doesn't match anything.
 */
import { MapPin, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { PageBody } from '../ui/AppShell';

export function NotFoundPage() {
  return (
    <PageBody>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-6">
          <MapPin className="h-8 w-8 text-fg-subtle" />
        </div>
        <h1 className="text-3xl font-display font-bold text-fg mb-2">Page Not Found</h1>
        <p className="text-fg-muted max-w-md mb-8">
          The page you're looking for doesn't exist or has been moved. 
          Check the URL or head back to the dashboard.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
          </Button>
          <a href="#/">
            <Button>
              <Home className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </a>
        </div>
      </div>
    </PageBody>
  );
}
