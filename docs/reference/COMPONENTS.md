# UI Component Catalog

## NexusCRM — Complete Component Hierarchy

---

This document catalogs every UI component in the `components/` directory: 27 shadcn UI primitives, 24 common/shared components, and feature-specific components organized by domain.

---

## 1. shadcn UI Primitives (27)

Located at `components/ui/`. These are CLI-generated and MUST NOT be manually edited.

| Component | Props Interface | Key Props | Usage |
|-----------|----------------|-----------|-------|
| **alert-dialog** | `AlertDialogProps` | `open`, `onOpenChange` | Confirmation modals for destructive actions |
| **avatar** | `AvatarProps` | `src`, `alt`, `fallback` | User profile images in team list, sidebar |
| **badge** | `BadgeProps` | `variant` (default/secondary/destructive/outline) | Status indicators, role badges |
| **button** | `ButtonProps` | `variant`, `size`, `disabled`, `loading` | All clickable actions |
| **card** | `CardProps` | (children) | Content containers, stat cards, info panels |
| **checkbox** | `CheckboxProps` | `checked`, `onCheckedChange` | Row selection, task completion |
| **collapsible** | `CollapsibleProps` | `open`, `onOpenChange` | Expandable sidebar sections |
| **command** | `CommandProps` | (children) | Command palette search (cmdk-based) |
| **dialog** | `DialogProps` | `open`, `onOpenChange` | Create/edit form modals |
| **dropdown-menu** | `DropdownMenuProps` | (children) | Actions menus, bulk operations |
| **hover-card** | `HoverCardProps` | (children) | Quick preview on hover |
| **input** | `InputProps` | `type`, `placeholder`, `value` | Form text inputs |
| **input-group** | `InputGroupProps` | (children) | Grouped input layouts |
| **label** | `LabelProps` | `htmlFor` | Form field labels |
| **popover** | `PopoverProps` | `open`, `onOpenChange` | Filter dropdowns, date pickers |
| **progress** | `ProgressProps` | `value` (0-100) | Goal progress bars, lead scoring |
| **scroll-area** | `ScrollAreaProps` | `className` | Scrollable content panels |
| **select** | `SelectProps` | `value`, `onValueChange` | Dropdown selects (status, priority, source) |
| **separator** | `SeparatorProps` | `orientation` | Visual dividers |
| **sheet** | `SheetProps` | `open`, `onOpenChange` | Slide-in detail panels, create/edit drawers |
| **skeleton** | `SkeletonProps` | `className` | Loading placeholders for all components |
| **sonner** | (sonner library) | `toast()` | Toast notifications (success, error, info) |
| **switch** | `SwitchProps` | `checked`, `onCheckedChange` | Toggle controls (settings) |
| **table** | `TableProps` | (children) | Data tables for all entities |
| **tabs** | `TabsProps` | `value`, `onValueChange` | Tab panels in detail views |
| **textarea** | `TextareaProps` | `value`, `onChange` | Multi-line text inputs |
| **tooltip** | `TooltipProps` | `content` | Hover help text |

---

## 2. Common Components (24)

Located at `components/common/`. These are reusable shared components used across all pages.

### `AppShell.tsx`

**Purpose:** Main application layout wrapper.

```typescript
interface AppShellProps {
  children: React.ReactNode;
}
```

**Structure:**
```
AppShell
├── Sidebar (left, collapsible)
├── TopBar (top, fixed)
└── Main Content (scrollable)
```

**States:** Always rendered (static layout shell)

---

### `Sidebar.tsx`

**Purpose:** Left-hand navigation sidebar.

**Props:** (uses context — no direct props)

**Features:**
- 20+ navigation items from `lib/constants.ts`
- Active route highlighting
- Section grouping
- Collapsible on tablet/mobile
- User avatar and role display at bottom

**States:** Loading (skeleton items), Static (no interactivity needed)

---

### `TopBar.tsx`

**Purpose:** Top navigation bar with search, notifications, theme, profile.

**Props:** (uses context — no direct props)

**Sections:**
- Left: Search bar → CommandPalette
- Right: Notifications → NotificationPanel, Theme toggle, Profile menu

---

### `PageHeader.tsx`

**Purpose:** Page title with action buttons.

```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;  // Action buttons
  breadcrumbs?: Breadcrumb[];
}
```

**States:** Normal display only (static)

---

### `CommandPalette.tsx`

**Purpose:** Cmd+K global search overlay.

```typescript
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Features:**
- Cross-entity search (leads, contacts, companies, tasks, meetings)
- Keyboard navigation (arrow keys + Enter)
- Results grouped by entity type
- Debounced input
- "View all" links per entity

**States:** Open/Closed, Searching (loading spinner inside), Results (grouped), Empty (no results)

---

### `ActivityTimeline.tsx`

**Purpose:** Chronological activity feed for any entity.

```typescript
interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
  emptyMessage?: string;
}
```

**Features:**
- Type-specific icons (created, status_changed, meeting_scheduled, etc.)
- Relative timestamps
- Metadata display (old/new values)
- Filter by activity type

**States:** Loading (skeleton), Empty ("No activity yet"), Populated (list), Error

---

### `EmptyState.tsx`

**Purpose:** Empty state display with CTA.

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

**Usage:** Shown when an entity list has no records.

---

### `ErrorState.tsx`

**Purpose:** Error display with retry.

```typescript
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}
```

**States:** Error message + optional retry button

---

### `LoadingSkeleton.tsx`

**Purpose:** Loading placeholder.

```typescript
interface LoadingSkeletonProps {
  type: 'table' | 'card' | 'detail' | 'list' | 'kanban';
  count?: number;
}
```

**Variants:** Table rows, stat cards, detail page, list items, kanban cards

---

### `BulkActionBar.tsx`

**Purpose:** Floating toolbar for bulk row actions.

```typescript
interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onUpdate?: () => void;
  onAssign?: () => void;
  onTag?: () => void;
  onExport?: () => void;
  onClear: () => void;
}
```

**Features:**
- Shows when rows are selected
- Count display ("3 selected")
- Action buttons (delete, update, assign, tag, export)
- Clear selection button

**States:** Hidden (0 selected), Visible (1+ selected)

---

### `ConfirmDialog.tsx`

**Purpose:** Confirmation dialog for destructive actions.

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  loading?: boolean;
}
```

**States:** Open, Submitting (loading spinner on confirm), Error (inline error)

---

### `NotificationPanel.tsx`

**Purpose:** Dropdown notification panel.

**Features:**
- Unread count badge on bell icon
- Type-specific icons
- Mark as read
- Mark all as read

**States:** Empty ("No notifications"), Populated (list)

---

### `StatCard.tsx`

**Purpose:** KPI stat card for dashboard.

```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
}

// Example: <StatCard title="Total Leads" value={147} icon={<Users />} trend={{ value: 12, positive: true }} />
```

**States:** Loading (skeleton), Normal (value), Error

---

### `StatusBadge.tsx`

**Purpose:** Color-coded status badge.

```typescript
interface StatusBadgeProps {
  status: string;  // Status key
  type: 'lead' | 'task' | 'meeting' | 'quote' | 'campaign';
}
```

**Colors:** Color-coded via constants (STATUS_COLORS, PRIORITY_COLORS, etc.)

---

### `TagBadge.tsx`

**Purpose:** Color-coded tag badge.

```typescript
interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
}
```

---

### `TagInput.tsx`

**Purpose:** Tag input with autocomplete.

```typescript
interface TagInputProps {
  tags: string[];
  availableTags: Tag[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}
```

---

### `PageHeader.tsx`, `ImportDialog.tsx`, `ExportDropdown.tsx`

See [FEATURES.md](../features/FEATURES.md) → CSV Import/Export section.

---

## 3. Feature Components

### `components/leads/`

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `LeadTable.tsx` | Sortable lead data table | `leads`, `loading`, `onEdit`, `onDelete` |
| `LeadForm.tsx` | Create/edit lead form | `lead?`, `onSubmit`, `onCancel` |
| `LeadDetail.tsx` | Lead detail with 10 tabs | `leadId` |
| `LeadFilterBar.tsx` | Multi-criteria filter bar | `filters`, `onFilterChange` |
| `LeadBulkActions.tsx` | Bulk operations | `selected`, `onAction` |
| `LeadCard.tsx` | Pipeline kanban card | `lead`, `onClick`, `onDrag` |
| `LeadScoreCard.tsx` | Lead score breakdown | `score` |
| `LeadTimeline.tsx` | Lead-specific activity feed | `activities` |

**States (all components):** Loading → skeleton/disabled, Empty → empty state + CTA, Error → error state + retry, Populated → data display

### `components/contacts/`

| Component | Purpose |
|-----------|---------|
| `ContactTable.tsx` | Sortable contact data table |
| `ContactForm.tsx` | Create/edit contact form |
| `ContactDetail.tsx` | Contact detail with tabs |
| `ContactFilterBar.tsx` | Contact filter bar |
| `ContactBulkActions.tsx` | Bulk operations |

### `components/companies/`

| Component | Purpose |
|-----------|---------|
| `CompanyTable.tsx` | Sortable company data table |
| `CompanyForm.tsx` | Create/edit company form |
| `CompanyDetail.tsx` | Company detail with contacts/leads |
| `CompanyFilterBar.tsx` | Company filter bar |
| `CompanyRevenueCard.tsx` | Revenue estimation card |

### `components/deals/`

| Component | Purpose |
|-----------|---------|
| `DealTable.tsx` | Deal data table with stage/currency |
| `DealForm.tsx` | Create/edit deal form |
| `DealDetail.tsx` | Deal detail with communications |

### `components/pipeline/`

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `KanbanBoard.tsx` | Drag-and-drop kanban board | `stages`, `leads`, `onMoveLead` |
| `KanbanColumn.tsx` | Single pipeline stage column | `stage`, `leads`, `onDrop` |
| `KanbanCard.tsx` | Draggable lead card | `lead`, `onClick` |
| `SwimlaneSelector.tsx` | Swimlane grouping control | `options`, `selected` |
| `PipelineStats.tsx` | Stage analytics | `stats` |

**States:** Loading (skeleton columns), Empty (empty columns), Populated (cards), Drag (elevated shadow)

### `components/tasks/`

| Component | Purpose |
|-----------|---------|
| `TaskTable.tsx` | Task data table with priority/status |
| `TaskForm.tsx` | Create/edit task form |
| `TaskFilterBar.tsx` | Filter by status/priority/assigned |
| `TaskRow.tsx` | Single task row with inline toggle |

### `components/meetings/`

| Component | Purpose |
|-----------|---------|
| `CalendarView.tsx` | Month/week calendar grid |
| `MeetingForm.tsx` | Create/edit meeting form |
| `MeetingCard.tsx` | Calendar event card |
| `MeetingDetail.tsx` | Meeting detail view |

### `components/communication/`

| Component | Purpose |
|-----------|---------|
| `EmailComposer.tsx` | Compose email modal |
| `EmailList.tsx` | Email history for entity |
| `SmsComposer.tsx` | Compose SMS modal |
| `SmsList.tsx` | SMS history for entity |
| `CallLogForm.tsx` | Log a call modal |
| `CallLogList.tsx` | Call log history |
| `NoteEditor.tsx` | Add/edit Markdown note |

### `components/teams/`

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `TeamInfoCard.tsx` | Display/edit team details | `team`, `onUpdate`, `isAdmin` |
| `TeamMemberList.tsx` | Member table with roles | `members`, `currentUserId`, `onRoleChange`, `onRemove` |
| `InviteMemberDialog.tsx` | Invite form dialog | `open`, `onInvite` |
| `PermissionGuard.tsx` | Conditional rendering by permission | `action`, `entity`, `scope?`, `fallback?` |
| `RoleBadge.tsx` | Colored role indicator | `role`, `size?` |

### `components/automation/`

| Component | Purpose |
|-----------|---------|
| `AutomationRuleList.tsx` | List of automation rules |
| `AutomationRuleForm.tsx` | Create/edit rule with trigger/conditions/actions |
| `ConditionBuilder.tsx` | Condition builder UI |
| `ActionConfig.tsx` | Action configuration form |

### `components/quotes/`

| Component | Purpose |
|-----------|---------|
| `QuoteTable.tsx` | Quote data table |
| `QuoteForm.tsx` | Quote editor with line items |
| `QuoteItemEditor.tsx` | Line item row editor |
| `QuoteDetail.tsx` | Quote detail view |

### `components/saved-views/`

| Component | Purpose |
|-----------|---------|
| `ViewsDropdown.tsx` | Saved views dropdown |
| `SaveViewDialog.tsx` | Save current filters as view |

---

## 4. Component Composition Pattern

```
┌──────────────────────────────────────────────────────────┐
│  AppShell                                                 │
│  ├── Sidebar                                             │
│  ├── TopBar                                              │
│  │   ├── SearchBar → CommandPalette                      │
│  │   ├── NotificationPanel                               │
│  │   └── ProfileMenu                                     │
│  └── Main Content                                        │
│       ├── PageHeader                                     │
│       │   ├── Title + Description                        │
│       │   ├── Action Buttons                             │
│       │   ├── ExportDropdown                             │
│       │   └── ViewsDropdown                              │
│       ├── FilterBar                                      │
│       │   └── Filter Controls                            │
│       ├── BulkActionBar (conditional)                    │
│       ├── Content                                        │
│       │   ├── LoadingSkeleton (loading)                  │
│       │   ├── EmptyState (empty)                         │
│       │   ├── ErrorState (error)                         │
│       │   └── Data Display (populated)                   │
│       │       ├── EntityTable                            │
│       │       ├── KanbanBoard                            │
│       │       ├── CalendarView                           │
│       │       └── Detail Layout                          │
│       └── ConfirmDialog (conditional)                    │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Component State Requirements

Every component MUST handle these 5 states:

| State | Visual | Implementation |
|-------|--------|----------------|
| **Loading** | Skeleton/spinner | `loading` prop or state |
| **Empty** | Illustration + message + CTA | `EmptyState` component |
| **Error** | Error message + retry | `ErrorState` component |
| **Success** | Toast/confirmation | `sonner.toast()` |
| **Disabled** | Greyed out + tooltip | `disabled` prop + `Tooltip` |

---

## 6. Component Naming Conventions

- **Feature components:** `<Entity><Variant>` — `LeadTable`, `ContactForm`, `MeetingDetail`
- **Common components:** Descriptive name — `EmptyState`, `PageHeader`, `StatusBadge`
- **UI primitives:** shadcn convention — `button`, `dialog`, `table`
- **Hooks:** `use<Feature>` — `useLeads`, `usePipeline`
- **All components use TypeScript interfaces for props**
- **All interfaces are exported for reuse**
