# Setup & Configuration Guide

## NexusCRM — Environment, Database, Tooling

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Variable Reference

```env
# ── Supabase Configuration ─────────────────────────────────────
# Required for Supabase integration (optional — app works without it).
# Get these from your Supabase project → Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Service role key — NEVER commit this. Keep in .env.local only.
# Used for admin-level operations.
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ── n8n Webhook Configuration ──────────────────────────────────
# Required for n8n integration (optional — app works without it).
# N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/nexuscrm
# N8N_WEBHOOK_SECRET=your-webhook-secret
```

### Available Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | — | Supabase anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Service role key (server-only) |
| `N8N_WEBHOOK_URL` | No | — | n8n webhook endpoint URL |
| `N8N_WEBHOOK_SECRET` | No | — | Shared secret for webhook auth |

---

## Supabase Setup

### Option 1: Local Supabase (Development)

```bash
# Install Supabase CLI
bunx supabase init

# Start local Supabase
bunx supabase start

# Run migrations
bunx supabase migration up

# Get local credentials for .env.local
bunx supabase status
```

### Option 2: Remote Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API → copy URL and anon key
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
4. Run migrations:

```bash
# Link your local project to remote
bunx supabase link --project-ref your-project-ref

# Push migrations
bunx supabase db push
```

### Migrations

Migrations are in `supabase/migrations/`. They create tables incrementally:

| Migration | Contents |
|-----------|----------|
| `001_initial.sql` | Core entities (leads, contacts, companies, tasks, meetings, activities) |
| `002_teams.sql` | Teams, team_members, team_invitations |
| `003_deals.sql` | Deals, deal_stages |
| `004_communication.sql` | email_history, call_logs, notes, sms_logs |
| `005_sales_tools.sql` | Quotes, quote_items, forecasts, goals |
| `006_automation.sql` | Automation_rules, workflow_states, workflow_transitions |
| `007_extensions.sql` | api_keys, saved_views, calendar_integrations, portal_users, portal_shares, tags, taggings, file_attachments, lead_scores, email_sequences, campaign_emails |

### Seed Data

The `data/` directory contains mock data that populates the application:

```typescript
// data/leads.ts — 20+ sample leads
// data/contacts.ts — 15+ sample contacts
// data/companies.ts — 10+ sample companies
// data/tasks.ts — 20+ sample tasks
// data/meetings.ts — 10+ sample meetings
// data/teams.ts — Default team with members
```

The application automatically uses mock data when Supabase is not configured.

---

## n8n Integration Setup

### Step 1: Configure Environment

```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/nexuscrm
N8N_WEBHOOK_SECRET=your-secure-random-secret-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### Step 2: Create n8n Webhook Node

1. Open your n8n instance
2. Create a new workflow
3. Add a **Webhook** node as the trigger
4. Configure:

| Setting | Value |
|---------|-------|
| **HTTP Method** | `POST` |
| **Path** | `/nexuscrm` |
| **Response Mode** | `Last Node` |
| **Options → Respond** | `JSON` |

5. Under **Add Header**: Name=`Authorization`, Value=`Bearer {{N8N_WEBHOOK_SECRET}}`
6. Save the workflow, copy the webhook URL

### Step 3: Activate Workflow

Toggle the workflow from **Inactive** to **Active**.

### Step 4: Verify

```bash
curl https://your-crm.com/api/webhook/n8n
# Response: { "status": "ok", "version": "1.0.0", ... }
```

See [API.md](../reference/API.md) for full API reference and [N8N_INTEGRATION.md](../features/N8N_INTEGRATION.md) for detailed integration guide.

---

## shadcn/ui Component Management

All shadcn/ui components are installed via CLI. DO NOT create or edit them manually.

### Installation Commands

```bash
# List available components
bunx shadcn@latest add --list

# Install a specific component
bunx shadcn@latest add button
bunx shadcn@latest add dialog
bunx shadcn@latest add table
bunx shadcn@latest add card
bunx shadcn@latest add input
bunx shadcn@latest add select
bunx shadcn@latest add toast
bunx shadcn@latest add skeleton
bunx shadcn@latest add dropdown-menu
bunx shadcn@latest add tabs
bunx shadcn@latest add badge
bunx shadcn@latest add avatar
```

### Installed Components (27 primitives)

| Component | File | Purpose |
|-----------|------|---------|
| alert-dialog | `components/ui/alert-dialog.tsx` | Confirmation dialogs |
| avatar | `components/ui/avatar.tsx` | User profile images |
| badge | `components/ui/badge.tsx` | Status/role indicators |
| button | `components/ui/button.tsx` | Action buttons |
| card | `components/ui/card.tsx` | Content containers |
| checkbox | `components/ui/checkbox.tsx` | Selection controls |
| collapsible | `components/ui/collapsible.tsx` | Expandable sections |
| command | `components/ui/command.tsx` | Command palette |
| dialog | `components/ui/dialog.tsx` | Modal dialogs |
| dropdown-menu | `components/ui/dropdown-menu.tsx` | Context menus |
| hover-card | `components/ui/hover-card.tsx` | Hover tooltips |
| input | `components/ui/input.tsx` | Text inputs |
| input-group | `components/ui/input-group.tsx` | Grouped inputs |
| label | `components/ui/label.tsx` | Form labels |
| popover | `components/ui/popover.tsx` | Floating panels |
| progress | `components/ui/progress.tsx` | Progress bars |
| scroll-area | `components/ui/scroll-area.tsx` | Scrollable regions |
| select | `components/ui/select.tsx` | Dropdown selects |
| separator | `components/ui/separator.tsx` | Dividers |
| sheet | `components/ui/sheet.tsx` | Slide-in panels |
| skeleton | `components/ui/skeleton.tsx` | Loading states |
| sonner | `components/ui/sonner.tsx` | Toast notifications |
| switch | `components/ui/switch.tsx` | Toggle controls |
| table | `components/ui/table.tsx` | Data tables |
| tabs | `components/ui/tabs.tsx` | Tab panels |
| textarea | `components/ui/textarea.tsx` | Multi-line inputs |
| tooltip | `components/ui/tooltip.tsx` | Help tooltips |

### Config Files (DO NOT EDIT)

| File | Purpose |
|------|---------|
| `components.json` | shadcn CLI configuration |
| `tailwind.config.ts` | Tailwind theme + shadcn variables |
| `postcss.config.mjs` | PostCSS setup |
| `tsconfig.json` | TypeScript strict mode |

---

## Development Commands

```bash
# Start development server
bun run dev

# Production build
bun run build

# Start production server
bun run start

# Run ESLint
bun run lint

# TypeScript type check
bunx tsc --noEmit

# Install a dependency
bun install <package-name>

# Install a dev dependency
bun install -D <dev-package>
```

### Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Development server with HMR |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Run ESLint checks |

---

## Deployment to Vercel

### Automatic Deployment

1. Push your repository to GitHub/GitLab
2. Import the project in [Vercel](https://vercel.com)
3. Vercel auto-detects Next.js
4. Add environment variables in Project Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

### Manual Deployment

```bash
# Install Vercel CLI
npx vercel

# Deploy to production
npx vercel --prod
```

### Build Configuration

- **Framework Preset:** Next.js
- **Build Command:** `next build` (auto-detected)
- **Output Directory:** `.next` (auto-detected)
- **Node Version:** 20.x+

### Environment-Specific Builds

The app runs entirely on the frontend — no server required. Optional Supabase integration adds backend capabilities. Vercel deployment requires no additional configuration.

---

## Project File Structure

```
crm-system/              # → 20 route directories
├── app/                 # → 14 component directories
├── components/          # → 24 service files
├── services/            # → 10 module directories
├── modules/             # → 37 hook files
├── hooks/               # → 28 type files
├── types/               # → 12 data files
├── data/                # → 4 store files
├── store/               # → 7 lib files
├── lib/                 # → 1 context
├── context/             # → Migration files
└── supabase/migrations/ # → Migration files
```
