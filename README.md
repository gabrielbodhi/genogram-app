# Genogram

A web app for building genograms — diagrams used by therapists, social workers,
and researchers to map family relationships, cultural context, and emotional
bonds across generations.

## Stack

- **Next.js 16** (App Router) + **React 18** + **TypeScript**
- **Tailwind v4** + **shadcn/ui** primitives
- **ReactFlow** for the canvas
- **Zustand** for state, with a custom history store for undo/redo
- **Dexie** (IndexedDB) for local persistence
- **Zod** + **react-hook-form** for the InfoPanel
- **Supabase** (optional) for cloud sync

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To enable cloud sync, set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The cloud-sync button only appears when both are present.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│ React tree                                                │
│                                                           │
│  Toolbar    Canvas (ReactFlow)    InfoPanel    Notifications│
│      \         |                      |              ^    │
│       \        | useGenogramStore     |              |    │
│        \       v                      v              |    │
│         \   ┌──────────────────────────────┐         |    │
│          \  │  Zustand: people, relationships, │     |    │
│           \ │  junctions, junctionEdges, genograms │  |   │
│            \└──────────────────────────────┘         |    │
│             \                                         |   │
│              v                                        |   │
│         History store (snapshots) ─── Notifications ──┘   │
│              |                                            │
│              v                                            │
│          Dexie persistence (debounced, diff-based)        │
│              |                                            │
│              ├── BroadcastChannel (cross-tab lock)        │
│              └── (optional) Supabase push/pull            │
└───────────────────────────────────────────────────────────┘
```

### Data flow

1. The user mutates state via toolbar / canvas / info panel actions.
2. Actions go through `useGenogramStore` (Zustand) which performs validation
   (relationship guards, cycle checks) and emits `notify.*` toasts on
   problems.
3. `initHistoryRecorder()` subscribes to the store and pushes immutable
   snapshots into a separate history store; `useHistoryActions()` exposes
   undo/redo.
4. `useDbPersistence()` debounces store updates and writes a *diff* of the
   active genogram's entities to Dexie via bulk-puts/bulk-deletes.
5. A `BroadcastChannel` coordinates writes across tabs so a single tab owns
   persistence at a time.
6. Optional cloud sync uses Supabase upsert/select keyed by `genogram_id`
   and `owner = auth.uid()` (RLS-enforced).

## Project layout

```
app/                    Next.js routes
components/
  forms/                ChipInput, CaseNoteList, SubstanceUseList
  genogram/             Canvas, custom nodes/edges, toolbar, info panel,
                        connection picker, search, keyboard shortcuts,
                        cloud sync, genogram switcher
  ui/                   shadcn/ui primitives
  ErrorBoundary.tsx     Global error boundary
  Notifications.tsx     Toast viewer
  ThemeToggle.tsx       Light/dark switcher
lib/
  cloud/                Supabase client + sync helpers
  db/                   Dexie database + persistence hook
  forms/                Zod schemas for forms
  io/                   JSON snapshot schema (versioning + migrations)
  layout/               Generation-lane auto-layout
  store/                Zustand store, history, notifications
  types/                Person, Relationship, Junction, Genogram
```

## Features

- Add people with gender-specific shapes (square / circle / rounded) and
  vital status borders, including a genogram-standard cross-through for
  deceased individuals
- Pregnancy / miscarriage / stillbirth / abortion symbols, plus an
  index-person star
- Drag-to-connect relationships with a popover that lets you choose the
  exact relationship type (biological-parent, spouse, sibling, etc.)
- Junction nodes for joining edges (e.g. shared children to a couple)
- Adoption / foster / step / guardian / half-sibling markers shown on edges
- Side info panel with tabs for Basics / Cultural / Medical / Family
  - React-hook-form + Zod validation (age 0–150, DOB not in future,
    DOD ≥ DOB, vital-status consistency)
  - Chip-style editors for tribal affiliation, cultural identity, risk
    indicators, medical/mental-health conditions
  - Structured editors for case notes and substance use
  - Clickable family links that re-select the corresponding person
- Multi-genogram workspace: switch / create / rename / delete
- Search bar (`Cmd/Ctrl+K`) that pans and zooms to a person
- Undo / redo with `Cmd/Ctrl+Z` and `Shift+Cmd/Ctrl+Z`
- Light / dark theme toggle
- Local persistence via IndexedDB (diffed bulk writes), with cross-tab
  coordination
- JSON import/export with schema validation and v1→v2 migration
- PNG export (deferred to idle, with a progress toast)
- Optional cloud sync via Supabase magic-link auth + per-user RLS

## Keyboard shortcuts

| Shortcut                       | Action                          |
|--------------------------------|---------------------------------|
| `Cmd/Ctrl + Z`                 | Undo                            |
| `Shift + Cmd/Ctrl + Z` / `Cmd/Ctrl + Y` | Redo                   |
| `Delete` / `Backspace`         | Delete selected node(s) / edge(s) |
| `Esc`                          | Clear selection                 |
| `Cmd/Ctrl + A`                 | Select all nodes                |
| `Cmd/Ctrl + K`                 | Focus the search bar            |

## Genogram conventions used

- **Shapes**: square = male, circle = female, rounded square = other/unknown.
- **Pregnancy**: triangle (pregnancy), filled circle (miscarriage), slashed
  triangle (stillbirth), slashed circle (abortion).
- **Cross-through line** through the body indicates deceased.
- **Star** at the top-left indicates the index person.
- **Couple link** is a horizontal line between partners; dashed for divorced
  or separated.
- **Parent link** drops vertically into a junction, then horizontally to
  siblings.
- **Adoption / foster / step / guardian** are marked with an A / F / S / G
  badge on the edge; foster lines are dashed.
- **Half-sibling** is marked with a `½` badge.
- **Edge colour** reflects emotional bond when set: green (close), grey
  (distant), amber (conflictual), red (cut-off / abusive).

## Cloud sync schema (Supabase)

```sql
create table genograms (
  id text primary key,
  owner uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);
-- Repeat the same shape for: people, relationships, junctions, junction_edges,
-- each with an additional `genogram_id text` column.

alter table genograms enable row level security;
create policy "owner only" on genograms
  for all using (auth.uid() = owner);
-- Repeat the policy on the other four tables.
```

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # serve production build
npm run lint         # eslint
npm run lint:fix     # eslint --fix
npm run typecheck    # tsc --noEmit
```
