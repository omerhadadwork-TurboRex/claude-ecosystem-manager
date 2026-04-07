# Claude Ecosystem Manager

Visual ecosystem map and workflow builder for your Claude Code setup.
See all your skills, agents, plugins, hooks, and connections in one interactive graph.

![Ecosystem Map](https://img.shields.io/badge/Claude_Code-Ecosystem_Manager-7c3aed?style=for-the-badge)

## What it does

- **Ecosystem Map** — Interactive graph of your entire `~/.claude/` setup (skills, agents, plugins, hooks, scheduled tasks)
- **Workflow Builder** — Design and plan automation workflows visually
- **Live Sync** — Reads directly from your `~/.claude/` directory in real-time
- **Write Back** — Changes you make in the UI get written back to your actual files (with automatic backups)
- **Optimizer** — Detects orphaned nodes, missing connections, and suggests improvements
- **Version History** — Save snapshots and restore previous states
- **Export** — Export your ecosystem as structured data

## Requirements

- **Node.js** v18+ — [Download here](https://nodejs.org)
- **Claude Code** installed — the app reads from `~/.claude/`

## Quick Start (Windows)

1. Double-click **`setup.bat`** — installs dependencies and scans your system
2. Double-click **`system.bat`** — starts the app and opens your browser

## Quick Start (Any OS)

```bash
# Install dependencies
npm install

# Scan your ~/.claude/ directory
npm run extract

# Start the app (server + client)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## How it works

### Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React + React Flow)               │
│  ├── Ecosystem Map (interactive graph)      │
│  ├── Workflow Builder                       │
│  ├── Optimizer / Validator                  │
│  └── Detail Panel / Export                  │
└──────────────┬──────────────────────────────┘
               │ /api/* (HTTP + SSE)
┌──────────────▼──────────────────────────────┐
│  Express Server (localhost:3847)             │
│  ├── scanner.ts  → reads ~/.claude/         │
│  ├── writer.ts   → writes changes back      │
│  └── backup.ts   → auto-backup before write │
└──────────────┬──────────────────────────────┘
               │ fs read/write
┌──────────────▼──────────────────────────────┐
│  ~/.claude/                                 │
│  ├── skills/        (local skills)          │
│  ├── agents/        (agents)                │
│  ├── plugins/       (MCP plugins)           │
│  ├── settings.json  (hooks, permissions)    │
│  ├── launch.json    (dev servers)           │
│  └── scheduled-tasks/                       │
└─────────────────────────────────────────────┘
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server status |
| GET | `/api/ecosystem` | Full graph (nodes + edges) |
| GET | `/api/ecosystem/refresh` | Force re-scan from disk |
| PUT | `/api/nodes/:id` | Update a skill/agent |
| POST | `/api/nodes` | Create new entity |
| DELETE | `/api/nodes/:id` | Delete entity (requires `X-Confirm-Delete` header) |
| GET | `/api/backups` | List backups |
| POST | `/api/backups/:id/restore` | Restore a backup |
| GET | `/api/events` | SSE stream for live updates |

### Safety

- **Auto-backup**: Every write creates a backup in `~/.claude/.backups/`
- **Whitelist**: Only specific paths can be written to (skills/, agents/, settings.json, etc.)
- **Confirmation**: Delete operations require explicit confirmation header
- **Offline mode**: Works without the server using static data (read-only)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client (recommended) |
| `npm run dev:client` | Start only the frontend |
| `npm run dev:server` | Start only the API server |
| `npm run extract` | Scan ~/.claude/ and generate static data |
| `npm run build` | Build for production |
| `npm run start` | Run production build |

## Project Structure

```
├── bin/cli.ts              # CLI entry point
├── server/
│   ├── index.ts            # Express server
│   ├── scanner.ts          # Filesystem scanner
│   ├── writer.ts           # Write-back with backup
│   └── backup.ts           # Backup manager
├── src/
│   ├── components/         # React components
│   ├── hooks/              # useEcosystem (API-powered)
│   ├── lib/                # Types, utilities, API client
│   └── data/               # Static fallback data
├── setup.bat               # First-time setup (Windows)
├── system.bat              # Start the app (Windows)
└── package.json
```

## For Developers

### Adding a new node category

1. Add the type to `src/lib/types.ts` → `NodeCategory`
2. Add config (color, icon, label) to `CATEGORY_CONFIG`
3. Add parsing logic to `server/scanner.ts`
4. Add write logic to `server/writer.ts` if writable

### Tech Stack

- **Frontend**: React 19, React Flow, Tailwind CSS, Lucide Icons
- **Backend**: Express 5, gray-matter (YAML frontmatter)
- **Build**: Vite, TypeScript
- **Layout**: Dagre (automatic graph layout)

## License

MIT
