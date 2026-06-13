'use client';

import { useState, useCallback } from 'react';
import type { Meeting, MeetingFormData, MeetingType } from '@/types/meeting.types';
import { useMeetings } from '@/hooks/useMeetings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
import { MEETING_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import { IconLoader2, IconX, IconUserPlus } from '@tabler/icons-react';

interface MeetingCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (meeting: Meeting) => void;
  editMeeting?: Meeting;
  defaultDate?: string;
}

interface FormErrors {
  title?: string;
  dateTime?: string;
  duration?: string;
}

const RELATED_ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const TYPE_LABELS: Record<MeetingType, string> = {
  online: 'Online',
  offline: 'Offline',
  call: 'Call',
};

function getDefaultDateTime(): string {
  const now = new Date();
  // Round to next hour
  now.setHours(now.getHours() + 1, 0, 0, 0);
  return now.toISOString().slice(0, 16);
}

export function MeetingCreateForm({
  open,
  onOpenChange,
  onSuccess,
  editMeeting,
  defaultDate,
}: MeetingCreateFormProps) {
  const { createMeeting, updateMeeting } = useMeetings();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [title, setTitle] = useState(editMeeting?.title ?? '');
  const [dateTime, setDateTime] = useState(
    editMeeting?.dateTime
      ? new Date(editMeeting.dateTime).toISOString().slice(0, 16)
      : defaultDate
        ? new Date(defaultDate).toISOString().slice(0, 16)
        : getDefaultDateTime()
  );
  const [duration, setDuration] = useState(editMeeting?.duration ?? 30);
  const [type, setType] = useState<MeetingType>(editMeeting?.type ?? 'online');
  const [relatedToType, setRelatedToType] = useState(editMeeting?.relatedToType ?? '');
  const [relatedToId, setRelatedToId] = useState(editMeeting?.relatedToId ?? '');
  const [participants, setParticipants] = useState<string[]>(
    editMeeting?.participants ?? []
  );
  const [participantInput, setParticipantInput] = useState('');
  const [notes, setNotes] = useState(editMeeting?.notes ?? '');
  const [customDuration, setCustomDuration] = useState(
    editMeeting && ![15, 30, 45, 60, 90, 120].includes(editMeeting.duration)
      ? editMeeting.duration
      : 0
  );
  const [useCustomDuration, setUseCustomDuration] = useState(
    editMeeting ? ![15, 30, 45, 60, 90, 120].includes(editMeeting.duration) : false
  );

  // Reset form
  const resetForm = useCallback(() => {
    setTitle(editMeeting?.title ?? '');
    setDateTime(
      editMeeting?.dateTime
        ? new Date(editMeeting.dateTime).toISOString().slice(0, 16)
        : defaultDate
          ? new Date(defaultDate).toISOString().slice(0, 16)
          : getDefaultDateTime()
    );
    setDuration(editMeeting?.duration ?? 30);
    setType(editMeeting?.type ?? 'online');
    setRelatedToType(editMeeting?.relatedToType ?? '');
    setRelatedToId(editMeeting?.relatedToId ?? '');
    setParticipants(editMeeting?.participants ?? []);
    setParticipantInput('');
    setNotes(editMeeting?.notes ?? '');
    setCustomDuration(0);
    setUseCustomDuration(false);
    setErrors({});
  }, [editMeeting, defaultDate]);

  // Validation
  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};

    if (!title.trim()) {
      errs.title = 'Title is required';
    } else if (title.trim().length < 2) {
      errs.title = 'Title must be at least 2 characters';
    } else if (title.trim().length > 200) {
      errs.title = 'Title must be less than 200 characters';
    }

    if (!dateTime) {
      errs.dateTime = 'Date and time is required';
    } else {
      const parsed = new Date(dateTime);
      if (isNaN(parsed.getTime())) {
        errs.dateTime = 'Invalid date and time';
      }
    }

    const effectiveDuration = useCustomDuration ? customDuration : duration;
    if (effectiveDuration <= 0) {
      errs.duration = 'Duration must be greater than 0';
    } else if (effectiveDuration > 1440) {
      errs.duration = 'Duration cannot exceed 24 hours';
    }

    return errs;
  }, [title, dateTime, duration, customDuration, useCustomDuration]);

  // Add participant
  const handleAddParticipant = useCallback(() => {
    const name = participantInput.trim();
    if (!name) return;
    if (participants.includes(name)) {
      toast.error('Participant already added');
      return;
    }
    setParticipants((prev) => [...prev, name]);
    setParticipantInput('');
  }, [participantInput, participants]);

  const handleParticipantKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddParticipant();
      }
    },
    [handleAddParticipant]
  );

  const handleRemoveParticipant = useCallback((index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Duration selection
  const handleDurationPreset = useCallback((preset: number) => {
    setDuration(preset);
    setUseCustomDuration(false);
    setCustomDuration(0);
  }, []);

  // Submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationErrors = validate();
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      const effectiveDuration = useCustomDuration ? customDuration : duration;

      setSubmitting(true);

      try {
        const formData: MeetingFormData = {
          title: title.trim(),
          dateTime: new Date(dateTime).toISOString(),
          duration: effectiveDuration,
          type,
          participants,
          relatedToType: relatedToType || undefined,
          relatedToId: relatedToId.trim() || undefined,
          notes: notes.trim() || undefined,
        };

        let result: Meeting | undefined;

        if (editMeeting) {
          result = updateMeeting(editMeeting.id, formData);
          if (result) {
            toast.success('Meeting updated successfully');
          }
        } else {
          result = createMeeting(formData);
          if (result) {
            toast.success('Meeting created successfully');
          }
        }

        if (result) {
          resetForm();
          onOpenChange(false);
          onSuccess?.(result);
        } else {
          toast.error(
            editMeeting
              ? 'Failed to update meeting. Please try again.'
              : 'Failed to create meeting. Please try again.'
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      title,
      dateTime,
      duration,
      customDuration,
      useCustomDuration,
      type,
      participants,
      relatedToType,
      relatedToId,
      notes,
      editMeeting,
      validate,
      createMeeting,
      updateMeeting,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle>
          <DialogDescription>
            {editMeeting
              ? 'Update the meeting details below'
              : 'Fill in the details to schedule a new meeting'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="meeting-title"
              placeholder="Enter meeting title"
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

          {/* Date & Time + Duration row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date Time */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-datetime">
                Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meeting-datetime"
                type="datetime-local"
                value={dateTime}
                onChange={(e) => {
                  setDateTime(e.target.value);
                  if (errors.dateTime)
                    setErrors((prev) => ({ ...prev, dateTime: undefined }));
                }}
                aria-invalid={!!errors.dateTime}
                disabled={submitting}
              />
              {errors.dateTime && (
                <p className="text-xs text-destructive">{errors.dateTime}</p>
              )}
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-duration">Duration (minutes)</Label>
              <div className="flex flex-wrap gap-1">
                {DURATION_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={
                      !useCustomDuration && duration === preset ? 'default' : 'outline'
                    }
                    size="xs"
                    onClick={() => handleDurationPreset(preset)}
                    disabled={submitting}
                  >
                    {preset}m
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={useCustomDuration ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setUseCustomDuration(true)}
                  disabled={submitting}
                >
                  Custom
                </Button>
              </div>
              {useCustomDuration && (
                <div className="mt-1">
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    placeholder="Minutes"
                    value={customDuration || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCustomDuration(isNaN(val) ? 0 : val);
                      if (errors.duration)
                        setErrors((prev) => ({ ...prev, duration: undefined }));
                    }}
                    aria-invalid={!!errors.duration}
                    disabled={submitting}
                    className="h-8 text-xs"
                  />
                </div>
              )}
              {errors.duration && (
                <p className="text-xs text-destructive">{errors.duration}</p>
              )}
            </div>
          </div>

          {/* Type + Related To row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value: string | null) => { if (value) setType(value as MeetingType); }}
                disabled={submitting}
              >
                <SelectTrigger id="meeting-type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Related To Type */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-related-type">Related to</Label>
              <Select
                value={relatedToType}
                onValueChange={(value: string | null) => { if (value !== null) setRelatedToType(value); }}
                disabled={submitting}
              >
                <SelectTrigger id="meeting-related-type" className="w-full">
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
          </div>

          {/* Related To ID — shown when relatedToType is set */}
          {relatedToType && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-related-id">
                {relatedToType === 'lead'
                  ? 'Lead ID'
                  : relatedToType === 'contact'
                    ? 'Contact ID'
                    : 'Company ID'}
              </Label>
              <Input
                id="meeting-related-id"
                placeholder={`Enter ${relatedToType} ID`}
                value={relatedToId}
                onChange={(e) => setRelatedToId(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          {/* Participants */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-participants">Participants</Label>
            <div className="flex gap-2">
              <Input
                id="meeting-participants"
                placeholder="Add participant name"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleParticipantKeyDown}
                disabled={submitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddParticipant}
                disabled={submitting || !participantInput.trim()}
              >
                <IconUserPlus size={14} />
                Add
              </Button>
            </div>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(i)}
                      className="ml-0.5 inline-flex text-muted-foreground hover:text-foreground"
                      disabled={submitting}
                      aria-label={`Remove ${p}`}
                    >
                      <IconX size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-notes">Notes</Label>
            <Textarea
              id="meeting-notes"
              placeholder="Optional notes or agenda"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          {/* Footer */}
          <DialogFooter className="mt-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <IconLoader2 size={14} className="animate-spin" />}
              {submitting
                ? editMeeting
                  ? 'Updating...'
                  : 'Scheduling...'
                : editMeeting
                  ? 'Update Meeting'
                  : 'Schedule Meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MeetingCreateForm;
