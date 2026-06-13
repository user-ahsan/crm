'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { TeamInfoCard } from '@/components/teams/TeamInfoCard';
import { TeamMemberList } from '@/components/teams/TeamMemberList';
import { InviteMemberDialog } from '@/components/teams/InviteMemberDialog';
import { CreateTeamDialog } from '@/components/teams/CreateTeamDialog';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useTeam } from '@/hooks/useTeam';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { IconUsersGroup, IconX, IconMail, IconClock } from '@tabler/icons-react';
import { formatDate } from '@/lib/formatters';
import type { InviteMemberFormData, TeamRole } from '@/types/team.types';

export default function TeamSettingsPage() {
  const {
    team,
    members,
    invitations,
    currentMember,
    loading,
    error,
    updateTeam,
    inviteMember,
    cancelInvitation,
    changeMemberRole,
    removeMember,
    refresh,
    createTeam,
  } = useTeam();

  const { canManageTeam, role } = usePermissions(currentMember?.role ?? null);
  const isAdmin = canManageTeam();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleInvite = useCallback(
    async (data: InviteMemberFormData) => {
      await inviteMember(data);
    },
    [inviteMember],
  );

  const handleRoleChange = useCallback(
    async (memberId: string, role: TeamRole) => {
      try {
        await changeMemberRole(memberId, role);
        toast.success('Member role updated successfully');
      } catch {
        // Error handled by TeamMemberList (rollback + inline error)
      }
    },
    [changeMemberRole],
  );

  const handleRemove = useCallback(
    async (memberId: string) => {
      try {
        await removeMember(memberId);
        toast.success('Member removed successfully');
      } catch {
        // Error handled by TeamMemberList (rollback + inline error)
      }
    },
    [removeMember],
  );

  const handleCancelInvitation = useCallback(
    async (invitationId: string) => {
      setCancellingId(invitationId);
      setCancelError(null);
      try {
        await cancelInvitation(invitationId);
        toast.success('Invitation cancelled successfully');
      } catch (e) {
        setCancelError(
          e instanceof Error ? e.message : 'Failed to cancel invitation',
        );
      } finally {
        setCancellingId(null);
      }
    },
    [cancelInvitation],
  );

  const currentUserId = currentMember?.userId ?? '';

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Settings"
          description="Manage your team, members, and invitations."
        />
        <LoadingSkeleton type="card" count={1} />
        <LoadingSkeleton type="table" count={1} />
      </div>
    );
  }

  // Error state
  if (error && !team) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Settings"
          description="Manage your team, members, and invitations."
        />
        <ErrorState
          title="Failed to load team"
          message={error}
          onRetry={refresh}
        />
      </div>
    );
  }

  // Empty state — no team exists
  if (!team) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Settings"
          description="Manage your team, members, and invitations."
        />
        <EmptyState
          icon={<IconUsersGroup size={48} stroke={1.5} />}
          title="No team yet"
          description="Create your first team to start collaborating with your team members."
          action={{
            label: 'Create Team',
            onClick: () => setCreateDialogOpen(true),
          }}
        />
        <CreateTeamDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreateTeam={createTeam}
        />
      </div>
    );
  }

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === 'pending',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Settings"
        description="Manage your team, members, and invitations."
      />

      {/* Section 1: Team Info */}
      <section>
        <TeamInfoCard
          team={team}
          onUpdate={updateTeam}
          isAdmin={isAdmin}
        />
      </section>

      <Separator />

      {/* Section 2: Members */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''} in your
              team
            </p>
          </div>
          {isAdmin && (
            <InviteMemberDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              onInvite={handleInvite}
              isAdmin={isAdmin}
            />
          )}
        </div>
        <TeamMemberList
          members={members}
          currentUserId={currentUserId}
          onRoleChange={handleRoleChange}
          onRemove={handleRemove}
          isAdmin={isAdmin}
        />
      </section>

      <Separator />

      {/* Section 3: Pending Invitations */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Pending Invitations</h2>
          <p className="text-sm text-muted-foreground">
            {pendingInvitations.length > 0
              ? `${pendingInvitations.length} invitation${pendingInvitations.length !== 1 ? 's' : ''} waiting for response`
              : 'No pending invitations'}
          </p>
        </div>

        {cancelError && (
          <div
            className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive"
            role="alert"
          >
            {cancelError}
          </div>
        )}

        {pendingInvitations.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center text-center">
                <IconMail
                  size={32}
                  stroke={1.5}
                  className="mb-2 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  No pending invitations. Invite new members to your team.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <Card key={invitation.id} size="sm">
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <IconMail size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Role: {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <IconClock size={12} />
                          Expires {formatDate(invitation.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Pending
                    </Badge>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={cancellingId === invitation.id}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Cancel invitation for ${invitation.email}`}
                      >
                        {cancellingId === invitation.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconX size={16} />
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
