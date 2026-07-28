# Type System Reference

## NexusCRM — Complete Type Definitions

---

This document catalogs all 29 type definition files in the `types/` directory. Every entity in the system has a corresponding type file with interfaces, discriminated unions, and form data types.

---

### 1. `types/lead.types.ts` — Lead Types

**Purpose:** Lead entity core types, enums, and form data.

```typescript
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
export type LeadPriority = 'low' | 'medium' | 'high';
export type LeadSource = 'manual' | 'website' | 'referral' | 'ads' | 'social';

export interface Lead {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  industry?: string;
  country?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: string;
  createdBy?: string;
  updatedBy?: string;
  estimatedValue: number;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFormData {
  fullName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  industry?: string;
  country?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: string;
  estimatedValue: number;
  tags: string[];
  notes?: string;
}

export interface LeadFilters {
  search?: string;
  status?: LeadStatus | '';
  source?: LeadSource | '';
  priority?: LeadPriority | '';
  assignedTo?: string;
  minScore?: number;
}
```

---

### 2. `types/contact.types.ts` — Contact Types

```typescript
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  leadIds: string[];
  location?: string;
  socialLinks: string[];
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  location?: string;
  socialLinks: string[];
  tags: string[];
  notes?: string;
}
```

---

### 3. `types/company.types.ts` — Company Types

```typescript
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';

export interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: CompanySize;
  revenue: number;
  location?: string;
  website?: string;
  contactIds: string[];
  leadIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyFormData {
  name: string;
  industry?: string;
  size?: CompanySize;
  revenue: number;
  location?: string;
  website?: string;
  tags?: string[];
}
```

---

### 4. `types/deal.types.ts` — Deal Types

```typescript
export interface DealStage {
  id: string;
  name: string;
  color: string;
  probability: number;
  sortOrder: number;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  value: number;
  currency: string;
  stageId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  assignedTo?: string;
  closeDate?: string;
  winLossReason: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stage?: DealStage; // populated on read
}

export interface DealFormData {
  title: string;
  description?: string;
  value?: number;
  currency?: string;
  stageId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  assignedTo?: string;
  closeDate?: string;
  tags?: string[];
}

export interface DealStageFormData {
  name: string;
  color?: string;
  probability?: number;
  sortOrder?: number;
}
```

---

### 5. `types/task.types.ts` — Task Types

```typescript
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type RelatedEntityType = 'lead' | 'contact' | 'company';

export interface Task {
  id: string;
  title: string;
  description?: string;
  relatedToType?: RelatedEntityType;
  relatedToId?: string;
  assignedTo?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  relatedToType?: RelatedEntityType;
  relatedToId?: string;
  assignedTo?: string;
  dueDate?: string;
  priority: TaskPriority;
}
```

---

### 6. `types/meeting.types.ts` — Meeting Types

```typescript
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
```

---

### 7. `types/activity.types.ts` — Activity Types

```typescript
export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'note_added'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'task_created'
  | 'task_completed'
  | 'communication_logged'
  | 'assigned';

export interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  type: ActivityType;
  description: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
```

---

### 8. `types/team.types.ts` — Team Types

```typescript
export type TeamRole = 'admin' | 'manager' | 'agent' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type PermissionEntity = 'lead' | 'contact' | 'company' | 'task' | 'meeting' | 'team' | 'analytics';
export type PermissionScope = 'own' | 'team' | 'all';

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user?: { name: string; email: string; avatar?: string };
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Permission {
  action: PermissionAction;
  entity: PermissionEntity;
  scope: PermissionScope;
}

export interface TeamFormData {
  name: string;
  description?: string;
}

export interface InviteMemberFormData {
  email: string;
  role: TeamRole;
}
```

---

### 9. `types/communication.types.ts` — Communication Types

```typescript
export type CallDirection = 'inbound' | 'outbound';
export type CallResult = 'completed' | 'no_answer' | 'busy' | 'failed' | 'voicemail';

export interface CallLog {
  id: string;
  direction: CallDirection;
  duration: number;
  caller: string;
  callee: string;
  notes: string;
  callResult: CallResult;
  relatedToType?: string;
  relatedToId?: string;
  createdBy: string;
  createdAt: string;
}

export interface Email {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'draft' | 'sent' | 'failed';
  relatedToType?: string;
  relatedToId?: string;
  sentAt?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 10. `types/sms.types.ts` — SMS Types

```typescript
export type SmsDirection = 'inbound' | 'outbound';
export type SmsStatus = 'sent' | 'delivered' | 'failed';
export type SmsRelatedEntity = 'lead' | 'contact' | 'company' | 'deal';

export interface SmsLog {
  id: string;
  toNumber: string;
  fromNumber: string;
  body: string;
  direction: SmsDirection;
  status: SmsStatus;
  relatedToType?: SmsRelatedEntity;
  relatedToId?: string;
  createdBy: string;
  createdAt: string;
}

export interface SmsFormData {
  toNumber: string;
  fromNumber?: string;
  body: string;
  relatedToType?: SmsRelatedEntity;
  relatedToId?: string;
}
```

---

### 11. `types/quote.types.ts` — Quote Types

```typescript
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface QuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface Quote {
  id: string;
  title: string;
  dealId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  status: QuoteStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes: string;
  validUntil?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

export interface QuoteFormData {
  title: string;
  dealId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  status?: QuoteStatus;
  discount?: number;
  notes?: string;
  validUntil?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}
```

---

### 12. `types/campaign.types.ts` — Campaign Types

```typescript
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface EmailSequence {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignEmail {
  id: string;
  sequenceId: string;
  subject: string;
  body: string;
  delayDays: number;
  sortOrder: number;
  createdAt: string;
}
```

---

### 13. `types/forecast.types.ts` — Forecast Types

```typescript
export interface Forecast {
  id: string;
  year: number;
  month: number;
  target: number;
  actual: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastSummary {
  year: number;
  totalTarget: number;
  totalActual: number;
  achievement: number;
  months: Forecast[];
}
```

---

### 14. `types/goal.types.ts` — Goal Types

```typescript
export type GoalType = 'revenue' | 'deals_count' | 'leads_created' | 'tasks_completed' | 'calls_made' | 'custom';
export type GoalPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  target: number;
  current: number;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 15. `types/tag.types.ts` — Tag Types

```typescript
export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  usageCount?: number;
}

export interface Tagging {
  id: string;
  tagId: string;
  taggableId: string;
  taggableType: 'lead' | 'contact' | 'company' | 'task' | 'meeting' | 'deal';
  createdAt: string;
}

export interface TagWithEntity extends Tag {
  entityCount?: number;
}

export interface TagFormData {
  name: string;
  color?: string;
}
```

---

### 16. `types/automation.types.ts` — Automation Types

```typescript
export type AutomationTriggerEvent =
  | 'lead.created' | 'lead.updated' | 'lead.status_changed'
  | 'contact.created' | 'contact.updated'
  | 'company.created' | 'company.updated'
  | 'task.created' | 'task.completed' | 'task.overdue'
  | 'meeting.created' | 'meeting.completed'
  | 'deal.created' | 'deal.stage_changed';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'changed';
  value: string;
}

export interface AutomationAction {
  type: 'assign_user' | 'change_status' | 'add_tag' | 'send_email' | 'send_notification' | 'trigger_webhook';
  config: Record<string, string>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerEvent: AutomationTriggerEvent;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 17. `types/workflow.types.ts` — Workflow Types

```typescript
export type WorkflowEntityType = 'lead' | 'deal' | 'task';

export interface WorkflowState {
  id: string;
  name: string;
  color: string;
  entityType: WorkflowEntityType;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  label: string;
  createdAt: string;
}
```

---

### 18. `types/api-key.types.ts` — API Key Types

```typescript
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ApiKeyCreateResponse {
  key: ApiKey;
  fullKey: string;
}
```

---

### 19. `types/saved-view.types.ts` — Saved View Types

```typescript
export type ViewEntityType = 'lead' | 'contact' | 'company' | 'deal' | 'task' | 'meeting';

export interface SavedView {
  id: string;
  name: string;
  entityType: ViewEntityType;
  filters: Record<string, unknown>;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc' | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 20. `types/integration.types.ts` — Integration Types

```typescript
export type CalendarProvider = 'google' | 'outlook';

export interface CalendarIntegration {
  id: string;
  provider: CalendarProvider;
  email: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  createdBy: string;
  createdAt: string;
}
```

---

### 21. `types/portal.types.ts` — Portal Types

```typescript
export interface PortalUser {
  id: string;
  email: string;
  name: string;
  lastLogin: string | null;
  active: boolean;
  createdAt: string;
}

export interface PortalShare {
  id: string;
  portalUserId: string;
  relatedToType: string;
  relatedToId: string;
  permission: string;
  createdAt: string;
}
```

---

### 22. `types/attachment.types.ts` — File Attachment Types

```typescript
export type RelatedEntityType = 'lead' | 'contact' | 'company' | 'deal' | 'task' | 'meeting' | 'quote';

export interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  relatedToType: RelatedEntityType;
  relatedToId: string;
  uploadedBy: string;
  createdAt: string;
}
```

---

### 23. `types/lead-scoring.types.ts` — Lead Scoring Types

```typescript
export interface LeadScore {
  id: string;
  leadId: string;
  score: number;
  factors: Record<string, number>;
  updatedAt: string;
}

export const SCORING_FACTORS = [
  { key: 'email_present', label: 'Email present', weight: 20 },
  { key: 'phone_present', label: 'Phone present', weight: 15 },
  { key: 'company_present', label: 'Company present', weight: 10 },
  { key: 'source_quality', label: 'Source quality', weight: 15 },
  { key: 'tags_count', label: 'Tags', weight: 5 },
  { key: 'lost_penalty', label: 'Lost penalty', weight: -10 },
];
```

---

### 24. `types/webhook.types.ts` — Webhook Event Types

```typescript
export type WebhookEvent =
  | 'lead.created' | 'lead.updated' | 'lead.deleted' | 'lead.status_changed'
  | 'contact.created' | 'contact.updated' | 'contact.deleted'
  | 'company.created' | 'company.updated' | 'company.deleted'
  | 'task.created' | 'task.completed' | 'task.overdue'
  | 'meeting.created' | 'meeting.completed';
```

---

### 25. `types/common.types.ts` — Shared Types

```typescript
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
```

---

### 26. `types/supabase.types.ts` — Database Schema Types

**Purpose:** Complete typed interface for all 28+ database tables with Row/Insert/Update subtypes.

The `Database` interface defines the full Supabase schema:

```typescript
export interface Database {
  public: {
    Tables: {
      leads: { Row: LeadRow; Insert: LeadInsert; Update: LeadUpdate };
      contacts: { Row: ContactRow; Insert: ContactInsert; Update: ContactUpdate };
      companies: { Row: CompanyRow; Insert: CompanyInsert; Update: CompanyUpdate };
      deals: { Row: DealRow; Insert: DealInsert; Update: DealUpdate };
      deal_stages: { Row: DealStageRow; Insert: DealStageInsert; Update: DealStageUpdate };
      tasks: { Row: TaskRow; Insert: TaskInsert; Update: TaskUpdate };
      meetings: { Row: MeetingRow; Insert: MeetingInsert; Update: MeetingUpdate };
      activities: { Row: ActivityRow; Insert: ActivityInsert; Update: ActivityUpdate };
      teams: { Row: TeamRow; Insert: TeamInsert; Update: TeamUpdate };
      team_members: { Row: TeamMemberRow; Insert: TeamMemberInsert; Update: TeamMemberUpdate };
      team_invitations: { Row: TeamInvitationRow; Insert: TeamInvitationInsert; Update: TeamInvitationUpdate };
      automation_rules: { Row: AutomationRuleRow; Insert: AutomationRuleInsert; Update: AutomationRuleUpdate };
      email_history: { Row: EmailHistoryRow; Insert: EmailHistoryInsert; Update: EmailHistoryUpdate };
      call_logs: { Row: CallLogRow; Insert: CallLogInsert; Update: CallLogUpdate };
      tags: { Row: TagRow; Insert: TagInsert; Update: TagUpdate };
      taggings: { Row: TaggingRow; Insert: TaggingInsert; Update: TaggingUpdate };
      notes: { Row: NoteRow; Insert: NoteInsert; Update: NoteUpdate };
      lead_scores: { Row: LeadScoreRow; Insert: LeadScoreInsert; Update: LeadScoreUpdate };
      quotes: { Row: QuoteRow; Insert: QuoteInsert; Update: QuoteUpdate };
      quote_items: { Row: QuoteItemRow; Insert: QuoteItemInsert; Update: QuoteItemUpdate };
      forecasts: { Row: ForecastRow; Insert: ForecastInsert; Update: ForecastUpdate };
      file_attachments: { Row: FileAttachmentRow; Insert: FileAttachmentInsert; Update: FileAttachmentUpdate };
      goals: { Row: GoalRow; Insert: GoalInsert; Update: GoalUpdate };
      email_sequences: { Row: EmailSequenceRow; Insert: EmailSequenceInsert; Update: EmailSequenceUpdate };
      campaign_emails: { Row: CampaignEmailRow; Insert: CampaignEmailInsert; Update: CampaignEmailUpdate };
      saved_views: { Row: SavedViewRow; Insert: SavedViewInsert; Update: SavedViewUpdate };
      api_keys: { Row: ApiKeyRow; Insert: ApiKeyInsert; Update: ApiKeyUpdate };
      workflow_states: { Row: WorkflowStateRow; Insert: WorkflowStateInsert; Update: WorkflowStateUpdate };
      workflow_transitions: { Row: WorkflowTransitionRow; Insert: WorkflowTransitionInsert; Update: WorkflowTransitionUpdate };
      calendar_integrations: { Row: CalendarIntegrationRow; Insert: CalendarIntegrationInsert; Update: CalendarIntegrationUpdate };
      sms_logs: { Row: SmsLogRow; Insert: SmsLogInsert; Update: SmsLogUpdate };
      portal_users: { Row: PortalUserRow; Insert: PortalUserInsert; Update: PortalUserUpdate };
      portal_shares: { Row: PortalShareRow; Insert: PortalShareInsert; Update: PortalShareUpdate };
    };
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// DbXxx aliases for service layer compatibility
export type DbLead = LeadRow;
export type DbContact = ContactRow;
export type DbCompany = CompanyRow;
export type DbTask = TaskRow;
export type DbMeeting = MeetingRow;
export type DbActivity = ActivityRow;
// etc. for each table
```

**Convention:** Row types use `snake_case` (database convention), while domain types use `camelCase`. Service mapper functions (`mapRowToLead`, `mapLeadToDb`) convert between the two.

---

### 27. `types/account.types.ts` — Account Types

Contains user account types for CRM user identity.

---

### 28. `types/invoice.types.ts` — Invoice Types

```typescript
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quoteId?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  issuedDate: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

export interface InvoiceFormData {
  quoteId?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  taxRate?: number;
  notes?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}
```

---

### 29. `types/swimlane.types.ts` — Swimlane Types

Types for swimlane grouping in the kanban pipeline view (grouping by assignee or priority).

---

### Shared Patterns

**ValidationResult** — Used across all form validators:
```typescript
{ isValid: boolean; errors: Record<string, string> }
```

**RelatedEntityType** — Used for polymorphic relationships:
```typescript
'lead' | 'contact' | 'company' | 'deal' | 'task' | 'meeting' | 'quote'
```

**FormData pattern** — Every entity has a `<Entity>FormData` interface for create/edit forms, with all fields optional except required ones.

**Service compatibility** — `Db<Entity>` type aliases in `supabase.types.ts` bridge the database snake_case types with the domain camelCase types used in hooks and components.
