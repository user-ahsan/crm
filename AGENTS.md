<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# ENTERPRISE CRM SYSTEM — AGENT CONTROL + QUALITY ENFORCEMENT FILE

This file defines **strict engineering rules, code quality enforcement policies, agent behavior constraints, and project structure governance**.

This system is designed to behave like a **production SaaS CRM platform**, even if backend is minimal or mocked.

---

# 1. CORE PHILOSOPHY (NON-NEGOTIABLE)

All agents must follow this principle:

> "Every feature must behave like production software, not a demo or tutorial project."

This means:

- No incomplete implementations
- No shortcuts
- No missing edge cases
- No TODOs in production code
- No "later fixes"
- No fake or half logic

---

# 2. CODE QUALITY STANDARDS (STRICT)

## 2.1 NO INCOMPLETE CODE

- ❌ No TODO comments allowed
- ❌ No placeholder logic
- ❌ No stub functions
- ❌ No fake handlers
- ❌ No "mock later" logic in production modules

If something is not implemented, it MUST NOT exist in UI.

---

## 2.2 FULL IMPLEMENTATION RULE

Every feature must include:

- UI implementation
- State handling
- Error handling
- Empty state handling
- Loading state handling
- Edge case handling
- Data validation

If ANY of these are missing → feature is considered INVALID.

---

## 2.3 EDGE CASE ENFORCEMENT

Every logic must explicitly handle:

- Empty arrays
- Null values
- Undefined values
- Missing relationships
- Invalid user inputs
- Broken states
- Slow or delayed updates (UI simulation)

No silent failures allowed.

---

## 2.4 ERROR HANDLING RULES

- Every async action must have try/catch (even mocked)
- Every failure must show UI feedback
- No console-only error handling
- No hidden failures

---

## 2.5 TYPE SAFETY RULES

- Strict TypeScript only
- No `any` allowed
- No unsafe casts (`as unknown`)
- All entity models must be explicitly typed
- All API/service responses must be typed

---

## 2.6 PERFORMANCE RULES

- No unnecessary re-renders
- No heavy computation in render
- Memoize expensive calculations
- Use lazy loading for large modules
- Avoid deeply nested component trees

---

# 3. TESTING & VALIDATION RULES

## 3.1 NO AUTOMATIC BUILD RELIANCE

- ❌ Do NOT rely on build step to validate correctness
- ❌ Do NOT assume Next.js will catch issues

Instead:

- Manual review required for every feature
- Self-check logic must be applied
- Agent must simulate usage mentally

---

## 3.2 SELF-VALIDATION RULE (MANDATORY)

Before marking any feature complete:

Agent MUST verify:

- Can user break this feature with empty input?
- Can user break this with fast navigation?
- Does UI behave with no data?
- Does state reset properly?
- Does everything recover after failure?

If ANY answer is NO → feature is NOT complete.

---

## 3.3 NO "WORKS ON MY MACHINE" LOGIC

- Code must be environment-independent
- No hidden dependencies
- No implicit runtime assumptions

---

# 4. PROJECT DIRECTORY STRUCTURE (MANDATORY)

All agents MUST follow this structure strictly. See [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) for the full directory tree.

```

/crm-system
│
├── app/                          # Next.js routes (ONLY routing logic)
│   ├── (auth)/
│   ├── dashboard/
│   ├── leads/
│   ├── contacts/
│   ├── companies/
│   ├── pipeline/
│   ├── tasks/
│   ├── meetings/
│   ├── analytics/
│   └── settings/
│
├── components/                   # PURE UI components only
│   ├── ui/                       # shadcn components ONLY
│   ├── common/                   # shared UI (buttons, cards, modals)
│   ├── leads/
│   ├── contacts/
│   ├── companies/
│   ├── pipeline/
│   ├── tasks/
│   └── meetings/
│
├── modules/                      # BUSINESS LOGIC LAYER (IMPORTANT)
│   ├── leads/
│   ├── contacts/
│   ├── companies/
│   ├── pipeline/
│   ├── tasks/
│   ├── meetings/
│   └── analytics/
│
├── services/                     # Data mutation layer
│   ├── lead.service.ts
│   ├── contact.service.ts
│   ├── task.service.ts
│   └── meeting.service.ts
│
├── data/                         # MOCK DATABASE LAYER
│   ├── leads.ts
│   ├── contacts.ts
│   ├── companies.ts
│   ├── tasks.ts
│   └── meetings.ts
│
├── hooks/                        # Custom React hooks
│   ├── useLeads.ts
│   ├── useContacts.ts
│   ├── usePipeline.ts
│   └── useTasks.ts
│
├── types/                        # GLOBAL TYPE DEFINITIONS
│   ├── lead.types.ts
│   ├── contact.types.ts
│   ├── company.types.ts
│   ├── task.types.ts
│   └── meeting.types.ts
│
├── lib/                          # Utilities only
│   ├── utils.ts
│   ├── validators.ts
│   ├── constants.ts
│   └── formatters.ts
│
├── store/                        # UI state only (if needed)
├── styles/
└── public/

```

---

# 5. ARCHITECTURE ENFORCEMENT RULES

## 5.1 MODULE ISOLATION

Each module must be independent:

- Leads module cannot directly mutate Contacts
- Contacts module cannot directly modify Companies
- All cross-module actions MUST go through services

---

## 5.2 LAYER RULE (STRICT)

Flow must ALWAYS be:

```

UI → Hook → Module → Service → Data

```

No skipping layers allowed.

---

## 5.3 NO CROSS-CONTAMINATION

- UI cannot contain business logic
- Services cannot contain UI logic
- Data cannot contain logic
- Hooks cannot define schemas

---

# 6. COMPLETENESS RULE (CRITICAL)

Every feature must be:

- Fully implemented
- Fully usable
- Fully tested manually (simulation)
- Fully edge-case safe

❌ No partially working features allowed  
❌ No "future enhancement" notes  
❌ No missing flows  

---

# 7. UI/UX COMPLETENESS RULES

Every UI module MUST include:

- Loading state (skeleton)
- Empty state (no data)
- Error state (failure)
- Success state (confirmation)
- Disabled state (invalid action)

If any is missing → feature is INVALID.

---

# 8. STATE CONSISTENCY RULES

- State must always reflect UI
- No stale UI allowed
- No ghost updates
- No unsynced data views
- Optimistic updates must be reversible

---

# 9. MANUAL REVIEW REQUIREMENT

Before marking ANY feature complete:

Agent MUST simulate:

- First-time user usage
- Empty database usage
- Large dataset usage
- Rapid interaction usage
- Navigation back/forward
- Refresh behavior

If any break is found → REJECT FEATURE.

---

# 10. FINAL ENGINEERING PRINCIPLE

> "No feature is complete until it survives real-world chaotic usage without breaking."

---

# 11. SHADCN & CONFIGURATION INTEGRITY RULES (STRICT)

## 11.1 SHADCN COMPONENT INSTALLATION — CLI ONLY

All shadcn/ui components MUST be installed using the official CLI command:

```bash
bunx shadcn@latest add <component-name>
```

**Examples (correct):**
```bash
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

**Rules:**
- ❌ NEVER manually create shadcn component files
- ❌ NEVER copy-paste shadcn component code from documentation
- ❌ NEVER manually edit existing shadcn component files in `components/ui/`
- ✅ ALWAYS use `bunx shadcn@latest add` to install components
- ✅ The CLI will automatically handle dependencies, styles, and config registration
- ✅ If unsure whether a component exists, use `bunx shadcn@latest add` with the name — if it fails, it doesn't exist

---

## 11.2 CONFIG FILE INTEGRITY — NEVER EDIT

The following config files are **PRE-CONFIGURED and LOCKED**. They MUST NOT be edited, modified, or replaced under any circumstances:

| File                    | Reason                                       |
|-------------------------|----------------------------------------------|
| `tailwind.config.ts`    | Pre-configured with shadcn theme & variables |
| `postcss.config.mjs`    | Standard Next.js PostCSS setup               |
| `next.config.ts`        | Next.js configuration (may have special rules)|
| `tsconfig.json`         | TypeScript strict mode pre-configured        |
| `components.json`       | shadcn CLI configuration                     |
| `package.json`          | Dependency manifest (use CLI to modify)      |

**Rules:**
- ❌ NEVER edit `tailwind.config.ts` — shadcn CLI handles this when adding components
- ❌ NEVER edit `next.config.ts` — already production-configured
- ❌ NEVER edit `postcss.config.mjs` — already correctly configured
- ❌ NEVER edit `tsconfig.json` — strict mode is already set
- ❌ NEVER edit `components.json` — shadcn CLI manages this
- ❌ NEVER manually edit `package.json` to add dependencies — use `bun install` or `bunx shadcn` instead
- ❌ NEVER add custom CSS variables or Tailwind classes that duplicate what shadcn provides
- ✅ If you think a config change is needed, verify first — 99% of the time it's not needed
- ✅ Use the shadcn CLI and bun CLI to make changes; they will update configs automatically

---

## 11.3 CLI-FIRST APPROACH — COMMANDS OVER MANUAL EDITS

Always prefer CLI commands over manual file creation or editing:

### Adding Dependencies
```bash
# ✅ CORRECT — use commands
bun install <package>
bun install -D <dev-package>
bunx shadcn@latest add <component>
```

```bash
# ❌ WRONG — never manually edit package.json or create component files
```

### shadcn Component Installation Flow
```bash
# Step 1: List available components (if needed)
bunx shadcn@latest add --list

# Step 2: Install desired component
bunx shadcn@latest add button

# Step 3: The component is now available at components/ui/<component>.tsx
# DO NOT edit the generated file
```

### When to Use CLI vs Manual
| Action                          | Method              |
|---------------------------------|---------------------|
| Add shadcn component           | `bunx shadcn@latest add` |
| Add bun dependency             | `bun install`       |
| Add dev dependency             | `bun install -D`    |
| Run development server         | `bun run dev`       |
| Build project                  | `bun run build`     |
| TypeScript check               | `bunx tsc --noEmit`  |
| Lint code                      | `bun run lint`      |

- ✅ ALL dependency and tooling changes go through CLI commands
- ✅ NEVER manually register components, add imports, or update configs — the CLI does this

---

## 11.4 FOLDER STRUCTURE DISCIPLINE (REINFORCED)

In addition to Section 4, the following rules apply:

- ✅ All shadcn components go into `components/ui/` automatically via CLI
- ✅ All custom shared components go into `components/common/`
- ✅ All feature-specific components go into `components/<feature>/`
- ✅ All business logic goes into `modules/<feature>/`
- ❌ NEVER create files outside the defined directory structure
- ❌ NEVER create a `components/ui/` file manually — only via shadcn CLI
- ❌ NEVER put business logic in any file under `components/`
- ❌ NEVER put UI code in any file under `modules/`

---

## 11.5 CSS & STYLING RULES

- ❌ NEVER add global CSS that overrides shadcn base styles
- ❌ NEVER modify `app/globals.css` or `styles/globals.css` — shadcn styles are pre-configured
- ✅ Use Tailwind utility classes directly in JSX for custom styling (not in CSS files)
- ✅ Use the `cn()` utility from `lib/utils.ts` for conditional class merging
- ✅ Theme customization goes through CSS variables in the pre-configured files (do NOT touch them unless absolutely necessary and verified)

---

# 12. FINAL ENGINEERING PRINCIPLE

> "No feature is complete until it survives real-world chaotic usage without breaking."

---

# END OF FILE
