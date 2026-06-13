'use client';

import { useState, useCallback } from 'react';
import type { Team, TeamFormData } from '@/types/team.types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { IconEdit, IconCheck, IconX } from '@tabler/icons-react';

interface TeamInfoCardProps {
  team: Team | null;
  onUpdate: (data: TeamFormData) => Promise<void>;
  isAdmin: boolean;
  loading?: boolean;
}

export function TeamInfoCard({
  team,
  onUpdate,
  isAdmin,
  loading = false,
}: TeamInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
  }>({});

  const enterEditMode = useCallback(() => {
    if (!team) return;
    setName(team.name);
    setDescription(team.description ?? '');
    setError(null);
    setFieldErrors({});
    setIsEditing(true);
  }, [team]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
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

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({ name: name.trim(), description: description.trim() || undefined });
      toast.success('Team updated successfully');
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update team');
    } finally {
      setSaving(false);
    }
  }, [name, description, onUpdate, validate]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Information</CardTitle>
            <CardDescription>
              View and edit your team details.
            </CardDescription>
          </div>
          {isAdmin && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={enterEditMode}
              aria-label="Edit team info"
            >
              <IconEdit size={16} className="mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      {isEditing ? (
        <>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter team name"
                disabled={saving}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'team-name-error' : undefined}
              />
              {fieldErrors.name && (
                <p id="team-name-error" className="text-xs text-destructive">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your team's purpose (optional)"
                disabled={saving}
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              disabled={saving}
            >
              <IconX size={16} className="mr-1.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <IconCheck size={16} className="mr-1.5" />
                  Save
                </>
              )}
            </Button>
          </CardFooter>
        </>
      ) : (
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Name</p>
            <p className="text-sm font-medium">{team.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Description
            </p>
            <p className="text-sm text-muted-foreground">
              {team.description || (
                <span className="italic">No description</span>
              )}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default TeamInfoCard;
