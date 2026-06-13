'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IconLoader2, IconPhone } from '@tabler/icons-react';
import type { CallDirection, CallResult, CallLogFormData } from '@/types/communication.types';

interface CallLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CallLogFormData) => Promise<void>;
}

export function CallLogDialog({ open, onOpenChange, onSubmit }: CallLogDialogProps) {
  const [direction, setDirection] = useState<CallDirection>('inbound');
  const [caller, setCaller] = useState('');
  const [callee, setCallee] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [callResult, setCallResult] = useState<CallResult>('completed');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setDirection('inbound');
    setCaller('');
    setCallee('');
    setDurationMinutes('');
    setDurationSeconds('');
    setCallResult('completed');
    setNotes('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caller.trim() || !callee.trim()) {
      setError('Caller and callee phone numbers are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const minutes = parseInt(durationMinutes, 10) || 0;
      const seconds = parseInt(durationSeconds, 10) || 0;
      const totalDuration = minutes * 60 + seconds;
      await onSubmit({
        direction,
        caller: caller.trim(),
        callee: callee.trim(),
        duration: totalDuration > 0 ? totalDuration : undefined,
        callResult,
        notes: notes.trim() || undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log call');
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetForm();
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <IconPhone className="size-5" />
            Log a Call
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as CallDirection)}>
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callResult">Result</Label>
              <Select value={callResult} onValueChange={(v) => setCallResult(v as CallResult)}>
                <SelectTrigger id="callResult">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="caller">Caller</Label>
            <Input
              id="caller"
              value={caller}
              onChange={(e) => setCaller(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="callee">Callee</Label>
            <Input
              id="callee"
              value={callee}
              onChange={(e) => setCallee(e.target.value)}
              placeholder="+1 (555) 987-6543"
            />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Minutes"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                max={59}
                placeholder="Seconds"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call notes..."
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <IconLoader2 className="size-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Call'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
