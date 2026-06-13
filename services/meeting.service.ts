import { meetings } from '@/data/meetings';
import { activities } from '@/data/activities';
import type { Meeting, MeetingFormData } from '@/types/meeting.types';
import { generateId } from '@/lib/formatters';

export const meetingService = {
  getAll(): Meeting[] {
    return [...meetings];
  },

  getById(id: string): Meeting | undefined {
    return meetings.find((m) => m.id === id);
  },

  getByEntity(entityType: string, entityId: string): Meeting[] {
    return meetings.filter((m) => m.relatedToType === entityType && m.relatedToId === entityId);
  },

  getByDateRange(start: string, end: string): Meeting[] {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return meetings.filter((m) => {
      const meetingDate = new Date(m.dateTime);
      return meetingDate >= startDate && meetingDate <= endDate;
    });
  },

  getUpcoming(limit = 5): Meeting[] {
    const now = new Date();
    const upcoming = meetings
      .filter((m) => new Date(m.dateTime) >= now)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    return upcoming.slice(0, limit);
  },

  create(data: MeetingFormData): Meeting {
    const now = new Date().toISOString();
    const newMeeting: Meeting = {
      ...data,
      id: `meeting-${generateId().slice(0, 8)}`,
      participants: data.participants || [],
      createdAt: now,
      updatedAt: now,
    };
    meetings.unshift(newMeeting);

    const activityDesc = `Meeting scheduled: ${newMeeting.title}`;
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'meeting',
      entityId: newMeeting.id,
      type: 'meeting_scheduled',
      description: activityDesc,
      timestamp: now,
      metadata: { date: data.dateTime },
    });

    if (data.relatedToType && data.relatedToId) {
      activities.push({
        id: `act-${generateId().slice(0, 8)}`,
        entityType: data.relatedToType,
        entityId: data.relatedToId,
        type: 'meeting_scheduled',
        description: `Meeting scheduled: ${newMeeting.title}`,
        timestamp: now,
      });
    }

    return newMeeting;
  },

  update(id: string, data: Partial<MeetingFormData & { outcome: string }>): Meeting | undefined {
    const index = meetings.findIndex((m) => m.id === id);
    if (index === -1) return undefined;
    const updated = {
      ...meetings[index],
      ...data,
      participants: data.participants ?? meetings[index].participants,
      updatedAt: new Date().toISOString(),
    };
    meetings[index] = updated;
    return updated;
  },

  delete(id: string): boolean {
    const index = meetings.findIndex((m) => m.id === id);
    if (index === -1) return false;
    meetings.splice(index, 1);
    return true;
  },
};
