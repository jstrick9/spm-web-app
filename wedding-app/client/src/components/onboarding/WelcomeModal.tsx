import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { ChevronRight, ChevronLeft, Map, Users, Settings, Truck, MessageSquare, Star, Check } from 'lucide-react';
import { cn } from '../../ui/lib/cn';
import type { SdkMembership } from '../../sdk/types';

interface Props {
  memberships: SdkMembership[];
  onComplete: () => void;
}

export function WelcomeModal({ memberships, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  // Check if we should show this
  useEffect(() => {
    const hasSeen = localStorage.getItem('wvi_welcome_seen');
    if (!hasSeen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    if (dontShow) {
      localStorage.setItem('wvi_welcome_seen', 'true');
    }
    setOpen(false);
    onComplete();
  };

  // Determine user role to filter slides
  // We look for the most powerful role they have
  let highestRole = 'guest';
  const roleKeys = memberships.map(m => m.roleKey);
  if (roleKeys.includes('owner')) highestRole = 'owner';
  else if (roleKeys.includes('admin')) highestRole = 'admin';
  else if (roleKeys.includes('planner')) highestRole = 'planner';
  else if (roleKeys.includes('vendor')) highestRole = 'vendor';
  else if (roleKeys.includes('staff')) highestRole = 'staff';

  const allSlides = [
    {
      id: 'welcome',
      roles: ['owner', 'admin', 'planner', 'vendor', 'staff', 'guest'],
      title: 'Welcome to the WVI Platform',
      description: 'Your intelligent wedding venue operating system. Let\'s take a quick tour of what you can do.',
      icon: <Star className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'canvas',
      roles: ['owner', 'admin', 'planner'],
      title: 'Interactive Floor Plans',
      description: 'Design your event layouts using our drag-and-drop WebGL canvas. Place tables, map structural venue bounds, and drop guests right into their seats.',
      icon: <Map className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'guests',
      roles: ['owner', 'admin', 'planner'],
      title: 'Guest CRM & Imports',
      description: 'Import your guest lists via CSV, manage dietary restrictions, and track RSVPs all in one place.',
      icon: <Users className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'vendors',
      roles: ['owner', 'admin', 'planner'],
      title: 'Vendor Management',
      description: 'Track contracts, manage digital signatures, and view logistical timelines to prevent day-of overlapping schedules.',
      icon: <Truck className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'vendor_portal',
      roles: ['vendor'],
      title: 'Your Vendor Portal',
      description: 'Welcome to your dedicated dashboard. Here you can review your load-in times, submit your COI documents, and view your specific run-of-show.',
      icon: <Truck className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'chat',
      roles: ['owner', 'admin', 'planner', 'vendor'],
      title: 'Communications Hub',
      description: 'Chat directly with vendors, coordinate logistics in threaded channels, or send mass broadcast announcements.',
      icon: <MessageSquare className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'staff',
      roles: ['staff'],
      title: 'Staff Operations',
      description: 'Check your assigned tasks, review phase timelines (Pre/During/Post event), and mark off checklists as you complete them.',
      icon: <Check className="w-16 h-16 text-brand mx-auto mb-6" />
    },
    {
      id: 'settings',
      roles: ['owner', 'admin'],
      title: 'Platform Config',
      description: 'Customize the entire application! Head to the Platform Studio to change colors, define your inventory catalog, and manage roles.',
      icon: <Settings className="w-16 h-16 text-brand mx-auto mb-6" />
    }
  ];

  // Filter slides based on the user's highest role
  const slides = allSlides.filter(s => s.roles.includes(highestRole));

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && slide < slides.length - 1) setSlide(s => s + 1);
      if (e.key === 'ArrowLeft' && slide > 0) setSlide(s => s - 1);
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, slide, slides.length]);

  if (!open || slides.length === 0) return null;

  const currentSlide = slides[slide];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden bg-surface border-none shadow-2xl"
        aria-label="Welcome tour"
      >
        <div className="relative">
           {/* Progress Bar */}
           <div className="absolute top-0 left-0 w-full h-1 bg-surface-2">
              <div 
                className="h-full bg-brand transition-all duration-300 ease-in-out" 
                style={{ width: `${((slide + 1) / slides.length) * 100}%` }} 
              />
           </div>

           <div className="p-10 text-center min-h-[340px] flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300" key={currentSlide.id}>
              {currentSlide.icon}
              <DialogTitle className="text-2xl font-display font-semibold mb-3">{currentSlide.title}</DialogTitle>
              <DialogDescription className="text-fg-muted leading-relaxed">{currentSlide.description}</DialogDescription>
           </div>

           <div className="bg-surface-2/50 border-t border-border p-4 flex items-center justify-between">
              
              <div className="flex items-center gap-2">
                 <input 
                   type="checkbox" 
                   id="dontShow" 
                   checked={dontShow}
                   onChange={e => setDontShow(e.target.checked)}
                   className="rounded border-border text-brand focus:ring-brand"
                 />
                 <label htmlFor="dontShow" className="text-xs text-fg-subtle cursor-pointer select-none">
                    Don't show this again
                 </label>
              </div>

              <div className="flex items-center gap-3">
                 <div className="flex gap-1.5 mr-2">
                    {slides.map((_, i) => (
                      <button 
                         key={i}
                         type="button"
                         onClick={() => setSlide(i)}
                         aria-label={`Go to slide ${i + 1} of ${slides.length}`}
                         aria-current={i === slide ? 'step' : undefined}
                         className={cn("w-2 h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", i === slide ? "bg-brand w-4" : "bg-border hover:bg-brand/50")}
                      />
                    ))}
                 </div>
                 
                 <Button variant="outline" size="icon" aria-label="Previous slide" onClick={() => setSlide(s => s - 1)} disabled={slide === 0}>
                   <ChevronLeft className="w-4 h-4" />
                 </Button>
                 
                 {slide === slides.length - 1 ? (
                   <Button onClick={handleClose}>Get Started</Button>
                 ) : (
                   <Button onClick={() => setSlide(s => s + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                 )}
              </div>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
