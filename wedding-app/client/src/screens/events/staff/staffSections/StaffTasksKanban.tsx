import type { SdkStaffTask } from '../../../../sdk/types';
import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X, Bell, Download, Smartphone, Radio, AlertTriangle, Phone, MessageSquare, Mail, Users, Printer, ClipboardCheck, BarChart3, GitBranch, MapPin } from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/Card';
import { Badge } from '../../../../ui/Badge';
import { cn } from '../../../../ui/lib/cn';

export interface StaffTasksKanbanProps {
  priorityFilter: string;
  setPriorityFilter: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  setEditTask: React.Dispatch<React.SetStateAction<SdkStaffTask | null>>;
  swipingTaskId: string | null;
  swipeOffset: number;
  isSwiping: boolean;
  blockNextClick: boolean;
  setCreateOpen: React.Dispatch<React.SetStateAction<any>>;
  /** MODULE-05 ST-08: create/edit affordances are manager-gated (staff role self-serves status only). */
  canManage?: boolean;
  setMapOverlayOpen: React.Dispatch<React.SetStateAction<any>>;
  handleTouchStart: any;
  handleTouchMove: any;
  handleTouchEnd: any;
  toggleTaskStatus: any;
  handleDragStart: any;
  handleDragEnd: any;
  handleDragOver: any;
  handleDragLeave: any;
  handleDrop: any;
  tasks: any;
  phases: readonly { id: string; label: string }[];
  filteredTasks: any;
  totalTasksCount: any;
  completedTasksCount: any;
  completionRatio: any;
  activeLayout: any;
  handleKeyboardMove: any;
}

export function StaffTasksKanban({ priorityFilter, setPriorityFilter, statusFilter, setStatusFilter, setEditTask, swipingTaskId, swipeOffset, isSwiping, blockNextClick, setCreateOpen, setMapOverlayOpen, handleTouchStart, handleTouchMove, handleTouchEnd, toggleTaskStatus, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, tasks, phases, filteredTasks, totalTasksCount, completedTasksCount, completionRatio, activeLayout, handleKeyboardMove, canManage = true }: StaffTasksKanbanProps) {
  return (
    <>
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Progress Sparkline & Controls Band */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-paper rounded-xl border border-paper-border shadow-sm font-semibold text-xs">
             <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-fg mb-1">
                   <span>Tasks Completion Ratio</span>
                   <span className="text-brand font-black">{completedTasksCount}/{totalTasksCount} Completed ({completionRatio}%)</span>
                </div>
                <div className="h-3 w-full bg-surface-2 rounded-full overflow-hidden border border-paper-border p-0.5">
                   <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${completionRatio}%` }}></div>
                </div>
             </div>

             {/* Interactive filters */}
             <div className="flex gap-2 items-center shrink-0">
                <div className="flex gap-1 items-center bg-white p-1 rounded-lg border border-paper-border">
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
                      className="h-7 rounded border-none bg-transparent px-2 text-[10px] font-bold text-fg-subtle cursor-pointer focus:outline-none border-l border-paper-border"
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
                    className="font-bold border-paper-border bg-white hover:bg-brand-soft/20 text-brand text-xs h-9 flex items-center gap-1.5"
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
            <Card className="border-paper-border bg-paper">
              <div className="py-12 flex flex-col items-center text-center">
                <ClipboardList className="w-12 h-12 text-fg-subtle mb-4" />
                <h3 className="text-lg font-medium font-serif text-fg">No tasks match selected filters</h3>
                <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                  Adjust your priority or status filters, or create a brand new task.
                </p>
                {canManage && <Button variant="outline" onClick={() => setCreateOpen(true)}>Create task</Button>}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {phases.map(phase => {
                const phaseTasks = filteredTasks.filter((t: any) => t.phase === phase.id);
                return (
                  <div key={phase.id} className="flex flex-col gap-3 h-full rounded-lg transition-colors border border-transparent"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, phase.id)}
                  >
                    <h3 className="font-semibold text-xs text-fg flex justify-between items-center bg-white p-2.5 rounded-xl border border-paper-border shadow-sm font-serif">
                      {phase.label}
                      <Badge variant="outline" className="text-[10px] bg-paper text-brand border-paper-border font-bold">{phaseTasks.length}</Badge>
                    </h3>
                    
                    {phaseTasks.length === 0 ? (
                      <div className="text-center p-6 border border-dashed border-paper-border rounded-xl text-xs text-fg-subtle bg-white font-serif">
                         No tasks scheduled
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {phaseTasks.map((task: any) => {
                          const isCompleted = task.status === 'completed';
                          const isBlocked = task.status === 'blocked';
                          return (
                            <div key={task.id} className="relative overflow-hidden rounded-xl bg-paper">
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
                                  "hover:shadow-md transition-all border-paper-border focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-xl touch-pan-y select-none", 
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
                                    
                                    {(task.assignee_name || task.assignee_phone || task.assignee_email) && (
                                      <div className="mt-2 rounded-lg border border-border bg-paper p-2 text-[11px] text-fg-muted">
                                        <div className="font-bold text-fg">Day-of contact: {task.assignee_name || 'Assigned contact'}</div>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                          {task.assignee_phone && <a href={`tel:${task.assignee_phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border bg-white px-2 font-bold text-brand"><Phone className="h-3.5 w-3.5" /> Call</a>}
                                          {task.assignee_phone && <a href={`sms:${task.assignee_phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border bg-white px-2 font-bold text-brand"><MessageSquare className="h-3.5 w-3.5" /> SMS</a>}
                                          {task.assignee_email && <a href={`mailto:${task.assignee_email}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border bg-white px-2 font-bold text-brand"><Mail className="h-3.5 w-3.5" /> Email</a>}
                                        </div>
                                      </div>
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
                                        <Badge variant="outline" className="text-[9px] bg-paper border-paper-border font-bold text-fg-subtle">
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
    </>
  );
}
