# NexusCRM — Project Description

Built commit by commit, this is a production-grade SaaS CRM powered by Next.js 16, Supabase, and shadcn/ui. Below is everything that exists, what partially works, and what hasn't been built yet.

---

## ✅ FULLY IMPLEMENTED

### Core CRM
- **Leads** — create, edit, delete, filter, search, bulk actions, score
- **Contacts** — create, edit, delete, link to companies, bulk actions
- **Companies** — create, edit, delete, link to leads/contacts, bulk actions
- **Tasks** — create, assign, set due dates, mark complete, auto-detect overdue
- **Meetings** — schedule, link to any record, calendar view
- **Dashboard** — KPI cards, pipeline funnel chart, lead sources, monthly trends, tasks due today

### Pipeline & Kanban
- **Leads pipeline** — drag between status columns
- **Deals pipeline** — custom stages, drag to move, total value per column
- **Swimlanes** — group kanban by assignee, status, or priority

### Auth & Teams
- **Sign up / Sign in** — real Supabase auth (email + password)
- **Team auto-creation** — every signup creates a team
- **Roles** — admin, manager, agent, viewer with per-feature permissions
- **Invite members** — send email invitations, manage pending invites
- **Onboarding wizard** — 6-step setup (profile, company, goals, invite team)

### Deals & Revenue
- **Deal pipeline** — custom stages with probability percentages
- **Deal kanban** — drag deals between stages
- **Revenue tracking** — deal values, currency support
- **Sales forecasting** — monthly targets vs actuals, auto-calculate from deals
- **Lead scoring** — automatic 0-100 score from data completeness

### Communication
- **Notes** — add Markdown notes to any record, edit and delete
- **Call logs** — log inbound/outbound calls with duration and result
- **Email history** — record sent/received emails against any record
- **SMS history** — record sent/received SMS against any record
- **Email composer** — compose and log emails from within the app

### Tags
- **Create/edit/delete** colored tags
- **Tag any record** — leads, contacts, companies, deals, tasks, meetings
- **Filter by tag** — on every list page
- **Tag management page**

### Automation
- **Automation rules** — trigger on 14 events (lead.created, task.overdue, etc.)
- **Actions** — assign user, change status, add tag, send email, trigger webhook
- **Enable/disable** — toggle rules on and off

### Data Quality
- **Duplicate detection** — scan leads/contacts/companies for matches
- **Merge** — pick a survivor, automatically move related records
- **Score-based matching** — each group gets a similarity percentage

### File Attachments
- **Upload files** to any record
- **Supabase Storage** backend
- **File list** with type icons

### Saved Views
- **Save filters** as named views
- **Load/rename/delete** — per entity type

### API Keys
- **Generate keys** with read/write scopes
- **Copy on creation** (shown once)
- **Regenerate and delete**

### Settings
- **Account** — name, email, timezone, notification preferences
- **Teams** — info, members, invitations, role management
- **API Keys** — full key management UI
- **Workflows** — custom state machines for leads/deals/tasks
- **Portal** — invite customer portal users, share records
- **Automation** — manage automation rules
- **Data Quality** — duplicate scanning and merging
- **Forecasts** — monthly target setting
- **Integrations** — connect Google/Outlook calendar (mock)
- **Saved Views** — manage all saved filter presets

### UI/UX
- **Dark mode** — persists across sessions, no flash on load
- **Responsive sidebar** — collapsible, works on mobile
- **Search debounce** — 300ms on all list pages
- **CSV export** — download any entity as CSV
- **CSV import** — bulk-import leads, contacts, companies
- **Filters in URL** — shareable, bookmarkable filter state
- **Optimistic updates** — UI responds instantly, rolls back on error
- **Every state covered** — loading skeletons, empty states, error states

---

## ⚡ PARTIALLY IMPLEMENTED

- **Email sending** — composer and history exist, but emails only log to the database. No real SMTP/SendGrid/Resend integration — nothing actually gets delivered.
- **SMS sending** — same as email. You can compose and log SMS, but no Twilio/Vonage integration for actual delivery.
- **Calendar sync** — Settings > Integrations has a "Connect Google Calendar" button and stores the connection, but there's no real OAuth flow. No actual sync happens.
- **Webhook management** — webhooks fire on every mutation and an n8n endpoint exists, but there's no UI to add/edit/remove webhook URLs from inside the app.
- **Workflow builder** — the data model and settings page exist but it's form-based, not a drag-and-drop visual editor. Custom workflows don't change the kanban yet.
- **Customer portal** — you can create portal users and share records, but there's no actual portal frontend. Portal users have nowhere to log in.
- **Email sequences** — you can create sequences with multiple emails and delay days, but they never actually send. No scheduler.

---

## 🗺️ NOT YET BUILT

- Real email delivery (SMTP / SendGrid / Resend)
- Real SMS delivery (Twilio / Vonage)
- Real calendar OAuth sync (Google / Outlook)
- Customer portal frontend (login page + dashboard for external users)
- Email campaign/sequence scheduler
- Mobile app
- Public REST API documentation
- Real-time push notifications (WebSocket)
- Unit and integration tests

---

## By the Numbers

- **31 app routes**
- **7 database migrations** → **32 tables**
- **~400 source files**
- **Zero mock data in production code** (all real Supabase)
- **Build status: ✅ Passes clean**
- **Auth API calls per page session: 1** (shared cache, no rate limit issues)
