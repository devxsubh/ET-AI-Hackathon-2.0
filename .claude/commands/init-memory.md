# /init-memory — Initialize Project Memory System

Set up the persistent project-level memory directory that Claude Code uses to remember context across conversations for this project.

## Steps

### 1. Detect project root

Run:
```bash
git rev-parse --show-toplevel
```
Store as `PROJECT_PATH`. If not in a git repo, use `pwd`.

### 2. Derive the memory directory path

Claude Code stores project memory at:
```
~/.claude/projects/{escaped-path}/memory/
```

where `{escaped-path}` is the absolute project path with `/` replaced by `-` and leading `-` stripped.

Example: `/Users/alice/code/my-app` → `-Users-alice-code-my-app` → memory lives at `~/.claude/projects/-Users-alice-code-my-app/memory/`

Compute this path by running:
```bash
PROJECT_PATH=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ESCAPED=$(echo "$PROJECT_PATH" | tr '/' '-')
echo "$HOME/.claude/projects/${ESCAPED}/memory"
```

### 3. Create the memory directory

```bash
mkdir -p {memory_dir}
```

### 4. Write the MEMORY.md index

If `{memory_dir}/MEMORY.md` already exists, skip this step and report that memory is already initialized.

Otherwise, create `{memory_dir}/MEMORY.md`:

```markdown
# Memory Index

<!-- One line per memory file: - [Title](file.md) — one-line hook (max 150 chars) -->
<!-- Organize semantically by topic, not chronologically -->
<!-- Keep this index under 200 lines — it is always loaded into context -->
```

### 5. Note the path in CLAUDE.md (optional but recommended)

If a `CLAUDE.md` file exists at the project root and does not already mention the memory path, append a short note:

```markdown
## Project Memory

Persistent memory lives at `~/.claude/projects/{escaped-path}/memory/MEMORY.md`.
Agent + project seed memories: `.claude/agent-memory/project/MEMORY.md`.
Claude Code config: `.claude/PROJECT.md` (compliance platform parity map).
Use `/init-memory` to re-initialize if the directory is missing.
```

Also ensure `.claude/agent-memory/project/MEMORY.md` exists (seed from this repo if missing).

### 6. Report

```
Memory initialized at: ~/.claude/projects/{escaped-path}/memory/
Index file:            ~/.claude/projects/{escaped-path}/memory/MEMORY.md

Claude Code will now persist project-level memory across conversations.
Add entries to MEMORY.md as: - [Title](file.md) — one-line hook
```

## Notes

- This sets up the **project-level** memory (used by the main Claude Code session). Agent-specific memory lives inside the project at `.claude/agent-memory/{agent-name}/` — use `/make-agent` to set that up.
- Memory files should be short, topical `.md` files — one fact/decision per file. The index (`MEMORY.md`) is always loaded; individual files are read on demand.
- Run this once per project. If `MEMORY.md` already exists, the command is a no-op.
