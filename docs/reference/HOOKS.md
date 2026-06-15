# Custom Hooks Reference

## NexusCRM — All 37 Custom React Hooks

---

This document catalogs every custom hook in the `hooks/` directory. All hooks follow the same pattern: loading/error states, optimistic updates with rollback, and service layer delegation.

---

## Primary CRUD Hooks

### `useLeads()`

**File:** `hooks/useLeads.ts`

**Services Called:** `leadService`

**Returns:**
```typescript
{
  leads: Lead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getFiltered: (filters: LeadFilters) => Lead[];
  getById: (id: string) => Promise<Lead | undefined>;
  createLead: (data: LeadFormData) => Promise<Lead | undefined>;
  updateLead: (id: string, data: Partial<LeadFormData>) => Promise<Lead | undefined>;
  deleteLead: (id: string) => Promise<boolean>;
}
```

**Dependency Chain:**
- `useLeads()` → `leadService.getAll()` → `data/leads.ts` or Supabase
- `createLead()` → `leadValidation.validate()` → `leadService.create()`
- `deleteLead()` → Optimistic removal → `leadService.delete()`

**Optimistic Updates:**
- Create: Generates temp ID, inserts optimistically, replaces with real data on success
- Update: Saves previous state, updates optimistically, rolls back on failure
- Delete: Removes optimistically, restores on failure

**Caching:** Writes to `useEntityCache` on load/create/update/delete

---

### `useContacts()`

**File:** `hooks/useContacts.ts`

**Services Called:** `contactService`

```typescript
{
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getFiltered: (filters: ContactFilters) => Contact[];
  getById: (id: string) => Promise<Contact | undefined>;
  createContact: (data: ContactFormData) => Promise<Contact | undefined>;
  updateContact: (id: string, data: Partial<ContactFormData>) => Promise<Contact | undefined>;
  deleteContact: (id: string) => Promise<boolean>;
}
```

---

### `useCompanies()`

**File:** `hooks/useCompanies.ts`

**Services Called:** `companyService`

```typescript
{
  companies: Company[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getFiltered: (filters: CompanyFilters) => Company[];
  getById: (id: string) => Promise<Company | undefined>;
  createCompany: (data: CompanyFormData) => Promise<Company | undefined>;
  updateCompany: (id: string, data: Partial<CompanyFormData>) => Promise<Company | undefined>;
  deleteCompany: (id: string) => Promise<boolean>;
}
```

---

### `useDeals()`

**File:** `hooks/useDeals.ts`

**Services Called:** `dealService`

```typescript
{
  deals: Deal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => Promise<Deal | undefined>;
  createDeal: (data: DealFormData) => Promise<Deal | undefined>;
  updateDeal: (id: string, data: Partial<DealFormData>) => Promise<Deal | undefined>;
  deleteDeal: (id: string) => Promise<boolean>;
}
```

---

### `useTasks()`

**File:** `hooks/useTasks.ts`

**Services Called:** `taskService`

```typescript
{
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => Promise<Task | undefined>;
  createTask: (data: TaskFormData) => Promise<Task | undefined>;
  updateTask: (id: string, data: Partial<TaskFormData>) => Promise<Task | undefined>;
  deleteTask: (id: string) => Promise<boolean>;
  getOverdueTasks: () => Task[];
  getDueTodayTasks: () => Task[];
}
```

**Dependency Chain:** → `taskService` → `modules/tasks/taskUtils.ts` (for overdue/due-today logic)

---

### `useMeetings()`

**File:** `hooks/useMeetings.ts`

**Services Called:** `meetingService`

```typescript
{
  meetings: Meeting[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => Promise<Meeting | undefined>;
  createMeeting: (data: MeetingFormData) => Promise<Meeting | undefined>;
  updateMeeting: (id: string, data: Partial<MeetingFormData>) => Promise<Meeting | undefined>;
  deleteMeeting: (id: string) => Promise<boolean>;
  getMeetingsForEntity: (type: string, id: string) => Meeting[];
}
```

---

## Cached Entity Hooks

### `useCachedLeads()`, `useCachedContacts()`, `useCachedCompanies()`, `useCachedTasks()`, `useCachedMeetings()`

**Files:** `hooks/useCachedLeads.ts`, etc.

**Purpose:** Read-only cached access to entity data from the Zustand entity cache store. Used when you need quick access to entity data without triggering a full data fetch.

```typescript
// Pattern for each cached hook
{
  data: Entity[];
  getById: (id: string) => Entity | undefined;
  isLoading: boolean;
  error: string | null;
}
```

**Dependency Chain:** → `useEntityCache` (Zustand store)

---

## Feature Hooks

### `usePipeline()`

**File:** `hooks/usePipeline.ts`

**Services Called:** `leadService` (via `useLeads`)

```typescript
{
  pipelineState: Record<LeadStatus, Lead[]>;
  pipelineStats: Record<LeadStatus, { count: number; value: number }>;
  loading: boolean;
  error: string | null;
  moveLead: (leadId: string, newStage: LeadStatus) => Promise<void>;
  getLeadsByStage: (stage: LeadStatus) => Lead[];
  refreshPipeline: () => Promise<void>;
}
```

**Dependency Chain:** → `leadService.getPipelineStats()` → `modules/pipeline/pipelineUtils.ts`

---

### `useActivities()`

**File:** `hooks/useActivities.ts`

**Services Called:** `activityService`

```typescript
{
  activities: Activity[];
  loading: boolean;
  error: string | null;
  getForEntity: (entityType: string, entityId: string) => Activity[];
  logActivity: (type: string, entityType: string, entityId: string, description: string, metadata?: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
}
```

---

### `useSearch()`

**File:** `hooks/useSearch.ts`

**Services Called:** Cross-entity read from all services

```typescript
{
  results: SearchResults;
  query: string;
  setQuery: (q: string) => void;
  isSearching: boolean;
  search: (q: string) => Promise<void>;
  clearSearch: () => void;
}
```

**Dependency Chain:** → `modules/search/globalSearch.ts`

---

### `useQuotes()`

**File:** `hooks/useQuotes.ts`

**Services Called:** `quoteService`

```typescript
{
  quotes: Quote[];
  loading: boolean;
  error: string | null;
  getById: (id: string) => Promise<Quote | undefined>;
  createQuote: (data: QuoteFormData) => Promise<Quote | undefined>;
  updateQuote: (id: string, data: Partial<QuoteFormData>) => Promise<Quote | undefined>;
  deleteQuote: (id: string) => Promise<boolean>;
}
```

---

### `useCampaigns()`

**File:** `hooks/useCampaigns.ts`

**Services Called:** `campaignService`

```typescript
{
  campaigns: EmailSequence[];
  loading: boolean;
  error: string | null;
  getById: (id: string) => Promise<EmailSequence | undefined>;
  createCampaign: (data: EmailSequenceFormData) => Promise<EmailSequence | undefined>;
  updateCampaign: (id: string, data: Partial<EmailSequenceFormData>) => Promise<EmailSequence | undefined>;
  deleteCampaign: (id: string) => Promise<boolean>;
  // Campaign email operations
  addEmail: (data: CampaignEmailFormData) => Promise<void>;
  removeEmail: (id: string) => Promise<void>;
  reorderEmails: (sequenceId: string, emailIds: string[]) => Promise<void>;
}
```

---

## Communication Hooks

### `useEmail()`

**File:** `hooks/useEmail.ts`

**Services Called:** `communicationService`

```typescript
{
  emails: Email[];
  loading: boolean;
  error: string | null;
  getForEntity: (type: string, id: string) => Email[];
  sendEmail: (data: EmailFormData) => Promise<void>;
  saveDraft: (data: EmailFormData) => Promise<void>;
}
```

---

### `useSms()`

**File:** `hooks/useSms.ts`

**Services Called:** `smsService`

```typescript
{
  messages: SmsLog[];
  loading: boolean;
  error: string | null;
  getForEntity: (type: string, id: string) => SmsLog[];
  sendSms: (data: SmsFormData) => Promise<void>;
}
```

---

### `useNotes()`

**File:** `hooks/useNotes.ts`

**Services Called:** `communicationService`

```typescript
{
  notes: Note[];
  loading: boolean;
  error: string | null;
  getForEntity: (type: string, id: string) => Note[];
  addNote: (data: NoteFormData) => Promise<void>;
  updateNote: (id: string, data: Partial<NoteFormData>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}
```

---

### `useCallLogs()`

**File:** `hooks/useCallLogs.ts`

**Services Called:** `communicationService`

```typescript
{
  callLogs: CallLog[];
  loading: boolean;
  error: string | null;
  getForEntity: (type: string, id: string) => CallLog[];
  logCall: (data: CallLogFormData) => Promise<void>;
}
```

---

## Team Hooks

### `useTeam()`

**File:** `hooks/useTeam.ts`

**Services Called:** `teamService`

```typescript
{
  team: Team | null;
  members: TeamMember[];
  invitations: TeamInvitation[];
  currentMember: TeamMember | null;
  loading: boolean;
  error: string | null;
  updateTeam: (data: TeamFormData) => Promise<void>;
  inviteMember: (data: InviteMemberFormData) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  changeMemberRole: (memberId: string, role: TeamRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  refresh: () => Promise<void>;
}
```

---

### `useTeamData()`

**File:** `hooks/useTeamData.ts`

**Services Called:** Cross-entity service reads

**Purpose:** Provides team-scoped data access (leads, contacts, etc., filtered by team membership).

---

### `usePermissions()`

**File:** `hooks/usePermissions.ts`

**Services Called:** `TeamContext` (no direct service)

```typescript
{
  role: TeamRole | null;
  hasPermission: (action: PermissionAction, entity: PermissionEntity) => boolean;
  canAccessRecord: (entity: PermissionEntity, scope: PermissionScope) => boolean;
  canCreate: (entity: PermissionEntity) => boolean;
  canRead: (entity: PermissionEntity) => boolean;
  canUpdate: (entity: PermissionEntity) => boolean;
  canDelete: (entity: PermissionEntity) => boolean;
}
```

**Dependency Chain:** → `context/TeamContext.tsx` → `modules/teams/teamPermissions.ts`

---

## Settings Hooks

### `useAutomation()`

**File:** `hooks/useAutomation.ts`

**Services Called:** `automationService`

```typescript
{
  rules: AutomationRule[];
  loading: boolean;
  error: string | null;
  createRule: (data: AutomationRuleFormData) => Promise<AutomationRule | undefined>;
  updateRule: (id: string, data: Partial<AutomationRuleFormData>) => Promise<AutomationRule | undefined>;
  deleteRule: (id: string) => Promise<boolean>;
  toggleRule: (id: string, enabled: boolean) => Promise<void>;
}
```

---

### `useWorkflows()`

**File:** `hooks/useWorkflows.ts`

**Services Called:** `workflowService`

```typescript
{
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  loading: boolean;
  error: string | null;
  createState: (data: WorkflowStateFormData) => Promise<void>;
  updateState: (id: string, data: Partial<WorkflowStateFormData>) => Promise<void>;
  deleteState: (id: string) => Promise<void>;
  createTransition: (data: WorkflowTransitionFormData) => Promise<void>;
  deleteTransition: (id: string) => Promise<void>;
}
```

---

### `useForecasts()`

**File:** `hooks/useForecasts.ts`

**Services Called:** `forecastService`

```typescript
{
  forecasts: Forecast[];
  loading: boolean;
  error: string | null;
  getYearSummary: (year: number) => ForecastSummary;
  setForecast: (data: ForecastFormData) => Promise<void>;
  recalculateActuals: (year: number, month: number) => Promise<void>;
}
```

---

### `useGoals()`

**File:** `hooks/useGoals.ts`

**Services Called:** `goalService`

```typescript
{
  goals: Goal[];
  loading: boolean;
  error: string | null;
  createGoal: (data: GoalFormData) => Promise<void>;
  updateGoal: (id: string, data: Partial<GoalFormData>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  getProgress: (goal: Goal) => number; // 0-100 percentage
}
```

---

## Utility Hooks

### `useDebounce()`

**File:** `hooks/useDebounce.ts`

```typescript
function useDebounce<T>(value: T, delay: number): T
```

Delays value updates by the specified number of milliseconds. Used by the global search to avoid excessive re-renders.

---

### `useInView()`

**File:** `hooks/useInView.ts`

```typescript
function useInView(options?: IntersectionObserverInit): { ref: RefObject<HTMLDivElement>; inView: boolean }
```

Intersection Observer hook for lazy loading and infinite scroll detection.

---

### `useCurrentUser()`

**File:** `hooks/useCurrentUser.ts`

```typescript
{
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

Reads from `useAuthStore` (Zustand) to get the current authenticated user. Used for ownership checks and UI personalization.

---

### `useCsvExport()`

**File:** `hooks/useCsvExport.ts`

**Services Called:** `csv-export` utilities

```typescript
{
  exportToCsv: (entityType: string, data: Record<string, unknown>[], columns: ColumnDef[]) => void;
  isExporting: boolean;
}
```

Triggers a CSV download in the browser using column definitions from `lib/csv-export-definitions.ts`.

---

### `useTags()`

**File:** `hooks/useTags.ts`

**Services Called:** `tagService`

```typescript
{
  tags: Tag[];
  loading: boolean;
  error: string | null;
  createTag: (data: TagFormData) => Promise<void>;
  updateTag: (id: string, data: Partial<TagFormData>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  getTagsForEntity: (entityType: string, entityId: string) => Tag[];
}
```

---

### `useNotifications()`

**File:** `hooks/useNotifications.ts`

```typescript
{
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
}
```

---

### `useLeadScoring()`

**File:** `hooks/useLeadScoring.ts`

**Services Called:** `leadService`

```typescript
{
  score: LeadScore | null;
  loading: boolean;
  error: string | null;
  calculateScore: (leadId: string) => Promise<void>;
  recalculateScores: () => Promise<void>;
}
```

---

### `useAttachments()`

**File:** `hooks/useAttachments.ts`

**Services Called:** `attachmentService`

```typescript
{
  attachments: FileAttachment[];
  loading: boolean;
  error: string | null;
  uploadFile: (file: File, relatedToType: string, relatedToId: string) => Promise<void>;
  deleteAttachment: (id: string) => Promise<void>;
  getForEntity: (type: string, id: string) => FileAttachment[];
}
```

---

### `useIntegrations()`

**File:** `hooks/useIntegrations.ts`

**Services Called:** `integrationService`

```typescript
{
  integrations: CalendarIntegration[];
  loading: boolean;
  error: string | null;
  connect: (provider: CalendarProvider) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  toggleSync: (id: string, enabled: boolean) => Promise<void>;
}
```

---

### `usePortal()`

**File:** `hooks/usePortal.ts`

**Services Called:** `portalService`

```typescript
{
  users: PortalUser[];
  shares: PortalShare[];
  loading: boolean;
  error: string | null;
  createUser: (data: PortalUserFormData) => Promise<void>;
  toggleUser: (id: string, active: boolean) => Promise<void>;
  createShare: (data: PortalShareFormData) => Promise<void>;
  deleteShare: (id: string) => Promise<void>;
}
```

---

### Hook Pattern Summary

All hooks share a consistent pattern:

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { entityService } from '@/services/entity.service';
import { useEntityCache } from '@/store/entity-cache';

export function useEntity() {
  const [data, setData] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await entityService.getAll();
      setData(result);
      useEntityCache.getState().setEntity(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // CRUD methods with optimistic updates + rollback

  return { data, loading, error, refresh, getById, create, update, delete: deleteEntity };
}
```
