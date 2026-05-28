const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/staff/EventStaffTab.tsx';
let code = fs.readFileSync(path, 'utf8');

// We need to implement HTML5 drag and drop
code = code.replace(
  "const toggleTaskStatus = useMutation({",
  `const updatePhaseMutation = useMutation({
    mutationFn: ({ task, newPhase }: { task: SdkStaffTask, newPhase: any }) => {
      return sdk.staff.updateTask(task.id, { phase: newPhase });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffTasks', eventId] })
  });

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
      // Optimistic update locally
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

  const toggleTaskStatus = useMutation({`
);

// We need to wrap the phase column to support dropping
code = code.replace(
  /className="flex flex-col gap-3">[\s\S]*?<h3 className="font-semibold text-sm/m,
  `className="flex flex-col gap-3 h-full rounded-lg transition-colors border border-transparent"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, phase.id)}
              >
                <h3 className="font-semibold text-sm`
);

// We need to make the tasks draggable
code = code.replace(
  /Card \n                          key=\{task\.id\} \n                          className=\{cn\("cursor-pointer hover:shadow-elev-1 transition-shadow", isCompleted && "opacity-60"\)\}/m,
  `Card 
                          key={task.id} 
                          className={cn("cursor-pointer hover:shadow-elev-1 transition-all active:cursor-grabbing cursor-grab", isCompleted && "opacity-60")}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}`
);

fs.writeFileSync(path, code);
