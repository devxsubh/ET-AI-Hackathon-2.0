#!/usr/bin/env bash
# .claude/hooks/log-commands.sh
# Logs every tool call Claude Code makes to a JSONL file

INPUT=$(cat)   # reads the JSON payload from stdin

# Extract fields
TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
CMD=$(echo "$INPUT"  | jq -r '.tool_input.command // .tool_input.file_path // "n/a"')
SESSION=$(echo "$INPUT" | jq -r '.session_id // "n/a"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

LOG_DIR=".claude/logs"
LOG_FILE="$LOG_DIR/commands.jsonl"

mkdir -p "$LOG_DIR"

# Write one JSON line per tool call
echo "{\"timestamp\":\"$TIMESTAMP\",\"session\":\"$SESSION\",\"tool\":\"$TOOL\",\"input\":\"$CMD\"}" >> "$LOG_FILE"

exit 0   # always exit 0 — logging should never block execution