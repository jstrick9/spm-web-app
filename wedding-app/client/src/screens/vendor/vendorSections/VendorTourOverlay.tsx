import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Truck, 
  ShieldCheck, 
  Mail, 
  FileUp, 
  CheckCircle, 
  Compass, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  QrCode, 
  FileText, 
  UploadCloud, 
  HelpCircle, 
  Check, 
  Map, 
  AlertCircle,
  Sparkles,
  CheckSquare,
  Activity,
  MessageSquare,
  Send
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { cn } from '../../../ui/lib/cn';

export interface VendorTourOverlayProps {
  tourCompleted: any;
  tourStep: any;
  tourSteps: any;
  handleNextTourStep: () => void;
  handlePrevTourStep: () => void;
  handleCompleteTour: () => void;
}

export function VendorTourOverlay({ tourCompleted, tourStep, tourSteps, handleNextTourStep, handlePrevTourStep, handleCompleteTour }: VendorTourOverlayProps) {
  return (
    <>
      {!tourCompleted && (
        <div className="fixed inset-x-0 bottom-6 z-50 px-4 max-w-xl mx-auto animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-fg text-fg-inverse p-5 rounded-2xl shadow-2xl border border-accent/40 space-y-4 relative">
            <button 
              onClick={handleCompleteTour} 
              className="absolute right-3.5 top-3.5 text-fg-inverse/50 hover:text-fg-inverse"
              title="Dismiss Walkthrough"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-widest text-fg-muted">
                <Compass className="w-4 h-4 text-brand animate-spin" style={{ animationDuration: '6s' }} /> 
                Tour Step {tourStep + 1} of {tourSteps.length}
              </div>
              <h3 className="font-serif font-black text-lg text-fg-inverse">{tourSteps[tourStep].title}</h3>
              <p className="text-xs text-fg-muted/90 leading-relaxed font-medium">{tourSteps[tourStep].description}</p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button 
                type="button"
                variant="ghost" 
                size="xs" 
                onClick={handlePrevTourStep} 
                disabled={tourStep === 0}
                className="text-fg-inverse hover:bg-surface/10 disabled:opacity-30 h-8 font-bold"
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" /> Back
              </Button>

              <div className="flex gap-1">
                {tourSteps.map((_: any, idx: any) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      idx === tourStep ? "bg-brand w-3" : "bg-surface/30"
                    )} 
                  />
                ))}
              </div>

              <Button 
                onClick={handleNextTourStep} 
                size="xs"
                className="bg-brand hover:bg-brand-strong text-fg h-8 font-bold"
              >
                {tourStep === tourSteps.length - 1 ? 'Finish Tour' : 'Next'} <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
