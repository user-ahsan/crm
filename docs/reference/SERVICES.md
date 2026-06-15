# Service Layer Reference

## NexusCRM — All 24 Service Modules

---

This document catalogs every service in the `services/` directory. Services are the data mutation layer — they handle CRUD operations, cross-module interactions, webhook triggers, and activity logging. All services follow a consistent pattern: named object export, async methods, dual Supabase/mock mode.

---

## Core CRUD Services

### `lead.service.ts`

**Purpose:** Lead entity CRUD, scoring, duplicate detection, pipeline stats.

**Exported Methods:**
```typescript
export const leadService = {
  getAll(page?: number, pageSize?: number): Promise<Lead[]>;
  getById(id: string): Promise<Lead | undefined>;
  getFiltered(filters: LeadFilters, page?: number, pageSize?: number): Promise<Lead[]>;
  create(data: LeadFormData): Promise<Lead>;
  update(id: string, data: Partial<LeadFormData>): Promise<Lead | undefined>;
  delete(id: string): Promise<boolean>;
  updateStatus(id: string, status: LeadStatus): Promise<Lead | undefined>;
  findDuplicates(): Promise<DuplicateGroup<Lead>[]>;
  mergeLeads(survivorId: string, mergeIds: string[]): Promise<Lead>;
  calculateScore(leadId: string): Promise<{ score: number; factors: Record<string, number> }>;
  getScore(leadId: string): Promise<LeadScore | undefined>;
  updateScore(leadId: string): Promise<LeadScore>;
  batchUpdateScores(): Promise<{ updated: number; failed: number }>;
  getPipelineStats(): Promise<Record<LeadStatus, { count: number; value: number }>>;
}
```

**Cross-Service Dependencies:** `activityService`, `webhookService`, `supabaseService`

**Webhooks:** `lead.created`, `lead.updated`, `lead.deleted`, `lead.status_changed`

**Key Patterns:**
- Auto-creates company when `companyName` is provided during create
- Cascading delete: removes related tasks, meetings, activities
- Score calculation based on email/phone/company/source/tags factors
- Duplicate detection via email (40%), phone (35%), name (15%), company (10%) matching

---

### `contact.service.ts`

**Purpose:** Contact entity CRUD, duplicate detection.

**Exported Methods:**
```typescript
export const contactService = {
  getAll(page?: number, pageSize?: number): Promise<Contact[]>;
  getById(id: string): Promise<Contact | undefined>;
  getFiltered(filters: ContactFilters, page?: number, pageSize?: number): Promise<Contact[]>;
  create(data: ContactFormData): Promise<Contact>;
  update(id: string, data: Partial<ContactFormData>): Promise<Contact | undefined>;
  delete(id: string): Promise<boolean>;
  findDuplicates(): Promise<DuplicateGroup<Contact>[]>;
  mergeContacts(survivorId: string, mergeIds: string[]): Promise<Contact>;
}
```

**Cross-Service Dependencies:** `activityService`, `webhookService`

**Webhooks:** `contact.created`, `contact.updated`, `contact.deleted`

---

### `company.service.ts`

**Purpose:** Company entity CRUD.

**Exported Methods:**
```typescript
export const companyService = {
  getAll(page?: number, pageSize?: number): Promise<Company[]>;
  getById(id: string): Promise<Company | undefined>;
  getFiltered(filters: CompanyFilters, page?: number, pageSize?: number): Promise<Company[]>;
  create(data: CompanyFormData): Promise<Company>;
  update(id: string, data: Partial<CompanyFormData>): Promise<Company | undefined>;
  delete(id: string): Promise<boolean>;
}
```

**Cross-Service Dependencies:** `activityService`, `webhookService`

**Webhooks:** `company.created`, `company.updated`, `company.deleted`

---

### `deal.service.ts`

**Purpose:** Deal entity CRUD with stage management.

**Exported Methods:**
```typescript
export const dealService = {
  getAll(page?: number, pageSize?: number): Promise<Deal[]>;
  getById(id: string): Promise<Deal | undefined>;
  create(data: DealFormData): Promise<Deal>;
  update(id: string, data: Partial<DealFormData>): Promise<Deal | undefined>;
  delete(id: string): Promise<boolean>;
}
```

---

### `task.service.ts`

**Purpose:** Task entity CRUD.

**Exported Methods:**
```typescript
export const taskService = {
  getAll(page?: number, pageSize?: number): Promise<Task[]>;
  getById(id: string): Promise<Task | undefined>;
  create(data: TaskFormData): Promise<Task>;
  update(id: string, data: Partial<TaskFormData>): Promise<Task | undefined>;
  delete(id: string): Promise<boolean>;
}
```

**Cross-Service Dependencies:** `activityService`, `webhookService`

**Webhooks:** `task.created`, `task.completed`, `task.overdue`

---

### `meeting.service.ts`

**Purpose:** Meeting entity CRUD.

**Exported Methods:**
```typescript
export const meetingService = {
  getAll(page?: number, pageSize?: number): Promise<Meeting[]>;
  getById(id: string): Promise<Meeting | undefined>;
  create(data: MeetingFormData): Promise<Meeting>;
  update(id: string, data: Partial<MeetingFormData>): Promise<Meeting | undefined>;
  delete(id: string): Promise<boolean>;
}
```

**Cross-Service Dependencies:** `activityService`, `webhookService`

**Webhooks:** `meeting.created`, `meeting.completed`

---

## Communication Services

### `activity.service.ts`

**Purpose:** Activity logging for all entity operations.

**Exported Methods:**
```typescript
export const activityService = {
  log(entityType: string, entityId: string, type: string, description: string, metadata?: Record<string, unknown>): Promise<Activity>;
  getForEntity(entityType: string, entityId: string): Activity[];
}
```

**Used By:** All core CRUD services

---

### `communication.service.ts`

**Purpose:** Unified email, call log, and note management.

**Exported Methods:**
```typescript
export const communicationService = {
  // Email
  getEmailsForEntity(type: string, id: string): Email[];
  sendEmail(data: EmailFormData): Promise<Email>;
  saveDraft(data: EmailFormData): Promise<Email>;
  
  // Call Logs
  getCallLogsForEntity(type: string, id: string): CallLog[];
  logCall(data: CallLogFormData): Promise<CallLog>;
  
  // Notes
  getNotesForEntity(type: string, id: string): Note[];
  addNote(data: NoteFormData): Promise<Note>;
  updateNote(id: string, data: Partial<NoteFormData>): Promise<Note>;
  deleteNote(id: string): Promise<boolean>;
}
```

---

### `sms.service.ts`

**Purpose:** SMS message history management.

**Exported Methods:**
```typescript
export const smsService = {
  getForEntity(type: string, id: string): SmsLog[];
  sendSms(data: SmsFormData): Promise<SmsLog>;
}
```

---

## System Services

### `tag.service.ts`

**Purpose:** Tag CRUD and polymorphic tagging.

**Exported Methods:**
```typescript
export const tagService = {
  getAll(): Promise<Tag[]>;
  create(data: TagFormData): Promise<Tag>;
  update(id: string, data: Partial<TagFormData>): Promise<Tag>;
  delete(id: string): Promise<boolean>;
  getTagsForEntity(entityType: string, entityId: string): Promise<Tag[]>;
  addTagToEntity(tagId: string, entityType: string, entityId: string): Promise<void>;
  removeTagFromEntity(tagId: string, entityType: string, entityId: string): Promise<void>;
  getUsageCounts(): Promise<Record<string, number>>;
}
```

---

### `team.service.ts`

**Purpose:** Team CRUD, member management, invitations.

**Exported Methods:**
```typescript
export const teamService = {
  getCurrentTeam(): Promise<Team | null>;
  getMembers(teamId: string): Promise<TeamMember[]>;
  create(data: TeamFormData): Promise<Team>;
  update(id: string, data: Partial<TeamFormData>): Promise<Team | undefined>;
  inviteMember(teamId: string, data: InviteMemberFormData): Promise<TeamInvitation>;
  cancelInvitation(invitationId: string): Promise<boolean>;
  changeMemberRole(memberId: string, role: TeamRole): Promise<TeamMember | undefined>;
  removeMember(memberId: string): Promise<boolean>;
}
```

---

### `webhook.service.ts`

**Purpose:** n8n webhook event dispatch.

**Exported Methods:**
```typescript
export function configureWebhooks(config: Partial<WebhookConfig>): void;
export function isWebhookEnabled(): boolean;
export function getWebhookConfig(): Readonly<WebhookConfig>;
export function triggerWebhook(event: WebhookEvent | string, data: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<boolean>;
export function triggerWebhookWithDetails(event: WebhookEvent | string, data: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<WebhookDeliveryResult>;
```

**Configuration:** Reads from `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` env vars
**Pattern:** Fire-and-forget (does not block the calling operation)
**Timeout:** 10 seconds

---

### `automation.service.ts`

**Purpose:** Automation rule engine — evaluates conditions and executes actions.

**Exported Methods:**
```typescript
export const automationService = {
  getAll(): Promise<AutomationRule[]>;
  create(data: AutomationRuleFormData): Promise<AutomationRule>;
  update(id: string, data: Partial<AutomationRuleFormData>): Promise<AutomationRule>;
  delete(id: string): Promise<boolean>;
  evaluate(triggerEvent: AutomationTriggerEvent, context: Record<string, unknown>): Promise<void>;
  toggle(id: string, enabled: boolean): Promise<void>;
}
```

**Rule Engine:** `evaluate()` checks all enabled rules matching the trigger event, evaluates conditions, and executes matching actions.

---

### `campaign.service.ts`

**Purpose:** Email campaign sequences and individual campaign emails.

**Exported Methods:**
```typescript
export const campaignService = {
  getAll(): Promise<EmailSequence[]>;
  getById(id: string): Promise<EmailSequence | undefined>;
  create(data: EmailSequenceFormData): Promise<EmailSequence>;
  update(id: string, data: Partial<EmailSequenceFormData>): Promise<EmailSequence | undefined>;
  delete(id: string): Promise<boolean>;
  // Campaign email operations
  addEmail(data: CampaignEmailFormData): Promise<CampaignEmail>;
  updateEmail(id: string, data: Partial<CampaignEmailFormData>): Promise<CampaignEmail>;
  removeEmail(id: string): Promise<boolean>;
  getEmails(sequenceId: string): Promise<CampaignEmail[]>;
}
```

---

### `quote.service.ts`

**Purpose:** Quote CRUD with line item management.

**Exported Methods:**
```typescript
export const quoteService = {
  getAll(): Promise<Quote[]>;
  getById(id: string): Promise<Quote | undefined>;
  create(data: QuoteFormData): Promise<Quote>;
  update(id: string, data: Partial<QuoteFormData>): Promise<Quote | undefined>;
  delete(id: string): Promise<boolean>;
  updateStatus(id: string, status: QuoteStatus): Promise<Quote | undefined>;
}
```

---

## Extension Services

### `forecast.service.ts`

**Purpose:** Revenue forecast CRUD and actual calculation.

**Exported Methods:**
```typescript
export const forecastService = {
  getAll(): Promise<Forecast[]>;
  getYearSummary(year: number): Promise<ForecastSummary>;
  setForecast(data: ForecastFormData): Promise<Forecast>;
  update(id: string, data: Partial<ForecastFormData>): Promise<Forecast>;
  recalculateActuals(year: number, month: number): Promise<void>;
}
```

---

### `goal.service.ts`

**Purpose:** Sales goal CRUD with progress tracking.

**Exported Methods:**
```typescript
export const goalService = {
  getAll(): Promise<Goal[]>;
  create(data: GoalFormData): Promise<Goal>;
  update(id: string, data: Partial<GoalFormData>): Promise<Goal>;
  delete(id: string): Promise<boolean>;
  getProgress(goalId: string): Promise<number>;
}
```

---

### `integration.service.ts`

**Purpose:** Calendar integration management.

**Exported Methods:**
```typescript
export const integrationService = {
  getAll(): Promise<CalendarIntegration[]>;
  connect(data: CalendarIntegrationFormData): Promise<CalendarIntegration>;
  disconnect(id: string): Promise<boolean>;
  toggleSync(id: string, enabled: boolean): Promise<void>;
}
```

---

### `portal.service.ts`

**Purpose:** Customer portal user and share management.

**Exported Methods:**
```typescript
export const portalService = {
  getUsers(): Promise<PortalUser[]>;
  createUser(data: PortalUserFormData): Promise<PortalUser>;
  toggleUser(id: string, active: boolean): Promise<void>;
  getShares(portalUserId: string): Promise<PortalShare[]>;
  createShare(data: PortalShareFormData): Promise<PortalShare>;
  deleteShare(id: string): Promise<boolean>;
}
```

---

### `saved-view.service.ts`

**Purpose:** Saved view CRUD for per-entity filter presets.

**Exported Methods:**
```typescript
export const savedViewService = {
  getForEntity(entityType: string): Promise<SavedView[]>;
  create(data: SavedViewFormData): Promise<SavedView>;
  update(id: string, data: Partial<SavedViewFormData>): Promise<SavedView>;
  delete(id: string): Promise<boolean>;
}
```

---

### `api-key.service.ts`

**Purpose:** API key management with secure generation.

**Exported Methods:**
```typescript
export const apiKeyService = {
  getAll(): Promise<ApiKey[]>;
  create(data: ApiKeyFormData): Promise<ApiKeyCreateResponse>;
  delete(id: string): Promise<boolean>;
}
```

**Security:** Keys are stored as hashes; full key is returned only once at creation.

---

### `attachment.service.ts`

**Purpose:** File attachment metadata management.

**Exported Methods:**
```typescript
export const attachmentService = {
  getForEntity(type: string, id: string): FileAttachment[];
  upload(data: FileAttachment): Promise<FileAttachment>;
  delete(id: string): Promise<boolean>;
}
```

---

### `workflow.service.ts`

**Purpose:** Custom workflow state and transition management.

**Exported Methods:**
```typescript
export const workflowService = {
  getStates(entityType?: WorkflowEntityType): Promise<WorkflowState[]>;
  createState(data: WorkflowStateFormData): Promise<WorkflowState>;
  updateState(id: string, data: Partial<WorkflowStateFormData>): Promise<WorkflowState>;
  deleteState(id: string): Promise<boolean>;
  getTransitions(): Promise<WorkflowTransition[]>;
  createTransition(data: WorkflowTransitionFormData): Promise<WorkflowTransition>;
  deleteTransition(id: string): Promise<boolean>;
}
```

---

### `supabase.service.ts`

**Purpose:** Supabase error formatting helper.

**Exported Methods:**
```typescript
export function formatSupabaseError(error: unknown): string;
```

Used by all services to normalize Supabase error messages into user-friendly strings.
