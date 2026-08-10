# System Architecture & Data Flow

## NexusCRM — Frontend-First CRM Architecture

---

### 1. Architecture Overview

NexusCRM is a **frontend-first** application. There is no traditional backend server. All business logic, data persistence, and state management live on the client side. This makes it fully deployable on Vercel with zero server management. Optional Supabase integration provides real PostgreSQL and Auth.

```
┌───────────────────────────────────────────────────────────┐
│                   NEXT.JS 16 APP                          │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                   UI LAYER                            │ │
│  │  app/ (routes) + components/ (pure UI components)    │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────┴───────────────────────────────┐ │
│  │                 HOOKS LAYER                           │ │
│  │   hooks/useLeads, useContacts, usePipeline, etc.     │ │
│  │   State management, data fetching, caching           │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────┴───────────────────────────────┐ │
│  │               MODULES LAYER                           │ │
│  │   modules/analytics, leadValidation,                  │ │
│  │   teamPermissions, pipelineUtils, etc.                │ │
│  │   Business logic, validation, data transformation     │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────┴───────────────────────────────┐ │
│  │              SERVICES LAYER                           │ │
│  │   services/lead.service, webhook.service, etc.       │ │
│  │   Data mutation — CRUD operations                    │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────┴───────────────────────────────┐ │
│  │               DATA LAYER                              │ │
│  │   data/ (mock) + supabase/ (optional PostgreSQL)     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Zustand │  │   Context  │  │   store/             │  │
│  │  Stores  │  │   TeamCtx  │  │   entity-cache       │  │
│  └──────────┘  └────────────┘  └──────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

### 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui with @base-ui/react |
| **Icons** | @tabler/icons-react |
| **State Management** | Zustand 5 (with persist middleware) |
| **Search UI** | cmdk (command palette) |
| **Theme** | next-themes + Zustand |
| **Notifications** | sonner (toast system) |
| **Data** | Local mock data (in-memory arrays) |
| **Database (optional)** | Supabase (PostgreSQL) + @supabase/ssr |
| **Auth** | Supabase Auth (via proxy.ts middleware) |
| **Deployment** | Vercel |
| **Package Manager** | Bun |

---

### 3. Layer Responsibility Table + Strict Data Flow

The data flow **MUST** follow this exact sequence:

```
UI → Hook → Module → Service → Data
```

#### Layer Responsibilities

| Layer | Location | Responsibility | Can Import From |
|-------|----------|----------------|-----------------|
| **UI** | `app/` + `components/` | Rendering, user interaction, layout, page composition | Hooks, common components |
| **Hooks** | `hooks/` | State management, data fetching, caching, loading/error states | Modules, Services, Store |
| **Modules** | `modules/` | Business logic, validation, data transformation, filtering | Types, Lib |
| **Services** | `services/` | Data mutation (CRUD operations), webhook triggers, cross-module actions | Data, Types, other services |
| **Data** | `data/` | Mock database (in-memory arrays), seed data | Types only |
| **Store** | `store/` | Global UI state (Zustand), cross-component state | Types |
| **Lib** | `lib/` | Utilities, formatters, validators, constants | Types |

#### Layer Rules (Strict)

- **UI** CANNOT contain business logic
- **Services** CANNOT contain UI logic
- **Data** CANNOT contain any logic
- **Hooks** CANNOT define schemas
- **Modules** CANNOT import from hooks or components
- **Components** CANNOT import from services directly (must go through hooks)
- Cross-module actions MUST go through services (no direct mutation)

---

### 4. Full Directory Structure

```
crm-system/
│
├── app/                              # Next.js routes (ONLY routing logic)
│   ├── (auth)/                       # Auth-route group (login, signup)
│   │   ├── login/
│   │   └── signup/
│   ├── analytics/                    # Analytics & reporting page
│   ├── api/
│   │   ├── webhook/n8n/             # n8n webhook API route
│   │   ├── email/                   # Email send, test, batch, webhook
│   │   ├── sms/                     # SMS send, test, batch, status, config
│   │   ├── campaigns/               # Campaign CRUD, activate, process, cron
│   │   ├── webhooks/                # Webhook config, test, deliveries
│   │   ├── portal/auth/             # Portal login, register, reset-password, users
│   │   ├── branding/                # Branding settings + logo upload
│   │   ├── service-config/          # Per-service config (Resend/Twilio/Google)
│   │   ├── integrations/google/     # Google OAuth, callback, disconnect
│   │   └── settings/email/          # Email settings endpoint
│   ├── campaigns/                    # Campaign management page
│   ├── companies/                    # Company management (table + detail)
│   ├── contacts/                     # Contact management (table + detail)
│   ├── dashboard/                    # Main dashboard page
│   ├── deals/                        # Deal management (table + detail)
│   ├── goals/                        # Goals tracking page
│   ├── invoices/                     # Invoice management (table + detail + new)
│   ├── leads/                        # Lead management (table + detail)
│   ├── meetings/                     # Calendar/meeting scheduling page
│   ├── onboarding/                   # 6-step onboarding wizard
│   ├── pipeline/                     # Kanban pipeline board
│   ├── quotes/                       # Quote management page
│   ├── settings/                     # Settings pages
│   │   ├── automation/              # Automation rules
│   │   ├── api-keys/                # API key management
│   │   ├── data-quality/            # Duplicate detection
│   │   ├── email/                   # Email service settings
│   │   ├── forecasts/               # Forecast settings
│   │   ├── integrations/            # Calendar integrations
│   │   ├── invoice-templates/       # Invoice template management
│   │   ├── portal/                  # Customer portal settings
│   │   ├── saved-views/             # Saved views management
│   │   ├── services/                # Service config (Resend/Twilio/Google)
│   │   ├── sms/                     # SMS service settings
│   │   ├── team/                    # Team management
│   │   ├── webhooks/                # Webhook config management
│   │   └── workflows/               # Workflow builder
│   ├── tags/                         # Tag management page
│   ├── tasks/                        # Task management page
│   ├── client-layout.tsx            # Client-side layout wrapper
│   ├── globals.css                   # Global CSS (shadcn base)
│   ├── layout.tsx                    # Root layout with AppShell
│   └── page.tsx                      # Landing page
│
├── components/                       # PURE UI components only
│   ├── ui/                           # shadcn UI primitives (CLI-generated)
│   │   ├── alert-dialog.tsx          # Alert dialog
│   │   ├── avatar.tsx                # Avatar
│   │   ├── badge.tsx                 # Badge
│   │   ├── button.tsx                # Button
│   │   ├── card.tsx                  # Card
│   │   ├── checkbox.tsx              # Checkbox
│   │   ├── collapsible.tsx           # Collapsible
│   │   ├── command.tsx               # Command palette
│   │   ├── dialog.tsx                # Dialog / modal
│   │   ├── dropdown-menu.tsx         # Dropdown menu
│   │   ├── hover-card.tsx            # Hover card
│   │   ├── input-group.tsx           # Input group
│   │   ├── input.tsx                 # Input
│   │   ├── label.tsx                 # Label
│   │   ├── popover.tsx               # Popover
│   │   ├── progress.tsx              # Progress bar
│   │   ├── scroll-area.tsx           # Scroll area
│   │   ├── select.tsx                # Select dropdown
│   │   ├── separator.tsx             # Separator
│   │   ├── sheet.tsx                 # Slide-in sheet
│   │   ├── skeleton.tsx              # Skeleton loading
│   │   ├── sonner.tsx                # Toast notifications
│   │   ├── switch.tsx                # Toggle switch
│   │   ├── table.tsx                 # Table
│   │   ├── tabs.tsx                  # Tabs
│   │   ├── textarea.tsx              # Textarea
│   │   └── tooltip.tsx               # Tooltip
│   │
│   ├── common/                       # Shared UI components
│   │   ├── ActivityTimeline.tsx      # Chronological activity feed
│   │   ├── AppShell.tsx              # Main app layout shell
│   │   ├── BulkActionBar.tsx         # Bulk actions toolbar
│   │   ├── ColumnCustomizer.tsx       # Table column visibility manager
│   │   ├── CommandPalette.tsx        # Cmd+K global search overlay
│   │   ├── ConfirmDialog.tsx         # Confirmation dialog
│   │   ├── EmptyState.tsx            # Empty state with CTA
│   │   ├── ErrorState.tsx            # Error state with retry
│   │   ├── ExportDropdown.tsx        # Export options dropdown
│   │   ├── FileAttachmentList.tsx    # File attachment list
│   │   ├── ImportDialog.tsx          # CSV import dialog
│   │   ├── LoadingSkeleton.tsx       # Loading skeleton
│   │   ├── MarkdownContent.tsx       # Markdown renderer
│   │   ├── NotificationPanel.tsx     # Notification panel
│   │   ├── OnboardingLayout.tsx      # Onboarding wizard layout
│   │   ├── PageHeader.tsx            # Page header with actions
│   │   ├── Sidebar.tsx               # App navigation sidebar
│   │   ├── StatCard.tsx              # KPI stat card
│   │   ├── StatusBadge.tsx           # Status badge
│   │   ├── TagBadge.tsx              # Tag badge
│   │   ├── TagInput.tsx              # Tag input
│   │   ├── TopBar.tsx                # Top bar with search, notifs, profile
│   │   ├── ViewsDropdown.tsx         # Saved views dropdown
│   │   ├── useColumnManager.ts       # Hook for column management
│   │   └── ColumnCustomizer.examples.tsx
│   │
│   ├── leads/                        # Lead-specific components
│   ├── contacts/                     # Contact-specific components
│   ├── companies/                    # Company-specific components
│   ├── deals/                        # Deal-specific components
│   ├── pipeline/                     # Pipeline kanban components
│   ├── tasks/                        # Task-specific components
│   ├── meetings/                     # Meeting/calendar components
│   ├── quotes/                       # Quote-specific components
│   ├── teams/                        # Team management components
│   ├── communication/                # Communication components
│   ├── automation/                   # Automation rule components
│   └── saved-views/                  # Saved view components
│
├── modules/                          # BUSINESS LOGIC LAYER
│   ├── analytics/
│   │   └── analyticsUtils.ts        # KPIs, funnel, sources, monthly
│   ├── companies/
│   │   └── companyFilters.ts        # Company search/filter
│   ├── contacts/
│   │   └── contactFilters.ts        # Contact search/filter
│   ├── deals/
│   │   └── dealPipelineUtils.ts     # Deal pipeline builders
│   ├── leads/
│   │   ├── leadFilters.ts           # Lead search/filter
│   │   └── leadValidation.ts        # Lead form validation
│   ├── meetings/
│   │   └── meetingFilters.ts        # Meeting filter/sort
│   ├── pipeline/
│   │   └── pipelineUtils.ts         # Pipeline state builders
│   ├── search/
│   │   └── globalSearch.ts          # Cross-entity search
│   ├── tasks/
│   │   └── taskUtils.ts             # Task filter/overdue/due-today
│   └── teams/
│       ├── teamPermissions.ts       # Role-based permission matrix
│       └── teamValidation.ts        # Team form validation
│
├── services/                         # Data mutation layer (29 files)
│   ├── lead.service.ts              # Lead CRUD + scoring + duplicates
│   ├── contact.service.ts           # Contact CRUD + duplicates
│   ├── company.service.ts           # Company CRUD
│   ├── deal.service.ts              # Deal CRUD
│   ├── task.service.ts              # Task CRUD
│   ├── meeting.service.ts           # Meeting CRUD
│   ├── activity.service.ts          # Activity logging
│   ├── communication.service.ts     # Email + call logs + notes
│   ├── sms.service.ts               # SMS history
│   ├── tag.service.ts               # Tag CRUD + taggings
│   ├── team.service.ts              # Team CRUD + members + invitations
│   ├── webhook.service.ts           # n8n webhook event dispatch
│   ├── webhook-config.service.ts    # Webhook config management
│   ├── automation.service.ts        # Automation rule engine
│   ├── campaign.service.ts          # Campaign + email sequences
│   ├── campaign-scheduler.service.ts # Scheduled campaign dispatch
│   ├── quote.service.ts             # Quote CRUD + line items
│   ├── invoice.service.ts           # Invoice CRUD + line items
│   ├── forecast.service.ts          # Forecast CRUD
│   ├── goal.service.ts              # Goal CRUD
│   ├── integration.service.ts       # Calendar integration
│   ├── portal.service.ts            # Portal user + share CRUD
│   ├── saved-view.service.ts        # Saved view CRUD
│   ├── api-key.service.ts           # API key management
│   ├── attachment.service.ts        # File attachment CRUD
│   ├── workflow.service.ts          # Workflow state + transition CRUD
│   ├── notification.service.ts      # In-app notification management
│   ├── realtime.service.ts          # Supabase Realtime subscriptions
│   └── supabase.service.ts          # Supabase error formatting helper
│
├── data/                             # MOCK DATABASE LAYER (14 files)
│   ├── leads.ts                     # Mock leads array
│   ├── contacts.ts                  # Mock contacts array
│   ├── companies.ts                 # Mock companies array
│   ├── deals.ts                     # Mock deals array
│   ├── tasks.ts                     # Mock tasks array
│   ├── meetings.ts                  # Mock meetings array
│   ├── activities.ts                # Mock activities array
│   ├── teams.ts                     # Mock teams array
│   ├── team-members.ts              # Mock team members array
│   ├── team-invitations.ts          # Mock team invitations array
│   ├── quotes.ts                    # Mock quotes array
│   ├── invoices.ts                  # Mock invoices array
│   ├── campaigns.ts                 # Mock campaigns array
│   └── mock-users.ts               # User directory (imported by 13+ components)
│
├── hooks/                            # Custom React hooks (39 total)
│   ├── useLeads.ts                  # Lead CRUD + state
│   ├── useContacts.ts               # Contact CRUD
│   ├── useCompanies.ts              # Company CRUD
│   ├── useDeals.ts                  # Deal CRUD
│   ├── useTasks.ts                  # Task CRUD
│   ├── useMeetings.ts               # Meeting CRUD
│   ├── usePipeline.ts               # Pipeline state + drag-drop
│   ├── useActivities.ts             # Activity timeline
│   ├── useSearch.ts                 # Global search
│   ├── useDebounce.ts               # Debounce utility
│   ├── useInView.ts                 # Intersection observer
│   ├── useCurrentUser.ts            # Current user state
│   ├── useTeam.ts                   # Team management
│   ├── useTeamData.ts               # Team data access
│   ├── usePermissions.ts            # Permission checks
│   ├── useNotes.ts                  # Note CRUD
│   ├── useEmail.ts                  # Email CRUD
│   ├── useSms.ts                    # SMS CRUD
│   ├── useCallLogs.ts               # Call log CRUD
│   ├── useQuotes.ts                 # Quote CRUD
│   ├── useInvoices.ts               # Invoice CRUD
│   ├── useCampaigns.ts              # Campaign CRUD
│   ├── useCampaignScheduler.ts      # Campaign scheduler
│   ├── useTags.ts                   # Tag CRUD
│   ├── useAutomation.ts             # Automation rules
│   ├── useWorkflows.ts              # Workflow states/transitions
│   ├── useWorkflowEditor.ts         # Visual workflow editor
│   ├── useForecasts.ts              # Forecast CRUD
│   ├── useGoals.ts                  # Goal CRUD
│   ├── useAttachments.ts            # File attachments
│   ├── useIntegrations.ts           # Calendar integrations
│   ├── usePortal.ts                 # Portal management
│   ├── useNotifications.ts          # Notification panel
│   ├── useRealtimeNotifications.ts  # Realtime notification subscriptions
│   ├── usePresence.ts               # User presence tracking
│   ├── useBranding.ts               # Branding settings
│   ├── useCsvExport.ts              # CSV export
│   ├── useSavedViews.ts             # Saved view management
│   └── useLeadScoring.ts            # Lead scoring
│
├── types/                            # GLOBAL TYPE DEFINITIONS (29 files)
│   ├── lead.types.ts               # Lead interfaces + enums
│   ├── contact.types.ts             # Contact interfaces
│   ├── company.types.ts             # Company interfaces
│   ├── deal.types.ts               # Deal + DealStage interfaces
│   ├── task.types.ts               # Task interfaces
│   ├── meeting.types.ts            # Meeting interfaces
│   ├── activity.types.ts           # Activity interfaces
│   ├── team.types.ts               # Team/member/invitation types
│   ├── communication.types.ts      # Email/CallLog/Note types
│   ├── sms.types.ts               # SMS log types
│   ├── quote.types.ts             # Quote + QuoteItem types
│   ├── campaign.types.ts           # EmailSequence + CampaignEmail
│   ├── forecast.types.ts           # Forecast interfaces
│   ├── goal.types.ts              # Goal interfaces
│   ├── tag.types.ts               # Tag + Tagging types
│   ├── automation.types.ts        # Automation rules types
│   ├── workflow.types.ts          # Workflow state/transition types
│   ├── api-key.types.ts           # API key interfaces
│   ├── saved-view.types.ts        # Saved view interfaces
│   ├── integration.types.ts       # Calendar integration types
│   ├── portal.types.ts            # Portal user/share types
│   ├── attachment.types.ts        # File attachment types
│   ├── lead-scoring.types.ts      # Lead scoring types + factors
│   ├── account.types.ts           # Account types
│   ├── webhook.types.ts           # Webhook event types
│   ├── common.types.ts            # Shared types (ValidationResult)
│   ├── supabase.types.ts          # Full DB schema types (28 tables)
│   └── swimlane.types.ts          # Swimlane types
│
├── store/                            # Zustand UI state stores
│   ├── index.ts                    # Store exports
│   ├── auth.ts                     # Auth state store
│   ├── theme.ts                    # Theme (dark/light) with persist
│   ├── settings.ts                 # User settings store
│   └── entity-cache.ts             # Entity cache store
│
├── lib/                              # Utilities only
│   ├── constants.ts                # App constants (statuses, nav items, etc.)
│   ├── utils.ts                    # cn(), findDuplicates, etc.
│   ├── validators.ts               # Form validation utilities
│   ├── formatters.ts               # Date, currency, number formatters
│   ├── csv-export.ts               # CSV export utility
│   ├── csv-export-definitions.ts   # Export column definitions
│   └── supabase/
│       └── client.ts              # Supabase client factory
│
├── context/                          # React context providers
│   └── TeamContext.tsx             # Team + permission context
│
├── seed/                             # Seed data scripts
│
├── public/                           # Static assets
│
├── proxy.ts                          # Auth middleware (Supabase SSR)
│
├── supabase/                         # Supabase migration files
│   └── migrations/
│
├── AGENTS.md                         # Agent governance file
├── components.json                   # shadcn CLI config
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts                # Tailwind theme config
├── tsconfig.json                     # TypeScript strict mode config
└── package.json                      # Dependency manifest
```

---

### 5. Component Hierarchy

```
AppShell
├── Sidebar
│   ├── Logo + Brand
│   ├── Navigation (20+ nav items from constants)
│   └── User Menu
├── TopBar
│   ├── Search (Cmd+K → CommandPalette)
│   ├── Notification Bell → NotificationPanel
│   ├── Theme Toggle
│   └── Profile Menu
└── Main Content Area
    ├── PageHeader (title, actions, breadcrumbs)
    │   ├── Action Buttons
    │   ├── ExportDropdown
    │   ├── ViewsDropdown
    │   └── ColumnCustomizer
    ├── Filter Bar
    ├── Content (Table / Grid / Kanban / Calendar)
    │   ├── LoadingSkeleton (loading state)
    │   ├── EmptyState (no data)
    │   ├── ErrorState (error)
    │   └── Data display (table / cards / board)
    └── Detail Panel (slide-in sheet or page)
        ├── Profile Card
        ├── Quick Actions
        ├── Tabs (activity, notes, tasks, meetings, etc.)
        └── ActivityTimeline
```

---

### 6. State Management Architecture

#### Zustand Stores

| Store | File | Purpose | Persistence |
|-------|------|---------|-------------|
| **Auth Store** | `store/auth.ts` | User session, login state | sessionStorage |
| **Theme Store** | `store/theme.ts` | Dark/light mode, theme toggle | localStorage (key: `nexuscrm-theme`) |
| **Settings Store** | `store/settings.ts` | User preferences | localStorage |
| **Entity Cache** | `store/entity-cache.ts` | Cross-entity cache for leads, contacts, etc. | None (in-memory) |

#### Auth Store

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

#### Theme Store

```typescript
interface ThemeState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}
```

#### Entity Cache Store

```typescript
interface EntityCacheState {
  leads: Lead[];
  contacts: Contact[];
  companies: Company[];
  tasks: Task[];
  meetings: Meeting[];
  setLeads: (leads: Lead[]) => void;
  setContacts: (contacts: Contact[]) => void;
  // ... per-entity setters + updaters
}
```

#### React Context

| Context | File | Purpose |
|---------|------|---------|
| **TeamContext** | `context/TeamContext.tsx` | Current team, member role, permission checks |

```typescript
interface TeamContextValue {
  team: Team | null;
  currentMember: TeamMember | null;
  role: TeamRole | null;
  loading: boolean;
  error: string | null;
  hasPermission: (action: PermissionAction, entity: PermissionEntity) => boolean;
  canAccessRecord: (entity: PermissionEntity, scope: PermissionScope) => boolean;
  refresh: () => Promise<void>;
}
```

---

### 7. Data Flow Diagrams

#### Creating a Lead

```
LeadCreateForm (UI) 
  → useLeads().createLead(data)          [optimistic update with temp ID]
    → leadValidation.validate(data)      [modules/leads/leadValidation.ts]
    → leadService.create(data)           [services/lead.service.ts]
        → Supabase INSERT or mock push
        → activityService.log()          [logs "Lead created" activity]
        → triggerWebhook('lead.created') [sends to n8n if configured]
    → returns created Lead
  → replaces temp ID with real data
  → updates entity cache
  → UI re-renders with new lead in list
```

#### Moving a Lead in Pipeline (Drag & Drop)

```
KanbanBoard (UI)
  → usePipeline().moveLead(leadId, newStage)
    → pipelineUtils.calculatePipelineState()  [modules/pipeline/pipelineUtils.ts]
    → leadService.updateStatus(leadId, newStage)
        → Supabase UPDATE
        → activityService.log('status_changed')
        → triggerWebhook('lead.status_changed')
    → updates pipeline state
  → UI re-renders Kanban columns
```

#### Deleting a Contact

```
ContactTable (UI)
  → useContacts().deleteContact(id)     [optimistic removal]
    → contactService.delete(id)
        → deletes related activities, tasks, meetings
        → Supabase DELETE
        → triggerWebhook('contact.deleted')
    → on success: keep removed
    → on failure: rollback list
  → UI shows toast
```

---

### 8. Auth Middleware Flow

The `proxy.ts` middleware handles authentication for all routes using Supabase SSR:

```
Request received for {pathname}
  │
  ├── pathname === '/' → Allow (no redirect)
  │
  ├── pathname is auth route (/login, /signup)
  │   ├── Has session? → Redirect to /dashboard
  │   └── No session? → Allow
  │
  └── pathname is protected route
      ├── Has session? → Allow (refresh cookies)
      └── No session? → Redirect to /login?redirect={path}
```

**Protected routes:** `/dashboard`, `/leads`, `/contacts`, `/companies`, `/deals`, `/pipeline`, `/tasks`, `/meetings`, `/analytics`, `/campaigns`, `/invoices`, `/quotes`, `/goals`, `/tags`, `/settings`

**Auth routes:** `/login`, `/signup`

The middleware uses `@supabase/ssr` v0.12 to create a server client, validate the session via `supabase.auth.getUser()`, and refresh cookies on each navigation.

---

### 9. Module Isolation Rules

Each module must be independent:

- **Leads module** cannot directly mutate Contacts
- **Contacts module** cannot directly modify Companies
- All cross-module actions MUST go through services

**Cross-Module Interaction Example:**

```
LeadService.lead.won
  → activityService.log('lead', leadId, 'status_changed', ...)  [cross-module via service]
  → triggerWebhook('lead.status_changed', {...})                 [cross-module via service]
  → (does NOT directly call contactService)
```

---

### 10. Error Handling Strategy

Every async operation follows this pattern:

```
try {
  // perform operation with optimistic update
  // on success: confirm the update
  // show success feedback (toast)
} catch (error) {
  // revert optimistic update
  // show error toast/message
  // log details
}
```

- Every failure MUST show UI feedback (toast, inline error, or banner)
- No console-only error handling
- All states covered: loading → empty → error → success → disabled
- Optimistic updates must be reversible (store previous state before mutation)

---

### 11. Performance Considerations

- Lazy load route segments via Next.js dynamic imports
- Memoize expensive computations (`useMemo`, `useCallback`)
- Virtualize large lists via windowing (scroll-area)
- Avoid deeply nested component trees
- Use `React.memo` selectively on pure display components
- Entity cache store avoids redundant API calls

---

### 12. UI/UX State Requirements

Every UI component MUST handle:

| State | Visual |
|-------|--------|
| **Loading** | Skeleton / Spinner |
| **Empty** | Illustration + "No data" message + CTA |
| **Error** | Error message + retry button |
| **Success** | Toast / confirmation animation |
| **Disabled** | Greyed out with tooltip explanation |

If any is missing → the feature is considered INVALID.
