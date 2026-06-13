'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact } from '@/types/contact.types';
import type { Lead } from '@/types/lead.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagBadge } from '@/components/common/TagBadge';
import { TagInput } from '@/components/common/TagInput';
import { tagService } from '@/services/tag.service';
import type { Tag } from '@/types/tag.types';
import { contactService } from '@/services/contact.service';
import { leadService } from '@/services/lead.service';
import { taskService } from '@/services/task.service';
import { meetingService } from '@/services/meeting.service';
import { companyService } from '@/services/company.service';
import type { Company } from '@/types/company.types';
import { formatDate, getInitials, formatCurrency } from '@/lib/formatters';
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
  IconNote,
  IconTags,
  IconAlertCircle,
  IconLoader2,
} from '@tabler/icons-react';

interface ContactDetailProps {
  contactId: string;
  onBack?: () => void;
}

type ActiveTab = 'overview' | 'leads' | 'meetings' | 'tasks' | 'notes';

export function ContactDetail({ contactId, onBack }: ContactDetailProps) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [linkedLeads, setLinkedLeads] = useState<Lead[]>([]);
  const [relatedTasks, setRelatedTasks] = useState<Task[]>([]);
  const [relatedMeetings, setRelatedMeetings] = useState<Meeting[]>([]);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [entityTags, setEntityTags] = useState<Tag[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [found, allCompanies] = await Promise.all([
        contactService.getById(contactId),
        companyService.getAll(),
      ]);
      if (!found) {
        setError('Contact not found');
        setLoading(false);
        return;
      }
      setContact(found);

      if (found.companyId) {
        setCompany(allCompanies.find((c) => c.id === found.companyId));
      }

      const leadResults = await Promise.all(
        found.leadIds.map((leadId) => leadService.getById(leadId)),
      );
      setLinkedLeads(leadResults.filter((l): l is Lead => l !== undefined));

      const tasks = await taskService.getByEntity('contact', contactId);
      setRelatedTasks(tasks);

      tagService.getTagsForEntity('contact', contactId).then((tags) => setEntityTags(tags)).catch(() => {});

      const meetings = await meetingService.getByEntity('contact', contactId);
      setRelatedMeetings(meetings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contact details');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTagChange = useCallback(async (tags: Tag[]) => {
    setEntityTags(tags);
    const tagIds = tags.map((t) => t.id).filter((id) => !id.startsWith('new-'));
    for (const tag of tags.filter((t) => t.id.startsWith('new-'))) {
      const created = await tagService.create(tag.name, tag.color);
      if (created) tagIds.push(created.id);
    }
    tagService.setTagsForEntity('contact', contactId, tagIds).catch(() => {});
  }, [contactId]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.push('/contacts');
    }
  }, [onBack, router]);

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

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-muted-foreground">
          <IconUsers size={48} stroke={1.5} />
        </div>
        <h3 className="mb-1 text-lg font-semibold">Contact not found</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          The contact you are looking for does not exist or has been deleted.
        </p>
        <Button variant="outline" onClick={handleBack}>
          Back to Contacts
        </Button>
      </div>
    );
  }

  // company loaded via loadData into state

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
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          task.status === 'completed'
                            ? 'default'
                            : task.status === 'overdue'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs font-normal"
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

        {/* Notes Tab */}
        <TabsContent value="notes">
          {contact.notes ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start gap-2">
                  <IconNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {contact.notes}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconNote className="mb-3 size-8 text-muted-foreground" />
              <h3 className="mb-1 text-base font-medium">No notes</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                No notes have been added for this contact.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ContactDetail;
