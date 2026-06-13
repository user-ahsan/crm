'use client';

import { useState, useCallback } from 'react';
import type { TeamMember, TeamRole } from '@/types/team.types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { RoleBadge } from '@/components/teams/RoleBadge';
import { IconUsers, IconTrash, IconChevronDown } from '@tabler/icons-react';
import { getInitials, formatDate } from '@/lib/formatters';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface TeamMemberListProps {
  members: TeamMember[];
  currentUserId: string;
  onRoleChange: (memberId: string, role: TeamRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  isAdmin: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const ROLES: TeamRole[] = ['admin', 'manager', 'agent', 'viewer'];

export function TeamMemberList({
  members,
  currentUserId,
  onRoleChange,
  onRemove,
  isAdmin,
  loading = false,
  error = null,
  onRetry,
}: TeamMemberListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRoleChange = useCallback(
    async (memberId: string, role: TeamRole) => {
      setRoleChangeLoading(memberId);
      setActionError(null);
      try {
        await onRoleChange(memberId, role);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Failed to change role');
      } finally {
        setRoleChangeLoading(null);
      }
    },
    [onRoleChange],
  );

  const handleRemoveConfirm = useCallback(async () => {
    if (!confirmRemoveId) return;
    setRemovingId(confirmRemoveId);
    setActionError(null);
    try {
      await onRemove(confirmRemoveId);
      setConfirmRemoveId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  }, [confirmRemoveId, onRemove]);

  const canRemove = useCallback(
    (member: TeamMember): boolean => {
      if (!isAdmin) return false;
      // Cannot remove self
      if (member.userId === currentUserId) return false;
      // Cannot remove the last admin
      if (member.role === 'admin') {
        const adminCount = members.filter((m) => m.role === 'admin').length;
        if (adminCount <= 1) return false;
      }
      return true;
    },
    [isAdmin, currentUserId, members],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4 border-b pb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load members"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers size={48} stroke={1.5} />}
        title="No members yet"
        description="Invite team members to start collaborating."
      />
    );
  }

  const confirmMember = confirmRemoveId
    ? members.find((m) => m.id === confirmRemoveId)
    : null;

  return (
    <div className="space-y-3">
      {actionError && (
        <div
          className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const displayName = member.user?.name ?? 'Unknown User';
              const email = member.user?.email ?? '';
              const isSelf = member.userId === currentUserId;
              const canModifyRole =
                isAdmin &&
                !(member.role === 'admin' && members.filter((m) => m.role === 'admin').length <= 1);

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{displayName}</span>
                        {isSelf && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            You
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {email}
                  </TableCell>
                  <TableCell>
                    {isAdmin && canModifyRole ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={roleChangeLoading === member.id}
                            className="gap-1"
                          >
                            <RoleBadge role={member.role} size="sm" />
                            <IconChevronDown size={12} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {ROLES.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              disabled={role === member.role}
                              onSelect={() => handleRoleChange(member.id, role)}
                            >
                              <RoleBadge role={role} size="sm" />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <RoleBadge role={member.role} size="sm" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          !canRemove(member) || removingId === member.id
                        }
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Remove ${displayName}`}
                      >
                        {removingId === member.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconTrash size={16} />
                        )}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!confirmRemoveId}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveId(null);
        }}
        title="Remove Team Member"
        description={
          confirmMember
            ? `Are you sure you want to remove ${confirmMember.user?.name ?? 'this member'} from the team? This action cannot be undone.`
            : 'Are you sure you want to remove this member?'
        }
        onConfirm={handleRemoveConfirm}
        confirmLabel="Remove"
        variant="destructive"
      />
    </div>
  );
}

export default TeamMemberList;
