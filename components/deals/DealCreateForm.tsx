'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Deal, DealFormData, DealStage } from '@/types/deal.types';
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
import { useDeals } from '@/hooks/useDeals';
import { USERS } from '@/lib/constants';
import { IconX, IconPlus, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';

interface DealCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (deal: Deal) => void;
  editDeal?: Deal;
  stages: DealStage[];
}

interface FormErrors {
  title?: string;
  value?: string;
}

const defaultFormData: DealFormData = {
  title: '',
  description: '',
  value: 0,
  currency: 'USD',
  tags: [],
};

export function DealCreateForm({ open, onOpenChange, onSuccess, editDeal, stages }: DealCreateFormProps) {
  const { createDeal, updateDeal } = useDeals();
  const [formData, setFormData] = useState<DealFormData>(defaultFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const isEditMode = !!editDeal;

  useEffect(() => {
    if (open) {
      if (editDeal) {
        setFormData({
          title: editDeal.title,
          description: editDeal.description ?? '',
          value: editDeal.value,
          currency: editDeal.currency,
          stageId: editDeal.stageId,
          leadId: editDeal.leadId,
          contactId: editDeal.contactId,
          companyId: editDeal.companyId,
          assignedTo: editDeal.assignedTo,
          closeDate: editDeal.closeDate,
          tags: [...editDeal.tags],
        });
      } else {
        setFormData(defaultFormData);
      }
      setErrors({});
      setTagInput('');
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [open, editDeal]);

  const updateField = useCallback(
    <K extends keyof DealFormData>(field: K, value: DealFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as keyof FormErrors];
          return next;
        });
      }
    },
    [errors],
  );

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !formData.tags?.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, tags: [...(prev.tags ?? []), trimmed] }));
      setTagInput('');
    }
  }, [tagInput, formData.tags]);

  const removeTag = useCallback((tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags?.filter((t) => t !== tag) ?? [] }));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!formData.title || formData.title.trim().length === 0) {
      errs.title = 'Title is required';
    }
    if (formData.value !== undefined && formData.value < 0) {
      errs.value = 'Value cannot be negative';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEditMode && editDeal) {
        const updated = await updateDeal(editDeal.id, formData);
        if (updated) {
          toast.success('Deal updated successfully');
          onSuccess?.(updated);
          onOpenChange(false);
        } else {
          toast.error('Failed to update deal');
        }
      } else {
        const created = await createDeal(formData);
        if (created) {
          toast.success('Deal created successfully');
          onSuccess?.(created);
          onOpenChange(false);
        } else {
          toast.error('Failed to create deal');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [validate, isEditMode, editDeal, formData, createDeal, updateDeal, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the deal information below.'
              : 'Fill in the details below to add a new deal.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-6 overflow-y-auto px-1">
          <div className="grid gap-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enterprise License Deal"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              aria-invalid={!!errors.title}
              disabled={submitting}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Deal details..."
              value={formData.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="value">Value ($)</Label>
              <Input
                id="value"
                type="number"
                min={0}
                placeholder="0"
                value={formData.value || ''}
                onChange={(e) => updateField('value', Math.max(0, Number(e.target.value)))}
                aria-invalid={!!errors.value}
                disabled={submitting}
              />
              {errors.value && <p className="text-xs text-destructive">{errors.value}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency ?? 'USD'}
                onValueChange={(value: string | null) => { if (value) updateField('currency', value); }}
                disabled={submitting}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="stageId">Stage</Label>
            <Select
              value={formData.stageId ?? ''}
              onValueChange={(value: string | null) => {
                if (value === 'none') updateField('stageId', undefined);
                else if (value) updateField('stageId', value);
              }}
              disabled={submitting}
            >
              <SelectTrigger id="stageId">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No stage</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assignedTo">Assigned To</Label>
            <Select
              value={formData.assignedTo ?? ''}
              onValueChange={(value: string | null) => {
                if (value === 'unassigned') updateField('assignedTo', undefined);
                else if (value) updateField('assignedTo', value);
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
                      <span className={`inline-block size-2 rounded-full ${user.color}`} />
                      {user.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="closeDate">Close Date</Label>
            <Input
              id="closeDate"
              type="date"
              value={formData.closeDate ?? ''}
              onChange={(e) => updateField('closeDate', e.target.value || undefined)}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              {formData.tags?.map((tag) => (
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
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
                  else if (e.key === 'Backspace' && tagInput === '' && formData.tags?.length) {
                    setFormData((prev) => ({ ...prev, tags: prev.tags?.slice(0, -1) ?? [] }));
                  }
                }}
                placeholder={formData.tags?.length === 0 ? 'Type and press Enter to add tags' : ''}
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
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <IconLoader2 className="size-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
