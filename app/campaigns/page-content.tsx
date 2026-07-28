'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconMail, IconPlayerPlay, IconPlayerPause, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { useCampaigns, type EnrichedStats } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

export default function CampaignsPage() {
  const {
    sequences,
    loading,
    error,
    refresh,
    createSequence,
    deleteSequence,
    pauseSequence,
  } = useCampaigns();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [seqStats, setSeqStats] = useState<Record<string, EnrichedStats>>({});

  // Load enriched stats for the list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/campaigns');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.sequences) {
          const map: Record<string, EnrichedStats> = {};
          for (const s of data.sequences) {
            map[s.id] = { emailCount: s.stats.emailCount, recipientCount: s.stats.recipientCount };
          }
          setSeqStats(map);
        }
      } catch (e) { console.error('Failed to load campaign stats:', e); toast.error('Failed to load campaign stats'); }
    })();
    return () => { cancelled = true; };
  }, [sequences.length]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const seq = await createSequence({ name: formName.trim(), description: formDesc.trim() });
      if (seq) {
        toast.success('Campaign created');
        setCreateOpen(false);
        setFormName('');
        setFormDesc('');
        router.push(`/campaigns/${seq.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }, [formName, formDesc, createSequence, router]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const ok = await deleteSequence(deleteTarget);
    setDeleteTarget(null);
    if (ok) toast.success('Campaign deleted');
  }, [deleteTarget, deleteSequence]);

  const handleActivate = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Navigate to detail page where recipients can be added and campaign activated
    router.push(`/campaigns/${id}`);
  }, [router]);

  const handlePause = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await pauseSequence(id);
      toast.success('Campaign paused');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to pause');
    }
  }, [pauseSequence]);

  if (loading && sequences.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
            <div className="mt-1 h-4 w-56 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
        </div>
        <LoadingSkeleton type="card" count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <PermissionGuard action="read" entity="campaign" fallback={<EmptyState title="Access Denied" description="You don't have permission to view campaigns." />}>
    <div className="space-y-6">
      <PageHeader title="Email Campaigns" description="Create and manage email sequences">
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus className="mr-2 size-4" />
          New Campaign
        </Button>
      </PageHeader>

      {sequences.length === 0 ? (
        <EmptyState
          icon={<IconMail size={48} stroke={1.5} />}
          title="No campaigns yet"
          description="Create your first email sequence to start engaging your leads."
          action={{ label: 'New Campaign', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sequences.map((seq) => {
            const stats = seqStats[seq.id];
            return (
              <Link key={seq.id} href={`/campaigns/${seq.id}`}>
                <Card className="cursor-pointer transition-colors hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{seq.name}</CardTitle>
                      <div className="flex items-center gap-1 shrink-0">
                        {seq.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-green-600"
                            onClick={(e) => handleActivate(seq.id, e)}
                            title="Activate campaign"
                          >
                            <IconPlayerPlay className="size-4" />
                          </Button>
                        )}
                        {seq.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-yellow-600"
                            onClick={(e) => handlePause(seq.id, e)}
                            title="Pause campaign"
                          >
                            <IconPlayerPause className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(e) => handleDelete(seq.id, e)}
                        >
                          <IconTrash className="size-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {seq.description && (
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{seq.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[seq.status] ?? STATUS_STYLES.draft}
                      >
                        {seq.status}
                      </Badge>
                      {stats && (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            {stats.emailCount} email{stats.emailCount !== 1 ? 's' : ''}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {stats.recipientCount} recipient{stats.recipientCount !== 1 ? 's' : ''}
                          </Badge>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete Campaign"
        description="Delete this campaign? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Welcome Sequence"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="Describe the purpose of this campaign"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !formName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGuard>
  );
}
