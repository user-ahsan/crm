import type { RelatedEntityType } from './attachment.types';

export type MeetingType = 'online' | 'offline' | 'call' | 'video' | 'in_person' | 'other';

export interface Meeting {
  id: string;
  title: string;
  participants: string[];
  relatedToType?: RelatedEntityType;
  relatedToId?: string;
  dateTime: string;
  duration: number;
  type: MeetingType;
  notes?: string;
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingFormData {
  title: string;
  participants: string[];
  relatedToType?: RelatedEntityType;
  relatedToId?: string;
  dateTime: string;
  duration: number;
  type: MeetingType;
  notes?: string;
}
