# Business Logic Module Reference

## NexusCRM — All Module Files

---

This document catalogs every file in the `modules/` directory. Modules contain pure business logic with no side effects — they transform data, validate inputs, and compute analytics. Modules never import from hooks, components, or services.

---

## Analytics

### `modules/analytics/analyticsUtils.ts`

**Purpose:** Dashboard and analytics page computation.

**Functions:**
```typescript
function calculateKPIs(leads: Lead[], deals: Deal[]): KPIData
// Returns: { totalLeads, activeDeals, wonDeals, revenueForecast, meetingsToday }

function buildFunnelData(leads: Lead[]): FunnelStage[]
// Returns: [{ stage: 'new', count: 10, value: 50000 }, ...]

function buildSourceBreakdown(leads: Lead[]): SourceBreakdown[]
// Returns: [{ source: 'website', count: 45, percentage: 30 }, ...]

function calculateMonthlyTrends(leads: Lead[]): MonthlyTrend[]
// Returns: [{ month: '2026-01', created: 20, won: 5 }, ...]
```

**Used By:** Dashboard page, Analytics page

---

## Companies

### `modules/companies/companyFilters.ts`

**Purpose:** Company search and filter utilities.

```typescript
function applyCompanyFilters(companies: Company[], filters: CompanyFilters): Company[]
// Filters: search (name/industry), industry, size
```

---

## Contacts

### `modules/contacts/contactFilters.ts`

**Purpose:** Contact search and filter utilities.

```typescript
function applyContactFilters(contacts: Contact[], filters: ContactFilters): Contact[]
// Filters: search (name/email), companyId, tags
```

---

## Deals

### `modules/deals/dealPipelineUtils.ts`

**Purpose:** Deal pipeline state builders.

```typescript
function buildDealPipeline(deals: Deal[], stages: DealStage[]): DealPipelineState
// Groups deals by stage, adds stage metadata

function calculateDealStageStats(deals: Deal[], stage: DealStage): StageStats
// Returns { count, totalValue, weightedValue }
```

---

## Leads

### `modules/leads/leadFilters.ts`

**Purpose:** Lead search and filter utilities.

```typescript
function applyLeadFilters(leads: Lead[], filters: LeadFilters): Lead[]
// Filters: search (name/email/company), status, source, priority, assignedTo, minScore
```

### `modules/leads/leadValidation.ts`

**Purpose:** Lead form validation.

```typescript
function validateLeadForm(data: LeadFormData): ValidationResult
// Returns { isValid: false, errors: { fullName: 'Required' } }

function validateLeadField(field: string, value: unknown): string | null
// Returns error message or null
```

**Validation Rules:**
- `fullName` — required, min 2 characters
- `email` — optional, valid email format if provided
- `phone` — optional, valid phone format if provided
- `estimatedValue` — optional, must be positive number
- `source`, `status`, `priority` — must be valid enum values

---

## Meetings

### `modules/meetings/meetingFilters.ts`

**Purpose:** Meeting filter and sort utilities.

```typescript
function applyMeetingFilters(meetings: Meeting[], filters: MeetingFilters): Meeting[]
// Filters: date range, type, relatedTo

function sortMeetings(meetings: Meeting[], sortBy: 'date' | 'created'): Meeting[]
```

---

## Pipeline

### `modules/pipeline/pipelineUtils.ts`

**Purpose:** Pipeline state builders for kanban board.

```typescript
function buildPipelineState(leads: Lead[]): PipelineState
// Returns leads grouped by status with counts

function calculateStageStats(leads: Lead[], stage: LeadStatus): StageStats
// Returns { count, totalValue } for a given stage

function getAvailableTransitions(lead: Lead, workflowStates: WorkflowState[]): WorkflowState[]
// Returns valid next states based on workflow configuration
```

**Used By:** `usePipeline()` hook

---

## Search

### `modules/search/globalSearch.ts`

**Purpose:** Cross-entity search engine.

```typescript
function globalSearch(entities: SearchableEntities, query: string): SearchResults
// Returns { leads: Lead[], contacts: Contact[], companies: Company[], tasks: Task[], meetings: Meeting[] }

function scoreResult(entity: unknown, query: string): number
// Relevance scoring for result ordering
```

**Search Fields:**
- Leads: fullName, email, companyName
- Contacts: name, email, jobTitle
- Companies: name, industry
- Tasks: title, description
- Meetings: title, notes

**Used By:** `useSearch()` hook, `CommandPalette.tsx` component

---

## Tasks

### `modules/tasks/taskUtils.ts`

**Purpose:** Task filtering, overdue detection, and due-today queries.

```typescript
function filterTasks(tasks: Task[], filters: TaskFilters): Task[]
// Filters: status, priority, assignedTo, search

function getOverdueTasks(tasks: Task[]): Task[]
// Returns tasks where dueDate < now and status !== 'completed'

function getDueTodayTasks(tasks: Task[]): Task[]
// Returns tasks where dueDate is today

function getTaskPriorityColor(priority: TaskPriority): string
// Returns Tailwind class for priority indicator
```

**Used By:** `useTasks()` hook, tasks page, dashboard

---

## Teams

### `modules/teams/teamPermissions.ts`

**Purpose:** Role-based permission matrix.

```typescript
function hasPermission(role: TeamRole, action: PermissionAction, entity: PermissionEntity): boolean
// Checks if role can perform action on entity

function canAccessRecord(role: TeamRole, entity: PermissionEntity, scope: PermissionScope): boolean
// Checks scope-based access (own/team/all)

function getRolePermissions(role: TeamRole): Permission[]
// Returns all permissions for a given role
```

**Permission Matrix:**

| Role | Leads | Contacts | Companies | Tasks | Meetings | Team Mgmt | Analytics |
|------|-------|----------|-----------|-------|----------|-----------|-----------|
| **Admin** | CRUD all | CRUD all | CRUD all | CRUD all | CRUD all | Full | View |
| **Manager** | CRUD team | CRUD team | CRUD team | CRUD team | CRUD team | Read members | View |
| **Agent** | CRUD own | CRUD own | Read team | CRUD own | CRUD own | Read own | None |
| **Viewer** | Read all | Read all | Read all | Read all | Read all | Read members | View |

**Used By:** `usePermissions()` hook, `PermissionGuard` component, `TeamContext`

---

### `modules/teams/teamValidation.ts`

**Purpose:** Team form validation.

```typescript
function validateTeamForm(data: TeamFormData): ValidationResult
// Ensures name is non-empty, min 2 chars

function validateInviteForm(data: InviteMemberFormData): ValidationResult
// Validates email format and role selection
```

---

## Module Isolation Rules

- Modules **CANNOT** import from hooks, components, or services
- Modules **CAN** import from types and lib
- Modules are **pure functions** — no side effects, no state
- Modules return **new data** (they don't mutate inputs)
- Modules are **synchronous** (async logic lives in hooks and services)

```typescript
// ✅ CORRECT — pure function, no side effects
export function applyLeadFilters(leads: Lead[], filters: LeadFilters): Lead[] {
  return leads.filter(lead => {
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.search && !lead.fullName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}

// ❌ WRONG — module should not call services
export function applyLeadFilters(leads: Lead[], filters: LeadFilters): Lead[] {
  leadService.logActivity('filter'); // NO! Side effects in modules
  return leads.filter(...);
}
```
