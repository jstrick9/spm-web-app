import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X, Bell, Download, Smartphone, Radio, AlertTriangle, Phone, MessageSquare, Mail, Users, Printer, ClipboardCheck, BarChart3, GitBranch, MapPin } from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/Card';
import { Badge } from '../../../../ui/Badge';
import { Input } from '../../../../ui/Input';
import { Label } from '../../../../ui/Label';
import { cn } from '../../../../ui/lib/cn';
import { usePrompt } from '../../../../ui/usePrompt';

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'bg-amber-100 text-amber-800 border-amber-200',
  setup: 'bg-blue-100 text-blue-800 border-blue-200',
  cleaning: 'bg-green-100 text-green-800 border-green-200',
  parking: 'bg-purple-100 text-purple-800 border-purple-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

export interface StaffShiftsSchedulerProps {
  newShiftRole: 'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other';
  setNewShiftRole: React.Dispatch<React.SetStateAction<'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other'>>;
  addShiftOpen: any;
  setAddShiftOpen: React.Dispatch<React.SetStateAction<any>>;
  newShiftStaffId: any;
  setNewShiftStaffId: React.Dispatch<React.SetStateAction<any>>;
  newShiftStartsAt: any;
  setNewShiftStartsAt: React.Dispatch<React.SetStateAction<any>>;
  newShiftEndsAt: any;
  setNewShiftEndsAt: React.Dispatch<React.SetStateAction<any>>;
  newShiftNotes: any;
  setNewShiftNotes: React.Dispatch<React.SetStateAction<any>>;
  newShiftContactName: any;
  setNewShiftContactName: React.Dispatch<React.SetStateAction<any>>;
  newShiftContactPhone: any;
  setNewShiftContactPhone: React.Dispatch<React.SetStateAction<any>>;
  newShiftContactEmail: any;
  setNewShiftContactEmail: React.Dispatch<React.SetStateAction<any>>;
  newShiftRadioChannel: any;
  setNewShiftRadioChannel: React.Dispatch<React.SetStateAction<any>>;
  newShiftHandoffNotes: any;
  setNewShiftHandoffNotes: React.Dispatch<React.SetStateAction<any>>;
  newShiftAvailabilityOverrideReason: any;
  setNewShiftAvailabilityOverrideReason: React.Dispatch<React.SetStateAction<any>>;
  meData: any;
  createShiftMutation: any;
  saveShiftMutation?: any;
  editingShiftId?: string | null;
  onEditShift?: (shift: any) => void;
  deleteShiftMutation: any;
  clockInMutation: any;
  clockOutMutation: any;
  shifts: any;
  members: any;
  hasCoordinator: any;
  hasSetup: any;
  hasCleaning: any;
  /** MODULE-05 ST-08: shift scheduling is manager-gated. */
  canManage?: boolean;
}

export function StaffShiftsScheduler({ newShiftRole, setNewShiftRole, addShiftOpen, setAddShiftOpen, newShiftStaffId, setNewShiftStaffId, newShiftStartsAt, setNewShiftStartsAt, newShiftEndsAt, setNewShiftEndsAt, newShiftNotes, setNewShiftNotes, newShiftContactName, setNewShiftContactName, newShiftContactPhone, setNewShiftContactPhone, newShiftContactEmail, setNewShiftContactEmail, newShiftRadioChannel, setNewShiftRadioChannel, newShiftHandoffNotes, setNewShiftHandoffNotes, newShiftAvailabilityOverrideReason, setNewShiftAvailabilityOverrideReason, meData, createShiftMutation, saveShiftMutation, editingShiftId, onEditShift, deleteShiftMutation, clockInMutation, clockOutMutation, shifts, members, hasCoordinator, hasSetup, hasCleaning, canManage = true }: StaffShiftsSchedulerProps) {
  const { ask, askConfirm, promptNode } = usePrompt();
  return (
    <>
      {promptNode}
        <div className="space-y-6 animate-in fade-in duration-200">
           
           {/* Shift Scheduler Title */}
           <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-fg-subtle font-serif">Staff Shifts Grid</h2>
              {canManage ? (
                 <Button onClick={() => setAddShiftOpen(!addShiftOpen)} className="font-bold">
                    <Plus className="w-4 h-4 mr-1" /> {addShiftOpen ? 'Close Scheduler' : 'Schedule Staff Shift'}
                 </Button>
              ) : <span className="text-xs text-fg-muted">Shift scheduling is managed by venue leadership.</span>}
           </div>

           {/* Dynamic Role Coverage Auditor */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-white border-paper-border">
                 <CardContent className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                       <div className="text-[10px] text-fg-subtle uppercase font-bold tracking-wider">Lead Coordinator</div>
                       <div className="text-base font-bold text-fg mt-1">
                          {hasCoordinator ? '🛡️ Coordinator Active' : '⚠️ Unassigned'}
                       </div>
                    </div>
                    <Badge variant={hasCoordinator ? 'success' : 'warning'}>{hasCoordinator ? 'Ready' : 'Missing'}</Badge>
                 </CardContent>
              </Card>

              <Card className="bg-white border-paper-border">
                 <CardContent className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                       <div className="text-[10px] text-fg-subtle uppercase font-bold tracking-wider">Setup Crew</div>
                       <div className="text-base font-bold text-fg mt-1">
                          {hasSetup ? '🔨 Setup Team ready' : '⚠️ Unassigned'}
                       </div>
                    </div>
                    <Badge variant={hasSetup ? 'success' : 'warning'}>{hasSetup ? 'Ready' : 'Missing'}</Badge>
                 </CardContent>
              </Card>

              <Card className="bg-white border-paper-border">
                 <CardContent className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                       <div className="text-[10px] text-fg-subtle uppercase font-bold tracking-wider">Cleaning Crew</div>
                       <div className="text-base font-bold text-fg mt-1">
                          {hasCleaning ? '🧹 Cleanup Team assigned' : '⚠️ Unassigned'}
                       </div>
                    </div>
                    <Badge variant={hasCleaning ? 'success' : 'warning'}>{hasCleaning ? 'Ready' : 'Missing'}</Badge>
                 </CardContent>
              </Card>
           </div>

           {/* Personal Shift Clock-In Panel */}
           {(() => {
              const currentUser = meData?.user;
              const myShifts = currentUser ? shifts.filter((s: any) => s.staff_id === currentUser.id) : [];
              const liveOnSiteCrew = shifts.filter((s: any) => s.clocked_in_at && !s.clocked_out_at);

              return (
                 <>
                    {myShifts.length > 0 && (
                       <Card className="bg-brand-soft/10 border-brand/30 shadow-md">
                          <CardHeader className="pb-2">
                             <CardTitle className="font-serif font-bold text-sm text-brand flex items-center gap-1.5">
                                ⏱️ Your Shift Clock-In &amp; Time Card
                             </CardTitle>
                             <CardDescription className="text-xs">
                                Tactile clock-in terminal for day-of operations.
                             </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                             {myShifts.map((s: any) => {
                                const isClockedIn = s.clocked_in_at && !s.clocked_out_at;
                                const isClockedOut = s.clocked_in_at && s.clocked_out_at;
                                return (
                                   <div key={s.id} className="bg-white p-4 rounded-xl border border-paper-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-semibold text-xs text-fg">
                                      <div>
                                         <div className="flex gap-2 items-center">
                                            <Badge className={cn("py-0.5 px-2 font-bold tracking-tight rounded-full uppercase text-[9px]", ROLE_COLORS[s.role] || ROLE_COLORS.other)}>
                                               {s.role}
                                            </Badge>
                                            {isClockedIn && (
                                               <span className="flex items-center gap-1 text-success text-[10px] uppercase font-extrabold animate-pulse">
                                                  <span className="h-2 w-2 rounded-full bg-success"></span> Active On-Site
                                               </span>
                                            )}
                                            {isClockedOut && (
                                               <span className="text-fg-subtle text-[10px] uppercase font-bold">
                                                  ✅ Shift Completed
                                               </span>
                                            )}
                                         </div>
                                         <p className="text-fg-subtle text-[11px] mt-1.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-brand" /> {new Date(s.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} – {new Date(s.ends_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                         {s.notes && <p className="text-[11px] text-fg-muted font-medium mt-1 italic">"{s.notes}"</p>}
                                         
                                         {s.clocked_in_at && (
                                            <div className="mt-2 space-y-0.5 text-[10px] text-fg-subtle">
                                               <div>In: {new Date(s.clocked_in_at).toLocaleTimeString()}</div>
                                               {s.clocked_out_at && <div>Out: {new Date(s.clocked_out_at).toLocaleTimeString()}</div>}
                                            </div>
                                         )}
                                      </div>

                                      <div className="shrink-0 w-full sm:w-auto">
                                         {!s.clocked_in_at && (
                                            <Button 
                                               onClick={() => clockInMutation.mutate(s.id)}
                                               disabled={clockInMutation.isPending}
                                               className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                                            >
                                               🕒 Clock In Shift
                                            </Button>
                                         )}
                                         {isClockedIn && (
                                            <Button 
                                               onClick={() => clockOutMutation.mutate(s.id)}
                                               disabled={clockOutMutation.isPending}
                                               className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                                            >
                                               🛑 Clock Out Shift
                                            </Button>
                                         )}
                                         {isClockedOut && (
                                            <Badge variant="outline" className="border-success/30 text-success bg-success/10 py-1.5 px-3 font-bold text-xs rounded-xl flex justify-center">
                                               Completed
                                            </Badge>
                                         )}
                                      </div>
                                   </div>
                                );
                             })}
                          </CardContent>
                       </Card>
                    )}

                    {/* Live On-Site Crew Roster */}
                    <Card className="bg-white border-paper-border shadow-sm">
                       <CardHeader className="pb-2 border-b border-paper-border/50 flex flex-row items-center justify-between">
                          <div>
                             <CardTitle className="font-serif font-bold text-sm text-fg flex items-center gap-1.5">
                                👥 On-Site Crew Roster (Live)
                             </CardTitle>
                             <CardDescription className="text-xs">
                                Real-time operations staffing log.
                             </CardDescription>
                          </div>
                          <Badge variant="outline" className="bg-paper text-brand border-paper-border font-black text-xs px-2.5 py-0.5">
                             {liveOnSiteCrew.length} Active Crew On-Site
                          </Badge>
                       </CardHeader>
                       <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {shifts.map((s: any) => {
                                const staffMember = members.find((m: any) => (m.user_id || m.userId) === s.staff_id);
                                const name = staffMember ? (staffMember.fullName || staffMember.email) : 'Assigned Crew Member';
                                const isClockedIn = s.clocked_in_at && !s.clocked_out_at;
                                const isClockedOut = s.clocked_in_at && s.clocked_out_at;
                                
                                return (
                                   <div key={s.id} className={cn(
                                      "p-3 rounded-xl border flex items-center justify-between gap-3 font-semibold text-xs text-fg transition-all",
                                      isClockedIn ? "border-success bg-emerald-50/20 shadow-xs" : "border-paper-border bg-paper/20"
                                   )}>
                                      <div className="flex items-center gap-2.5">
                                         <div className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-serif shadow-xs border",
                                            isClockedIn ? "bg-success/20 text-success border-success/30 animate-pulse" : "bg-surface-2 text-fg-subtle border-paper-border"
                                         )}>
                                            {name.charAt(0).toUpperCase()}
                                         </div>
                                         <div>
                                            <div className="font-serif font-bold text-xs">{name}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                               <Badge className={cn("text-[8px] px-1 py-0 rounded-full font-bold", ROLE_COLORS[s.role] || ROLE_COLORS.other)}>
                                                  {s.role}
                                               </Badge>
                                               <span className="text-[10px] text-fg-subtle">•</span>
                                               <span className="text-[10px] text-fg-muted font-medium">
                                                  {new Date(s.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                               </span>
                                            </div>
                                         </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                         {isClockedIn && (
                                            <span className="flex items-center justify-end gap-1 text-[9px] uppercase font-black text-success animate-pulse">
                                               <span className="h-1.5 w-1.5 rounded-full bg-success"></span> Active
                                            </span>
                                         )}
                                         {isClockedOut && (
                                            <span className="text-[9px] text-fg-subtle font-bold uppercase block">
                                               Completed
                                            </span>
                                         )}
                                         {!s.clocked_in_at && (
                                            <span className="text-[9px] text-fg-muted font-bold uppercase block">
                                               Scheduled
                                            </span>
                                         )}
                                      </div>
                                   </div>
                                );
                             })}
                          </div>
                       </CardContent>
                    </Card>
                 </>
              );
           })()}

           {/* Schedule Shift Form */}
           {addShiftOpen && (
              <div className="bg-white p-5 rounded-2xl border border-paper-border space-y-4 shadow-md font-semibold text-xs text-fg animate-in slide-in-from-top-4">
                 <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif border-b pb-2 flex items-center gap-1.5 text-brand">
                    <Sparkles className="w-4 h-4 text-brand animate-pulse" /> {editingShiftId ? 'Edit Crew Shift Assignment' : 'Create Crew Shift Assignment'}
                 </h4>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                       <Label className="text-[10px] text-fg-subtle">Assigned Staff Member</Label>
                       <select
                         className="h-9 w-full rounded-lg border border-paper-border bg-surface px-2 text-xs mt-1 font-semibold"
                         value={newShiftStaffId}
                         onChange={(e) => setNewShiftStaffId(e.target.value)}
                       >
                          <option value="">Select crew member...</option>
                          {members.map((m: any) => (
                             <option key={m.user_id || m.userId} value={m.user_id || m.userId}>{m.fullName || m.email}</option>
                          ))}
                       </select>
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Role / Division</Label>
                       <select
                         className="h-9 w-full rounded-lg border border-paper-border bg-surface px-2 text-xs mt-1 font-semibold"
                         value={newShiftRole}
                         onChange={(e) => setNewShiftRole(e.target.value as any)}
                       >
                          <option value="coordinator">🛡️ Coordinator</option>
                          <option value="setup">🔨 Setup Crew</option>
                          <option value="cleaning">🧹 Cleaning Crew</option>
                          <option value="parking">🚗 Parking Steward</option>
                          <option value="other">☕ Other / Catering</option>
                       </select>
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Shift Notes</Label>
                       <Input value={newShiftNotes} onChange={e => setNewShiftNotes(e.target.value)} placeholder="Assign to East Lawn..." className="h-9 mt-1 text-xs border-paper-border" />
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Contact Name</Label>
                       <Input value={newShiftContactName} onChange={e => setNewShiftContactName(e.target.value)} placeholder="Radio lead" className="h-9 mt-1 text-xs border-paper-border" />
                    </div>
                    <div>
                       <Label className="text-[10px] text-fg-subtle">Phone / SMS</Label>
                       <Input value={newShiftContactPhone} onChange={e => setNewShiftContactPhone(e.target.value)} placeholder="555-210-1001" className="h-9 mt-1 text-xs border-paper-border" />
                    </div>
                    <div>
                       <Label className="text-[10px] text-fg-subtle">Email</Label>
                       <Input value={newShiftContactEmail} onChange={e => setNewShiftContactEmail(e.target.value)} placeholder="lead@example.com" className="h-9 mt-1 text-xs border-paper-border" />
                    </div>
                    <div>
                       <Label className="text-[10px] text-fg-subtle">Radio Channel</Label>
                       <Input value={newShiftRadioChannel} onChange={e => setNewShiftRadioChannel(e.target.value)} placeholder="Ops 1" className="h-9 mt-1 text-xs border-paper-border" />
                    </div>
                    <div>
                       <Label className="text-[10px] text-fg-subtle">Handoff Notes</Label>
                       <Input value={newShiftHandoffNotes} onChange={e => setNewShiftHandoffNotes(e.target.value)} placeholder="Open blockers / owner notes" className="h-9 mt-1 text-xs border-paper-border" />
                       <Input value={newShiftAvailabilityOverrideReason} onChange={e => setNewShiftAvailabilityOverrideReason(e.target.value)} placeholder="Availability override reason (required if outside hours)" className="h-9 mt-1 text-xs border-paper-border" />
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Shift Starts At</Label>
                       <Input type="datetime-local" value={newShiftStartsAt} onChange={e => setNewShiftStartsAt(e.target.value)} className="h-9 mt-1 text-xs border-paper-border" />
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Shift Ends At</Label>
                       <Input type="datetime-local" value={newShiftEndsAt} onChange={e => setNewShiftEndsAt(e.target.value)} className="h-9 mt-1 text-xs border-paper-border" />
                    </div>
                 </div>

                 <Button 
                    onClick={() => (editingShiftId && saveShiftMutation ? saveShiftMutation.mutate() : createShiftMutation.mutate())} 
                    disabled={!newShiftStaffId || !newShiftStartsAt || !newShiftEndsAt || createShiftMutation.isPending || (saveShiftMutation?.isPending ?? false)}
                    className="w-full font-bold h-10 mt-2"
                 >
                    {editingShiftId ? 'Save Shift Changes' : 'Schedule Shift'}
                 </Button>
              </div>
           )}

           {/* Scheduled Shifts Timeline List */}
           <div className="space-y-3">
              {shifts.length === 0 ? (
                 <div className="text-center p-12 border border-dashed border-paper-border rounded-2xl text-xs text-fg-subtle bg-white font-serif">
                    No active staff shifts scheduled for this event yet.
                 </div>
              ) : (
                 shifts.map((s: any) => {
                    const staffMember = members.find((m: any) => (m.user_id || m.userId) === s.staff_id);
                    return (
                       <Card key={s.id} className="border-paper-border bg-white shadow-xs p-4 flex items-center justify-between gap-4 font-semibold text-xs text-fg">
                          <div className="flex items-center gap-3">
                             <div className="h-10 w-10 bg-brand-soft/20 text-brand rounded-full flex items-center justify-center text-lg shadow-sm border border-brand/10">
                                <UserCheck className="w-5 h-5" />
                             </div>
                             <div>
                                <h4 className="font-serif font-black text-sm text-fg">
                                   {staffMember ? (staffMember.fullName || staffMember.email) : 'Assigned Crew Member'}
                                </h4>
                                <div className="flex gap-2 items-center mt-1 text-fg-subtle text-[10px] uppercase font-bold tracking-wider">
                                   <Badge className={cn("py-0.5 px-2 font-bold tracking-tight rounded-full", ROLE_COLORS[s.role] || ROLE_COLORS.other)}>
                                      {s.role}
                                   </Badge>
                                   <span>•</span>
                                   <span className="flex items-center gap-1 text-fg-muted"><Clock className="w-3 h-3" /> {new Date(s.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} – {new Date(s.ends_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                {s.notes && <p className="text-[11px] text-fg-muted font-medium mt-1 italic">"{s.notes}"</p>}
                                {(s.contact_name || s.contact_phone || s.contact_email || s.radio_channel || s.handoff_notes) && <div className="mt-2 flex flex-wrap gap-1 text-[10px]">{s.radio_channel && <Badge variant="outline">Radio {s.radio_channel}</Badge>}{s.contact_name && <Badge variant="outline">{s.contact_name}</Badge>}{s.contact_phone && <a className="font-bold text-brand underline" href={`tel:${s.contact_phone}`}>Call</a>}{s.contact_phone && <a className="font-bold text-brand underline" href={`sms:${s.contact_phone}`}>SMS</a>}{s.contact_email && <a className="font-bold text-brand underline" href={`mailto:${s.contact_email}`}>Email</a>}{s.handoff_notes && <span className="text-fg-muted">Handoff: {s.handoff_notes}</span>}</div>}
                             </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                             {onEditShift && (
                                <Button
                                   variant="outline"
                                   size="xs"
                                   className="h-8"
                                   onClick={() => onEditShift(s)}
                                   aria-label={`Edit shift for ${staffMember ? (staffMember.fullName || staffMember.email) : 'crew member'}`}
                                >
                                   <Settings2 className="w-3.5 h-3.5 mr-1" /> Edit
                                </Button>
                             )}
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-danger hover:bg-danger/10 shrink-0"
                                onClick={async () => {
                                   if (await askConfirm({ title: 'Delete this staff shift?', destructive: true })) {
                                      deleteShiftMutation.mutate(s.id);
                                   }
                                }}
                             >
                                <Trash2 className="w-4 h-4" />
                             </Button>
                          </div>
                       </Card>
                    );
                 })
              )}
           </div>

        </div>
    </>
  );
}
