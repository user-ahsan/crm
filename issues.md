# NexusCRM — Full Project Audit Report (`issues.md`)

**Date:** 2026-07-31
**Method:** 15 parallel audit agents (CodeReviewer) covering all routes, all services, all modules, hooks, stores, data, types, lib, components, UI states, docs/PRD compliance, governance and security.
**Contract files audited against:** `AGENTS.md`, `README.md`, `docs/guides/PRD.md`, `docs/architecture/ARCHITECTURE.md`, `docs/features/FEATURES.md` (35-feature catalog), `docs/reference/*.md`, `docs/features/N8N_INTEGRATION.md`, `docs/guides/SETUP.md`, `docs/SCHEMA.md`, `docs/CHANGELOG_FIXES.md`.
**Per-agent reports:** `.tmp/audit/01-routes.md` … `.tmp/audit/15-docs-compliance.md` (full evidence with file:line for every item below).

---

## Executive Summary

The project presents a polished, **structurally complete** UI (every documented route exists; all pages have loading/empty/error states; optimistic updates with rollback are correctly implemented in the primary CRUD hooks; the shadcn/Base-UI primitive layer is clean; security hygiene is genuinely good — no hardcoded secrets, CSRF/rate-limit/SSRF guards broadly wired). However, it fails its own production-readiness contract in three systemic ways:

1. **The documented "frontend-first, optional Supabase, mock-data" contract is fiction.** Every service + the auth middleware hard-requires Supabase env vars and **throws** when they are absent (`lib/supabase/client.ts:31-36`, `lib/supabase/update-session.ts:30-33`). All 14 `data/*.ts` mock files are dead code (zero imports). The documented zero-config quick start (`bun install && bun run dev`) cannot render any entity page.
2. **Documented features are silently dead or broken at the data layer.** The automation rule engine has zero callers; 4+ documented webhook events never fire; `leadService.getPipelineStats` queries a non-existent `deleted_at` column; email/SMS writes violate the shipped DB CHECK constraints; the Workflow Builder's custom states destroy the pipeline kanban; the invite-code feature is unredeemable; `/invoices` has no DB table.
3. **Docs vs code are systematically out of sync.** PRD §4 out-of-scope features (real email via Resend, real SMS via Twilio, real Supabase auth, automation, cron) are fully implemented; 33 of 34 API routes are undocumented; table counts disagree everywhere (28/32/33 documented vs 40 in migrations); ~15 documented service methods and ~15 documented hook APIs are renamed/missing; 6 hooks and entire features (invoices, branding, realtime, service-config) are undocumented.

**Consolidated severity counts (after de-duplication across agents):**

| Severity | Count | Notes |
|---|---|---|
| **Critical (P0)** | **17** | Data loss/corruption, security holes, dead documented features, broken core flows |
| **High (P1)** | **57** | Partial features, silent failures, layer violations, doc-vs-code conflicts |
| **Medium (P2)** | **49** | UX inconsistencies, minor doc drift, missing tests, dead code |
| **Low (P3)** | **28** | Cosmetic, dead exports, nitpicks |

> Raw findings across agents: ~430 (P0: ~24, P1: ~162, P2: ~163, P3: ~101). The numbers above are the de-duplicated unique issues. Cross-agent duplicates are marked "(also: agents X, Y)".

---

# CRITICAL (P0) — Must fix before anything ships

## C1. The documented mock/optional-Supabase mode does not exist — app cannot run without Supabase
**Files:** `lib/supabase/client.ts:31-36`, `lib/supabase/update-session.ts:30-33`, `lib/supabase/server.ts:17-19`, `proxy.ts:39-40`, all 29 `services/*.ts`, `data/*.ts` (14 files, all dead code)
**Rule violated:** SETUP.md:19,107 ("optional — app works without it", "automatically uses mock data when Supabase is not configured"), README.md:22 ("Optional Supabase"), ARCHITECTURE.md §1/§2 ("Local mock data (in-memory arrays)"), .env.example:13 ("dev environment runs with ZERO external dependencies"), SERVICES.md:7 ("dual Supabase/mock mode")
**What it does:** Every service calls `getSharedClient()` which **throws** `Missing NEXT_PUBLIC_SUPABASE_URL...` when env vars are absent. The middleware calls `supabase.auth.getUser()` on every request using non-null-asserted env vars. Zero service files import any `data/*.ts` mock (grep: 0 matches).
**Impact:** Fresh clone following README/SETUP renders every entity page as an ErrorState; the landing page itself can throw via middleware. The documented default configuration cannot view or mutate any data.
**Fix:** Either (a) add a mock-mode branch (`isSupabaseConfigured()` already exists in `services/supabase.service.ts:6` and is never used) that falls back to the in-memory `data/*` arrays, and gate `updateSession` on env presence; or (b) rewrite SETUP/README/ARCHITECTURE to state Supabase is **required** and remove the dead mock layer.
*(Also reported by agents: 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 15 — this is the single biggest finding in the project.)*

## C2. User directory is an empty array behind a TODO — "Assign to users" is dead everywhere
**Files:** `data/mock-users.ts:4,6` (imported by **13 production files**)
**Rule violated:** AGENTS.md §2.1 (no TODO comments), §2.2 (full implementation), PRD §3.1 ("Assign leads to users"), FEATURES.md:60
**What it does:** `export const USERS: User[] = []` with `// TODO: Replace with real user/team member service when auth is wired.` Consumers: `components/leads/LeadCreateForm.tsx:25,345`, `LeadTable.tsx:19,208,213`, `LeadDetail.tsx:41,405…`, `KanbanBoard.tsx:19,354`, `SwimlaneBoard.tsx:14,170…`, `TaskCreateForm.tsx:25`, `DealCreateForm.tsx:25`, `NotesList.tsx:7`, `app/goals/page-content.tsx:32`, etc.
**Impact:** Assignee dropdowns render only "Unassigned"; Assigned To columns show `?`/`—`; Kanban/Swimlane assignee grouping shows no names; notes are hardcoded `createdBy: 'user-1'` and render "Unknown". Assignment is a PRD core flow. The only TODO in the codebase ships in production UI.
**Fix:** Populate from real team members (`data/team-members.ts` has user-1..5) or wire TeamContext; remove the TODO.
*(Also: agents 2, 6, 9, 13, 15.)*

## C3. Unauthenticated portal-register endpoint mints confirmed Supabase Auth users via service-role key
**Files:** `app/api/portal/auth/register/route.ts:27-72`, `services/portal.service.ts:96-137`
**Rule violated:** Security protocol (auth bypass; service-role exposure), PRD §4 auth simulation claim
**What it does:** `POST /api/portal/auth/register` has **no session check, no CSRF, no rate limit**. It calls `portalService.createUser()` → `adminClient.auth.admin.createUser({ email_confirm: true })` using `SUPABASE_SERVICE_ROLE_KEY` (portal.service.ts:29,106-114). The only gate is the `NEXT_PUBLIC_ENABLE_PORTAL` feature flag (default off). CHANGELOG S9 claims rate limiting exists — it does not.
**Impact:** With the documented portal feature (feature 27) enabled, anyone on the internet can mint unlimited **confirmed** auth accounts on the instance (spam, quota/billing abuse), through a public route using the service-role key.
**Fix:** Require admin session + role check (mirror `users/[id]/route.ts`), add CSRF + `checkRateLimit`, remove `email_confirm: true` or verify ownership, or restrict creation to the admin settings UI.
*(Also: agents 10, 15.)*

## C4. Automation rule engine is defined but never executes — documented feature is a dead UI
**Files:** `services/automation.service.ts:151,185`, `hooks/useAutomation.ts:101`, `app/settings/automation/page-content.tsx:47`
**Rule violated:** FEATURES.md feature 24 ("Rule evaluation engine", 14 trigger events, 6 actions), SERVICES.md:289, AGENTS.md §2.1 (features that don't function must not exist in UI)
**What it does:** `evaluateRule()` and `executeActions()` have **zero callers** in the repo. No entity service (lead/contact/company/task/meeting/deal) invokes the engine after any mutation. Rules can be created/enabled but never fire.
**Impact:** Users configure automation rules believing they will trigger on `lead.status_changed`, `task.completed`, etc. — nothing ever happens. PRD §4 lists automation as out-of-scope "future upgrade", so either wire it or remove it.
**Fix:** Call `getByTrigger(event)` → `evaluateRule` → `executeActions` in every entity service's post-mutation path (alongside the existing `activityService.log`/`triggerWebhook`), or remove the feature and its UI.
*(Also: agents 10, 11.)*

## C5. Email/SMS services write statuses that violate the shipped DB CHECK constraints — email send always fails on Supabase
**Files:** `services/communication.service.ts:261,285`, `services/sms.service.ts:66`, `supabase/migrations/00004_communications.sql:16`, `00007_ecosystem.sql:60`, `types/supabase.types.ts:516`
**Rule violated:** FEATURES.md features 10/11 (statuses), DATABASE.md schema — service writes must match schema
**What it does:** `sendEmail()` inserts `status:'pending'` then updates to `'queued'`; `smsService.send()` inserts `'queued'` when Twilio is unconfigured. Migrations constrain `email_history.status` to `('draft','sent','failed')` and `sms_logs.status` to `('sent','delivered','failed')`. No later migration alters them. The type layer gives a third opinion (no `queued`).
**Impact:** On any DB built from the shipped migrations, **every email send throws at INSERT** (CHECK violation) and SMS default-mode fails — the documented email feature cannot function, contradicting README "Email (Real) … Real delivery".
**Fix:** Widen the CHECK constraints (migration) to include `pending`/`queued`, and align `types/supabase.types.ts:516` with the runtime union.
*(Also: agent 7.)*

## C6. `leadService.getPipelineStats` queries a non-existent column — pipeline stats throw at runtime
**Files:** `services/lead.service.ts:409` (+ `.neq('status','lost')` at 410)
**Rule violated:** SERVICES.md:33 / FEATURES.md:47 (documented method), AGENTS.md §2.2
**What it does:** `.is('deleted_at', null)` — `deleted_at` exists in **neither** `types/supabase.types.ts` nor any of the 10 migrations (grep: 0 hits). PostgREST rejects the filter (PGRST204). Additionally `.neq('status','lost')` makes the lost stage always `{count:0, value:0}`.
**Impact:** Pipeline stage stats (kanban + dashboard funnel) are broken; usePipeline depends on this method.
**Fix:** Remove the filter or add the column via migration; decide whether lost leads belong in stats.
*(Also: agents 2, 11, 15.)*

## C7. Money math/display corruption in quotes and invoices
**Files:** `lib/formatters.ts:3-10` (`formatCurrency` — `maximumFractionDigits: 0`), `services/quote.service.ts:53-65`, `services/invoice.service.ts:52-66`
**Rule violated:** P0 "money math errors (wrong totals, floating point corruption)", AGENTS.md §2.3
**What it does:** Line-item totals are raw float multiply/reduce with no rounding; every display/PDF path rounds to **whole dollars**. $9.99 → "$10", $29.97 subtotal → "$30", $0.30 → "$0". Float noise (3 × 0.1 = 0.30000000000000004) is persisted to `subtotal`/`total` columns.
**Impact:** Real-world billing documents display wrong totals and store corrupted values.
**Fix:** Round to cents at computation (`Math.round(x*100)/100` per item and total) and use a 2-decimal formatter for quotes/invoices; consider integer-cents storage.
*(Also: agent 8.)*

## C8. RLS grants every team member (viewer included) full CRUD on every entity — permission matrix is decorative
**Files:** `supabase/migrations/20260726_rls_policies.sql:42-49,56-63,70-77,84-91,98-105,204-211,232-239`
**Rule violated:** FEATURES.md feature 21 role→permission matrix (Viewer="Read all", Agent="CRUD own"), ARCHITECTURE.md §8
**What it does:** The "hardening" migration replaces owner-scoped policies with `is_any_team_member()` for SELECT, INSERT, **UPDATE and DELETE** on leads, contacts, companies, tasks, meetings, deals, quotes. `teamPermissions.ts` is imported only by UI (context/hook/PermissionGuard) — **never by services**. An old policy set also coexists (00001 policies not dropped).
**Impact:** Any authenticated member — including a viewer — can delete/modify any row by calling Supabase directly; the documented role matrix only hides buttons in the UI.
**Fix:** Add role-aware RLS (helper per scope: `own`/`team`/`all` + record-owner checks) matching the matrix, or explicitly document entity permissions as UI simulation and remove the security claim.
*(Also: agent 9.)*

## C9. Auth middleware trusts cookie *presence*, not the validated session — forgeable auth gate
**Files:** `proxy.ts:56-57`, `lib/supabase/update-session.ts:56`
**Rule violated:** ARCHITECTURE.md §8 ("validate the session via supabase.auth.getUser()", "No session? → Redirect to /login")
**What it does:** `updateSession` already calls `supabase.auth.getUser()` but its result is discarded for routing; `hasSession` is `cookies.getAll().some(c => c.name.startsWith('sb-'))`. Setting `document.cookie = 'sb-fake=1; path=/'` serves every protected route without a session.
**Impact:** Unauthenticated users reach protected page shells; the middleware's only enforcement is a spoofable string check (data stays RLS-gated, but the documented gate is bypassable and any future UI-trusting path is exposed).
**Fix:** Route on the `data.user` result already returned by `updateSession` (return `{response, user}` and branch on `user`).
*(Also: agent 9.)*

## C10. Workflow Builder custom states break the pipeline kanban (documented feature destroys core flow)
**Files:** `modules/pipeline/pipelineUtils.ts:45-55,67-87`, `hooks/usePipeline.ts:27,83-99`, `types/supabase.types.ts:238`
**Rule violated:** FEATURES.md §5 + §6, ARCHITECTURE.md §7 — features must not break other features
**What it does:** `getWorkflowStages('lead')` returns any custom lead state keyed by its UUID; `buildPipeline` groups leads by `lead.status === stage.key`, but `lead.status` is constrained to `new|contacted|qualified|proposal|won|lost` — **all leads vanish from the board**. Dropping onto a custom column calls `updateStatus(leadId, uuid)` writing an invalid enum → error → whole board replaced by error screen.
**Impact:** Creating any custom lead state (documented feature 6) makes the pipeline show zero leads and every drop onto a custom column fail.
**Fix:** Never surface workflow states as kanban columns unless `leads.status` can hold them (extend the DB domain + type + remap, or restrict lead states to the six built-ins); validate stage key before `updateStatus`.
*(Also: agent 5.)*

## C11. `applyOverdue` fire-and-forget DB write can silently revert a completed task
**Files:** `services/task.service.ts:60-77`
**Rule violated:** ARCHITECTURE §10 (optimistic updates reversible, no console-only), AGENTS.md §2.4
**What it does:** On every read, `applyOverdue` dispatches `supabase.from('tasks').update({status:'overdue'})` **without awaiting** and with **no status guard in the UPDATE** (the `status==='pending'` check is only in the JS map). If the user completes the task while the write is in flight, the write lands after and overwrites `completed` back to `overdue`. Failures are `console.error`-only.
**Impact:** A completed task silently reappears as overdue on refresh; user's action undone with no error.
**Fix:** Await the update, add `.eq('status','pending')` to the UPDATE, reconcile the returned row, and surface failures via the service error path.
*(Also: agents 6, 11.)*

## C12. `usePipeline.moveLead` never updates the entity cache — stale stage data after drag-drop
**Files:** `hooks/usePipeline.ts:88-99` (vs `useLeads.ts:100`, `useTasks.ts:124`)
**Rule violated:** ARCHITECTURE §7/§11 (entity cache), P0 "entity-cache desync causing wrong data display"; FEATURES §5 claims optimistic drop
**What it does:** `moveLead` awaits `updateStatus` and updates only local state — unlike every other mutation hook it never calls `useEntityCache.getState().updateLead(...)`. Also not optimistic and no transition validation.
**Impact:** After a drag-drop, global search (reads cache) and cache-hydrated lists show the lead's OLD stage; a freshly mounted `useLeads` hydrates stale status. Wrong data displayed until full refetch.
**Fix:** Update the cache on move (and on optimistic apply); add `setLastFetched` invalidation.
*(Also: agent 12.)*

## C13. `useForecasts.upsert` optimistic row never rolled back for new months
**Files:** `hooks/useForecasts.ts:68-86`
**Rule violated:** ARCHITECTURE §10 "Optimistic updates must be reversible"
**What it does:** `prevItem` is only captured when the month already exists. If `data.month` is new and the upsert throws, the catch skips restoration (`if (prevItem)` is false) — phantom forecast row persists until refresh.
**Impact:** User sees a saved forecast that was never persisted; no error UI (page error branch requires `forecasts.length === 0`).
**Fix:** In catch, always remove `optimistic.id` when `prevItem` is undefined.
*(Also: agent 12.)*

## C14. ExportDropdown uses `onSelect` on Base-UI `Menu.Item` — every CSV export silently no-ops
**Files:** `components/common/ExportDropdown.tsx:56,66` (also `components/teams/TeamMemberList.tsx:226`)
**Rule violated:** FEATURES.md feature 32 (CSV Export), ARCHITECTURE §5; P0 "documented production feature does not function"
**What it does:** `@base-ui/react/menu` `Menu.Item` supports only `onClick` (verified `MenuItem.d.ts:24`); `onSelect` maps to the DOM text-selection event which never fires on click. The menu closes and nothing happens.
**Impact:** "Export → Leads/Contacts/…/Export All" on every list page does nothing — a documented feature broken at the shared layer.
**Fix:** Change to `onClick={() => { onExport(...); }}` (Base UI closes the menu automatically).
*(Also: agent 14.)*

## C15. Settings "Delete Account" is a fake handler that deletes nothing
**Files:** `app/settings/page-content.tsx:163-167` (ConfirmDialog at 498-506 claims "This action is permanent… All your data will be lost")
**Rule violated:** AGENTS.md §2.1 "no fake handlers… If something is not implemented, it MUST NOT exist in UI"
**What it does:** `handleDeleteAccount()` only calls `reset()` on the local settings store + `router.push('/signup')`. No API call, no auth-user deletion, no data deletion.
**Impact:** User believes account + data were permanently deleted; nothing is deleted — a misleading destructive action in a production-styled UI.
**Fix:** Implement real deletion (auth user + rows) or change to an honest "reset local settings" action with non-destructive copy.
*(Also: agent 10.)*

## C16. Cascade deletes are not scoped by related-entity type — can delete another entity's records
**Files:** `services/lead.service.ts:229-233`, `contact.service.ts:179-183`, `company.service.ts:149-153`, `deal.service.ts:223-226` (+ task/meeting/campaign variants)
**Rule violated:** ARCHITECTURE.md §7 (cascade to related activities/tasks/meetings), AGENTS.md §2.3 (edge cases)
**What it does:** Cascade deletes filter `tasks`/`meetings` by `related_to_id = id` **without** `related_to_type`, and activities by `entity_id` alone (shared id space across entity types). Hook temp IDs are generated, not guaranteed UUIDs.
**Impact:** If a lead id equals a contact id, deleting the lead deletes the contact's tasks/meetings/activities — data loss. Even with UUIDs, deleting any entity removes **all** activities for that id across types.
**Fix:** Add `.eq('related_to_type', entity)` / `.eq('entity_type', entity)` to every cascade.
*(Also: agent 11.)*

## C17. `invoices`/`invoice_items` have no database table — typed + routed but non-existent in migrations
**Files:** `supabase/migrations/*` (39 tables, none is invoices), `types/supabase.types.ts:126-135`, `data/invoices.ts`, `app/invoices/*`, `lib/constants.ts:176`
**Rule violated:** ARCHITECTURE §4 / DATABASE.md table reference; P0 "doc claims production-ready but feature does not function"
**What it does:** The typed `Database` interface includes `invoices`/`invoice_items` and the UI/nav expose the feature, but no migration creates them. Also `invoice_templates` is missing from both.
**Impact:** With Supabase enabled, every invoice read/write throws "relation does not exist"; the feature is mock-only while docs imply full schema. Type drift also forces `as any`/`as never` casts elsewhere.
**Fix:** Add `invoices` + `invoice_items` (+ `invoice_templates`) migrations matching `InvoiceRow`/`InvoiceItemRow`.
*(Also: agents 8, 13, 15.)*

---

# HIGH (P1) — Blocks production confidence

## Routes & Middleware
- **`app/proxy.ts:21-26`** `/invoices`, `/invoices/new`, `/invoices/[id]` are missing from `protectedRoutes` — billing data reachable without a session while every other entity route is protected. *(Also: agent 1.)*
- **`app/api/webhook/n8n/route.ts:302`** `insert({...} as never)` unsafe cast in the one fully-documented API route. *(Also: agents 1, 15.)*
- **`app/api/**/*` — 33 of 34 API routes are undocumented** (API.md:7 claims n8n is "the only external API"). Real email/SMS/cron/auth/portal/branding/service-config routes exist with zero reference coverage. *(Also: agents 1, 15.)*

## Leads
- **`services/lead.service.ts:128-132,196-200`** `create`/`update` validate `assignedTo` against a `profiles` table no migration creates → assignment and bulk-assign fail at the DB layer. *(Agent 2.)*
- **`services/lead.service.ts:226-244`** delete cascade omits notes, email_history, call_logs, sms_logs, file_attachments, taggings → orphaned data; cascade failures are console-only. *(Agent 2.)*
- **`components/leads/LeadDetail.tsx:542-590`** 9 tabs instead of documented 10 — "Details" and "Score" tabs missing (score is a card above tabs), undocumented "Overview" tab added. *(Agent 2.)*
- **`components/leads/LeadDetail.tsx:348-351`** Dead "Schedule" button — no onClick, no handler (fake handler in production UI). *(Agent 2.)*
- **`services/lead.service.ts:69-76` + `hooks/useLeads.ts:19`** Hardcoded `pageSize=50`, no pagination UI — leads beyond 50 permanently invisible; `findDuplicates` scans only the first 50. *(Agent 2.)*
- **`hooks/useLeads.ts:90-108`** Optimistic update not rolled back when service returns `undefined` (PGRST116) — ghost/stale state. *(Agent 2.)*
- **Missing documented components/hooks:** `LeadForm.tsx`, `LeadFilterBar.tsx`, `LeadBulkActions.tsx`, `useCachedLeads.ts` (FEATURES.md:26-30,56) — nonexistent; functionality delivered by renamed equivalents (PARTIAL). *(Agents 2, 15.)*
- **`modules/leads/leadValidation.ts` is dead code** with a non-conforming contract (local `LeadValidationResult` vs documented `ValidationResult`; no `validateLeadField`); forms use `lib/validators.ts` instead. *(Agent 2.)*
- **Unsafe casts:** `app/leads/page-content.tsx:306`, `services/lead.service.ts:423,430`, `ImportDialog.tsx:348` (`as unknown as`, `any` service map with eslint-disable). *(Agents 2, 14.)*

## Contacts
- **`components/contacts/ContactDetail.tsx:120-141`** Initial load fetches only contact+meetings — linked leads/tasks/company/tags silently render empty on the primary path (full `loadData` only runs from the error-retry button). *(Agent 3.)*
- **PRD §3.2 "Link contacts to leads" unimplemented:** no lead selector UI; `contactService.linkToLead` is dead code (grep: definition only); `create` hardcodes `lead_ids: []`; lead detail shows no linked contacts. *(Agents 3.)*
- **PRD §3.2 "Contact profile page with activity history" missing:** ContactDetail shows static counts, no ActivityTimeline, no `useActivities`. *(Agent 3.)*
- **`services/contact.service.ts:218`** documented `mergeContacts()` does not exist (renamed `merge`) — SERVICES.md contract broken. `getFiltered` also missing (page re-implements filtering inline; `modules/contacts/contactFilters.ts` `searchContacts` is dead code). *(Agents 3, 11.)*
- **`components/contacts/ContactDetail.tsx:109,151,144-152`** tag load/save failures silently swallowed; optimistic tag state shows tags never persisted. *(Agent 3.)*
- **`services/contact.service.ts:176-194`** delete cascade console-only errors + deletes not scoped by entity type (same as C16). *(Agents 3, 11.)*
- **Layer violations:** ContactDetail + `[id]/page-content.tsx` import 6 services directly. *(Agents 3, 14.)*

## Companies
- **`services/company.service.ts`** documented `getFiltered`/`CompanyFilters` type/`applyCompanyFilters` module all missing (MODULES.md:43, SERVICES.md:82, HOOKS.md:82); page inlines filter logic. *(Agent 4.)*
- **`services/company.service.ts:149-158`** delete leaves dangling `contacts.company_id` + lead linkages; cascade failures console-only; `merge` leaves survivor `contactIds`/`leadIds` denormalized — company detail shows fewer contacts than linked. *(Agent 4.)*
- **`hooks/useCompanies.ts:82-112`** optimistic rollback captures `prevItem` inside React state updaters (not synchronously executed) → rollback silently no-ops; `prevItem!` non-null assertion; update returning `undefined` never reverted. *(Agent 4.)*
- **`app/companies/[id]/page-content.tsx:71-76,144-152` + CompanyDetail.tsx:99-128** stale UI after editing from detail page — no refresh mechanism. *(Agent 4.)*
- **PRD §3.3 "Company activity aggregation" partial:** static counts only, no ActivityTimeline for companies. *(Agent 4.)*
- **Bulk delete/tag (`app/companies/page-content.tsx:153-169`)** no per-item error handling; partial failure skips `refresh()` → stale UI. *(Agent 4.)*

## Deals & Pipeline
- **Kanban drop failure detection broken** (`components/pipeline/KanbanBoard.tsx:77-85`, `DealKanbanBoard.tsx:26-36`): `moveLead` is async so `if (!updated)` never fires; a failed drop replaces the whole board with an error screen instead of a toast. *(Agent 5.)*
- **Swimlane mode shows stale state after drops** (`app/pipeline/page-content.tsx:185-189`): page and KanbanBoard instantiate separate `usePipeline()` — drop persists to DB but card doesn't move in swimlane columns; totals stale until manual refresh. *(Agent 5.)*
- **"Multi-currency support" not implemented** (`lib/formatters.ts:3-10`, DealTable/DealKanbanColumn/pipeline): currency stored + selectable (USD/EUR/GBP/JPY/CAD/AUD) but every display hardcodes USD; aggregates sum mixed currencies without conversion. *(Agents 5, 13.)*
- **`lead.status_changed` webhook never fires** (`services/lead.service.ts:213-219`): `update()` always fires `lead.updated`; the documented event is never dispatched; two activities logged per status change. *(Agents 5, 11.)*
- **Undocumented deal webhook events** (`services/deal.service.ts:185,213,232`): `deal.created/updated/deleted` not in `WebhookEvent` union; `deal.stage_changed` (in automation types) never fires. *(Agent 5.)*
- **Layer violations:** deal pages import `dealService`/`activityService` directly; `modules/pipeline/pipelineUtils.ts` imports `workflowService` (module importing a service). *(Agent 5.)*
- **Swimlane header shows raw user ID** instead of name (`hooks/usePipeline.ts:130`, `KanbanBoard.tsx:217`). *(Agent 5.)*

## Tasks & Meetings
- **Tasks "Full CRUD" not implemented in UI** (`components/tasks/TaskList.tsx:158-298`): no edit, no delete affordance; `updateTask`/`deleteTask` have zero UI consumers. *(Agent 6.)*
- **Meetings CRUD + rescheduling UI missing** (`app/meetings/page-content.tsx:141-145`): `editMeeting` never passed; no edit/delete/reschedule from calendar; `MeetingCard` (with edit/delete/notes display) is never imported — dead. *(Agent 6.)*
- **Documented filters (priority/assignedTo/entity type) and sort have no UI** (`TaskList.tsx:29-57`); `getFiltered` only supports status+priority. *(Agent 6.)*
- **Overdue detection frozen at mount** (`TaskList.tsx:168`): `const [now] = useState(() => new Date())` — tasks crossing due date while page open never flip to overdue. *(Agent 6.)*
- **`task.overdue`/`task.completed` webhook/automation triggers never fire** (`services/task.service.ts:151-217`, `applyOverdue` 60-77); `meeting.completed` never fires. *(Agents 6, 11.)*
- **UTC-vs-local timezone bug** (`MeetingCreateForm.tsx:60-65,80-86,107-114`): `toISOString().slice(0,16)` into `datetime-local` silently shifts meeting times by the UTC offset on default + every edit. *(Agent 6.)*
- **Entity linking allows dangling references** (`TaskCreateForm.tsx:315-333`, `MeetingCreateForm.tsx:442-460`): free-text related-to ID, no validation, no picker — tasks/meetings linked to nothing. *(Agent 6.)*
- **TaskList reimplements overdue/filter logic** instead of using `modules/tasks/taskUtils.ts`/`lib/task-utils.ts` — logic drift (two implementations already diverge). *(Agent 6.)*
- **`hooks/useTasks.ts:51-58`, `useMeetings.ts:42-56`** silent failure on entity-scoped fetches — comment claims "Error preserved in error state" but `setError` is never called. *(Agents 6, 12.)*

## Communication Suite
- **Markdown notes never rendered** (`components/communication/NotesList.tsx:155-157`): plain text `whitespace-pre-wrap`; FEATURES feature 9 claims Markdown support. *(Agent 7.)*
- **Note attribution hardcoded to `user-1`** (`NotesList.tsx:35,123`) — renders "Unknown" with real auth; useCallLogs correctly uses `useCurrentUser`. *(Agent 7.)*
- **SMS "send" never calls Twilio in the UI path** (`services/sms.service.ts:100-102`, `hooks/useSms.ts:47-88`): no component calls `/api/sms/send`; status set to 'sent' purely on config presence; README "SMS (Real) — Real delivery" is false for the shipped flow. `delivered` status unreachable (no writer). *(Agent 7.)*
- **No error state on EmailHistory/SmsHistory/CallLogList** — a broken DB looks like an empty CRM. *(Agent 7.)*
- **Call-log save failure is silent and dialog closes** (`hooks/useCallLogs.ts:65-68`, `CallLogDialog.tsx:73-74`). *(Agent 7.)*
- **ActivityTimeline missing filter-by-type and metadata display** (FEATURES feature 13, PRD §3.7); `activityService.getByType()` exists but unused. *(Agent 7.)*
- **Activity fetch failures swallowed** (`useActivities.ts:52-58`, deals page, LeadDetail) — audit trail looks empty rather than broken. *(Agent 7.)*
- **Polymorphic notes missing on Task and Meeting entities** — 4 of 6 documented targets have notes UI. *(Agent 7.)*
- **`app/api/email/webhook/resend/route.ts:148`** `as any` in production route. *(Agent 7.)*
- **Layer violations:** deal detail page + LeadDetail/ContactDetail/CompanyDetail import services directly. *(Agents 7, 14.)*

## Sales Tools (Quotes, Goals, Forecasts, Campaigns, Invoices)
- **Forecast actuals "auto-calculated from won deals" is a manual button summing won LEADS** (`app/settings/forecasts/page-content.tsx:59-83`): no service calc; `recalculateActuals` missing; `actual` only stored via upsert. *(Agents 8, 11.)*
- **Invoice edit silently discards header changes when items unchanged** (`services/invoice.service.ts:174-270`): header update gated behind `itemsChanged`; UI toasts "saved successfully" — silent failure per AGENTS.md §2.4. *(Agent 8.)*
- **Campaign scheduler strands paused-sequence rows in `processing`** (`services/campaign-scheduler.service.ts:186-216`): claim-before-filter; rows never recovered; re-activation blocked; stats undercount. Also no stale-`processing` reclaim. *(Agents 8, 11.)*
- **Campaign status workflow bypassable** (`app/campaigns/[id]/page-content.tsx:381-392`, `app/api/campaigns/[id]/route.ts:215-242`): free-form status dropdown + API accept any status; `active` reachable without queueing recipients. *(Agent 8.)*
- **Fake/stub handlers in `useCampaigns`** (`hooks/useCampaigns.ts:122-167`): `activateSequence` never invokes the scheduler; `getSequenceStats` fabricates `{sent:0, failed:0}`; `addRecipients` is a no-op returning an unpersisted count; no try/catch on activate/pause. *(Agents 8, 12.)*
- **Invoice number generation is random 4-digit with ~50% collision at ~60 invoices** (`services/invoice.service.ts:6-10`); no uniqueness check. *(Agents 8, 11.)*
- **Invoice insert violates its own type contract** (`invoice.service.ts:123-172`): required `title` omitted; company fields never persisted; `quote.service.ts:110-118` omits required `created_by`. *(Agent 8.)*
- **Non-transactional delete-then-reinsert of line items** (`quote.service.ts:174-190`, `invoice.service.ts:221-234`): failed insert leaves zero items + stale totals. *(Agent 8.)*
- **Invoice templates: dead-end UI** (`app/settings/invoice-templates/page-content.tsx:61-74,128-176`): snake_case→camelCase cast wrong; `invoice_templates` not in typed schema; template never consumed by PDF path (hardcoded `defaultTemplate` in `InvoiceDownloadButton.tsx`). *(Agent 8.)*
- **Invoice status flow incomplete:** `sent`/`overdue` unreachable; no overdue detection anywhere. *(Agent 8.)*
- **False success toast on failed goal delete** (`app/goals/page-content.tsx:197-202` + `hooks/useGoals.ts:95-107`). *(Agent 8.)*
- **Stale forecast summary after single-cell edits** (`app/settings/forecasts/page-content.tsx:46-57,224-253`). *(Agent 8.)*

## Teams, Permissions & Auth
- **Invite code is a dead feature** (`app/onboarding/page-content.tsx:133,444-445`): generated client-side, links to nonexistent `/join` route on hardcoded `nexuscrm.app`, never persisted to `teams.invite_code` (column exists, unmapped). *(Agent 9.)*
- **Invitation lifecycle incomplete** (`services/team.service.ts:146-177`): no accept/decline flow, no expiry enforcement; expired invites stay "Pending" forever. *(Agent 9.)*
- **`canAccessRecord` returns TRUE for any role when requested scope is 'all'** (`modules/teams/teamPermissions.ts:124-128`) — the check that should deny agents all-records access grants it (currently latent; no caller passes scope). *(Agent 9.)*
- **Campaigns page access-denied for ALL roles** (`modules/teams/teamPermissions.ts:5-95`): `PermissionEntity` includes 'campaign' but no role has campaign permissions → `/campaigns` unreachable by anyone. *(Agent 9.)*
- **Onboarding state doesn't survive refresh** (`app/onboarding/page-content.tsx:118-138`): sessionStorage only read, never written for formData. Step order also inverted vs docs (Invite=5, Complete=6). *(Agent 9.)*
- **Silent failure of team creation/update** (`signup/page-content.tsx:171-173`, `onboarding/page-content.tsx:208-210`): `catch {}` — first-time user reaches hollow app with no team and no explanation. *(Agent 9.)*
- **Agent company permissions diverge from matrix** (`teamPermissions.ts:73-76`): code grants agent CRUD company own; matrix says read team. *(Agent 9.)*
- **Teams update policy is `created_by`-scoped, not admin-scoped** (`00001_initial_schema.sql:409-410`): second admin can't edit team; demoted creator can. *(Agent 9.)*
- **Admin-only team ops lack service-layer role checks** (`team.service.ts:193,212,146,179`) — rely solely on RLS. *(Agent 9.)*

## Settings & Configuration
- **API keys are cosmetic** (`services/api-key.service.ts:56-108`): generation is secure (hash + prefix), but no expiration input, `last_used_at` never updated, and **no endpoint validates key_hash or scopes** — keys grant nothing. *(Agent 10.)*
- **Webhook secret exposed via single-config GET** (`app/api/webhooks/config/[id]/route.ts:49`) while list endpoint deliberately strips secrets. *(Agent 10.)*
- **Portal deactivation silently fails to block sign-in** (`services/portal.service.ts:153-164`): `getAdminClient()` throws client-side; auth user never banned; `portal_users.active=false` only. *(Agents 10, 11.)*
- **Portal user deletion missing admin role check** (`app/api/portal/auth/users/[id]/route.ts:32-36`): comment claims admin-only, code only checks `getUser()`. *(Agent 10.)*
- **Portal enable toggle is fake state** (`app/settings/portal/page-content.tsx:55,176-187`): `useState(false)`, no persistence, hardcoded URL. **No consumer portal UI exists** (`app/portal` absent) — sharing is management-only, `authenticatePortalUser` dead. *(Agent 10.)*
- **Data-quality similarity threshold not configurable** (`app/settings/data-quality/page-content.tsx:95-129`): hardcoded 25/25/20 despite "Configurable similarity threshold". *(Agents 10, 13.)*
- **`lib/google-calendar.ts:2-4` `@ts-nocheck`** on production module; `syncEvents` writes `type:'meeting'` which isn't in `MeetingType`. *(Agents 13, 10.)*
- **Automation `trigger_webhook` action ignores its configured URL** (`automation.service.ts:265-276`); `send_notification` writes an activity row instead of delivering a notification; dialog/service config keys mismatch. *(Agent 10.)*
- **Failed settings save reported as success + console-only** (`app/settings/page-content.tsx:127-131,151-155`). *(Agent 10.)*
- **Workflow builder page has no loading/empty/error states** (`app/settings/workflows/page-content.tsx:15-40`) — ARCHITECTURE §12 INVALID rule. *(Agent 10.)*
- **`any` usage in realtime service** (`services/realtime.service.ts:433,623,642`). *(Agents 10, 11.)*

## Services Layer (cross-cutting)
- **Documented-method drift across 15+ services** — full table in `.tmp/audit/11-services.md`. Headline examples: `contactService.mergeContacts`→`merge`; `activityService.getForEntity`→`getByEntity`; all 9 campaign method names renamed; `notificationService` implements preferences CRUD instead of notifications (all 5 documented methods missing); `realtimeService.subscribeToEntity/unsubscribeAll` missing; `webhookService.configureWebhooks/isWebhookEnabled/getWebhookConfig` missing; **`tagService.addTagToEntity` documented param order is reversed vs actual — following the docs corrupts taggings**; `forecastService.setForecast/getYearSummary/recalculateActuals` missing. *(Agents 11, 12.)*
- **Cascade/merge sub-operation failures are console-only and swallowed** in 10+ services (lead/contact/company/deal/task/meeting/campaign/quote/invoice) — orphaned rows with UI reporting success. *(Agent 11.)*
- **`applyOverdue` GET paths mutate the DB fire-and-forget** (`task.service.ts:60-77`). *(Agents 11, 6.)*
- **Invoice numbers random** (see Sales Tools). **Forecast actuals never auto-calc.** **`getCurrentTeam` returns arbitrary team without membership filter** (`team.service.ts:50-66`) — cross-tenant exposure with >1 team. *(Agent 11.)*
- **Type-safety violations in services:** `lead.service.ts:423`, `tag.service.ts:116,208`, `realtime.service.ts:433,623,642`, `integration.service.ts:85,104` (`as never`). *(Agents 11, 15.)*

## Hooks & Stores
- **`store/auth.ts` is a dead shell** (`store/auth.ts:1-32`): no `login`/`signup`/`error`/sessionStorage persistence; `setSession`/`setUser` never called anywhere; login bypasses the store; `useIsAuthenticated` exported but unused — ARCHITECTURE §6 contract broken. *(Agents 12, 9.)*
- **`useCurrentUser` returns no `isAuthenticated` and doesn't read the store** (HOOKS.md:537-545 claim false). *(Agent 12.)*
- **`lib/cached-user.ts:43-46` caches a transient `getUser()` failure as permanent null** — momentary network error makes logged-in user appear logged out all page-life. *(Agent 12.)*
- **`useSearch` is 100% cache-dependent** (`hooks/useSearch.ts:8-38`): opening Cmd+K before any entity page warms the cache → zero results; documented `search/isSearching/clearSearch` API missing. *(Agent 12.)*
- **Documented hook APIs missing across ~15 hooks** — `getFiltered` on useContacts/useCompanies; `getById` on useTasks/useMeetings/useDeals/useQuotes/useInvoices; `toggleRule`; `getYearSummary/setForecast/recalculateActuals`; `useLeadScoring`→`useLeadScore`; `usePortal` split into two hooks; `useCachedLeads*` files absent. Full table in `.tmp/audit/12-hooks-stores.md`. *(Agent 12.)*
- **`useCampaigns.activateSequence/pauseSequence` no try/catch** — unhandled rejections. *(Agent 12.)*
- **All async getters swallow errors with misleading "Error preserved in error state" comments** (10 hooks) — silent empty/not-found rendering. *(Agent 12.)*
- **`useAttachments` uncontrolled setTimeout; `useTeamData` ineffective unmount guard.** *(Agent 12.)*

## Data / Types / Lib
- **`types/supabase.types.ts` drifts from migrations** (35 typed vs 40 in migrations): missing `rate_limits`, `calendar_integrations`, `sms_logs`, `portal_users`, `portal_shares`, `service_configs`, `branding_settings`; phantom `invoices`/`invoice_items`; `lib/service-config.ts:86` queries untyped `service_configs`. *(Agents 13, 15.)*
- **Mock deals reference `stage-001..005` that exist nowhere** (`data/deals.ts:14…`) — no `data/deal-stages.ts`, no default stage list. *(Agent 13.)*
- **Missing deals CSV export config** (`lib/csv-export-definitions.ts:262-271`): `ENTITY_EXPORT_CONFIG` lacks `deals` despite FEATURES feature 33. *(Agent 13.)*
- **`formatCurrency` hardcodes USD** (multi-currency claim broken). *(Agents 13, 5.)*
- **`lib/utils.ts:13,19`** documented `normalizePhone`/`fuzzyNameMatch` not exported; `fuzzyNameMatch` is substring-based, not fuzzy. *(Agent 13.)*

## UI / Shared Components
- **Direct service imports in shared components:** `ImportDialog.tsx:347-354` (with `any` + eslint-disable), `ViewsDropdown.tsx:7`, `FileAttachmentList.tsx:19`, plus detail panels (Lead/Contact/Company/SavedViewDialog). *(Agent 14.)*
- **ConfirmDialog lacks documented loading/error/disabled states** (`ConfirmDialog.tsx:15-56`); confirm button never disabled while async runs → double-click fires destructive action twice. *(Agent 14.)*
- **CommandPalette has no focus trap** (`CommandPalette.tsx:92-100`); focus doesn't return to trigger on close. *(Agent 14.)*
- **ViewsDropdown delete without confirmation** (`ViewsDropdown.tsx:105-113,234-240`). *(Agent 14.)*
- **NotificationPanel can crash the AppShell on malformed broadcast type** (`NotificationPanel.tsx:111-113` + `realtime.service.ts:435` unvalidated cast). *(Agent 14.)*

## Docs / Governance / Security
- **PRD §4 out-of-scope implemented as real integrations:** Resend email (`lib/email.ts`, 4 routes), Twilio SMS (3 routes), Supabase Auth, automation, cron (`vercel.json` + `app/api/campaigns/cron/process`). Product-scope contradiction. *(Agents 15, 1, 7.)*
- **Browser Supabase client used in 5 server route handlers** (`app/api/sms/send/route.ts:5`, `branding/*:2`, `service-config/*:2`, `webhook-config.service.ts:18`) — contradict CHANGELOG S2's "all 19 routes converted" claim; session resolution fails server-side. *(Agent 15.)*
- **Table counts disagree everywhere:** SCHEMA/ARCHITECTURE "28", DATABASE/README "33", PROJECT_DESCRIPTION "32", actual 40 unique tables. *(Agents 15, 13, 9.)*
- **`.env.example`/SETUP missing `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_PORTAL_URL`** (used by portal reset-password) — broken redirect URLs in documented deployments. *(Agent 15.)*
- **N8N health-check auth documented three ways** (no-auth vs x-api-key); SETUP curl example would 401. *(Agents 15, 1.)*
- **CHANGELOG_FIXES.md overstates fixes** (S2 browser-client, S9 portal rate-limit, P4 loading.tsx count). *(Agent 15.)*
- **PROJECT_DESCRIPTION.md:76 "No deployed cron trigger"** — false (`vercel.json` defines `*/5 * * * *`). **":3 zero mock data in production"** — false (mock-users imported by 13 components). *(Agent 15.)*
- **`app/api/webhooks/config/route.ts:20-27` GET returns configs for unauthenticated callers** (RLS-dependent only); **`campaigns/recipients` + `webhooks/deliveries` use `getSession()` not `getUser()`**; **cron route compares CRON_SECRET with plain `!==`**; **n8n route inserts into `webhook_events` table that no migration creates** (fails silently). *(Agent 15.)*
- **`webhook_events` table missing from migrations** — n8n ingest persistence is dead code. *(Agent 15.)*

---

# MEDIUM (P2) — Should fix

## Routes
- N8N_INTEGRATION.md GET health check "no auth" vs code requiring x-api-key (doc stale) — `01-routes.md`.
- API.md "no built-in rate limiting" false — code rate-limits 60/min (doc stale) — `01-routes.md`.
- API.md error table lists 500 where code returns 401 — `01-routes.md`.
- ARCHITECTURE §8 middleware description stale (cookie-presence, not getUser-based routing; protected list 15 vs 10 routes) — `01-routes.md`.
- 7 settings subroutes undocumented (`email, forecasts, invoice-templates, saved-views, services, sms, webhooks`) — `01-routes.md`.
- Entire invoices feature undocumented (feature 36 missing from catalog) — `01-routes.md`, `08-sales-tools.md`.
- Sitemap lists `/settings/*` and `/onboarding` which robots.ts disallows — contradictory crawl config — `01-routes.md`.
- Dashboard + onboarding lack segment `loading.tsx` (pattern inconsistency) — `01-routes.md`.
- OPTIONS handler hardcodes `Access-Control-Allow-Origin: *` while POST uses allowlist (`n8n/route.ts:325-333`) — `01-routes.md`, `15-docs-compliance.md`.

## Leads
- Submit button not disabled on invalid input (`LeadCreateForm.tsx:509-521`).
- `useLeadScoring` hook contract drift (documented `calculateScore`/`recalculateScores` vs actual `refresh`/`recalculate`).
- Double-fetch of same lead on detail page.
- Silent tag-load failure in LeadDetail.
- Console-only errors in `mergeLeads`/`batchUpdateScores`.
- Three divergent user sources (TeamContext vs empty USERS vs `profiles` table) → inconsistent assignment behavior.
- LeadTable "Sortable" claim not implemented; `sortLeads` unused.
- Duplicated empty states (page-level vs LeadTable internal — dead branch).
- URL-sync effect rewrites history on every filter change.
- `normalizePhone` doesn't handle country codes.

## Contacts / Companies
- Company detail double-fetch + duplicated loader logic.
- `modules/companies/companyFilters.ts` `searchCompanies` dead; documented `applyCompanyFilters` missing.
- Company merge leaves denormalized `contactIds`/`leadIds`.
- No tests for company logic/validators.
- Undocumented service features (`search`, `getRevenueEstimate` never called).

## Tasks / Meetings
- Missing tests for `taskUtils`/`meetingFilters`/`lib/task-utils`.
- Cascade activity deletes fire-and-forget console-only.
- Failed checkbox toggle mislabeled as load failure (full error screen instead of toast).
- `today` frozen at mount in MeetingCalendar.
- Rollback uses `prevItem!` + re-appends at tail (loses position; theoretical undefined insertion).
- `MeetingCard` dead component.
- Deprecated `TASK_PRIORITY_COLORS` duplicate.
- HOOKS.md/MODULES.md doc drift for tasks/meetings signatures.
- `in_progress` task status undocumented yet in type/constants.
- Overdue/`in_progress` tasks excluded from header counts.

## Communication
- `activityService.getByEntity` vs documented `getForEntity` naming (also SERVICES.md/HOOKS.md).
- Undocumented `pending`/`queued` email statuses (EmailHistory badge has no `queued` case).
- LeadDetail re-implements timeline inline instead of shared ActivityTimeline (already diverged).
- CallLog duration rounding: sub-minute calls show "1min" (also 0s → 1min).
- Email composer allows empty subject; service rejects (error only after submit).
- No `toAddress` format validation in service path.

## Sales Tools
- Goal progress manually entered, not derived from CRM data.
- `goalService.getProgress` doesn't clamp negatives (negative progress bar width).
- Campaign "sort order management" claim partial — grip icon only, no reorder control.
- Goals page imports `@/data/mock-users` directly (layer leak).
- Quote edit dialog bypasses status workflow (rejected→draft allowed).
- Invoice creatable from non-accepted quotes via direct URL.
- Optimistic quote create shows zero totals (flash).
- HOOKS.md/SERVICES.md stale vs sales-tools API (documented in full in `08-sales-tools.md`).
- `Mark as Paid` skips `sent` step.
- Invoice templates empty state unreachable.
- Forecast auto-calc no per-month error handling.

## Teams / Auth
- `store/auth.ts` diverges from ARCHITECTURE §6 (doc drift + vestigial store).
- `teamValidation.ts` documented module never imported; validation duplicated inline in 4+ components (already drifting).
- No unique constraint on `team_invitations(email)` — duplicate-error path dead.
- Teams update policy `created_by`-scoped not admin-scoped.
- `/deals` gated on entity="deal" but matrix has no deal column for agent/viewer — undocumented restriction.
- Onboarding step indicator mislabeled (5 labels for 6 steps).
- Invite-code modulo bias (moot until feature lands).
- `getCurrentTeam` doc says `Promise<Team|null>`, impl returns `undefined`.

## Settings
- CommandPalette missing "View all {entity} results" links.
- Saved Views "Apply" on settings page only shows a toast.
- Saved views not wired into deal/task/meeting pages (leads/contacts/companies only).
- `savedViewService.getViews` no `createdBy` filter (RLS-dependent).
- `findDuplicates` reports `score: threshold` not actual score — data-quality UI shows "25% match" for everything.
- Data-quality "Name" match reason flagged unconditionally.
- Outlook Calendar integration is a disabled "coming soon" button (doc claim unmet).
- Google integration is REAL OAuth while docs call it "mock" (understates).
- Theme store: no system-preference detection; next-themes not wired (toaster follows system).
- Webhook "Test" ping can't send bearer auth (secret stripped from list API).
- Portal `shareRecord` duplicate returns existing share, ignores permission changes.
- Portal share permission values `view/comment/edit` vs docs `read/write`; unenforced.
- Webhook service reads env config at module load (stale across reloads).

## Services / Hooks / Store
- `batchUpdateScores` is N+1 (2N+1 queries).
- Campaign recipients stuck in `processing` never recovered; batch sends sequential (500 awaits).
- `triggerWebhook` adds 2 DB round-trips per mutation when webhooks on.
- `realtime.getPendingNotifications` fallback broken (plural entity types vs singular stored values) + not user-scoped.
- Invoice/quote `update` allows null invoice_number; caller-supplied numbers unvalidated.
- `goalService.update` error contract differs (throws PGRST116 vs returning undefined).
- Auto-company creation in lead create not transactional (orphan company on partial failure).
- `webhook-config.service` stores/returns secrets in plaintext (vs api-key hash pattern).
- `integration.service` may appear connected without valid tokens (no verification).
- `portal.migrateExistingUsers` queries columns its own header says no longer exist (dead/legacy).
- `updateStatus` (invoice/quote) returns entity without line items → detail shows empty items.
- `findDuplicates` O(n²) substring matching (acceptable at mock scale).
- useQuotes/useInvoices subscribe whole entity-cache store (re-renders on any cache write).
- usePermissions no `useCallback` (8 new identities per render).
- useDeals no cache-freshness skip (inconsistent with siblings).
- useInView signature drift vs docs.
- useNotes requires `createdBy` not in documented NoteFormData.
- Communication hooks replaced documented `getForEntity` with constructor params (design drift).
- Widespread naming drift: `getByEntity`/`getEntityTags`/`dismissNotification`/`overdue`/`exportEntity` vs docs.
- 10 undocumented hooks (useBranding, useCampaignScheduler, usePresence, useRealtimeNotifications, useWorkflowEditor, + 5 secondary exports).
- Direct `fetch()` in hooks (useBranding, usePortal, useCampaignScheduler) bypasses service layer.
- Notification dedup keyed only on type+leadId (collapses legitimate repeats).
- `useTeamData` ineffective unmount guard; `useAttachments` uncontrolled setTimeout.
- TopBar sign-out wipes `nexuscrm-theme`/`nexuscrm-settings` — user prefs destroyed on logout.
- `entity-cache.ts` `clearStaleCache` weakly typed; `isLoading` survives clears.

## Data / Types / Lib
- `lib/utils.ts` documented utils not exported; `fuzzyNameMatch` substring-based.
- `findDuplicates` reports threshold as score.
- Duplicated `TASK_STATUSES`/`MEETING_TYPES` in services vs constants.
- Deprecated duplicate color maps in constants.ts vs color-tokens.ts.
- `formatDate`/`formatDateTime` no invalid-date guard ("Invalid Date" in lists).
- Union drift: `in_progress`, `video/in_person/other`, `pending/queued`, `refunded` undocumented; SCORING_FACTORS location moved; `TagWithEntity` removed.
- No tests for findDuplicates/formatters/validators (only 1 test file in repo).
- TYPES.md stale for 4 entity types (`ownerId`, `leadIds`, `winLossReason`, `campaign`/`deal` permissions, `inviteCode`).

## UI / Components
- Zero `React.memo` in components/common (StatusBadge, StatCard, TagBadge, EmptyState, ErrorState, PageHeader).
- ActivityTimeline documented props (`loading`, `emptyMessage`, filter) missing.
- ColumnCustomizer + useColumnManager duplicated merge/persist logic (double-persist same key).
- LeadTable inline empty state without CTA.
- Delete-confirmation via transient toast instead of ConfirmDialog (leads page).
- TopBar sign-out business logic inside component (duplicated with store/auth.ts).
- NotificationPanel dismiss button invisible to non-hover/keyboard/touch.
- ViewsDropdown icon-only buttons without aria-labels.
- TagInput autocomplete not exposed as listbox.
- ImportDialog unknown entity falls back to leads columns.
- OnboardingLayout division-by-zero when totalSteps===1.
- Sidebar + OnboardingLayout duplicate `/api/branding` fetch.

## Docs / Governance
- `tailwind.config.ts` listed as locked/existing but **does not exist** (Tailwind 4 CSS-config) — AGENTS.md/SETUP/ARCHITECTURE point at a nonexistent file.
- AGENTS.md "NEVER modify globals.css" conflicts with 27 custom tokens added (`globals.css:50-80`) — clarify rule.
- `webhooks/config` GET returns configs for unauthenticated callers.
- Portal auth routes lack CSRF (register also lacks rate limit — P0).
- CRON_SECRET compared with `!==` (not timing-safe).
- `webhook_events` insert into non-existent table (fails silently).
- FEATURES.md lists phantom components (LeadForm/LeadFilterBar/LeadBulkActions).
- SETUP.md/DATABASE.md claim data/ "populates the application" — false (dead code).
- "24 service modules" vs 29; "37 hooks" vs 38 files; "28 files" types vs 29.
- `requirements.txt` Python file in a Bun project (anomaly).
- `portal.service.ts:367` `crypto.randomUUID()` without import (fragile global).

---

# LOW (P3) — Nice to have

- `n8n/route.ts` GET health-check 401s omit `corsHeaders()`; OPTIONS hardcodes `*` — `01-routes.md`.
- `proxy.ts:83` matcher references nonexistent `api/public` (dead entry).
- `robots.ts:10` hardcodes `nexuscrm.com` domain vs env-derived sitemap.
- Login/signup lack segment `error.tsx` (root fallback covers).
- Deprecated `STATUS_COLORS`/`PRIORITY_COLORS` dead exports in constants.ts.
- `handleSuccess` no-op callbacks (leads/companies pages).
- Unreachable LeadTable internal empty state (dead branch).
- COMPONENTS.md stale props for LeadCreateForm/StatCard/StatusBadge/PageHeader/BulkActionBar/Button (`loading` prop).
- `isSupabaseConfigured()` dead helper (the natural fix point for C1).
- `.env` in working tree (gitignored) with real Supabase project URL — verify never committed.
- Meeting type/description/assignee not displayed in task list.
- `toISOString`/`truncate`/`pluralize` dead deprecated utils in formatters.
- Invoice preview number differs from service-generated number in quote mode.
- `console.error`+toast duplication in campaign stats fetch.
- `'tempId' in item` union discrimination with repeated `as` casts.
- DealTable `stageMap` rebuilt every render.
- WorkflowEditor pointless `transitionCount` alias.
- DealCreateForm NaN input edge case via `Math.max(0, Number(...))`.
- Kanban `sr-only` keyboard hint present when keyboard move unavailable.
- `@remixicon/react` in ui/ vs docs claiming `@tabler/icons-react` (both installed).
- Stale "USERS moved to data/mock-users.ts" comment in constants.ts.
- `publicApiRoutes` dead config in proxy.ts (no `/api/*` path matches protectedRoutes).
- Hardcoded `nexuscrm.com` fallback domain in sitemap/metadata.
- `data/invoices.ts` dead mock + duplicated `getNextInvoiceNumber` shadowing service.
- `data/mock-users.ts` dead file beyond imports (delete or populate).
- `webhook.service.ts` `resetWebhookGuard` no-op with stale comment.
- `communication.service.ts:285` `status='queued'` undocumented.
- `meeting.service.ts` extra types `video/in_person/other` (harmless superset).
- `createTeamWithAdmin` double-rolls-back.
- `formatSupabaseError` deprecated + duplicated in client.ts.

---

# Master Docs-vs-Implementation Mismatch Register (top items)

| # | Doc claim (source) | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | "Automatically uses mock data when Supabase is not configured" (SETUP:107; README:141; ARCH:9) | Zero-config run | Middleware+services throw without env vars; 14 `data/*.ts` files dead | **BROKEN (P0)** |
| 2 | Quick start `bun install && bun run dev` (README:9-12) | App runs | Requires Supabase env vars even for `/` | **BROKEN (P0)** |
| 3 | Real email "UI mock only" (PRD:87) | No SMTP/Gmail | Resend SDK + 4 email routes + Svix webhook | **CONFLICT (P1)** |
| 4 | Messaging "simulated only" (PRD:88) | No SMS | Twilio SDK + 3 SMS routes | **CONFLICT (P1)** |
| 5 | Auth "UI-level login simulation" (PRD:89) | No real auth | Real Supabase Auth + middleware | **CONFLICT (P1)** |
| 6 | "No automation workflows (future upgrade)" (PRD:92) | No automation | Full automation rules UI + service | **CONFLICT (P1)** |
| 7 | "No queues, workers, or cron jobs" (PRD:91) | No cron | vercel.json cron `*/5 * * * *` | **CONFLICT (P1)** |
| 8 | "The only external API is n8n" (API.md:7) | 1 route | 34 route files | **UNDOCUMENTED (P1)** |
| 9 | n8n GET health check "no auth" (N8N_INTEGRATION:410) | Open | x-api-key required (API.md agrees with code; SETUP curl 401s) | **CONFLICT (P1)** |
| 10 | CHANGELOG S2: all API routes use server client | 19 files converted | 5 routes + webhook-config.service still browser client | **BROKEN (P1)** |
| 11 | 28/32/33 tables (SCHEMA/ARCH/DATABASE/README/PROJECT_DESC) | — | 40 unique tables in migrations | **STALE (P1)** |
| 12 | `supabase.types.ts` "28 tables" (TYPES:803) | Full coverage | 35 typed; 7 core tables missing → unsafe casts | **PARTIAL (P1)** |
| 13 | 37 hooks (ARCH:277, HOOKS:3) | 37 | 38 files; 6 undocumented | **STALE (P1)** |
| 14 | "24 service files" (README:181, SETUP:305) | 24 | 29 services | **STALE (P2)** |
| 15 | data/ "populates the application" (DATABASE:312) | Mock feeds app | 13/14 data files dead code | **BROKEN (P2)** |
| 16 | FEATURES 35-feature catalog | Complete | ~10 feature areas undocumented (invoices, branding, realtime, scheduler, email/SMS settings, invoice templates, service-config) | **PARTIAL (P2)** |
| 17 | LeadForm/LeadFilterBar/LeadBulkActions (FEATURES:26-30) | Exist | Nonexistent | **MISSING (P2)** |
| 18 | `tailwind.config.ts` locked/existing (AGENTS §11.2) | File exists | No such file | **MISSING (P2)** |
| 19 | "NEVER modify globals.css" (AGENTS §11.5) | Unmodified | 27 custom tokens added (globals.css:50-80) | **CONFLICT (P2)** |
| 20 | "zero mock data in production code" (PROJECT_DESC:3) | No mock imports | `data/mock-users.ts` imported by 13 components | **CONFLICT (P1)** |
| 21 | "No deployed cron trigger" (PROJECT_DESC:76) | No cron | vercel.json cron defined | **CONFLICT (P1)** |
| 22 | CHANGELOG S9: portal rate limiting | Present | Absent | **BROKEN (P2)** |
| 23 | CHANGELOG P4: 20 loading.tsx | 20 | 14 exist | **STALE (P2)** |
| 24 | SETUP env table (5 vars) | Complete | Code uses 24 vars; `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_PORTAL_URL` undocumented | **PARTIAL (P1)** |
| 25 | ARCH §8 middleware `getUser()` routing | Session-gated | Cookie-presence routing (spoofable) | **PARTIAL (P0/P1)** |
| 26 | FEATURES §4 multi-currency | Currency-aware | `formatCurrency` hardcodes USD | **BROKEN (P1)** |
| 27 | FEATURES §7/8 full CRUD + reschedule | Edit/delete UI | Tasks: read+create+checkbox only; Meetings: create+read only | **BROKEN (P1)** |
| 28 | FEATURES §24 rule evaluation engine | Rules fire | Engine has zero callers | **MISSING (P0)** |
| 29 | FEATURES §27 portal sharing | Portal consumers | No portal UI exists | **PARTIAL (P1)** |
| 30 | FEATURES §28 configurable threshold | Configurable | Hardcoded 25/25/20 | **MISSING (P1)** |

Full registers per scope: `.tmp/audit/01-routes.md` … `.tmp/audit/15-docs-compliance.md`.

---

# Positive Observations (verified working — what NOT to break)

- **Primary CRUD hooks** (useLeads/useContacts/useCompanies/useTasks/useMeetings) implement the full ARCHITECTURE §7 optimistic pattern: temp-ID create with rollback, previous-state restore on update/delete failure, entity-cache writes, cache-freshness skip. Strongest layer in the app.
- **All documented entity routes + `[id]` detail routes exist** with `loading.tsx`/`error.tsx` siblings; thin `page.tsx`→`page-content.tsx` wrapper pattern is consistent; all 28 nav items resolve to real routes (no dead links).
- **n8n webhook receiver is genuinely hardened**: timing-safe Bearer compare, rate limit, payload cap, event whitelist, ISO timestamp validation, error-isolated persistence (`app/api/webhook/n8n/route.ts`).
- **Security hygiene is good**: zero hardcoded secrets repo-wide; `.env*` gitignored; service-role key server-only; CSRF on 12+ mutation routes; SSRF guards on all outbound-fetch paths; secret masking on list/create APIs; RLS enabled on most tables.
- **Lead scoring and duplicate detection are real logic** (weighted factors, fuzzy+normalized matching, survivor merge), not stubs.
- **Export/Import flows** (CSV escaping, RFC-4180 parser, field mapping, per-row errors) are complete — except the ExportDropdown click bug (C14).
- **UI state coverage is broadly strong**: pages consistently render loading skeletons, EmptyState with CTA, ErrorState with retry, success toasts, disabled submit buttons.
- **BulkActionBar** is a model 5-state component (processing disables all, confirm before delete, toasts).
- **Shadcn/Base-UI primitive layer is clean**: 27 files, consistent "base-nova" style matching README's `@base-ui/react` claim, no hand-added logic.
- **Team settings + PermissionGuard wiring** across 10+ pages; member removal protected against self/last-admin deletion; RLS admin-gating for member ops.
- **Real PDF generation** for invoices via `@react-pdf/renderer` (consistent with PRD mock-billing scope).
- **Meeting calendar is genuinely functional** (month/week toggle, navigation, today highlight, day sheet).
- **No XSS surface**: zero `dangerouslySetInnerHTML` on user input; note/email bodies rendered as text nodes.
- **Referential integrity of mock data holds** everywhere except deal stages; ids unique within arrays; monetary consistency verified arithmetically.

---

# Recommended Fix Order

1. **C1 (mock mode) or C1b (doc honesty)** — decide the product direction: frontend-first mock demo (restore mock branch + gate middleware) vs full-stack Supabase (rewrite all docs). This decision gates everything else.
2. **Security P0s:** C3 (portal register auth), C8 (RLS role scoping), C9 (cookie-presence auth), C16 (unscoped cascades), `/invoices` route protection.
3. **Data-corruption P0s:** C11 (overdue race), C7 (money math), C12/C13 (cache/rollback), C14 (dead export).
4. **Dead documented features:** C4 (automation engine), C6 (pipeline stats), C5 (email/SMS CHECK), C10 (workflow-states), C15 (delete account), C2 (empty USERS), invite codes.
5. **Doc alignment sweep** (register items 1-30) — regenerate reference docs from code or fix code to docs.

*End of report. Full per-scope evidence: `.tmp/audit/` (01–15).*
