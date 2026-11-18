---
applyTo: "**"
description: Multi-agent collaboration workspace instructions for GitHub Copilot
---

# GitHub Copilot Workspace Protocol (`vibe coding tools`)

You are operating inside the **`vibe coding tools`** drop-in multi-agent collaboration workspace.

---

## 📦 Drop-In Portability & Zero Cross-Dependency Rule
- When assembled, read project files **outside** `vibe coding tools` to understand and build the host project.
- **Zero Cross-Dependencies:** No file outside `vibe coding tools` may depend on anything inside `vibe coding tools`, and no file inside `vibe coding tools` may hardcode dependencies on files outside `vibe coding tools`.

---

## ⚡ Default Behavior (Normal Prompts)
When the user sends normal prompts or code edits without `/assemble`:
- Treat it as a standard single-agent request and respond directly.
- Do NOT read `USER_INBOX.md`, modify `TASKS.md`, or notify other agents.

---

## 🚀 Workspace Assembly Mode: `/assemble` (8-Step Team Workflow)
When the user enters `/assemble` (or triggers `.github/prompts/assemble.prompt.md`):

1. **Read `USER_INBOX.md` & Assemble:**
   - Read `USER_INBOX.md` for user directives, role assignments, `Main` agent designation (chosen in Slot 1 of the Vibe Coding tab or specified in `USER_INBOX.md`), any attached files/folders, and participating agents. When a session contains multiple messages (`Message 1`, `Message 2`, ...), always work on the one marked **`LATEST`** and treat earlier messages as session context.
   - Run `node scripts/hub.js assemble "@Copilot"`.

2. **Gather Context & Read Receipts:**
   - Read `.github/copilot-instructions.md`, `TASKS.md`, and `AGENT_COMMUNICATION.md`.
   - Check unread messages (`node scripts/hub.js unread "@Copilot"`) and confirm read (`node scripts/hub.js read all "@Copilot"`).
   - Inspect relevant project files **outside** `vibe coding tools` (read-only during planning).

3. **Wait for All Participating Agents (No Outside Edits While Waiting!):**
   - Run `node scripts/hub.js health` or `node scripts/hub.js wait-team --timeout 180`.
   - While waiting for teammates to join, you may discuss and draft a plan inside `vibe coding tools`, **without editing or deploying any project files outside `vibe coding tools`**.
   - If waiting times out after a long time, `@Main` (or `@Copilot` if acting as `Main`) asks the user in the **VS Code AIvengers tab** (`node scripts/hub.js poll --agent "@Copilot" ...`) whether to start without the missing teammate(s).

4. **Plan Together with the Whole Team:**
   - Once all participants are online, review any preliminary draft plan in `TASKS.md` / `AGENT_COMMUNICATION.md`, offer suggestions/improvements, and agree on the team plan.

5. **User Plan Approval Gate (VS Code AIvengers Tab):**
   - `Main` sends the agreed team plan to the VS Code AIvengers tab via `node scripts/hub.js report --type checkpoint` + interactive poll `node scripts/hub.js poll` (approving the poll unlocks execution) and runs `node scripts/hub.js plan review`.
   - Wait until user poll approval or `Main` announces approval (`node scripts/hub.js plan approve`) before editing any project files outside `vibe coding tools`.

6. **Execute Tasks & Respect File Locks:**
   - If `@Copilot` is assigned as `Main`, act as **Team Manager** (take less code-writing work, coordinate teammates, and verify work quality).
   - Claim tasks before coding: `node scripts/hub.js claim TASK-xxx "@Copilot" "path/to/file"`.
   - Never touch files locked by another active agent, and never lock shared coordination files (`TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, `VIBE_FEED.json`).
   - Periodically check `AGENT_COMMUNICATION.md` and work on other tasks while waiting on non-blocking replies.

7. **Credit Exhaustion / Offline Detection & `Substitute Main` Failover:**
   - Check team health via `node scripts/hub.js health` (passively detects `CREDIT_EXHAUSTED` and `OFFLINE` from live logs in `<5ms`).
   - If `Main` runs out of credits or disconnects unexpectedly, `hub.js health` promotes `@Copilot` to **`Substitute Main`**. Immediately call `node scripts/hub.js poll --agent "@Copilot (Substitute Main)"` to notify the user and ask whether to take over `Main`'s tasks, continue without them, or wait.

8. **Milestone Reports, Standby Helping & Final Summary (`Main` Only):**
   - **Signal-Only Feed:** Only structured **reports, questions, and polls** appear in the VS Code AIvengers tab (`VIBE_FEED.json`) — casual chatter/thanks are filtered out. Send milestones via `node scripts/hub.js report --agent "@Copilot" --type milestone ...` and ask questions via `node scripts/hub.js ask` / `poll`.
   - If you finish your tasks early, stay `IDLE` (`node scripts/hub.js idle "@Copilot" "Standing by to help"`) and ask teammates in `AGENT_COMMUNICATION.md` if they need assistance.
   - **Only `Main` (or `Substitute Main`)** sends the `final_summary` report AND posts a **`[SIGN-OFF]`** message to `@All` in `AGENT_COMMUNICATION.md` (`node scripts/hub.js msg --from "@Copilot" --to "@All" --type "SIGN-OFF" ...`) so waiting teammates know the task is finished before going `OFFLINE`.
