import type {
  LeadStatus,
  LeadPriority,
  LeadSource,
} from '@/types/lead.types';
import type { CompanySize } from '@/types/company.types';
import type { TaskPriority, TaskStatus, RelatedEntityType } from '@/types/task.types';
import type { MeetingType } from '@/types/meeting.types';
import type { ActivityType } from '@/types/activity.types';
import type { AutomationTriggerEvent, AutomationCondition, AutomationAction } from '@/types/automation.types';
import type { CallDirection, CallResult } from '@/types/communication.types';
import type { QuoteStatus } from '@/types/quote.types';
import type { GoalType, GoalPeriod } from '@/types/goal.types';
import type { WorkflowEntityType } from '@/types/workflow.types';

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
      teams: {
        Row: TeamRow;
        Insert: TeamInsert;
        Update: TeamUpdate;
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: TeamMemberInsert;
        Update: TeamMemberUpdate;
      };
      team_invitations: {
        Row: TeamInvitationRow;
        Insert: TeamInvitationInsert;
        Update: TeamInvitationUpdate;
      };
      automation_rules: {
        Row: AutomationRuleRow;
        Insert: AutomationRuleInsert;
        Update: AutomationRuleUpdate;
      };
      email_history: {
        Row: EmailHistoryRow;
        Insert: EmailHistoryInsert;
        Update: EmailHistoryUpdate;
      };
      call_logs: {
        Row: CallLogRow;
        Insert: CallLogInsert;
        Update: CallLogUpdate;
      };
      tags: {
        Row: TagRow;
        Insert: TagInsert;
        Update: TagUpdate;
      };
      taggings: {
        Row: TaggingRow;
        Insert: TaggingInsert;
        Update: TaggingUpdate;
      };
      notes: {
        Row: NoteRow;
        Insert: NoteInsert;
        Update: NoteUpdate;
      };
      lead_scores: {
        Row: LeadScoreRow;
        Insert: LeadScoreInsert;
        Update: LeadScoreUpdate;
      };
      deal_stages: {
        Row: DealStageRow;
        Insert: DealStageInsert;
        Update: DealStageUpdate;
      };
      deals: {
        Row: DealRow;
        Insert: DealInsert;
        Update: DealUpdate;
      };
      quotes: {
        Row: QuoteRow;
        Insert: QuoteInsert;
        Update: QuoteUpdate;
      };
      quote_items: {
        Row: QuoteItemRow;
        Insert: QuoteItemInsert;
        Update: QuoteItemUpdate;
      };
      forecasts: {
        Row: ForecastRow;
        Insert: ForecastInsert;
        Update: ForecastUpdate;
      };
      file_attachments: {
        Row: FileAttachmentRow;
        Insert: FileAttachmentInsert;
        Update: FileAttachmentUpdate;
      };
      goals: {
        Row: GoalRow;
        Insert: GoalInsert;
        Update: GoalUpdate;
      };
      email_sequences: {
        Row: EmailSequenceRow;
        Insert: EmailSequenceInsert;
        Update: EmailSequenceUpdate;
      };
      campaign_emails: {
        Row: CampaignEmailRow;
        Insert: CampaignEmailInsert;
        Update: CampaignEmailUpdate;
      };
      saved_views: {
        Row: SavedViewRow;
        Insert: SavedViewInsert;
        Update: SavedViewUpdate;
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
      };
      workflow_states: {
        Row: WorkflowStateRow;
        Insert: WorkflowStateInsert;
        Update: WorkflowStateUpdate;
      };
      workflow_transitions: {
        Row: WorkflowTransitionRow;
        Insert: WorkflowTransitionInsert;
        Update: WorkflowTransitionUpdate;
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
  tags: string[];
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
  tags?: string[];
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
  tags?: string[];
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
// Email History types
// ──────────────────────────────────────────────

export interface EmailHistoryRow {
  id: string;
  from_address: string;
  to_address: string;
  subject: string;
  body: string;
  direction: string;
  status: string;
  related_to_type: string | null;
  related_to_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailHistoryInsert {
  id?: string;
  from_address: string;
  to_address: string;
  subject: string;
  body: string;
  direction: string;
  status?: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  sent_at?: string | null;
}

export interface EmailHistoryUpdate {
  id?: string;
  from_address?: string;
  to_address?: string;
  subject?: string;
  body?: string;
  direction?: string;
  status?: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  sent_at?: string | null;
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
export type DbEmailHistory = EmailHistoryRow;

// ──────────────────────────────────────────────
// Team types
// ──────────────────────────────────────────────

export interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface TeamInsert {
  id?: string;
  name: string;
  description?: string | null;
  created_by: string;
  invite_code?: string;
}

export interface TeamUpdate {
  id?: string;
  name?: string;
  description?: string | null;
  created_by?: string;
  invite_code?: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface TeamMemberInsert {
  id?: string;
  team_id: string;
  user_id: string;
  role: string;
}

export interface TeamMemberUpdate {
  id?: string;
  team_id?: string;
  user_id?: string;
  role?: string;
}

export interface TeamInvitationRow {
  id: string;
  team_id: string;
  email: string;
  role: string;
  invited_by: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface TeamInvitationInsert {
  id?: string;
  team_id: string;
  email: string;
  role: string;
  invited_by: string;
  status?: string;
  expires_at?: string;
}

export interface TeamInvitationUpdate {
  id?: string;
  team_id?: string;
  email?: string;
  role?: string;
  invited_by?: string;
  status?: string;
  expires_at?: string;
}

// ──────────────────────────────────────────────
// Call log types
// ──────────────────────────────────────────────

export interface CallLogRow {
  id: string;
  direction: CallDirection;
  duration: number;
  caller: string;
  callee: string;
  notes: string;
  call_result: CallResult;
  related_to_type: string | null;
  related_to_id: string | null;
  created_by: string;
  created_at: string;
}

export interface CallLogInsert {
  id?: string;
  direction: CallDirection;
  duration?: number;
  caller: string;
  callee: string;
  notes?: string;
  call_result?: CallResult;
  related_to_type?: string | null;
  related_to_id?: string | null;
  created_by: string;
  created_at?: string;
}

export interface CallLogUpdate {
  id?: string;
  direction?: CallDirection;
  duration?: number;
  caller?: string;
  callee?: string;
  notes?: string;
  call_result?: CallResult;
  related_to_type?: string | null;
  related_to_id?: string | null;
  created_by?: string;
  created_at?: string;
}

export type DbCallLog = CallLogRow;

// ──────────────────────────────────────────────
// Tag types
// ──────────────────────────────────────────────

export interface TagRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TagInsert {
  id?: string;
  name: string;
  color?: string;
}

export interface TagUpdate {
  id?: string;
  name?: string;
  color?: string;
}

export interface TaggingRow {
  id: string;
  tag_id: string;
  taggable_id: string;
  taggable_type: string;
  created_at: string;
}

export interface TaggingInsert {
  id?: string;
  tag_id: string;
  taggable_id: string;
  taggable_type: string;
}

export interface TaggingUpdate {
  id?: string;
  tag_id?: string;
  taggable_id?: string;
  taggable_type?: string;
}

export type DbTag = TagRow;
export type DbTagging = TaggingRow;

// ── Note types ─────────────────────────────────────────

export interface NoteRow {
  id: string;
  title: string;
  body: string;
  related_to_type: string | null;
  related_to_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NoteInsert {
  id?: string;
  title?: string;
  body: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  created_by: string;
}

export interface NoteUpdate {
  id?: string;
  title?: string;
  body?: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  created_by?: string;
}

export type DbNote = NoteRow;

// ── Forecast types ──────────────────────────────────────

export interface ForecastRow {
  id: string;
  year: number;
  month: number;
  target: number;
  actual: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ForecastInsert {
  id?: string;
  year: number;
  month: number;
  target?: number;
  actual?: number;
  created_by: string;
}

export interface ForecastUpdate {
  id?: string;
  year?: number;
  month?: number;
  target?: number;
  actual?: number;
  created_by?: string;
}

// ── Automation Rule types ──────────────────────────────

export interface AutomationRuleRow {
  id: string;
  name: string;
  description: string;
  trigger_event: AutomationTriggerEvent;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleInsert {
  id?: string;
  name: string;
  description?: string;
  trigger_event: AutomationTriggerEvent;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
  enabled?: boolean;
  created_by: string;
}

export interface AutomationRuleUpdate {
  id?: string;
  name?: string;
  description?: string;
  trigger_event?: AutomationTriggerEvent;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
  enabled?: boolean;
  created_by?: string;
}

export type DbAutomationRule = AutomationRuleRow;

export type DbTeam = TeamRow;
export type DbTeamMember = TeamMemberRow;
export type DbTeamInvitation = TeamInvitationRow;

// ── Deal Stage types ──────────────────────────────────────

export interface DealStageRow {
  id: string;
  name: string;
  color: string;
  probability: number;
  sort_order: number;
  created_at: string;
}

export interface DealStageInsert {
  id?: string;
  name: string;
  color?: string;
  probability?: number;
  sort_order?: number;
}

export interface DealStageUpdate {
  id?: string;
  name?: string;
  color?: string;
  probability?: number;
  sort_order?: number;
}

export type DbDealStage = DealStageRow;

// ── Lead Score types ──────────────────────────────────────

export interface LeadScoreRow {
  id: string;
  lead_id: string;
  score: number;
  factors: Record<string, number>;
  updated_at: string;
}

export interface LeadScoreInsert {
  id?: string;
  lead_id: string;
  score: number;
  factors?: Record<string, number>;
}

export interface LeadScoreUpdate {
  id?: string;
  lead_id?: string;
  score?: number;
  factors?: Record<string, number>;
  updated_at?: string;
}

export type DbLeadScore = LeadScoreRow;

// ── Deal types ────────────────────────────────────────────

export interface DealRow {
  id: string;
  title: string;
  description: string;
  value: number;
  currency: string;
  stage_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  assigned_to: string | null;
  close_date: string | null;
  win_loss_reason: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DealInsert {
  id?: string;
  title: string;
  description?: string;
  value?: number;
  currency?: string;
  stage_id?: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  assigned_to?: string | null;
  close_date?: string | null;
  win_loss_reason?: string;
  tags?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DealUpdate {
  id?: string;
  title?: string;
  description?: string;
  value?: number;
  currency?: string;
  stage_id?: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  assigned_to?: string | null;
  close_date?: string | null;
  win_loss_reason?: string;
  tags?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type DbDeal = DealRow;
export type DbForecast = ForecastRow;

// ── Quote types ─────────────────────────────────────────────

export interface QuoteRow {
  id: string;
  title: string;
  deal_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  status: QuoteStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes: string;
  valid_until: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteInsert {
  id?: string;
  title: string;
  deal_id?: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  status?: QuoteStatus;
  subtotal?: number;
  discount?: number;
  total?: number;
  notes?: string;
  valid_until?: string | null;
  created_by: string;
}

export interface QuoteUpdate {
  id?: string;
  title?: string;
  deal_id?: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  status?: QuoteStatus;
  subtotal?: number;
  discount?: number;
  total?: number;
  notes?: string;
  valid_until?: string | null;
}

export interface QuoteItemRow {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface QuoteItemInsert {
  id?: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order?: number;
}

export interface QuoteItemUpdate {
  id?: string;
  quote_id?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  sort_order?: number;
}

export type DbQuote = QuoteRow;
export type DbQuoteItem = QuoteItemRow;

// ── Workflow types ────────────────────────────────────────────

export interface WorkflowStateRow {
  id: string;
  name: string;
  color: string;
  entity_type: WorkflowEntityType;
  sort_order: number;
  created_by: string;
  created_at: string;
}

export interface WorkflowStateInsert {
  id?: string;
  name: string;
  color?: string;
  entity_type: WorkflowEntityType;
  sort_order?: number;
  created_by: string;
}

export interface WorkflowStateUpdate {
  id?: string;
  name?: string;
  color?: string;
  entity_type?: WorkflowEntityType;
  sort_order?: number;
  created_by?: string;
}

export interface WorkflowTransitionRow {
  id: string;
  from_state_id: string;
  to_state_id: string;
  label: string;
  created_at: string;
}

export interface WorkflowTransitionInsert {
  id?: string;
  from_state_id: string;
  to_state_id: string;
  label?: string;
}

export interface WorkflowTransitionUpdate {
  id?: string;
  from_state_id?: string;
  to_state_id?: string;
  label?: string;
}

export type DbWorkflowState = WorkflowStateRow;
export type DbWorkflowTransition = WorkflowTransitionRow;

// ── Attachment types ────────────────────────────────────────

export interface FileAttachmentRow {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  related_to_type: string | null;
  related_to_id: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface FileAttachmentInsert {
  id?: string;
  filename: string;
  original_name: string;
  mime_type?: string;
  size_bytes?: number;
  storage_path: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  uploaded_by: string;
  created_at?: string;
}

export interface FileAttachmentUpdate {
  id?: string;
  filename?: string;
  original_name?: string;
  mime_type?: string;
  size_bytes?: number;
  storage_path?: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  uploaded_by?: string;
  created_at?: string;
}

export type DbFileAttachment = FileAttachmentRow;

// ── Goal types ─────────────────────────────────────────────

export interface GoalRow {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  target: number;
  current: number;
  period: GoalPeriod;
  start_date: string;
  end_date: string;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GoalInsert {
  id?: string;
  title: string;
  description?: string;
  type: GoalType;
  target?: number;
  current?: number;
  period: GoalPeriod;
  start_date: string;
  end_date: string;
  assigned_to?: string | null;
  created_by: string;
}

export interface GoalUpdate {
  id?: string;
  title?: string;
  description?: string;
  type?: GoalType;
  target?: number;
  current?: number;
  period?: GoalPeriod;
  start_date?: string;
  end_date?: string;
  assigned_to?: string | null;
  created_by?: string;
}

export type DbGoal = GoalRow;

// ── Campaign (email_sequences) types ────────────────────────

export interface EmailSequenceRow {
  id: string;
  name: string;
  description: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSequenceInsert {
  id?: string;
  name: string;
  description?: string;
  status?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmailSequenceUpdate {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  created_by?: string;
  updated_at?: string;
}

export interface CampaignEmailRow {
  id: string;
  sequence_id: string;
  subject: string;
  body: string;
  delay_days: number;
  sort_order: number;
  created_at: string;
}

export interface CampaignEmailInsert {
  id?: string;
  sequence_id: string;
  subject: string;
  body?: string;
  delay_days?: number;
  sort_order?: number;
  created_at?: string;
}

export interface CampaignEmailUpdate {
  id?: string;
  sequence_id?: string;
  subject?: string;
  body?: string;
  delay_days?: number;
  sort_order?: number;
}

export type DbEmailSequence = EmailSequenceRow;
export type DbCampaignEmail = CampaignEmailRow;

// ── Saved View types ─────────────────────────────────────────

export interface SavedViewRow {
  id: string;
  name: string;
  entity_type: string;
  filters: Record<string, unknown>;
  sort_by: string | null;
  sort_order: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SavedViewInsert {
  id?: string;
  name: string;
  entity_type: string;
  filters?: Record<string, unknown>;
  sort_by?: string | null;
  sort_order?: string | null;
  created_by: string;
}

export interface SavedViewUpdate {
  id?: string;
  name?: string;
  entity_type?: string;
  filters?: Record<string, unknown>;
  sort_by?: string | null;
  sort_order?: string | null;
}

export type DbSavedView = SavedViewRow;

// ── API Key types ─────────────────────────────────────────────

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ApiKeyInsert {
  id?: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes?: string[];
  expires_at?: string | null;
  created_by: string;
}

export interface ApiKeyUpdate {
  id?: string;
  name?: string;
  key_prefix?: string;
  key_hash?: string;
  scopes?: string[];
  last_used_at?: string | null;
  expires_at?: string | null;
  created_by?: string;
}

export type DbApiKey = ApiKeyRow;

// ── Calendar Integration types ─────────────────────────────────────────

export interface CalendarIntegrationRow {
  id: string;
  provider: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_by: string;
  created_at: string;
}

export interface CalendarIntegrationInsert {
  id?: string;
  provider: string;
  email: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  sync_enabled?: boolean;
  last_synced_at?: string | null;
  created_by: string;
}

export interface CalendarIntegrationUpdate {
  id?: string;
  provider?: string;
  email?: string;
  access_token?: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  sync_enabled?: boolean;
  last_synced_at?: string | null;
  created_by?: string;
}

export type DbCalendarIntegration = CalendarIntegrationRow;

// ── Portal User types ─────────────────────────────────────────────────

export interface PortalUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  last_login: string | null;
  active: boolean;
  created_at: string;
}

export interface PortalUserInsert {
  id?: string;
  email: string;
  name: string;
  password_hash: string;
  last_login?: string | null;
  active?: boolean;
}

export interface PortalUserUpdate {
  id?: string;
  email?: string;
  name?: string;
  password_hash?: string;
  last_login?: string | null;
  active?: boolean;
}

export type DbPortalUser = PortalUserRow;

// ── Portal Share types ────────────────────────────────────────────────

export interface PortalShareRow {
  id: string;
  portal_user_id: string;
  related_to_type: string;
  related_to_id: string;
  permission: string;
  created_at: string;
}

export interface PortalShareInsert {
  id?: string;
  portal_user_id: string;
  related_to_type: string;
  related_to_id: string;
  permission?: string;
}

export interface PortalShareUpdate {
  id?: string;
  portal_user_id?: string;
  related_to_type?: string;
  related_to_id?: string;
  permission?: string;
}

export type DbPortalShare = PortalShareRow;

// ── SMS Log types ─────────────────────────────────────────────

export interface SmsLogRow {
  id: string;
  to_number: string;
  from_number: string;
  body: string;
  direction: string;
  status: string;
  related_to_type: string | null;
  related_to_id: string | null;
  created_by: string;
  created_at: string;
}

export interface SmsLogInsert {
  id?: string;
  to_number: string;
  from_number: string;
  body: string;
  direction: string;
  status?: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  created_by: string;
  created_at?: string;
}

export interface SmsLogUpdate {
  id?: string;
  to_number?: string;
  from_number?: string;
  body?: string;
  direction?: string;
  status?: string;
  related_to_type?: string | null;
  related_to_id?: string | null;
  created_by?: string;
  created_at?: string;
}

export type DbSmsLog = SmsLogRow;
