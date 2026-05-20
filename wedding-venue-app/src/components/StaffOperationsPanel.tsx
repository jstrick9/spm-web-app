import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, StaffTask, StaffArea, StaffShift, StaffTaskPhase, StaffTaskStatus, 
  StaffTaskPriority, ChecklistItem, OperationsExport, Venue
} from '../types';
import { getConfig } from '../config';
import EmojiPicker from './EmojiPicker';
import { canAccessOperationsPanel, canManageOperationsData } from '../utils/permissions';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { emitDataChanged, on } from '../utils/appEvents';

interface Props {
  onClose: () => void;
  currentUser: User;
  isAdmin: boolean;
  venueId?: string;
  eventName?: string;
  users: User[];
  venues: Venue[];
}

const PHASES: StaffTaskPhase[] = ['pre-event', 'during-event', 'post-event'];
const STATUSES: StaffTaskStatus[] = ['not-started', 'in-progress', 'completed', 'blocked'];
const PRIORITIES: StaffTaskPriority[] = ['low', 'medium', 'high', 'critical'];

const StaffOperationsPanel: React.FC<Props> = ({ 
  onClose, 
  currentUser, 
  isAdmin, 
  venueId, 
  eventName,
  users,
  venues
}) => {
  const config = getConfig();
  const canAccessPanel = canAccessOperationsPanel(currentUser);
  const canMutateOperations = canManageOperationsData(currentUser);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'areas' | 'shifts' | 'checklists' | 'export'>('overview');

  if (!canAccessPanel) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl p-6">
          <h2 className="text-xl font-semibold text-red-700">Access denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You do not have permission to access staff operations.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  
  // Data State
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [areas, setAreas] = useState<StaffArea[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  
  // UI State
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban');
  const [selectedTaskId, setSelectedId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [shiftView, setShiftView] = useState<'timeline' | 'list'>('timeline');
  
  // Load Data
  useEffect(() => {
    const loadData = () => {
      const savedTasks = localStorage.getItem(STORAGE_KEYS.STAFF_TASKS);
      const savedAreas = localStorage.getItem(STORAGE_KEYS.STAFF_AREAS);
      const savedShifts = localStorage.getItem(STORAGE_KEYS.STAFF_SHIFTS);
      
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      if (savedAreas) setAreas(JSON.parse(savedAreas));
      if (savedShifts) setShifts(JSON.parse(savedShifts));
    };

    loadData();
    return on('spm_data_changed', loadData);
  }, []);

  // Save Helpers
  const saveTasks = (newTasks: StaffTask[]) => {
    setTasks(newTasks);
    localStorage.setItem(STORAGE_KEYS.STAFF_TASKS, JSON.stringify(newTasks));
    emitDataChanged();
  };

  const saveAreas = (newAreas: StaffArea[]) => {
    setAreas(newAreas);
    localStorage.setItem(STORAGE_KEYS.STAFF_AREAS, JSON.stringify(newAreas));
    emitDataChanged();
  };

  const saveShifts = (newShifts: StaffShift[]) => {
    setShifts(newShifts);
    localStorage.setItem(STORAGE_KEYS.STAFF_SHIFTS, JSON.stringify(newShifts));
    emitDataChanged();
  };

  // --- Handlers ---
  const handleAddTask = (phase: StaffTaskPhase) => {
    if (!canMutateOperations) return;
    const newTask: StaffTask = {
      id: `task-${Date.now()}`,
      title: 'New Task',
      phase,
      status: 'not-started',
      priority: 'medium',
      assignedStaff: [],
      assignedAreas: [],
      tags: [],
      checklist: [],
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
    };
    saveTasks([newTask, ...tasks]);
    setSelectedId(newTask.id);
  };

  const handleUpdateTask = (id: string, updates: Partial<StaffTask>) => {
    if (!canMutateOperations) return;
    const newTasks = tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates, updatedAt: new Date().toISOString(), updatedBy: currentUser.id };
        if (updates.status === 'completed' && t.status !== 'completed') {
          updated.completedAt = new Date().toISOString();
          updated.completedBy = currentUser.id;
        }
        return updated;
      }
      return t;
    });
    saveTasks(newTasks);
  };

  const handleDeleteTask = (id: string) => {
    if (!canMutateOperations) return;
    if (confirm('Delete this task?')) {
      saveTasks(tasks.filter(t => t.id !== id));
      setSelectedId(null);
    }
  };

  const handleAddArea = () => {
    if (!canMutateOperations) return;
    const newArea: StaffArea = {
      id: `area-${Date.now()}`,
      name: 'New Operational Area',
      color: config.primaryColor,
      icon: '📍',
      assignedStaff: [],
      venueId: venueId || (venues && venues.length > 0 ? venues[0].id : '')
    };
    saveAreas([...areas, newArea]);
    setSelectedAreaId(newArea.id);
  };

  const handleUpdateArea = (id: string, updates: Partial<StaffArea>) => {
    if (!canMutateOperations) return;
    saveAreas(areas.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleDeleteArea = (id: string) => {
    if (!canMutateOperations) return;
    if (confirm('Delete this area?')) {
      saveAreas(areas.filter(a => a.id !== id));
      setSelectedAreaId(null);
    }
  };

  const handleAddShift = () => {
    if (!canMutateOperations) return;
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4 hours
    const newShift: StaffShift = {
      id: `shift-${Date.now()}`,
      staffId: currentUser.id,
      role: 'coordinator',
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      venueId: venueId || (venues && venues.length > 0 ? venues[0].id : ''),
      eventName: eventName || 'Current Event'
    };
    saveShifts([...shifts, newShift]);
    setSelectedShiftId(newShift.id);
  };

  const handleUpdateShift = (id: string, updates: Partial<StaffShift>) => {
    if (!canMutateOperations) return;
    saveShifts(shifts.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleDeleteShift = (id: string) => {
    if (!canMutateOperations) return;
    if (confirm('Delete this shift?')) {
      saveShifts(shifts.filter(s => s.id !== id));
      setSelectedShiftId(null);
    }
  };

  // --- Helpers ---
  const staffUsers = useMemo(() => users.filter(u => u.role === 'staff' || u.role === 'admin'), [users]);
  const getStaffName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getVenueName = (id: string) => venues.find(v => v.id === id)?.name || 'N/A';

  // --- Render Tabs ---
  
  const renderOverview = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const myTasks = tasks.filter(t => t.assignedStaff.includes(currentUser.id));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-gray-900">
          <StatCard label="Total Tasks" value={total} color="text-gray-900" />
          <StatCard label="Completed" value={completed} color="text-green-600" />
          <StatCard label="Blocked" value={blocked} color="text-red-600" />
          <StatCard label="My Tasks" value={myTasks.length} color="text-purple-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Phase Progress</h3>
            <div className="space-y-4">
              {PHASES.map(phase => {
                const phaseTasks = tasks.filter(t => t.phase === phase);
                const pct = phaseTasks.length > 0 ? Math.round((phaseTasks.filter(t => t.status === 'completed').length / phaseTasks.length) * 100) : 0;
                return (
                  <div key={phase}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">{phase.replace('-', ' ')}</span>
                      <span className="text-gray-500">{pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all" style={{ width: `${pct}%`, backgroundColor: config.primaryColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">My Tasks</h3>
            <div className="space-y-3">
              {myTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 italic">No tasks assigned to you.</div>
              ) : (
                myTasks.slice(0, 5).map(task => (
                  <div key={task.id} onClick={() => { setSelectedId(task.id); setActiveTab('tasks'); }} className="flex items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <PriorityDot priority={task.priority} />
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="text-sm font-bold truncate text-gray-900">{task.title}</div>
                      <div className="text-xs text-gray-500 capitalize">{task.dueTime || 'No time'} • {task.status.replace('-', ' ')}</div>
                    </div>
                    <span className="text-gray-400">➜</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTasks = () => {
    const selectedTask = tasks.find(t => t.id === selectedTaskId);

    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button onClick={() => setTaskView('kanban')} className={`px-4 py-2 rounded-lg text-sm font-medium ${taskView === 'kanban' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={taskView === 'kanban' ? { backgroundColor: config.primaryColor } : {}}>Kanban</button>
            <button onClick={() => setTaskView('list')} className={`px-4 py-2 rounded-lg text-sm font-medium ${taskView === 'list' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={taskView === 'list' ? { backgroundColor: config.primaryColor } : {}}>List</button>
          </div>
          <button
  	    type="button"
  	    onClick={() => handleAddTask('pre-event')}
  	    disabled={!canMutateOperations}
  	    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  	    style={{ backgroundColor: config.primaryColor }}
	  >
  	    + Add Task
	  </button>
        </div>

        <div className="flex-1 min-h-0">
          {taskView === 'kanban' ? (
            <div className="grid grid-cols-3 gap-6 h-full overflow-hidden">
              {PHASES.map(phase => (
                <div key={phase} className="flex flex-col h-full bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex justify-between">
                    {phase.replace('-', ' ')}
                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-normal">
                      {tasks.filter(t => t.phase === phase).length}
                    </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {tasks.filter(t => t.phase === phase).map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedId(task.id)}
                        className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer hover:border-purple-400 transition-all ${selectedTaskId === task.id ? 'ring-2 ring-purple-500 border-transparent' : 'border-gray-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                        <div className="text-sm font-bold text-gray-900 mb-3 leading-snug">{task.title}</div>
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2 overflow-hidden">
                            {task.assignedStaff.map(id => (
                              <div key={id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700" title={getStaffName(id)}>
                                {getStaffName(id).charAt(0)}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center text-[10px] text-gray-400 font-medium">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-200"></span>
                              {task.checklist.filter(i => i.completed).length}/{task.checklist.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Phase</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Assigned</th>
                    <th className="px-6 py-3">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map(task => (
                    <tr key={task.id} onClick={() => setSelectedId(task.id)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 font-bold text-gray-900">{task.title}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{task.phase.replace('-', ' ')}</td>
                      <td className="px-6 py-4"><PriorityBadge priority={task.priority} /></td>
                      <td className="px-6 py-4"><StatusBadge status={task.status} /></td>
                      <td className="px-6 py-4 text-gray-600">{task.assignedStaff.length} staff</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${task.checklist.length > 0 ? (task.checklist.filter(i => i.completed).length / task.checklist.length) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold">{task.checklist.filter(i => i.completed).length}/{task.checklist.length}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Task Detail Panel Overlay */}
        {selectedTask && (
          <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-end">
            <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <header className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Task Details</h2>
                <button onClick={() => setSelectedId(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">✕</button>
              </header>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                  <input 
                    type="text" 
                    value={selectedTask.title} 
                    onChange={e => handleUpdateTask(selectedTask.id, { title: e.target.value })}
                    className="w-full text-lg font-bold border-b border-transparent focus:border-purple-500 outline-none py-1 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                  <textarea 
                    value={selectedTask.description || ''} 
                    onChange={e => handleUpdateTask(selectedTask.id, { description: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2 h-24 focus:ring-2 focus:ring-purple-500 outline-none text-gray-700"
                    placeholder="Add details about this task..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phase</label>
                    <select 
                      value={selectedTask.phase}
                      onChange={e => handleUpdateTask(selectedTask.id, { phase: e.target.value as any })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    >
                      {PHASES.map(p => <option key={p} value={p}>{p.replace('-', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                    <select 
                      value={selectedTask.priority}
                      onChange={e => handleUpdateTask(selectedTask.id, { priority: e.target.value as any })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                  <select 
                    value={selectedTask.status}
                    onChange={e => handleUpdateTask(selectedTask.id, { status: e.target.value as any })}
                    className="w-full border rounded-lg p-2 text-sm font-bold text-purple-700 bg-purple-50"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Assign Staff</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedTask.assignedStaff.map(id => (
                      <div key={id} className="flex items-center gap-2 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100">
                        {getStaffName(id)}
                        <button onClick={() => handleUpdateTask(selectedTask.id, { assignedStaff: selectedTask.assignedStaff.filter(sid => sid !== id) })} className="hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                  <select 
                    onChange={e => {
                      if (e.target.value && !selectedTask.assignedStaff.includes(e.target.value)) {
                        handleUpdateTask(selectedTask.id, { assignedStaff: [...selectedTask.assignedStaff, e.target.value] });
                      }
                      e.target.value = '';
                    }}
                    className="w-full border rounded-lg p-2 text-sm text-gray-600 bg-white"
                  >
                    <option value="">+ Assign Staff member...</option>
                    {staffUsers.filter(u => !selectedTask.assignedStaff.includes(u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Checklist</label>
                  <div className="space-y-2 mb-4">
                    {selectedTask.checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group">
                        <input 
                          type="checkbox" 
                          checked={item.completed} 
                          onChange={() => {
                            const newChecklist = selectedTask.checklist.map(i => 
                              i.id === item.id ? { ...i, completed: !i.completed, completedAt: !i.completed ? new Date().toISOString() : undefined, completedBy: !i.completed ? currentUser.id : undefined } : i
                            );
                            handleUpdateTask(selectedTask.id, { checklist: newChecklist });
                          }}
                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                        />
                        <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.label}</span>
                        <button onClick={() => {
                          handleUpdateTask(selectedTask.id, { checklist: selectedTask.checklist.filter(i => i.id !== item.id) });
                        }} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add checklist item..." 
                      className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          const newItem: ChecklistItem = { 
                            id: `item-${Date.now()}`, 
                            label: e.currentTarget.value.trim(), 
                            completed: false 
                          };
                          handleUpdateTask(selectedTask.id, { checklist: [...selectedTask.checklist, newItem] });
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <footer className="p-6 border-t bg-gray-50 flex justify-between gap-4">
                <button 
                  onClick={() => handleDeleteTask(selectedTask.id)} 
                  className="px-4 py-2 text-red-600 text-sm font-bold hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete Task
                </button>
                <button 
                  onClick={() => setSelectedId(null)} 
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-purple-700 transition-all"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  Save & Close
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAreas = () => {
    const selectedArea = areas.find(a => a.id === selectedAreaId);

    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Operational Areas</h2>
          <button
  	    type="button"
  	    onClick={handleAddArea}
  	    disabled={!canMutateOperations}
  	    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  	    style={{ backgroundColor: config.primaryColor }}
	  >
  	    + Add Area
	  </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {areas.map(area => (
            <div 
              key={area.id} 
              onClick={() => setSelectedAreaId(area.id)}
              className={`bg-white p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${selectedAreaId === area.id ? 'border-purple-500 shadow-sm' : 'border-gray-100'}`}
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4 shadow-sm" style={{ backgroundColor: `${area.color}20`, color: area.color }}>
                  {area.icon || '📍'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{area.name}</h3>
                  <p className="text-xs text-gray-500">{getVenueName(area.venueId || '')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-tighter">
                <span>👤 {area.assignedStaff.length} Staff</span>
                <span>✅ {tasks.filter(t => t.assignedAreas.includes(area.id)).length} Tasks</span>
              </div>
            </div>
          ))}
        </div>

        {selectedArea && (
          <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <header className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">Edit Area</h3>
                <button onClick={() => setSelectedAreaId(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">✕</button>
              </header>
              <div className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                  <input 
                    type="text" 
                    value={selectedArea.name} 
                    onChange={e => handleUpdateArea(selectedArea.id, { name: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-900 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Icon</label>
                    <div className="relative">
                      <EmojiPicker 
                        value={selectedArea.icon} 
                        onChange={icon => handleUpdateArea(selectedArea.id, { icon })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color</label>
                    <input 
                      type="color" 
                      value={selectedArea.color} 
                      onChange={e => handleUpdateArea(selectedArea.id, { color: e.target.value })}
                      className="w-full h-9 border rounded-lg p-1 cursor-pointer bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Venue</label>
                  <select 
                    value={selectedArea.venueId}
                    onChange={e => handleUpdateArea(selectedArea.id, { venueId: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                  >
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>
              <footer className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <button onClick={() => handleDeleteArea(selectedArea.id)} className="text-red-600 text-sm font-bold hover:underline">Delete Area</button>
                <button onClick={() => setSelectedAreaId(null)} className="px-8 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm" style={{ backgroundColor: config.primaryColor }}>Close</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderShifts = () => {
    const selectedShift = shifts.find(s => s.id === selectedShiftId);
    const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to Midnight

    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button onClick={() => setShiftView('timeline')} className={`px-4 py-2 rounded-lg text-sm font-medium ${shiftView === 'timeline' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={shiftView === 'timeline' ? { backgroundColor: config.primaryColor } : {}}>Timeline</button>
            <button onClick={() => setShiftView('list')} className={`px-4 py-2 rounded-lg text-sm font-medium ${shiftView === 'list' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`} style={shiftView === 'list' ? { backgroundColor: config.primaryColor } : {}}>List</button>
          </div>
          <button
  	    type="button"
  	    onClick={handleAddShift}
  	    disabled={!canMutateOperations}
  	    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  	    style={{ backgroundColor: config.primaryColor }}
	  >
  	    + Add Shift
	  </button>
        </div>

        <div className="flex-1 min-h-0">
          {shiftView === 'timeline' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto h-full flex flex-col">
              <div className="flex border-b bg-gray-50 h-12 flex-shrink-0 sticky top-0 z-10">
                <div className="w-48 flex-shrink-0 border-r p-3 font-bold text-gray-500 uppercase text-[10px] bg-gray-50">Staff Member</div>
                <div className="flex flex-1 overflow-x-auto">
                  {hours.map(h => (
                    <div key={h} className="w-20 flex-shrink-0 border-r p-3 text-[10px] font-bold text-gray-400 text-center">
                      {h > 12 ? `${h-12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {staffUsers.map(user => {
                  const staffShifts = shifts.filter(s => s.staffId === user.id);
                  return (
                    <div key={user.id} className="flex border-b last:border-b-0 hover:bg-gray-50/50 min-h-[60px]">
                      <div className="w-48 flex-shrink-0 border-r p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">{user.name.charAt(0)}</div>
                        <span className="text-sm font-bold truncate text-gray-900">{user.name}</span>
                      </div>
                      <div className="flex flex-1 relative bg-gray-50/30">
                        {hours.map(h => <div key={h} className="w-20 flex-shrink-0 border-r last:border-r-0 h-full" />)}
                        {staffShifts.map(shift => {
                          const start = new Date(shift.startTime);
                          const end = new Date(shift.endTime);
                          const startHour = start.getHours() + start.getMinutes() / 60;
                          if (startHour < 6) return null;
                          const startPos = (startHour - 6) * 80;
                          const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                          const width = duration * 80;
                          
                          return (
                            <div 
                              key={shift.id}
                              onClick={() => setSelectedShiftId(shift.id)}
                              className={`absolute top-2 h-10 rounded-lg shadow-sm cursor-pointer border flex items-center px-3 text-[10px] font-bold transition-all hover:brightness-95 overflow-hidden ${
                                shift.role === 'coordinator' ? 'bg-purple-500 text-white border-purple-600' :
                                shift.role === 'setup' ? 'bg-blue-500 text-white border-blue-600' :
                                shift.role === 'cleaning' ? 'bg-green-500 text-white border-green-600' :
                                'bg-orange-500 text-white border-orange-600'
                              }`}
                              style={{ left: `${startPos}px`, width: `${width}px` }}
                            >
                              <span className="truncate">{shift.role} • {shift.notes || 'No notes'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-3">Staff</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Start</th>
                    <th className="px-6 py-3">End</th>
                    <th className="px-6 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shifts.map(shift => (
                    <tr key={shift.id} onClick={() => setSelectedShiftId(shift.id)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 font-bold text-gray-900">{getStaffName(shift.staffId)}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{shift.role}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(shift.startTime).toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(shift.endTime).toLocaleString()}</td>
                      <td className="px-6 py-4 truncate max-w-xs text-gray-600">{shift.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedShift && (
          <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <header className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">Edit Shift</h3>
                <button onClick={() => setSelectedShiftId(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">✕</button>
              </header>
              <div className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Staff Member</label>
                  <select 
                    value={selectedShift.staffId}
                    onChange={e => handleUpdateShift(selectedShift.id, { staffId: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                  >
                    {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                  <select 
                    value={selectedShift.role}
                    onChange={e => handleUpdateShift(selectedShift.id, { role: e.target.value as any })}
                    className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                  >
                    <option value="coordinator">Coordinator</option>
                    <option value="setup">Setup</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="parking">Parking</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={selectedShift.startTime.slice(0, 16)}
                      onChange={e => handleUpdateShift(selectedShift.id, { startTime: new Date(e.target.value).toISOString() })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Time</label>
                    <input 
                      type="datetime-local" 
                      value={selectedShift.endTime.slice(0, 16)}
                      onChange={e => handleUpdateShift(selectedShift.id, { endTime: new Date(e.target.value).toISOString() })}
                      className="w-full border rounded-lg p-2 text-sm text-gray-700 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
                  <textarea 
                    value={selectedShift.notes || ''}
                    onChange={e => handleUpdateShift(selectedShift.id, { notes: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm h-20 text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
              <footer className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <button onClick={() => handleDeleteShift(selectedShift.id)} className="text-red-600 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">Delete Shift</button>
                <button onClick={() => setSelectedShiftId(null)} className="px-8 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold shadow-sm" style={{ backgroundColor: config.primaryColor }}>Close</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderChecklists = () => (
    <div className="space-y-8">
      {PHASES.map(phase => {
        const phaseTasks = tasks.filter(t => t.phase === phase);
        const allItems = phaseTasks.flatMap(t => t.checklist.map(item => ({ ...item, taskTitle: t.title, taskId: t.id })));
        
        if (allItems.length === 0) return null;

        return (
          <div key={phase}>
            <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize border-b pb-2 flex justify-between items-center">
              {phase.replace('-', ' ')}
              <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded tracking-widest">{allItems.filter(i => i.completed).length}/{allItems.length} complete</span>
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y shadow-sm">
              {allItems.map(item => (
                <div key={item.id} className="flex items-center p-4 hover:bg-gray-50 transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={item.completed} 
                    onChange={() => {
                      const task = tasks.find(t => t.id === item.taskId);
                      if (task) {
                        const newChecklist = task.checklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i);
                        handleUpdateTask(task.id, { checklist: newChecklist });
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                  />
                  <div className="flex-1 ml-4 min-w-0">
                    <div className={`text-sm font-medium ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{item.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Task: <span className="font-bold text-gray-500">{item.taskTitle}</span></div>
                  </div>
                  <button onClick={() => setSelectedId(item.taskId)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100">View Task</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {tasks.flatMap(t => t.checklist).length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 italic text-gray-500">
          No checklist items found in any tasks.
        </div>
      )}
    </div>
  );

  const renderExport = () => {
    const handleExport = () => {
      const data: OperationsExport = {
        tasks,
        areas,
        shifts,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operations-${eventName || 'event'}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    };

    return (
      <div className="max-w-2xl mx-auto space-y-8 py-10 text-center">
        <div className="bg-white p-10 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">📤</div>
          <h2 className="text-2xl font-bold text-gray-900">Operations Data Management</h2>
          <p className="text-gray-500">Download your tasks, areas, and schedule as a JSON file or import existing configurations.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button onClick={handleExport} className="px-8 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center" style={{ backgroundColor: config.primaryColor }}>
              <span className="mr-2">💾</span> Export JSON
            </button>
            <label className="px-8 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-all cursor-pointer flex items-center justify-center" style={{ borderColor: config.primaryColor, color: config.primaryColor }}>
              <span className="mr-2">📂</span> Import JSON
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      if (data.tasks && confirm('Import will merge with existing data. Continue?')) {
                        saveTasks([...(data.tasks || []), ...tasks]);
                        if (data.areas) saveAreas([...(data.areas || []), ...areas]);
                        if (data.shifts) saveShifts([...(data.shifts || []), ...shifts]);
                        alert('Import successful!');
                      }
                    } catch (err) {
                      alert('Invalid JSON file.');
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
        <button onClick={() => window.print()} className="w-full py-4 border-2 border-gray-300 rounded-2xl text-gray-600 font-bold hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
          <span>🖨️</span> Print Operations Summary
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-gray-100/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-300">
      <header className="h-16 px-6 flex items-center justify-between shadow-sm border-b" style={{ background: `linear-gradient(to right, ${config.primaryColor}, ${config.primaryDark})` }}>
        <div className="flex items-center text-white">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mr-3 text-xl shadow-inner">📋</div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">Staff & Operations</h1>
            <p className="text-xs opacity-80 font-medium tracking-wide uppercase">{eventName || 'Event Operations'}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors text-xl font-bold">✕</button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_15px_rgba(0,0,0,0.02)]">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {[
              { id: 'overview', icon: '📊', label: 'Overview' },
              { id: 'tasks', icon: '✅', label: 'Tasks' },
              { id: 'areas', icon: '📍', label: 'Areas' },
              { id: 'shifts', icon: '🕒', label: 'Shifts' },
              { id: 'checklists', icon: '📝', label: 'Checklists' },
              { id: 'export', icon: '💾', label: 'Export / Import' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
                style={activeTab === item.id ? { color: config.primaryColor, backgroundColor: `${config.primaryColor}10`, borderColor: `${config.primaryColor}20` } : {}}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold mr-3 border-2 border-white shadow-sm overflow-hidden" style={{ color: config.primaryColor, backgroundColor: `${config.primaryColor}20` }}>
                {currentUser.imageUrl ? (
                  <img src={currentUser.imageUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate tracking-tight">{currentUser.name}</div>
                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mt-1">{currentUser.role}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto bg-gray-50/30">
          <div className="max-w-6xl mx-auto p-8 h-full">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'tasks' && renderTasks()}
            {activeTab === 'areas' && renderAreas()}
            {activeTab === 'shifts' && renderShifts()}
            {activeTab === 'checklists' && renderChecklists()}
            {activeTab === 'export' && renderExport()}
          </div>
        </main>
      </div>
    </div>
  );
};

// --- Sub-components ---

const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-transform hover:-translate-y-1 duration-200">
    <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{label}</div>
    <div className={`text-3xl font-black mt-1 ${color}`}>{value}</div>
  </div>
);

const PriorityDot = ({ priority }: { priority: StaffTaskPriority }) => (
  <div className={`w-3 h-3 rounded-full shadow-sm ${
    priority === 'critical' ? 'bg-red-500' : 
    priority === 'high' ? 'bg-orange-500' : 
    priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
  }`} />
);

const PriorityBadge = ({ priority }: { priority: StaffTaskPriority }) => (
  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
    priority === 'critical' ? 'bg-red-100 text-red-700' : 
    priority === 'high' ? 'bg-orange-100 text-orange-700' : 
    priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
  }`}>
    {priority}
  </span>
);

const StatusBadge = ({ status }: { status: StaffTaskStatus }) => (
  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
    status === 'completed' ? 'bg-green-100 text-green-700' : 
    status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 
    status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
  }`}>
    {status.replace('-', ' ')}
  </span>
);

export default StaffOperationsPanel;
