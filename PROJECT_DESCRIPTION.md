# NexusCRM — What Actually Exists

Next.js 16 + Supabase + shadcn/ui. Real auth, real database, zero mock data in production code.

---

## ✅ Fully Working (end-to-end, nothing missing)

| Feature | What it does |
|---------|-------------|
| **Leads** | CRUD, filter, search, bulk actions, CSV export/import, tagging, scoring, duplicate detection, status/priority management, activity logging, permission control |
| **Contacts** | CRUD, link to companies, filter, search, bulk actions, CSV export/import, tagging, duplicate detection, activity logging |
| **Companies** | CRUD, filter, search, bulk actions, CSV export/import, tagging, duplicate detection, activity logging |
| **Tasks** | CRUD, assignee, due dates, auto-overdue detection, toggle complete, link to any entity, bulk actions, activity logging |
| **Meetings** | CRUD, schedule, link to any entity, activity logging |
| **Dashboard** | KPI cards, pipeline funnel chart, lead sources chart, monthly trends bar chart, tasks due today, team status banner |
| **Pipeline (Leads)** | Kanban board, drag between statuses, swimlanes by assignee/status/priority |
| **Pipeline (Deals)** | Kanban board, custom stages with probability, drag between stages, total value per column, swimlanes |
| **Auth** | Sign up, sign in, email confirmation flow, session management, sign out (clears cookies + server session) |
| **Teams** | Auto-created on signup, member roles (admin/manager/agent/viewer), invite members, pending invitations, permission guards |
| **Onboarding** | 6-step wizard: welcome, profile, company, goals, invite team, complete |
| **Notes** | Create, edit, delete on any record. Markdown body. Author tracking. |
| **Call Logs** | Log inbound/outbound calls on any record. Duration, result, notes. |
| **Tags** | Create/edit/delete colored tags. Tag any record type. Filter by tag. Dedicated management page. |
| **Lead Scoring** | Auto 0-100 score per lead from data completeness. Score breakdown on detail page. Min score filter. |
| **Duplicate Detection** | Scan leads/contacts/companies. Merge by selecting survivor. Moves related records automatically. |
| **Bulk Actions** | Select multiple records, change status/priority/assignee/tag, or delete. Works on leads, contacts, companies, deals, tasks. Assign uses real team members. |
| **Saved Views** | Save current filters as named views. Load, rename, delete. On leads, contacts, companies. |
| **API Keys** | Generate scoped API keys. Copy on creation. Regenerate, delete. Settings page. |
| **Email (Real)** | Compose & send via Resend. Real delivery. Recorded in `email_history`. Settings page with API key config. Test send. |
| **SMS (Real)** | Compose & send via Twilio. Real delivery. Recorded in `sms_logs`. Settings page with Twilio config. Test send. |
| **Webhooks** | Full UI to manage webhook URLs. CRUD for configs, 15 event types, test ping, delivery logs. n8n endpoint persists to DB. |
| **CSV Import** | Upload CSV for leads/contacts/companies/meetings/tasks. Column validation, required field checks, **actual data import**. |
| **File Attachments** | Upload to Supabase Storage. Files listed with type icons. Image preview lightbox. Upload progress bar. Size enforcement (validation). |
| **Settings: Account** | Display name, email, timezone, notification preferences. Persisted to server + Zustand-localStorage. |
| **Settings: Team** | Team name/description, member list with roles, role change, remove member, pending invitations. |
| **Settings: Automation** | List rules, enable/disable toggle, create with trigger/conditions/actions, edit, delete. |
| **Settings: Data Quality** | Tabbed duplicate scanning. Merge with survivor selection. |
| **Settings: Forecasts** | Monthly target vs actual grid. Auto-calculate from deals. Year summary. |
| **Settings: Saved Views** | Manage all saved filter presets across entity types. |
| **Settings: Workflows** | Custom state machines for leads/deals/tasks. Add/edit/delete states. Define transitions. |
| **Settings: Portal** | Invite portal users. Toggle active. Share records with permission levels. |
| **Settings: Webhooks** | Full CRUD for webhook configs. Event type selection. Test ping. Delivery log viewer. |
| **Settings: Email** | Resend API key, from email/name config. Test send. Status indicator. |
| **Settings: SMS** | Twilio account SID, auth token, from number config. Test send. Status indicator. |
| **Settings: Integrations** | Calendar connect/disconnect. Sync toggle. |
| **Settings: Invoice Templates** | Create/edit/delete invoice templates with colors, logo, fields. Persisted to server. |
| **Deal Stages** | Custom stages with names, colors, probabilities, sort order. CRUD. |
| **Deal Revenue** | Deals with title, value, currency, stage, close date, tags. CRUD from dedicated page. |
| **Sales Forecasting** | Monthly targets. Actuals auto-calculated from deal values. Progress bars. |
| **Entity Cache** | Shared Zustand store syncs across hooks. Covers leads, contacts, companies, tasks, deals, meetings, invoices, quotes. |
| **Optimistic Updates** | All core mutations update UI instantly. Rollback on server error. |
| **URL Filter State** | All filters persisted in URL params. Survives refresh. |
| **Search Debounce** | 300ms debounce on all list page searches. |
| **CSV Export** | Download any entity list as CSV with Excel-compatible BOM. |
| **Dark Mode** | Toggle in header. Persisted. No white flash (blocking script in `<head>`). |
| **Session Caching** | Shared in-memory cache. One `getUser()` per session, not per component. No rate limit issues. |
| **Proxy Middleware** | Checks `sb-` cookies for auth. Zero API calls. Routes unauthenticated to login. |
| **Error Boundaries** | Route-level error.tsx on dashboard, leads, contacts, companies, deals, tasks, meetings, analytics, campaigns, invoices, onboarding, auth pages. |
| **Loading States** | Route-level loading.tsx or inline skeletons on all pages. |
| **Permission Guards** | PermissionGuard on leads, contacts, companies, deals, tasks, meetings, analytics, campaigns, pipeline. |
| **Settings Layout** | Sidebar navigation across all settings sub-pages. |
| **Open Graph** | OG metadata (title, description, image, type) on all pages. Sitemap covers all 31 routes. |
| **Lead Validation** | Full lead form validation module (name, email, phone, fields, enums). |

---

## ⚡ Partial / Has Gaps

| Feature | What works | What's missing |
|---------|-----------|----------------|
| **Email Sequences** | Create sequences with multiple campaign emails and delay days. Full CRUD. | No deployed scheduler — cron job not configured. |
| **Workflow Builder** | Settings page with custom states and transitions. Form-based CRUD with optimistic updates. | Not a visual drag-and-drop editor. Custom states don't change the kanban renderer. |
| **Calendar Sync** | Connect/disconnect/toggle sync works. Stored in DB with provider, email, status. | No real OAuth flow (no Google/Outlook API). Sync is a flag with no background job. |
| **Portal Auth** | Portal user management works. Invite, toggle, share records. | Uses bcrypt-based custom auth (documented as deprecated). Needs migration to Supabase Auth. |
| **Invoices** | Full CRUD, PDF download, status management. Detail view. | No standalone creation (must come from quote). Detail view is read-only. |
| **Campaign Scheduler** | Full campaign scheduler engine exists (`campaign-scheduler.service.ts`), API endpoints for activate/process. | No deployed cron trigger. Must be connected to a cron job service. |
| **Real-time notifications** | Polling-based notifications every 2 minutes. Realtime channel setup exists. | No WebSocket push. Realtime subscription is basic. |

---

## ❌ Not Built

| Feature | Notes |
|---------|-------|
| **Customer portal frontend** | Admin-side user management only. No login page or dashboard for portal users. |
| **Mobile app** | Nothing — web-only. |
| **Public REST API** | Key management UI exists. No public endpoints, docs, or rate limiting. |
| **Unit tests** | Zero |
| **Integration tests** | Zero |
| **E2E tests** | Zero |

---

**31 routes · 7 migrations · 32 tables · ~400 source files · 97 components · 33 hooks · 29 services · Build: ✅**
