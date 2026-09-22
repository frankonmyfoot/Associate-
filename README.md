# AssociateAI

**AI-powered legal intake and document generation for solo practitioners and small-to-mid-size law firms.**

AssociateAI automates the two most time-consuming administrative tasks for lawyers: **client intake** and **document generation**. Clients fill out smart intake forms that auto-summarize into structured case files, and lawyers generate drafts (demand letters, contracts, pleadings, etc.) from simple prompts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Turso (SQLite via `team-db` CLI, designed for PostgreSQL migration) |
| Auth | Clerk (placeholder — ready for integration) |
| AI | OpenAI / Anthropic API (for document generation) |
| Deployment | Vercel |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout (fonts, metadata)
│   ├── page.tsx              # Landing page
│   ├── globals.css           # Tailwind + CSS variables
│   ├── (dashboard)/          # Authenticated routes group
│   │   ├── layout.tsx        # Dashboard layout (sidebar + header)
│   │   ├── page.tsx          # Dashboard home / overview
│   │   ├── intake/page.tsx   # Client intake management
│   │   ├── documents/page.tsx# Document generation
│   │   └── settings/page.tsx # Firm settings
│   ├── sign-in/page.tsx      # Sign-in page
│   ├── sign-up/page.tsx      # Sign-up page
│   └── api/
│       └── auth/             # Auth API routes (placeholder)
├── components/
│   ├── ui/                   # Reusable UI primitives
│   ├── layout/               # Layout components
│   └── forms/                # Form components
├── lib/
│   ├── db.ts                 # Database client (team-db wrapper)
│   ├── auth.ts               # Auth stubs (Clerk-ready)
│   └── utils.ts              # Utility functions
└── types/
    └── index.ts              # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Access to the `team-db` CLI (shared team database)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd associateai

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your values

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Environment Variables

See `.env.local.example` for all required variables.

## Database

The app uses Turso-synced SQLite via the `team-db` CLI for prototyping. All database interactions go through `src/lib/db.ts`, which wraps `team-db` calls.

**Migration path to PostgreSQL:** The query patterns in `src/lib/db.ts` use parameterized SQL and standard INSERT/SELECT patterns — straightforward to migrate to Prisma or Drizzle ORM.

## Deployment

Deploy to Vercel:

```bash
npm run build
vercel --prod
```

## License

Proprietary — see LICENSE file for details.