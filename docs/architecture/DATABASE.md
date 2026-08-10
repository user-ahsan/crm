# Database Schema Specification

## NexusCRM — Complete Data Entity Definitions

---

### Entity Relationship Diagram

```
┌─────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│      LEADS           │       │      CONTACTS         │       │      COMPANIES        │
├─────────────────────┤       ├──────────────────────┤       ├──────────────────────┤
│ id (UUID PK)        │       │ id (UUID PK)          │       │ id (UUID PK)          │
│ full_name            │◄──────│ lead_ids (UUID[])     │       │ name                  │
│ email               │  M:N  │ name                  │       │ industry              │
│ phone               │       │ email                 │◄──────│ size                  │
│ company_name        │       │ phone                 │  M:1  │ revenue               │
│ industry            │       │ job_title             │       │ location              │
│ country             │       │ company_id (FK)       │──────►│ website               │
│ source              │       │ location              │       │ contact_ids (UUID[])  │
│ status              │       │ social_links          │       │ lead_ids (UUID[])     │
│ priority            │       │ tags                  │       │ tags                  │
│ assigned_to         │       │ notes                 │       │ created_at            │
│ estimated_value     │       │ created_at            │       │ updated_at            │
│ tags                │       │ updated_at            │       └──────────────────────┘
│ notes               │       └──────────────────────┘
│ created_at          │
│ updated_at          │
└────────┬────────────┘
         │
         │ Polymorphic relationships
         ▼
┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│       TASKS          │  │      MEETINGS          │  │     ACTIVITIES        │
├─────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │  │ id (UUID PK)          │
│ title               │  │ title                 │  │ entity_type           │
│ description         │  │ participants          │  │ entity_id (UUID)      │
│ related_to_type     │  │ related_to_type       │  │ type                  │
│ related_to_id (UUID)│  │ related_to_id (UUID)  │  │ description           │
│ assigned_to         │  │ date_time             │  │ timestamp             │
│ due_date            │  │ duration              │  │ metadata (jsonb)      │
│ priority            │  │ type                  │  └──────────────────────┘
│ status              │  │ notes                 │
│ created_at          │  │ outcome               │
│ updated_at          │  │ created_at            │
└─────────────────────┘  │ updated_at            │
                         └──────────────────────┘

┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│       DEALS          │  │       QUOTES           │  │      FORECASTS        │
├─────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │  │ id (UUID PK)          │
│ title               │  │ title                 │  │ year                  │
│ description         │  │ deal_id (FK)          │  │ month                 │
│ value               │  │ lead_id (FK)          │  │ target                │
│ currency            │  │ contact_id (FK)       │  │ actual                │
│ stage_id (FK)       │  │ company_id (FK)       │  │ created_by            │
│ lead_id (FK)        │  │ status                │  │ created_at            │
│ contact_id (FK)     │  │ subtotal              │  │ updated_at            │
│ company_id (FK)     │  │ discount              │  └──────────────────────┘
│ assigned_to         │  │ total                 │
│ close_date          │  │ notes                 │
│ win_loss_reason     │  │ valid_until           │
│ tags                │  │ items (→ quote_items) │
│ created_by          │  │ created_by            │
│ created_at          │  └──────────────────────┘
│ updated_at          │
└─────────────────────┘
```

### Additional Tables

```
┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    TEAMS             │  │    TEAM_MEMBERS        │  │  TEAM_INVITATIONS     │
├─────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │  │ id (UUID PK)          │
│ name                │──│ team_id (FK)          │  │ team_id (FK)          │
│ description         │  │ user_id               │  │ email                 │
│ created_by          │  │ role (admin/mgr/agt/  │  │ role                  │
│ invite_code         │  │       viewer)         │  │ invited_by            │
│ created_at          │  │ joined_at             │  │ status (pending/      │
│ updated_at          │  └──────────────────────┘  │        accepted/...)   │
└─────────────────────┘                           │ expires_at             │
                                                   │ created_at             │
┌─────────────────────┐  ┌──────────────────────┐  └──────────────────────┘
│      TAGS            │  │      TAGGINGS          │
├─────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │──│ tag_id (FK)           │
│ name                │  │ taggable_id           │
│ color               │  │ taggable_type         │
│ created_at          │  │ created_at            │
└─────────────────────┘  └──────────────────────┘

┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   EMAIL_HISTORY      │  │     CALL_LOGS          │  │      SMS_LOGS         │
├─────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │  │ id (UUID PK)          │
│ from_address        │  │ direction             │  │ to_number             │
│ to_address          │  │ duration              │  │ from_number           │
│ subject             │  │ caller                │  │ body                  │
│ body                │  │ callee                │  │ direction             │
│ direction           │  │ notes                 │  │ status                │
│ status              │  │ call_result           │  │ related_to_type       │
│ related_to_type     │  │ related_to_type       │  │ related_to_id         │
│ related_to_id       │  │ related_to_id         │  │ created_by            │
│ sent_at             │  │ created_by            │  │ created_at            │
│ created_at          │  │ created_at            │  └──────────────────────┘
└─────────────────────┘  └──────────────────────┘

┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│      NOTES           │  │    LEAD_SCORES          │  │   FILE_ATTACHMENTS    │
├─────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │  │ id (UUID PK)          │
│ title               │  │ lead_id (FK)          │  │ filename              │
│ body                │  │ score (0-100)         │  │ original_name         │
│ related_to_type     │  │ factors (jsonb)       │  │ mime_type             │
│ related_to_id       │  │ updated_at            │  │ size_bytes            │
│ created_by          │  └──────────────────────┘  │ storage_path          │
│ created_at          │                             │ related_to_type       │
│ updated_at          │                             │ related_to_id         │
└─────────────────────┘                             │ uploaded_by           │
                                                     │ created_at            │
┌─────────────────────┐  ┌──────────────────────┐  └──────────────────────┘
│      GOALS           │  │   SAVED_VIEWS          │
├─────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │
│ title               │  │ name                  │
│ description         │  │ entity_type           │
│ type (revenue/      │  │ filters (jsonb)       │
│   deals/leads/...)  │  │ sort_by               │
│ target              │  │ sort_order            │
│ current             │  │ created_by            │
│ period (weekly/     │  │ created_at            │
│   monthly/...)      │  │ updated_at            │
│ start_date          │  └──────────────────────┘
│ end_date            │
│ assigned_to         │  ┌──────────────────────┐  ┌──────────────────────┐
│ created_by          │  │    API_KEYS            │  │ WORKFLOW_STATES       │
│ created_at          │  ├──────────────────────┤  ├──────────────────────┤
│ updated_at          │  │ id (UUID PK)          │  │ id (UUID PK)          │
└─────────────────────┘  │ name                  │  │ name                  │
                         │ key_prefix            │  │ color                 │
┌─────────────────────┐  │ key_hash              │  │ entity_type           │
│ EMAIL_SEQUENCES      │  │ scopes (text[])      │  │ sort_order            │
├─────────────────────┤  │ last_used_at          │  │ created_by            │
│ id (UUID PK)        │  │ expires_at            │  │ created_at            │
│ name                │  │ created_by            │  └──────────────────────┘
│ description         │  │ created_at            │
│ status              │  └──────────────────────┘  ┌──────────────────────┐
│ created_by          │                             │ WORKFLOW_TRANSITIONS  │
│ created_at          │  ┌──────────────────────┐  ├──────────────────────┤
│ updated_at          │  │ CAMPAIGN_EMAILS       │  │ id (UUID PK)          │
└─────────────────────┘  ├──────────────────────┤  │ from_state_id (FK)    │
                         │ id (UUID PK)          │  │ to_state_id (FK)      │
┌─────────────────────┐  │ sequence_id (FK)      │  │ label                 │
│   CALENDAR_INTEGR    │  │ subject               │  │ created_at            │
├─────────────────────┤  │ body                  │  └──────────────────────┘
│ id (UUID PK)        │  │ delay_days            │
│ provider (google/   │  │ sort_order            │  ┌──────────────────────┐
│            outlook) │  │ created_at            │  │   PORTAL_USERS        │
│ email               │  └──────────────────────┘  ├──────────────────────┤
│ access_token        │                             │ id (UUID PK)          │
│ refresh_token       │                             │ email                 │
│ expires_at          │                             │ name                  │
│ sync_enabled        │                             │ password_hash         │
│ last_synced_at      │                             │ last_login            │
│ created_by          │                             │ active                │
│ created_at          │                             │ created_at            │
└─────────────────────┘                             └──────────────────────┘

┌─────────────────────┐  ┌──────────────────────┐
│  AUTOMATION_RULES    │  │   PORTAL_SHARES       │
├─────────────────────┤  ├──────────────────────┤
│ id (UUID PK)        │  │ id (UUID PK)          │
│ name                │  │ portal_user_id (FK)   │
│ description         │  │ related_to_type       │
│ trigger_event       │  │ related_to_id         │
│ conditions (jsonb)  │  │ permission            │
│ actions (jsonb)     │  │ created_at            │
│ enabled             │  └──────────────────────┘
│ created_by          │
│ created_at          │  ┌──────────────────────┐
│ updated_at          │  │    DEAL_STAGES        │
└─────────────────────┘  ├──────────────────────┤
                         │ id (UUID PK)          │
┌─────────────────────┐  │ name                  │
│    QUOTE_ITEMS       │  │ color                 │
├─────────────────────┤  │ probability           │
│ id (UUID PK)        │  │ sort_order            │
│ quote_id (FK)       │  │ created_at            │
│ description         │  └──────────────────────┘
│ quantity            │
│ unit_price          │
│ total               │
│ sort_order          │
│ created_at          │
└─────────────────────┘
```

---

### Complete Table Reference (46 Tables)

| # | Table | Description | Key Fields |
|---|-------|-------------|------------|
| 1 | `leads` | Potential customers in the sales pipeline | `full_name`, `email`, `status`, `source`, `estimated_value` |
| 2 | `contacts` | Real individuals linked to leads/companies | `name`, `email`, `company_id`, `lead_ids`, `job_title` |
| 3 | `companies` | Organizations that group leads and contacts | `name`, `industry`, `size`, `revenue`, `website` |
| 4 | `deals` | Sales opportunities with values and stages | `title`, `value`, `currency`, `stage_id`, `close_date` |
| 5 | `deal_stages` | Configurable pipeline stages | `name`, `color`, `probability`, `sort_order` |
| 6 | `tasks` | Action items linked to any entity | `title`, `priority`, `status`, `due_date`, `assigned_to` |
| 7 | `meetings` | Scheduled meetings with clients | `title`, `date_time`, `duration`, `type`, `participants` |
| 8 | `activities` | Event log for all system actions | `entity_type`, `entity_id`, `type`, `description`, `metadata` |
| 9 | `teams` | Organizational units for multi-user | `name`, `description`, `created_by`, `invite_code` |
| 10 | `team_members` | User-to-team links with roles | `team_id`, `user_id`, `role` (admin/manager/agent/viewer) |
| 11 | `team_invitations` | Pending team join requests | `team_id`, `email`, `role`, `status`, `expires_at` |
| 12 | `tags` | Color-coded categorization labels | `name`, `color` |
| 13 | `taggings` | Polymorphic tag assignments | `tag_id`, `taggable_id`, `taggable_type` |
| 14 | `automation_rules` | Trigger-condition-action rules | `trigger_event`, `conditions`, `actions`, `enabled` |
| 15 | `email_history` | Email communication records | `from_address`, `to_address`, `subject`, `body`, `direction` |
| 16 | `call_logs` | Phone call tracking records | `direction`, `duration`, `caller`, `callee`, `call_result` |
| 17 | `notes` | Polymorphic Markdown notes | `title`, `body`, `related_to_type`, `related_to_id` |
| 18 | `lead_scores` | Calculated lead quality scores | `lead_id`, `score` (0-100), `factors` (jsonb) |
| 19 | `quotes` | Sales quotes with line items | `title`, `status` (draft/sent/accepted/rejected), `total` |
| 20 | `quote_items` | Line items within a quote | `quote_id`, `description`, `quantity`, `unit_price`, `total` |
| 21 | `forecasts` | Monthly/yearly revenue targets | `year`, `month`, `target`, `actual` |
| 22 | `email_sequences` | Campaign email sequences | `name`, `description`, `status` |
| 23 | `campaign_emails` | Individual emails in a campaign | `sequence_id`, `subject`, `body`, `delay_days`, `sort_order` |
| 24 | `file_attachments` | File upload metadata | `filename`, `original_name`, `mime_type`, `size_bytes`, `storage_path` |
| 25 | `goals` | Sales goal tracking | `title`, `type`, `target`, `current`, `period`, `start_date`, `end_date` |
| 26 | `saved_views` | Per-entity filter presets | `name`, `entity_type`, `filters` (jsonb), `sort_by`, `sort_order` |
| 27 | `api_keys` | API key management | `name`, `key_prefix`, `key_hash`, `scopes`, `expires_at` |
| 28 | `workflow_states` | Custom workflow states | `name`, `color`, `entity_type`, `sort_order` |
| 29 | `workflow_transitions` | Custom state transitions | `from_state_id`, `to_state_id`, `label` |
| 30 | `calendar_integrations` | Calendar sync connections | `provider`, `email`, `access_token`, `sync_enabled` |
| 31 | `sms_logs` | SMS message history | `to_number`, `from_number`, `body`, `direction`, `status` |
| 32 | `portal_users` | Customer portal accounts | `email`, `name`, `password_hash`, `active`, `last_login` |
| 33 | `portal_shares` | Record sharing for portal users | `portal_user_id`, `related_to_type`, `related_to_id`, `permission` |
| 34 | `rate_limits` | Hybrid rate-limit tracking (in-memory + DB) | `key`, `count`, `window_start` |
| 35 | `webhook_configs` | Webhook URL + secret + enabled configuration | `url`, `secret`, `enabled`, `events` |
| 36 | `webhook_deliveries` | Webhook delivery log with status + response | `config_id`, `event`, `status`, `response_code` |
| 37 | `webhook_events` | Inbound webhook event ingest log | `event`, `source`, `payload` |
| 38 | `campaign_recipients` | Per-recipient campaign email tracking | `campaign_id`, `email`, `status`, `sent_at` |
| 39 | `notification_preferences` | Per-user notification preferences | `user_id`, `channel`, `enabled` |
| 40 | `notifications` | Persistent in-app notification records | `user_id`, `title`, `body`, `type`, `read_at` |
| 41 | `branding_settings` | White-label branding (logo, colors) | `team_id`, `logo_url`, `primary_color` |
| 42 | `service_configs` | Per-service config (Resend, Twilio, Google) | `service`, `config` (jsonb), `team_id` |
| 43 | `profiles` | User profile extensions | `user_id`, `display_name`, `avatar_url` |
| 44 | `invoices` | Sales invoices with line items | `invoice_number`, `status`, `total`, `due_date` |
| 45 | `invoice_items` | Line items within an invoice | `invoice_id`, `description`, `quantity`, `unit_price` |
| 46 | `invoice_templates` | Customizable invoice templates | `name`, `logo_url`, `primary_color`, `fields` |

---

### Key Indexes

| Table | Index | Column(s) | Purpose |
|-------|-------|-----------|---------|
| leads | `idx_leads_status` | `status` | Pipeline stage filtering |
| leads | `idx_leads_source` | `source` | Source breakdown analytics |
| leads | `idx_leads_assigned_to` | `assigned_to` | User assignment queries |
| leads | `idx_leads_created_at` | `created_at` | Time-series queries |
| contacts | `idx_contacts_email` | `email` | Duplicate detection |
| contacts | `idx_contacts_company_id` | `company_id` | Company contact linking |
| tasks | `idx_tasks_related` | `(related_to_type, related_to_id)` | Polymorphic lookup |
| tasks | `idx_tasks_due_date` | `due_date` | Overdue detection |
| tasks | `idx_tasks_status` | `status` | Status filtering |
| meetings | `idx_meetings_date_time` | `date_time` | Calendar queries |
| meetings | `idx_meetings_related` | `(related_to_type, related_to_id)` | Polymorphic lookup |
| activities | `idx_activities_entity` | `(entity_type, entity_id)` | Entity timeline |
| activities | `idx_activities_timestamp` | `timestamp` | Chronological ordering |
| team_members | `idx_team_members_team_id` | `team_id` | Team membership lookup |
| team_members | `idx_team_members_user_id` | `user_id` | User's teams query |

---

### RLS Policies

When Supabase is used, Row-Level Security policies are applied:

**Teams:**
- Team admins can manage their team
- Members can view teams they belong to
- Insert/update/delete restricted to team admins

**Team Members:**
- Members can view team membership
- Admins can manage (insert/update/delete) members

**Invitations:**
- Admins can manage invitations
- Members can view pending invitations

---

### Migration History

The `supabase/migrations/` directory contains SQL migration files that set up the database schema incrementally. Each migration adds new tables, columns, or indexes.

Key migrations:
1. **00001_initial_schema** — Core entities (leads, contacts, companies, tasks, meetings, activities, teams, team_members, team_invitations, rate_limits, portal_users)
2. **00002_tags** — Tags and polymorphic taggings
3. **00003_automation_rules** — Automation rule engine table
4. **00004_communications** — email_history, call_logs, notes
5. **00005_revenue_intelligence** — deals, deal_stages, lead_scores, quotes, quote_items, forecasts
6. **00006_advanced_features** — email_sequences, campaign_emails, goals, file_attachments, saved_views, api_keys
7. **00007_ecosystem** — workflow_states, workflow_transitions, calendar_integrations, sms_logs, portal_shares
8. **00008_branding_and_service_configs** — branding_settings, service_configs
9. **20260726_complete_features** — webhook_configs, webhook_deliveries, campaign_recipients, notification_preferences
10. **20260726_rls_policies** — Row-level security policies for all tables
11. **20260731_notifications** — notifications table
12. **20260731_schema_alignment** — profiles, invoices, invoice_items, invoice_templates, webhook_events
13. **20260731_role_scoped_policies** — Role-scoped RLS policies
14. **20260731_widen_meetings_type_check** — Meeting type check constraint update

---

### Helper Functions

| Function | Purpose |
|----------|---------|
| `handle_updated_at()` | Trigger function to auto-update `updated_at` timestamp |
| `is_team_member(user_id, team_id)` | Check if a user belongs to a team |
| `is_team_admin(user_id, team_id)` | Check if a user has admin role in a team |

---

### Seed Data Overview

The `data/` directory contains mock data files that populate the application on startup:

| File | Contents |
|------|----------|
| `data/leads.ts` | Array of mock leads with sample names, companies, and values |
| `data/contacts.ts` | Array of mock contacts linked to leads/companies |
| `data/companies.ts` | Array of mock companies with revenue estimates |
| `data/deals.ts` | Array of mock deals with values and stages |
| `data/tasks.ts` | Array of mock tasks with priorities and due dates |
| `data/meetings.ts` | Array of mock meetings with types and participants |
| `data/activities.ts` | Array of mock activity log entries |
| `data/teams.ts` | Pre-configured team with admin/manager/agent roles |
| `data/team-members.ts` | Array of team members with role assignments |
| `data/team-invitations.ts` | Array of pending team invitations |
| `data/quotes.ts` | Array of mock quotes with line items |
