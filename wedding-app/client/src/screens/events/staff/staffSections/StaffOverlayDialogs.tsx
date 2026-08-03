import type { SdkStaffTask } from '../../../../sdk/types';
import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X, Bell, Download, Smartphone, Radio, AlertTriangle, Phone, MessageSquare, Mail, Users, Printer, ClipboardCheck, BarChart3, GitBranch, MapPin } from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { StaffTaskFormDialog } from '../StaffTaskFormDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../ui/Dialog';

export interface StaffOverlayDialogsProps {
  editTask: SdkStaffTask | null;
  setEditTask: React.Dispatch<React.SetStateAction<SdkStaffTask | null>>;
  incidentSeverity: 'low' | 'medium' | 'high' | 'critical';
  setIncidentSeverity: React.Dispatch<React.SetStateAction<'low' | 'medium' | 'high' | 'critical'>>;
  createOpen: any;
  setCreateOpen: React.Dispatch<React.SetStateAction<any>>;
  mapOverlayOpen: any;
  setMapOverlayOpen: React.Dispatch<React.SetStateAction<any>>;
  setupWizardOpen: any;
  setSetupWizardOpen: React.Dispatch<React.SetStateAction<any>>;
  incidentOpen: any;
  setIncidentOpen: React.Dispatch<React.SetStateAction<any>>;
  incidentText: any;
  setIncidentText: React.Dispatch<React.SetStateAction<any>>;
  ownerNotify: any;
  setOwnerNotify: React.Dispatch<React.SetStateAction<any>>;
  applyStaffSetupTemplate: any;
  createIncidentMutation: any;
  activeLayout: any;
  renderMiniMapSvg: () => any;
  eventId: string;
  organizationId: string;
}

export function StaffOverlayDialogs({ editTask, setEditTask, incidentSeverity, setIncidentSeverity, createOpen, setCreateOpen, mapOverlayOpen, setMapOverlayOpen, setupWizardOpen, setSetupWizardOpen, incidentOpen, setIncidentOpen, incidentText, setIncidentText, ownerNotify, setOwnerNotify, applyStaffSetupTemplate, createIncidentMutation, activeLayout, renderMiniMapSvg, eventId, organizationId }: StaffOverlayDialogsProps) {
  return (
    <>
      {/* Quick Floorplan Map Blueprint Overlay Dialog (Phase 1) */}
      {mapOverlayOpen && activeLayout && (
         <Dialog open={mapOverlayOpen} onOpenChange={setMapOverlayOpen}>
            <DialogContent className="max-w-2xl bg-[#FDFBF7] border border-[#e1d5c9] rounded-2xl shadow-xl">
               <DialogHeader>
                  <DialogTitle className="font-serif font-bold text-lg text-fg flex items-center gap-1.5">
                     🗺️ Quick Floorplan Blueprint Map
                  </DialogTitle>
                  <DialogDescription>
                     Scale-accurate vector layout compiled dynamically from the approved layout.
                  </DialogDescription>
               </DialogHeader>

               <div className="p-2 bg-white rounded-xl border border-[#e1d5c9]/50 shadow-inner">
                  {renderMiniMapSvg()}
               </div>

               <DialogFooter className="border-t border-[#e1d5c9] pt-4 mt-2 flex justify-between items-center text-xs text-fg-subtle font-semibold">
                  <div className="flex gap-2">
                     <span className="bg-[#FDFBF7] px-2 py-0.5 rounded border">REV {activeLayout.revision}</span>
                     <span className="bg-[#FDFBF7] px-2 py-0.5 rounded border capitalize">{activeLayout.approval_status}</span>
                  </div>
                  <Button onClick={() => setMapOverlayOpen(false)}>Close Blueprint</Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      )}

      {setupWizardOpen && (
        <Dialog open={setupWizardOpen} onOpenChange={setSetupWizardOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Staff setup wizard</DialogTitle><DialogDescription>Apply role/area templates to quickly prepare the event team.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['captain', 'Day-of captain mode', 'Coordinator huddle and vendor board verification.'],
                ['setup', 'Setup crew template', 'Ceremony and reception setup checklists.'],
                ['parking', 'Parking/arrival template', 'Guest arrival, shuttle, VIP parking, emergency lane.'],
                ['cleanup', 'Cleanup crew template', 'Post-event sweep, rentals, and load-out reset.'],
              ] as const).map(([id, title, desc]) => <button key={id} onClick={() => applyStaffSetupTemplate.mutate(id)} className="rounded-lg border border-border bg-surface-2 p-3 text-left hover:border-brand/40"><div className="text-sm font-bold text-brand">{title}</div><p className="text-xs text-fg-muted mt-1">{desc}</p></button>)}
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setSetupWizardOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {incidentOpen && (
        <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Incident severity workflow</DialogTitle><DialogDescription>Create a blocked task with severity and owner notification rules.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-fg">Severity<select value={incidentSeverity} onChange={(e) => setIncidentSeverity(e.target.value as any)} className="mt-1 w-full rounded-md border border-border bg-surface p-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-xs font-bold"><input type="checkbox" checked={ownerNotify} onChange={(e) => setOwnerNotify(e.target.checked)} /> Notify owner/admin for this incident</label></div>
            <textarea className="min-h-28 w-full rounded-md border border-border bg-surface p-3 text-sm" value={incidentText} onChange={(e) => setIncidentText(e.target.value)} placeholder="Describe what happened, who is involved, and immediate action needed…" />
            <DialogFooter><Button variant="ghost" onClick={() => setIncidentOpen(false)}>Cancel</Button><Button onClick={() => createIncidentMutation.mutate()} disabled={!incidentText.trim() || createIncidentMutation.isPending}>Create incident</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {(createOpen || !!editTask) && (
        <StaffTaskFormDialog
          eventId={eventId}
          organizationId={organizationId}
          open={createOpen || !!editTask}
          onOpenChange={(v) => {
            if (!v) {
              setCreateOpen(false);
              setEditTask(null);
            }
          }}
          task={editTask}
        />
      )}
    </>
  );
}
