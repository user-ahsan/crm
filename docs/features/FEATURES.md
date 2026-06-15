# Feature Catalog

## NexusCRM — Complete Feature Documentation

---

This document catalogs every feature in the NexusCRM system. Each feature covers UI implementation, state handling, error handling, empty/loading states, edge cases, and data validation.

---

## Core Entity Management

### 1. Leads

**Routes:** `/leads` (table), `/leads/{id}` (detail), create/edit in modal/drawer

**Data Types:** `Lead`, `LeadFormData`, `LeadFilters` — see `types/lead.types.ts`

**Statuses:** `new`, `contacted`, `qualified`, `proposal`, `won`, `lost`

**Sources:** `manual`, `website`, `referral`, `ads`, `social`

**Priorities:** `low`, `medium`, `high`

**Components:**
- `components/leads/LeadTable.tsx` — Sortable, filterable data table
- `components/leads/LeadForm.tsx` — Create/edit form with validation
- `components/leads/LeadDetail.tsx` — Detail view with 10 tabs
- `components/leads/LeadFilterBar.tsx` — Multi-criteria filter bar
- `components/leads/LeadBulkActions.tsx` — Bulk operations

**Detail Tabs:**
1. **Activity** — Chronological activity timeline
2. **Notes** — Polymorphic Markdown notes
3. **Tasks** — Linked tasks with status
4. **Meetings** — Linked meetings
5. **Calls** — Call log history
6. **SMS** — SMS message history
7. **Emails** — Email history
8. **Files** — File attachments
9. **Details** — Full data view
10. **Score** — Lead scoring breakdown

**Services:** `leadService` (`services/lead.service.ts`)
- CRUD: `getAll`, `getById`, `create`, `update`, `delete`
- Scoring: `calculateScore`, `getScore`, `updateScore`, `batchUpdateScores`
- Pipeline: `getPipelineStats`, `updateStatus`
- Quality: `findDuplicates`, `mergeLeads`
- Filtering: `getFiltered`

**Hooks:** `useLeads()` (`hooks/useLeads.ts`)
- Returns: `leads`, `loading`, `error`, `getFiltered`, `getById`, `createLead`, `updateLead`, `deleteLead`
- Optimistic updates with rollback on failure
- Entity cache integration

**Cached Hook:** `useCachedLeads()` — read-only cached access

**Modules:** `modules/leads/leadFilters.ts`, `modules/leads/leadValidation.ts`

**Filters:** Search (name/email/company), status, source, priority, assignedTo, minScore

---

### 2. Contacts

**Routes:** `/contacts` (table), `/contacts/{id}` (detail)

**Data Types:** `Contact`, `ContactFormData` — see `types/contact.types.ts`

**Components:**
- Contact table with search and filters
- Contact detail with tabs (Leads, Meetings, Tasks, Communications, Notes)
- Create/edit form modal
- Company linking dropdown
- Lead linking selector

**Services:** `contactService` (`services/contact.service.ts`)
- CRUD: `getAll`, `getById`, `create`, `update`, `delete`
- Filtering: `getFiltered`
- Quality: `findDuplicates`, `mergeContacts`

**Hook:** `useContacts()`, `useCachedContacts()`

**Modules:** `modules/contacts/contactFilters.ts`

---

### 3. Companies

**Routes:** `/companies` (table), `/companies/{id}` (detail)

**Data Types:** `Company`, `CompanyFormData` — see `types/company.types.ts`

**Sizes:** `1-10`, `11-50`, `51-200`, `201-1000`, `1000+`

**Components:**
- Company table with revenue estimation (mock)
- Company detail with linked contacts/leads
- Revenue display in formatted currency

**Services:** `companyService` (`services/company.service.ts`)
- CRUD: `getAll`, `getById`, `create`, `update`, `delete`
- Filtering: `getFiltered`

**Hook:** `useCompanies()`, `useCachedCompanies()`

**Modules:** `modules/companies/companyFilters.ts`

---

### 4. Deals

**Routes:** `/deals` (table), `/deals/{id}` (detail)

**Data Types:** `Deal`, `DealFormData`, `DealStage` — see `types/deal.types.ts`

**Components:**
- Deal table with stage, value, currency
- Deal detail with communications
- Pipeline stage selector
- Multi-currency support

**Services:** `dealService` (`services/deal.service.ts`)
- CRUD: `getAll`, `getById`, `create`, `update`, `delete`
- Stages: stage management queries

**Hook:** `useDeals()`

**Modules:** `modules/deals/dealPipelineUtils.ts`

---

## Pipeline & Workflow

### 5. Sales Pipeline

**Route:** `/pipeline`

**Components:** `components/pipeline/`

**Features:**
- Drag-and-drop kanban board with 6 stages (New → Contacted → Qualified → Proposal → Won → Lost)
- Swimlane grouping by assignee or priority
- Stage analytics (count + total value per stage)
- Pipeline value: sum of `estimatedValue` for deals in each stage
- Lead cards with name, company, value, priority indicators
- Drag state animation (elevated shadow + drop zone highlight)
- On drop: optimistic update → activity logged → webhook triggered

**Hook:** `usePipeline()` (`hooks/usePipeline.ts`)
- Pipeline state management
- `moveLead(leadId, newStage)` with drag validation
- Stage stats computation

**Modules:** `modules/pipeline/pipelineUtils.ts`

---

### 6. Workflow Builder

**Route:** `/settings/workflows`

**Data Types:** `WorkflowState`, `WorkflowTransition`, `WorkflowEntityType` — see `types/workflow.types.ts`

**Entity Types:** `lead`, `deal`, `task`

**Features:**
- Custom states per entity type (with color coding)
- Custom transitions between states
- Sort order management
- Visual state-transition diagram (list-based)

**Services:** `workflowService` (`services/workflow.service.ts`)
- CRUD: `getStates`, `createState`, `updateState`, `deleteState`
- Transitions: `getTransitions`, `createTransition`, `deleteTransition`

**Hook:** `useWorkflows()`

---

## Task & Meeting Management

### 7. Tasks

**Route:** `/tasks`

**Data Types:** `Task`, `TaskFormData` — see `types/task.types.ts`

**Priorities:** `low`, `medium`, `high`, `critical`

**Statuses:** `pending`, `completed`, `overdue`

**Features:**
- Full CRUD with inline edit and modal forms
- Priority color coding
- Overdue detection (red badge + highlighted row)
- Entity linking (relatedToType + relatedToId)
- Filters: status, priority, assignedTo, entity type
- Sort: due date, priority, created date
- Checkbox toggle for complete/incomplete

**Hook:** `useTasks()`, `useCachedTasks()`

**Modules:** `modules/tasks/taskUtils.ts`
- `filterTasks()`, `getOverdueTasks()`, `getDueTodayTasks()`

---

### 8. Meetings

**Route:** `/meetings`

**Data Types:** `Meeting`, `MeetingFormData` — see `types/meeting.types.ts`

**Types:** `online`, `offline`, `call`

**Features:**
- Full CRUD with modal forms
- Calendar view (month/week toggle)
- Duration presets (15min, 30min, 60min, custom)
- Entity linking (lead/contact/company)
- Participant management
- Meeting type badges
- Rescheduling UI

**Hook:** `useMeetings()`, `useCachedMeetings()`

**Modules:** `modules/meetings/meetingFilters.ts`

---

## Communication Suite

### 9. Notes

**Data Types:** `Note`, `NoteFormData` — see `types/communication.types.ts`

**Features:**
- Polymorphic: attach to any entity (lead, contact, company, deal, task, meeting)
- Markdown support in body
- Edit tracking (updatedAt)
- Created-by attribution
- Title + body structure

**Hook:** `useNotes()`

---

### 10. Email

**Data Types:** `Email`, `EmailFormData` — see `types/communication.types.ts`

**Direction:** `inbound`, `outbound`

**Statuses:** `draft`, `sent`, `failed`

**Features:**
- Compose modal with to/subject/body
- Sent history per entity
- Draft management
- Direction tracking (inbound/outbound)

**Hook:** `useEmail()`

---

### 11. SMS

**Data Types:** `SmsLog`, `SmsFormData` — see `types/sms.types.ts`

**Direction:** `inbound`, `outbound`

**Statuses:** `sent`, `delivered`, `failed`

**Features:**
- Compose modal with number/body
- History per entity
- Delivery status tracking (sent/delivered/failed)
- Direction indicators

**Hook:** `useSms()`

---

### 12. Call Logs

**Data Types:** `CallLog`, `CallLogFormData` — see `types/communication.types.ts`

**Direction:** `inbound`, `outbound`

**Results:** `completed`, `no_answer`, `busy`, `failed`, `voicemail`

**Features:**
- Direction badges (inbound/outbound)
- Duration tracking
- Result selection
- Caller/callee fields
- Notes per call

**Hook:** `useCallLogs()`

---

### 13. Activity Timeline

**Data Types:** `Activity` — see `types/activity.types.ts`

**Types:** `created`, `updated`, `deleted`, `status_changed`, `note_added`, `meeting_scheduled`, `meeting_completed`, `task_created`, `task_completed`, `communication_logged`, `assigned`

**Component:** `ActivityTimeline.tsx` (shared)

**Features:**
- Per-entity chronological activity feed
- Type-specific icons and colors
- Relative timestamps ("2 hours ago")
- Filterable by activity type
- Metadata display (old/new values)

**Services:** `activityService` (`services/activity.service.ts`)
- `log(entityType, entityId, type, description, metadata?)`
- `getForEntity(entityType, entityId): Activity[]`

**Hook:** `useActivities()`

---

## Sales Tools

### 14. Quotes

**Route:** `/quotes`

**Data Types:** `Quote`, `QuoteItem`, `QuoteFormData` — see `types/quote.types.ts`

**Statuses:** `draft`, `sent`, `accepted`, `rejected`

**Features:**
- Line-item editor (description, quantity, unit price)
- Auto-calculated totals (subtotal, discount, total)
- Status workflow (draft → sent → accepted/rejected)
- Entity linking (deal, lead, contact, company)
- Discount field
- Validity date tracking

**Hook:** `useQuotes()`

---

### 15. Goals

**Route:** `/goals`

**Data Types:** `Goal`, `GoalFormData` — see `types/goal.types.ts`

**Types:** `revenue`, `deals_count`, `leads_created`, `tasks_completed`, `calls_made`, `custom`

**Periods:** `weekly`, `monthly`, `quarterly`, `yearly`

**Features:**
- Goal creation with type, target, and period
- Progress bars (current vs target)
- Period tracking with start/end dates
- Assignment to users

**Hook:** `useGoals()`

---

### 16. Forecasts

**Data Types:** `Forecast`, `ForecastFormData`, `ForecastSummary` — see `types/forecast.types.ts`

**Features:**
- Monthly/yearly target creation
- Actual tracking (auto-calculated from won deals)
- Achievement percentage
- Year summary with all months
- Target vs actual comparison

**Hook:** `useForecasts()`

---

### 17. Campaigns

**Route:** `/campaigns`

**Data Types:** `EmailSequence`, `CampaignEmail`, `EmailSequenceFormData` — see `types/campaign.types.ts`

**Statuses:** `draft`, `active`, `paused`, `completed`

**Features:**
- Multi-step email sequences
- Delay days between steps
- Sort order management
- Subject/body editing per step
- Status management (draft → active → paused → completed)

**Hook:** `useCampaigns()`

---

## Analytics & Insights

### 18. Dashboard

**Route:** `/dashboard`

**Features:**
- **KPI Cards:** Total Leads, Active Deals, Won Deals, Revenue Forecast, Meetings Today
- **Pipeline Funnel:** Bar chart by stage (count + value)
- **Lead Sources:** Donut chart showing lead distribution by source
- **Monthly Performance:** Line chart of leads vs conversions over time
- **Tasks Due Today:** Checkbox list of overdue/due tasks
- Responsive grid layout

**Module:** `modules/analytics/analyticsUtils.ts`
- `calculateKPIs(leads, deals)`
- `buildFunnelData(leads)`
- `buildSourceBreakdown(leads)`
- `calculateMonthlyTrends(allLeads)`

---

### 19. Analytics Page

**Route:** `/analytics`

**Features:**
- Pipeline funnel (by count and by value)
- Lead source breakdown with percentages
- Status distribution (pie/bar chart)
- Forecast comparison (target vs actual)
- Date range selector

---

## Team & Collaboration

### 20. Teams

**Route:** `/settings/team`

**Data Types:** `Team`, `TeamMember`, `TeamInvitation` — see `types/team.types.ts`

**Roles:** `admin`, `manager`, `agent`, `viewer`

**Features:**
- Team creation with name/description
- Invite members by email with role selection
- Member list with role badges
- Role change (admin only)
- Remove member (admin only)
- Pending invitations management
- Invite code generation

**Services:** `teamService` (`services/team.service.ts`)
- `getCurrentTeam`, `getMembers`, `create`, `update`
- `inviteMember`, `cancelInvitation`
- `changeMemberRole`, `removeMember`

**Components:**
- `TeamInfoCard` — display/edit team details
- `TeamMemberList` — table with role badges
- `InviteMemberDialog` — email+role invite form
- `RoleBadge` — colored role indicator

**Hooks:** `useTeam()`, `useTeamData()`

**Context:** `TeamContext` — provides team + permission info app-wide

---

### 21. Permission System

**Types:** `PermissionAction`, `PermissionEntity`, `PermissionScope`, `Permission` — see `types/team.types.ts`

**Role-to-Permission Mapping:**

| Role | Leads | Contacts | Companies | Tasks | Meetings | Team Mgmt | Analytics |
|------|-------|----------|-----------|-------|----------|-----------|-----------|
| **Admin** | CRUD all | CRUD all | CRUD all | CRUD all | CRUD all | Full | View |
| **Manager** | CRUD team | CRUD team | CRUD team | CRUD team | CRUD team | Read members | View |
| **Agent** | CRUD own | CRUD own | Read team | CRUD own | CRUD own | Read own | None |
| **Viewer** | Read all | Read all | Read all | Read all | Read all | Read members | View |

**Module:** `modules/teams/teamPermissions.ts`
- `hasPermission(role, action, entity): boolean`
- `canAccessRecord(role, scope, recordOwnerId, currentUserId): boolean`
- `getRolePermissions(role): Permission[]`

**Component:** `PermissionGuard` — wraps UI to show/hide based on permissions

---

## Settings & Configuration

### 22. Theme

**Features:**
- Dark/light mode toggle
- Persisted to localStorage (`nexuscrm-theme`)
- Uses `next-themes` + Zustand
- System preference detection
- Instant class toggle on `<html>` element

**Store:** `useThemeStore` (`store/theme.ts`)

---

### 23. Saved Views

**Data Types:** `SavedView`, `ViewEntityType` — see `types/saved-view.types.ts`

**Entity Types:** `lead`, `contact`, `company`, `deal`, `task`, `meeting`

**Features:**
- Save current filters as a named view
- Load previously saved views
- Per-entity view management
- Sort configuration
- User-specific (createdBy)

**Hook:** Custom view management within each entity page

---

### 24. Automation Rules

**Route:** `/settings/automation`

**Data Types:** `AutomationRule`, `AutomationTriggerEvent`, `AutomationCondition`, `AutomationAction` — see `types/automation.types.ts`

**Trigger Events (14):**
- `lead.created`, `lead.updated`, `lead.status_changed`
- `contact.created`, `contact.updated`
- `company.created`, `company.updated`
- `task.created`, `task.completed`, `task.overdue`
- `meeting.created`, `meeting.completed`
- `deal.created`, `deal.stage_changed`

**Conditions Operators:** `equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `changed`

**Actions (6):** `assign_user`, `change_status`, `add_tag`, `send_email`, `send_notification`, `trigger_webhook`

**Features:**
- Rule creation with trigger event selection
- Condition builder (field + operator + value)
- Action configuration
- Enable/disable toggle
- Rule evaluation engine

**Hook:** `useAutomation()`

---

### 25. API Keys

**Route:** `/settings/api-keys`

**Data Types:** `ApiKey`, `ApiKeyFormData`, `ApiKeyCreateResponse` — see `types/api-key.types.ts`

**Scopes:** `read`, `write`, `admin`

**Features:**
- Key generation with name and scopes
- Key prefix display (full key shown once)
- Last-used tracking
- Expiration date
- Key revocation/deletion

**Hook:** Custom API key management

---

### 26. Integrations

**Route:** `/settings/integrations`

**Data Types:** `CalendarIntegration`, `CalendarProvider` — see `types/integration.types.ts`

**Providers:** `google`, `outlook`

**Features:**
- Google Calendar mock OAuth flow
- Outlook Calendar mock OAuth flow
- Sync enable/disable toggle
- Last synced timestamp
- Provider disconnect

**Hook:** `useIntegrations()`

---

### 27. Customer Portal

**Route:** `/settings/portal`

**Data Types:** `PortalUser`, `PortalUserFormData`, `PortalShare`, `PortalShareFormData` — see `types/portal.types.ts`

**Features:**
- External user creation (email + name + password)
- Portal user management (activate/deactivate)
- Record sharing with permissions (read/write)
- Entity-level sharing (lead, contact, company, etc.)
- Last login tracking

**Hook:** `usePortal()`

---

### 28. Data Quality

**Route:** `/settings/data-quality`

**Features:**
- Duplicate detection across leads, contacts, and companies
- Matching strategies: email (exact), phone (normalized), name (fuzzy), company (exact)
- Configurable similarity threshold
- Merge with survivor selection
- Auto-merge of related entities (tasks, meetings, activities)

**Services:** `leadService.findDuplicates()`, `contactService.findDuplicates()`
**Utils:** `lib/utils.ts` — `findDuplicates()`, `normalizePhone()`, `fuzzyNameMatch()`

---

### 29. Tag Management

**Route:** `/tags`

**Data Types:** `Tag`, `Tagging`, `TagFormData` — see `types/tag.types.ts`

**Features:**
- Color-coded tags (color picker per tag)
- Usage tracking (entity count per tag)
- Polymorphic tagging on: lead, contact, company, task, meeting, deal
- Tag CRUD
- Tag input with autocomplete

**Hook:** `useTags()`

---

### 30. Onboarding Wizard

**Route:** `/onboarding`

**Steps:**
1. **Welcome** — Introduction and feature overview
2. **Profile** — Name, job title, role
3. **Company** — Team name, industry, size (updates team created during signup)
4. **Goals** — Select primary CRM goals
5. **Complete** — Summary with "Go to Dashboard" button
6. **Team Invite** — Invite code generation (optional)

**Features:**
- 6-step wizard with progress indicator
- Back/Next navigation
- Team creation during signup, updated during onboarding
- sessionStorage for state persistence between steps

---

## Cross-Cutting

### 31. Global Search (Cmd+K)

**Component:** `CommandPalette.tsx`

**Features:**
- Cmd+K keyboard shortcut (or click search bar)
- Centered modal overlay with auto-focused input
- Cross-entity search: leads, contacts, companies, tasks, meetings
- Results grouped by entity type with icons
- Arrow key navigation + Enter to navigate
- Esc to close
- "View all {entity} results" links

**Hook:** `useSearch()` — debounced cross-entity search

**Module:** `modules/search/globalSearch.ts` — search logic

---

### 32. Notifications

**Component:** `NotificationPanel.tsx`

**Features:**
- In-app notification panel (bell icon in TopBar)
- Type-specific icons (lead, task, meeting, etc.)
- Mark as read
- Notification count badge

**Hook:** `useNotifications()`

---

### 33. CSV Import/Export

**Components:** `ImportDialog.tsx`, `ExportDropdown.tsx`

**Features:**
- **Import:** Column-mapped CSV import with preview, field mapping, validation
- **Export:** Configurable column selection per entity, CSV download
- Supported entities: leads, contacts, companies, deals, tasks, meetings

**Utils:** `lib/csv-export.ts`, `lib/csv-export-definitions.ts`

**Hook:** `useCsvExport()`

---

### 34. Bulk Actions

**Component:** `BulkActionBar.tsx`

**Features:**
- Multi-select rows via checkboxes
- Bulk delete, update, assign, tag, export
- Selection count display
- Confirm dialog for destructive actions
- Integrated into all entity tables

---

### 35. n8n Webhook Integration

**Route:** `app/api/webhook/n8n/route.ts`

**Events (15):**
- Lead: created, updated, deleted, status_changed
- Contact: created, updated, deleted
- Company: created, updated, deleted
- Task: created, completed, overdue
- Meeting: created, completed

**Features:**
- Real-time event streaming to n8n
- Bearer token authentication
- Fire-and-forget design
- Configurable webhook URL + secret
- Health check endpoint (`GET`)

**Services:** `webhook.service.ts` — `triggerWebhook()`, `triggerWebhookWithDetails()`

**Types:** `webhook.types.ts` — `WebhookEvent` type union

See [API.md](../reference/API.md) for full API reference.
