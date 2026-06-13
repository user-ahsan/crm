import type { Meeting, MeetingType } from '@/types/meeting.types';

export interface MeetingFilters {
  search?: string;
  type?: MeetingType;
  dateFrom?: string;
  dateTo?: string;
  participant?: string;
}

export function applyMeetingFilters(meetings: Meeting[], filters: MeetingFilters): Meeting[] {
  return meetings.filter((meeting) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const matchesSearch =
        meeting.title.toLowerCase().includes(s) ||
        meeting.participants.some((p) => p.toLowerCase().includes(s)) ||
        meeting.notes?.toLowerCase().includes(s);
      if (!matchesSearch) return false;
    }
    if (filters.type && meeting.type !== filters.type) return false;
    if (filters.dateFrom && meeting.dateTime < filters.dateFrom) return false;
    if (filters.dateTo && meeting.dateTime > filters.dateTo) return false;
    if (filters.participant && !meeting.participants.includes(filters.participant)) return false;
    return true;
  });
}

export function sortMeetings(
  meetings: Meeting[],
  by: 'dateTime' | 'createdAt' | 'title' = 'dateTime',
  dir: 'asc' | 'desc' = 'desc',
): Meeting[] {
  return [...meetings].sort((a, b) => {
    const valA = a[by];
    const valB = b[by];
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
    return dir === 'desc' ? -cmp : cmp;
  });
}
