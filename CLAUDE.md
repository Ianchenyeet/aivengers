# Claude Code Collaboration Protocol (`CLAUDE.md`)

You are operating inside the **`vibe coding tools`** drop-in multi-agent collaboration hub.

---

## 📦 Drop-In Portability & Zero Cross-Dependency Rule
- Read project files **outside** `vibe coding tools` to analyze and implement features.
- **Never** create dependencies from files outside `vibe coding tools` into `vibe coding tools`, and never hardcode outside file dependencies inside `vibe coding tools`.

---

## ⚡ Default Mode (Normal Prompts)
For standard prompts without `/assemble`:
- Respond and code normally as a single agent. Do NOT read `USER_INBOX.md` or modify `TASKS.md`.

---

## 🚀 Assembly Mode: `/assemble` (8-Step Team Workflow)
When the user types `/assemble`:

1. **Read `USER_INBOX.md` & Assemble:**
   - Read `USER_INBOX.md` for user goals, roles, `Main` agent designation (chosen in Slot 1 of the Vibe Coding tab or specified in `USER_INBOX.md`), any attached files/folders, and participating agents. If multiple messages exist (`Message 1`, `Message 2`, ...), always work on the one marked **`LATEST`** using earlier messages as session context.
   - Run `node scripts/hub.js assemble "@Claude"`.
2. **Gather Context:**
   - Read `CLAUDE.md`, `TASKS.md`, `AGENT_COMMUNICATION.md`, and inspect relevant project files outside `vibe coding tools`.
   - Confirm unread messages: `node scripts/hub.js unread "@Claude"` and `node scripts/hub.js read all "@Claude"`.
3. **Wait for All Participating Agents (No Outside Edits While Waiting!):**
   - Run `node scripts/hub.js health` or `node scripts/hub.js wait-team --timeout 180`.
   - While waiting, you may discuss and draft plans inside `vibe coding tools`, **without editing or deploying any files outside `vibe coding tools`**.
   - If waiting times out, `@Main` (or you if you are `Main`/`Substitute Main`) asks the user in the **VS Code AIvengers tab** (`node scripts/hub.js poll --agent "@Claude" ...`) whether to start without the missing agent(s).
4. **Plan Together with the Team:**
   - Review any draft plan in `TASKS.md` / `AGENT_COMMUNICATION.md`, contribute suggestions, and agree on task breakdown and roles.
5. **User Plan Approval via `Main`:**
   - `Main` submits the agreed plan to the VS Code AIvengers tab via `node scripts/hub.js report --type checkpoint` + interactive poll `node scripts/hub.js poll` (approving the poll unlocks execution), then marks `node scripts/hub.js plan review`. Do not edit outside project files until `Main` marks `node scripts/hub.js plan approve` or poll approval unlocks execution.
6. **Execute & Coordinate:**
   - Claim tasks (`node scripts/hub.js claim TASK-xxx "@Claude" "path/to/file"`) and respect file locks. Never lock shared coordination files (`TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, `VIBE_FEED.json`).
   - If assigned as `Main`, act as **Manager** (take less writing work, coordinate teammates, and verify quality).
   - Periodically check `AGENT_COMMUNICATION.md` and work on other tasks while waiting on non-blocking replies.
7. **Credit Exhaustion / Offline Failover:**
   - Check peer health via `node scripts/hub.js health` (passively detects `CREDIT_EXHAUSTED` and `OFFLINE`).
   - If `Main` goes offline or runs out of credits and `hub.js health` designates `@Claude` as **`Substitute Main`**, immediately notify the user via `node scripts/hub.js poll --agent "@Claude (Substitute Main)"` asking whether to reassign tasks, continue without them, or wait.
8. **Reporting & Completion:**
   - **Only reports, questions, and polls** appear in the VS Code AIvengers tab (`VIBE_FEED.json`) — do not post casual chatter or thanks there. Send milestone updates via `node scripts/hub.js report --agent "@Claude" --type milestone ...`, and ask questions via `node scripts/hub.js ask` / `poll`.
   - If you finish early, stay `IDLE` and ask teammates in `AGENT_COMMUNICATION.md` if they need help.
   - **Only `Main` (or `Substitute Main`)** sends the `final_summary` report AND posts a **`[SIGN-OFF]`** message to `@All` in `AGENT_COMMUNICATION.md` (`node scripts/hub.js msg --from "@Claude" --to "@All" --type "SIGN-OFF" ...`) so waiting teammates know the task is finished before going `OFFLINE`.
