'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconEdit, IconArrowLeft, IconCurrencyDollar, IconCalendarEvent, IconUser, IconTags, IconNote, IconMail } from '@tabler/icons-react';
import type { Deal, DealStage } from '@/types/deal.types';
import { dealService } from '@/services/deal.service';
import { DealCreateForm } from '@/components/deals/DealCreateForm';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { NotesList } from '@/components/communication/NotesList';
import { EmailHistory } from '@/components/communication/EmailHistory';
import { TagBadge } from '@/components/common/TagBadge';
import { useEmail } from '@/hooks/useEmail';
import { USERS } from '@/lib/constants';
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from '@/lib/formatters';

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { emails, loading: emailsLoading, sendEmail, refresh: refreshEmails } = useEmail('deal', dealId);

  const loadDeal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [found, allStages] = await Promise.all([
        dealService.getById(dealId),
        dealService.getStages(),
      ]);
      if (found) {
        setDeal(found);
        setStages(allStages);
      } else {
        setError('Deal not found');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deal');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { loadDeal(); }, [loadDeal]);

  const handleSuccess = useCallback(() => { loadDeal(); }, [loadDeal]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" disabled className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to deals
        </Button>
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  if (error === 'Deal not found' || (!loading && !deal && error)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/deals')} className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to deals
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="mb-1 text-lg font-semibold">Deal not found</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            The deal you are looking for does not exist or has been deleted.
          </p>
          <Button variant="outline" onClick={() => router.push('/deals')}>
            Go to Deals
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/deals')} className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to deals
        </Button>
        <ErrorState message={error} onRetry={loadDeal} />
      </div>
    );
  }

  if (!deal) return null;

  const stage = deal.stageId ? stages.find((s) => s.id === deal.stageId) : undefined;
  const assignedUser = deal.assignedTo ? USERS.find((u) => u.id === deal.assignedTo) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/deals')}>
          <IconArrowLeft className="mr-2 size-4" />
          Back to deals
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <IconEdit className="mr-2 size-4" />
          Edit Deal
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">{deal.title}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {stage && (
                  <Badge
                    variant="outline"
                    className="font-normal"
                    style={{
                      backgroundColor: `${stage.color}20`,
                      color: stage.color,
                      borderColor: `${stage.color}40`,
                    }}
                  >
                    {stage.name}
                  </Badge>
                )}
                {deal.closeDate && (
                  <span className="inline-flex items-center gap-1">
                    <IconCalendarEvent className="size-3.5" />
                    Close: {formatDate(deal.closeDate)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconCurrencyDollar className="size-3.5" />
                Value
              </div>
              <p className="text-sm font-medium text-foreground">
                {deal.value > 0 ? formatCurrency(deal.value) : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Currency
              </div>
              <p className="text-sm font-medium text-foreground">{deal.currency}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconUser className="size-3.5" />
                Assigned To
              </div>
              {assignedUser ? (
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px]">{getInitials(assignedUser.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">{assignedUser.name}</span>
                </div>
              ) : (
                <p className="text-sm text-foreground">—</p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Stage Probability
              </div>
              <p className="text-sm font-medium text-foreground">
                {stage ? `${Math.round(stage.probability * 100)}%` : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconCalendarEvent className="size-3.5" />
                Created
              </div>
              <p className="text-sm font-medium text-foreground">{formatDate(deal.createdAt)}</p>
              <p className="text-xs text-muted-foreground">
                by {USERS.find((u) => u.id === deal.createdBy)?.name ?? 'Unknown'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconCalendarEvent className="size-3.5" />
                Last Updated
              </div>
              <p className="text-sm font-medium text-foreground">{formatRelativeTime(deal.updatedAt)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconTags className="size-3.5" />
                Tags
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {deal.tags.length > 0
                  ? deal.tags.map((tag) => <TagBadge key={tag} name={tag} />)
                  : <span className="text-sm text-muted-foreground/50">—</span>}
              </div>
            </div>
          </div>

          {deal.description && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">
            Activity
          </TabsTrigger>
          <TabsTrigger value="notes">
            <IconNote className="size-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="emails">
            <IconMail className="size-4" />
            Emails
            {!emailsLoading && emails.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {emails.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Activity tracking will appear here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <IconNote className="size-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NotesList entityType="deal" entityId={deal.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="pt-4">
          <EmailHistory
            emails={emails}
            loading={emailsLoading}
            entityType="deal"
            entityId={dealId}
            onSend={async (data) => {
              await sendEmail({
                ...data,
                relatedToType: 'deal',
                relatedToId: dealId,
              });
              refreshEmails();
            }}
            onRefresh={refreshEmails}
          />
        </TabsContent>
      </Tabs>

      <DealCreateForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editDeal={deal}
        stages={stages}
      />
    </div>
  );
}
