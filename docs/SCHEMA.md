# Database Schema Specification

## NexusCRM — Data Entity Definitions

---

### Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      LEAD        │       │     CONTACT      │       │     COMPANY      │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID) PK     │       │ id (UUID) PK     │       │ id (UUID) PK     │
│ fullName         │◄──────│ leadIds (UUID[]) │       │ name             │
│ email            │  M:N  │ name             │       │ industry         │
│ phone            │       │ email            │       │ size             │
│ companyName      │       │ phone            │◄──────│ revenue          │
│ industry         │       │ jobTitle         │  M:1  │ location         │
│ country          │       │ companyId (UUID) │──────►│ website          │
│ source           │       │ location         │       │ contactIds (UUID)│
│ status           │       │ socialLinks      │       │ leadIds (UUID[]) │
│ priority         │       │ tags             │       └──────────────────┘
│ assignedTo       │       │ notes            │
│ estimatedValue   │       │ createdAt        │
│ tags             │       │ updatedAt        │
│ notes            │       └──────────────────┘
│ createdAt        │
│ updatedAt        │
└────────┬─────────┘
         │
         │ hasMany
         ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      TASK        │       │     MEETING      │       │    ACTIVITY      │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID) PK     │       │ id (UUID) PK     │       │ id (UUID) PK     │
│ title            │       │ title            │       │ entityType       │
│ description      │       │ participants     │       │ entityId (UUID)  │
│ relatedToType    │       │ relatedToType    │       │ type             │
│ relatedToId (UUID)│       │ relatedToId (UUID)│      │ description      │
│ assignedTo       │       │ dateTime         │       │ timestamp        │
│ dueDate          │       │ duration         │       │ metadata         │
│ priority         │       │ type             │       └──────────────────┘
│ status           │       │ notes            │
│ createdAt        │       │ outcome          │
│ updatedAt        │       │ createdAt        │
└──────────────────┘       │ updatedAt        │
                           └──────────────────┘
```

---

### Table: `leads`

Primary entity of the CRM. Represents a potential customer in the sales pipeline.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: uuid()` | Unique identifier |
| `fullName` | `text` | `NOT NULL` | Lead's full name |
| `email` | `text` | `nullable` | Email address |
| `phone` | `text` | `nullable` | Phone number |
| `companyName` | `text` | `nullable` | Associated company |
| `industry` | `text` | `nullable` | Industry vertical |
| `country` | `text` | `nullable` | Country / region |
| `source` | `text` | `NOT NULL`, `default: 'manual'` | Lead source: `manual`, `website`, `referral`, `ads`, `social` |
| `status` | `text` | `NOT NULL`, `default: 'new'` | Pipeline status: `new`, `contacted`, `qualified`, `proposal`, `won`, `lost` |
| `priority` | `text` | `NOT NULL`, `default: 'medium'` | Priority: `low`, `medium`, `high` |
| `assignedTo` | `text` | `nullable` | Assigned user identifier |
| `estimatedValue` | `number` | `default: 0` | Deal value in dollars |
| `tags` | `text[]` | `default: []` | Categorization tags |
| `notes` | `text` | `nullable` | Internal notes |
| `createdAt` | `timestamp` | `default: now()` | Record creation time |
| `updatedAt` | `timestamp` | `default: now()` | Last update time |

**Indexes:**
- `idx_leads_status` on `status`
- `idx_leads_source` on `source`
- `idx_leads_assigned_to` on `assignedTo`
- `idx_leads_created_at` on `createdAt`

---

### Table: `contacts`

Represents real individuals (people) associated with leads and/or companies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL` | Full name |
| `email` | `text` | `nullable` | Email address |
| `phone` | `text` | `nullable` | Phone number |
| `jobTitle` | `text` | `nullable` | Job position |
| `companyId` | `UUID` | `nullable`, `FK -> companies.id` | Associated company |
| `leadIds` | `UUID[]` | `default: []` | Associated lead IDs (M:N) |
| `location` | `text` | `nullable` | Geographic location |
| `socialLinks` | `text[]` | `default: []` | Social media URLs (e.g., LinkedIn) |
| `tags` | `text[]` | `default: []` | Categorization tags |
| `notes` | `text` | `nullable` | Internal notes |
| `createdAt` | `timestamp` | `default: now()` | Record creation time |
| `updatedAt` | `timestamp` | `default: now()` | Last update time |

**Indexes:**
- `idx_contacts_email` on `email`
- `idx_contacts_company_id` on `companyId`
- `idx_contacts_name` on `name`

---

### Table: `companies`

Represents organizations that group leads and contacts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL` | Company name |
| `industry` | `text` | `nullable` | Industry vertical |
| `size` | `text` | `nullable` | Company size: `1-10`, `11-50`, `51-200`, `201-1000`, `1000+` |
| `revenue` | `number` | `default: 0` | Estimated annual revenue (mock) |
| `location` | `text` | `nullable` | Headquarters location |
| `website` | `text` | `nullable` | Company website URL |
| `contactIds` | `UUID[]` | `default: []` | Associated contact IDs |
| `leadIds` | `UUID[]` | `default: []` | Associated lead IDs |
| `createdAt` | `timestamp` | `default: now()` | Record creation time |
| `updatedAt` | `timestamp` | `default: now()` | Last update time |

**Indexes:**
- `idx_companies_name` on `name`
- `idx_companies_industry` on `industry`

---

### Table: `tasks`

Represents action items linked to any entity (lead, contact, company).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: uuid()` | Unique identifier |
| `title` | `text` | `NOT NULL` | Task title |
| `description` | `text` | `nullable` | Detailed description |
| `relatedToType` | `text` | `nullable` | Entity type: `lead`, `contact`, `company` |
| `relatedToId` | `UUID` | `nullable` | Entity ID |
| `assignedTo` | `text` | `nullable` | Assigned user identifier |
| `dueDate` | `timestamp` | `nullable` | Due date/time |
| `priority` | `text` | `NOT NULL`, `default: 'medium'` | Priority: `low`, `medium`, `high`, `critical` |
| `status` | `text` | `NOT NULL`, `default: 'pending'` | Status: `pending`, `completed`, `overdue` |
| `createdAt` | `timestamp` | `default: now()` | Record creation time |
| `updatedAt` | `timestamp` | `default: now()` | Last update time |

**Indexes:**
- `idx_tasks_status` on `status`
- `idx_tasks_due_date` on `dueDate`
- `idx_tasks_related` on `(relatedToType, relatedToId)`
- `idx_tasks_assigned_to` on `assignedTo`

---

### Table: `meetings`

Represents scheduled meetings between team members and clients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: uuid()` | Unique identifier |
| `title` | `text` | `NOT NULL` | Meeting title |
| `participants` | `text[]` | `default: []` | Participant names/IDs |
| `relatedToType` | `text` | `nullable` | Entity type: `lead`, `contact`, `company` |
| `relatedToId` | `UUID` | `nullable` | Entity ID |
| `dateTime` | `timestamp` | `NOT NULL` | Scheduled date & time |
| `duration` | `number` | `default: 30` | Duration in minutes |
| `type` | `text` | `NOT NULL`, `default: 'online'` | Meeting type: `online`, `offline`, `call` |
| `notes` | `text` | `nullable` | Meeting notes |
| `outcome` | `text` | `nullable` | Meeting outcome/result |
| `createdAt` | `timestamp` | `default: now()` | Record creation time |
| `updatedAt` | `timestamp` | `default: now()` | Last update time |

**Indexes:**
- `idx_meetings_date_time` on `dateTime`
- `idx_meetings_related` on `(relatedToType, relatedToId)`
- `idx_meetings_type` on `type`

---

### Table: `activities`

Event log for tracking all actions performed across the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: uuid()` | Unique identifier |
| `entityType` | `text` | `NOT NULL` | Entity type: `lead`, `contact`, `company`, `task`, `meeting` |
| `entityId` | `UUID` | `NOT NULL` | Entity ID |
| `type` | `text` | `NOT NULL` | Activity type (see below) |
| `description` | `text` | `NOT NULL` | Human-readable description |
| `timestamp` | `timestamp` | `default: now()` | When the activity occurred |
| `metadata` | `jsonb` | `nullable` | Additional data (old/new values, etc.) |

**Activity Types:**
| Type | Description |
|------|-------------|
| `created` | Entity was created |
| `updated` | Entity was updated |
| `deleted` | Entity was deleted |
| `status_changed` | Lead/entity status changed |
| `note_added` | Note was added |
| `meeting_scheduled` | Meeting was scheduled |
| `meeting_completed` | Meeting marked done |
| `task_created` | Task was created |
| `task_completed` | Task marked complete |
| `communication_logged` | Communication was logged |
| `assigned` | Entity was assigned to a user |

**Indexes:**
- `idx_activities_entity` on `(entityType, entityId)`
- `idx_activities_timestamp` on `timestamp`
- `idx_activities_type` on `type`

---

### Column Type Reference

> **Note:** The actual database schema has 46 tables across 14 migration files (see [architecture/DATABASE.md](./architecture/DATABASE.md) for the complete reference). This document covers the core entity definitions.

| TypeScript Type | Schema Type | Description |
|-----------------|-------------|-------------|
| `string` | `text` / `varchar` | Text values |
| `number` | `number` / `integer` | Numeric values |
| `boolean` | `boolean` | True/false |
| `string[]` | `text[]` / `jsonb` | Array of strings |
| `UUID[]` | `jsonb` / `UUID[]` | Array of UUID references |
| `Record<string, unknown>` | `jsonb` | Flexible metadata |
| `Date` / `string (ISO)` | `timestamp` | Date/time values |

---

### Mock Data Conventions

- **IDs:** Generated via `crypto.randomUUID()` or simple incrementing IDs
- **Timestamps:** Use `new Date().toISOString()` for creation/update times
- **Enums:** Define as TypeScript union types in `types/` folder, referenced throughout
- **Relations:** Store foreign keys as direct UUID references or arrays of UUIDs
- **Defaults:** Always provide sensible defaults for optional fields
