---
applyTo: "**"
description: Multi-agent collaboration workspace instructions for GitHub Copilot
---

# GitHub Copilot Workspace Protocol (`vibe coding tools`)

## ⚡ Default Behavior (Normal Prompts)
When the user sends normal prompts or code edits without `/assemble`:
- Treat it as a standard request and respond directly.
- Do NOT read `USER_INBOX.md`, modify `TASKS.md`, or notify other agents.

---

## 🚀 Workspace Assembly Mode: `/assemble`
When the user enters `/assemble` (or triggers the `.github/prompts/assemble.prompt.md` prompt):

1. **Assemble into Collaboration:**
   - Read the user's plain-English directive from `USER_INBOX.md`.
   - Announce assembly to peers by running `node scripts/hub.js assemble "@Copilot"` or posting a message to `AGENT_COMMUNICATION.md`.

2. **Check Tasks & Anti-Collision Locks:**
   - Review `TASKS.md` for active tasks and locks.
   - Never touch files marked under `Locked Files` of another active agent.
   - Claim an unassigned task: update status to `[IN PROGRESS]`, set `Assigned Agent: @Copilot`, and list files you will modify under `Locked Files`.

3. **Coordinate & Handoff:**
   - Communicate with peer agents (e.g. `@Antigravity`, `@Cursor`) using `AGENT_COMMUNICATION.md`.
   - When finished, mark `[DONE]` or `[IN REVIEW]` in `TASKS.md` and log to `ACTIVITY_LOG.md`.

4. **User Communication via Discord:**
   - Whenever you need to ask questions, clarify requirements, or get user decisions, use `discord_ask_poll` (for multiple choice) or `discord_ask_question` with `agent_name: "GitHub Copilot"`.
   - Send milestone or final session reports using `discord_send_report`.
