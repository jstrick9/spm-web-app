import React, { useState } from 'react';
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
import { sdk } from '../../../sdk';
import type { SdkEventQuestion } from '../../../sdk/types';
import { Plus, Trash2 } from 'lucide-react';

const formSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
  groupName: z.string().min(1, 'Group name is required'),
  answerType: z.enum(['text', 'integer', 'dropdown', 'date', 'boolean', 'multiselect']),
  required: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  question: SdkEventQuestion | null;
  existingGroups: string[];
}

export function QuestionFormDialog({ open, onOpenChange, orgId, question, existingGroups }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!question;

  let initOptions: string[] = [];
  if (question?.options) {
    try { initOptions = JSON.parse(question.options); } catch {}
  }
  const [options, setOptions] = useState<string[]>(initOptions);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: question?.question || '',
      groupName: question?.group_name || existingGroups[0] || 'General',
      answerType: question?.answer_type || 'text',
      required: question?.required === 1,
    },
  });

  const answerType = form.watch('answerType');
  const needsOptions = answerType === 'dropdown' || answerType === 'multiselect';

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        question: values.question,
        groupName: values.groupName,
        answerType: values.answerType,
        required: values.required,
        options: needsOptions ? options.filter(o => o.trim()) : [],
        sortOrder: question?.sort_order || 0
      };

      if (isEdit) {
        return sdk.questions.update(question!.id, payload);
      } else {
        return sdk.questions.create(orgId, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', orgId] });
      toast({ title: isEdit ? 'Question updated' : 'Question added', variant: 'success' });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Question' : 'New Question'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-5">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Prompt *</FormLabel>
                  <FormControl><Input placeholder="e.g., Will you require early load-in?" {...field} autoFocus /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="groupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Category *</FormLabel>
                      <FormControl>
                        <Input list="group-suggestions" placeholder="Logistics" {...field} />
                      </FormControl>
                      <datalist id="group-suggestions">
                        {existingGroups.map(g => <option key={g} value={g} />)}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
               <FormField
                  control={form.control}
                  name="answerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Answer Format</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Short Text</SelectItem>
                          <SelectItem value="integer">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="boolean">Yes / No</SelectItem>
                          <SelectItem value="dropdown">Dropdown (Single)</SelectItem>
                          <SelectItem value="multiselect">Checkboxes (Multiple)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="flex items-center gap-2">
               <FormField
                  control={form.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input type="checkbox" checked={field.value} onChange={field.onChange} className="rounded border-border text-brand focus:ring-brand" />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Response is required</FormLabel>
                    </FormItem>
                  )}
                />
            </div>

            {needsOptions && (
               <div className="space-y-3 pt-4 border-t border-border">
                  <FormLabel>Selection Options</FormLabel>
                  {options.map((opt, idx) => (
                     <div key={idx} className="flex gap-2">
                        <Input 
                           value={opt} 
                           onChange={(e) => {
                              const newOpts = [...options];
                              newOpts[idx] = e.target.value;
                              setOptions(newOpts);
                           }} 
                           placeholder={`Option ${idx + 1}`}
                        />
                        <Button type="button" variant="ghost" size="icon" className="text-danger shrink-0" onClick={() => setOptions(options.filter((_, i) => i !== idx))}>
                           <Trash2 className="w-4 h-4" />
                        </Button>
                     </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ''])} className="w-full border-dashed">
                     <Plus className="w-4 h-4 mr-1" /> Add Option
                  </Button>
               </div>
            )}

            <DialogFooter className="pt-4 mt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Question'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
