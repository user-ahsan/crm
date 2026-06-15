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
| **Bulk Actions** | Select multiple records, change status/priority/assignee/tag, or delete. Works on leads, contacts, companies. |
| **Saved Views** | Save current filters as named views. Load, rename, delete. On leads, contacts, companies. |
| **API Keys** | Generate scoped API keys. Copy on creation. Regenerate, delete. Settings page. |
| **Settings: Account** | Display name, email, timezone, notification preferences. Zustand-persisted. |
| **Settings: Team** | Team name/description, member list with roles, role change, remove member, pending invitations. |
| **Settings: Automation** | List rules, enable/disable toggle, create with trigger/conditions/actions, edit, delete. |
| **Settings: Data Quality** | Tabbed duplicate scanning. Merge with survivor selection. |
| **Settings: Forecasts** | Monthly target vs actual grid. Auto-calculate from deals. Year summary. |
| **Settings: Saved Views** | Manage all saved filter presets across entity types. |
| **Settings: Workflows** | Custom state machines for leads/deals/tasks. Add/edit/delete states. Define transitions. |
| **Settings: Portal** | Invite portal users. Toggle active. Share records with permission levels. |
| **Deal Stages** | Custom stages with names, colors, probabilities, sort order. CRUD. |
| **Deal Revenue** | Deals with title, value, currency, stage, close date, tags. CRUD from dedicated page. |
| **Sales Forecasting** | Monthly targets. Actuals auto-calculated from deal values. Progress bars. |
| **Entity Cache** | Shared Zustand store syncs across hooks. Edit on one page reflects on another. |
| **Optimistic Updates** | Every mutation updates UI instantly. Rolls back on server error. |
| **URL Filter State** | All filters persisted in URL params. Survives refresh. |
| **Search Debounce** | 300ms debounce on all list page searches. |
| **CSV Export** | Download any entity list as CSV with Excel-compatible BOM. |
| **CSV Import** | Upload CSV for leads/contacts/companies. Column validation. Required field checks. |
| **Dark Mode** | Toggle in header. Persisted. No white flash (blocking script in `<head>`). |
| **Session Caching** | Shared in-memory cache. One `getUser()` per session, not per component. No rate limit issues. |
| **Proxy Middleware** | Checks `sb-` cookies for auth. Zero API calls. Routes unauthenticated to login. |

---

## ⚡ Partial / Has Gaps

| Feature | What works | What's missing |
|---------|-----------|----------------|
| **Email** | Compose from UI, recorded in `email_history` with timestamps | No real delivery — no SMTP, SendGrid, or Resend. Log only. |
| **SMS** | Compose from UI, recorded in `sms_logs` | No real provider — no Twilio or Vonage. Log only. |
| **Webhooks** | Every mutation fires `triggerWebhook()`. POST endpoint at `/api/webhook/n8n` with auth. | No UI to manage webhook URLs. Must configure n8n endpoint directly. |
| **File Attachments** | Upload to Supabase Storage. Files listed with type icons. | No file size UI enforcement, no image preview. Storage bucket must be created manually. |
| **Email Sequences** | Create sequences with multiple campaign emails and delay days. Full CRUD. | No scheduler — sequences never execute. Data-only. |
| **Workflow Builder** | Settings page with custom states and transitions. Form-based CRUD. | Not a visual drag-and-drop editor. Custom states don't change the kanban renderer. |

---

## ❌ Not Built

| Feature | Notes |
|---------|-------|
| **Real email sending** | No SendGrid, Resend, SMTP, or any delivery provider |
| **Real SMS sending** | No Twilio, Vonage, or any provider |
| **Calendar sync** | No Google or Outlook OAuth. The "Connect" button stores an email but does nothing. |
| **Customer portal frontend** | No login page or dashboard for portal users. Admin-side user management only. |
| **Email campaign scheduler** | No cron, background job, or trigger to send campaign emails |
| **Mobile app** | Nothing |
| **Public REST API** | Key management UI exists. No public endpoints, docs, or rate limiting. |
| **Real-time notifications** | No WebSocket, push, or email alerts |
| **Unit tests** | Zero |
| **Integration tests** | Zero |

---

**31 routes · 7 migrations · 32 tables · ~400 source files · Build: ✅**
