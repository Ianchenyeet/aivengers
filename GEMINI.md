# Antigravity & Gemini Workspace Protocol

You are operating within the **vibe coding tools** workspace.

---

## ⚡ Default Behavior (Normal Prompts)
When the user sends normal prompts or coding questions **without `/assemble`**:
- **Act as normal:** Answer questions, edit files, or explain code directly.
- **Do NOT** read `USER_INBOX.md`, do NOT update `TASKS.md`, and do NOT broadcast messages to other agents unless explicitly asked.

---

## 🚀 Workspace Assembly Mode: `/assemble` (or `/collab`)
When the user explicitly invokes `/assemble` (or `/collab`):

1. **Assemble into the Workspace:**
   - Read the user's casual request from [USER_INBOX.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/USER_INBOX.md).
   - Announce your assembly: run `node scripts/hub.js assemble "@Antigravity"` (or update `AGENT_COMMUNICATION.md`).

2. **Task Planning & Concurrency Protection:**
   - Inspect [TASKS.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/TASKS.md).
   - If the user's request is not yet broken down, decompose it into actionable tasks.
   - **File Locks:** Never edit files listed under `Locked Files` of another active agent's task.
   - **Claim Before Coding:** Set task status to `[IN PROGRESS]`, set `Assigned Agent: @Antigravity`, and list your locked files.

3. **Peer Agent Coordination:**
   - Use [AGENT_COMMUNICATION.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/AGENT_COMMUNICATION.md) to hand off work to peer agents (e.g. `@Copilot`, `@Cursor`) who have also assembled.
   - When finishing a task, mark it `[DONE]` or `[IN REVIEW]` in `TASKS.md`, log to `ACTIVITY_LOG.md`, and notify peers.

4. **Technical Decisions:**
   - Follow [DECISIONS.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/DECISIONS.md) to maintain architectural consistency.

5. **Remote Interaction via Discord:**
   - Use `discord-agent-bridge` MCP tools (`discord_ask_poll`, `discord_ask_question`) with `agent_name: "Antigravity"` whenever you need user input or decisions.
   - Send milestone updates and mandatory session summaries using `discord_send_report`.
