'use client';

import { useState, useCallback } from 'react';
import type { Team, TeamFormData } from '@/types/team.types';
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
import { toast } from 'sonner';
import { IconUsersGroup } from '@tabler/icons-react';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeam: (data: TeamFormData) => Promise<Team | undefined>;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onCreateTeam,
}: CreateTeamDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
  }>({});

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setError(null);
    setFieldErrors({});
  }, []);

  const validate = useCallback((): boolean => {
    const errors: { name?: string } = {};
    if (!name.trim()) {
      errors.name = 'Team name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Team name must be at least 2 characters';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreateTeam({ name: name.trim(), description: description.trim() || undefined });
      toast.success('Team created successfully');
      resetForm();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  }, [name, description, onCreateTeam, validate, resetForm, onOpenChange]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetForm],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team to start collaborating with your team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team Name Field */}
          <div className="space-y-1.5">
            <Label htmlFor="create-team-name">Team Name</Label>
            <Input
              id="create-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter team name"
              disabled={submitting}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'create-team-name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="create-team-name-error" className="text-xs text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <Label htmlFor="create-team-description">Description (optional)</Label>
            <Textarea
              id="create-team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your team"
              disabled={submitting}
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <IconUsersGroup size={16} className="mr-1.5" />
                Create Team
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTeamDialog;
