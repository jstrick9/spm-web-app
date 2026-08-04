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
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';

export interface VendorHeaderProps {
  setTourCompleted: React.Dispatch<React.SetStateAction<any>>;
  setTourStep: React.Dispatch<React.SetStateAction<any>>;
  vendor: any;
  event: any;
  venueName: any;
}

export function VendorHeader({ setTourCompleted, setTourStep, vendor, event, venueName }: VendorHeaderProps) {
  return (
    <>
      <header className="bg-bg border-b border-border py-5 px-6 sticky top-0 z-40 shadow-xs">
         <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div id="header-brand" className="space-y-1">
               <span className="text-[10px] uppercase font-bold tracking-widest text-brand block">{venueName} Vendor Operations</span>
               <h1 className="text-2xl font-serif font-black text-brand tracking-tight">Vendor Portal</h1>
               <p className="text-sm text-fg-muted">Prepared for {vendor.name}</p>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              {event && (
                 <Badge variant="brand" className="font-serif text-xs font-bold py-1 px-3 border border-border">
                   {event.title}
                 </Badge>
              )}
              <Button 
                variant="outline" 
                size="xs" 
                className="h-8 text-xs font-bold text-brand border-border hover:bg-surface-2"
                onClick={() => {
                  setTourCompleted(false);
                  setTourStep(0);
                }}
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1" /> Help Guide
              </Button>
            </div>
         </div>
      </header>
    </>
  );
}
