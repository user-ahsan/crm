'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconKey, IconPlus, IconCopy, IconTrash, IconCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { ApiKey } from '@/types/api-key.types';
import { apiKeyService } from '@/services/api-key.service';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
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

const SCOPE_OPTIONS = ['read', 'write', 'admin'] as const;

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success('Copied to clipboard');
  }, () => {
    toast.error('Failed to copy');
  });
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState('read');
  const [createdFullKey, setCreatedFullKey] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      setError(null);
      const data = await apiKeyService.getKeys();
      setKeys(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiKeyService.getAll();
        if (!cancelled) setKeys(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load API keys');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }
    try {
      const result = await apiKeyService.create({
        name: newKeyName.trim(),
        scopes: [newKeyScope],
      });
      setKeys((prev) => [result.key, ...prev]);
      setCreatedFullKey(result.fullKey);
      setNewKeyName('');
      setNewKeyScope('read');
      toast.success('API key created');
    } catch {
      toast.error('Failed to create API key');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiKeyService.delete(deleteTarget.id);
      setKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id));
      toast.success('API key deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete API key');
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      const result = await apiKeyService.regenerate(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? result.key : k)));
      setCreatedFullKey(result.fullKey);
      setCreateDialogOpen(true);
      toast.success('API key regenerated');
    } catch {
      toast.error('Failed to regenerate API key');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Keys" description="Manage API keys for programmatic access" />
        <LoadingSkeleton type="table" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Keys" description="Manage API keys for programmatic access" />
        <ErrorState message={error} onRetry={loadKeys} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="API Keys" description="Manage API keys for programmatic access">
        <Button onClick={() => { setCreatedFullKey(null); setCreateDialogOpen(true); }}>
          <IconPlus className="mr-2 size-4" />
          Create API Key
        </Button>
      </PageHeader>

      {keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create an API key to integrate with external tools and services."
          action={{ label: 'Create API Key', onClick: () => { setCreatedFullKey(null); setCreateDialogOpen(true); } }}
        />
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <IconKey className="size-4 text-muted-foreground" />
                    <span className="font-medium">{key.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {key.keyPrefix}...
                    </code>
                    <span className="flex gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    {key.expiresAt && ` · Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRegenerate(key.id)}
                  >
                    <IconCheck className="mr-1.5 size-3.5" />
                    Regenerate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(key)}
                  >
                    <IconTrash className="mr-1.5 size-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdFullKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {createdFullKey
                ? 'Copy this key now. You will not be able to see it again.'
                : 'Create a new API key for programmatic access.'}
            </DialogDescription>
          </DialogHeader>

          {createdFullKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted p-3">
                <code className="break-all text-sm font-mono">{createdFullKey}</code>
              </div>
              <Button className="w-full" onClick={() => copyToClipboard(createdFullKey)}>
                <IconCopy className="mr-2 size-4" />
                Copy to Clipboard
              </Button>
              <DialogFooter showCloseButton>
                <Button variant="outline" onClick={() => { setCreatedFullKey(null); setCreateDialogOpen(false); }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production API"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-scope">Scope</Label>
                <Select value={newKeyScope} onValueChange={(v: string | null) => { if (v !== null) setNewKeyScope(v); }}>
                  <SelectTrigger id="key-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {scope.charAt(0).toUpperCase() + scope.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create Key</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? Any applications using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
