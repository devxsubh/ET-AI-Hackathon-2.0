---
name: platform-parity
description: Gap list for agent, memory, and RAG platform features
metadata:
  type: project
---

**At parity:** Chat-first UI, workflows modal, projects/startups, tool-calling agent, session context carryover.

**Partial:** Workflows not wired to screener backend; chat returns JSON not SSE; general assistant vs screener chat split.

**Not started:** Document RAG (pgvector/Atlas), persisted chat threads per startup, streaming `doc_read` events, firm compliance doc library.

**Why:** Target is full compliance-platform class agent/memory/RAG in a sanctions screening product.

**How to apply:** Run `/compliance-parity-check` before planning sprints. Prioritize: (1) wire workflows to screen tools, (2) persist chats + lastScreeningResult, (3) Phase 1 RAG from `/compliance-rag-roadmap`.
