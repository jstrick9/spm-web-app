import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffTopCards } from './staffSections/StaffTopCards';
import { StaffSubTabs } from './staffSections/StaffSubTabs';
import { StaffTasksKanban } from './staffSections/StaffTasksKanban';
import { StaffShiftsScheduler } from './staffSections/StaffShiftsScheduler';
import { StaffOverlayDialogs } from './staffSections/StaffOverlayDialogs';

/**
 * Direct component tests for the extracted EventStaffTab sections.
 * Each section renders standalone with props (the container owns all state),
 * locking the contracts so future in-section refactors are safe.
 */

const noop = () => {};
const setState = (v: any) => { void v; };

const PHASES = [
  { id: 'pre-event', label: 'Pre-Event Prep' },
  { id: 'during-event', label: 'Day-Of Execution' },
  { id: 'post-event', label: 'Post-Event Teardown' },
] as const;

function topCardsProps(over: Partial<Parameters<typeof StaffTopCards>[0]> = {}) {
  return {
    setEditTask: setState as any,
    setSetupWizardOpen: setState as any,
    captainMode: false,
    setCaptainMode: setState as any,
    setIncidentOpen: setState as any,
    availabilityDay: '0',
    setAvailabilityDay: setState as any,
    availabilityStart: '09:00',
    setAvailabilityStart: setState as any,
    availabilityEnd: '17:00',
    setAvailabilityEnd: setState as any,
    availabilityStaffId: '',
    setAvailabilityStaffId: setState as any,
    setupChecklistData: { checklist: [{ id: 'c1', title: 'Chairs set', status: 'completed' }, { id: 'c2', title: 'Aisle runner', status: 'pending' }] } as any,
    staffingRequirementsData: { requiredRoles: ['coordinator', 'setup'] } as any,
    availabilityData: { availability: [{ id: 'a1', day_of_week: 0, starts_at: '09:00', ends_at: '17:00' }] } as any,
    availabilityMutation: { isPending: false, mutate: noop } as any,
    seedSetupChecklistMutation: { isPending: false, mutate: noop } as any,
    staffingRequirementsMutation: { mutate: noop } as any,
    deleteAvailabilityMutation: { isPending: false, mutate: noop } as any,
    tasks: [] as any,
    shifts: [] as any,
    whatNowQueue: [] as any,
    canManageAvailability: true,
    availabilityStaff: [] as any,
    liveCrew: [] as any,
    coveragePct: 80,
    ...over,
  };
}

function subTabsProps(over: Partial<Parameters<typeof StaffSubTabs>[0]> = {}) {
  return {
    activeSubTab: 'tasks' as const,
    setActiveSubTab: setState as any,
    tasks: [] as any,
    ...over,
  };
}

function kanbanProps(over: Partial<Parameters<typeof StaffTasksKanban>[0]> = {}) {
  return {
    priorityFilter: 'all',
    setPriorityFilter: setState as any,
    statusFilter: 'all',
    setStatusFilter: setState as any,
    setEditTask: setState as any,
    swipingTaskId: null,
    swipeOffset: 0,
    isSwiping: false,
    blockNextClick: false,
    setCreateOpen: setState as any,
    setMapOverlayOpen: setState as any,
    handleTouchStart: noop, handleTouchMove: noop, handleTouchEnd: noop,
    toggleTaskStatus: noop,
    handleDragStart: noop, handleDragEnd: noop, handleDragOver: noop, handleDragLeave: noop, handleDrop: noop,
    tasks: [
      { id: 't1', title: 'Open bar', phase: 'during-event', status: 'pending', priority: 'high', assigned_staff: [] },
      { id: 't2', title: 'Strike linens', phase: 'post-event', status: 'pending', priority: 'low', assigned_staff: [] },
    ] as any,
    phases: PHASES,
    filteredTasks: [
      { id: 't1', title: 'Open bar', phase: 'during-event', status: 'pending', priority: 'high', assigned_staff: [] },
    ] as any,
    totalTasksCount: 2,
    completedTasksCount: 1,
    completionRatio: 50,
    activeLayout: null,
    handleKeyboardMove: noop,
    ...over,
  };
}

function schedulerProps(over: Partial<Parameters<typeof StaffShiftsScheduler>[0]> = {}): Parameters<typeof StaffShiftsScheduler>[0] {
  return {
    newShiftRole: 'setup',
    setNewShiftRole: setState as any,
    addShiftOpen: false,
    setAddShiftOpen: setState as any,
    newShiftStaffId: '',
    setNewShiftStaffId: setState as any,
    newShiftStartsAt: '',
    setNewShiftStartsAt: setState as any,
    newShiftEndsAt: '',
    setNewShiftEndsAt: setState as any,
    newShiftNotes: '',
    setNewShiftNotes: setState as any,
    newShiftContactName: '',
    setNewShiftContactName: setState as any,
    newShiftContactPhone: '',
    setNewShiftContactPhone: setState as any,
    newShiftContactEmail: '',
    setNewShiftContactEmail: setState as any,
    newShiftRadioChannel: '',
    setNewShiftRadioChannel: setState as any,
    newShiftHandoffNotes: '',
    setNewShiftHandoffNotes: setState as any,
    newShiftAvailabilityOverrideReason: '',
    setNewShiftAvailabilityOverrideReason: setState as any,
    meData: { me: { full_name: 'Jordan Crew', email: 'jordan@x.com' } } as any,
    createShiftMutation: { isPending: false, mutate: noop } as any,
    deleteShiftMutation: { isPending: false, mutate: noop } as any,
    clockInMutation: { isPending: false, mutate: noop } as any,
    clockOutMutation: { isPending: false, mutate: noop } as any,
    shifts: [{ id: 's1', role: 'setup', starts_at: '2026-09-12T08:00:00', ends_at: '2026-09-12T12:00:00', staff_name: 'Sam Setup' }] as any,
    members: [] as any,
    hasCoordinator: true,
    hasSetup: false,
    hasCleaning: true,
    ...over,
  } as Parameters<typeof StaffShiftsScheduler>[0];
}

function overlaysProps(over: Partial<Parameters<typeof StaffOverlayDialogs>[0]> = {}) {
  return {
    editTask: null,
    setEditTask: setState as any,
    incidentSeverity: 'high' as const,
    setIncidentSeverity: setState as any,
    createOpen: false,
    setCreateOpen: setState as any,
    mapOverlayOpen: false,
    setMapOverlayOpen: setState as any,
    setupWizardOpen: false,
    setSetupWizardOpen: setState as any,
    incidentOpen: false,
    setIncidentOpen: setState as any,
    incidentText: '',
    setIncidentText: setState as any,
    ownerNotify: false,
    setOwnerNotify: setState as any,
    applyStaffSetupTemplate: { mutate: noop } as any,
    createIncidentMutation: { mutate: noop } as any,
    activeLayout: null,
    renderMiniMapSvg: () => <div data-testid="mini-map" />,
    eventId: 'evt-1',
    organizationId: 'org-1',
    ...over,
  };
}

// ── StaffTopCards ─────────────────────────────────────────
describe('StaffTopCards', () => {
  it('renders the setup checklist with task rows', () => {
    render(<StaffTopCards {...topCardsProps()} />);
    expect(screen.getByText(/event week setup checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Chairs set/)).toBeInTheDocument();
    expect(screen.getByText(/Aisle runner/)).toBeInTheDocument();
  });

  it('renders weekly availability slots and the add-hours form', () => {
    render(<StaffTopCards {...topCardsProps()} />);
    expect(screen.getByText(/my weekly availability/i)).toBeInTheDocument();
    expect(screen.getByText('Sun 09:00–17:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add hours/i })).toBeInTheDocument();
  });

  it('shows captain mode toggle and fires it', async () => {
    const user = userEvent.setup();
    const setCaptainMode = vi.fn();
    render(<StaffTopCards {...topCardsProps({ setCaptainMode: setCaptainMode as any })} />);
    await user.click(screen.getByRole('button', { name: /captain mode/i }));
    expect(setCaptainMode).toHaveBeenCalled();
  });
});

// ── StaffSubTabs ───────────────────────────────────────────
describe('StaffSubTabs', () => {
  it('renders both workspace tabs', () => {
    render(<StaffSubTabs {...subTabsProps()} />);
    expect(screen.getByRole('button', { name: /operations checklist \(kanban\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /staff shift & crew scheduler/i })).toBeInTheDocument();
  });

  it('fires setActiveSubTab on click', async () => {
    const user = userEvent.setup();
    const setActiveSubTab = vi.fn();
    render(<StaffSubTabs {...subTabsProps({ setActiveSubTab: setActiveSubTab as any })} />);
    await user.click(screen.getByRole('button', { name: /staff shift & crew scheduler/i }));
    expect(setActiveSubTab).toHaveBeenCalledWith('scheduler');
  });
});

// ── StaffTasksKanban ───────────────────────────────────────
describe('StaffTasksKanban', () => {
  it('renders the phase columns with task titles', () => {
    render(<StaffTasksKanban {...kanbanProps()} />);
    expect(screen.getByText('Pre-Event Prep')).toBeInTheDocument();
    expect(screen.getByText('Day-Of Execution')).toBeInTheDocument();
    expect(screen.getByText('Post-Event Teardown')).toBeInTheDocument();
    expect(screen.getByText('Open bar')).toBeInTheDocument();
  });

  it('shows the completion ratio in the progress band', () => {
    render(<StaffTasksKanban {...kanbanProps()} />);
    expect(screen.getByText(/1\/2 Completed \(50%\)/i)).toBeInTheDocument();
  });

  it('shows the empty state when no tasks match', () => {
    render(<StaffTasksKanban {...kanbanProps({ filteredTasks: [], totalTasksCount: 0, tasks: [] })} />);
    expect(screen.getByText(/no tasks match selected filters/i)).toBeInTheDocument();
  });
});

// ── StaffShiftsScheduler ───────────────────────────────────
describe('StaffShiftsScheduler', () => {
  it('renders the coverage auditor with coordinator status', () => {
    render(<StaffShiftsScheduler {...schedulerProps()} />);
    expect(screen.getByText(/staff shifts grid/i)).toBeInTheDocument();
    expect(screen.getByText('🛡️ Coordinator Active')).toBeInTheDocument();
    expect(screen.getByText('🧹 Cleanup Team assigned')).toBeInTheDocument();
  });

  it('toggles the schedule shift form', async () => {
    const user = userEvent.setup();
    const setAddShiftOpen = vi.fn();
    render(<StaffShiftsScheduler {...schedulerProps({ setAddShiftOpen: setAddShiftOpen as any })} />);
    await user.click(screen.getByRole('button', { name: /schedule staff shift/i }));
    expect(setAddShiftOpen).toHaveBeenCalledWith(true);
  });

  it('member options use the snake_case user_id from the members API (regression: m.userId was undefined → option values silently fell back to emails → server rejected every shift with staff-not-in-org)', async () => {
    const user = userEvent.setup();
    render(<StaffShiftsScheduler {...schedulerProps({
      addShiftOpen: true,
      members: [{ user_id: 'u-1', fullName: 'Jordan Crew', email: 'jordan@x.com' }] as any,
    })} />);
    const select = screen.getByText('Assigned Staff Member').closest('div')!.querySelector('select')!;
    const options = Array.from(select.options);
    expect(options.map((o) => o.value)).toContain('u-1');
    expect(options.map((o) => o.value)).not.toContain('jordan@x.com');
  });

  it('renders an Edit button per shift and pre-fills the scheduler from the shift row (snake_case)', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<StaffShiftsScheduler {...schedulerProps({
      shifts: [{ id: 's1', role: 'setup', staff_id: 'u-1', starts_at: '2026-09-12T08:00:00', ends_at: '2026-09-12T12:00:00' }] as any,
      members: [{ user_id: 'u-1', fullName: 'Jordan Crew', email: 'jordan@x.com' }] as any,
      onEditShift: onEdit as any,
    })} />);
    await user.click(screen.getByRole('button', { name: /edit shift for jordan crew/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', staff_id: 'u-1' }));
  });
});

// ── StaffOverlayDialogs ────────────────────────────────────
describe('StaffOverlayDialogs', () => {
  it('shows the floorplan blueprint dialog when open with a layout', () => {
    render(<StaffOverlayDialogs {...overlaysProps({
      mapOverlayOpen: true,
      activeLayout: { id: 'l1', revision: 2, approval_status: 'approved' },
    })} />);
    expect(screen.getByText(/quick floorplan blueprint map/i)).toBeInTheDocument();
    expect(screen.getByTestId('mini-map')).toBeInTheDocument();
    expect(screen.getByText(/REV 2/i)).toBeInTheDocument();
  });

  it('shows the incident severity workflow dialog when open', () => {
    render(<StaffOverlayDialogs {...overlaysProps({ incidentOpen: true })} />);
    expect(screen.getByText(/incident severity workflow/i)).toBeInTheDocument();
  });

  it('renders the staff setup wizard when open', () => {
    render(<StaffOverlayDialogs {...overlaysProps({ setupWizardOpen: true })} />);
    expect(screen.getByText(/staff setup wizard/i)).toBeInTheDocument();
  });
});
