import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/Select';
import { useToast } from '../../../ui/Toast';
import { usePrompt } from '../../../ui/usePrompt';
import { staffSdk } from '../../../sdk/staff';
import type { SdkStaffTask } from '../../../sdk/types';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  phase: z.enum(['pre-event', 'during-event', 'post-event']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedMinutesStr: z.string().optional(),
  assigneeName: z.string().optional(),
  assigneePhone: z.string().optional(),
  assigneeEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  organizationId: string;
  task: SdkStaffTask | null;
}

export function StaffTaskFormDialog({ open, onOpenChange, eventId, organizationId, task }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!task;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      phase: task?.phase || 'during-event',
      priority: task?.priority || 'medium',
      estimatedMinutesStr: task?.estimated_minutes ? String(task.estimated_minutes) : '',
      assigneeName: task?.assignee_name || '',
      assigneePhone: task?.assignee_phone || '',
      assigneeEmail: task?.assignee_email || '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const estimatedMinutes = values.estimatedMinutesStr ? parseInt(values.estimatedMinutesStr, 10) : undefined;
      
      const payload = {
        title: values.title,
        description: values.description,
        phase: values.phase,
        priority: values.priority,
        estimatedMinutes,
        assigneeName: values.assigneeName || undefined,
        assigneePhone: values.assigneePhone || undefined,
        assigneeEmail: values.assigneeEmail || undefined,
        eventId,
      };

      if (isEdit) {
        return staffSdk.updateTask(task!.id, payload);
      } else {
        return staffSdk.createTask(organizationId, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staffTasks', eventId] });
      toast({ title: isEdit ? 'Task updated' : 'Task added', variant: 'success' });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save task', description: e.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => staffSdk.deleteTask(task!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staffTasks', eventId] });
      toast({ title: 'Task deleted', variant: 'success' });
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {promptNode}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Staff Task'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title *</FormLabel>
                  <FormControl><Input placeholder="e.g., Setup Archway" {...field} autoFocus /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Instructions</FormLabel>
                  <FormControl>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Detailed breakdown..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-fg">Day-of contact</h3>
                <p className="text-[11px] text-fg-muted mt-0.5">Optional but recommended. These fields power quick call/SMS actions on run sheets and staff command center.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="assigneeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact name</FormLabel>
                      <FormControl><Input placeholder="Setup Lead" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigneePhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone / SMS</FormLabel>
                      <FormControl><Input placeholder="555-210-1001" inputMode="tel" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigneeEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="lead@example.com" type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Phase</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pre-event">Pre-Event Prep</SelectItem>
                        <SelectItem value="during-event">Day-Of Execution</SelectItem>
                        <SelectItem value="post-event">Post-Event Teardown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4 mt-2 border-t flex justify-between items-center w-full">
              {isEdit ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={async () => { if (await askConfirm({ title: 'Delete this task?', destructive: true })) deleteMutation.mutate(); }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              ) : <div></div>}
              
              <div className="flex gap-2">
                 <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                 <Button type="submit" disabled={mutation.isPending}>
                   {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
                 </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
