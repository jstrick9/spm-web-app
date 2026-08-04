

import { StaffTopCards } from './staffSections/StaffTopCards';
import { StaffSubTabs } from './staffSections/StaffSubTabs';
import { StaffTasksKanban } from './staffSections/StaffTasksKanban';
import { StaffShiftsScheduler } from './staffSections/StaffShiftsScheduler';
import { StaffOverlayDialogs } from './staffSections/StaffOverlayDialogs';

import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X, Bell, Download, Smartphone, Radio, AlertTriangle, Phone, MessageSquare, Mail, Users, Printer, ClipboardCheck, BarChart3, GitBranch, MapPin } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkStaffTask } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { cn } from '../../../ui/lib/cn';
import { StaffTaskFormDialog } from './StaffTaskFormDialog';
import { useToast } from '../../../ui/Toast';
import { usePermission } from '../../../lib/usePermission';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../ui/Dialog';
import { VenueManagerStaffingCommandCenter, CrewContactCard, StaffMiniMetric } from './staffPanels';
interface Props {
  eventId: string;
  organizationId: string;
}


export function EventStaffTab({ eventId, organizationId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // MODULE-05 ST-17: permission-based gating (was a raw roleKey allow-list).
  // Declared with the other hooks — before any early return — to keep the
  // hook order stable across renders.
  const canManageStaff = usePermission('staff.manage');
  
  // Navigation tabs: 'tasks' | 'scheduler'
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'scheduler'>('tasks');

  // Tasks Filter States (Phase 5 Refinements)
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<SdkStaffTask | null>(null);
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [captainMode, setCaptainMode] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentText, setIncidentText] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [ownerNotify, setOwnerNotify] = useState(true);

  // Swipe-to-Complete Gesture States and Refs for real-time synchronous tracking
  const [swipingTaskId, setSwipingTaskId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [blockNextClick, setBlockNextClick] = useState<boolean>(false);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const swipeOffsetRef = useRef(0);
  const swipingTaskIdRef = useRef<string | null>(null);

  const handleTouchStart = (e: React.TouchEvent, task: SdkStaffTask) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    swipingTaskIdRef.current = task.id;
    isSwipingRef.current = false;
    swipeOffsetRef.current = 0;

    setSwipingTaskId(task.id);
    setIsSwiping(false);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingTaskIdRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (!isSwipingRef.current) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
        isSwipingRef.current = true;
        setIsSwiping(true);
      }
    }

    if (isSwipingRef.current) {
      if (e.cancelable) {
        e.preventDefault();
      }
      swipeOffsetRef.current = diffX;
      setSwipeOffset(diffX);
    }
  };

  const handleTouchEnd = (task: SdkStaffTask) => {
    if (swipingTaskIdRef.current === task.id) {
      if (isSwipingRef.current) {
        setBlockNextClick(true);
        setTimeout(() => setBlockNextClick(false), 100);

        const currentOffset = swipeOffsetRef.current;
        if (currentOffset > 120) {
          // Swipe Right: Complete Task
          const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
          sdk.staff.updateTask(task.id, { status: newStatus }).then(() => {
            qc.invalidateQueries({ queryKey: ['staffTasks', eventId] });
            toast({ 
              title: newStatus === 'completed' ? 'Task Completed!' : 'Task Reopened!',
              variant: 'success'
            });
          }).catch((err: any) => {
            toast({ title: 'Failed to update task', description: err.message, variant: 'destructive' });
          });
        } else if (currentOffset < -120) {
          // Swipe Left: Toggle Blocked Status
          const newStatus = task.status === 'blocked' ? 'not-started' : 'blocked';
          sdk.staff.updateTask(task.id, { status: newStatus }).then(() => {
            qc.invalidateQueries({ queryKey: ['staffTasks', eventId] });
            toast({ 
              title: newStatus === 'blocked' ? 'Task Blocked!' : 'Task Unblocked!',
              variant: 'default'
            });
          }).catch((err: any) => {
            toast({ title: 'Failed to update task', description: err.message, variant: 'destructive' });
          });
        }
      }
    }
    // Reset
    swipingTaskIdRef.current = null;
    isSwipingRef.current = false;
    swipeOffsetRef.current = 0;

    setSwipingTaskId(null);
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  // Shift form states
  const [addShiftOpen, setAddShiftOpen] = useState(false);
  const [newShiftStaffId, setNewShiftStaffId] = useState('');
  const [newShiftRole, setNewShiftRole] = useState<'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other'>('setup');
  const [newShiftStartsAt, setNewShiftStartsAt] = useState('');
  const [newShiftEndsAt, setNewShiftEndsAt] = useState('');
  const [newShiftNotes, setNewShiftNotes] = useState('');
  const [newShiftContactName, setNewShiftContactName] = useState('');
  const [newShiftContactPhone, setNewShiftContactPhone] = useState('');
  const [newShiftContactEmail, setNewShiftContactEmail] = useState('');
  const [newShiftRadioChannel, setNewShiftRadioChannel] = useState('Ops 1');
  const [newShiftHandoffNotes, setNewShiftHandoffNotes] = useState('');
  const [newShiftAvailabilityOverrideReason, setNewShiftAvailabilityOverrideReason] = useState('');
  const [availabilityDay, setAvailabilityDay] = useState('1');
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('17:00');
  const [availabilityStaffId, setAvailabilityStaffId] = useState('');

  // Queries
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['staffTasks', eventId],
    queryFn: () => sdk.staff.listTasks(organizationId, { eventId }),
  });

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['staffShifts', eventId],
    queryFn: () => sdk.staff.listShifts(organizationId, { eventId }),
  });

  const { data: allShiftsData } = useQuery({
    queryKey: ['staffShifts', organizationId, 'all-current'],
    queryFn: () => sdk.staff.listShifts(organizationId),
  });

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => sdk.auth.me(),
  });

  const { data: setupChecklistData } = useQuery({ queryKey: ['setupChecklist', eventId], queryFn: () => sdk.staff.setupChecklist(eventId) });
  const { data: staffingRequirementsData } = useQuery({ queryKey: ['staffingRequirements', eventId], queryFn: () => sdk.staff.staffingRequirements(eventId) });
  const { data: availabilityData } = useQuery({
    queryKey: ['staffAvailability', organizationId, availabilityStaffId || meData?.user?.id],
    queryFn: () => sdk.staff.availability(organizationId, availabilityStaffId || meData!.user.id),
    enabled: !!(availabilityStaffId || meData?.user?.id),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', organizationId],
    queryFn: () => sdk.roles.listMembers(organizationId),
  });

  // Fetch Event Layouts to extract active floorplan details (Phase 1)
  const { data: layoutsData } = useQuery({
    queryKey: ['layouts', eventId],
    queryFn: () => sdk.layouts.list(organizationId, { eventId }),
  });

  const availabilityMutation = useMutation({
    mutationFn: () => sdk.staff.createAvailability(organizationId, { staffId: availabilityStaffId || meData!.user.id, dayOfWeek: Number(availabilityDay), startsAt: availabilityStart, endsAt: availabilityEnd }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staffAvailability', organizationId] }); toast({ title: 'Weekly availability added', variant: 'success' }); },
    onError: (error: any) => toast({ title: 'Could not save availability', description: error?.message || 'Please check the time range.', variant: 'destructive' }),
  });

  const seedSetupChecklistMutation = useMutation({ mutationFn: () => sdk.staff.seedSetupChecklist(eventId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['setupChecklist', eventId] }); qc.invalidateQueries({ queryKey: ['staffTasks', eventId] }); toast({ title: 'Event Week setup checklist ready', variant: 'success' }); } });

  const staffingRequirementsMutation = useMutation({ mutationFn: (requiredRoles: Array<'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other'>) => sdk.staff.setStaffingRequirements(eventId, requiredRoles), onSuccess: () => { qc.invalidateQueries({ queryKey: ['staffingRequirements', eventId] }); toast({ title: 'Staffing requirements saved', variant: 'success' }); } });

  const deleteAvailabilityMutation = useMutation({
    mutationFn: (id: string) => sdk.staff.deleteAvailability(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staffAvailability', organizationId] }); toast({ title: 'Weekly availability removed', variant: 'success' }); },
    onError: (error: any) => toast({ title: 'Could not remove availability', description: error?.message || 'Please try again.', variant: 'destructive' }),
  });

  // Mutations
  const updatePhaseMutation = useMutation({
    mutationFn: ({ task, newPhase }: { task: SdkStaffTask, newPhase: any }) => {
      return sdk.staff.updateTask(task.id, { phase: newPhase });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffTasks', eventId] })
  });

  const createShiftMutation = useMutation({
    mutationFn: () => {
       return sdk.staff.createShift(organizationId, {
          staffId: newShiftStaffId,
          role: newShiftRole,
          startsAt: newShiftStartsAt,
          endsAt: newShiftEndsAt,
          notes: newShiftNotes,
          eventId,
          contactName: newShiftContactName || undefined,
          contactPhone: newShiftContactPhone || undefined,
          contactEmail: newShiftContactEmail || undefined,
          radioChannel: newShiftRadioChannel || undefined,
          handoffNotes: newShiftHandoffNotes || undefined,
          availabilityOverrideReason: newShiftAvailabilityOverrideReason || undefined,
       });
    },
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['staffShifts', eventId] });
       toast({ title: 'Staff shift scheduled successfully', variant: 'success' });
       setNewShiftStaffId('');
       setNewShiftRole('setup');
       setNewShiftStartsAt('');
       setNewShiftEndsAt('');
       setNewShiftNotes('');
       setNewShiftContactName('');
       setNewShiftContactPhone('');
       setNewShiftContactEmail('');
       setNewShiftRadioChannel('Ops 1');
       setNewShiftHandoffNotes('');
       setNewShiftAvailabilityOverrideReason('');
       setAddShiftOpen(false);
    },
    onError: (e: any) => {
       toast({ title: e?.code === 'staff-availability-override-required' ? 'Availability override required' : 'Failed to schedule shift', description: e?.code === 'staff-availability-override-required' ? 'This shift is outside the staff member’s recurring hours. Add a manager override reason to continue.' : e.message, variant: 'destructive' });
    }
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (shiftId: string) => sdk.staff.deleteShift(shiftId),
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['staffShifts', eventId] });
       toast({ title: 'Shift removed', variant: 'success' });
    }
  });

  const clockInMutation = useMutation({
    mutationFn: (shiftId: string) => sdk.staff.clockInShift(shiftId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staffShifts', eventId] });
      toast({ title: 'Clocked in successfully!', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Clock-in failed', description: e.message, variant: 'destructive' });
    }
  });

  const clockOutMutation = useMutation({
    mutationFn: (shiftId: string) => sdk.staff.clockOutShift(shiftId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staffShifts', eventId] });
      toast({ title: 'Clocked out successfully!', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Clock-out failed', description: e.message, variant: 'destructive' });
    }
  });

  const toggleTaskStatus = useMutation({
    mutationFn: (task: SdkStaffTask) => {
      const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
      return sdk.staff.updateTask(task.id, { status: newStatus });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffTasks', eventId] })
  });

  const applyStaffSetupTemplate = useMutation({
    mutationFn: async (template: 'captain' | 'setup' | 'parking' | 'cleanup') => {
      const templates: Record<typeof template, Array<{ title: string; phase: any; priority: any; description: string; tags: string[] }>> = {
        captain: [
          { title: 'Captain: run opening huddle', phase: 'pre-event', priority: 'critical', description: 'Confirm weather plan, radio channel, escalation path, and owner contact.', tags: ['captain','command-center'] },
          { title: 'Captain: verify vendor arrival board', phase: 'during-event', priority: 'high', description: 'Check vendor check-in, late arrivals, and blocked setup items.', tags: ['captain','check-in'] },
        ],
        setup: [
          { title: 'Setup crew: ceremony area ready', phase: 'pre-event', priority: 'high', description: 'Chairs, aisle, arch, signage, and accessibility paths verified.', tags: ['setup','ceremony'] },
          { title: 'Setup crew: reception tables ready', phase: 'pre-event', priority: 'high', description: 'Tables, linens, place settings, and service lanes verified.', tags: ['setup','reception'] },
        ],
        parking: [
          { title: 'Parking team: guest arrival plan active', phase: 'during-event', priority: 'medium', description: 'Signage, VIP parking, shuttle pickup, and emergency lane confirmed.', tags: ['parking','arrival'] },
        ],
        cleanup: [
          { title: 'Cleanup crew: post-event sweep', phase: 'post-event', priority: 'medium', description: 'Trash, rentals, lost items, vendor load-out, and venue reset.', tags: ['cleanup','teardown'] },
        ],
      };
      for (const task of templates[template]) await sdk.staff.createTask(organizationId, { ...task, eventId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staffTasks', eventId] }); toast({ title: 'Staff setup template added', variant: 'success' }); setSetupWizardOpen(false); },
    onError: (e: any) => toast({ title: 'Could not apply staff template', description: e.message, variant: 'destructive' }),
  });

  const createIncidentMutation = useMutation({
    mutationFn: () => sdk.staff.createTask(organizationId, {
      title: `Incident ${incidentSeverity.toUpperCase()}: ${incidentText.slice(0, 70) || 'New incident'}`,
      description: `${incidentText}

Severity: ${incidentSeverity}
Owner notification rule: ${ownerNotify || incidentSeverity === 'critical' ? 'notify owner/admin' : 'captain handles unless escalated'}`,
      phase: 'during-event',
      priority: incidentSeverity === 'critical' ? 'critical' : incidentSeverity === 'high' ? 'high' : 'medium',
      status: 'blocked',
      tags: ['incident','day-of', `severity:${incidentSeverity}`, ownerNotify ? 'owner-notify' : 'captain-only'],
      eventId
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staffTasks', eventId] }); toast({ title: 'Incident reported', description: `${incidentSeverity} severity workflow created${ownerNotify ? ' with owner notification rule.' : '.'}`, variant: 'success' }); setIncidentText(''); setIncidentOpen(false); },
  });

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, task: SdkStaffTask) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.currentTarget.classList.add('opacity-40');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-surface-3');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-surface-3');
  };

  const handleDrop = (e: React.DragEvent, phaseId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-surface-3');
    
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.phase !== phaseId) {
      qc.setQueryData(['staffTasks', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t: SdkStaffTask) => t.id === taskId ? { ...t, phase: phaseId } : t)
        };
      });
      updatePhaseMutation.mutate({ task, newPhase: phaseId });
    }
  };

  const tasks = tasksData?.tasks || [];
  const shifts = shiftsData?.shifts || [];
  const allShifts = allShiftsData?.shifts || [];
  const members = (membersData as any)?.members || [];
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';

  const phases = [
    { id: 'pre-event', label: 'Pre-Event Prep' },
    { id: 'during-event', label: 'Day-Of Execution' },
    { id: 'post-event', label: 'Post-Event Teardown' },
  ] as const;

  // Filtered tasks mapping (Phase 5 Refinements)
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesPriority = priorityFilter === 'all' ? true : t.priority === priorityFilter;
      const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;
      return matchesPriority && matchesStatus;
    });
  }, [tasks, priorityFilter, statusFilter]);

  // Completion stats metrics (Phase 5 Refinements)
  const totalTasksCount = filteredTasks.length;
  const completedTasksCount = filteredTasks.filter(t => t.status === 'completed').length;
  const completionRatio = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Extract Approved Layout (Phase 1)
  const activeLayout = useMemo(() => {
     return layoutsData?.layouts?.find((l: any) => l.approval_status === 'approved') || layoutsData?.layouts?.[0];
  }, [layoutsData]);

  // Keyboard accessibility controls (WCAG 2.1 Compliance!)
  const handleKeyboardMove = (task: SdkStaffTask, direction: 'left' | 'right') => {
    const currentIndex = phases.findIndex(p => p.id === task.phase);
    let nextIndex = currentIndex + (direction === 'right' ? 1 : -1);
    
    if (nextIndex >= 0 && nextIndex < phases.length) {
      const newPhase = phases[nextIndex].id;
      qc.setQueryData(['staffTasks', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t: SdkStaffTask) => t.id === task.id ? { ...t, phase: newPhase } : t)
        };
      });
      updatePhaseMutation.mutate({ task, newPhase });
      toast({ title: 'Task moved via keyboard', description: `Moved "${task.title}" to ${phases[nextIndex].label}` });
    }
  };

  // Render Mini Map SVG Blueprint in real-time (Phase 1)
  const renderMiniMapSvg = () => {
    if (!activeLayout) return null;
    try {
      const payload = typeof activeLayout.payload === 'string' ? JSON.parse(activeLayout.payload) : activeLayout.payload;
      const itemsList = Array.isArray(payload?.items) ? payload.items : [];
      
      return (
        <svg viewBox="0 0 800 600" width="100%" height="auto" className="bg-paper border border-paper-border rounded-2xl overflow-hidden shadow-inner p-2">
          <defs>
             <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#e1d5c9" opacity="0.4" />
             </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />

          {itemsList.map((item: any) => {
            if (item.type === 'round_table') {
              return (
                <g key={item.id}>
                  <circle cx={item.x} cy={item.y} r={item.radius || 30} fill="#ffffff" stroke="#9ca3af" strokeWidth="1.5" />
                  <text x={item.x} y={item.y + 4} fontFamily="Georgia, serif" fontSize="9" textAnchor="middle" fill="#374151" fontWeight="bold">{item.label || 'Table'}</text>
                </g>
              );
            }
            if (item.type === 'rect_table' || item.type === 'dance_floor') {
              const w = item.width || 120;
              const h = item.height || 40;
              const fill = item.type === 'dance_floor' ? '#e5e7eb' : '#ffffff';
              const stroke = item.type === 'dance_floor' ? '#d1d5db' : '#9ca3af';
              return (
                <g key={item.id} transform={`rotate(${item.rotation || 0} ${item.x} ${item.y})`}>
                  <rect x={item.x - w/2} y={item.y - h/2} width={w} height={h} rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
                  <text x={item.x} y={item.y + 4} fontFamily="Georgia, serif" fontSize="9" textAnchor="middle" fill="#374151" fontWeight="bold">{item.label || 'Table'}</text>
                </g>
              );
            }
            if (item.type === 'custom_wall') {
               if (item.points && item.points.length >= 4) {
                  const path = `M ${item.points[0]} ${item.points[1]} ` + item.points.slice(2).reduce((acc: string, val: number, idx: number) => {
                     return acc + (idx % 2 === 0 ? `L ${val} ` : `${val} `);
                  }, '');
                  return (
                     <path key={item.id} d={path} fill="none" stroke={item.color || '#374151'} strokeWidth={item.strokeWidth || 4} strokeLinecap="round" strokeLinejoin="round" />
                  );
               }
            }
            if (item.type === 'chair') {
               return (
                  <circle key={item.id} cx={item.x} cy={item.y} r={item.radius || 6} fill={item.guestId ? "#fdf2f8" : "#fff"} stroke={item.guestId ? "#ec4899" : "#6b7280"} strokeWidth="1" />
               );
            }
            return null;
          })}
        </svg>
      );
    } catch {
      return <div className="text-center py-8 text-fg-subtle">Error compiling SVG blueprint map.</div>;
    }
  };

  if (tasksLoading || shiftsLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (tasksError) {
    return <Card><CardContent className="pt-6 text-danger text-sm">Failed to load tasks.</CardContent></Card>;
  }

  const hasCoordinator = shifts.some(s => s.role === 'coordinator');
  const hasSetup = shifts.some(s => s.role === 'setup');
  const hasCleaning = shifts.some(s => s.role === 'cleaning');
  const blockedTasks = tasks.filter(t => t.status === 'blocked');
  const criticalOpenTasks = tasks.filter(t => t.priority === 'critical' && t.status !== 'completed');
  const whatNowQueue = [...blockedTasks, ...criticalOpenTasks, ...tasks.filter(t => t.status === 'in-progress'), ...tasks.filter(t => t.status === 'not-started')]
    .filter((task, index, arr) => arr.findIndex(t => t.id === task.id) === index)
    .slice(0, 5);
  const canManageAvailability = canManageStaff;
  const availabilityStaff = ((membersData as any)?.members || []).filter((member: any) => ['staff', 'manager', 'owner', 'admin'].includes(String(member.role_key || member.roleKey || '').toLowerCase()));

  const liveCrew = shifts.filter((s: any) => s.clocked_in_at && !s.clocked_out_at).length;
  const coverageRoles = ['coordinator','setup','cleaning','parking'];
  const coveragePct = Math.round((coverageRoles.filter(role => shifts.some((s: any) => s.role === role)).length / coverageRoles.length) * 100);

  return (
    <div className="space-y-6">
      <StaffTopCards setEditTask={setEditTask} setSetupWizardOpen={setSetupWizardOpen} captainMode={captainMode} setCaptainMode={setCaptainMode} setIncidentOpen={setIncidentOpen} availabilityDay={availabilityDay} setAvailabilityDay={setAvailabilityDay} availabilityStart={availabilityStart} setAvailabilityStart={setAvailabilityStart} availabilityEnd={availabilityEnd} setAvailabilityEnd={setAvailabilityEnd} availabilityStaffId={availabilityStaffId} setAvailabilityStaffId={setAvailabilityStaffId} setupChecklistData={setupChecklistData} staffingRequirementsData={staffingRequirementsData} availabilityData={availabilityData} availabilityMutation={availabilityMutation} seedSetupChecklistMutation={seedSetupChecklistMutation} staffingRequirementsMutation={staffingRequirementsMutation} deleteAvailabilityMutation={deleteAvailabilityMutation} tasks={tasks} shifts={shifts} whatNowQueue={whatNowQueue} canManageAvailability={canManageAvailability} availabilityStaff={availabilityStaff} liveCrew={liveCrew} coveragePct={coveragePct} />

      {managerMode && (
        <VenueManagerStaffingCommandCenter
          tasks={tasks}
          shifts={shifts}
          allShifts={allShifts}
          members={members}
          eventId={eventId}
          onApplyTemplate={(template) => applyStaffSetupTemplate.mutate(template)}
          onPrintBrief={() => window.print()}
        />
      )}
      
      {/* Sub tabs selector */}
      <StaffSubTabs activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} tasks={tasks} />

      {activeSubTab === 'tasks' ? (
        /* Refined Tasks Kanban Panel */
      <StaffTasksKanban priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} setEditTask={setEditTask} swipingTaskId={swipingTaskId} swipeOffset={swipeOffset} isSwiping={isSwiping} blockNextClick={blockNextClick} setCreateOpen={setCreateOpen} setMapOverlayOpen={setMapOverlayOpen} handleTouchStart={handleTouchStart} handleTouchMove={handleTouchMove} handleTouchEnd={handleTouchEnd} toggleTaskStatus={toggleTaskStatus} handleDragStart={handleDragStart} handleDragEnd={handleDragEnd} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop} tasks={tasks} phases={phases} filteredTasks={filteredTasks} totalTasksCount={totalTasksCount} completedTasksCount={completedTasksCount} completionRatio={completionRatio} activeLayout={activeLayout} handleKeyboardMove={handleKeyboardMove} canManage={canManageStaff} />
      ) : (
        /* Shifts Scheduler Panel (Phase 1) */
      <StaffShiftsScheduler newShiftRole={newShiftRole} setNewShiftRole={setNewShiftRole} addShiftOpen={addShiftOpen} setAddShiftOpen={setAddShiftOpen} newShiftStaffId={newShiftStaffId} setNewShiftStaffId={setNewShiftStaffId} newShiftStartsAt={newShiftStartsAt} setNewShiftStartsAt={setNewShiftStartsAt} newShiftEndsAt={newShiftEndsAt} setNewShiftEndsAt={setNewShiftEndsAt} newShiftNotes={newShiftNotes} setNewShiftNotes={setNewShiftNotes} newShiftContactName={newShiftContactName} setNewShiftContactName={setNewShiftContactName} newShiftContactPhone={newShiftContactPhone} setNewShiftContactPhone={setNewShiftContactPhone} newShiftContactEmail={newShiftContactEmail} setNewShiftContactEmail={setNewShiftContactEmail} newShiftRadioChannel={newShiftRadioChannel} setNewShiftRadioChannel={setNewShiftRadioChannel} newShiftHandoffNotes={newShiftHandoffNotes} setNewShiftHandoffNotes={setNewShiftHandoffNotes} newShiftAvailabilityOverrideReason={newShiftAvailabilityOverrideReason} setNewShiftAvailabilityOverrideReason={setNewShiftAvailabilityOverrideReason} meData={meData} createShiftMutation={createShiftMutation} deleteShiftMutation={deleteShiftMutation} clockInMutation={clockInMutation} clockOutMutation={clockOutMutation} shifts={shifts} members={members} hasCoordinator={hasCoordinator} hasSetup={hasSetup} hasCleaning={hasCleaning} canManage={canManageStaff} />
      )}

      <StaffOverlayDialogs editTask={editTask} setEditTask={setEditTask} incidentSeverity={incidentSeverity} setIncidentSeverity={setIncidentSeverity} createOpen={createOpen} setCreateOpen={setCreateOpen} mapOverlayOpen={mapOverlayOpen} setMapOverlayOpen={setMapOverlayOpen} setupWizardOpen={setupWizardOpen} setSetupWizardOpen={setSetupWizardOpen} incidentOpen={incidentOpen} setIncidentOpen={setIncidentOpen} incidentText={incidentText} setIncidentText={setIncidentText} ownerNotify={ownerNotify} setOwnerNotify={setOwnerNotify} applyStaffSetupTemplate={applyStaffSetupTemplate} createIncidentMutation={createIncidentMutation} activeLayout={activeLayout} renderMiniMapSvg={renderMiniMapSvg} eventId={eventId} organizationId={organizationId} />
    </div>
  );
}




