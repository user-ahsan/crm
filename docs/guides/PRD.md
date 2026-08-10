# Product Requirements Document (PRD)

## Project Name: NexusCRM — Unified Sales & Relationship Management System

---

### 1. Project Overview & Objective

- **What is it?** A fully interactive, SaaS-style CRM frontend that manages the complete sales lifecycle — from lead acquisition to deal closure. It simulates the experience of enterprise platforms like HubSpot and Pipedrive, entirely on the frontend.
- **The Problem:** Sales teams, freelancers, and agencies resort to fragmented tools (Excel + WhatsApp + Calendar + Notes) to manage customer relationships. There is no single source of truth for tracking leads, contacts, meetings, tasks, and deal progress.
- **The Solution:** NexusCRM unifies the entire sales workflow into one dashboard — Lead → Contact → Company → Deal → Meeting → Task → Outcome → Analytics — with a polished, production-grade UI.

### 2. Core User Personas & Target Audience

| Persona | Primary Goal |
|---------|-------------|
| **Sales Rep** | Track leads, move deals through pipeline, log activities, schedule follow-ups |
| **Sales Manager** | Monitor team performance, view pipeline analytics, forecast revenue |
| **Freelancer** | Manage client relationships, track proposals, log communications |
| **Agency Owner** | Organize contacts/companies, track multiple deals, schedule client meetings |
| **Startup Founder** | Centralize early customer data, track conversion funnel |

### 3. What You Are Building (In Scope)

#### 3.1 Lead Management System
- Create / Edit / Delete leads
- Lead status pipeline: New → Contacted → Qualified → Proposal → Won / Lost
- Assign leads to users
- Lead notes & activity timeline
- Lead filtering + search
- **This is the CORE of the CRM.**

#### 3.2 Contact Management System
- Add / Edit / Delete contacts (people)
- Link contacts to leads
- Contact profile page with activity history
- Tagging system
- Global contact search

#### 3.3 Company Management System
- Company profiles
- Link companies to leads & contacts
- Company dashboard with revenue estimation (mock)
- Company activity aggregation

#### 3.4 Sales Pipeline (Kanban Board)
- Drag & drop pipeline with stages: New → Contacted → Qualified → Proposal → Won → Lost
- Move leads between stages
- Stage-wise analytics (counts, values)

#### 3.5 Task Management System
- Create tasks assigned to leads/contacts/companies
- Due dates & priority levels
- Mark complete / incomplete
- Overdue detection (UI logic)

#### 3.6 Meeting & Scheduling System
- Schedule meetings linked to leads, contacts, or companies
- Calendar view (monthly/weekly)
- Meeting notes & history
- Rescheduling UI

#### 3.7 Activity Log System
- Per-entity timeline of actions (lead created, call logged, meeting scheduled, status changed)
- Filter by activity type

#### 3.8 Dashboard
- KPI cards: Total Leads, Active Deals, Won Deals, Revenue Estimate (mock)
- Charts: Pipeline funnel, Lead sources, Monthly performance

#### 3.9 Global Search System
- Cmd+K command palette search across Leads, Contacts, Companies, Tasks, Meetings

#### 3.10 UI System
- Full SaaS dashboard UI using shadcn/ui components
- Dark / light mode
- Responsive layout
- Sidebar navigation, detail drawers, modals

#### 3.11 Additional Implemented Features

Beyond the core CRM flows, the following features are fully implemented:

| # | Feature | Notes |
|---|---------|-------|
| 36 | **Invoices** | CRUD, PDF download, sequential INV-YYYY-NNNN numbering, line items, status workflow |
| 37 | **Branding** | White-label logo + color settings via API |
| 38 | **Realtime & Presence** | Supabase Realtime WebSocket channels + polling fallback |
| 39 | **Notifications** | Persistent notification records + in-app panel |
| 40 | **Service Config** | Per-service settings (Resend/Twilio/Google) persisted to DB |
| 41 | **Invoice Templates** | Customizable invoice templates with logos/colors/fields |
| 42 | **Real Email (Resend)** | Server-side email delivery via Resend API |
| 43 | **Real SMS (Twilio)** | Server-side SMS delivery via Twilio API |
| 44 | **Automation Engine** | 14 trigger events, 6 action types, condition evaluation |
| 45 | **Campaign Scheduler** | Multi-step email sequences with Vercel Cron processing |

---

### 4. What Is NOT In Scope (Out of Scope)

| Area | Status |
|------|--------|
| ~~Real backend server~~ | Superseded — real Supabase backend (PostgreSQL + Auth + Storage) |
| ~~Real email system~~ | Superseded — real Resend integration with server-side delivery |
| ~~Real messaging (SMS)~~ | Superseded — real Twilio integration with send/batch/test routes |
| ~~Real authentication~~ | Superseded — real Supabase Auth with session cookies + middleware |
| Real payment/billing | No Stripe or subscription system |
| ~~Enterprise cron jobs~~ | Superseded — Vercel Cron at `*/5 * * * *` for campaign processing |
| ~~AI / Automation~~ | Superseded — automation rule engine (14 triggers, 6 actions) + campaign scheduler |
| Mobile app | Web-only, no native mobile app |
| Customer portal frontend | Portal auth API exists; no portal user-facing UI yet |

---

### 5. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| **Tech Stack** | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| **State Management** | Zustand 5 (persisted stores) + React Context |
| **Data Layer** | Supabase (PostgreSQL) with in-memory mock fallback |
| **Auth** | Supabase Auth (real sessions with middleware) |
| **Email** | Resend API (server-side) |
| **SMS** | Twilio API (server-side) |
| **Deployment** | Vercel (fully static/deployable) |
| **Performance** | Lazy loading modules, optimized tables, memoized computations |
| **UX** | Responsive design, skeleton loading, empty/error/success states everywhere |
| **UI Quality** | Production-grade SaaS feel — every feature must survive real-world chaotic usage |

---

### 6. Simple Rule of This Project

> **You are building:** A fully interactive CRM frontend that behaves like real SaaS software.
>
> **You are NOT building:** A real backend-powered enterprise system.

Think of it as simulating a real company CRM where:
- ✅ Everything looks real
- ✅ Everything behaves real
- ✅ Data is mocked or lightweight
- ✅ Impresses like a $50k SaaS dashboard

---

### 7. Tech Stack Summary

```
Frontend:    Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
Backend:     Supabase (PostgreSQL + Auth + Storage + Realtime)
API Routes:  33 Next.js API routes (email, SMS, campaigns, webhooks, portal, branding, service-config, integrations)
Email:       Resend (server-side delivery)
SMS:         Twilio (server-side delivery)
Automation:  Rule engine (14 triggers, 6 actions) + Vercel Cron scheduler
Deployment:  Vercel (with cron jobs)
Auth:        Supabase Auth (real sessions, middleware-protected routes)
```

---

### 8. Key User Flows

| Flow | Path |
|------|------|
| **Lead Conversion** | Lead created → contacted → qualified → meeting → won |
| **Contact Engagement** | Contact created → linked to lead → meeting scheduled → communication logged |
| **Sales Pipeline** | Lead enters pipeline → stages updated → deal tracked → closed |
| **Task Execution** | Task created → assigned → due date → completed → logged |

---

### 9. Final Product Summary

This CRM is not just a dashboard. It is a **Complete Sales Operating System** covering:

- ✅ Lead lifecycle
- ✅ Contact intelligence
- ✅ Company mapping
- ✅ Meeting scheduling
- ✅ Task execution
- ✅ Activity tracking
- ✅ Sales analytics
