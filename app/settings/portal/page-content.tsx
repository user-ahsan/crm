'use client';

import { useState } from 'react';
import { IconWorld, IconUserPlus, IconTrash, IconEye, IconLink } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { PortalUser, PortalShare } from '@/types/portal.types';
import { usePortalUsers, usePortalShares } from '@/hooks/usePortal';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SHARE_TYPES = ['lead', 'deal', 'quote', 'ticket'] as const;
const PERMISSION_LEVELS = ['view', 'comment', 'edit'] as const;

export default function PortalSettingsPage() {
  const { users, loading, error, reload, createUser, toggleActive, deleteUser } = usePortalUsers();
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { shares, loading: sharesLoading, shareRecord, removeShare } = usePortalShares(selectedUserId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');

  const [shareOpen, setShareOpen] = useState(false);
  const [shareType, setShareType] = useState<string>('lead');
  const [shareId, setShareId] = useState('');
  const [sharePermission, setSharePermission] = useState('view');

  const [deleteTarget, setDeleteTarget] = useState<PortalUser | null>(null);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePassword.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await createUser({ name: inviteName.trim(), email: inviteEmail.trim(), password: invitePassword });
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteOpen(false);
      toast.success('Portal user invited');
    } catch {
      toast.error('Failed to invite user');
    }
  };

  const handleToggleActive = async (user: PortalUser) => {
    try {
      await toggleActive(user.id, !user.active);
      toast.success(user.active ? 'User deactivated' : 'User activated');
    } catch {
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      if (selectedUserId === deleteTarget.id) setSelectedUserId(null);
      toast.success('Portal user deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const handleShareRecord = async () => {
    if (!shareId.trim() || !selectedUserId) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await shareRecord({ portalUserId: selectedUserId, relatedToType: shareType, relatedToId: shareId.trim(), permission: sharePermission });
      setShareId('');
      setShareOpen(false);
      toast.success('Record shared');
    } catch {
      toast.error('Failed to share record');
    }
  };

  const handleRemoveShare = async (share: PortalShare) => {
    try {
      await removeShare(share.id);
      toast.success('Share removed');
    } catch {
      toast.error('Failed to remove share');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer Portal" description="Manage portal access and sharing" />
        <LoadingSkeleton type="table" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer Portal" description="Manage portal access and sharing" />
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Portal" description="Manage portal access and sharing" />

      {/* Portal Toggle Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconWorld className="size-5 text-muted-foreground" />
            <CardTitle>Portal Status</CardTitle>
          </div>
          <CardDescription>
            Enable or disable the customer portal for your users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="portal-toggle">Enable Customer Portal</Label>
              <p className="text-xs text-muted-foreground">
                Allow customers to view their records and collaborate.
              </p>
            </div>
            <Switch
              id="portal-toggle"
              checked={portalEnabled}
              onCheckedChange={setPortalEnabled}
            />
          </div>
          {portalEnabled && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <IconLink className="size-4 text-muted-foreground" />
              <code className="text-sm">https://crm.example.com/portal</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portal Users Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Portal Users</CardTitle>
              <CardDescription>
                Manage who can access the customer portal.
              </CardDescription>
            </div>
            <Button onClick={() => setInviteOpen(true)}>
              <IconUserPlus className="mr-2 size-4" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              title="No portal users"
              description="Invite users to give them access to the customer portal."
              action={{ label: 'Invite User', onClick: () => setInviteOpen(true) }}
            />
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant={user.active ? 'default' : 'secondary'} className="text-xs">
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.lastLogin
                          ? `Last login ${new Date(user.lastLogin).toLocaleDateString()}`
                          : 'Never logged in'}
                        {' · '}Created {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={user.active}
                      onCheckedChange={() => handleToggleActive(user)}
                    />
                    <Button
                      variant={selectedUserId === user.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedUserId(selectedUserId === user.id ? null : user.id)}
                    >
                      <IconEye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(user)}
                      className="text-destructive hover:text-destructive"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shared Records Section */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Shared Records</CardTitle>
                <CardDescription>
                  Records shared with {selectedUser.name}.
                </CardDescription>
              </div>
              <Button onClick={() => setShareOpen(true)}>
                Share Record
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sharesLoading ? (
              <LoadingSkeleton type="list" count={2} />
            ) : shares.length === 0 ? (
              <EmptyState
                title="No shared records"
                description="Share records to give this user access."
                action={{ label: 'Share Record', onClick: () => setShareOpen(true) }}
              />
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs uppercase">{share.relatedToType}</Badge>
                        <code className="text-xs font-mono text-muted-foreground">{share.relatedToId}</code>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {share.permission}
                        </Badge>
                        <span>Shared {new Date(share.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveShare(share)}
                      className="text-destructive hover:text-destructive"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Portal User</DialogTitle>
            <DialogDescription>
              Create a new portal user account. The user will use these credentials to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input id="invite-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Doe" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Password</Label>
              <Input id="invite-password" type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Set a temporary password" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite}>Send Invite</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Record Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Record</DialogTitle>
            <DialogDescription>
              Share a record with {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="share-type">Record Type</Label>
              <Select value={shareType} onValueChange={(v: string | null) => { if (v !== null) setShareType(v); }}>
                <SelectTrigger id="share-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-id">Record ID</Label>
              <Input id="share-id" value={shareId} onChange={(e) => setShareId(e.target.value)} placeholder="e.g. lead-abc123" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-permission">Permission</Label>
              <Select value={sharePermission} onValueChange={(v: string | null) => { if (v !== null) setSharePermission(v); }}>
                <SelectTrigger id="share-permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_LEVELS.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
              <Button onClick={handleShareRecord}>Share</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portal User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This will revoke all portal access and remove all shared records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
