'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact } from '@/types/contact.types';
import type { Lead } from '@/types/lead.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import type { Activity } from '@/types/activity.types';
import type { Tag } from '@/types/tag.types';
import type { Company } from '@/types/company.types';
import { useEmail } from '@/hooks/useEmail';
import { EmailHistory } from '@/components/communication/EmailHistory';
import { useSms } from '@/hooks/useSms';
import { SmsHistory } from '@/components/communication/SmsHistory';
import { useCompanies } from '@/hooks/useCompanies';
import { useLeads } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { useMeetings } from '@/hooks/useMeetings';
import { useTags } from '@/hooks/useTags';
import { useActivities } from '@/hooks/useActivities';
import { ActivityTimeline } from '@/components/common/ActivityTimeline';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagBadge } from '@/components/common/TagBadge';
import { TagInput } from '@/components/common/TagInput';
import { formatDate, getInitials, formatCurrency } from '@/lib/formatters';
import { useCallLogs } from '@/hooks/useCallLogs';
import { CallLogList } from '@/components/communication/CallLogList';
import { NotesList } from '@/components/communication/NotesList';
import { FileAttachmentList } from '@/components/common/FileAttachmentList';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconMail,
  IconPhone,
  IconBriefcase,
  IconBuilding,
  IconMapPin,
  IconUsers,
  IconCalendarEvent,
  IconCheckbox,
  IconTags,
  IconAlertCircle,
  IconLoader2,
  IconPaperclip,
  IconDeviceMobileMessage,
  IconActivity,
} from '@tabler/icons-react';

interface ContactDetailProps {
  contactId: string;
  /** Contact entity fetched by the page — single source of truth. */
  contact: Contact;
  onBack?: () => void;
}

type ActiveTab = 'overview' | 'activity' | 'leads' | 'meetings' | 'tasks' | 'notes' | 'calls' | 'emails' | 'sms';

export function ContactDetail({ contactId, contact, onBack }: ContactDetailProps) {
  const router = useRouter();
  const [linkedLeads, setLinkedLeads] = useState<Lead[]>([]);
  const [relatedTasks, setRelatedTasks] = useState<Task[]>([]);
  const [relatedMeetings, setRelatedMeetings] = useState<Meeting[]>([]);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [activities, setActivities] = useState<Activity[]>([]);

  const { getById: getCompanyById } = useCompanies();
  const { getById: getLeadById } = useLeads();
  const { getByEntity: getTasksByEntity } = useTasks();
  const { getByEntity: getMeetingsByEntity } = useMeetings();
  const { getEntityTags, createTag, addEntityTag, removeEntityTag } = useTags();
  const { getByEntity: getActivitiesByEntity } = useActivities();

  const { callLogs, loading: callLogsLoading, logCall } = useCallLogs('contact', contactId);
  const {
    emails,
    loading: emailsLoading,
    sendEmail: sendEmailHook,
    refresh: refreshEmails,
  } = useEmail('contact', contactId);
  const { smsLogs, loading: smsLoading, sendSms, refresh: refreshSms } = useSms('contact', contactId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [entityTags, setEntityTags] = useState<Tag[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // ─── Data & State ─────────────────────────────────
  // Single load path: company + linked leads + tasks + tags + meetings +
  // activities (the contact entity itself is a prop owned by the page).
  // Runs on mount and from the error-retry button.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyResult, leadResults, tasks, meetings, tags, activityResults] = await Promise.all([
        contact.companyId ? getCompanyById(contact.companyId) : Promise.resolve(undefined),
        Promise.all(contact.leadIds.map((leadId) => getLeadById(leadId))),
        getTasksByEntity('contact', contactId),
        getMeetingsByEntity('contact', contactId),
        getEntityTags('contact', contactId),
        getActivitiesByEntity('contact', contactId),
      ]);
      setCompany(companyResult);
      setLinkedLeads(leadResults.filter((l): l is Lead => l !== undefined));
      setRelatedTasks(tasks);
      setRelatedMeetings(meetings);
      setEntityTags(tags);
      setActivities(activityResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contact details');
    } finally {
      setLoading(false);
    }
  }, [
    contactId,
    contact.companyId,
    contact.leadIds,
    getCompanyById,
    getLeadById,
    getTasksByEntity,
    getMeetingsByEntity,
    getEntityTags,
    getActivitiesByEntity,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Event Handlers ───────────────────────────────
  const handleTagChange = useCallback(
    async (tags: Tag[]) => {
      const prevTags = entityTags;
      setEntityTags(tags);

      const previousIds = new Set(prevTags.map((t) => t.id));
      const nextIds = new Set(tags.map((t) => t.id));
      const toAdd = tags.filter((t) => !previousIds.has(t.id));
      const toRemove = prevTags.filter((t) => !nextIds.has(t.id));

      try {
        // Create on-the-fly tags first so they get real ids.
        const createdIdByTempId = new Map<string, string>();
        for (const tag of toAdd) {
          if (!tag.id.startsWith('new-')) continue;
          const created = await createTag(tag.name, tag.color);
          if (!created) throw new Error(`Failed to create tag "${tag.name}"`);
          createdIdByTempId.set(tag.id, created.id);
        }

        for (const tag of toAdd) {
          const tagId = createdIdByTempId.get(tag.id) ?? tag.id;
          const ok = await addEntityTag('contact', contactId, tagId);
          if (!ok) throw new Error('Failed to save tag changes');
        }
        for (const tag of toRemove) {
          const ok = await removeEntityTag('contact', contactId, tag.id);
          if (!ok) throw new Error('Failed to save tag changes');
        }

        // Replace temp ids with the real ones so re-opening the picker is consistent.
        if (createdIdByTempId.size > 0) {
          setEntityTags((current) =>
            current.map((t) => createdIdByTempId.get(t.id) ?? t),
          );
        }
      } catch (e) {
        // Revert optimistic tag state and surface the failure.
        setEntityTags(prevTags);
        toast.error(e instanceof Error ? e.message : 'Failed to save tags');
      }
    },
    [entityTags, contactId, createTag, addEntityTag, removeEntityTag],
  );

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/contacts');
    }
  }, [onBack, router]);

  // ─── Render ───────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading contact details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-destructive">
          <IconAlertCircle size={48} stroke={1.5} />
        </div>
        <h3 className="mb-1 text-lg font-semibold">Failed to load contact</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={loadData}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={handleBack} aria-label="Go back">
          <IconArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(contact.createdAt)}
          </p>
        </div>
      </div>

      <Separator />

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar size="lg">
              <AvatarFallback className="text-lg">{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h2 className="text-lg font-semibold">{contact.name}</h2>
                {contact.jobTitle && (
                  <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconMail className="size-4" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconPhone className="size-4" />
                    {contact.phone}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 sm:justify-start">
                {contact.jobTitle && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <IconBriefcase className="size-4" />
                    {contact.jobTitle}
                  </span>
                )}
                {company && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <IconBuilding className="size-4" />
                    {company.name}
                  </span>
                )}
                {contact.location && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <IconMapPin className="size-4" />
                    {contact.location}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                {entityTags.length > 0 ? (
                  entityTags.map((tag) => (
                    <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground/50">—</span>
                )}
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger render={<Button variant="ghost" size="icon-sm" className="size-5" />}>
                    <IconTags className="size-3" />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Edit Tags</p>
                      <TagInput
                        selectedTags={entityTags}
                        onTagsChange={handleTagChange}
                        entityType="contact"
                        entityId={contactId}
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
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as ActiveTab)}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">
            <IconActivity className="size-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="leads">
            Linked Leads
            {linkedLeads.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {linkedLeads.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="meetings">
            Meetings
            {relatedMeetings.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {relatedMeetings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {relatedTasks.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {relatedTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="calls">
            Calls
            {callLogs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                {callLogs.length}
              </span>
            )}
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
        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{contact.email || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{contact.phone || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job Title</span>
                  <span>{contact.jobTitle || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <span>{company?.name || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span>{contact.location || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Leads</span>
                  <span className="font-medium tabular-nums">{linkedLeads.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Related Tasks</span>
                  <span className="font-medium tabular-nums">{relatedTasks.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Related Meetings</span>
                  <span className="font-medium tabular-nums">{relatedMeetings.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="tabular-nums">{formatDate(contact.createdAt)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="tabular-nums">{formatDate(contact.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <IconActivity className="size-4" />
                Activity History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} maxHeight="480px" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linked Leads Tab */}
        <TabsContent value="leads">
          {linkedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconUsers className="mb-3 size-8 text-muted-foreground" />
              <h3 className="mb-1 text-base font-medium">No linked leads</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                This contact is not linked to any leads.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedLeads.map((lead) => (
                <Card key={lead.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/leads/${lead.id}`)}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{lead.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.companyName} — {lead.industry}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {lead.status}
                      </Badge>
                      {lead.estimatedValue > 0 && (
                        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(lead.estimatedValue)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings">
          {relatedMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconCalendarEvent className="mb-3 size-8 text-muted-foreground" />
              <h3 className="mb-1 text-base font-medium">No meetings</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                No meetings have been scheduled for this contact.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {relatedMeetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{meeting.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(meeting.dateTime)} — {meeting.duration}min
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {meeting.type}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          {relatedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconCheckbox className="mb-3 size-8 text-muted-foreground" />
              <h3 className="mb-1 text-base font-medium">No tasks</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                No tasks have been assigned for this contact.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {relatedTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          task.status === 'completed'
                            ? 'default'
                            : task.status === 'overdue'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs font-normal capitalize"
                      >
                        {task.status}
                      </Badge>
                      {task.dueDate && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls">
          <CallLogList
            callLogs={callLogs}
            loading={callLogsLoading}
            entityType="contact"
            entityId={contactId}
            onLogCall={logCall}
          />
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="pt-4">
          <SmsHistory
            smsLogs={smsLogs}
            loading={smsLoading}
            entityType="contact"
            entityId={contactId}
            onSend={async (data) => {
              await sendSms({
                ...data,
                relatedToType: 'contact',
                relatedToId: contactId,
              });
              refreshSms();
            }}
            onRefresh={refreshSms}
            toNumber={contact?.phone}
          />
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="pt-4">
          <EmailHistory
            emails={emails}
            loading={emailsLoading}
            entityType="contact"
            entityId={contactId}
            onSend={async (data) => {
              await sendEmailHook({
                ...data,
                relatedToType: 'contact',
                relatedToId: contactId,
              });
              refreshEmails();
            }}
            onRefresh={refreshEmails}
            toAddress={contact?.email}
          />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <IconPaperclip className="size-4" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileAttachmentList relatedToType="contact" relatedToId={contactId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <NotesList entityType="contact" entityId={contactId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ContactDetail;
