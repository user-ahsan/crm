# NexusCRM — What Actually Exists

Built commit-by-commit with Next.js 16, Supabase, and shadcn/ui. No mock data in production. Real Supabase auth. Real database.

---

## ✅ FULLY WORKING (end-to-end, nothing missing)

**Leads** — CRUD, filter, search, bulk actions, CSV export/import, tagging, scoring, duplicate detection, status/priority management, activity logging, permission control

**Contacts** — CRUD, link to companies, filter, search, bulk actions, CSV export/import, tagging, duplicate detection, activity logging

**Companies** — CRUD, filter, search, bulk actions, CSV export/import, tagging, duplicate detection, activity logging

**Tasks** — CRUD, assignee, due dates, auto-overdue detection, toggle complete, link to any entity, bulk actions, activity logging

**Meetings** — CRUD, schedule, link to any entity, activity logging

**Dashboard** — KPI cards, pipeline funnel chart, lead sources pie chart, monthly trends bar chart, tasks due today, team status banner

**Pipeline (Leads)** — kanban board, drag between statuses, swimlanes by assignee/status/priority

**Pipeline (Deals)** — kanban board, custom stages with probability, drag between stages, total value per column, swimlanes

**Auth** — sign up, sign in, email confirmation flow, session management, sign out (clears cookies + server session)

**Teams** — auto-created on signup, member roles (admin/manager/agent/viewer), invite members, manage pending invitations, permission guards on every feature

**Onboarding** — 6-step wizard: welcome, profile, company, goals, invite team, complete

**Notes** — create, edit, delete on any record. Markdown body. Author tracking. Full history.

**Call Logs** — log inbound/outbound calls on any record. Duration, result (completed/no answer/busy/failed/voicemail), notes.

**Tags** — create/edit/delete colored tags. Tag any record type. Filter by tag on list pages. Dedicated tag management page.

**Lead Scoring** — automatic 0-100 score per lead based on data completeness (email, phone, company, source, tags). Score breakdown visible on lead detail. Filter by minimum score.

**Duplicate Detection** — scan leads/contacts/companies for duplicates. Merge groups by selecting a survivor. Automatically moves tasks/meetings/activities/tags to survivor.

**Bulk Actions** — select multiple records, change status/priority/assignee/tag, or delete in one operation. Works on leads, contacts, companies.

**Saved Views** — save current filters as a named view. Load, rename, delete. Works on leads, contacts, companies.

**API Keys** — generate scoped API keys. Copy on creation (shown once). Regenerate, delete. Listed on settings page.

**Settings (Account)** — display name, email, timezone, notification preferences. Persisted via Zustand.

**Settings (Team)** — team name/description, member list with role badges, role change, remove member, pending invitations tab.

**Settings (Automation)** — list automation rules, enable/disable toggle, create with trigger/conditions/actions, edit, delete.

**Settings (Data Quality)** — tabbed duplicate scanning for leads/contacts/companies. Merge with survivor selection.

**Settings (Forecasts)** — monthly target vs actual grid. Auto-calculate actuals from deal values. Year selector. Summary row with achievement percentage.

**Settings (Saved Views)** — manage all saved filter presets across entity types.

**Settings (Workflows)** — custom state machines for leads/deals/tasks. Add/edit/delete states. Define allowed transitions.

**Settings (Portal)** — invite portal users (name, email, password). Toggle active/inactive. Share records with view/comment/edit permission.

**Deal Pipeline Stages** — custom stages with names, colors, probabilities, sort order. CRUD from settings.

**Deal Revenue Tracking** — deals with title, value, currency, stage, close date, tags. CRUD from dedicated deals page.

**Sales Forecasting** — monthly targets set manually. Actuals auto-calculated from deal values by expected close month. Progress bars. Year-over-year.

**Entity Cache** — shared Zustand store syncs across hooks. Edit on one page reflects on another without refetch.

**Optimistic Updates** — every mutation updates UI instantly. Rolls back on server error.

**URL Filter State** — all filters (search, status, source, priority, tag, min score) persisted in URL params. Survives refresh and navigation.

**Search Debounce** — 300ms debounce on all list page searches.

**CSV Export** — download any entity list as CSV with BOM for Excel.

**CSV Import** — upload CSV for leads, contacts, companies. Column validation. Required field checks.

**Dark Mode** — toggle in header. Persisted. No white flash on load (blocking script in `<head>`).

**Session Caching** — shared in-memory cache for Supabase auth. One `getUser()` call per page session, not per component. No rate limit issues.

**Proxy Middleware** — checks `sb-` cookies for auth. Zero API calls. Routes unauthenticated users to login.

---

## ⚡ PARTIAL / HAS GAPS

**Email history** — you can compose and send emails from the UI, and they get recorded in the `email_history` table with timestamps. But there's **no real email delivery** — no SMTP, no SendGrid, no Resend. Nothing actually leaves the server. The feature works as a **log** only.

**SMS history** — same as email. You can compose SMS from the UI, recorded in `sms_logs`. But **no real SMS provider** (Twilio/Vonage). Log only.

**Webhooks** — every create/update/delete fires `triggerWebhook()` and there's a `/api/webhook/n8n` POST endpoint with auth. But there's **no UI to manage webhook URLs** — you can't add or remove destinations from inside the app. Only works if you configure the n8n endpoint directly.

**File attachments** — upload works via Supabase Storage bucket `attachments`. Files are stored and listed. But there's **no file size limit enforcement** in the UI, no image preview, and the bucket must be created manually in the Supabase dashboard.

**Email sequences / campaigns** — you can create sequences with multiple campaign emails and delay days. Full CRUD. But there's **no scheduler** — sequences never actually execute. They exist as data only.

**Workflow builder** — the settings page lets you create custom states and transitions for leads/deals/tasks. But it's **form-based**, not a drag-and-drop visual editor. Custom states don't change how the pipeline kanban renders (still uses default stages).

---

## ❌ NOT BUILT

- **Real email sending** — no SendGrid, Resend, SMTP, or any delivery provider
- **Real SMS sending** — no Twilio, Vonage, or any provider
- **Calendar sync** — no Google or Outlook OAuth. The "Connect" button on the integrations page stores an email address but does nothing.
- **Customer portal frontend** — no login page, dashboard, or any UI for portal users to see their shared records. Only the admin-side user management exists.
- **Email campaign scheduler** — no background job, cron, or trigger to actually send campaign emails
- **Mobile app** — nothing
- **Public REST API** — API key management UI exists, but there are no public API endpoints, docs, or rate limiting
- **Real-time notifications** — no WebSocket, no push, no email alerts
- **Unit tests** — zero
- **Integration tests** — zero
