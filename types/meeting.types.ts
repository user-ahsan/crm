export type MeetingType = 'online' | 'offline' | 'call';

export interface Meeting {
  id: string;
  title: string;
  participants: string[];
  relatedToType?: string;
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
  relatedToType?: string;
  relatedToId?: string;
  dateTime: string;
  duration: number;
  type: MeetingType;
  notes?: string;
}
