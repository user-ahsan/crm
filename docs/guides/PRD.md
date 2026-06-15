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

---

### 4. What Is NOT In Scope (Out of Scope)

| Area | Reason |
|------|--------|
| **Real backend server** | No Express/NestJS; data is local state or lightweight Supabase |
| **Real email system** | No SMTP, Gmail API, or email automation — UI mock only |
| **Real messaging (WhatsApp, SMS, Chat)** | Activity logs only (simulated) |
| **Real authentication** | No JWT backend or role enforcement — UI-level login simulation |
| **Real payment/billing** | No Stripe or subscription system |
| **Enterprise infrastructure** | No multi-tenancy, microservices, queues, workers, or cron jobs |
| **AI / Automation** | No AI scoring, predictive analytics, or automation workflows (future upgrade) |

---

### 5. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| **Tech Stack** | Next.js (App Router), React 18+, TypeScript, Tailwind CSS, shadcn/ui |
| **State Management** | Local state + React hooks + optional lightweight store |
| **Data Layer** | Local mock data (JSON/TS files) + optional Supabase |
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
Frontend:    Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
Data:        Local mock data (JSON/TS) + optional Supabase (light)
Deployment:  Vercel
Auth:        UI simulation only
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
