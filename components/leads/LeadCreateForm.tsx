'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Lead, LeadFormData, LeadStatus, LeadPriority, LeadSource } from '@/types/lead.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useLeads } from '@/hooks/useLeads';
import { LEAD_SOURCES, LEAD_PRIORITIES, STATUS_COLORS, PRIORITY_COLORS, USERS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { validateLeadForm } from '@/lib/validators';
import { IconX, IconPlus, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';

interface LeadCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (lead: Lead) => void;
  editLead?: Lead;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  estimatedValue?: string;
  source?: string;
  status?: string;
  priority?: string;
}

const defaultFormData: LeadFormData = {
  fullName: '',
  email: '',
  phone: '',
  companyName: '',
  industry: '',
  country: '',
  source: 'manual',
  status: 'new',
  priority: 'medium',
  estimatedValue: 0,
  tags: [],
  notes: '',
};

export function LeadCreateForm({ open, onOpenChange, onSuccess, editLead }: LeadCreateFormProps) {
  const { createLead, updateLead } = useLeads();
  const [formData, setFormData] = useState<LeadFormData>(defaultFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!editLead;

  // Reset form when dialog opens/closes or editLead changes
  useEffect(() => {
    if (open) {
      if (editLead) {
        setFormData({
          fullName: editLead.fullName,
          email: editLead.email ?? '',
          phone: editLead.phone ?? '',
          companyName: editLead.companyName ?? '',
          industry: editLead.industry ?? '',
          country: editLead.country ?? '',
          source: editLead.source,
          status: editLead.status,
          priority: editLead.priority,
          estimatedValue: editLead.estimatedValue,
          tags: [...editLead.tags],
          notes: editLead.notes ?? '',
        });
      } else {
        setFormData(defaultFormData);
      }
      setErrors({});
      setTagInput('');
      setSubmitting(false);
    }
  }, [open, editLead]);

  const updateField = useCallback(
    <K extends keyof LeadFormData>(field: K, value: LeadFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as keyof FormErrors];
          return next;
        });
      }
    },
    [errors]
  );

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
      setTagInput('');
    }
    tagInputRef.current?.focus();
  }, [tagInput, formData.tags]);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Backspace' && tagInput === '' && formData.tags.length > 0) {
        setFormData((prev) => ({ ...prev, tags: prev.tags.slice(0, -1) }));
      }
    },
    [handleAddTag, tagInput, formData.tags]
  );

  const removeTag = useCallback((tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }, []);

  const validate = useCallback((): boolean => {
    const result = validateLeadForm(formData);
    if (!result.isValid) {
      setErrors(result.errors as FormErrors);
      return false;
    }
    // Extra validation for selects
    const extraErrors: FormErrors = {};
    if (!formData.source) extraErrors.source = 'Source is required';
    if (!formData.status) extraErrors.status = 'Status is required';
    if (!formData.priority) extraErrors.priority = 'Priority is required';
    if (Object.keys(extraErrors).length > 0) {
      setErrors(extraErrors);
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEditMode && editLead) {
        const updated = await updateLead(editLead.id, formData);
        if (updated) {
          toast.success('Lead updated successfully');
          onSuccess?.(updated);
          onOpenChange(false);
        } else {
          toast.error('Failed to update lead');
        }
      } else {
        const created = await createLead(formData);
        if (created) {
          toast.success('Lead created successfully');
          onSuccess?.(created);
          onOpenChange(false);
        } else {
          toast.error('Failed to create lead');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [validate, isEditMode, editLead, formData, createLead, updateLead, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the lead information below.'
              : 'Fill in the details below to add a new lead to your pipeline.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-6 overflow-y-auto px-1">
          {/* Full Name */}
          <div className="grid gap-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              aria-invalid={!!errors.fullName}
              disabled={submitting}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                aria-invalid={!!errors.email}
                disabled={submitting}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                aria-invalid={!!errors.phone}
                disabled={submitting}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Company Name */}
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company</Label>
              <Input
                id="companyName"
                placeholder="Acme Inc."
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Industry */}
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="Technology"
                value={formData.industry}
                onChange={(e) => updateField('industry', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Country */}
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="United States"
                value={formData.country}
                onChange={(e) => updateField('country', e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Source */}
            <div className="grid gap-2">
              <Label htmlFor="source">
                Source <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.source}
                onValueChange={(value: string | null) => { if (value) updateField('source', value as LeadSource); }}
                disabled={submitting}
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.source && (
                <p className="text-xs text-destructive">{errors.source}</p>
              )}
            </div>
          </div>

          {/* Assigned To */}
          <div className="grid gap-2">
            <Label htmlFor="assignedTo">Assigned To</Label>
            <Select
              value={formData.assignedTo ?? ''}
              onValueChange={(value: string | null) => {
                if (value === 'unassigned') {
                  updateField('assignedTo', undefined);
                } else if (value) {
                  updateField('assignedTo', value);
                }
              }}
              disabled={submitting}
            >
              <SelectTrigger id="assignedTo">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block size-2 rounded-full ${user.color}`}
                      />
                      {user.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: string | null) => { if (value) updateField('status', value as LeadStatus); }}
                disabled={submitting}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as LeadStatus[]).map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        <span
                          className={cn(
                            'inline-block rounded px-1.5 py-0.5 text-xs',
                            STATUS_COLORS[status]
                          )}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-xs text-destructive">{errors.status}</p>
              )}
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="priority">
                Priority <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value: string | null) => { if (value) updateField('priority', value as LeadPriority); }}
                disabled={submitting}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      <span
                        className={cn(
                          'inline-block rounded px-1.5 py-0.5 text-xs',
                          PRIORITY_COLORS[priority]
                        )}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.priority && (
                <p className="text-xs text-destructive">{errors.priority}</p>
              )}
            </div>
          </div>

          {/* Estimated Value */}
          <div className="grid gap-2">
            <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
            <Input
              id="estimatedValue"
              type="number"
              min={0}
              placeholder="0"
              value={formData.estimatedValue || ''}
              onChange={(e) =>
                updateField('estimatedValue', Math.max(0, Number(e.target.value)))
              }
              aria-invalid={!!errors.estimatedValue}
              disabled={submitting}
            />
            {errors.estimatedValue && (
              <p className="text-xs text-destructive">{errors.estimatedValue}</p>
            )}
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="tagInput">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-muted transition-colors"
                    aria-label={`Remove tag ${tag}`}
                    disabled={submitting}
                  >
                    <IconX className="size-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                id="tagInput"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={formData.tags.length === 0 ? 'Type and press Enter to add tags' : ''}
                className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={submitting}
              />
              {tagInput.trim() && (
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="inline-flex items-center justify-center rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label="Add tag"
                  disabled={submitting}
                >
                  <IconPlus className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this lead..."
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <IconLoader2 className="size-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
