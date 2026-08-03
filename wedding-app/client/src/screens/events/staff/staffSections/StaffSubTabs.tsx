

export interface StaffSubTabsProps {
  activeSubTab: 'tasks' | 'scheduler';
  setActiveSubTab: React.Dispatch<React.SetStateAction<'tasks' | 'scheduler'>>;
  tasks: any;
}

export function StaffSubTabs({ activeSubTab, setActiveSubTab, tasks }: StaffSubTabsProps) {
  return (
    <>
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
    </>
  );
}
