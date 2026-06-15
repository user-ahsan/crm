'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconMail, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useCampaigns } from '@/hooks/useCampaigns';
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
  const { sequences, loading, error, refresh, createSequence, deleteSequence } = useCampaigns();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (!confirm('Delete this campaign? This action cannot be undone.')) return;
    const ok = await deleteSequence(id);
    if (ok) toast.success('Campaign deleted');
  }, [deleteSequence]);

  if (loading && sequences.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
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
      <div className="p-6">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
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
          {sequences.map((seq) => (
            <Link key={seq.id} href={`/campaigns/${seq.id}`}>
              <Card className="cursor-pointer transition-colors hover:border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{seq.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={(e) => handleDelete(seq.id, e)}
                    >
                      <IconTrash className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {seq.description && (
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{seq.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES[seq.status] ?? STATUS_STYLES.draft}
                    >
                      {seq.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
  );
}
