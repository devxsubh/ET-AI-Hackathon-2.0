# Engram — Industrial Knowledge Intelligence

Institutional memory for Indian heavy industry. Drop in maintenance documents; Engram builds a navigable knowledge graph of **Assets, People, Incidents, Documents, Procedures, and Parts** — then answers field questions with citations and a **Knowledge Risk Radar** for single-point-of-failure expertise.

> UX shell reused from a prior compliance product; domain logic is Engram (ET AI Hackathon 2.0 — PS #8).

**Product statement:** Don't let your best engineers take institutional knowledge with them.

See **[PRD.md](PRD.md)** for full requirements.

---

## Demo path (90 seconds)

1. Create a **Plant** (sidebar → Plants → New plant)
2. Click **Load Unit 3 demo** (Bharat Engineering Works, Pune)
3. Open **Graph** / **Risk Radar** in the side panel
4. Ask: *"If Ramesh retires tomorrow, which machines lose their only expert?"*

---

## Architecture (pragmatic stack)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 — Copilot chat + React Flow knowledge graph + Risk Radar |
| Backend | Express + TypeScript — 5-agent tool loop (Ingestor, Linker, Jargon, Traversal, Risk) |
| Graph | graphology, persisted on plant (`Startup`) documents in MongoDB |
| Docs | pdf-parse, mammoth, xlsx — ingest → entity extract → link |
| LLM | Anthropic Claude (Haiku) via existing agent SSE |

**Not in this build (deferred):** Hono rewrite, Neo4j, pgvector migration, Docling/Python OCR, full RBAC.

Legacy VC sanctions code (Watchman, cap-table screening, portfolio, tabular reviews, workflows, IC memos) has been removed from the active product surface.

```
Next.js  ──SSE/HTTP──►  Express API
                           ├── MongoDB (plants, knowledgeGraph, riskReport, chats)
                           └── Claude tool-use (ask_knowledge, get_knowledge_risk, …)
```

---

## Local development

```bash
# Optional: local MongoDB for Engram
docker compose -f docker-compose.dev.yml up -d

cp .env.example .env
# Set ANTHROPIC_API_KEY, MONGODB_URI=mongodb://127.0.0.1:27017/engram
# Optional demo: ALLOW_PREVIEW_MODE=true + NEXT_PUBLIC_ALLOW_PREVIEW_MODE=true
pnpm install
pnpm dev    # backend :3001 + frontend :3000
```

Seed demo plant:

```bash
pnpm --filter vc-screener-backend run seed:engram
```

Sample corpus: `backend/sample-data/engram/`.

### Production (Docker)

```bash
cp .env.example .env.production   # fill Anthropic, Atlas URI, JWT keys, FRONTEND_URL
docker compose --env-file .env.production up -d --build
# API: http://<host>:3001/health
```

Compose runs **backend only** (no Watchman). Frontend stays on Vercel (or `pnpm --filter rtp-global run build` separately).

Preview mode: set `ALLOW_PREVIEW_MODE=true` and `NEXT_PUBLIC_ALLOW_PREVIEW_MODE=true` in `.env`.

---

## Key routes

| URL | Surface |
|-----|---------|
| `/assistant` | Expert Copilot |
| `/startups` | Plants list |
| `/startups/:id` | Plant workspace — chat + graph + risk radar |

### Engram API (on existing `/api/startups`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/:id/demo` | Seed Unit 3 knowledge graph |
| `GET` | `/:id/graph` | Knowledge graph |
| `GET` | `/:id/risk` | Risk radar |
| `POST` | `/:id/ingest` | Ingest document text/file |
| `POST` | `/api/chat` | Expert Copilot (SSE + tools) |

---

## Wow query

**"If Ramesh retires tomorrow, which machines lose their only expert?"**

Deterministic Risk Agent path flags **Pump P-101** and **Compressor C-3** as CRITICAL (Ramesh sole expert); **Boiler B-7** as MODERATE (Ramesh + Priya Singh).
