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
import { LeadScoreBadge } from '@/components/leads/LeadScoreBadge';
import { useLeads } from '@/hooks/useLeads';
import { useLeadScore } from '@/hooks/useLeadScoring';
import { SCORING_FACTORS } from '@/lib/constants';
import { tagService } from '@/services/tag.service';
import type { Tag } from '@/types/tag.types';
import { useTasks } from '@/hooks/useTasks';
import { useMeetings } from '@/hooks/useMeetings';
import { useActivities } from '@/hooks/useActivities';
import { NotesList } from '@/components/communication/NotesList';
import { useCallLogs } from '@/hooks/useCallLogs';
import { CallLogList } from '@/components/communication/CallLogList';
import { FileAttachmentList } from '@/components/common/FileAttachmentList';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/color-tokens';
import { USERS } from '@/data/mock-users';
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
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export function LeadDetail({ leadId, onBack }: LeadDetailProps) {
  const { getById: getLeadById } = useLeads();
  const { score: leadScoreData, loading: scoreLoading, recalculate: recalculateScore } = useLeadScore(leadId);
  const { getByEntity: getTasksByEntity } = useTasks();
  const { getByEntity: getMeetingsByEntity } = useMeetings();
  const { getByEntity: getActivitiesByEntity } = useActivities();

  const [leadState, setLeadState] = useState<LoadState<Lead>>({ status: 'loading' });
  const [activeTab, setActiveTab] = useState('overview');

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
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const leadIdRef = useRef(leadId);
  useEffect(() => { leadIdRef.current = leadId; }, [leadId]);

  // ─── Data & State ─────────────────────────────────
  // Fetch lead data
  useEffect(() => {
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
  }, [getLeadById, leadId]);

  // Fetch tags for this lead
  useEffect(() => {
    if (leadState.status !== 'success') return;
    let cancelled = false;
    tagService.getTagsForEntity('lead', leadId).then((tags) => {
      if (!cancelled) setEntityTags(tags);
    }).catch(() => {});
    return () => { cancelled = true; };
    }, [leadState, leadId]);

  // ─── Event Handlers ───────────────────────────────
  const handleTagChange = useCallback(async (tags: Tag[]) => {
    setEntityTags(tags);
    const currentLeadId = leadIdRef.current;
    try {
      // Resolve all tag IDs — await creations so new tags get real IDs
      const tagIds = await Promise.all(
        tags.map(async (t) => {
          if (t.id.startsWith('new-')) {
            const created = await tagService.create(t.name, t.color);
            return created.id;
          }
          return t.id;
        }),
      );
      await tagService.setTagsForEntity('lead', currentLeadId, tagIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update tags';
      console.error('[LeadDetail] Tag update failed:', err);
      toast.error(message);
    }
  }, []);

  // Fetch related tasks, meetings, activities when tab changes or lead loads
  useEffect(() => {
    if (leadState.status !== 'success') return;
    const lead = leadState.data;
    let cancelled = false;

    if (activeTab === 'tasks' || activeTab === 'overview') {
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

    if (activeTab === 'meetings' || activeTab === 'overview') {
      setMeetingsLoading(true);
      getMeetingsByEntity('lead', lead.id).then((relatedMeetings) => {
        if (!cancelled) setMeetings(relatedMeetings);
      }).catch(() => {
        if (!cancelled) setMeetings([]);
      }).finally(() => {
        if (!cancelled) setMeetingsLoading(false);
      });
    }

    if (activeTab === 'activity' || activeTab === 'overview') {
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
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </Badge>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      PRIORITY_COLORS[lead.priority]
                    )}
                  >
                    {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                  </span>
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
              <Button variant="outline" size="sm">
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
                {lead.source.charAt(0).toUpperCase() + lead.source.slice(1)}
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
                      {getInitials(
                        USERS.find((u) => u.id === lead.assignedTo)?.name ?? '?'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {USERS.find((u) => u.id === lead.assignedTo)?.name ?? '—'}
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
                  by {USERS.find((u) => u.id === lead.createdBy)?.name ?? 'Unknown'}
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
                  by {USERS.find((u) => u.id === lead.updatedBy)?.name ?? 'Unknown'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <IconTags className="size-3.5" />
                Tags
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {entityTags.length > 0 ? (
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

      {/* Lead Score Card */}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <IconFileDescription className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="notes">
            <IconNote className="size-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <IconChecklist className="size-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="meetings">
            <IconCalendarEvent className="size-4" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="calls">
            <IconPhone className="size-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="activity">
            <IconActivity className="size-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="sms">
            <IconDeviceMobileMessage className="size-4" />
            SMS
            {!smsLoading && smsLogs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {smsLogs.length}
              </span>
            )}
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
          <TabsTrigger value="files">
            <IconPaperclip className="size-4" />
            Files
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          {/* Notes Section */}
          {lead.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <IconMessage className="size-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground">{lead.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Tasks Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <IconChecklist className="size-4" />
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks related to this lead.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs',
                            task.status === 'completed'
                              ? 'text-green-600 dark:text-green-400'
                              : task.status === 'overdue'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-yellow-600 dark:text-yellow-400'
                          )}
                        >
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              task.status === 'completed'
                                ? 'bg-green-500'
                                : task.status === 'overdue'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                            )}
                          />
                          {task.status === 'completed' ? 'Done' : task.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </span>
                        <span className="text-sm font-medium text-foreground">{task.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                      </span>
                    </div>
                  ))}
                  {tasks.length > 3 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      +{tasks.length - 3} more task{tasks.length - 3 === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meetings Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <IconCalendarEvent className="size-4" />
                Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meetingsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No meetings scheduled with this lead.</p>
              ) : (
                <div className="space-y-2">
                  {meetings.slice(0, 3).map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(meeting.dateTime)} · {formatDuration(meeting.duration)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {meeting.type}
                      </Badge>
                    </div>
                  ))}
                  {meetings.length > 3 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      +{meetings.length - 3} more meeting{meetings.length - 3 === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="pt-4">
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
        <TabsContent value="tasks" className="pt-4">
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
        <TabsContent value="meetings" className="pt-4">
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
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {meeting.notes}
                        </p>
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
        <TabsContent value="calls" className="pt-4">
          <CallLogList
            callLogs={callLogs}
            loading={callLogsLoading}
            entityType="lead"
            entityId={leadId}
            onLogCall={logCall}
          />
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="pt-4">
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
        <TabsContent value="emails" className="pt-4">
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
        <TabsContent value="files" className="pt-4">
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

        {/* Activity Tab */}
        <TabsContent value="activity" className="pt-4">
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
                              {USERS.find((u) => u.id === activity.userId)?.name ?? 'Unknown'}
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
      </Tabs>
    </div>
  );
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
    parts.push(`${metadata.from as string} → ${metadata.to as string}`);
  }
  if (metadata.value && typeof metadata.value === 'number') {
    parts.push(formatCurrency(metadata.value));
  }
  if (metadata.source && typeof metadata.source === 'string') {
    parts.push(`Source: ${metadata.source}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}
