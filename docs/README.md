# NexusCRM — Sales & Relationship Management

A frontend-first, production-grade SaaS CRM built with Next.js 16. NexusCRM simulates the experience of enterprise platforms like HubSpot and Pipedrive — entirely on the frontend, with optional Supabase backend support.

> **Tagline:** A frontend-first, production-grade SaaS CRM built with Next.js 16

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui powered by @base-ui/react |
| **Icons** | @tabler/icons-react |
| **State Management** | Zustand 5 (persisted stores) |
| **Data** | Local mock data (in-memory arrays) |
| **Database (optional)** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (session simulation) |
| **Package Manager** | Bun |
| **Deployment** | Vercel |

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│                     UI LAYER                           │
│           app/ (routes) + components/ (UI)             │
│                        │                               │
│                        ▼                               │
│              HOOKS LAYER (hooks/)                      │
│        State management, data fetching, caching        │
│                        │                               │
│                        ▼                               │
│            MODULES LAYER (modules/)                    │
│        Business logic, validation, data transforms     │
│                        │                               │
│                        ▼                               │
│            SERVICES LAYER (services/)                  │
│        Data mutation — create, update, delete          │
│                        │                               │
│                        ▼                               │
│              DATA LAYER (data/)                        │
│        Mock database + optional Supabase backend       │
└───────────────────────────────────────────────────────┘
```

**Data flow is strictly enforced:** `UI → Hook → Module → Service → Data`

No layer skipping is allowed. See [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md) for detailed documentation.

---

## Quick Start

### Prerequisites

- **Bun** (package manager) — [install bun](https://bun.sh)
- **Node.js** 20+
- **Supabase CLI** (optional, for local database) — `bunx supabase init`

### Installation

```bash
# Clone and install dependencies
cd nexus-crm
bun install

# Copy environment file
cp .env.example .env.local

# Start the development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Setup

```env
# Required for Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for n8n Webhook integration (optional)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/nexuscrm
N8N_WEBHOOK_SECRET=your-webhook-secret
```

---

## Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Lead Management** | Full CRUD, pipeline status, scoring, filtering, search, detail with 10 tabs |
| 2 | **Contact Management** | CRUD, company linking, lead linking, tag system, bulk actions |
| 3 | **Company Management** | CRUD, revenue estimation, contact/lead linking |
| 4 | **Deal Management** | Full CRUD, kanban board, pipeline stages, multiple currencies, detail with communications |
| 5 | **Sales Pipeline** | Drag-and-drop kanban, swimlane grouping, stage analytics |
| 6 | **Workflow Builder** | Custom states + transitions per entity (lead/deal/task) |
| 7 | **Task Management** | Full CRUD, priority system, overdue detection, entity linking |
| 8 | **Meeting Management** | Full CRUD, calendar view (month/week), type system, duration presets |
| 9 | **Notes** | Polymorphic notes on any entity, Markdown support, edit tracking |
| 10 | **Email** | Compose, send, draft, history, direction tracking |
| 11 | **SMS** | Compose, send, history, delivery status tracking |
| 12 | **Call Logs** | Direction (inbound/outbound), result tracking, duration |
| 13 | **Activity Timeline** | Per-entity chronological activity log |
| 14 | **Quotes** | Line-item editor, status workflow, discounts |
| 15 | **Goals** | Type system (revenue/deals/leads/tasks/calls), period tracking, progress bars |
| 16 | **Forecasts** | Monthly/yearly targets vs actuals, auto-calculation from won deals |
| 17 | **Campaigns** | Email sequences, multi-step campaigns, status management |
| 18 | **Dashboard** | KPI cards, pipeline funnel, lead sources, monthly trends, tasks due today |
| 19 | **Analytics** | Pipeline funnel (by count/value), source breakdown, status distribution |
| 20 | **Teams** | Multi-user teams, role-based permissions (admin/manager/agent/viewer) |
| 21 | **Permission System** | Granular CRUD permissions per entity, scope-based (own/team/all) |
| 22 | **Theme** | Dark/light mode, localStorage persistence |
| 23 | **Saved Views** | Per-entity filter presets, 6 entity types |
| 24 | **Automation Rules** | 14 trigger events, condition system, 6 action types |
| 25 | **API Keys** | Scope-based (read/write/admin), key generation |
| 26 | **Integrations** | Calendar (Google/Outlook), mock OAuth flow |
| 27 | **Customer Portal** | External user management, record sharing with permissions |
| 28 | **Data Quality** | Duplicate detection across leads/contacts/companies, merge with survivor selection |
| 29 | **Tag Management** | Color-coded tags, usage tracking, polymorphic tagging |
| 30 | **Onboarding Wizard** | 6-step onboarding, team creation, invite code generation |
| 31 | **Global Search** | Cmd+K command palette, cross-entity search |
| 32 | **Notifications** | In-app notification panel, type-specific icons |
| 33 | **CSV Import/Export** | Column-mapped import with preview, configurable export |
| 34 | **Bulk Actions** | Select + bulk delete/update/assign/tag/export |
| 35 | **n8n Webhook Integration** | 15 event types, real-time event streaming, Bearer auth |

---

## Project Context

NexusCRM is a **frontend-only CRM mock** with optional Supabase backend. All business logic, data persistence, and state management live on the client side. The application is fully deployable on Vercel with zero server management.

```
Everything looks real ✓
Everything behaves real ✓
Data is mocked or lightweight ✓
Impresses like a $50k SaaS dashboard ✓
```

See [guides/PRD.md](./guides/PRD.md) for the complete product requirements document.

---

## Documentation Map

### 🚀 Getting Started
| Document | Purpose |
|----------|---------|
| [guides/SETUP.md](./guides/SETUP.md) | Environment setup, Supabase, n8n, deployment |
| [guides/PRD.md](./guides/PRD.md) | Product requirements and scope |
| [guides/USER_FLOW.md](./guides/USER_FLOW.md) | User experience and interface flows |

### 🏗️ Architecture & Design
| Document | Purpose |
|----------|---------|
| [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md) | System architecture, data flow, directory structure |
| [architecture/DATABASE.md](./architecture/DATABASE.md) | Database schema, ERD, 33 tables, migrations |

### 📋 Feature Documentation
| Document | Purpose |
|----------|---------|
| [features/FEATURES.md](./features/FEATURES.md) | Complete feature catalog with 35 feature sections |
| [features/N8N_INTEGRATION.md](./features/N8N_INTEGRATION.md) | n8n webhook integration guide |

### 📚 Technical Reference
| Document | Purpose |
|----------|---------|
| [reference/TYPES.md](./reference/TYPES.md) | Type system reference, all 28 type definition files |
| [reference/HOOKS.md](./reference/HOOKS.md) | Custom hooks reference, all 37 hooks |
| [reference/SERVICES.md](./reference/SERVICES.md) | Service layer reference, all 24 service modules |
| [reference/MODULES.md](./reference/MODULES.md) | Business logic module reference, all 12 modules |
| [reference/API.md](./reference/API.md) | n8n webhook API reference, event catalog, payload schemas |
| [reference/COMPONENTS.md](./reference/COMPONENTS.md) | UI component catalog, props interfaces |

### ⚙️ Governance
| Document | Purpose |
|----------|---------|
| [governance/AGENTS.md](./governance/AGENTS.md) | Agent governance and code quality rules |

---

## Development Scripts

```bash
bun run dev       # Start development server
bun run build     # Production build
bun run start     # Start production server
bun run lint      # Run ESLint
bunx tsc --noEmit # TypeScript type check
```

---

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Or connect your GitHub repository to Vercel for automatic deployments. Set environment variables in Vercel Project Settings → Environment Variables.

---

## License

Private — Internal project.
