# System Architecture & Data Flow

## NexusCRM — Frontend-First CRM Architecture

---

### 1. Architecture Overview

NexusCRM is a **frontend-first** application. There is no traditional backend server. All business logic, data persistence, and state management live on the client side. This makes it fully deployable on Vercel with zero server management.

```
┌───────────────────────────────────────────────────┐
│                   NEXT.JS APP                      │
│                                                    │
│  ┌──────────┐   ┌──────────┐   ┌───────────────┐  │
│  │   Pages   │   │Components│   │   Modules      │  │
│  │  (routes) │   │  (UI)    │   │ (Business Logic)│  │
│  └────┬─────┘   └────┬─────┘   └───────┬───────┘  │
│       │               │                 │          │
│  ┌────┴───────────────┴─────────────────┴───────┐  │
│  │               Hooks Layer                      │  │
│  │  (useLeads, useContacts, usePipeline, etc.)    │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                              │
│  ┌────────────────────┴──────────────────────────┐  │
│  │               Services Layer                    │  │
│  │   (Data mutation — create, update, delete)     │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                              │
│  ┌────────────────────┴──────────────────────────┐  │
│  │               Data Layer                       │  │
│  │   (Mock data + optional Supabase)              │  │
│  └───────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

---

### 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS + shadcn/ui components |
| **State** | React hooks + optional Zustand (lightweight) |
| **Data** | Local JSON/TS mock data files |
| **Database (optional)** | Supabase (PostgreSQL) — light usage only |
| **Deployment** | Vercel |
| **Package Manager** | Bun |

---

### 3. Layered Architecture (Strict Data Flow)

The data flow **MUST** follow this exact sequence. No layer skipping is allowed.

```
UI → Hook → Module → Service → Data
```

#### Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **UI** | `app/` + `components/` | Rendering, user interaction, layout |
| **Hooks** | `hooks/` | State management, data fetching, caching |
| **Modules** | `modules/` | Business logic, validation, data transformation |
| **Services** | `services/` | Data mutation (CRUD operations) |
| **Data** | `data/` | Mock database (in-memory arrays, JSON) |

#### Layer Rules

- **UI** CANNOT contain business logic
- **Services** CANNOT contain UI logic
- **Data** CANNOT contain any logic
- **Hooks** CANNOT define schemas
- Cross-module actions MUST go through services (no direct mutation)

---

### 4. Directory Structure (Mandatory)

```
crm-system/
│
├── app/                          # Next.js routes (ONLY routing logic)
│   ├── (auth)/
│   ├── dashboard/
│   ├── leads/
│   ├── contacts/
│   ├── companies/
│   ├── pipeline/
│   ├── tasks/
│   ├── meetings/
│   ├── analytics/
│   └── settings/
│
├── components/                   # PURE UI components only
│   ├── ui/                       # shadcn components (CLI-generated)
│   ├── common/                   # shared UI (buttons, cards, modals)
│   ├── leads/
│   ├── contacts/
│   ├── companies/
│   ├── pipeline/
│   ├── tasks/
│   └── meetings/
│
├── modules/                      # BUSINESS LOGIC LAYER
│   ├── leads/
│   ├── contacts/
│   ├── companies/
│   ├── pipeline/
│   ├── tasks/
│   ├── meetings/
│   └── analytics/
│
├── services/                     # Data mutation layer
│   ├── lead.service.ts
│   ├── contact.service.ts
│   ├── company.service.ts
│   ├── task.service.ts
│   └── meeting.service.ts
│
├── data/                         # MOCK DATABASE LAYER
│   ├── leads.ts
│   ├── contacts.ts
│   ├── companies.ts
│   ├── tasks.ts
│   └── meetings.ts
│
├── hooks/                        # Custom React hooks
│   ├── useLeads.ts
│   ├── useContacts.ts
│   ├── useCompanies.ts
│   ├── usePipeline.ts
│   └── useTasks.ts
│
├── types/                        # GLOBAL TYPE DEFINITIONS
│   ├── lead.types.ts
│   ├── contact.types.ts
│   ├── company.types.ts
│   ├── task.types.ts
│   ├── meeting.types.ts
│   └── activity.types.ts
│
├── lib/                          # Utilities only
│   ├── utils.ts
│   ├── validators.ts
│   ├── constants.ts
│   └── formatters.ts
│
├── store/                        # UI state only (if needed)
├── styles/
└── public/
```

---

### 5. Entity Relationship Model

```
  ┌──────────┐     ┌──────────┐     ┌───────────┐
  │  Lead    │────▶│ Contact  │────▶│  Company  │
  └──────────┘     └──────────┘     └───────────┘
       │                │                │
       │                │                │
       ▼                ▼                ▼
  ┌──────────┐     ┌──────────┐     ┌───────────┐
  │  Task    │     │ Meeting  │     │ Activity  │
  └──────────┘     └──────────┘     └───────────┘
       │                │                │
       └────────────────┴────────────────┘
            All linkable to any entity
```

**Relationships:**
- Lead → Contact: Many-to-many
- Contact → Company: Many-to-one
- Lead → Company: Many-to-one
- Task → Any entity: Polymorphic
- Meeting → Any entity: Polymorphic
- Activity → Any entity: Polymorphic

---

### 6. Data Flow Examples

#### Example 1: Creating a Lead

```
User fills form in components/leads/LeadCreateForm.tsx
    → calls useLeads().createLead(data)  [hooks/useLeads.ts]
        → validates via modules/leads/leadValidation.ts  [modules/leads/]
            → calls leadService.create(data)  [services/lead.service.ts]
                → pushes to leads array in data/leads.ts  [data/leads.ts]
            → returns new lead
        → updates local state
    → UI re-renders with new lead in list
```

#### Example 2: Moving a Lead in Pipeline (Drag & Drop)

```
User drags lead to new stage in components/pipeline/KanbanBoard.tsx
    → calls usePipeline().moveLead(leadId, newStage)  [hooks/usePipeline.ts]
        → calls pipelineService.updateStage(leadId, newStage)  [services/]
            → updates lead status in data/leads.ts
            → creates "Status changed" activity in data/activities.ts
        → returns updated lead
    → updates pipeline state
    → UI re-renders Kanban columns
```

---

### 7. State Management Approach

| State Type | Strategy |
|------------|----------|
| **Server data** (leads, contacts, etc.) | Custom hooks with local mock data |
| **UI state** (modals, toasts, sidebar) | React useState / useReducer |
| **Cross-component state** (selected entity, filters) | React context or Zustand |
| **Form state** | React controlled components |

No Redux. No heavy state libraries. Keep it simple and composable.

---

### 8. Error Handling Strategy

Every async operation follows this pattern:

```
try {
  // perform operation
  // show success feedback
} catch (error) {
  // show error toast/message
  // revert optimistic update if applicable
  // log to console only if needed
}
```

- Every failure MUST show UI feedback (toast, inline error, or banner)
- No console-only error handling
- All states covered: loading → empty → error → success → disabled

---

### 9. Performance Considerations

- Lazy load route segments via Next.js dynamic imports
- Memoize expensive computations (useMemo, useCallback)
- Virtualize large lists if needed (react-window or similar)
- Avoid deeply nested component trees
- Use React.memo selectively on pure display components

---

### 10. UI/UX State Requirements

Every UI component MUST handle:

| State | Visual |
|-------|--------|
| **Loading** | Skeleton / Spinner |
| **Empty** | Illustration + "No data" message + CTA |
| **Error** | Error message + retry button |
| **Success** | Toast / confirmation animation |
| **Disabled** | Greyed out with tooltip explanation |

If any is missing → the feature is considered INVALID.
