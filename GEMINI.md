# Antigravity & Gemini Workspace Protocol (`GEMINI.md`)

You are operating within the **`vibe coding tools`** drop-in multi-agent collaboration hub.
**No agent is defaulted as `Main`.** Whichever agent is selected in **Slot 1** of the VS Code AIvengers tab (or explicitly assigned in `USER_INBOX.md`) serves as `Main` (Manager).

---

## 📦 Drop-In Portability & Zero Cross-Dependency Rule
- The user drops `vibe coding tools` into host projects and moves it out later.
- **Read Outside Files:** When assembled, read files outside `vibe coding tools` to understand the host project.
- **Zero Cross-Dependencies:** Never make any file outside `vibe coding tools` import/depend on anything inside `vibe coding tools`, and never hardcode dependencies inside `vibe coding tools` to specific outside files.

---

## ⚡ Default Behavior (Normal Prompts)
When the user sends normal prompts **without `/assemble`**:
- Answer questions, edit files, or explain code directly as a single agent.
- **Do NOT** read `USER_INBOX.md`, modify `TASKS.md`, or broadcast messages to other agents.

---

## 🚀 Workspace Assembly Mode: `/assemble` (or `/collab`)
When the user invokes `/assemble` (or `/collab`), follow the **8-Step Default Team Workflow**:

1. **Read `USER_INBOX.md` & Assemble:**
   - Read [USER_INBOX.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/USER_INBOX.md) for the prompt, role assignments, `Main` designation, any attached files/folders, and participating agents.
   - If the session has follow-up prompts (`Message 1`, `Message 2`, ...), work on the message marked **`LATEST`** (`Active Target: Work on Message N`) while treating earlier messages as prior context in the same session.
   - Run `node scripts/hub.js assemble "@Antigravity"`.

2. **Gather Context:**
   - Read [GEMINI.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/GEMINI.md), [DECISIONS.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/DECISIONS.md), [TASKS.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/TASKS.md), and [AGENT_COMMUNICATION.md](file:///c:/Users/user/Downloads/vibe%20coding%20tools/AGENT_COMMUNICATION.md).
   - Acknowledge unread messages: `node scripts/hub.js unread "@Antigravity"` and `node scripts/hub.js read all "@Antigravity"`.
   - Inspect relevant host project files outside `vibe coding tools` (read-only during planning).

3. **Check & Wait for Participating Agents (No Outside Edits Yet!):**
   - Run `node scripts/hub.js health` (or `node scripts/hub.js wait-team --timeout 180`).
   - While waiting for teammates (e.g. `@Copilot`, `@Claude`, `@Cursor`, `@Codex`), you may analyze and draft plans inside `vibe coding tools`, **without editing or deploying any files outside `vibe coding tools`**.
   - If waiting times out, use `node scripts/hub.js poll --agent "@Antigravity"` to ask the user in the VS Code AIvengers tab whether to start without the missing teammate(s).

4. **Plan Together with the Whole Team:**
   - Once all participants are online, finalize the plan together in `AGENT_COMMUNICATION.md` and `TASKS.md`. Ensure newly joined teammates review any draft plan and share their suggestions.
   - Save the agreed draft plan: `node scripts/hub.js plan draft "@Antigravity" "<plan summary>"`.

5. **Send Plan to VS Code AIvengers Tab for Approval (`Main` Responsibility):**
   - As `Main`, submit the agreed team plan via `node scripts/hub.js report --type checkpoint ...` + interactive poll `node scripts/hub.js poll ...` (approving the poll automatically unlocks execution).
   - Run `node scripts/hub.js plan review "@Antigravity" "Sent plan for user review"`.
   - Wait for user approval before any agent edits files outside `vibe coding tools`.

6. **Execute as Manager (`Main` Role):**
   - After user approval, run `node scripts/hub.js plan approve "@Antigravity" "Approved by user"` and announce execution start in `AGENT_COMMUNICATION.md`.
   - **Act as Engineering Manager:** Assign tasks according to roles, take on **less code-writing work** than teammates, monitor teammate progress (`node scripts/hub.js health`), keep everyone aligned, and verify code/test quality.
   - Respect file locks in `TASKS.md`. Never lock shared hub files (`TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, `VIBE_FEED.json`).

7. **Monitor Credit Exhaustion / Accidental Offline & Failover:**
   - Periodically run `node scripts/hub.js health` (which passively checks live IDE transcripts and OS processes in `<5ms`).
   - If any teammate hits `CREDIT_EXHAUSTED` or drops `OFFLINE` unexpectedly, immediately ask the user via `node scripts/hub.js poll` whether to take over their incomplete tasks, continue without them, or wait.
   - If `@Antigravity` is not `Main` and the assigned `Main` dies/runs out of credits, step up as **`Substitute Main`** and notify the user in the AIvengers tab.

8. **Milestone Reports, Standby Helping & Final Summary (`Main` Only):**
   - **Signal-Only Feed:** Only reports, questions, and polls appear in the VS Code AIvengers tab — casual chatter/thanks are filtered out.
   - Send milestones via `node scripts/hub.js report --agent "@Antigravity" --type milestone ...`.
   - If you finish your own tasks early, stay `IDLE` and ask teammates in `AGENT_COMMUNICATION.md` if they need help.
   - Once **all** agents finish their tasks and confirm project completion, **only `Main`** sends the mandatory `final_summary` report AND posts a **`[SIGN-OFF]`** message to `@All` in `AGENT_COMMUNICATION.md` (`node scripts/hub.js msg --from "@Antigravity" --to "@All" --type "SIGN-OFF" ...`) so waiting teammates know execution is complete before anyone goes `OFFLINE`.
