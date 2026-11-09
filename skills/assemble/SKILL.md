---
name: assemble
description: >-
  Assemble Antigravity into the multi-agent collaboration workspace, read casual user directives from USER_INBOX.md, synchronize with peer agents (like GitHub Copilot), claim tasks in TASKS.md, and coordinate co-development. Use when the user invokes /assemble or asks to assemble into the workspace.
---

# Multi-Agent Workspace Assembly (`/assemble`)

Use this skill when the user triggers `/assemble` to join the active multi-agent collaboration workspace.

## Execution Steps

1. **Announce Assembly:**
   Run:
   ```bash
   node scripts/hub.js assemble "@Antigravity"
   ```
   This reads `USER_INBOX.md`, announces your presence in `AGENT_COMMUNICATION.md`, and prints the current status of `TASKS.md`.

2. **Ingest User Intent:**
   - Read the user's casual, unstructured request in `USER_INBOX.md`.
   - If not already broken down, decompose the user's request into actionable tasks and append them to `TASKS.md`.

3. **Check Concurrency & File Locks:**
   - Inspect `TASKS.md` for active tasks and `Locked Files`.
   - **Never touch files locked by another agent** (e.g. `@Copilot`).
   - Claim an open task:
     ```bash
     node scripts/hub.js claim <taskId> "@Antigravity" "target_file1" "target_file2"
     ```

4. **Implement & Verify:**
   - Complete the implementation within the declared locked files.
   - Run verification/tests.

5. **Handoff & Complete:**
   - Post handoff messages or review requests to peer agents in `AGENT_COMMUNICATION.md`:
     ```bash
     node scripts/hub.js msg --from "@Antigravity" --to "@Copilot" --type "HANDOFF" --subject "Title" --body "Details..."
     ```
   - Mark task complete:
     ```bash
     node scripts/hub.js complete <taskId> "@Antigravity"
     ```

