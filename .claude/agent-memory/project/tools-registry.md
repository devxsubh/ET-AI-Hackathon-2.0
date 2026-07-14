---
name: tools-registry
description: Screener chat tools registered in chatTools.ts
metadata:
  type: reference
---

| Tool | Purpose |
|---|---|
| `screen_cap_table` | Parse CSV → graph → Watchman → classify → explain |
| `get_screening_summary` | Counts + top flagged/review list |
| `get_entity_details` | One entity: risk, score, path, analyst note |
| `list_entities` | Filter by risk_filter |

**Why:** Tools are the structured "retrieval" layer — model must call these instead of inventing screening data.

**How to apply:** New screening capabilities → add here + `SCREENER_TOOLS` + `/compliance-agent-feature` checklist.
