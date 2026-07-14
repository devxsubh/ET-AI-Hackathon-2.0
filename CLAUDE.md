# CLAUDE.md — Engram (Industrial Knowledge Intelligence)

> **Claude Code:** Read `.claude/PROJECT.md` for platform capability map. Product requirements: `PRD.md`.

## Project Overview

**Engram** is the institutional memory layer for Indian heavy industry — an auto-generated knowledge graph that captures what engineers know before they retire, and makes it queryable by every worker who comes after.

This repo’s UX shell (sidebar + chat + analytical side panel) was pivoted from a prior VC sanctions screener. Domain logic is Engram: document ingest → 6-type knowledge graph → Expert Copilot → Knowledge Risk Radar.

**It never replaces a human maintenance decision.** It surfaces sourced answers and knowledge concentration risk.

---

## Architecture

**Canonical product doc:** `PRD.md` · **Stack note:** Express + MongoDB + graphology (not Hono/Neo4j yet).

### Deployment topology

| Layer | Where | How |
|---|---|---|
| Frontend | **Vercel** | `frontend/` Next.js app; `NEXT_PUBLIC_API_BASE_URL` → API |
| Backend | **AWS EC2** / local | `docker-compose.yml` → `backend/Dockerfile`, port 3001 |
| MongoDB | **Atlas** / local | Plants (`Startup`), `knowledgeGraph`, `riskReport`, chats, RAG |
| LLM | **Anthropic** | Claude Haiku — entity extract, answer synthesis, tool use |

```
Vercel (Next.js)  ──HTTPS/CORS──►  Express API
                                        ├── Atlas · optional R2 · Resend
```

Local: `docker compose -f docker-compose.dev.yml up -d` (Mongo) + `pnpm dev` at repo root.  
Production: `docker compose --env-file .env.production up -d --build` (backend only — no Watchman). Preview mode for demos without auth.

### Backend stack

- `express` with `helmet`, `cors`, JWT auth (RS256 cookies)
- `@anthropic-ai/sdk` — agentic chat + structured extraction
- `mongoose` — plant knowledge graphs + risk reports
- `graphology` — merge/traverse knowledge graph
- Engram agents in `backend/src/lib/engram/`

### Frontend stack

- Next.js 15, React 19, TypeScript, Tailwind
- `@xyflow/react` — Knowledge Graph explorer
- Chat + dock: Expert Copilot | Graph | Risk Radar

---

## Key data flow

```
User creates Plant → Load Unit 3 demo (or ingest docs)
 → Ingestor extracts 6 node types → Linker merges graph
 → Risk Agent scores knowledge concentration
 → Chat tools: ask_knowledge / traverse_graph / get_knowledge_risk / resolve_jargon
 → UI: KnowledgeGraphView + RiskRadarPanel
```

---

## Engram source map

```
backend/src/lib/engram/
  types.ts       — Asset|Person|Incident|Document|Procedure|Part + edges
  graph.ts       — merge, traverse, expertsForAsset
  extract.ts     — Ingestor (Haiku / heuristic)
  linker.ts      — Linker
  jargon.ts      — Jargon Agent dictionary
  riskAgent.ts   — Risk Agent + wow-query helper
  ingest.ts      — parse → extract → link pipeline
  demoData.ts    — Bharat Engineering Works Unit 3 seed
  tools.ts       — Claude tools registered in screenerRegistry

routes/startups/engram.ts — /graph /risk /demo /ingest
```

Frontend: `components/engram/` (PlantWorkspacePage, KnowledgeGraphView, RiskRadarPanel).

Routes: `/startups` = Plants list; `/startups/:id` = plant workspace (still uses startup IDs in API).

---

## Sample / demo

- Corpus: `backend/sample-data/engram/`
- Seed: `pnpm --filter vc-screener-backend run seed:engram`
- UI: **Load Unit 3 demo** on plant page

Wow query: *"If Ramesh retires tomorrow, which machines lose their only expert?"*

---

## Deferred (post-hackathon)

- Neo4j / pgvector / Hono rewrite
- Docling + heavy OCR
- Multi-tenant RBAC, mobile offline, IoT/SCADA
- Deleting residual VC screening files (soft-hidden from nav)

---

## Common commands

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # local Mongo
pnpm dev
pnpm -w run typecheck
pnpm --filter vc-screener-backend run seed:engram

# Production API image
docker compose --env-file .env.production up -d --build
```

## TypeScript / Lint Notes

- Backend: strict TypeScript via `tsc`.
- Frontend: Next.js ESLint. Prefer not to use `console.log` in production paths.
