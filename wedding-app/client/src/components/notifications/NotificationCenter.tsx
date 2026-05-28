import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, ShieldAlert, MailOpen, CalendarClock, Settings } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { cn } from '../../ui/lib/cn';
import { useRouter } from '../../lib/router';

interface Notification {
  id: string;
  type: 'system' | 'rsvp' | 'vendor' | 'task';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  linkUrl?: string;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { navigate } = useRouter();

  // Simulated Rule-Engine evaluation pulling system alerts
  useEffect(() => {
    // In a real implementation, this would poll an endpoint or use SSE
    setNotifications([
      {
        id: 'n1',
        type: 'rsvp',
        title: 'RSVP Deadline Warning',
        message: 'Smith Wedding is 30 days out and capacity is < 50%.',
        read: false,
        timestamp: new Date().toISOString(),
        linkUrl: '/events/e1'
      },
      {
        id: 'n2',
        type: 'vendor',
        title: 'Vendor COI Missing',
        message: 'DJ Snake has not uploaded their insurance certificate.',
        read: false,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'n3',
        type: 'task',
        title: 'Task Escalation',
        message: 'Setup Archway has been blocked for > 4 hours.',
        read: true,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      }
    ]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    setOpen(false);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'system': return <Settings className="w-4 h-4 text-fg-subtle" />;
      case 'rsvp': return <MailOpen className="w-4 h-4 text-brand" />;
      case 'vendor': return <ShieldAlert className="w-4 h-4 text-warning" />;
      case 'task': return <CalendarClock className="w-4 h-4 text-danger" />;
    }
  };

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative" 
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-fg-muted hover:text-fg transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger animate-pulse" />
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface border border-border shadow-elev-2 rounded-xl z-50 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-top-2">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2/30">
               <h3 className="font-semibold text-fg flex items-center gap-2">
                 Notifications 
                 {unreadCount > 0 && <Badge variant="brand" className="text-[10px]">{unreadCount} New</Badge>}
               </h3>
               <div className="flex gap-2">
                 <Button variant="ghost" size="icon" className="w-7 h-7 text-fg-muted hover:text-fg" onClick={markAllRead} title="Mark all read">
                   <Check className="w-3.5 h-3.5" />
                 </Button>
                 <Button variant="ghost" size="icon" className="w-7 h-7 text-danger hover:bg-danger/10" onClick={clearAll} title="Clear all">
                   <Trash2 className="w-3.5 h-3.5" />
                 </Button>
               </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 bg-surface divide-y divide-border">
               {notifications.length === 0 ? (
                 <div className="p-8 text-center text-fg-muted">
                    <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">You're all caught up!</p>
                 </div>
               ) : (
                 notifications.map(n => (
                   <div 
                     key={n.id} 
                     className={cn(
                       "p-4 hover:bg-surface-2 transition-colors cursor-pointer flex gap-3 relative",
                       !n.read ? "bg-brand-soft/20" : "opacity-70"
                     )}
                     onClick={() => {
                        // Mark read locally
                        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                        if (n.linkUrl) {
                           setOpen(false);
                           navigate(n.linkUrl);
                        }
                     }}
                   >
                     {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand" />}
                     <div className="mt-1 shrink-0 bg-surface border border-border rounded-md p-1.5 shadow-sm">
                       {getIcon(n.type)}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                           <h4 className={cn("text-sm font-medium text-fg truncate", !n.read && "font-bold")}>{n.title}</h4>
                           <span className="text-[10px] text-fg-subtle shrink-0 ml-2">
                             {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                        </div>
                        <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">{n.message}</p>
                     </div>
                   </div>
                 ))
               )}
            </div>
            
            {/* Footer */}
            <div className="p-2 border-t border-border bg-surface-2 text-center">
               <button className="text-[10px] uppercase tracking-wider font-semibold text-fg-subtle hover:text-fg transition-colors" onClick={() => navigate('/system')}>
                 Configure Alert Rules
               </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
