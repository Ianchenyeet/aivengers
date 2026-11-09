---
applyTo: "**"
description: Multi-agent collaboration workspace instructions for GitHub Copilot
---

# GitHub Copilot Workspace Protocol (`vibe coding tools`)

You are operating inside a **Collaborative Multi-Agent Workspace**.
You collaborate directly with human users and peer AI agents (e.g., `@Antigravity`, `@Claude`, `@Cursor`).

---

## ⚡ Core Operational Instructions

### 1. Ingest User Instructions First
- At the start of every session or task turn, check **`USER_INBOX.md`**.
- Read `## ⚡ Active User Directives` and `## 🎯 High-Level Project Goals & Priorities`.
- Treat directives in `USER_INBOX.md` as the official instruction source from the user.
- Check `instructions/` if the directive references deep specifications.

### 2. Task Planning & Concurrency Protection (`TASKS.md`)
- Always inspect **`TASKS.md`** before writing or editing files.
- **Claiming Tasks:** Before you edit code, claim the task by updating `TASKS.md`:
  - Set `Status: [IN PROGRESS]`
  - Set `Assigned Agent: @Copilot`
  - Fill in `Locked Files:` with every file you will modify.
- **File Locks:** Never modify files listed under `Locked Files` of another active agent's task.
- **Finishing Work:** When finished and verified, update status to `[IN REVIEW]` (if requesting Antigravity/user verification) or `[DONE]`.

### 3. Agent-to-Agent Communication (`AGENT_COMMUNICATION.md`)
- Check **`AGENT_COMMUNICATION.md`** for any unread messages addressed to `@Copilot` or `@All`.
- If you need input from `@Antigravity` or want to hand off a task (e.g. backend completed, requesting API integration or review), append a new message thread under `## 🧵 Active Threads` in `AGENT_COMMUNICATION.md`:
  - Use format: `@Antigravity: [HANDOFF / QUESTION / REVIEW_REQUEST] ...`
- When you resolve a request, mark its status as `[RESOLVED]`.

### 4. Architectural Consensus (`DECISIONS.md`)
- Check **`DECISIONS.md`** before selecting new libraries, tools, or major architectural patterns.
- Do not reverse or contradict existing ADRs without user direction.
- Document any new significant technical decisions in `DECISIONS.md`.

### 5. Activity Logging (`ACTIVITY_LOG.md`)
- Append an entry in **`ACTIVITY_LOG.md`** with timestamp, your tag (`@Copilot`), and summary of files modified.

### 6. Discord Remote Protocol
- If using `discord-agent-bridge`, follow the protocol in `discord-agent-bridge.instructions.md`: identify yourself as `GitHub Copilot`, use clear spacing, and send milestone/session reports when appropriate.
