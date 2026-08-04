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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { cn } from '../../../ui/lib/cn';

import { VendorLogistics } from '../VendorLogistics';

export interface VendorMainBodyProps {
  newMessageText: any;
  setNewMessageText: React.Dispatch<React.SetStateAction<any>>;
  chatBottomRef: React.RefObject<HTMLDivElement>;
  data: any;
  vendor: any;
  event: any;
  timeline: any;
  messages: any;
  layoutItems: any;
  activePlan: any;
  activeTimelineItemId: any;
  currentBroadcast: any;
  vendorMetadata: any;
  checkedTasks: any;
  sendMessageMutation: any;
  handleSendMessage: any;
  handleToggleTask: any;
  fullChecklist: any[];
  portalCompletionPct: any;
  unreadPlannerMessages: any;
  approvedLayout: any;
  vendorId: string;
  token: string;
}

export function VendorMainBody({ newMessageText, setNewMessageText, chatBottomRef, data, vendor, event, timeline, messages, layoutItems, activePlan, activeTimelineItemId, currentBroadcast, vendorMetadata, checkedTasks, sendMessageMutation, handleSendMessage, handleToggleTask, fullChecklist, portalCompletionPct, unreadPlannerMessages, approvedLayout, vendorId, token }: VendorMainBodyProps) {
  return (
    <>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

         <Card className="border-brand/20 bg-brand-soft/10">
           <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
             <div><div className="text-xs font-bold text-brand">Vendor onboarding checklist</div><div className="text-2xl font-black">{portalCompletionPct}%</div><p className="text-[11px] text-fg-muted">Complete logistics, COI, and checklist items.</p></div>
             <div><div className="text-xs font-bold text-brand">COI status</div><Badge variant={vendorMetadata.coiLink || vendorMetadata.coiReceived ? 'success' : 'danger'}>{vendorMetadata.coiLink || vendorMetadata.coiReceived ? 'Submitted' : 'Missing COI'}</Badge><p className="text-[11px] text-fg-muted mt-1">{vendorMetadata.coiExpiration || vendorMetadata.coiExpirationDate ? `Expires ${vendorMetadata.coiExpiration || vendorMetadata.coiExpirationDate}` : 'Expiration required'}</p></div>
             <div><div className="text-xs font-bold text-brand">Unread messages</div><div className="text-2xl font-black">{unreadPlannerMessages}</div><p className="text-[11px] text-fg-muted">Coordinator messages needing review.</p></div>
             <div><div className="text-xs font-bold text-brand">Load-in route</div><p className="text-xs text-fg-muted">{vendorMetadata.loadInRoute || 'Route planner will appear here when venue assigns it.'}</p></div>
           </CardContent>
         </Card>

         {/* LIVE WEDDING PROGRESS PACE TRACKER (REAL-TIME SYNC) */}
         {event && activeTimelineItemId && (
           <Card className="bg-success-soft/20 border-2 border-success/30 rounded-2xl p-5 flex items-center justify-between shadow-xs animate-pulse">
             <div className="flex gap-3 items-center">
               <div className="relative flex h-3.5 w-3.5 shrink-0">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-success"></span>
               </div>
               <div className="space-y-0.5">
                 <span className="text-[10px] uppercase font-bold tracking-widest text-success block">💍 Real-Time Wedding Progress</span>
                 <p className="font-serif font-black text-brand text-sm sm:text-base">
                   Currently Active Phase: <strong className="text-success">"{timeline.find((i: any) => i.id === activeTimelineItemId)?.title || 'Milestone'}"</strong>
                 </p>
               </div>
             </div>
             <Badge variant="success" className="text-[9px] uppercase font-bold tracking-wider">
               🟢 Live Synchronized
             </Badge>
           </Card>
         )}

         {/* LIVE COORDINATOR EMERGENCY BROADCAST ANNOUNCEMENT BANNER */}
         {event && currentBroadcast && (
           <Card className="border-2 border-danger bg-danger-soft/30 rounded-2xl p-5 flex gap-3.5 items-start animate-bounce">
             <AlertCircle className="w-6 h-6 text-danger shrink-0 mt-0.5" />
             <div className="space-y-1 text-xs sm:text-sm text-danger font-semibold">
               <p className="font-serif font-black text-danger text-sm sm:text-base">🚨 URGENT COORDINATOR BROADCAST</p>
               <p className="opacity-95 leading-relaxed text-xs font-bold text-danger">
                 "{currentBroadcast}"
               </p>
             </div>
           </Card>
         )}

         {/* DYNAMIC PLAN B CONTINGENCY WARNING BANNER */}
         {event && activePlan === 'plan-b' && (
           <Card className="border-2 border-warning bg-warning-soft/30 rounded-2xl p-5 flex gap-3.5 items-start">
             <AlertCircle className="w-6 h-6 text-warning shrink-0 mt-0.5" />
             <div className="space-y-1 text-xs sm:text-sm text-warning font-semibold">
               <p className="font-serif font-black text-warning text-sm sm:text-base">🌧️ Active Weather Plan B Triggered</p>
               <p className="opacity-90 leading-relaxed text-[11px] sm:text-xs">
                 The ceremony and setups have officially transitioned to the Indoor Ballroom. 
                 Please adapt cable-runs, stage positions, and decor layout structures accordingly. Maintain safe pathways around fire-escapes.
               </p>
             </div>
           </Card>
         )}

         {!event ? (
            <Card className="bg-bg border border-border p-8 text-center rounded-2xl shadow-sm">
               <CardContent className="pt-6 text-center text-fg-subtle py-12 space-y-3">
                  <Truck className="w-12 h-12 mx-auto text-brand opacity-40 animate-bounce" />
                  <p className="font-serif font-black text-lg text-brand">No Wedding Schedule Linked</p>
                  <p className="text-sm text-fg-muted max-w-sm mx-auto font-medium">You are registered on venue platform but not currently assigned to an active upcoming layout timeline.</p>
               </CardContent>
            </Card>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               
               {/* LEFT SIDEBAR: COMMITTED VALUE & PHYSICAL PASS */}
               <div className="lg:col-span-4 space-y-6">
                  
                  {/* EVENT DETAILS CARD */}
                  <Card className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <Calendar className="w-4 h-4 text-brand" />
                           Event Details
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4 text-sm pt-4">
                        <div>
                           <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Date</div>
                           <div className="font-bold text-fg text-sm">{event.start_date || 'TBD'}</div>
                        </div>
                        {event.guest_count > 0 && (
                          <div>
                             <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Guest Count</div>
                             <div className="font-bold text-fg text-sm">{event.guest_count} attendees</div>
                          </div>
                        )}
                        <div>
                           <div className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Status</div>
                           <Badge variant="info" className="uppercase tracking-wider text-[9px] font-bold">{event.status}</Badge>
                        </div>
                     </CardContent>
                  </Card>

                  {/* COMMITMENT & FINANCES */}
                  <Card id="commitment-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-brand" />
                           Commitment &amp; Financials
                        </CardTitle>
                        <CardDescription className="text-[10px] text-fg-subtle">
                           Formal ledger entry for this wedding execution.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4 text-sm pt-4">
                        <div>
                           <div className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Contract Category</div>
                           <div className="font-bold text-base capitalize flex items-center gap-1.5 text-fg">
                              <Truck className="w-4 h-4 text-brand" /> {vendor.category || 'General Operations'}
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t pt-3">
                           <div>
                              <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Agreement Cost</div>
                              <div className="font-bold text-base text-fg">
                                 {vendor.contract_amount_cents ? `$${(vendor.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </div>
                           </div>
                           <div>
                              <div className="text-[10px] uppercase font-bold text-fg-subtle mb-0.5">Balance Paid</div>
                              <div className="font-black text-base text-success">
                                 ${(vendor.amount_paid_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                           </div>
                        </div>
                     </CardContent>
                  </Card>

                  <Card className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-3 border-b border-border"><CardTitle className="text-sm font-serif font-black text-brand flex items-center gap-2"><FileText className="w-4 h-4" /> Vendor contract packet & document vault</CardTitle></CardHeader>
                    <CardContent className="pt-4 space-y-2 text-xs">
                      <div><strong>Insurance requirements:</strong> {vendorMetadata.insuranceRequirements || 'Venue requires active COI before load-in.'}</div>
                      {(vendorMetadata.documents || []).length ? (vendorMetadata.documents || []).map((d: any) => <a key={d.id || d.url} href={d.url} target="_blank" rel="noreferrer" className="block text-brand underline">{d.name}</a>) : <p className="text-fg-muted">Contract packet and vendor documents will appear here.</p>}
                    </CardContent>
                  </Card>

                  {/* DIGITAL PASS FOR PORTAL GATE */}
                  <Card id="gatepass-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-border bg-surface-2">
                        <CardTitle className="text-sm font-serif font-black text-brand flex items-center gap-2">
                           <QrCode className="w-4 h-4 text-brand" />
                           Wedding Gate Check-In Pass
                        </CardTitle>
                        <CardDescription className="text-[9px] text-fg-subtle">
                           Quick barcode entry at venue check-in desk.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="p-5 flex flex-col items-center justify-center space-y-4">
                        {/* HIGH FIDELITY SVG REPRESENTATION OF SECURE QR CODE MATRIX */}
                        <div className="bg-surface p-3.5 rounded-xl border border-border shadow-xs hover:scale-105 transition-transform duration-300">
                          <svg viewBox="0 0 100 100" className="w-28 h-28" fill="currentColor">
                            {/* Standard QR squares corners */}
                            <rect x="0" y="0" width="25" height="25" rx="2" />
                            <rect x="4" y="4" width="17" height="17" rx="1" fill="rgb(var(--color-surface))" />
                            <rect x="8" y="8" width="9" height="9" fill="currentColor" />

                            <rect x="75" y="0" width="25" height="25" rx="2" />
                            <rect x="79" y="4" width="17" height="17" rx="1" fill="rgb(var(--color-surface))" />
                            <rect x="83" y="8" width="9" height="9" fill="currentColor" />

                            <rect x="0" y="75" width="25" height="25" rx="2" />
                            <rect x="4" y="79" width="17" height="17" rx="1" fill="rgb(var(--color-surface))" />
                            <rect x="8" y="83" width="9" height="9" fill="currentColor" />

                            {/* Simulated randomized data points */}
                            <rect x="35" y="5" width="5" height="15" />
                            <rect x="45" y="10" width="10" height="5" />
                            <rect x="60" y="5" width="5" height="5" />
                            <rect x="60" y="15" width="10" height="5" />

                            <rect x="5" y="35" width="15" height="5" />
                            <rect x="10" y="45" width="5" height="10" />
                            <rect x="5" y="60" width="5" height="5" />
                            <rect x="15" y="60" width="5" height="10" />

                            <rect x="35" y="35" width="30" height="30" rx="3" fill="currentColor" opacity="0.35" />
                            <rect x="42" y="42" width="16" height="16" rx="1" fill="currentColor" />

                            <rect x="75" y="35" width="5" height="15" />
                            <rect x="85" y="45" width="10" height="5" />
                            <rect x="90" y="35" width="5" height="5" />

                            <rect x="35" y="75" width="15" height="5" />
                            <rect x="45" y="85" width="10" height="10" />
                            <rect x="60" y="80" width="5" height="5" />

                            <rect x="75" y="75" width="10" height="5" />
                            <rect x="85" y="85" width="5" height="5" />
                            <rect x="80" y="90" width="15" height="5" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-serif font-black tracking-wider text-brand block uppercase">PASS: {vendorId.slice(0, 8).toUpperCase()}</span>
                          <span className="text-[10px] text-fg-subtle font-semibold block mt-0.5 max-w-[200px]">Present to Venue Director / Check-In Desk upon loading arrival.</span>
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* RIGHT AREA: BLUEPRINT MAP, CHAT, LOGISTICS, CHECKLIST, TIMELINE */}
               <div className="lg:col-span-8 space-y-6">
                  
                  {/* REAL-TIME SPATIAL BLUEPRINT MAP */}
                  <Card id="blueprint-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <Map className="w-4 h-4 text-brand" />
                           Real-Time Floorplan Map Blueprint
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Approved physical layout structure, table arrangements, and setup spacing grids.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-4">
                        {approvedLayout ? (
                           <div className="space-y-4">
                              <div className="flex justify-between items-center text-xs font-semibold bg-surface p-2.5 rounded-lg border border-border">
                                 <div>
                                    Layout: <strong className="text-brand">{approvedLayout.name}</strong> 
                                    <span className="text-fg-subtle ml-1">(v{approvedLayout.revision})</span>
                                 </div>
                                 <Badge variant="success" className="text-[9px] uppercase tracking-wider">
                                    {approvedLayout.approval_status}
                                 </Badge>
                              </div>

                              {/* Interactive SVG Renderer */}
                              <div className="relative border border-border rounded-xl overflow-hidden bg-surface">
                                 {layoutItems.length === 0 ? (
                                    <div className="text-center py-12 text-fg-subtle">No physical elements placed in layout.</div>
                                 ) : (
                                    <svg viewBox="0 0 800 600" className="w-full h-auto bg-bg" aria-label="Floorplan Layout SVG Blueprint Map">
                                       <defs>
                                          <pattern id="dotGridPortal" width="20" height="20" patternUnits="userSpaceOnUse">
                                             <circle cx="2" cy="2" r="1" fill="currentColor" opacity="0.35" />
                                          </pattern>
                                       </defs>
                                       <rect width="100%" height="100%" fill="url(#dotGridPortal)" />

                                       {layoutItems.map((item: any) => {
                                          if (item.type === 'round_table') {
                                             return (
                                                <g key={item.id}>
                                                   <circle cx={item.x} cy={item.y} r={item.radius || 30} fill="rgb(var(--color-surface))" stroke="rgb(var(--color-border-strong))" strokeWidth="1.5" />
                                                   <text x={item.x} y={item.y + 3} fontFamily="Georgia, serif" fontSize="9" textAnchor="middle" fill="rgb(var(--color-fg))" fontWeight="bold">{item.label || 'Round'}</text>
                                                </g>
                                             );
                                          }
                                          if (item.type === 'rect_table' || item.type === 'dance_floor') {
                                             const w = item.width || 120;
                                             const h = item.height || 40;
                                             const fill = item.type === 'dance_floor' ? 'rgb(var(--color-surface-2))' : 'rgb(var(--color-surface))';
                                             const stroke = item.type === 'dance_floor' ? 'rgb(var(--color-border))' : 'rgb(var(--color-border-strong))';
                                             return (
                                                <g key={item.id} transform={`rotate(${item.rotation || 0} ${item.x} ${item.y})`}>
                                                   <rect x={item.x - w/2} y={item.y - h/2} width={w} height={h} rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
                                                   <text x={item.x} y={item.y + 3} fontFamily="Georgia, serif" fontSize="9" textAnchor="middle" fill="rgb(var(--color-fg))" fontWeight="bold">{item.label || 'Rect'}</text>
                                                </g>
                                             );
                                          }
                                          if (item.type === 'custom_wall') {
                                             if (item.points && item.points.length >= 4) {
                                                const path = `M ${item.points[0]} ${item.points[1]} ` + item.points.slice(2).reduce((acc: string, val: number, idx: number) => {
                                                   return acc + (idx % 2 === 0 ? `L ${val} ` : `${val} `);
                                                }, '');
                                                return (
                                                   <path key={item.id} d={path} fill="none" stroke={item.color || 'rgb(var(--color-fg))'} strokeWidth={item.strokeWidth || 4} strokeLinecap="round" strokeLinejoin="round" />
                                                );
                                             }
                                          }
                                          if (item.type === 'chair') {
                                             return (
                                                <circle key={item.id} cx={item.x} cy={item.y} r={item.radius || 6} fill="rgb(var(--color-surface))" stroke="rgb(var(--color-border-strong))" strokeWidth="1" />
                                             );
                                          }
                                          return null;
                                       })}
                                    </svg>
                                 )}
                              </div>
                           </div>
                        ) : (
                           <div className="text-center py-12 text-fg-subtle bg-surface rounded-xl border border-dashed p-6">
                              <Map className="w-10 h-10 mx-auto text-brand/30 mb-2" />
                              <p className="font-serif font-black text-brand">No Approved Layout Map</p>
                              <p className="text-xs font-semibold max-w-xs mx-auto mt-1">The spatial seating plan has not been fully finalized yet. Please check back soon.</p>
                           </div>
                        )}
                     </CardContent>
                  </Card>

                  {/* DIRECT COLLABORATIVE COORDINATOR LIVE CHAT CARD */}
                  <Card id="chat-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <MessageSquare className="w-4 h-4 text-brand" /> Direct Coordinator Live Chat
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Secure, direct link to the venue coordination crew and venue directors.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-6 space-y-4">
                        
                        {/* Conversation feed */}
                        <div className="border border-border rounded-xl p-4 bg-surface h-64 overflow-y-auto space-y-3 flex flex-col">
                           {messages.length === 0 ? (
                              <div className="text-center my-auto text-xs text-fg-subtle font-semibold py-8 space-y-2">
                                 <MessageSquare className="w-8 h-8 text-brand/30 mx-auto mb-1 animate-bounce" />
                                 <p>No chat history in thread yet.</p>
                                 <p className="text-[10px] leading-tight max-w-[240px] mx-auto">Type a message below to coordinate load-in points or AV circuit loads on site.</p>
                              </div>
                           ) : (
                              messages.map((msg: any) => {
                                 const isSelf = msg.sender_role === 'vendor' || msg.sender_id === vendor.id;
                                 return (
                                    <div 
                                       key={msg.id}
                                       className={cn(
                                          "max-w-[80%] rounded-2xl p-3 text-xs font-medium space-y-1 relative shadow-xs",
                                          isSelf 
                                             ? "bg-fg text-fg-inverse self-end rounded-tr-none" 
                                             : "bg-surface-2 text-fg border border-border self-start rounded-tl-none"
                                       )}
                                    >
                                       {!isSelf && (
                                          <div className="text-[9px] uppercase font-bold text-brand tracking-wider mb-0.5">
                                             {msg.sender_role.replace('_', ' ')}
                                          </div>
                                       )}
                                       <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                       <span className={cn(
                                          "text-[8px] font-semibold block text-right mt-1 opacity-60",
                                          isSelf ? "text-brand-soft" : "text-fg-subtle"
                                       )}>
                                          {new Date(msg.created_at).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                                       </span>
                                    </div>
                                 );
                              })
                           )}
                           <div ref={chatBottomRef} />
                        </div>

                        {/* Send message form */}
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                           <Input 
                              placeholder="Type message to venue crew..." 
                              value={newMessageText}
                              onChange={(e) => setNewMessageText(e.target.value)}
                              className="text-xs h-9 border-border bg-surface flex-1"
                              required
                           />
                           <Button 
                              type="submit" 
                              size="xs" 
                              disabled={sendMessageMutation.isPending || !newMessageText.trim()}
                              className="h-9 px-4 font-bold bg-fg hover:bg-fg-muted text-fg-inverse flex items-center gap-1 shrink-0"
                           >
                              <Send className="w-3.5 h-3.5" /> Send
                           </Button>
                        </form>

                     </CardContent>
                  </Card>

                  {/* INTERACTIVE CATEGORY-SPECIFIC CHECKLIST CARD */}
                  <Card id="vendor-checklist-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-3 border-b border-border">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <CheckSquare className="w-4 h-4 text-brand" />
                           Your Setup &amp; Execution Checklist
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Keep your crew organized. Tap tasks as you complete them to sync with on-site planners.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-6">
                        <div className="space-y-2.5">
                           {fullChecklist.map((task) => {
                              const isChecked = !!checkedTasks[task.id];
                              return (
                                 <div 
                                    key={task.id}
                                    onClick={() => handleToggleTask(task.id)}
                                    className={cn(
                                       "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-surface",
                                       isChecked 
                                          ? "border-success/30 bg-success-soft/20" 
                                          : "border-border hover:border-brand"
                                    )}
                                 >
                                    <div className={cn(
                                       "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                       isChecked 
                                          ? "border-success bg-success text-fg-inverse" 
                                          : "border-border-strong"
                                    )}>
                                       {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                    <span className={cn(
                                       "text-sm font-semibold transition-colors",
                                       isChecked ? "text-fg-subtle line-through" : "text-fg-muted"
                                    )}>
                                       {task.label}
                                    </span>
                                 </div>
                              );
                           })}
                        </div>
                     </CardContent>
                  </Card>

                  {/* VENDOR LOGISTICS CARD */}
                  <VendorLogistics 
                     vendorId={vendorId}
                     token={token}
                     initialResponses={(() => {
                        try {
                           const meta = typeof vendor.metadata === 'string' ? JSON.parse(vendor.metadata || '{}') : vendor.metadata;
                           // Questionnaire fields + COI verification state (the
                           // venue's review decision is visible to the vendor).
                           return { ...(meta?.questionnaire || {}), coiVerificationStatus: meta?.coiVerificationStatus ?? null, coiReviewNote: meta?.coiReviewNote ?? null };
                        } catch {
                           return null;
                        }
                     })()} 
                  />

                  {/* RUN OF SHOW TIMELINE */}
                  <Card id="timeline-card" className="bg-bg border border-border shadow-sm rounded-2xl overflow-hidden">
                     <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                           <Clock className="w-4 h-4 text-brand" />
                           Wedding Timeline &amp; Milestones (Run of Show)
                        </CardTitle>
                        <CardDescription className="text-xs text-fg-subtle">
                           Real-time schedule of setups, grand entrance, meals, and teardown.
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="p-0 bg-surface">
                        {timeline.length === 0 ? (
                           <div className="text-center text-fg-muted py-12 px-4 italic text-sm">
                              The official schedule for this event is currently being compiled by the coordination team.
                           </div>
                        ) : (
                           <div className="divide-y divide-border">
                              {timeline.map((item: any) => {
                                 const time = item.time || (item.starts_at ? new Date(item.starts_at).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'}) : 'TBD');
                                 const isActive = item.id === activeTimelineItemId;
                                 return (
                                    <div 
                                       key={item.id} 
                                       className={cn(
                                          "p-4 sm:p-5 flex gap-4 transition-colors",
                                          isActive ? "bg-success-soft/20 border-l-4 border-l-success pl-4" : "hover:bg-surface-2"
                                       )}
                                    >
                                       <div className="w-20 sm:w-24 shrink-0 pt-0.5">
                                          <span className={cn(
                                             "text-xs font-bold px-2 py-0.5 rounded-md",
                                             isActive ? "bg-success text-fg-inverse" : "bg-brand-soft/20 text-brand"
                                          )}>
                                             {time}
                                          </span>
                                       </div>
                                       <div className="flex-1 space-y-1 min-w-0">
                                          <h4 className="text-sm font-bold text-fg flex items-center gap-2">
                                             {item.title}
                                             {isActive && (
                                                <Badge variant="success" className="text-[8px] uppercase tracking-wider font-bold animate-pulse">
                                                   ● CURRENT ACTIVE
                                                </Badge>
                                             )}
                                          </h4>
                                          {item.description && <p className="text-xs text-fg-subtle font-semibold">{item.description}</p>}
                                          {item.duration_mins && (
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider">{item.duration_mins} min duration</Badge>
                                          )}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        )}
                     </CardContent>
                  </Card>
               </div>
            </div>
         )}
      </main>
    </>
  );
}
