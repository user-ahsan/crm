'use client';

import { useState } from 'react';
import { IconBrandGoogle, IconBrandOffice, IconPlugConnected, IconPlugOff, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { CalendarIntegration, CalendarProvider } from '@/types/integration.types';
import { useIntegrations } from '@/hooks/useIntegrations';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PROVIDER_META: Record<CalendarProvider, { label: string; icon: typeof IconBrandGoogle; color: string }> = {
  google: { label: 'Google Calendar', icon: IconBrandGoogle, color: 'text-red-500' },
  outlook: { label: 'Outlook Calendar', icon: IconBrandOffice, color: 'text-blue-500' },
};

export default function IntegrationsPage() {
  const { integrations, loading, error, reload, connect, disconnect, toggleSync } = useIntegrations();

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<CalendarProvider>('google');
  const [connectEmail, setConnectEmail] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [disconnectTarget, setDisconnectTarget] = useState<CalendarIntegration | null>(null);

  const handleConnect = async () => {
    if (!connectEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setConnecting(true);
    try {
      await connect({ provider: connectProvider, email: connectEmail.trim() });
      setConnectEmail('');
      setConnectDialogOpen(false);
      toast.success(`${PROVIDER_META[connectProvider].label} connected`);
    } catch {
      toast.error('Failed to connect calendar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    try {
      await disconnect(disconnectTarget.id);
      toast.success('Calendar disconnected');
      setDisconnectTarget(null);
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleToggleSync = async (integration: CalendarIntegration) => {
    try {
      await toggleSync(integration.id, !integration.syncEnabled);
      toast.success(integration.syncEnabled ? 'Sync disabled' : 'Sync enabled');
    } catch {
      toast.error('Failed to toggle sync');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" description="Connect external accounts and services" />
        <LoadingSkeleton type="table" count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" description="Connect external accounts and services" />
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect external accounts and services">
        <div className="flex gap-2">
          <Button onClick={() => { setConnectProvider('google'); setConnectDialogOpen(true); }}>
            <IconBrandGoogle className="mr-2 size-4" />
            Connect Google Calendar
          </Button>
          <Button variant="outline" onClick={() => { setConnectProvider('outlook'); setConnectDialogOpen(true); }}>
            <IconBrandOffice className="mr-2 size-4" />
            Connect Outlook Calendar
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your calendar sync connections. Real OAuth would require a backend endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <EmptyState
              title="No connected accounts"
              description="Connect a calendar to sync events and availability."
              action={{ label: 'Connect Google Calendar', onClick: () => { setConnectProvider('google'); setConnectDialogOpen(true); } }}
            />
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => {
                const meta = PROVIDER_META[integration.provider];
                const Icon = meta.icon;
                return (
                  <div key={integration.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`size-8 shrink-0 ${meta.color}`} />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{meta.label}</span>
                          {integration.syncEnabled ? (
                            <IconPlugConnected className="size-4 text-green-500" />
                          ) : (
                            <IconPlugOff className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{integration.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {integration.lastSyncedAt
                            ? `Last synced ${new Date(integration.lastSyncedAt).toLocaleDateString()}`
                            : 'Not synced yet'}
                          {' · '}Connected {new Date(integration.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`sync-${integration.id}`} className="text-xs text-muted-foreground">
                          Sync
                        </Label>
                        <Switch
                          id={`sync-${integration.id}`}
                          checked={integration.syncEnabled}
                          onCheckedChange={() => handleToggleSync(integration)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisconnectTarget(integration)}
                        className="text-destructive hover:text-destructive"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {PROVIDER_META[connectProvider].label}
            </DialogTitle>
            <DialogDescription>
              Enter the email address associated with your {PROVIDER_META[connectProvider].label} account.
              This is a mock connection — real OAuth requires a backend endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="connect-email">Email Address</Label>
              <Input
                id="connect-email"
                type="email"
                value={connectEmail}
                onChange={(e) => setConnectEmail(e.target.value)}
                placeholder="user@gmail.com"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConnect} disabled={connecting}>{connecting ? 'Connecting...' : 'Connect'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectTarget} onOpenChange={(open: boolean) => { if (!open) setDisconnectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect {disconnectTarget?.email}? Calendar events will no longer sync.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
