---
name: compliance-language
description: Approved and forbidden phrasing for sanctions screening UI and prompts
metadata:
  type: feedback
---

**Use:** "potential match", "review recommended", "flagged for analyst review", "screening aid — not a determination".

**Avoid:** "confirmed sanctioned", "guilty", "blocked entity", "OFAC violation confirmed".

**Why:** Product is decision support for VC compliance officers, not a legal or government determination engine.

**How to apply:** Enforce in system prompts (`chat.ts`), workflow `prompt_md`, and Claude `explain.ts` narratives.
