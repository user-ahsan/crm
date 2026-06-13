# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## CRM + SALES + CONTACT + SCHEDULING PLATFORM

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Name (Working)

**NexusCRM** – Unified Sales & Relationship Management System

### 1.2 Vision

To build a fully integrated CRM system that manages:

- Leads
- Contacts
- Companies
- Sales pipelines
- Meetings & scheduling
- Communication logs
- Activity tracking
- Sales analytics

The system acts as a single source of truth for all customer relationships.

### 1.3 Core Idea

Instead of fragmented tools (Excel + WhatsApp + Calendar + Notes), this system unifies:

> Lead → Contact → Deal → Meeting → Outcome → Analytics

### 1.4 Target Users

- Sales teams
- Freelancers
- Agencies
- Startups
- Customer support teams
- Business development teams

---

## 2. PRODUCT GOALS

### 2.1 Primary Goals

- Centralize customer data
- Track sales lifecycle
- Manage communication history
- Schedule meetings efficiently
- Improve conversion rates
- Provide analytics-driven insights

### 2.2 Secondary Goals

- Provide clean UI/UX like SaaS tools (HubSpot-like feel)
- Reduce manual tracking effort
- Provide automation-ready structure
- Support scalability for multi-user teams

### 2.3 Non-Goals

- No real payment processing
- No external email sending system required (optional mock only)
- No telephony integration (Twilio, etc.)
- No AI automation required (optional future extension)

---

## 3. CORE SYSTEM MODULES

### 3.1 LEAD MANAGEMENT SYSTEM

#### 3.1.1 Purpose

Track potential customers from entry → conversion.

#### 3.1.2 Lead Data Structure

Each lead contains:

| Field             | Type     |
|-------------------|----------|
| Lead ID           | UUID     |
| Full Name         | String   |
| Email             | String   |
| Phone Number      | String   |
| Company Name      | String   |
| Industry          | String   |
| Country / Region  | String   |
| Lead Source       | Enum     |
| Status            | Enum     |
| Priority          | Enum     |
| Assigned Sales Rep| User ID  |
| Estimated Value   | Number   |
| Tags              | String[] |
| Notes             | Text     |
| Created Date      | DateTime |
| Last Updated Date | DateTime |

**Lead Source enum:** Manual, Website, Referral, Ads, Social

**Status enum:** New, Contacted, Qualified, Converted, Lost

**Priority enum:** Low, Medium, High

#### 3.1.3 Lead Lifecycle Stages

```
New Lead → Contacted → Responded → Qualified → Proposal Sent → Negotiation → Won / Lost
```

#### 3.1.4 Features

- Create Lead
- Edit Lead
- Delete Lead
- Bulk Import Leads
- Search Leads
- Filter Leads (status, source, priority)
- Assign leads to users
- Add internal notes
- View lead timeline
- Change status with one click
- Lead activity tracking

#### 3.1.5 Lead Detail View

Each lead has a full profile:

- Contact info
- Communication history
- Meetings
- Notes
- Tasks
- Deal value progression

---

### 3.2 CONTACT MANAGEMENT SYSTEM

#### 3.2.1 Purpose

Store and manage real individuals associated with leads or companies.

#### 3.2.2 Contact Fields

| Field         | Type     |
|---------------|----------|
| Contact ID    | UUID     |
| Name          | String   |
| Email         | String   |
| Phone         | String   |
| Job Title     | String   |
| Company       | String   |
| Linked Leads   | Lead[]   |
| Location      | String   |
| Social Links  | String[] |
| Tags          | String[] |
| Notes         | Text     |

#### 3.2.3 Features

- Add/Edit/Delete contact
- Link contact to multiple leads
- Contact activity timeline
- Communication logs
- Contact search engine
- Contact grouping (by company or tags)

#### 3.2.4 Contact Profile Page

Includes:

- Overview card
- Associated leads
- Meeting history
- Task list
- Communication log
- Notes system

---

### 3.3 COMPANY MANAGEMENT SYSTEM

#### 3.3.1 Purpose

Organize leads and contacts under organizations.

#### 3.3.2 Company Fields

| Field         | Type     |
|---------------|----------|
| Company ID    | UUID     |
| Company Name  | String   |
| Industry      | String   |
| Size          | String   |
| Revenue       | Number   |
| Location      | String   |
| Website       | String   |
| Linked Contacts | Contact[] |
| Linked Leads  | Lead[]   |

#### 3.3.3 Features

- Company directory
- Company profile page
- Associated contacts view
- Associated leads view
- Revenue estimation tracking

---

### 3.4 SALES PIPELINE SYSTEM (KANBAN)

#### 3.4.1 Purpose

Visualize deals moving through stages.

#### 3.4.2 Pipeline Stages

| Stage          | Description          |
|----------------|----------------------|
| New            | Fresh lead           |
| Contacted      | Initial outreach done|
| Qualified      | Validated interest   |
| Proposal Sent  | Quote/proposal sent  |
| Negotiation    | Terms being discussed|
| Won            | Deal closed          |
| Lost           | Deal lost            |

#### 3.4.3 Features

- Drag and drop leads between stages
- Stage-wise analytics
- Pipeline value calculation
- Win/loss ratio tracking
- Deal aging indicator

---

### 3.5 TASK & ACTIVITY MANAGEMENT

#### 3.5.1 Purpose

Track all follow-ups and internal actions.

#### 3.5.2 Task Fields

| Field              | Type       |
|--------------------|------------|
| Task ID            | UUID       |
| Title              | String     |
| Description        | Text       |
| Related Lead/Contact/Company | UUID |
| Assigned User      | User ID    |
| Due Date           | DateTime   |
| Priority           | Enum       |
| Status             | Enum       |

**Status enum:** Pending, Completed, Overdue

**Priority enum:** Low, Medium, High, Critical

#### 3.5.3 Features

- Create tasks from leads
- Task reminders (UI only or simulated)
- Task calendar view
- Task filters
- Task completion tracking

#### 3.5.4 Activity Log System

Every entity tracks activity:

- Lead created
- Email logged
- Call logged
- Meeting scheduled
- Status updated
- Note added

---

### 3.6 MEETING & SCHEDULING SYSTEM

#### 3.6.1 Purpose

Manage all meetings between team and clients.

#### 3.6.2 Meeting Fields

| Field          | Type               |
|----------------|--------------------|
| Meeting ID     | UUID               |
| Title          | String             |
| Participants   | Contact[]/User[]   |
| Linked Lead/Company | UUID         |
| Date & Time    | DateTime           |
| Duration       | Number (minutes)   |
| Meeting Type   | Enum               |
| Notes          | Text               |
| Outcome        | Text               |

**Meeting Type enum:** Online, Offline, Call

#### 3.6.3 Features

- Schedule meeting
- Calendar view (monthly/weekly)
- Meeting reminders (UI simulated)
- Meeting history per lead
- Reschedule meetings
- Meeting notes system

---

### 3.7 COMMUNICATION LOG SYSTEM

#### 3.7.1 Purpose

Track all interactions.

#### 3.7.2 Types of Communication

| Type             | Description                        |
|------------------|------------------------------------|
| Email (mock)     | Log sent/received emails           |
| Call log         | Record phone conversations         |
| WhatsApp note    | Log WhatsApp interactions (mock)   |
| Meeting notes    | Attach notes to scheduled meetings |
| Internal notes   | Free-form team notes               |

#### 3.7.3 Features

- Log communication manually
- Attach communication to lead/contact
- Timeline view
- Filter by communication type

---

### 3.8 DASHBOARD SYSTEM

#### 3.8.1 Overview Metrics

| Metric              | Description                      |
|---------------------|----------------------------------|
| Total Leads         | Count of all leads in system     |
| Active Deals        | Leads in open pipeline stages    |
| Conversion Rate     | Won / (Won + Lost) percentage   |
| Revenue Forecast    | Sum of estimated deal values     |
| Meetings Scheduled  | Upcoming meetings count          |
| Tasks Due Today     | Overdue and due-today tasks      |

#### 3.8.2 Charts

- Lead funnel visualization
- Monthly performance
- Sales pipeline distribution
- Source analytics

---

### 3.9 SEARCH SYSTEM

**Global Search Includes:**

- Leads
- Contacts
- Companies
- Tasks
- Meetings

**Features:**

- Instant search
- Command palette style UI
- Keyboard shortcuts

---

### 3.10 SETTINGS SYSTEM

- Profile settings
- Team roles (mock)
- Notification settings (UI only)
- Theme settings
- Data preferences

---

## 4. SYSTEM-WIDE REQUIREMENTS

### 4.1 Performance

- Fast UI rendering
- Lazy loading modules
- Optimized tables
- Virtualized lists (if needed)

### 4.2 UX Requirements

- Fully responsive design
- Dark mode support
- Loading skeletons everywhere
- Empty states everywhere
- Error states everywhere
- Inline feedback on actions

### 4.3 Data Requirements

System must support relationships between entities:

- Lead → Contact mapping (many-to-many)
- Contact → Company mapping (many-to-one)
- Meeting → Lead mapping (many-to-one)
- Task → Any entity mapping (polymorphic)

### 4.4 Navigation Requirements

- Sidebar navigation
- Breadcrumb system
- Quick access panels
- Contextual actions

---

## 5. DATA ENTITIES (CORE MODEL)

| Entity    | Description                     |
|-----------|---------------------------------|
| Lead      | Primary CRM entity              |
| Contact   | Person-level entity             |
| Company   | Organization-level entity       |
| Task      | Action entity                   |
| Meeting   | Scheduling entity               |
| Activity  | Event log entity                |

---

## 6. KEY USER FLOWS

### Flow 1: Lead Conversion

> Lead created → contacted → qualified → meeting → won

### Flow 2: Contact Engagement

> Contact created → linked to lead → meeting scheduled → communication logged

### Flow 3: Sales Pipeline

> Lead enters pipeline → stages updated → deal tracked → closed

### Flow 4: Task Execution

> Task created → assigned → due date → completed → logged

---

## 7. FUTURE EXTENSIONS

- Email automation
- AI lead scoring
- WhatsApp integration
- CRM analytics AI insights
- Multi-tenant SaaS system
- Payment integration

---

## 8. FINAL PRODUCT SUMMARY

This CRM is not just a dashboard.

It is a **Complete Sales Operating System** covering:

- ✅ Lead lifecycle
- ✅ Contact intelligence
- ✅ Company mapping
- ✅ Meeting scheduling
- ✅ Task execution
- ✅ Activity tracking
- ✅ Sales analytics
