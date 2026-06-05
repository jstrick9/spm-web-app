import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../ui/Dialog';

interface Props {
  eventId: string;
  organizationId: string;
}

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'bg-amber-100 text-amber-800 border-amber-200',
  setup: 'bg-blue-100 text-blue-800 border-blue-200',
  cleaning: 'bg-green-100 text-green-800 border-green-200',
  parking: 'bg-purple-100 text-purple-800 border-purple-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function EventStaffTab({ eventId, organizationId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  // Navigation tabs: 'tasks' | 'scheduler'
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'scheduler'>('tasks');

  // Tasks Filter States (Phase 5 Refinements)
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<SdkStaffTask | null>(null);
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false);

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

  // Queries
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['staffTasks', eventId],
    queryFn: () => sdk.staff.listTasks(organizationId, { eventId }),
  });

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['staffShifts', eventId],
    queryFn: () => sdk.staff.listShifts(organizationId, { eventId }),
  });

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => sdk.auth.me(),
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
          eventId
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
       setAddShiftOpen(false);
    },
    onError: (e: any) => {
       toast({ title: 'Failed to schedule shift', description: e.message, variant: 'destructive' });
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
  const members = (membersData as any)?.members || [];

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
        <svg viewBox="0 0 800 600" width="100%" height="auto" className="bg-[#FDFBF7] border border-[#e1d5c9] rounded-2xl overflow-hidden shadow-inner p-2">
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

  return (
    <div className="space-y-6">
      
      {/* Sub tabs selector */}
      <div className="flex border-b border-[#e1d5c9] gap-2">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={[
            'pb-2 px-4 text-xs font-bold transition-all border-b-2',
            activeSubTab === 'tasks' ? 'border-brand text-brand' : 'border-transparent text-fg-subtle hover:text-fg',
          ].join(' ')}
        >
          📋 Operations Checklist (Kanban)
        </button>
        <button
          onClick={() => setActiveSubTab('scheduler')}
          className={[
            'pb-2 px-4 text-xs font-bold transition-all border-b-2',
            activeSubTab === 'scheduler' ? 'border-brand text-brand' : 'border-transparent text-fg-subtle hover:text-fg',
          ].join(' ')}
        >
          📅 Staff Shift &amp; Crew Scheduler
        </button>
      </div>

      {activeSubTab === 'tasks' ? (
        /* Refined Tasks Kanban Panel */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Progress Sparkline & Controls Band */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-[#FDFBF7] rounded-xl border border-[#e1d5c9] shadow-sm font-semibold text-xs">
             <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-fg mb-1">
                   <span>Tasks Completion Ratio</span>
                   <span className="text-brand font-black">{completedTasksCount}/{totalTasksCount} Completed ({completionRatio}%)</span>
                </div>
                <div className="h-3 w-full bg-surface-2 rounded-full overflow-hidden border border-[#e1d5c9] p-0.5">
                   <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${completionRatio}%` }}></div>
                </div>
             </div>

             {/* Interactive filters */}
             <div className="flex gap-2 items-center shrink-0">
                <div className="flex gap-1 items-center bg-white p-1 rounded-lg border border-[#e1d5c9]">
                   <SlidersHorizontal className="w-3.5 h-3.5 ml-1 text-brand" />
                   <select 
                      value={priorityFilter}
                      onChange={e => setPriorityFilter(e.target.value)}
                      className="h-7 rounded border-none bg-transparent px-2 text-[10px] font-bold text-fg-subtle cursor-pointer focus:outline-none"
                   >
                      <option value="all">All Priorities</option>
                      <option value="critical">Critical Only</option>
                      <option value="high">High Only</option>
                      <option value="medium">Medium Only</option>
                      <option value="low">Low Only</option>
                   </select>
                   <select 
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="h-7 rounded border-none bg-transparent px-2 text-[10px] font-bold text-fg-subtle cursor-pointer focus:outline-none border-l border-[#e1d5c9]"
                   >
                      <option value="all">All Statuses</option>
                      <option value="not-started">Not Started</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                   </select>
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-fg-subtle font-serif">Operational Checklist</h2>
            <div className="flex items-center gap-2">
               {activeLayout && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMapOverlayOpen(true)}
                    className="font-bold border-[#e1d5c9] bg-white hover:bg-brand-soft/20 text-brand text-xs h-9 flex items-center gap-1.5"
                  >
                     🗺️ View Floorplan Map Blueprint
                  </Button>
               )}
               <Button onClick={() => setCreateOpen(true)} className="font-bold">
                 <Plus className="w-4 h-4 mr-1" /> New Task
               </Button>
            </div>
          </div>

          {totalTasksCount === 0 ? (
            <Card className="border-[#e1d5c9] bg-[#FDFBF7]">
              <div className="py-12 flex flex-col items-center text-center">
                <ClipboardList className="w-12 h-12 text-fg-subtle mb-4" />
                <h3 className="text-lg font-medium font-serif text-fg">No tasks match selected filters</h3>
                <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                  Adjust your priority or status filters, or create a brand new task.
                </p>
                <Button variant="outline" onClick={() => setCreateOpen(true)}>Create task</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {phases.map(phase => {
                const phaseTasks = filteredTasks.filter(t => t.phase === phase.id);
                return (
                  <div key={phase.id} className="flex flex-col gap-3 h-full rounded-lg transition-colors border border-transparent"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, phase.id)}
                  >
                    <h3 className="font-semibold text-xs text-fg flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#e1d5c9] shadow-sm font-serif">
                      {phase.label}
                      <Badge variant="outline" className="text-[10px] bg-[#FDFBF7] text-brand border-[#e1d5c9] font-bold">{phaseTasks.length}</Badge>
                    </h3>
                    
                    {phaseTasks.length === 0 ? (
                      <div className="text-center p-6 border border-dashed border-[#e1d5c9] rounded-xl text-xs text-fg-subtle bg-white font-serif">
                         No tasks scheduled
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {phaseTasks.map(task => {
                          const isCompleted = task.status === 'completed';
                          const isBlocked = task.status === 'blocked';
                          return (
                            <div key={task.id} className="relative overflow-hidden rounded-xl bg-[#FDFBF7]">
                              {/* Swipe Background Reveal - Underlay */}
                              {isSwiping && swipingTaskId === task.id && Math.abs(swipeOffset) > 10 && (
                                <div className="absolute inset-0 flex items-center justify-between px-4 rounded-xl">
                                  {swipeOffset > 0 ? (
                                    <div 
                                      className={cn(
                                        "absolute inset-y-0 left-0 flex items-center pl-4 text-white font-bold transition-colors duration-150 rounded-xl w-full",
                                        swipeOffset > 120 ? "bg-emerald-600" : "bg-emerald-500/80"
                                      )}
                                    >
                                      <CheckSquare className="w-5 h-5 mr-2 animate-bounce" />
                                      <span className="text-xs uppercase tracking-wider font-bold">
                                        {swipeOffset > 120 ? 'Release to Complete' : 'Swipe to Complete'}
                                      </span>
                                    </div>
                                  ) : (
                                    <div 
                                      className={cn(
                                        "absolute inset-y-0 right-0 flex items-center justify-end pr-4 text-white font-bold transition-colors duration-150 rounded-xl w-full",
                                        swipeOffset < -120 ? "bg-amber-600" : "bg-amber-500/80"
                                      )}
                                    >
                                      <span className="text-xs uppercase tracking-wider font-bold">
                                        {Math.abs(swipeOffset) > 120 ? 'Release to Block' : 'Swipe to Block'}
                                      </span>
                                      <ShieldAlert className="w-5 h-5 ml-2 animate-pulse" />
                                    </div>
                                  )}
                                </div>
                              )}

                              <Card 
                                className={cn(
                                  "hover:shadow-md transition-all border-[#e1d5c9] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-xl touch-pan-y select-none", 
                                  isCompleted && "opacity-60",
                                  isBlocked && "border-danger border-2 shadow-sm bg-red-50/20"
                                )}
                                style={{
                                  transform: swipingTaskId === task.id ? `translateX(${swipeOffset}px)` : 'none',
                                  transition: swipingTaskId === task.id ? 'none' : 'transform 0.2s ease-out'
                                }}
                                onTouchStart={(e) => handleTouchStart(e, task)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={() => handleTouchEnd(task)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task)}
                                onDragEnd={handleDragEnd}
                                onClick={() => {
                                  if (blockNextClick) return;
                                  setEditTask(task);
                                }}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                   if (e.key === 'ArrowLeft') {
                                      e.preventDefault();
                                      handleKeyboardMove(task, 'left');
                                   } else if (e.key === 'ArrowRight') {
                                      e.preventDefault();
                                      handleKeyboardMove(task, 'right');
                                   } else if (e.key === ' ' || e.key === 'Enter') {
                                      e.preventDefault();
                                      setEditTask(task);
                                   }
                                }}
                                aria-label={`Task: ${task.title}. Priority: ${task.priority}. Status: ${task.status}. Press Left or Right arrows to move phases, or swipe right to complete, swipe left to block.`}
                              >
                                <CardContent className="p-3.5 flex gap-3 bg-white">
                                  <button 
                                    className={cn("shrink-0 mt-0.5", isCompleted ? "text-success" : "text-fg-subtle hover:text-brand")}
                                    onClick={(e) => { e.stopPropagation(); toggleTaskStatus.mutate(task); }}
                                  >
                                    {isCompleted ? <CheckSquare className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                  </button>
                                  <div className="flex-1 min-w-0 text-fg">
                                    <h4 className={cn("text-xs font-bold text-fg leading-snug", isCompleted && "line-through text-fg-subtle")}>
                                      {task.title}
                                    </h4>
                                    {task.description && (
                                      <p className="text-[11px] text-fg-subtle mt-1.5 line-clamp-2 leading-relaxed font-semibold">{task.description}</p>
                                    )}
                                    
                                    {/* Blocked or Critical warnings on-screen */}
                                    {isBlocked && (
                                       <span className="text-[9px] text-danger font-bold mt-1.5 flex items-center gap-1">
                                          ⚠️ BLOCKED OPERATIONAL TASK
                                       </span>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-2.5">
                                      <Badge variant={
                                        task.priority === 'critical' ? 'danger' :
                                        task.priority === 'high' ? 'brand' :
                                        'outline'
                                      } className="text-[9px] uppercase tracking-wider font-bold">
                                        {task.priority} priority
                                      </Badge>
                                      {task.assigned_staff.length > 0 && (
                                        <Badge variant="outline" className="text-[9px] bg-[#FDFBF7] border-[#e1d5c9] font-bold text-fg-subtle">
                                          {task.assigned_staff.length} assigned
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Shifts Scheduler Panel (Phase 1) */
        <div className="space-y-6 animate-in fade-in duration-200">
           
           {/* Shift Scheduler Title */}
           <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-fg-subtle font-serif">Staff Shifts Grid</h2>
              <Button onClick={() => setAddShiftOpen(!addShiftOpen)} className="font-bold">
                 <Plus className="w-4 h-4 mr-1" /> {addShiftOpen ? 'Close Scheduler' : 'Schedule Staff Shift'}
              </Button>
           </div>

           {/* Dynamic Role Coverage Auditor */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-white border-[#e1d5c9]">
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

              <Card className="bg-white border-[#e1d5c9]">
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

              <Card className="bg-white border-[#e1d5c9]">
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
                                   <div key={s.id} className="bg-white p-4 rounded-xl border border-[#e1d5c9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-semibold text-xs text-fg">
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
                    <Card className="bg-white border-[#e1d5c9] shadow-sm">
                       <CardHeader className="pb-2 border-b border-[#e1d5c9]/50 flex flex-row items-center justify-between">
                          <div>
                             <CardTitle className="font-serif font-bold text-sm text-fg flex items-center gap-1.5">
                                👥 On-Site Crew Roster (Live)
                             </CardTitle>
                             <CardDescription className="text-xs">
                                Real-time operations staffing log.
                             </CardDescription>
                          </div>
                          <Badge variant="outline" className="bg-[#FDFBF7] text-brand border-[#e1d5c9] font-black text-xs px-2.5 py-0.5">
                             {liveOnSiteCrew.length} Active Crew On-Site
                          </Badge>
                       </CardHeader>
                       <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {shifts.map((s: any) => {
                                const staffMember = members.find((m: any) => m.userId === s.staff_id);
                                const name = staffMember ? (staffMember.fullName || staffMember.email) : 'Assigned Crew Member';
                                const isClockedIn = s.clocked_in_at && !s.clocked_out_at;
                                const isClockedOut = s.clocked_in_at && s.clocked_out_at;
                                
                                return (
                                   <div key={s.id} className={cn(
                                      "p-3 rounded-xl border flex items-center justify-between gap-3 font-semibold text-xs text-fg transition-all",
                                      isClockedIn ? "border-success bg-emerald-50/20 shadow-xs" : "border-[#e1d5c9] bg-[#FDFBF7]/20"
                                   )}>
                                      <div className="flex items-center gap-2.5">
                                         <div className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-serif shadow-xs border",
                                            isClockedIn ? "bg-success/20 text-success border-success/30 animate-pulse" : "bg-surface-2 text-fg-subtle border-[#e1d5c9]"
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
              <div className="bg-white p-5 rounded-2xl border border-[#e1d5c9] space-y-4 shadow-md font-semibold text-xs text-fg animate-in slide-in-from-top-4">
                 <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif border-b pb-2 flex items-center gap-1.5 text-brand">
                    <Sparkles className="w-4 h-4 text-brand animate-pulse" /> Create Crew Shift Assignment
                 </h4>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                       <Label className="text-[10px] text-fg-subtle">Assigned Staff Member</Label>
                       <select
                         className="h-9 w-full rounded-lg border border-[#e1d5c9] bg-surface px-2 text-xs mt-1 font-semibold"
                         value={newShiftStaffId}
                         onChange={(e) => setNewShiftStaffId(e.target.value)}
                       >
                          <option value="">Select crew member...</option>
                          {members.map((m: any) => (
                             <option key={m.userId} value={m.userId}>{m.fullName || m.email}</option>
                          ))}
                       </select>
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Role / Division</Label>
                       <select
                         className="h-9 w-full rounded-lg border border-[#e1d5c9] bg-surface px-2 text-xs mt-1 font-semibold"
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
                       <Input value={newShiftNotes} onChange={e => setNewShiftNotes(e.target.value)} placeholder="Assign to East Lawn..." className="h-9 mt-1 text-xs border-[#e1d5c9]" />
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Shift Starts At</Label>
                       <Input type="datetime-local" value={newShiftStartsAt} onChange={e => setNewShiftStartsAt(e.target.value)} className="h-9 mt-1 text-xs border-[#e1d5c9]" />
                    </div>

                    <div>
                       <Label className="text-[10px] text-fg-subtle">Shift Ends At</Label>
                       <Input type="datetime-local" value={newShiftEndsAt} onChange={e => setNewShiftEndsAt(e.target.value)} className="h-9 mt-1 text-xs border-[#e1d5c9]" />
                    </div>
                 </div>

                 <Button 
                    onClick={() => createShiftMutation.mutate()} 
                    disabled={!newShiftStaffId || !newShiftStartsAt || !newShiftEndsAt || createShiftMutation.isPending}
                    className="w-full font-bold h-10 mt-2"
                 >
                    Schedule Shift
                 </Button>
              </div>
           )}

           {/* Scheduled Shifts Timeline List */}
           <div className="space-y-3">
              {shifts.length === 0 ? (
                 <div className="text-center p-12 border border-dashed border-[#e1d5c9] rounded-2xl text-xs text-fg-subtle bg-white font-serif">
                    No active staff shifts scheduled for this event yet.
                 </div>
              ) : (
                 shifts.map((s: any) => {
                    const staffMember = members.find((m: any) => m.userId === s.staff_id);
                    return (
                       <Card key={s.id} className="border-[#e1d5c9] bg-white shadow-xs p-4 flex items-center justify-between gap-4 font-semibold text-xs text-fg">
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
                             </div>
                          </div>

                          <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-danger hover:bg-danger/10 shrink-0"
                             onClick={() => {
                                if (window.confirm('Delete this staff shift?')) {
                                   deleteShiftMutation.mutate(s.id);
                                }
                             }}
                          >
                             <Trash2 className="w-4 h-4" />
                          </Button>
                       </Card>
                    );
                 })
              )}
           </div>

        </div>
      )}

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
    </div>
  );
}
