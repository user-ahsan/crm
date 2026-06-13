'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconArrowLeft, IconPlus, IconTrash, IconGripVertical } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { EmailSequence, CampaignStatus } from '@/types/campaign.types';
import type { CampaignEmailFormData } from '@/types/campaign.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { campaignService } from '@/services/campaign.service';
import { useCampaignEmails } from '@/hooks/useCampaigns';
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
  const id = params.id as string;

  const [sequence, setSequence] = useState<EmailSequence | null>(null);
  const [seqLoading, setSeqLoading] = useState(true);
  const [seqError, setSeqError] = useState<string | null>(null);
  const { emails, loading: emailsLoading, error: emailsError, refresh: refreshEmails, addEmail, updateEmail, deleteEmail } = useCampaignEmails(id);

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

  useEffect(() => {
    loadSequence();
  }, [loadSequence]);

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
    if (!confirm('Delete this email from the sequence?')) return;
    const ok = await deleteEmail(emailId);
    if (ok) toast.success('Email removed');
  }, [deleteEmail]);

  if (seqLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  if (seqError || !sequence) {
    return (
      <div className="p-6">
        <ErrorState message={seqError ?? 'Campaign not found'} onRetry={loadSequence} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
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
                    <div className="flex items-center gap-1 shrink-0">
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
    </div>
  );
}
