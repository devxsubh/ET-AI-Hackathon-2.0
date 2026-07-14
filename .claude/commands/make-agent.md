# /make-agent — Create a New Claude Code Agent

Create a fully-wired custom agent for the current project, including system prompt scaffold and the persistent memory system.

## Arguments

`$ARGUMENTS` may contain the agent name directly (e.g. `/make-agent code-reviewer`). If empty, collect the details interactively before proceeding.

## Steps

### 1. Gather agent details

If `$ARGUMENTS` is non-empty, use it as the agent `name`. Otherwise ask the user:
- **name** — kebab-case identifier (e.g. `code-reviewer`, `test-writer`)
- **purpose** — one sentence describing what this agent does and when to trigger it
- **model** — `sonnet` (default, capable), `haiku` (fast/cheap), or `opus` (most powerful)
- **color** — one of: `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `gray`

### 2. Detect project root

Run:
```bash
git rev-parse --show-toplevel
```
Store the result as `PROJECT_PATH`. If not in a git repo, use the current working directory.

### 3. Build the agent file content

Construct the full `.claude/agents/{name}.md` file with this structure:

```markdown
---
name: "{name}"
description: "Use this agent when {purpose}.\n\n<example>\nContext: [describe a realistic scenario]\nuser: \"[example user message]\"\nassistant: \"[how Claude would invoke this agent]\"\n<commentary>\n[Why this triggers the agent]\n</commentary>\n</example>\n\n<example>\nContext: [second scenario]\nuser: \"[example]\"\nassistant: \"[response]\"\n<commentary>\n[commentary]\n</commentary>\n</example>"
model: {model}
color: {color}
memory: project
---

You are an expert in [domain]. [One paragraph establishing the agent's persona and specialty.]

## Core Responsibilities

1. [Primary responsibility]
2. [Secondary responsibility]
3. [Tertiary responsibility]

---

## How to Approach Tasks

[Step-by-step methodology the agent follows]

---

## Output Format

[How the agent structures its responses — sections, severity levels, tables, etc.]

---

## Behavioral Guidelines

- [Key constraint 1]
- [Key constraint 2]
- [Key constraint 3]

---

**Update your agent memory** as you discover recurring patterns, project-specific decisions, and user preferences relevant to your domain. This builds institutional knowledge across conversations.
```

Then append the full contents of `.claude/templates/agent-memory-system.md`, replacing every occurrence of `{{AGENT_NAME}}` with the actual agent name and `{{PROJECT_PATH}}` with the actual project path.

### 4. Write files

1. Write the constructed content to `.claude/agents/{name}.md`
2. Create the directory `.claude/agent-memory/{name}/`
3. Write an empty `MEMORY.md` index to `.claude/agent-memory/{name}/MEMORY.md`:
   ```markdown
   # Memory Index
   <!-- Add entries here as: - [Title](file.md) — one-line description -->
   ```

### 5. Report

Print a summary:
```
Created agent: .claude/agents/{name}.md
Memory dir:    .claude/agent-memory/{name}/
Memory index:  .claude/agent-memory/{name}/MEMORY.md

Next steps:
  1. Edit .claude/agents/{name}.md — fill in the system prompt body with domain-specific content
  2. Add 2-3 realistic <example> blocks to the description frontmatter
  3. Restart Claude Code (or reload the window) to load the new agent
```

## Notes

- The `memory: project` frontmatter field tells Claude Code to inject the agent-memory contents into the agent's context each conversation.
- The description field drives auto-triggering — spend time on realistic examples; they matter more than the body prose.
- Do not omit the memory system append step — the agent will not persist learning across sessions without it.
