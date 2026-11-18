---
name: assemble
description: >-
  Assemble Antigravity into the multi-agent collaboration workspace, read casual user directives from USER_INBOX.md, wait for participating teammates, co-author and submit the team plan to the VS Code AIvengers tab for user approval, coordinate as Main/Manager with automatic credit-exhaustion failover, and execute tasks safely. Use when the user invokes /assemble or asks to assemble into the workspace.
---

# Multi-Agent Workspace Assembly (`/assemble`)

Use this skill when the user triggers `/assemble` (or `/collab`) to join the `vibe coding tools` multi-agent collaboration workspace.

## 📦 Portability & Zero Cross-Dependency Rule
- Read project files **outside** `vibe coding tools` to understand and build the host project.
- **Never** make any file outside `vibe coding tools` import/depend on anything inside `vibe coding tools`, and never hardcode outside file dependencies inside `vibe coding tools`.

## 🔄 8-Step Default Team Workflow

1. **Read `USER_INBOX.md` & Announce Assembly:**
   - Read `USER_INBOX.md` for user goals, role assignments, `Main` designation (chosen in Slot 1 of the Vibe Coding tab or specified in `USER_INBOX.md`), any attached files/folders, and participating agents. When multiple prompts exist (`Message 1`, `Message 2`, ...), work on the message marked **`LATEST`**.
   - Run:
     ```bash
     node scripts/hub.js assemble "@Antigravity"
     ```

2. **Gather Context & Confirm Unread Messages:**
   - Read your own `.md` file (`GEMINI.md` / `AGENTS.md`), `TASKS.md`, and `AGENT_COMMUNICATION.md`.
   - Check and acknowledge unread messages:
     ```bash
     node scripts/hub.js unread "@Antigravity"
     node scripts/hub.js read all "@Antigravity"
     ```
   - Inspect relevant project files outside `vibe coding tools` (read-only during planning).

3. **Wait for All Participating Agents (No Outside Edits While Waiting!):**
   - Check team health and wait for all expected teammates to come online:
     ```bash
     node scripts/hub.js health
     node scripts/hub.js wait-team --timeout 180
     ```
   - **While waiting:** You may analyze code and draft preliminary plans with already-assembled agents inside `vibe coding tools` (`TASKS.md` / `AGENT_COMMUNICATION.md`), **without editing or deploying any project files outside `vibe coding tools`**.
   - **Timeout Poll:** If waiting times out and a teammate still hasn't joined, ask via `node scripts/hub.js poll` in the VS Code AIvengers tab whether to start without the missing agent(s).

4. **Make / Revise the Plan with the Whole Team:**
   - Once all participating agents are online, review any preliminary draft plan together. Newly joined agents review the draft in `TASKS.md` / `AGENT_COMMUNICATION.md` and contribute ideas or adjustments.
   - Record the agreed team plan:
     ```bash
     node scripts/hub.js plan draft "@Antigravity" "Summary of agreed plan and task breakdown"
     ```

5. **Submit Plan to VS Code AIvengers Tab for Approval (`Main` Gate):**
   - Once the team agrees on a thorough plan, `Main` (whichever agent was chosen in Slot 1 / designated `Main`) submits it via `node scripts/hub.js report --type checkpoint` + interactive poll `node scripts/hub.js poll` (approving the poll automatically unlocks execution).
   - Mark plan as under user review:
     ```bash
     node scripts/hub.js plan review "@Antigravity" "Submitted plan for user approval"
     ```
   - Wait for user approval before editing any files outside `vibe coding tools`.

6. **Approved Execution & `Main` as Manager:**
   - After user approval, unlock execution and notify the team:
     ```bash
     node scripts/hub.js plan approve "@Antigravity" "Approved by user"
     ```
   - **`Main` Acts as Manager:** Take on **less raw code-writing work** than other teammates; assign tasks according to roles, monitor teammates (`node scripts/hub.js health`), keep everyone aligned, and verify code/test quality.
   - Claim tasks and lock implementation files before editing (`node scripts/hub.js claim TASK-001 "@Antigravity" "path/to/file"`). Never lock shared hub files (`TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, `VIBE_FEED.json`).
   - Check `AGENT_COMMUNICATION.md` periodically and work on other tasks while waiting on non-blocking replies.

7. **Passive Credit-Exhaustion / Offline Detection & `Substitute Main` Failover:**
   - `node scripts/hub.js health` and `node scripts/hub.js peers` passively inspect live IDE transcripts and OS processes in `<5ms` without requiring manual agent check-ins.
   - If a teammate drops `OFFLINE` or hits `CREDIT_EXHAUSTED`, `Main` calls `node scripts/hub.js poll` to ask the user whether to reassign their incomplete tasks, continue without them, or wait.
   - If `Main` dies or runs out of credits, `hub.js health` automatically promotes the next online teammate to **`Substitute Main`**, who notifies the user in the AIvengers tab instead.

8. **Milestone Reports, Standby Helping & `Main`-Only Final Report:**
   - **Signal-Only Feed:** Only reports, questions, and polls appear in the VS Code AIvengers tab (`VIBE_FEED.json`) — never casual chatter/thanks. Any agent may post milestones via `node scripts/hub.js report --type milestone`.
   - Agents finishing early stay `IDLE` and ask teammates in `AGENT_COMMUNICATION.md` if they need help.
   - **Only `Main` (or `Substitute Main`)** sends the final `final_summary` report after all tasks are `[DONE]` and verified, AND posts a **`[SIGN-OFF]`** message to `@All` in `AGENT_COMMUNICATION.md` (`node scripts/hub.js msg --from "@Antigravity" --to "@All" --type "SIGN-OFF" ...`) so waiting teammates know the session is finished before all agents go `OFFLINE`.
