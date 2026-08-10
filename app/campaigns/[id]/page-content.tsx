'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconArrowLeft, IconPlus, IconTrash, IconGripVertical, IconSend, IconUsers, IconUserPlus, IconRefresh, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { EmailSequence, CampaignStatus } from '@/types/campaign.types';
import type { CampaignEmailFormData } from '@/types/campaign.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { useCampaigns, useCampaignEmails } from '@/hooks/useCampaigns';
import { useCampaignStats } from '@/hooks/useCampaignScheduler';
import { leadService } from '@/services/lead.service';
import { contactService } from '@/services/contact.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const STATUS_OPTIONS: CampaignStatus[] = ['draft', 'active', 'paused', 'completed'];

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const id = typeof rawId === 'string' ? rawId : '';
  if (!id) throw new Error('Invalid campaign ID');

  const [sequence, setSequence] = useState<EmailSequence | null>(null);
  const [seqLoading, setSeqLoading] = useState(true);
  const [seqError, setSeqError] = useState<string | null>(null);
  const { emails, loading: emailsLoading, error: emailsError, addEmail, updateEmail, deleteEmail, reorderEmails } = useCampaignEmails(id);

  // Sequence info
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // New email form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newDelay, setNewDelay] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Edit email state
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editDelay, setEditDelay] = useState('0');

  // Delete email state
  const [deleteEmailTarget, setDeleteEmailTarget] = useState<string | null>(null);

  // Stats — polling hook (30s interval when active)
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useCampaignStats(id);
  const [recipients, setRecipients] = useState<{
    id: string;
    recipientEmail: string;
    recipientType: string;
    status: string;
    scheduledSendAt: string | null;
    sentAt: string | null;
    errorMessage: string | null;
  }[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  // We use fetch directly for activate/pause/add-recipients to avoid triggering
  // a full sequences list fetch from useCampaigns() on this page.

  // Activate dialog
  const [activateOpen, setActivateOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  // Add recipients dialog
  const [addRecipientsOpen, setAddRecipientsOpen] = useState(false);
  const [addingRecipients, setAddingRecipients] = useState(false);

  const loadSequence = useCallback(async () => {
    setSeqLoading(true);
    setSeqError(null);
    try {
      const seq = await campaignService.getSequence(id);
      if (seq) {
        setSequence(seq);
        setEditName(seq.name);
        setEditDesc(seq.description);
      } else {
        setSeqError('Campaign not found');
      }
    } catch (e) {
      setSeqError(e instanceof Error ? e.message : 'Failed to load campaign');
    } finally {
      setSeqLoading(false);
    }
  }, [id]);

  const loadRecipients = useCallback(async () => {
    setRecipientsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/recipients?sequenceId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients ?? []);
      }
    } catch (e) { console.error('Failed to load campaign recipients:', e); toast.error('Failed to load campaign recipients'); }
    finally { setRecipientsLoading(false); }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await campaignService.getSequence(id);
        if (cancelled) return;
        if (data) {
          setSequence(data);
          setEditName(data.name);
          setEditDesc(data.description);
        } else {
          setSeqError('Campaign not found');
        }
      } catch (e) {
        if (!cancelled) setSeqError(e instanceof Error ? e.message : 'Failed to load campaign');
      } finally {
        if (!cancelled) setSeqLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Load recipients after sequence loads
  useEffect(() => {
    if (sequence && !seqLoading) {
      refreshStats();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRecipients();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence?.id, seqLoading, refreshStats, loadRecipients]); // sequence object intentionally excluded to avoid loops

  const handleSaveInfo = useCallback(async () => {
    if (!editName.trim()) return;
    const updated = await campaignService.updateSequence(id, { name: editName.trim(), description: editDesc.trim() });
    if (updated) {
      setSequence(updated);
      setEditingName(false);
      toast.success('Campaign updated');
    }
  }, [id, editName, editDesc]);

  const handleStatusChange = useCallback(async (status: CampaignStatus) => {
    const updated = await campaignService.updateSequenceStatus(id, status);
    if (updated) {
      setSequence(updated);
      toast.success(`Status changed to ${status}`);
    }
  }, [id]);

  const handleAddEmail = useCallback(async () => {
    if (!newSubject.trim()) {
      toast.error('Subject is required');
      return;
    }
    setSubmitting(true);
    try {
      const data: CampaignEmailFormData = {
        sequenceId: id,
        subject: newSubject.trim(),
        body: newBody,
        delayDays: parseInt(newDelay, 10) || 0,
        sortOrder: emails.length,
      };
      const created = await addEmail(data);
      if (created) {
        toast.success('Email added');
        setShowAddForm(false);
        setNewSubject('');
        setNewBody('');
        setNewDelay('0');
      }
    } finally {
      setSubmitting(false);
    }
  }, [id, newSubject, newBody, newDelay, emails.length, addEmail]);

  const handleStartEdit = useCallback((emailId: string, subject: string, body: string, delayDays: number) => {
    setEditingEmailId(emailId);
    setEditSubject(subject);
    setEditBody(body);
    setEditDelay(String(delayDays));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingEmailId || !editSubject.trim()) return;
    const updated = await updateEmail(editingEmailId, {
      subject: editSubject.trim(),
      body: editBody,
      delayDays: parseInt(editDelay, 10) || 0,
    });
    if (updated) {
      toast.success('Email updated');
      setEditingEmailId(null);
    }
  }, [editingEmailId, editSubject, editBody, editDelay, updateEmail]);

  const handleDeleteEmail = useCallback(async (emailId: string) => {
    setDeleteEmailTarget(emailId);
  }, []);

  const confirmDeleteEmail = useCallback(async () => {
    if (!deleteEmailTarget) return;
    const ok = await deleteEmail(deleteEmailTarget);
    setDeleteEmailTarget(null);
    if (ok) toast.success('Email removed');
  }, [deleteEmailTarget, deleteEmail]);

  /**
   * Moves an email up or down in the sequence by swapping its sort_order with
   * its neighbour, then persists the full ordering via reorderEmails (the
   * service requires the complete permutation; a two-item swap would be a
   * partial payload, so we rebuild the full ordered-id list each time).
   */
  const handleMoveEmail = useCallback(async (emailId: string, direction: 'up' | 'down') => {
    const currentIdx = emails.findIndex((e) => e.id === emailId);
    if (currentIdx < 0) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= emails.length) return;
    const reorderedIds = emails.map((e) => e.id);
    [reorderedIds[currentIdx], reorderedIds[targetIdx]] = [reorderedIds[targetIdx]!, reorderedIds[currentIdx]!];
    const result = await reorderEmails(reorderedIds);
    if (result) {
      toast.success('Email order updated');
    } else {
      toast.error('Failed to reorder email');
    }
  }, [emails, reorderEmails]);

  const handleActivateFromDialog = useCallback(async (
    leadIds: string[],
    contactIds: string[],
  ) => {
    if (leadIds.length === 0 && contactIds.length === 0) {
      toast.error('Select at least one lead or contact');
      return;
    }
    // Double-check that the sequence is still in draft (stale dialog guard)
    if (sequence?.status !== 'draft') {
      toast.error('This campaign is no longer in draft status and cannot be activated.');
      setActivateOpen(false);
      return;
    }
    setActivating(true);
    try {
      const res = await fetch('/api/campaigns/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceId: id,
          leadIds: leadIds.length > 0 ? leadIds : undefined,
          contactIds: contactIds.length > 0 ? contactIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to activate');
      toast.success(`Campaign activated — ${data.total} recipients queued`);
      setActivateOpen(false);
      setSequence((prev) => prev ? { ...prev, status: 'active' as const } : prev);
      refreshStats();
      loadRecipients();
    } catch (err) {
      // Reuse existing server-side dedup check — if already active, show clear message
      const message = err instanceof Error ? err.message : 'Failed to activate';
      if (message.toLowerCase().includes('already')) {
        toast.error('This campaign sequence is already active. Reload the page to see current status.');
      } else {
        toast.error(message);
      }
    } finally {
      setActivating(false);
    }
  }, [id, sequence, refreshStats, loadRecipients]);

  const handlePauseCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to pause');
      toast.success('Campaign paused');
      setSequence((prev) => prev ? { ...prev, status: 'paused' as const } : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to pause');
    }
  }, [id]);

  const handleAddRecipients = useCallback(async (
    leadIds: string[],
    contactIds: string[],
  ) => {
    if (leadIds.length === 0 && contactIds.length === 0) {
      toast.error('Select at least one lead or contact');
      return;
    }
    setAddingRecipients(true);
    try {
      const res = await fetch('/api/campaigns/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceId: id,
          leadIds: leadIds.length > 0 ? leadIds : undefined,
          contactIds: contactIds.length > 0 ? contactIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add recipients');
      toast.success(`${data.added} recipient${data.added !== 1 ? 's' : ''} added`);
      setAddRecipientsOpen(false);
      loadRecipients();
      refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add recipients');
    } finally {
      setAddingRecipients(false);
    }
  }, [id, loadRecipients, refreshStats]);

  if (seqLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  if (seqError || !sequence) {
    return (
      <div>
        <ErrorState message={seqError ?? 'Campaign not found'} onRetry={loadSequence} />
      </div>
    );
  }

  return (
    <PermissionGuard action="read" entity="campaign" fallback={<EmptyState title="Access Denied" description="You don't have permission to view campaigns." />}>
    <div className="space-y-6">
      {/* Back + header */}
      <PageHeader title={sequence.name} description={sequence.description || 'No description'}>
        <Button variant="outline" onClick={() => router.push('/campaigns')}>
          <IconArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </PageHeader>

      {/* Sequence info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campaign Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="min-w-20">Status</Label>
            <Select value={sequence.status} onValueChange={(v) => handleStatusChange(v as CampaignStatus)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <Badge variant="outline" className={STATUS_STYLES[s]}>{s}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editingName ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveInfo}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingName(true)}>
                Edit Info
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emails section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Emails ({emails.length})</CardTitle>
          <Button size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <IconPlus className="mr-1 size-4" />
            Add Email
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {emailsError && (
            <p className="text-sm text-destructive">{emailsError}</p>
          )}

          {emailsLoading && emails.length === 0 && (
            <LoadingSkeleton type="list" count={2} />
          )}

          {!emailsLoading && emails.length === 0 && !showAddForm && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No emails in this sequence yet. Add your first email.
            </p>
          )}

          {/* Email list */}
          {emails.map((email, idx) => (
            <div key={email.id} className="rounded-lg border p-4">
              {editingEmailId === email.id ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Body</Label>
                    <Textarea rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 space-y-1">
                      <Label>Delay (days)</Label>
                      <Input type="number" min={0} value={editDelay} onChange={(e) => setEditDelay(e.target.value)} />
                    </div>
                    <div className="self-end flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingEmailId(null)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <IconGripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground shrink-0">#{idx + 1}</span>
                      <span className="truncate font-medium">{email.subject}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Move up"
                        disabled={idx === 0}
                        onClick={() => handleMoveEmail(email.id, 'up')}
                      >
                        <IconChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Move down"
                        disabled={idx === emails.length - 1}
                        onClick={() => handleMoveEmail(email.id, 'down')}
                      >
                        <IconChevronDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => handleStartEdit(email.id, email.subject, email.body, email.delayDays)}>
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDeleteEmail(email.id)}>
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Delay: {email.delayDays}d</span>
                    <span>Order: {email.sortOrder}</span>
                  </div>
                  {email.body && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-2">{email.body}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add email form inline */}
          {showAddForm && (
            <div className="rounded-lg border border-dashed p-4 space-y-3">
              <p className="text-sm font-medium">New Email</p>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="Enter subject line"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  rows={4}
                  placeholder="Write your email content..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 space-y-1">
                  <Label>Delay (days)</Label>
                  <Input type="number" min={0} value={newDelay} onChange={(e) => setNewDelay(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddEmail} disabled={submitting || !newSubject.trim()}>
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Delivery Stats</CardTitle>
          <div className="flex items-center gap-2">
            {sequence.status === 'draft' && (
              <Button
                size="sm"
                onClick={() => {
                  // Guard: prevent opening dialog if sequence has already been activated
                  // (race condition / stale status check — the server-side dedup will
                  //  also catch it, but this avoids a confusing dialog flow)
                  if (sequence.status !== 'draft') {
                    toast.error('This campaign is already active or completed.');
                    return;
                  }
                  setActivateOpen(true);
                }}
              >
                <IconSend className="mr-1 size-4" />
                Activate Campaign
              </Button>
            )}
            {sequence.status === 'active' && (
              <Button size="sm" variant="outline" onClick={handlePauseCampaign}>
                <IconRefresh className="mr-1 size-4" />
                Pause
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {statsError && (
            <p className="mb-3 text-sm text-destructive">{statsError}</p>
          )}
          {statsLoading && !stats ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="mt-1 text-2xl font-semibold text-green-600">{stats.sent}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="mt-1 text-2xl font-semibold text-red-600">{stats.failed}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="mt-1 text-2xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">No stats available yet. Activate the campaign to begin.</p>
          )}
        </CardContent>
      </Card>

      {/* Add Recipients + Recipient List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            Recipients
            {recipients.length > 0 && (
              <Badge variant="secondary" className="ml-2">{recipients.length}</Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddRecipientsOpen(true)}>
            <IconUserPlus className="mr-1 size-4" />
            Add Recipients
          </Button>
        </CardHeader>
        <CardContent>
          {recipientsLoading ? (
            <LoadingSkeleton type="list" count={3} />
          ) : recipients.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No recipients yet. Add leads or contacts to start this campaign.
            </p>
          ) : (
            <div className="space-y-2">
              {recipients.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.recipientEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.recipientType}
                      {r.sentAt && ` — sent ${new Date(r.sentAt).toLocaleDateString()}`}
                      {r.errorMessage && ` — ${r.errorMessage}`}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      r.status === 'sent'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : r.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activate Campaign Dialog */}
      <RecipientSelectDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title="Activate Campaign — Select Recipients"
        description="Choose which leads and contacts to include in this campaign."
        submitLabel={activating ? 'Activating…' : 'Activate Campaign'}
        submitting={activating}
        onSubmit={handleActivateFromDialog}
      />

      {/* Delete email confirmation */}
      <ConfirmDialog
        open={!!deleteEmailTarget}
        onOpenChange={(o) => { if (!o) setDeleteEmailTarget(null); }}
        title="Delete Email"
        description="Delete this email from the sequence?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteEmail}
      />

      {/* Add Recipients Dialog */}
      <RecipientSelectDialog
        open={addRecipientsOpen}
        onOpenChange={setAddRecipientsOpen}
        title="Add Recipients"
        description="Select leads and contacts to add as campaign recipients."
        submitLabel={addingRecipients ? 'Adding…' : 'Add Selected'}
        submitting={addingRecipients}
        onSubmit={handleAddRecipients}
      />
    </div>
    </PermissionGuard>
  );
}

// ── Recipient Selection Dialog ────────────────────────────────────

function RecipientSelectDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (leadIds: string[], contactIds: string[]) => void;
}) {
  const [tab, setTab] = useState<'leads' | 'contacts'>('leads');
  const [leadsSearch, setLeadsSearch] = useState('');
  const [contactsSearch, setContactsSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Load leads and contacts
  const { leads, loading: leadsLoading } = useCampaignLeads();
  const { contacts, loading: contactsLoading } = useCampaignContacts();

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLeadIds([]);
      setSelectedContactIds([]);
      setLeadsSearch('');
      setContactsSearch('');
      setTab('leads');
    }
  }, [open]);

  const filteredLeads = leads.filter(
    (l) =>
      l.fullName.toLowerCase().includes(leadsSearch.toLowerCase()) ||
      (l.email && l.email.toLowerCase().includes(leadsSearch.toLowerCase())),
  );

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactsSearch.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(contactsSearch.toLowerCase())),
  );

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    onSubmit(selectedLeadIds, selectedContactIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={tab === 'leads' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('leads')}
          >
            <IconUsers className="mr-1 size-4" />
            Leads ({leads.length})
          </Button>
          <Button
            variant={tab === 'contacts' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('contacts')}
          >
            <IconUsers className="mr-1 size-4" />
            Contacts ({contacts.length})
          </Button>
        </div>

        <ScrollArea className="max-h-64">
          {tab === 'leads' && (
            <div className="space-y-1">
              <Input
                placeholder="Search leads…"
                value={leadsSearch}
                onChange={(e) => setLeadsSearch(e.target.value)}
                className="mb-2"
              />
              {leadsLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Loading leads…
                </p>
              ) : filteredLeads.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No leads found.
                </p>
              ) : (
                filteredLeads.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedLeadIds.includes(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {lead.fullName}
                      </p>
                      {lead.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.email}
                        </p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          )}

          {tab === 'contacts' && (
            <div className="space-y-1">
              <Input
                placeholder="Search contacts…"
                value={contactsSearch}
                onChange={(e) => setContactsSearch(e.target.value)}
                className="mb-2"
              />
              {contactsLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Loading contacts…
                </p>
              ) : filteredContacts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No contacts found.
                </p>
              ) : (
                filteredContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedContactIds.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {contact.name}
                      </p>
                      {contact.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.email}
                        </p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedLeadIds.length + selectedContactIds.length} selected
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Hooks for loading leads/contacts within dialog ────────────────

function useCampaignLeads() {
  const [leads, setLeads] = useState<{ id: string; fullName: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    leadService.getAll()
      .then((data) => {
        if (!cancelled) setLeads(data.map((l) => ({ id: l.id, fullName: l.fullName, email: l.email })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { leads: Array.isArray(leads) ? leads : [], loading };
}

function useCampaignContacts() {
  const [contacts, setContacts] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    contactService.getAll()
      .then((data) => {
        if (!cancelled) setContacts(data.map((c) => ({ id: c.id, name: c.name, email: c.email })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { contacts: Array.isArray(contacts) ? contacts : [], loading };
}
