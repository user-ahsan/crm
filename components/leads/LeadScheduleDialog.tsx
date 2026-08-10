'use client';

import { useCallback, useState } from 'react';
import type { Lead } from '@/types/lead.types';
import type { MeetingType } from '@/types/meeting.types';
import { useMeetings } from '@/hooks/useMeetings';
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
import { MEETING_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import { IconLoader2 } from '@tabler/icons-react';

interface LeadScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The lead the scheduled meeting is linked to. */
  lead: Lead;
  /** Called after a meeting is successfully created. */
  onScheduled?: () => void;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const TYPE_LABELS: Record<MeetingType, string> = {
  online: 'Online',
  offline: 'Offline',
  call: 'Call',
  video: 'Video',
  in_person: 'In Person',
  other: 'Other',
};

interface FormErrors {
  title?: string;
  dateTime?: string;
  duration?: string;
}

function getDefaultDateTime(): string {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  return now.toISOString().slice(0, 16);
}

/**
 * Minimal lead scheduling dialog. Creates a REAL meeting through
 * useMeetings().createMeeting with relatedToType='lead' so the meeting
 * appears on the lead's Meetings tab and in the global meetings list.
 */
export function LeadScheduleDialog({ open, onOpenChange, lead, onScheduled }: LeadScheduleDialogProps) {
  const { createMeeting } = useMeetings();
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState(getDefaultDateTime());
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<MeetingType>('online');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setDateTime(getDefaultDateTime());
    setDuration(30);
    setType('online');
    setNotes('');
    setErrors({});
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetForm();
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    if (!title.trim()) {
      errs.title = 'Title is required';
    } else if (title.trim().length < 2) {
      errs.title = 'Title must be at least 2 characters';
    }
    if (!dateTime) {
      errs.dateTime = 'Date and time is required';
    } else if (isNaN(new Date(dateTime).getTime())) {
      errs.dateTime = 'Invalid date and time';
    }
    if (duration <= 0) {
      errs.duration = 'Duration must be greater than 0';
    }
    return errs;
  }, [title, dateTime, duration]);

  const isFormValid = !submitting && Object.keys(validate()).length === 0;

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const created = await createMeeting({
        title: title.trim(),
        participants: [],
        relatedToType: 'lead',
        relatedToId: lead.id,
        dateTime: new Date(dateTime).toISOString(),
        duration,
        type,
        notes: notes.trim() || undefined,
      });
      if (created) {
        toast.success('Meeting scheduled');
        resetForm();
        onOpenChange(false);
        onScheduled?.();
      } else {
        toast.error('Failed to schedule meeting. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    dateTime,
    duration,
    type,
    notes,
    lead.id,
    validate,
    createMeeting,
    resetForm,
    onOpenChange,
    onScheduled,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Meeting with {lead.fullName}</DialogTitle>
          <DialogDescription>
            Schedule a follow-up meeting. It will be linked to this lead.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-schedule-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lead-schedule-title"
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
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Date & Time + Duration */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-schedule-datetime">
                Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lead-schedule-datetime"
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

            <div className="flex flex-col gap-1.5">
              <Label>Duration (minutes)</Label>
              <div className="flex flex-wrap gap-1">
                {DURATION_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={duration === preset ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => {
                      setDuration(preset);
                      if (errors.duration)
                        setErrors((prev) => ({ ...prev, duration: undefined }));
                    }}
                    disabled={submitting}
                  >
                    {preset}m
                  </Button>
                ))}
              </div>
              {errors.duration && (
                <p className="text-xs text-destructive">{errors.duration}</p>
              )}
            </div>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-schedule-type">Type</Label>
            <Select
              value={type}
              onValueChange={(value: string | null) => {
                if (value) setType(value as MeetingType);
              }}
              disabled={submitting}
            >
              <SelectTrigger id="lead-schedule-type" className="w-full">
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

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-schedule-notes">Notes</Label>
            <Textarea
              id="lead-schedule-notes"
              placeholder="Optional notes or agenda"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
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
          <Button
            onClick={handleSubmit}
            disabled={submitting || !isFormValid}
            title={
              !submitting && !isFormValid
                ? 'Fill in all required fields to schedule'
                : undefined
            }
          >
            {submitting && <IconLoader2 className="mr-2 size-4 animate-spin" />}
            {submitting ? 'Scheduling...' : 'Schedule Meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
