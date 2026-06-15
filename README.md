# NexusCRM — Sales & Relationship Management

A frontend-first, production-grade SaaS CRM built with Next.js 16. Manages the complete sales lifecycle — lead acquisition to deal closure — with an enterprise-grade UI.

---

## Quick Start

```bash
bun install       # Install dependencies
bun run dev       # Start dev server at http://localhost:3000
```

## Core Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Language** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (@base-ui/react) |
| **State** | Zustand 5 (persisted stores) |
| **Database** | Optional Supabase (PostgreSQL) |
| **Package Manager** | Bun |

## Documentation

Full documentation is in the [docs/](./docs/) directory:

| Section | Contents |
|---------|----------|
| [docs/README.md](./docs/README.md) | Full project overview + documentation map |
| [docs/guides/](./docs/guides/) | Setup guide, PRD, user flows |
| [docs/architecture/](./docs/architecture/) | System architecture, database schema |
| [docs/features/](./docs/features/) | Complete 35-feature catalog, n8n integration |
| [docs/reference/](./docs/reference/) | API, types, hooks, services, components, modules |

## Agent Governance

See [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md) for strict engineering rules and code quality enforcement.

## License

Private — Internal project.
