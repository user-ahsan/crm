/* eslint-disable @typescript-eslint/no-empty-object-type */

import type {
  LeadStatus,
  LeadPriority,
  LeadSource,
} from '@/types/lead.types';
import type { CompanySize } from '@/types/company.types';
import type { TaskPriority, TaskStatus, RelatedEntityType } from '@/types/task.types';
import type { MeetingType } from '@/types/meeting.types';
import type { ActivityType } from '@/types/activity.types';

// ──────────────────────────────────────────────
// Database public schema definition
// ──────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
      };
      contacts: {
        Row: ContactRow;
        Insert: ContactInsert;
        Update: ContactUpdate;
      };
      companies: {
        Row: CompanyRow;
        Insert: CompanyInsert;
        Update: CompanyUpdate;
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskInsert;
        Update: TaskUpdate;
      };
      meetings: {
        Row: MeetingRow;
        Insert: MeetingInsert;
        Update: MeetingUpdate;
      };
      activities: {
        Row: ActivityRow;
        Insert: ActivityInsert;
        Update: ActivityUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ──────────────────────────────────────────────
// Helper convenience types
// ──────────────────────────────────────────────

/** Maps a table name to its Row type. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/** Maps a table name to its Insert type. */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/** Maps a table name to its Update type. */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// ──────────────────────────────────────────────
// Row types – mirrors database columns exactly
// ──────────────────────────────────────────────

export interface LeadRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assigned_to: string | null;
  estimated_value: number;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_id: string | null;
  lead_ids: string[];
  location: string | null;
  social_links: string[];
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyRow {
  id: string;
  name: string;
  industry: string | null;
  size: CompanySize | null;
  revenue: number;
  location: string | null;
  website: string | null;
  contact_ids: string[];
  lead_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  related_to_type: RelatedEntityType | null;
  related_to_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface MeetingRow {
  id: string;
  title: string;
  participants: string[];
  related_to_type: string | null;
  related_to_id: string | null;
  date_time: string;
  duration: number;
  type: MeetingType;
  notes: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  entity_type: string;
  entity_id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

// ──────────────────────────────────────────────
// Insert types – omit server-generated fields
// ──────────────────────────────────────────────

export interface LeadInsert {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  industry?: string | null;
  country?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
  assigned_to?: string | null;
  estimated_value?: number;
  tags?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContactInsert {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  lead_ids?: string[];
  location?: string | null;
  social_links?: string[];
  tags?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyInsert {
  id?: string;
  name: string;
  industry?: string | null;
  size?: CompanySize | null;
  revenue?: number;
  location?: string | null;
  website?: string | null;
  contact_ids?: string[];
  lead_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface TaskInsert {
  id?: string;
  title: string;
  description?: string | null;
  related_to_type?: RelatedEntityType | null;
  related_to_id?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  created_at?: string;
  updated_at?: string;
}

export interface MeetingInsert {
  id?: string;
  title: string;
  participants?: string[];
  related_to_type?: string | null;
  related_to_id?: string | null;
  date_time: string;
  duration?: number;
  type?: MeetingType;
  notes?: string | null;
  outcome?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityInsert {
  id?: string;
  entity_type: string;
  entity_id: string;
  type: ActivityType;
  description: string;
  timestamp?: string;
  metadata?: Record<string, unknown> | null;
}

// ──────────────────────────────────────────────
// Update types – all fields optional
// ──────────────────────────────────────────────

export interface LeadUpdate {
  id?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  industry?: string | null;
  country?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
  assigned_to?: string | null;
  estimated_value?: number;
  tags?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContactUpdate {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  lead_ids?: string[];
  location?: string | null;
  social_links?: string[];
  tags?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyUpdate {
  id?: string;
  name?: string;
  industry?: string | null;
  size?: CompanySize | null;
  revenue?: number;
  location?: string | null;
  website?: string | null;
  contact_ids?: string[];
  lead_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface TaskUpdate {
  id?: string;
  title?: string;
  description?: string | null;
  related_to_type?: RelatedEntityType | null;
  related_to_id?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  created_at?: string;
  updated_at?: string;
}

export interface MeetingUpdate {
  id?: string;
  title?: string;
  participants?: string[];
  related_to_type?: string | null;
  related_to_id?: string | null;
  date_time?: string;
  duration?: number;
  type?: MeetingType;
  notes?: string | null;
  outcome?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityUpdate {
  id?: string;
  entity_type?: string;
  entity_id?: string;
  type?: ActivityType;
  description?: string;
  timestamp?: string;
  metadata?: Record<string, unknown> | null;
}

// ──────────────────────────────────────────────
// DbXxx aliases for service layer compatibility
// ──────────────────────────────────────────────

export type DbLead = LeadRow;
export type DbContact = ContactRow;
export type DbCompany = CompanyRow;
export type DbTask = TaskRow;
export type DbMeeting = MeetingRow;
export type DbActivity = ActivityRow;
