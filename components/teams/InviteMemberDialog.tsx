'use client';

import { useState, useCallback } from 'react';
import type { InviteMemberFormData, TeamRole } from '@/types/team.types';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { IconUserPlus } from '@tabler/icons-react';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (data: InviteMemberFormData) => Promise<void>;
  isAdmin: boolean;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'agent', label: 'Agent' },
  { value: 'viewer', label: 'Viewer' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteMemberDialog({
  open,
  onOpenChange,
  onInvite,
  isAdmin,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('agent');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    role?: string;
  }>({});

  const resetForm = useCallback(() => {
    setEmail('');
    setRole('agent');
    setError(null);
    setFieldErrors({});
  }, []);

  const validate = useCallback((): boolean => {
    const errors: { email?: string; role?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }
    if (!role) {
      errors.role = 'Role is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [email, role]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
      try {
        await onInvite({ email: email.trim(), role });
        toast.success('Invitation sent successfully');
        resetForm();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send invitation');
      } finally {
      setSubmitting(false);
    }
  }, [email, role, onInvite, validate, resetForm, onOpenChange]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetForm],
  );

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        <Button size="sm">
          <IconUserPlus size={16} className="mr-1.5" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. They will receive an email
            with instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Field */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              disabled={submitting}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'invite-email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="invite-email-error" className="text-xs text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Role Field */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as TeamRole)}
              disabled={submitting}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.role && (
              <p className="text-xs text-destructive">{fieldErrors.role}</p>
            )}
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
                Sending...
              </>
            ) : (
              <>
                <IconUserPlus size={16} className="mr-1.5" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InviteMemberDialog;
