# User Interface & Experience Flows

## NexusCRM — SaaS Dashboard UX Flows

---

### Global Layout Structure

```
┌──────────────────────────────────────────────────────┐
│                     Top Bar                           │
│  Logo  │  Search (Cmd+K)  │  Notifs  │  Profile      │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│  Sidebar │           Main Content Area               │
│          │                                           │
│  📊 Dash │   ┌─────────────────────────────────┐     │
│  👤 Leads│   │   Page Header + Actions          │     │
│  📇 Cont │   ├─────────────────────────────────┤     │
│  🏢 Co's │   │                                   │     │
│  📋 Pipe │   │   Content (Table / Grid / Form)   │     │
│  ✅ Tasks│   │                                   │     │
│  📅 Meet │   └─────────────────────────────────┘     │
│  ⚙️ Set  │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

**Responsive Behavior:**
- Desktop: Sidebar visible, full-width content
- Tablet: Collapsible sidebar (hamburger toggle)
- Mobile: Bottom navigation bar, full-width stacked content

---

### Flow 1: First-Time User Onboarding

```
1. User lands on "/" (Landing Page)
   ├── Hero section with "NexusCRM" branding
   ├── "Get Started" CTA button
   └── Feature highlights / screenshots

2. User clicks "Get Started"
   └── Redirected to "/login"
       ├── Email + Password fields (UI simulation)
       └── "Sign In" button

3. User clicks "Sign In"
   └── Redirected to "/dashboard"
       └── Welcome toast: "Welcome to NexusCRM!"
       └── Empty states with onboarding CTAs:
           ├── "Import your first lead"
           ├── "Create a contact"
           └── "View sample data"
```

---

### Flow 2: Lead Management (Core Flow)

#### 2a: Creating a Lead

```
1. Navigate to Sidebar → "Leads"
   └── URL: /leads
   └── Page shows:
       ├── Header: "Leads" + "+ New Lead" button
       ├── Filter bar: Status / Source / Priority dropdowns
       └── Lead table (or empty state)

2. Click "+ New Lead"
   └── Opens modal / drawer
   └── Form fields:
       ├── Full Name * (required)
       ├── Email
       ├── Phone
       ├── Company Name
       ├── Industry (dropdown)
       ├── Country / Region
       ├── Lead Source (dropdown: Manual, Website, Referral, Ads, Social)
       ├── Status (default: New)
       ├── Priority (dropdown: Low, Medium, High)
       ├── Estimated Value ($)
       ├── Tags (multi-select / type-and-enter)
       └── Notes (textarea)

3. User fills form, clicks "Save"
   └── Loading state on button
   └── Success: Toast "Lead created successfully"
       └── Redirect to /leads/{id} (lead detail page)
   └── Failure: Error toast + form stays open
```

#### 2b: Lead Detail View

```
URL: /leads/{id}

Layout (two-column):
┌──────────────────────┬─────────────────────────────┐
│   Profile Card        │   Activity Timeline         │
│   ┌─────────────┐    │                             │
│   │ Avatar/Name  │    │   [2 hours ago] Created     │
│   │ Company      │    │   [1 hour ago]  Status      │
│   │ Status Badge │    │                  changed    │
│   │ Priority     │    │   [30 min ago]  Meeting     │
│   │ Value: $5k   │    │                  scheduled  │
│   │ Assigned To  │    │                             │
│   │ Tags         │    │   ┌────────────────────┐    │
│   │ Edit Button  │    │   │ + Log Activity     │    │
│   └─────────────┘    │   └────────────────────┘    │
│                      │                             │
│   Quick Actions:      │   Tabs below timeline:      │
│   ┌──┐ ┌──┐ ┌──┐   │   ├── Notes                  │
│   │📧│ │📞│ │📅│   │   ├── Meetings               │
│   └──┘ └──┘ └──┘   │   ├── Tasks                  │
│   Email Call Meet    │   └── Communications         │
└──────────────────────┴─────────────────────────────┘
```

---

### Flow 3: Sales Pipeline (Kanban Board)

```
1. Navigate to Sidebar → "Pipeline"
   └── URL: /pipeline
   └── Horizontal Kanban board with columns:

     ┌──────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────┐  ┌────┐
     │ New  │  │Contacted │  │Qualified │  │Proposal│  │ Won│  │Lost│
     │      │  │          │  │          │  │        │  │    │  │    │
     │Lead A│  │ Lead B   │  │ Lead C   │  │ Lead D │  │    │  │    │
     │Lead E│  │          │  │          │  │        │  │    │  │    │
     │ 3    │  │  1       │  │  1       │  │  1     │  │ 0  │  │ 0  │
     │$15k  │  │  $5k     │  │  $10k    │  │  $8k   │  │ $0 │  │ $0 │
     └──────┘  └──────────┘  └──────────┘  └────────┘  └────┘  └────┘

2. Each column shows:
   ├── Column header (stage name)
   ├── Lead count badge
   ├── Total pipeline value for stage
   └── Lead cards (draggable)

3. Drag & Drop:
   └── User drags "Lead B" from "Contacted" → "Qualified"
       ├── Lead card shows drag state (elevated shadow)
       ├── Drop zone highlights
       └── On drop:
           ├── Optimistic UI update
           ├── Activity logged: "Status changed: Contacted → Qualified"
           └── Pipeline analytics recalculated

4. Clicking a lead card
   └── Opens lead detail drawer (slide-in panel)
       ├── Quick view of lead info
       ├── Actions: Edit, Change Status, Delete
       └── "View Full Profile" → navigates to /leads/{id}
```

---

### Flow 4: Contact Management

```
1. Navigate to Sidebar → "Contacts"
   └── URL: /contacts
   └── Table with columns: Name, Email, Phone, Company, Tags, Linked Leads

2. Click "+ New Contact"
   └── Opens modal with form
   └── After save → redirects to /contacts/{id}

3. Contact Profile Page (/contacts/{id})
   Layout:
   ┌────────────────┬──────────────────────────────┐
   │ Overview Card   │   Tab Panel                   │
   │ ┌────────────┐  │   ├── Leads (linked)         │
   │ │ Name, Title │  │   ├── Meetings              │
   │ │ Email, Phone│  │   ├── Tasks                 │
   │ │ Company     │  │   ├── Communications        │
   │ │ Tags        │  │   └── Notes                 │
   │ │ Edit        │  │                              │
   │ └────────────┘  │                              │
   └────────────────┴──────────────────────────────┘
```

---

### Flow 5: Meeting Scheduling

```
1. Navigate to Sidebar → "Meetings"
   └── URL: /meetings
   └── View toggle: Month / Week
   └── Calendar grid with meeting indicators

2. Click a date / "+ Schedule Meeting"
   └── Opens modal with form:
       ├── Title *
       ├── Date & Time *
       ├── Duration (15min / 30min / 60min)
       ├── Meeting Type (Online / Offline / Call)
       ├── Link to: Lead / Contact / Company (search & select)
       ├── Participants
       └── Notes

3. After save:
   ├── Calendar updates with new event
   ├── Activity logged on linked entity
   └── Toast confirmation
```

---

### Flow 6: Dashboard (Analytics Overview)

```
URL: /dashboard

Layout:
┌─────────────────────────────────────────────────────┐
│  Welcome back, {User}          Today: Jun 13, 2026  │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│Total     │Active    │Won Deals │Revenue   │Meetings │
│Leads     │Deals     │          │Forecast  │Today    │
│  147     │  23      │  12      │  $89k    │  3      │
├──────────┴──────────┴──────────┴──────────┴─────────┤
│                                                       │
│ ┌──────────────────┐  ┌────────────────────────┐    │
│ │ Pipeline Funnel   │  │ Monthly Performance    │    │
│ │ (Bar chart by     │  │ (Line chart: leads vs  │    │
│ │  stage)           │  │  conversions)          │    │
│ └──────────────────┘  └────────────────────────┘    │
│                                                       │
│ ┌──────────────────┐  ┌────────────────────────┐    │
│ │ Lead Sources      │  │ Tasks Due Today        │    │
│ │ (Pie/Donut chart) │  │ (List with checkboxes) │    │
│ └──────────────────┘  └────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

### Flow 7: Global Search (Cmd+K)

```
1. User presses Cmd+K (or clicks search bar)
   └── Command palette opens (centered modal overlay)
   └── Search input auto-focused

2. User types query (e.g., "John")
   └── Results grouped by entity type:
       ├── 👤 Leads (2 results)
       ├── 📇 Contacts (3 results)
       ├── 🏢 Companies (1 result)
       ├── ✅ Tasks (1 result)
       └── 📅 Meetings (0 results)

3. User navigates results with ↑↓ arrows
   ├── Press Enter → navigates to entity page
   ├── Press Esc → closes palette
   └── Click "View all {entity} results" → filters page
```

---

### Flow 8: Task Management

```
1. Navigate to Sidebar → "Tasks"
   └── URL: /tasks
   └── Filters: All / Pending / Completed / Overdue
   └── Sort by: Due date / Priority / Created date

2. Click "+ New Task"
   └── Quick-add inline or modal:
       ├── Title *
       ├── Description
       ├── Assign to
       ├── Due date
       ├── Priority (Low / Medium / High / Critical)
       └── Link to: Lead / Contact / Company

3. Task row actions:
   ├── Checkbox → toggle complete/incomplete
   ├── Click row → opens task detail drawer
   ├── Edit → inline edit or modal
   └── Delete → confirmation → remove

4. Overdue logic:
   ├── Due date < today + status != Completed
   └── Visual: Red badge "Overdue" + highlighted row
```

---

### Flow 9: Error & Edge Case Handling

#### Empty State (No Data)
```
┌────────────────────────────────────────────┐
│                                            │
│           ✨ No leads yet                    │
│     Import your first lead to get started   │
│                                            │
│        ┌─────────────────────┐             │
│        │  + Create Lead      │             │
│        └─────────────────────┘             │
│                                            │
└────────────────────────────────────────────┘
```

#### Loading State
```
┌────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ ████████ │  │ ████████ │  │ ████████ │ │
│  │ ████████ │  │ ████████ │  │ ████████ │ │
│  │ (skeleton)│  │ (skeleton)│  │ (skeleton)│ │
│  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────┘
```

#### Error State
```
Toast (top-right):
┌──────────────────────────────────┐
│ ❌ Failed to load leads.        │
│    [Retry]                       │
└──────────────────────────────────┘

Inline banner:
┌──────────────────────────────────┐
│ ⚠️ Something went wrong         │
│ We couldn't save your changes.  │
│ Please try again.  [Dismiss]    │
└──────────────────────────────────┘
```
