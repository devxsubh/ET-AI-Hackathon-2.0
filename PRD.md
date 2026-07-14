# Engram — Product Requirements Document
**ET AI Hackathon 2.0 | Problem Statement #8: AI for Industrial Knowledge Intelligence**
Version 1.0 — July 2026

---

## 1. One-Line Product Statement

Engram is the institutional memory layer for Indian heavy industry — an auto-generated knowledge graph that captures what engineers know before they retire, and makes it queryable by every worker who comes after.

---

## 2. Problem

### The Core Pain (from PS #8 data)
- Workers in Indian industrial companies spend **35% of working hours** searching for information across 7–12 disconnected document systems
- **25% of experienced Indian industrial engineers** will retire within the next decade, taking decades of undocumented operational knowledge with them permanently
- BIS Research: knowledge fragmentation contributes to **18–22% of unplanned downtime events** in Indian heavy industry

### Why Existing Tools Fail
| Tool | Why it doesn't work |
|---|---|
| Confluence / SharePoint | Humans write everything manually. Nobody updates it. Knowledge still lives in heads. |
| Document search (Ctrl+F) | Keyword search across disconnected systems. No relationships. No context. No history. |
| Obsidian / Notion | Single user, manual linking, no industrial document ingestion, no AI traversal |
| Enterprise DMS | Stores documents, doesn't understand them. Query returns a list of files, not an answer. |

### The Gap
Nobody has built a system that **reads the existing chaos** (maintenance logs, PDFs, scanned SOPs, emails) and auto-generates a navigable, queryable knowledge graph from it — specifically for Indian heavy industry.

---

## 3. Product Vision

Engram is Obsidian for industrial operations — but the AI writes the notes and draws the connections. Humans just query it.

Drop in documents. Engram builds the graph. Ask anything.

---

## 4. Target User

### Primary: Maintenance Engineer
- Age 35–55, works at a large Indian manufacturing plant (BHEL, Tata Steel, ONGC, L&T)
- Needs to diagnose equipment failures fast, with full historical context
- Currently spends 2+ hours searching across multiple systems before making a maintenance call
- Pain: "The engineer who knew this machine retired 8 months ago. Nobody wrote anything down."

### Secondary: Plant Manager / Operations Head
- Needs visibility into which assets are knowledge-critical and which knowledge is at-risk
- Currently has no tool that tells them "if X retires, we lose institutional knowledge on Y, Z, W"

### Demo User (the judge's mental model)
A field engineer standing next to a failing pump at 11pm, asking: "Why did this pump keep failing in 2019 and what did we do about it?" — and getting a sourced, cited answer in seconds instead of searching through 6 systems and calling 3 people.

---

## 5. Core Features

### 5.1 Universal Document Ingestion
Engram accepts and processes:
- PDFs (maintenance reports, SOPs, inspection records)
- DOCX (procedures, manuals, project files)
- XLSX (maintenance schedules, parts lists, historical data)
- Scanned images / handwritten forms (OCR via Docling)
- Email exports (.eml, .msg)

Powered by **Docling (IBM, MIT license)** — handles layout-aware extraction, table parsing, OCR fallback for scanned documents.

### 5.2 Auto-Generated Knowledge Graph
After ingestion, Engram automatically:
1. Extracts entities across all 6 node types
2. Identifies and creates relationships between entities
3. Resolves jargon and domain-specific terminology (Jargon Agent)
4. Builds a persistent, navigable graph — updated as new documents arrive

**This is the core product differentiator. Not a chatbot. A graph.**

### 5.3 Visual Graph Explorer
- Interactive force-directed graph rendered via `react-force-graph`
- Click any node (Asset, Person, Incident, etc.) to see all its connections
- Filter by node type, date range, asset tag, or department
- Shows knowledge density — visually highlights assets with thin documentation
- Shows knowledge risk — highlights assets where one person holds all the knowledge

### 5.4 Conversational AI Layer (Expert Copilot)
- Claude Haiku for all query processing and answer generation
- Claude Sonnet for web-augmented queries (e.g., OEM manual lookups, regulatory references)
- Every answer includes:
  - Confidence score (High / Medium / Low)
  - Source citations with document name, page, and date
  - Direct links to originating documents
  - Graph path taken to reach the answer (multi-hop transparency)
- Mobile-first UI — works for field technicians on phones, not just desktop engineers

### 5.5 Knowledge Risk Radar
The differentiating "safety layer" — Engram's equivalent of AgriBloom's banned pesticide check.

- Scans the graph for **single-point-of-failure knowledge**: assets where one Person node holds the majority of edges (incidents fixed, procedures authored, documents created)
- Flags these as **Knowledge Risk Assets**
- Surfaces: "If Ramesh retires tomorrow, Pump P-101, Compressor C-3, and Boiler B-7 lose their only expert"
- Generates a **Knowledge Preservation Priority List** — ranked by asset criticality × knowledge concentration

---

## 6. The 6 Node Types

| Node Type | What it represents | Example |
|---|---|---|
| **Asset** | Physical equipment or system | Pump P-101, Boiler B-7, Compressor C-3 |
| **Person** | Engineer, operator, technician | Ramesh Kumar, Sr. Maintenance Engineer |
| **Incident** | Failure event, near-miss, safety event | Seal failure, March 2019 |
| **Document** | Any source document ingested | Maintenance report #2341, SOP v3.2 |
| **Procedure** | A defined sequence of steps | Impeller replacement procedure |
| **Part** | Spare part, component, material | SKF Bearing 6205, Mechanical seal Type-A |

### Key Relationships (Graph Edges)
```
Asset       → had_incident    → Incident
Asset       → requires_part   → Part
Asset       → governed_by     → Procedure
Incident    → fixed_by        → Person
Incident    → resolved_using  → Procedure
Incident    → documented_in   → Document
Person      → authored        → Document
Person      → expert_on       → Asset
Procedure   → references_part → Part
Document    → describes       → Procedure
```

---

## 7. The 5-Agent Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ENGRAM AGENT LAYER                   │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Ingestor   │    Linker    │    Jargon    │  Traversal │
│    Agent     │    Agent     │    Agent     │   Agent    │
├──────────────┴──────────────┴──────────────┴────────────┤
│                      Risk Agent                         │
└─────────────────────────────────────────────────────────┘
```

### Agent 1 — Ingestor
**Trigger:** New document uploaded  
**Job:** Parse document → extract all entity candidates across 6 node types  
**Stack:** Docling for parsing → Claude Haiku for entity extraction with structured JSON output  
**Output:** List of entity candidates with type labels, confidence scores, and source positions

### Agent 2 — Linker
**Trigger:** Ingestor output received  
**Job:** Match entity candidates against existing graph nodes → create new nodes for unknowns → draw edges between related entities  
**Stack:** LightRAG for graph construction and entity resolution → pgvector for semantic deduplication  
**Output:** Updated knowledge graph with new nodes and edges

### Agent 3 — Jargon
**Trigger:** Any incoming query OR during Ingestor entity extraction  
**Job:** Resolve industrial domain terminology — maps abbreviations, equipment tags, internal codes to canonical names  
**Pattern:** Golden-Retriever paper approach — disambiguation before retrieval  
**Stack:** Custom jargon dictionary seeded from document corpus + Claude Haiku for resolution  
**Example:** "P-101" → "Centrifugal pump, Feed water circuit, Unit 3" | "OEM manual XR-22" → "Kirloskar pump model KDS-550"

### Agent 4 — Traversal
**Trigger:** User query submitted via chat interface  
**Job:** Decompose query into graph traversal steps → walk the graph → collect evidence nodes → synthesize answer with citations  
**Stack:** LightRAG retrieval → Claude Haiku for answer synthesis  
**Output:** Answer + confidence score + source citations + traversal path shown to user

### Agent 5 — Risk
**Trigger:** Scheduled (runs nightly) OR on-demand dashboard load  
**Job:** Scan full graph → identify assets with high knowledge concentration in single Person nodes → score by asset criticality × knowledge concentration  
**Output:** Knowledge Risk Radar dashboard — ranked list of at-risk assets and the people who hold their knowledge

---

## 8. The Wow Demo Query

**"If Ramesh retires tomorrow, which machines lose their only expert?"**

### Why this query wins:
- Directly triggers the emotional core of PS #8 — the retiring engineer crisis
- Requires genuine multi-hop graph traversal (not keyword search)
- No existing enterprise tool answers this
- Immediately understood by any judge without technical explanation
- Maps exactly to the Knowledge Risk Radar feature

### Traversal path the agent walks:
```
Person: Ramesh Kumar
  → expert_on → [Pump P-101, Compressor C-3, Boiler B-7]
  → authored → [Maintenance Report #2341, SOP v3.2, Incident Log 2019]
  → fixed_incident → [Seal failure 2019, Bearing failure 2021]

For each Asset:
  → check: how many other Person nodes have edges to this asset?
  → if count = 1 (only Ramesh): flag as CRITICAL KNOWLEDGE RISK
  → if count > 1: flag as MODERATE (shared knowledge)

Output:
  CRITICAL: Pump P-101 — only Ramesh holds incident history and repair procedures
  CRITICAL: Compressor C-3 — only Ramesh has experience with the 2021 bearing failure
  MODERATE: Boiler B-7 — Ramesh + 1 other engineer (Priya Singh)
```

---

## 9. Tech Stack

| Layer | Tool | Why |
|---|---|---|
| PDF parsing | pdf-parse (npm) | Clean text + metadata extraction from PDFs. Sufficient for demo-quality documents. |
| DOCX parsing | mammoth (npm) | Converts DOCX to clean text/HTML. Battle-tested. |
| XLSX parsing | xlsx / SheetJS (npm) | Full spreadsheet parsing, reads all cell types |
| OCR (scanned) | tesseract.js (npm) | Client-side OCR for scanned forms and images. Pure Node, no Python. |
| Knowledge graph | Neo4j + neo4j-driver | Graph DB with Cypher queries. More controllable than LightRAG for hackathon. Direct graph visualization data. |
| Vector storage | pgvector + pg | Reuse existing LexVault stack. HNSW indexing. Semantic deduplication for entity resolution. |
| AI routing | Claude Haiku (@anthropic-ai/sdk) | Entity extraction, query answering, jargon resolution, agent tool use |
| AI routing | Claude Sonnet (@anthropic-ai/sdk) | Complex multi-hop reasoning, web-augmented queries |
| Agent orchestration | Custom — Anthropic SDK tool use | Raw tool_use API. No LangChain overhead. Full control. |
| Backend framework | Hono (Node.js) | Faster than Express, edge-ready, TypeScript-first |
| Frontend | Next.js | Chat UI + graph explorer + risk dashboard |
| Graph visualization | react-force-graph | Force-directed, handles 200+ nodes without lag |
| File uploads | multer | Multipart form handling in Hono/Node |
| Deployment | Railway | Node.js native, one-click deploy, free tier for demo |

---

## 10. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                             │
│   [Graph Explorer]    [Expert Copilot Chat]   [Risk Radar]      │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / SSE
┌───────────────────────────────▼─────────────────────────────────┐
│                    HONO BACKEND (Node.js / TypeScript)          │
│                        Agent Orchestrator                       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Ingestor   │  │   Linker    │  │ Jargon   │  │Traversal │  │
│  │   Agent     │  │   Agent     │  │  Agent   │  │  Agent   │  │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └────┬─────┘  │
│         │                │              │              │        │
│  ┌──────▼──────────────────────────────────────────────▼──────┐  │
│  │              Risk Agent (scheduled + on-demand)           │  │
│  └───────────────────────────────────────────────────────────┘  │
└───┬──────────────┬──────────────┬──────────────────────────────┘
    │              │              │
┌───▼────┐   ┌─────▼──────┐  ┌───▼──────────────────────────────┐
│Document│   │Claude Haiku│  │       PERSISTENCE LAYER          │
│Parsers │   │  + Sonnet  │  │  Neo4j (graph)  pgvector (embeds)│
│pdf-parse│  │@anthropic  │  │  Uploads folder (raw documents)  │
│mammoth │   │  /sdk      │  └──────────────────────────────────┘
│SheetJS │   └────────────┘
│tesseract│
└────────┘
```

---

## 11. Demo Script (90 seconds)

**Second 0–15 — The human story**
"25% of India's senior industrial engineers retire in the next decade. When they leave, the knowledge leaves with them. There's no system that captures it. Engram fixes that."

**Second 15–30 — Document drop**
Drop 3 documents: a 2019 maintenance failure report (PDF), a repair SOP (DOCX), and a parts list (XLSX). Engram ingests them in real time. Nodes appear on the graph as they're extracted.

**Second 30–50 — The graph**
Zoom into the graph. Show Pump P-101 connected to the 2019 Seal Failure incident, connected to Ramesh Kumar, connected to the Impeller Replacement Procedure, connected to SKF Bearing 6205. "This is institutional memory made visible."

**Second 50–70 — The wow query**
Type: "If Ramesh retires tomorrow, which machines lose their only expert?"
Engram traverses the graph. Returns: "CRITICAL: Pump P-101, Compressor C-3. MODERATE: Boiler B-7." With citations and confidence scores.

**Second 70–90 — The business case**
"Indian manufacturing loses ₹2.3 crore per facility per day to knowledge fragmentation. Engram pays back in 13 days."

---

## 12. Impact Model (Mandatory for Submission)

### The Numbers
| Metric | Value | Source |
|---|---|---|
| Worker time lost to searching | 35% | McKinsey 2024 global survey (cited in PS #8) |
| Average workers per large Indian plant | 500 | Industry estimate |
| Average fully-loaded cost per worker/day | ₹1,500 | Conservative estimate, Tier-1 Indian manufacturing |
| Daily knowledge fragmentation cost per facility | ₹2.6 crore | 500 × ₹1,500 × 35% |
| Engram search time reduction | 60% | Conservative vs RAG literature benchmarks |
| Daily saving per facility | ₹1.56 crore | ₹2.6 crore × 60% |
| Unplanned downtime reduction | 18–22% | BIS Research (cited in PS #8) |
| Target ARR per enterprise client | ₹50–75 lakh | SaaS pricing, Indian enterprise |
| Payback period for client | 13 days | ₹50L ARR ÷ ₹1.56 crore/day saving |

### Addressable Market (India)
- ~8,500 large manufacturing plants in India with 200+ workers (Ministry of Statistics)
- Target segment: Plants with ₹500 crore+ revenue = ~1,200 facilities
- At ₹60L ARR per facility: TAM = ₹7,200 crore (~$860M)

---

## 13. Judging Criteria Mapping

| Criterion | Weight | How Engram addresses it |
|---|---|---|
| Innovation | 25% | Graph-first approach vs chatbot-first. Knowledge Risk Radar has no existing equivalent. Visual graph UI is unique among expected submissions. |
| Business Impact | 25% | Quantified impact model. McKinsey + NASSCOM-EY data cited in the PS itself. Retiring workforce crisis is existential, not incremental. |
| Technical Excellence | 20% | 5-agent architecture with clear separation of concerns. LightRAG + Docling + Claude routing. Multi-hop graph traversal is technically demonstrable. |
| Scalability | 15% | Horizontal: same ontology works across pharma, steel, oil & gas, textile by swapping node taxonomy. Vertical: graph grows as more documents are added. |
| User Experience | 15% | Visual graph is immediately understandable. Chat interface is mobile-first. Confidence scores and citations are visible on every answer. |

---

## 14. Evaluation Criteria from PS #8 — How We Address Each

| PS Evaluation Metric | Engram's Answer |
|---|---|
| Entity extraction accuracy across document types | Docling handles structured + unstructured. Demo with 3 document types minimum. |
| Query answer quality on domain-expert benchmark | The wow query + 3 supporting queries prepared with ground-truth answers. |
| Knowledge graph linkage completeness | Demo shows edges across all 6 node types from a single document set. |
| Time-to-answer vs traditional search | Show: 45 seconds with Engram vs "call 3 people and wait 2 hours" without. |
| Compliance gap detection accuracy | Risk Radar flags undocumented assets and procedures with no owner. |
| Cross-functional knowledge discovery | Graph shows connections across Maintenance, Engineering, and Procurement data in one view. |

---

## 15. Out of Scope (Roadmap — say explicitly in pitch)

| Feature | Why deferred | When |
|---|---|---|
| P&ID / CAD drawing symbol detection | Requires ML training data we don't have time to collect | v1.1 (post-hackathon, using Azure P&ID digitization OSS) |
| Multi-tenant RBAC | Auth complexity not worth it for demo | v1.1 |
| Mobile offline mode for field technicians | PWA or React Native — separate build | v2.0 |
| Real IoT/SCADA live integration | Hardware dependency, can't simulate in hackathon | v2.0 |
| Multi-language support (Hindi, regional) | Translation layer is simple to add post-demo | v1.2 |

---

## 16. Synthetic Demo Data Spec

For the hackathon demo, we generate realistic fake data for a fictional Indian heavy manufacturing plant: **Bharat Engineering Works, Pune — Unit 3 (Cooling Water Circuit)**.

### Documents to create (pre-demo):
1. `Maintenance_Report_P101_2019.pdf` — Failure report: Pump P-101 seal failure, March 2019. Author: Ramesh Kumar. Root cause: cavitation. Resolution: impeller replacement + seal upgrade.
2. `SOP_Impeller_Replacement_v3.pdf` — Standard procedure for impeller replacement on KDS-550 pumps. Authored by Ramesh Kumar, reviewed by Plant Manager.
3. `Parts_Master_Unit3.xlsx` — Spare parts list for Unit 3 equipment. Includes SKF Bearing 6205, Mechanical Seal Type-A, O-ring sets.
4. `Incident_Log_2021_C3.docx` — Compressor C-3 bearing failure, August 2021. Fixed by Ramesh Kumar. References same bearing part number as P-101.
5. `Email_Archive_Ramesh_2020.txt` — 3 email threads where Ramesh troubleshoots P-101 and shares informal knowledge not captured anywhere else.

### Expected graph after ingestion:
- 6 Asset nodes, 3 Person nodes, 4 Incident nodes, 5 Document nodes, 3 Procedure nodes, 8 Part nodes
- ~40 edges across all relationship types
- Knowledge Risk Radar output: Ramesh is critical on 2 assets (P-101, C-3)

---

## 17. Deliverables Checklist

- [ ] Working prototype (hosted URL, accessible by judges)
- [ ] Public GitHub repository (clean README, architecture diagram in repo)
- [ ] Architecture diagram (included in this PRD, also as standalone PNG)
- [ ] Pitch deck (8–10 slides: problem, insight, product, demo, architecture, agents, impact model, roadmap, team)
- [ ] Demo video (90 seconds, screen record of the 4-step demo script above)
- [ ] Impact model (quantified, slide 7 of deck)

---

## 18. Build Priority Order

Given hackathon time constraints, build in this exact sequence:

**Phase 1 — Core pipeline (Day 1, first 8 hours)**
1. Docling integration — accepts PDF/DOCX/XLSX, outputs clean JSON
2. LightRAG setup — accepts Docling output, builds graph
3. Basic graph query — ask a question, get an answer with citations

**Phase 2 — Agent layer (Day 1, next 6 hours)**
4. Ingestor Agent — wraps Docling with Claude Haiku entity extraction
5. Linker Agent — wraps LightRAG graph construction
6. Traversal Agent — wraps LightRAG retrieval with Claude Haiku synthesis

**Phase 3 — Frontend (Day 2, first 8 hours)**
7. react-force-graph visual explorer — nodes visible, clickable
8. Chat UI — query input, answer display with confidence + citations
9. Document upload UI — drag and drop, ingestion status indicator

**Phase 4 — Differentiation (Day 2, last 4 hours)**
10. Jargon Agent — domain terminology resolution before retrieval
11. Risk Agent — Knowledge Risk Radar, single-point-of-failure flagging
12. Synthetic demo data — 5 documents, pre-ingested, ready for judges

**Phase 5 — Polish (Final 2 hours)**
13. Demo script rehearsal
14. GitHub README + architecture diagram
15. Impact model slide

---

*Engram — Don't let your best engineers take your institutional knowledge with them.*
