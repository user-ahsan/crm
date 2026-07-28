'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { integrations, loading, error, reload, disconnect, toggleSync } = useIntegrations();

  const [disconnectTarget, setDisconnectTarget] = useState<CalendarIntegration | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleGoogleOAuth = () => {
    window.location.href = '/api/integrations/google/oauth';
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      // For Google integrations, call the disconnect API which handles token revocation
      if (disconnectTarget.provider === 'google') {
        const res = await fetch('/api/integrations/google/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId: disconnectTarget.id }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? 'Failed to disconnect');
        }
      } else {
        await disconnect(disconnectTarget.id);
      }
      toast.success(`${PROVIDER_META[disconnectTarget.provider].label} disconnected`);
      setDisconnectTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
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

  // Handle OAuth callback query params
  const handleOAuthCallback = useCallback(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    const oauthEmail = searchParams.get('oauth_email');

    if (oauthSuccess === 'true') {
      toast.success(
        oauthEmail
          ? `Google Calendar (${oauthEmail}) connected successfully`
          : 'Google Calendar connected successfully',
      );
      reload();
      // Clean up the URL params
      router.replace('/settings/integrations');
    }

    if (oauthError) {
      switch (oauthError) {
        case 'access_denied':
          toast.error('Google Calendar access was denied. Please try again.');
          break;
        case 'unauthenticated':
          toast.error('You must be logged in to connect a calendar.');
          break;
        case 'state_mismatch':
          toast.error('Session mismatch. Please try connecting again.');
          break;
        case 'missing_auth_code':
          toast.error('No authorization code received from Google.');
          break;
        default:
          toast.error(
            oauthError.length > 80
              ? 'Failed to connect Google Calendar'
              : `Failed to connect: ${oauthError}`,
          );
      }
      router.replace('/settings/integrations');
    }
  }, [searchParams, reload, router]);

  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

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
          <Button onClick={handleGoogleOAuth}>
            <IconBrandGoogle className="mr-2 size-4" />
            Connect Google Calendar
          </Button>
          <Button variant="outline" disabled title="Outlook Calendar coming soon">
            <IconBrandOffice className="mr-2 size-4" />
            Connect Outlook Calendar
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your calendar sync connections. Click &ldquo;Connect Google Calendar&rdquo; to authorize via OAuth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <EmptyState
              title="No connected accounts"
              description="Connect a calendar to sync events and availability."
              action={{ label: 'Connect Google Calendar', onClick: handleGoogleOAuth }}
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
                        <label htmlFor={`sync-${integration.id}`} className="text-xs text-muted-foreground cursor-pointer">
                          Sync
                        </label>
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

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectTarget} onOpenChange={(open: boolean) => { if (!open) setDisconnectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect {disconnectTarget?.email}? Calendar events will no longer sync
              {disconnectTarget?.provider === 'google' ? ' and Google access will be revoked' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
