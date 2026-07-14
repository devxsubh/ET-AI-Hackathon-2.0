# /compliance-agent-feature — Add a Chat Tool End-to-End (compliance platform Style)

Add a new capability to the RTP Global agent loop: backend tool + executor + optional UI event.

**Arguments:** `$ARGUMENTS` = short feature name (e.g. `compare-screenings`, `export-ic-memo`).

---

## Step 1 — Specify the tool

Ask (or infer from `$ARGUMENTS`):

- **Tool name** — snake_case, verb-led (`get_entity_details`, not `entity`)
- **When Claude should call it** — one sentence for `description`
- **Inputs** — JSON schema properties
- **Output** — plain text JSON summary for the model (keep < 4KB)
- **Side effects** — updates `screeningResult`? writes MongoDB? calls external API?

---

## Step 2 — Backend

Edit `backend/src/lib/chatTools.ts`:

1. Add entry to `SCREENER_TOOLS`
2. Add `case` in `createToolExecutor()` — call pure logic from `lib/`, never nest LLM calls inside tools unless explicitly requested

If the tool needs new domain logic, add `backend/src/lib/{feature}.ts` and unit-testable functions.

Update `backend/src/routes/chat.ts` system prompt if the tool needs special invocation rules.

---

## Step 3 — Frontend events (compliance platform UI)

Match existing patterns in `frontend/src/app/components/shared/types.ts`:

```typescript
| { type: "tool_call_start"; name: string; isStreaming?: boolean }
```

Optional domain events later (like compliance platform doc_read`, `workflow_applied`):

```typescript
| { type: "screening_complete"; flaggedCount: number; ... }
```

Wire in `useAssistantChat` / `useScreenerChat` when mapping `toolActivity` from API response.

Add human label in `TOOL_LABELS` (`screenerApi.ts`).

---

## Step 4 — Compliance check

Every new tool must:

- [ ] Not assert sanctions guilt — use `flagged` / `review` / `clear` language only
- [ ] Log match scores from Watchman, not invented values
- [ ] Fail gracefully when Watchman down (clear error string to model)
- [ ] Respect rate limits on expensive operations

Invoke `compliance-security-auditor` agent if the tool handles PII export or cross-border data.

---

## Step 5 — Document

- Add one line to root `CLAUDE.md` tool table
- Append entry to `.claude/agent-memory/project/tools-registry.md`

---

## Example: `compare_screenings`

```
Tool: compare_screenings
Input: { entity_name: string }
Logic: diff current screeningResult vs startup.lastScreeningResult from MongoDB
Output: "Alpha Ventures: review→flagged, score 0.82→0.96"
```
