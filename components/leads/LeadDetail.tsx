'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Lead } from '@/types/lead.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import type { Activity } from '@/types/activity.types';
import { useEmail } from '@/hooks/useEmail';
import { EmailHistory } from '@/components/communication/EmailHistory';
import { useSms } from '@/hooks/useSms';
import { SmsHistory } from '@/components/communication/SmsHistory';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagBadge } from '@/components/common/TagBadge';
import { TagInput } from '@/components/common/TagInput';
import { MarkdownContent } from '@/components/common/MarkdownContent';
import { LeadScoreBadge } from '@/components/leads/LeadScoreBadge';
import { LeadScheduleDialog } from '@/components/leads/LeadScheduleDialog';
import { useLeads } from '@/hooks/useLeads';
import { useLeadScore } from '@/hooks/useLeadScoring';
import { useTags } from '@/hooks/useTags';
import { SCORING_FACTORS } from '@/lib/constants';
import type { Tag } from '@/types/tag.types';
import { useTasks } from '@/hooks/useTasks';
import { useMeetings } from '@/hooks/useMeetings';
import { useActivities } from '@/hooks/useActivities';
import { NotesList } from '@/components/communication/NotesList';
import { useCallLogs } from '@/hooks/useCallLogs';
import { CallLogList } from '@/components/communication/CallLogList';
import { FileAttachmentList } from '@/components/common/FileAttachmentList';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/color-tokens';
import { getUserName } from '@/lib/user-utils';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime, getInitials, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconMail,
  IconPhone,
  IconCalendarEvent,
  IconEdit,
  IconBuilding,
  IconWorld,
  IconMapPin,
  IconTags,
  IconCurrencyDollar,
  IconSourceCode,
  IconUserCircle,
  IconChecklist,
  IconCalendarStats,
  IconActivity,
  IconMessage,
  IconFileDescription,
  IconNote,
  IconRefresh,
  IconPaperclip,
  IconDeviceMobileMessage,
} from '@tabler/icons-react';

interface LeadDetailProps {
  leadId: string;
  onBack?: () => void;
  /** When provided, the parent owns the lead fetch and this component skips its own. */
  initialLead?: Lead;
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

const TAB_ACTIVITY = 'activity';
const TAB_NOTES = 'notes';
const TAB_TASKS = 'tasks';
const TAB_MEETINGS = 'meetings';
const TAB_CALLS = 'calls';
const TAB_SMS = 'sms';
const TAB_EMAILS = 'emails';
const TAB_FILES = 'files';
const TAB_DETAILS = 'details';
const TAB_SCORE = 'score';

export function LeadDetail({ leadId, onBack, initialLead }: LeadDetailProps) {
  const { getById: getLeadById } = useLeads();
  const {
    score: leadScoreData,
    loading: scoreLoading,
    error: scoreError,
    refresh: refreshScore,
    recalculate: recalculateScore,
  } = useLeadScore(leadId);
  const { getEntityTags: getTagsForEntity, createTag, addEntityTag, removeEntityTag } = useTags();
  const { getByEntity: getTasksByEntity } = useTasks();
  const { getByEntity: getMeetingsByEntity } = useMeetings();
  const { getByEntity: getActivitiesByEntity } = useActivities();

  const [leadState, setLeadState] = useState<LoadState<Lead>>(
    initialLead ? { status: 'success', data: initialLead } : { status: 'loading' },
  );
  const [activeTab, setActiveTab] = useState(TAB_ACTIVITY);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const {
    emails,
    loading: emailsLoading,
    sendEmail: sendEmailHook,
    refresh: refreshEmails,
  } = useEmail('lead', leadId);

  const { callLogs, loading: callLogsLoading, logCall } = useCallLogs('lead', leadId);

  const { smsLogs, loading: smsLoading, sendSms, refresh: refreshSms } = useSms('lead', leadId);

  const [entityTags, setEntityTags] = useState<Tag[]>([]);
  const [tagsLoadError, setTagsLoadError] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const leadIdRef = useRef(leadId);
  useEffect(() => { leadIdRef.current = leadId; }, [leadId]);

  // Track the last committed tag set so tag changes can be diffed against it.
  const entityTagsRef = useRef<Tag[]>([]);
  useEffect(() => {
    entityTagsRef.current = entityTags;
  }, [entityTags]);

  // ─── Data & State ─────────────────────────────────
  // Fetch lead data only when the parent did not already provide it.
  useEffect(() => {
    if (initialLead) return;
    let cancelled = false;
    getLeadById(leadId).then((lead) => {
      if (cancelled) return;
      if (lead) {
        setLeadState({ status: 'success', data: lead });
      } else {
        setLeadState({ status: 'error', message: 'Lead not found' });
      }
    }).catch((err) => {
      if (cancelled) return;
      setLeadState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load lead',
      });
    });
    return () => { cancelled = true; };
  }, [getLeadById, leadId, initialLead]);

  // Keep in sync when the parent refreshes the lead it passed down.
  useEffect(() => {
    if (initialLead) setLeadState({ status: 'success', data: initialLead });
  }, [initialLead]);

  // Fetch tags for this lead through the useTags hook.
  useEffect(() => {
    if (leadState.status !== 'success') return;
    let cancelled = false;
    setTagsLoadError(false);
    getTagsForEntity('lead', leadId).then((tags) => {
      if (!cancelled) setEntityTags(tags);
    }).catch(() => {
      if (!cancelled) setTagsLoadError(true);
    });
    return () => { cancelled = true; };
  }, [leadState, leadId, getTagsForEntity]);

  const reloadEntityTags = useCallback(async () => {
    if (leadState.status !== 'success') return;
    setTagsLoadError(false);
    try {
      const tags = await getTagsForEntity('lead', leadId);
      setEntityTags(tags);
    } catch {
      setTagsLoadError(true);
    }
  }, [leadState, leadId, getTagsForEntity]);

  // ─── Event Handlers ───────────────────────────────
  const handleTagChange = useCallback(async (tags: Tag[]) => {
    const currentLeadId = leadIdRef.current;
    const previousTags = entityTagsRef.current;
    // Optimistic update (reversible — rollback on failure below).
    setEntityTags(tags);
    entityTagsRef.current = tags;
    try {
      // Resolve all tag IDs — create new tags so they get real IDs.
      const resolved: Tag[] = [];
      for (const t of tags) {
        if (t.id.startsWith('new-')) {
          const created = await createTag(t.name, t.color);
          if (created) resolved.push(created);
        } else {
          resolved.push(t);
        }
      }

      if (resolved.length !== tags.length) {
        toast.error('One or more new tags could not be created');
        setEntityTags(resolved);
        entityTagsRef.current = resolved;
      }

      const prevIds = new Set(previousTags.map((t) => t.id));
      const nextIds = new Set(resolved.map((t) => t.id));
      const toAdd = resolved.filter((t) => !prevIds.has(t.id));
      const toRemove = previousTags.filter((t) => !nextIds.has(t.id));

      const results = await Promise.all([
        ...toAdd.map((t) => addEntityTag('lead', currentLeadId, t.id)),
        ...toRemove.map((t) => removeEntityTag('lead', currentLeadId, t.id)),
      ]);

      if (results.some((r) => !r)) {
        toast.error('Some tag changes failed');
      } else if (toAdd.length > 0 || toRemove.length > 0) {
        toast.success('Tags updated');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update tags';
      toast.error(message);
    }
  }, [createTag, addEntityTag, removeEntityTag]);

  const handleMeetingScheduled = useCallback(async () => {
    if (leadState.status !== 'success') return;
    const currentLead = leadState.data;
    try {
      const updated = await getMeetingsByEntity('lead', currentLead.id);
      setMeetings(updated);
    } catch {
      // The Meetings tab refetches when opened, so a failed background
      // refresh is not fatal — the create path already surfaced errors.
    }
  }, [leadState, getMeetingsByEntity]);

  // Fetch related tasks, meetings, activities when tab changes or lead loads
  useEffect(() => {
    if (leadState.status !== 'success') return;
    const lead = leadState.data;
    let cancelled = false;

    if (activeTab === TAB_TASKS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTasksLoading(true);
      getTasksByEntity('lead', lead.id).then((relatedTasks) => {
        if (!cancelled) setTasks(relatedTasks);
      }).catch(() => {
        if (!cancelled) setTasks([]);
      }).finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    }

    if (activeTab === TAB_MEETINGS) {
      setMeetingsLoading(true);
      getMeetingsByEntity('lead', lead.id).then((relatedMeetings) => {
        if (!cancelled) setMeetings(relatedMeetings);
      }).catch(() => {
        if (!cancelled) setMeetings([]);
      }).finally(() => {
        if (!cancelled) setMeetingsLoading(false);
      });
    }

    if (activeTab === TAB_ACTIVITY) {
      setActivitiesLoading(true);
      getActivitiesByEntity('lead', lead.id).then((relatedActivities) => {
        if (!cancelled) setActivities(relatedActivities);
      }).catch(() => {
        if (!cancelled) setActivities([]);
      }).finally(() => {
        if (!cancelled) setActivitiesLoading(false);
      });
    }

    return () => { cancelled = true; };
  }, [leadState, activeTab, getTasksByEntity, getMeetingsByEntity, getActivitiesByEntity]);

  // ─── Render ───────────────────────────────────────
  // Loading state
  if (leadState.status === 'loading') {
    return (
      <div className="space-y-6">
        {/* Back button skeleton */}
        <Skeleton className="h-9 w-24" />

        {/* Profile card skeleton */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error state
  if (leadState.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <IconUserCircle className="size-8 text-destructive" />
        </div>
        <h3 className="mb-1 text-base font-medium text-foreground">Failed to load lead</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          {leadState.message}
        </p>
        <div className="flex gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <IconArrowLeft className="size-4" />
              Go back
            </Button>
          )}
        </div>
      </div>
    );
  }

  const lead = leadState.data;

  return (
    <div className="space-y-6">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <IconArrowLeft className="size-4" />
          Back to leads
        </Button>
      )}

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Avatar + Name + Details */}
            <div className="flex items-start gap-4">
              <Avatar size="lg" className="size-16">
                <AvatarFallback className="text-lg font-semibold">
                  {getInitials(lead.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">{lead.fullName}</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {lead.email && (
                    <span className="inline-flex items-center gap-1">
                      <IconMail className="size-3.5" />
                      {lead.email}
                    </span>
                  )}
                  {lead.phone && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="inline-flex items-center gap-1">
                        <IconPhone className="size-3.5" />
                        {lead.phone}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className={cn('font-normal', STATUS_COLORS[lead.status])}>
                    {capitalizeFirst(lead.status)}
                  </Badge>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      PRIORITY_COLORS[lead.priority]
                    )}
                  >
                    {capitalizeFirst(lead.priority)}
                  </span>
                  {!scoreLoading && (
                    <LeadScoreBadge score={leadScoreData?.score ?? 0} size="sm" showLabel />
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex shrink-0 flex-wrap gap-2">
              {lead.email && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`mailto:${lead.email}`)}
                >
                  <IconMail className="size-4" />
                  Email
                </Button>
              )}
              {lead.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${lead.phone}`)}
                >
                  <IconPhone className="size-4" />
                  Call
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                <IconCalendarEvent className="size-4" />
                Schedule
              </Button>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Lead Info Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconBuilding className="size-3.5" />
                Company
              </div>
              <p className="text-sm font-medium text-foreground">
                {lead.companyName || '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconWorld className="size-3.5" />
                Industry
              </div>
              <p className="text-sm font-medium text-foreground">
                {lead.industry || '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconMapPin className="size-3.5" />
                Country
              </div>
              <p className="text-sm font-medium text-foreground">
                {lead.country || '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconSourceCode className="size-3.5" />
                Source
              </div>
              <p className="text-sm font-medium text-foreground">
                {capitalizeFirst(lead.source)}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconUserCircle className="size-3.5" />
                Assigned To
              </div>
              {lead.assignedTo ? (
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(getUserName(lead.assignedTo, '?'))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {getUserName(lead.assignedTo, '—')}
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">—</p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconCurrencyDollar className="size-3.5" />
                Estimated Value
              </div>
              <p className="text-sm font-medium text-foreground">
                {lead.estimatedValue > 0
                  ? formatCurrency(lead.estimatedValue)
                  : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconCalendarStats className="size-3.5" />
                Created
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatDate(lead.createdAt)}
              </p>
              {lead.createdBy && (
                <p className="text-xs text-muted-foreground">
                  by {getUserName(lead.createdBy, 'Unknown')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconCalendarStats className="size-3.5" />
                Last Updated
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatRelativeTime(lead.updatedAt)}
              </p>
              {lead.updatedBy && (
                <p className="text-xs text-muted-foreground">
                  by {getUserName(lead.updatedBy, 'Unknown')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconTags className="size-3.5" />
                Tags
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {tagsLoadError ? (
                  <>
                    <span className="text-sm text-destructive">Failed to load tags</span>
                    <Button variant="ghost" size="icon-sm" className="size-5" onClick={reloadEntityTags} aria-label="Retry loading tags">
                      <IconRefresh className="size-3" />
                    </Button>
                  </>
                ) : entityTags.length > 0 ? (
                  entityTags.map((tag) => (
                    <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground/50">—</span>
                )}
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger render={<Button variant="ghost" size="icon-sm" className="size-5" />}>
                    <IconEdit className="size-3" />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Edit Tags</p>
                      <TagInput
                        selectedTags={entityTags}
                        onTagsChange={handleTagChange}
                        entityType="lead"
                        entityId={leadId}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value={TAB_ACTIVITY}>
            <IconActivity className="size-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value={TAB_NOTES}>
            <IconNote className="size-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value={TAB_TASKS}>
            <IconChecklist className="size-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value={TAB_MEETINGS}>
            <IconCalendarEvent className="size-4" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value={TAB_CALLS}>
            <IconPhone className="size-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value={TAB_SMS}>
            <IconDeviceMobileMessage className="size-4" />
            SMS
            {!smsLoading && smsLogs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {smsLogs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value={TAB_EMAILS}>
            <IconMail className="size-4" />
            Emails
            {!emailsLoading && emails.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {emails.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value={TAB_FILES}>
            <IconPaperclip className="size-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value={TAB_DETAILS}>
            <IconFileDescription className="size-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value={TAB_SCORE}>
            <IconCurrencyDollar className="size-4" />
            Score
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value={TAB_ACTIVITY} className="pt-4">
          {activitiesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconActivity className="mb-2 size-10 text-muted-foreground" />
              <h4 className="mb-1 text-sm font-medium text-foreground">No activity yet</h4>
              <p className="max-w-sm text-sm text-muted-foreground">
                No activity has been logged for this lead yet. Actions like status changes, notes, and
                meetings will appear here.
              </p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute bottom-0 left-[17px] top-0 w-px bg-border" />

              <div className="space-y-0">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-0.5 flex shrink-0">
                      <div
                        className={cn(
                          'flex size-9 items-center justify-center rounded-full border-2 border-background',
                          getActivityIconBg(activity.type)
                        )}
                      >
                        <ActivityIcon type={activity.type} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1 pt-1">
                      <p className="text-sm text-foreground">{activity.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {activity.userId && (
                          <>
                            <span className="font-medium text-foreground/70">
                              {getUserName(activity.userId, 'Unknown')}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatRelativeTime(activity.timestamp)}</span>
                        {activity.metadata && (
                          <>
                            <span>•</span>
                            <span className="text-muted-foreground/70">
                              {formatActivityMeta(activity.metadata)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value={TAB_NOTES} className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <IconNote className="size-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NotesList entityType="lead" entityId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value={TAB_TASKS} className="pt-4">
          {tasksLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconChecklist className="mb-2 size-10 text-muted-foreground" />
              <h4 className="mb-1 text-sm font-medium text-foreground">No tasks</h4>
              <p className="max-w-sm text-sm text-muted-foreground">
                No tasks have been created for this lead yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const statusIcon =
                  task.status === 'completed'
                    ? 'bg-green-500'
                    : task.status === 'overdue'
                      ? 'bg-red-500'
                      : 'bg-yellow-500';
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium',
                          task.status === 'completed'
                            ? 'text-green-600 dark:text-green-400'
                            : task.status === 'overdue'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                        )}
                      >
                        <span className={cn('size-2.5 shrink-0 rounded-full', statusIcon)} />
                        {task.status === 'completed' ? 'Done' : task.status === 'overdue' ? 'Overdue' : 'Active'}
                      </span>
                      <div>
                        <p
                          className={cn(
                            'text-sm font-medium',
                            task.status === 'completed' && 'line-through text-muted-foreground'
                          )}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span>Due: {formatDate(task.dueDate)}</span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-normal',
                              task.priority === 'critical' && 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
                              task.priority === 'high' && 'border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400',
                              task.priority === 'medium' && 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400'
                            )}
                          >
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 text-[10px]',
                        task.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
                        task.status === 'overdue' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
                        task.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                      )}
                    >
                      {task.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value={TAB_MEETINGS} className="pt-4">
          {meetingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconCalendarEvent className="mb-2 size-10 text-muted-foreground" />
              <h4 className="mb-1 text-sm font-medium text-foreground">No meetings</h4>
              <p className="max-w-sm text-sm text-muted-foreground">
                No meetings have been scheduled with this lead yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{meeting.title}</h4>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {meeting.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(meeting.dateTime)} · {formatDuration(meeting.duration)}
                      </p>
                      {meeting.notes && (
                        <div className="mt-1 line-clamp-1">
                          <MarkdownContent content={meeting.notes} className="text-xs text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {meeting.outcome && (
                      <Badge className="shrink-0 text-xs">{meeting.outcome}</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value={TAB_CALLS} className="pt-4">
          <CallLogList
            callLogs={callLogs}
            loading={callLogsLoading}
            entityType="lead"
            entityId={leadId}
            onLogCall={logCall}
          />
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value={TAB_SMS} className="pt-4">
          <SmsHistory
            smsLogs={smsLogs}
            loading={smsLoading}
            entityType="lead"
            entityId={leadId}
            onSend={async (data) => {
              await sendSms({
                ...data,
                relatedToType: 'lead',
                relatedToId: leadId,
              });
              refreshSms();
            }}
            onRefresh={refreshSms}
            toNumber={lead.phone}
          />
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value={TAB_EMAILS} className="pt-4">
          <EmailHistory
            emails={emails}
            loading={emailsLoading}
            entityType="lead"
            entityId={leadId}
            onSend={async (data) => {
              await sendEmailHook({
                ...data,
                relatedToType: 'lead',
                relatedToId: leadId,
              });
              refreshEmails();
            }}
            onRefresh={refreshEmails}
            toAddress={lead.email}
          />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value={TAB_FILES} className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <IconPaperclip className="size-4" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileAttachmentList relatedToType="lead" relatedToId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value={TAB_DETAILS} className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <IconFileDescription className="size-4" />
                Lead Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Full Name" value={lead.fullName} />
                <DetailItem label="Email" value={lead.email || '—'} />
                <DetailItem label="Phone" value={lead.phone || '—'} />
                <DetailItem label="Company" value={lead.companyName || '—'} />
                <DetailItem label="Industry" value={lead.industry || '—'} />
                <DetailItem label="Country" value={lead.country || '—'} />
                <DetailItem label="Source" value={capitalizeFirst(lead.source)} />
                <DetailItem label="Status" value={capitalizeFirst(lead.status)} />
                <DetailItem label="Priority" value={capitalizeFirst(lead.priority)} />
                <DetailItem label="Assigned To" value={getUserName(lead.assignedTo, '—')} />
                <DetailItem label="Owner" value={getUserName(lead.ownerId, '—')} />
                <DetailItem
                  label="Estimated Value"
                  value={lead.estimatedValue > 0 ? formatCurrency(lead.estimatedValue) : '—'}
                />
                <DetailItem label="Created By" value={getUserName(lead.createdBy, 'Unknown')} />
                <DetailItem label="Updated By" value={getUserName(lead.updatedBy, 'Unknown')} />
                <DetailItem label="Created" value={formatDateTime(lead.createdAt)} />
                <DetailItem label="Last Updated" value={formatDateTime(lead.updatedAt)} />
              </dl>

              <Separator className="my-6" />

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tags
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {entityTags.length > 0 ? (
                      entityTags.map((tag) => (
                        <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground/50">—</span>
                    )}
                  </div>
                </div>
                {lead.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Notes
                    </p>
                    <div className="mt-1.5">
                      <MarkdownContent content={lead.notes} />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score Tab */}
        <TabsContent value={TAB_SCORE} className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {scoreLoading ? (
                    <Skeleton className="size-10 rounded-full" />
                  ) : (
                    <LeadScoreBadge score={leadScoreData?.score ?? 0} size="lg" showLabel />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">Lead Score</p>
                    <p className="text-xs text-muted-foreground">
                      {scoreLoading
                        ? 'Calculating...'
                        : leadScoreData
                          ? `Updated ${new Date(leadScoreData.updatedAt).toLocaleDateString()}`
                          : 'Not yet scored'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => recalculateScore()}
                  disabled={scoreLoading}
                >
                  <IconRefresh className={cn('size-4', scoreLoading && 'animate-spin')} />
                  Recalculate
                </Button>
              </div>

              {scoreError && (
                <div className="mt-4 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <span className="text-xs text-destructive">{scoreError}</span>
                  <Button variant="outline" size="sm" onClick={() => refreshScore()}>
                    Retry
                  </Button>
                </div>
              )}

              {leadScoreData && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SCORING_FACTORS.map((factor) => {
                    const value = leadScoreData.factors[factor.key] ?? 0;
                    if (value === 0) return null;
                    return (
                      <div key={factor.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-xs text-muted-foreground">{factor.label}</span>
                        <span className={cn('text-xs font-semibold tabular-nums', value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                          {value > 0 ? `+${value}` : value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule meeting dialog */}
      <LeadScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        lead={lead}
        onScheduled={handleMeetingScheduled}
      />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getActivityIconBg(type: string): string {
  switch (type) {
    case 'created':
      return 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400';
    case 'updated':
    case 'status_changed':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400';
    case 'deleted':
      return 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400';
    case 'note_added':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400';
    case 'meeting_scheduled':
    case 'meeting_completed':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400';
    case 'task_created':
    case 'task_completed':
      return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400';
    case 'communication_logged':
      return 'bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400';
    case 'assigned':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  }
}

function ActivityIcon({ type }: { type: string }) {
  const className = 'size-4';
  switch (type) {
    case 'created':
      return <IconUserCircle className={className} />;
    case 'updated':
    case 'status_changed':
      return <IconEdit className={className} />;
    case 'deleted':
      return <IconUserCircle className={className} />;
    case 'note_added':
      return <IconNote className={className} />;
    case 'meeting_scheduled':
    case 'meeting_completed':
      return <IconCalendarEvent className={className} />;
    case 'task_created':
    case 'task_completed':
      return <IconChecklist className={className} />;
    case 'communication_logged':
      return <IconMessage className={className} />;
    case 'assigned':
      return <IconUserCircle className={className} />;
    default:
      return <IconActivity className={className} />;
  }
}

function formatActivityMeta(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  if (metadata.from && metadata.to) {
    parts.push(`${String(metadata.from)} → ${String(metadata.to)}`);
  }
  if (metadata.value && typeof metadata.value === 'number') {
    parts.push(formatCurrency(metadata.value));
  }
  if (metadata.source && typeof metadata.source === 'string') {
    parts.push(`Source: ${metadata.source}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}
