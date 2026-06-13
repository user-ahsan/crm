# Teams, Roles & Collaboration — Implementation Plan

## Overview

Multi-tenant/multi-user collaboration system where a CEO/Admin can create accounts for team members with different roles and permissions. This feature transforms NexusCRM from a single-user sales tool into a collaborative platform where sales teams can work together on leads, contacts, deals, tasks, and meetings under controlled access levels.

The plan follows the project's existing architecture: `UI → Hook → Module → Service → Data`, with all business logic in modules and data mutation in services.

---

## 1. Data Model

### 1.1 Team

Represents an organizational unit within the CRM. A team is the top-level grouping for users and their data.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: gen_random_uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL` | Team display name |
| `description` | `text` | `nullable` | Team purpose or notes |
| `createdBy` | `UUID` | `NOT NULL` | User ID of the creator (admin/CEO) |
| `createdAt` | `timestamp` | `default: now()` | Record creation time |
| `updatedAt` | `timestamp` | `default: now()` | Last update time |

### 1.2 TeamMember

Links a user to a team with a specific role.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: gen_random_uuid()` | Unique identifier |
| `teamId` | `UUID` | `FK -> teams.id`, `ON DELETE CASCADE` | Parent team |
| `userId` | `UUID` | `NOT NULL` | User identifier |
| `role` | `text` | `CHECK(role IN ('admin','manager','agent','viewer'))` | Access level |
| `joinedAt` | `timestamp` | `default: now()` | When the member joined |

**Constraints:**
- `UNIQUE(teamId, userId)` — a user can only be in a team once
- Index on `teamId` for fast team membership lookup
- Index on `userId` for cross-team user resolution

### 1.3 Permission Model

Granular permissions per entity type, with three axes:

| Axis | Values | Description |
|------|--------|-------------|
| **Action** | `create`, `read`, `update`, `delete` | What operation is allowed |
| **Entity** | `lead`, `contact`, `company`, `task`, `meeting`, `team`, `analytics` | Which data type |
| **Scope** | `own`, `team`, `all` | Which records are accessible |

#### Role-to-Permission Mapping

| Role | Leads | Contacts | Companies | Tasks | Meetings | Team Mgmt | Analytics |
|------|-------|----------|-----------|-------|----------|-----------|-----------|
| **Admin** | CRUD all | CRUD all | CRUD all | CRUD all | CRUD all | Full | View |
| **Manager** | CRUD team | CRUD team | CRUD team | CRUD team | CRUD team | Read members | View |
| **Agent** | CRUD own | CRUD own | Read team | CRUD own | CRUD own | Read own | None |
| **Viewer** | Read all | Read all | Read all | Read all | Read all | Read members | View |

**Permission evaluation logic:**
1. If user role is `admin` → grant all actions at `all` scope
2. If user role is `manager` → grant CRUD at `team` scope; read-only for team settings
3. If user role is `agent` → grant create/read/update/delete on `own` records; read-only on `team` records
4. If user role is `viewer` → grant read-only at `all` scope; no mutation allowed

### 1.4 TeamInvitation

Tracks pending invitations for users to join a team.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | `PK`, `default: gen_random_uuid()` | Unique identifier |
| `teamId` | `UUID` | `FK -> teams.id`, `ON DELETE CASCADE` | Target team |
| `email` | `text` | `NOT NULL` | Invitee email address |
| `role` | `text` | `CHECK(role IN ('admin','manager','agent','viewer'))` | Proposed role |
| `invitedBy` | `UUID` | `NOT NULL` | User who sent the invitation |
| `status` | `text` | `default: 'pending'`, `CHECK(status IN ('pending','accepted','declined','expired'))` | Invitation state |
| `expiresAt` | `timestamp` | `NOT NULL` | Invitation expiry (default: 7 days) |
| `createdAt` | `timestamp` | `default: now()` | When invitation was sent |

### 1.5 TypeScript Types

```typescript
// types/team.types.ts
export type TeamRole = 'admin' | 'manager' | 'agent' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type PermissionEntity = 'lead' | 'contact' | 'company' | 'task' | 'meeting' | 'team' | 'analytics';
export type PermissionScope = 'own' | 'team' | 'all';

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user?: { name: string; email: string; avatar?: string }; // populated on read
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Permission {
  action: PermissionAction;
  entity: PermissionEntity;
  scope: PermissionScope;
}

export interface TeamFormData {
  name: string;
  description?: string;
}

export interface InviteMemberFormData {
  email: string;
  role: TeamRole;
}
```

### 1.6 Supabase Schema (SQL)

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Teams table
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_teams_created_by on teams(created_by);

-- Team members table
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin', 'manager', 'agent', 'viewer')),
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

create index idx_team_members_team_id on team_members(team_id);
create index idx_team_members_user_id on team_members(user_id);

-- Team invitations table
create table team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'agent', 'viewer')),
  invited_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create index idx_team_invitations_team_id on team_invitations(team_id);
create index idx_team_invitations_email on team_invitations(email);
create index idx_team_invitations_status on team_invitations(status);

-- Row-level security (RLS) policies (applied when Supabase is used)
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invitations enable row level security;

-- Team policies: admins can manage their team
create policy "Team admins can manage their team"
  on teams for all
  using (created_by = auth.uid());

-- Team members policy: members can view their teams
create policy "Members can view team membership"
  on team_members for select
  using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

create policy "Admins can manage team members"
  on team_members for insert/update/delete
  using (
    exists (
      select 1 from team_members
      where team_id = team_members.team_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );
```

---

## 2. User Stories

### 2.1 CEO / Admin Stories

| ID | Story | Priority |
|----|-------|----------|
| US-01 | As a CEO, I can create a new team with a name and description | P0 |
| US-02 | As an Admin, I can invite team members by email with a specific role | P0 |
| US-03 | As an Admin, I can view all team members and their roles | P0 |
| US-04 | As an Admin, I can change a member's role | P1 |
| US-05 | As an Admin, I can remove a member from the team | P1 |
| US-06 | As an Admin, I can cancel a pending invitation | P2 |
| US-07 | As an Admin, I can transfer ownership to another admin | P2 |

### 2.2 Manager Stories

| ID | Story | Priority |
|----|-------|----------|
| US-08 | As a Manager, I can view all team data (leads, contacts, companies, tasks, meetings) | P0 |
| US-09 | As a Manager, I can create, edit, and delete any lead/contact/task/meeting in the team | P0 |
| US-10 | As a Manager, I can assign leads to specific agents | P1 |
| US-11 | As a Manager, I can view team analytics and reports | P1 |
| US-12 | As a Manager, I can reassign tasks between agents | P2 |

### 2.3 Agent Stories

| ID | Story | Priority |
|----|-------|----------|
| US-13 | As an Agent, I can only see leads, contacts, and tasks assigned to me | P0 |
| US-14 | As an Agent, I can create new leads and tasks assigned to myself | P0 |
| US-15 | As an Agent, I can update and edit my own assigned records | P0 |
| US-16 | As an Agent, I can view team data (read-only) for context | P1 |
| US-17 | As an Agent, I can log activities on my assigned records | P1 |

### 2.4 Viewer Stories

| ID | Story | Priority |
|----|-------|----------|
| US-18 | As a Viewer, I can view all team data but cannot create, edit, or delete anything | P0 |
| US-19 | As a Viewer, I can view analytics dashboards and reports | P1 |
| US-20 | As a Viewer, I can export reports (if export feature exists) | P2 |

### 2.5 Cross-cutting Stories

| ID | Story | Priority |
|----|-------|----------|
| US-21 | As any user, I can see which team I belong to and my role | P0 |
| US-22 | As any user, I can see role-based UI elements (buttons, menus, actions) that match my permissions | P0 |
| US-23 | As any user, I receive a notification when my role is changed | P2 |
| US-24 | As any user, I can leave a team (if I'm not the sole admin) | P2 |

---

## 3. UI Components Needed

### 3.1 Page: Team Settings (`app/settings/team/`)

**Location:** `app/settings/team/page.tsx` (accessible from settings sidebar)

**Sections:**
1. **Team Info** — Edit team name and description
2. **Member List** — Table of all members with roles, joined date, actions
3. **Invite Members** — Form to send invitations
4. **Pending Invitations** — List of pending invites with cancel option

### 3.2 Component: `TeamInfoCard`

Displays and edits team details.

| Prop | Type | Description |
|------|------|-------------|
| `team` | `Team` | Current team data |
| `onUpdate` | `(data: TeamFormData) => Promise<void>` | Save handler |
| `isAdmin` | `boolean` | Whether user can edit |

**States:** Loading (skeleton card), Display (read-only text), Editing (inline form), Saving (disabled with spinner), Error (inline error message), Success (toast).

### 3.3 Component: `TeamMemberList`

Table of team members with role badges and actions.

| Prop | Type | Description |
|------|------|-------------|
| `members` | `TeamMember[]` | Array of members |
| `currentUserId` | `string` | To highlight current user |
| `onRoleChange` | `(memberId: string, role: TeamRole) => Promise<void>` | Role update handler |
| `onRemove` | `(memberId: string) => Promise<void>` | Remove handler |
| `isAdmin` | `boolean` | Whether current user can manage |

**Columns:** Avatar + Name, Email, Role (with dropdown if editable), Joined Date, Actions (change role, remove).

**States:** Loading (table skeleton rows), Empty ("No members yet"), Populated (data rows), Error (alert banner), Optimistic role update with rollback on failure.

### 3.4 Component: `InviteMemberDialog`

Modal dialog for inviting new members.

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Close handler |
| `onInvite` | `(data: InviteMemberFormData) => Promise<void>` | Submit handler |
| `isAdmin` | `boolean` | Gate access |

**Form Fields:** Email (required, email validation), Role (select: admin/manager/agent/viewer).

**States:** Open (form visible), Submitting (spinner on button, fields disabled), Success (toast + close), Error (inline error message), Validation error (field-level messages).

### 3.5 Component: `PermissionGuard`

Wrapper component that conditionally renders children based on the current user's permissions.

| Prop | Type | Description |
|------|------|-------------|
| `action` | `PermissionAction` | Required action |
| `entity` | `PermissionEntity` | Target entity |
| `scope?` | `PermissionScope` | Override scope check |
| `fallback?` | `ReactNode` | Content to show if denied (default: nothing) |
| `children` | `ReactNode` | Content to show if allowed |

**Usage examples:**
```tsx
<PermissionGuard action="create" entity="lead">
  <Button>Add Lead</Button>
</PermissionGuard>

<PermissionGuard action="delete" entity="task" fallback={<span>View only</span>}>
  <DeleteButton taskId={task.id} />
</PermissionGuard>
```

### 3.6 Component: `RoleBadge`

Visual badge showing a user's role with appropriate color coding.

| Prop | Type | Description |
|------|------|-------------|
| `role` | `TeamRole` | Role to display |
| `size?` | `'sm' \| 'md' \| 'lg'` | Badge size |

**Color mapping:**
- `admin` → Purple (`bg-purple-100 text-purple-800`)
- `manager` → Blue (`bg-blue-100 text-blue-800`)
- `agent` → Green (`bg-green-100 text-green-800`)
- `viewer` → Gray (`bg-gray-100 text-gray-800`)

### 3.7 Hook: `useTeam()`

```typescript
function useTeam(): {
  team: Team | null;
  members: TeamMember[];
  invitations: TeamInvitation[];
  currentMember: TeamMember | null;
  loading: boolean;
  error: string | null;
  // Actions
  updateTeam: (data: TeamFormData) => Promise<void>;
  inviteMember: (data: InviteMemberFormData) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  changeMemberRole: (memberId: string, role: TeamRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  refresh: () => Promise<void>;
}
```

### 3.8 Module: `modules/teams/teamPermissions.ts`

Pure business logic for permission evaluation (no side effects).

```typescript
export function hasPermission(
  role: TeamRole,
  action: PermissionAction,
  entity: PermissionEntity,
  recordOwnerId?: string,
  currentUserId?: string,
): boolean { /* ... */ }

export function canAccessRecord(
  role: TeamRole,
  scope: PermissionScope,
  recordOwnerId: string,
  currentUserId: string,
): boolean { /* ... */ }

export function getRolePermissions(role: TeamRole): Permission[] { /* ... */ }
```

### 3.9 Service: `services/team.service.ts`

Data mutation layer following the existing pattern (`lead.service.ts`, `contact.service.ts`).

```typescript
export const teamService = {
  async getCurrentTeam(): Promise<Team | null> { /* ... */ },
  async getMembers(teamId: string): Promise<TeamMember[]> { /* ... */ },
  async create(data: TeamFormData): Promise<Team> { /* ... */ },
  async update(id: string, data: Partial<TeamFormData>): Promise<Team | undefined> { /* ... */ },
  async inviteMember(teamId: string, data: InviteMemberFormData): Promise<TeamInvitation> { /* ... */ },
  async cancelInvitation(invitationId: string): Promise<boolean> { /* ... */ },
  async changeMemberRole(memberId: string, role: TeamRole): Promise<TeamMember | undefined> { /* ... */ },
  async removeMember(memberId: string): Promise<boolean> { /* ... */ },
};
```

---

## 4. API Routes Needed (for n8n/webhook/API access)

These routes enable programmatic team management from external systems or n8n workflows.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams` | List all teams for current user |
| `POST` | `/api/teams` | Create a new team |
| `GET` | `/api/teams/:id` | Get team details |
| `PUT` | `/api/teams/:id` | Update team settings |
| `DELETE` | `/api/teams/:id` | Delete a team (admin only) |
| `GET` | `/api/teams/:id/members` | List team members |
| `POST` | `/api/teams/:id/invite` | Invite a new member |
| `PUT` | `/api/teams/:id/members/:memberId/role` | Change member role |
| `DELETE` | `/api/teams/:id/members/:memberId` | Remove a member |
| `GET` | `/api/teams/:id/invitations` | List pending invitations |
| `DELETE` | `/api/teams/:id/invitations/:invitationId` | Cancel an invitation |

**Authentication:** All routes require Bearer token or session cookie authentication.
**Authorization:** Each route checks the requesting user's role before allowing the operation.

### Example Route Handler Pattern

```typescript
// app/api/teams/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { teamService } from '@/services/team.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const members = await teamService.getMembers(id);
    return NextResponse.json({ data: members });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 },
    );
  }
}
```

---

## 5. Implementation Phases

### Phase 1: Data Model + Type Definitions (Estimated: 2-3 days)

**Deliverables:**
- `types/team.types.ts` — All TypeScript types and interfaces
- `data/teams.ts` — Mock data store (in-memory array)
- `data/team-members.ts` — Mock data store
- `data/team-invitations.ts` — Mock data store
- `supabase/migrations/..._create_teams.sql` — SQL migration file

**Acceptance Criteria:**
- All type definitions are complete with no `any` usage
- Mock data stores are initialized with sample data (at least 1 team with 3 members)
- SQL schema includes all tables, indexes, and RLS policies
- Supabase Database type with `DbTeam`, `DbTeamMember`, `DbTeamInvitation` rows, inserts, and updates
- Types are importable via `@/types/team.types`

### Phase 2: Service + Module Layer (Estimated: 2-3 days)

**Deliverables:**
- `services/team.service.ts` — Data mutation service
- `services/team-invitation.service.ts` — Invitation management service
- `modules/teams/teamPermissions.ts` — Permission evaluation logic
- `modules/teams/teamValidation.ts` — Input validation functions

**Acceptance Criteria:**
- Service follows the same pattern as `lead.service.ts` (named object export, async methods, dual Supabase/mock mode)
- Service handles all CRUD operations for teams, members, and invitations
- Permission module correctly evaluates all role/action/entity/scope combinations
- All edge cases covered: duplicate member, invalid role, expired invitation, non-existent team
- Error handling returns typed errors (not generic strings)

### Phase 3: Team Management UI (Estimated: 3-4 days)

**Deliverables:**
- `hooks/useTeam.ts` — Team state management hook
- `app/settings/team/page.tsx` — Team settings page
- `components/teams/TeamInfoCard.tsx`
- `components/teams/TeamMemberList.tsx`
- `components/teams/InviteMemberDialog.tsx`
- `components/teams/RoleBadge.tsx`

**Acceptance Criteria:**
- All states covered: loading, empty, error, success for every component
- Invite dialog validates email format before submission
- Role changes use optimistic updates with rollback on failure
- Remove member shows confirmation dialog before executing
- Page is responsive and matches shadcn/ui design system
- Team info editing supports inline save with validation

### Phase 4: Permission Guards + Integration (Estimated: 3-4 days)

**Deliverables:**
- `components/teams/PermissionGuard.tsx` — Wrapper component
- Integration of `PermissionGuard` into existing pages:
  - `components/leads/` — Guard create/edit/delete buttons
  - `components/contacts/` — Guard create/edit/delete buttons
  - `components/tasks/` — Guard create/edit/complete buttons
  - `components/meetings/` — Guard create/edit/reschedule buttons
- `hooks/usePermissions.ts` — Permission check hook

**Acceptance Criteria:**
- Admin sees all actions everywhere
- Manager sees all actions on team data but cannot manage team settings
- Agent sees create/edit/delete only on own assigned records; remaining UI shows read-only
- Viewer sees no mutation buttons anywhere (create, edit, delete, etc.)
- PermissionGuard correctly hides/shows children without layout shift
- All existing pages gracefully degrade when permissions are restricted

### Phase 5: Collaboration Features (Estimated: 3-5 days)

**Deliverables:**
- Shared views: Team-wide pipeline view showing all agents' deals
- Activity feed: Per-team activity timeline visible to all members
- Comments: Add comments to leads, contacts, and tasks (visible to team)
- Assignment dashboard: Manager view to see workload distribution
- Notifications: In-app notification when assigned a lead/task/meeting

**Acceptance Criteria:**
- Activity feed shows all team actions sorted chronologically
- Comments are scoped to the team (an Agent cannot see another team's comments)
- Assignment dashboard shows each agent's current workload count
- Notifications surface as toast alerts + notification badge in sidebar
- Shared pipeline view respects role permissions (viewer = read-only, manager = can reassign)

---

## 6. Mock Data for Development

```typescript
// data/teams.ts
export const teams: Team[] = [
  {
    id: 'team-001',
    name: 'NexusCRM Sales Team',
    description: 'Primary sales team handling all inbound leads',
    createdBy: 'user-admin-001',
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-15T08:00:00.000Z',
  },
];

// data/team-members.ts
export const teamMembers: TeamMember[] = [
  {
    id: 'tm-001',
    teamId: 'team-001',
    userId: 'user-admin-001',
    role: 'admin',
    joinedAt: '2025-01-15T08:00:00.000Z',
    user: { name: 'Sarah Chen', email: 'sarah@nexuscrm.com', avatar: undefined },
  },
  {
    id: 'tm-002',
    teamId: 'team-001',
    userId: 'user-mgr-001',
    role: 'manager',
    joinedAt: '2025-01-16T09:00:00.000Z',
    user: { name: 'Mike Johnson', email: 'mike@nexuscrm.com', avatar: undefined },
  },
  {
    id: 'tm-003',
    teamId: 'team-001',
    userId: 'user-agent-001',
    role: 'agent',
    joinedAt: '2025-01-20T10:00:00.000Z',
    user: { name: 'Alex Rivera', email: 'alex@nexuscrm.com', avatar: undefined },
  },
];
```

---

## 7. Permission Evaluation — Detailed Logic

```typescript
// modules/teams/teamPermissions.ts

const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  admin: [
    { action: 'create', entity: 'lead', scope: 'all' },
    { action: 'read', entity: 'lead', scope: 'all' },
    { action: 'update', entity: 'lead', scope: 'all' },
    { action: 'delete', entity: 'lead', scope: 'all' },
    { action: 'create', entity: 'contact', scope: 'all' },
    { action: 'read', entity: 'contact', scope: 'all' },
    { action: 'update', entity: 'contact', scope: 'all' },
    { action: 'delete', entity: 'contact', scope: 'all' },
    { action: 'create', entity: 'company', scope: 'all' },
    { action: 'read', entity: 'company', scope: 'all' },
    { action: 'update', entity: 'company', scope: 'all' },
    { action: 'delete', entity: 'company', scope: 'all' },
    { action: 'create', entity: 'task', scope: 'all' },
    { action: 'read', entity: 'task', scope: 'all' },
    { action: 'update', entity: 'task', scope: 'all' },
    { action: 'delete', entity: 'task', scope: 'all' },
    { action: 'create', entity: 'meeting', scope: 'all' },
    { action: 'read', entity: 'meeting', scope: 'all' },
    { action: 'update', entity: 'meeting', scope: 'all' },
    { action: 'delete', entity: 'meeting', scope: 'all' },
    { action: 'read', entity: 'analytics', scope: 'all' },
    { action: 'read', entity: 'team', scope: 'all' },
    { action: 'update', entity: 'team', scope: 'all' },
    { action: 'delete', entity: 'team', scope: 'all' },
  ],
  manager: [
    { action: 'create', entity: 'lead', scope: 'team' },
    { action: 'read', entity: 'lead', scope: 'all' },
    { action: 'update', entity: 'lead', scope: 'team' },
    { action: 'delete', entity: 'lead', scope: 'team' },
    { action: 'create', entity: 'contact', scope: 'team' },
    { action: 'read', entity: 'contact', scope: 'all' },
    { action: 'update', entity: 'contact', scope: 'team' },
    { action: 'delete', entity: 'contact', scope: 'team' },
    { action: 'create', entity: 'company', scope: 'team' },
    { action: 'read', entity: 'company', scope: 'all' },
    { action: 'update', entity: 'company', scope: 'team' },
    { action: 'delete', entity: 'company', scope: 'team' },
    { action: 'create', entity: 'task', scope: 'team' },
    { action: 'read', entity: 'task', scope: 'all' },
    { action: 'update', entity: 'task', scope: 'team' },
    { action: 'delete', entity: 'task', scope: 'team' },
    { action: 'create', entity: 'meeting', scope: 'team' },
    { action: 'read', entity: 'meeting', scope: 'all' },
    { action: 'update', entity: 'meeting', scope: 'team' },
    { action: 'delete', entity: 'meeting', scope: 'team' },
    { action: 'read', entity: 'analytics', scope: 'all' },
    { action: 'read', entity: 'team', scope: 'team' },
  ],
  agent: [
    { action: 'create', entity: 'lead', scope: 'own' },
    { action: 'read', entity: 'lead', scope: 'own' },
    { action: 'update', entity: 'lead', scope: 'own' },
    { action: 'delete', entity: 'lead', scope: 'own' },
    { action: 'create', entity: 'contact', scope: 'own' },
    { action: 'read', entity: 'contact', scope: 'own' },
    { action: 'update', entity: 'contact', scope: 'own' },
    { action: 'delete', entity: 'contact', scope: 'own' },
    { action: 'create', entity: 'task', scope: 'own' },
    { action: 'read', entity: 'task', scope: 'own' },
    { action: 'update', entity: 'task', scope: 'own' },
    { action: 'delete', entity: 'task', scope: 'own' },
    { action: 'create', entity: 'meeting', scope: 'own' },
    { action: 'read', entity: 'meeting', scope: 'own' },
    { action: 'update', entity: 'meeting', scope: 'own' },
    { action: 'delete', entity: 'meeting', scope: 'own' },
    { action: 'read', entity: 'team', scope: 'own' },
  ],
  viewer: [
    { action: 'read', entity: 'lead', scope: 'all' },
    { action: 'read', entity: 'contact', scope: 'all' },
    { action: 'read', entity: 'company', scope: 'all' },
    { action: 'read', entity: 'task', scope: 'all' },
    { action: 'read', entity: 'meeting', scope: 'all' },
    { action: 'read', entity: 'analytics', scope: 'all' },
    { action: 'read', entity: 'team', scope: 'all' },
  ],
};

export function hasPermission(
  role: TeamRole,
  action: PermissionAction,
  entity: PermissionEntity,
): boolean {
  return ROLE_PERMISSIONS[role].some(
    (p) => p.action === action && p.entity === entity,
  );
}

export function canAccessRecord(
  role: TeamRole,
  entity: PermissionEntity,
  scope: PermissionScope,
): boolean {
  return ROLE_PERMISSIONS[role].some(
    (p) => p.entity === entity && (
      p.scope === 'all' || p.scope === scope || scope === 'all'
    ),
  );
}
```

---

## 8. State Management Approach

| State Type | Strategy |
|------------|----------|
| **Current user's team + role** | React context (`TeamContext`) — loaded once at app init |
| **Team members list** | `useTeam()` hook with local state + service call |
| **Invitations** | `useTeam()` hook with local state |
| **Permission checks** | Derived from `TeamContext` — no additional state needed |
| **UI toggles** (dialogs, dropdowns) | `useState` in each component |
| **Role change optimistic updates** | Local state mutation + rollback on error |

### TeamContext

```typescript
// context/TeamContext.tsx
interface TeamContextValue {
  team: Team | null;
  currentMember: TeamMember | null;
  role: TeamRole | null;
  loading: boolean;
  error: string | null;
  hasPermission: (action: PermissionAction, entity: PermissionEntity) => boolean;
  canAccessRecord: (entity: PermissionEntity, scope: PermissionScope) => boolean;
  refresh: () => Promise<void>;
}
```

---

## 9. Error Handling Strategy

Following the project's existing error handling pattern (from `AGENTS.md`):

| Scenario | User Feedback | Technical Handling |
|----------|---------------|-------------------|
| Invite email already a member | Toast: "User is already a team member" | Return 409, no action |
| Invalid email format | Inline validation: "Enter a valid email" | Client-side validation |
| Cannot remove last admin | Toast: "Cannot remove the last admin" | Server-side check, return 400 |
| Network failure on role change | Toast: "Failed to update role" + revert | Optimistic revert |
| Invitation expired | Badge: "Expired" on invitation | Auto-check on load |
| Permission denied on action | Button disabled with tooltip | Guard component hides action |
| Team creation with empty name | Inline validation: "Name is required" | Client + server validation |

---

## 10. Testing Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| Admin creates team | Navigate to Settings → Team → Create | Team created, redirected to team page |
| Admin invites member | Open Invite dialog → enter email → select role → send | Invitation appears in pending list |
| Manager views restricted action | Try to delete team settings | Button is disabled or hidden |
| Agent sees only own data | View leads list | Only leads with assignedTo === currentUserId shown |
| Viewer tries to edit lead | Click edit button | Button is disabled or hidden; no form opens |
| Role change takes effect | Admin changes Agent → Manager | UI updates immediately, permissions expand |
| Remove member from team | Admin confirms removal | Member removed from list, can no longer access team data |
| Permission guard on pipeline | Manager drags lead | Works; Viewer tries same → drag disabled |
| Concurrent role change | Two admins change same member | Last write wins (no merge conflicts in mock mode) |

---

## 11. Out of Scope (Phase 5+)

- **Real-time collaboration** (WebSockets, live cursors) — Future enhancement
- **Team chat / messaging** — Not part of this feature set
- **Cross-team data sharing** — Teams are isolated by design
- **SCIM / SSO integration** — Enterprise feature for later
- **Audit log for permission changes** — Would require additional infrastructure
- **Bulk invite via CSV upload** — Nice-to-have for post-launch

---

## 12. Directory Structure Additions

```
crm-system/
├── app/
│   └── settings/
│       └── team/                         # NEW: Team settings page
│           └── page.tsx
│
├── components/
│   └── teams/                            # NEW: Team UI components
│       ├── TeamInfoCard.tsx
│       ├── TeamMemberList.tsx
│       ├── InviteMemberDialog.tsx
│       ├── PermissionGuard.tsx
│       └── RoleBadge.tsx
│
├── modules/
│   └── teams/                            # NEW: Team business logic
│       ├── teamPermissions.ts
│       └── teamValidation.ts
│
├── services/
│   ├── team.service.ts                   # NEW: Team data mutation
│   └── team-invitation.service.ts        # NEW: Invitation management
│
├── hooks/
│   ├── useTeam.ts                        # NEW: Team state hook
│   └── usePermissions.ts                 # NEW: Permission check hook
│
├── data/
│   ├── teams.ts                          # NEW: Mock team data
│   ├── team-members.ts                   # NEW: Mock member data
│   └── team-invitations.ts              # NEW: Mock invitation data
│
├── types/
│   └── team.types.ts                     # NEW: Team type definitions
│
└── context/
    └── TeamContext.tsx                    # NEW: Team React context
```
