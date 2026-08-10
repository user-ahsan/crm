'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskFormData, TaskPriority, RelatedEntityType } from '@/types/task.types';
import { useTasks } from '@/hooks/useTasks';
import { useLeads } from '@/hooks/useLeads';
import { useContacts } from '@/hooks/useContacts';
import { useCompanies } from '@/hooks/useCompanies';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USERS } from '@/data/mock-users';
import { TASK_PRIORITIES } from '@/lib/constants';
import { toast } from 'sonner';
import { IconLoader2 } from '@tabler/icons-react';

interface TaskCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultRelatedToType?: RelatedEntityType;
  defaultRelatedToId?: string;
  /** When set, the form prefills from this task and calls updateTask instead of createTask. */
  editTask?: Task;
}

interface FormErrors {
  title?: string;
  dueDate?: string;
}

const RELATED_ENTITY_OPTIONS: { value: RelatedEntityType; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/**
 * Format a Date as a local wall-time string for datetime-local inputs.
 * NEVER use toISOString() — it shifts by UTC offset.
 */
function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function TaskCreateForm({
  open,
  onOpenChange,
  onSuccess,
  defaultRelatedToType,
  defaultRelatedToId,
  editTask,
}: TaskCreateFormProps) {
  const { createTask, updateTask } = useTasks();
  const { leads } = useLeads();
  const { contacts } = useContacts();
  const { companies } = useCompanies();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [title, setTitle] = useState(editTask?.title ?? '');
  const [description, setDescription] = useState(editTask?.description ?? '');
  const [relatedToType, setRelatedToType] = useState<RelatedEntityType | ''>(
    editTask?.relatedToType ?? defaultRelatedToType ?? ''
  );
  const [relatedToId, setRelatedToId] = useState(editTask?.relatedToId ?? defaultRelatedToId ?? '');
  const [assignedTo, setAssignedTo] = useState(editTask?.assignedTo ?? '');
  const [dueDate, setDueDate] = useState(
    editTask?.dueDate ? formatLocalDateTime(new Date(editTask.dueDate)) : ''
  );
  const [priority, setPriority] = useState<TaskPriority | ''>(editTask?.priority ?? 'medium');

  // Sync form state when editTask changes (e.g., switching between editing different tasks)
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? '');
      setRelatedToType(editTask.relatedToType ?? '');
      setRelatedToId(editTask.relatedToId ?? '');
      setAssignedTo(editTask.assignedTo ?? '');
      setDueDate(editTask.dueDate ? formatLocalDateTime(new Date(editTask.dueDate)) : '');
      setPriority(editTask.priority ?? 'medium');
      setErrors({});
    }
  }, [editTask]);

  // Reset form fields
  const resetForm = useCallback(() => {
    setTitle(editTask?.title ?? '');
    setDescription(editTask?.description ?? '');
    setRelatedToType(editTask?.relatedToType ?? defaultRelatedToType ?? '');
    setRelatedToId(editTask?.relatedToId ?? defaultRelatedToId ?? '');
    setAssignedTo(editTask?.assignedTo ?? '');
    setDueDate(editTask?.dueDate ? formatLocalDateTime(new Date(editTask.dueDate)) : '');
    setPriority(editTask?.priority ?? 'medium');
    setErrors({});
  }, [editTask, defaultRelatedToType, defaultRelatedToId]);

  // Clear relatedToId when type changes to prevent dangling references
  const handleRelatedToTypeChange = useCallback((value: string) => {
    setRelatedToType(value as RelatedEntityType | '');
    setRelatedToId('');
  }, []);

  // Entity picker options based on selected type
  const entityOptions = (() => {
    if (!relatedToType) return [];
    if (relatedToType === 'lead') return leads.map((l) => ({ id: l.id, label: l.fullName }));
    if (relatedToType === 'contact') return contacts.map((c) => ({ id: c.id, label: c.name }));
    if (relatedToType === 'company') return companies.map((c) => ({ id: c.id, label: c.name }));
    return [];
  })();

  // Validate form
  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};

    if (!title.trim()) {
      errs.title = 'Title is required';
    } else if (title.trim().length < 2) {
      errs.title = 'Title must be at least 2 characters';
    } else if (title.trim().length > 200) {
      errs.title = 'Title must be less than 200 characters';
    }

    if (dueDate) {
      const due = new Date(dueDate);
      if (isNaN(due.getTime())) {
        errs.dueDate = 'Invalid date';
      }
    }

    return errs;
  }, [title, dueDate]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationErrors = validate();
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      if (!priority) {
        toast.error('Please select a priority');
        return;
      }

      setSubmitting(true);

      try {
        const formData: TaskFormData = {
          title: title.trim(),
          description: description.trim() || undefined,
          relatedToType: relatedToType ? (relatedToType as RelatedEntityType) : undefined,
          relatedToId: relatedToId.trim() || undefined,
          assignedTo: assignedTo || undefined,
          dueDate: dueDate || undefined,
          priority: priority as TaskPriority,
        };

        let result: Task | undefined;

        if (editTask) {
          result = await updateTask(editTask.id, formData);
          if (result) {
            toast.success('Task updated successfully');
          }
        } else {
          result = await createTask(formData);
          if (result) {
            toast.success('Task created successfully');
          }
        }

        if (result) {
          resetForm();
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(
            editTask
              ? 'Failed to update task. Please try again.'
              : 'Failed to create task. Please try again.'
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      title,
      description,
      relatedToType,
      relatedToId,
      assignedTo,
      dueDate,
      priority,
      validate,
      editTask,
      createTask,
      updateTask,
      resetForm,
      onOpenChange,
      onSuccess,
    ]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetForm]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>
            {editTask ? 'Update the task details below' : 'Add a new task to track your work items'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Enter task title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              aria-invalid={!!errors.title}
              disabled={submitting}
              autoFocus
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value: string | null) => { if (value) setPriority(value as TaskPriority); }}
              disabled={submitting}
            >
              <SelectTrigger id="task-priority" className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-assigned">Assigned to</Label>
            <Select
              value={assignedTo}
              onValueChange={(value: string | null) => {
                if (value === 'unassigned') setAssignedTo('');
                else if (value !== null) setAssignedTo(value);
              }}
              disabled={submitting}
            >
              <SelectTrigger id="task-assigned" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due-date">Due date</Label>
            <Input
              id="task-due-date"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: undefined }));
              }}
              aria-invalid={!!errors.dueDate}
              disabled={submitting}
            />
            {errors.dueDate && (
              <p className="text-xs text-destructive">{errors.dueDate}</p>
            )}
          </div>

          {/* Related To Type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-related-type">Related to</Label>
            <Select
              value={relatedToType}
              onValueChange={handleRelatedToTypeChange}
              disabled={submitting}
            >
              <SelectTrigger id="task-related-type" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {RELATED_ENTITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Related To ID — only shown when relatedToType is set */}
          {relatedToType && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-related-id">
                {relatedToType === 'lead'
                  ? 'Lead'
                  : relatedToType === 'contact'
                  ? 'Contact'
                  : 'Company'}
              </Label>
              <Select
                value={relatedToId}
                onValueChange={(value: string | null) => setRelatedToId(value ?? '')}
                disabled={submitting}
              >
                <SelectTrigger id="task-related-id" className="w-full">
                  <SelectValue placeholder={`Select a ${relatedToType}`} />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.length > 0 ? (
                    entityOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>
                      No {relatedToType}s available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="mt-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <IconLoader2 size={14} className="animate-spin" />
              )}
              {submitting
                ? editTask
                  ? 'Updating...'
                  : 'Creating...'
                : editTask
                  ? 'Update Task'
                  : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
