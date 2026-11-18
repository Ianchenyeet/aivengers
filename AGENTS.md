# Universal AI Agent Collaboration Protocol (`AGENTS.md`)

This repository (`vibe coding tools`) is a **self-contained, drop-in multi-agent collaboration hub & VS Code extension (`AIvengers`)** where AI agents (`@Antigravity`, `@Copilot`, `@Claude`, `@Cursor`, `@Codex`) work together as a synchronized engineering team natively in the **VS Code AIvengers tab**.

---

## 📦 Drop-In Folder Portability & Zero Cross-Dependency Rule (CRITICAL)

The user frequently drops the `vibe coding tools` folder into other projects to coordinate multi-agent work and moves it back out afterward.
1. **Read Project Files Outside `vibe coding tools`:** When assembled, agents SHOULD inspect and read the parent/host project files outside the `vibe coding tools` directory to analyze, plan, and build features requested in `USER_INBOX.md`.
2. **Zero Dependencies Outside -> Inside:** **NO file outside `vibe coding tools`** may import, require, reference, or depend on any file inside `vibe coding tools`. The host project must work 100% identically after `vibe coding tools` is removed.
3. **Zero Hardcoded Dependencies Inside -> Outside:** **NO file inside `vibe coding tools`** may hardcode imports or dependencies on specific files outside `vibe coding tools`. Keep all collaboration state, scripts, and logs strictly inside `vibe coding tools`.

---

## ⚡ Default Mode vs Assembly Mode (`/assemble`)

- **Normal Prompts:** By default, when the user sends a prompt without `/assemble`, respond and edit code normally as a single agent. Do NOT read `USER_INBOX.md` or engage multi-agent coordination.
- **Assembly Mode (`/assemble` or `/collab`):** Multi-agent collaboration is activated when the user enters `/assemble`. Every agent MUST follow the **8-Step Default Team Workflow** below.

---

## 🔄 The 8-Step Default `/assemble` Team Workflow

### Step 1: Read `USER_INBOX.md` & Announce Assembly
- Read `USER_INBOX.md` to understand the user's prompt, role assignments, `Main` agent designation (selected in Slot 1 of the Vibe Coding tab or specified in `USER_INBOX.md`), any attached files/folders, and participating agents.
- When a session has follow-up prompts, `USER_INBOX.md` preserves prior prompts (`Message 1`, `Message 2`, ...) as session history and marks the active prompt **`Active Target: Work on Message N (LATEST)`** — always execute the latest message.
- Run:
  ```bash
  node scripts/hub.js assemble "@YourAgent"
  ```

### Step 2: Context Gathering & Unread Messages
- Read your own agent `.md` file (`GEMINI.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursorrules`, `AGENTS.md`).
- Check `TASKS.md` and `AGENT_COMMUNICATION.md` (`node scripts/hub.js unread "@YourAgent"` -> `node scripts/hub.js read all "@YourAgent"`).
- Explore relevant project files **outside** `vibe coding tools` (read-only during planning).

### Step 3: Wait for All Participating Agents (No Outside Edits While Waiting!)
- Check if all participating agents are online and assembled:
  ```bash
  node scripts/hub.js health
  # Or wait for the whole team:
  node scripts/hub.js wait-team --timeout 180
  ```
- **While waiting for missing teammates:**
  - Agents already assembled may analyze the codebase, brainstorm, and draft a preliminary plan together inside `vibe coding tools` (`TASKS.md` / `AGENT_COMMUNICATION.md`).
  - **STRICT RULE:** Do **NOT** edit, create, or deploy any project files outside `vibe coding tools` while waiting for the team or before user approval!
- **Timeout Poll:** If `wait-team` times out after waiting a long time and a participant still hasn't joined, `@Main` (or the waiting agent) asks the user in the **VS Code AIvengers tab** (`node scripts/hub.js poll --agent "@Main" --question "Start without missing teammates?" --options "Start with online team|Keep waiting"`).

### Step 4: Whole-Team Collaborative Planning
- Once all participating agents are online and assembled, review any preliminary draft plan together.
- Newly joined agents MUST read the draft plan in `TASKS.md` / `AGENT_COMMUNICATION.md`, contribute their ideas or improvements, and confirm agreement.
- Record the agreed plan via:
  ```bash
  node scripts/hub.js plan draft "@MainAgent" "Plan summary..."
  ```

### Step 5: User Plan Review & Approval in VS Code AIvengers Tab (Mandatory Gate)
- Once the team agrees on a thorough plan, **only `Main`** (whichever agent is chosen in **Slot 1** / designated `Main` in `USER_INBOX.md`) submits the plan for user review using **`node scripts/hub.js report`** (`--type checkpoint`) + interactive poll **`node scripts/hub.js poll`** (approving the poll automatically unlocks execution).
- Mark the plan as awaiting user approval:
  ```bash
  node scripts/hub.js plan review "@MainAgent" "Plan sent to AIvengers tab for user review"
  ```
- **No agent may modify project files outside `vibe coding tools` until the user approves the plan.**

### Step 6: Approved Execution & `Main` as Engineering Manager
- Once the user approves in the VS Code AIvengers tab, `Main` runs:
  ```bash
  node scripts/hub.js plan approve "@MainAgent" "Approved by user"
  ```
  and notifies the team in `AGENT_COMMUNICATION.md` that execution has started.
- **Role of `Main` (Manager):**
  - `Main` acts as the **Team Manager**: takes on **less raw code-writing work** than other teammates so it stays responsive.
  - `Main` assigns tasks according to each agent's role in `USER_INBOX.md` or agent `.md`, monitors peer status (`node scripts/hub.js health`), keeps teammates aligned, reviews completed work, and verifies quality/tests.
- **Concurrency & Non-Blocking Work:**
  - Claim tasks and lock target implementation files before editing (`node scripts/hub.js claim TASK-xxx "@YourAgent" "path/to/file"`).
  - Never lock shared coordination files (`TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, `VIBE_FEED.json`).
  - Periodically check `AGENT_COMMUNICATION.md` (`node scripts/hub.js unread "@YourAgent"`). If waiting on a non-blocking question or peer handoff, work on another independent task in the meantime.

### Step 7: Passive Online / Credit-Exhaustion Detection & Automatic `Substitute Main` Failover
- `node scripts/hub.js peers` and `node scripts/hub.js health` passively inspect live IDE/agent transcripts and OS processes in `<5ms`—no manual check-in is required to detect if an agent is `RUNNING`, `IDLE`, `OFFLINE`, or `CREDIT_EXHAUSTED` (rate limit / quota / billing exhaustion).
- **If a Teammate Goes Offline or Runs Out of Credits (`CREDIT_EXHAUSTED`):**
  - `Main` immediately asks the user via `node scripts/hub.js poll` how to proceed:
    1. *Reassign their incomplete tasks to online teammates*
    2. *Continue without them (skip their remaining tasks)*
    3. *Pause and wait for user to top up credits / restart the agent*
- **If `Main` Goes Offline or Runs Out of Credits (`Substitute Main` Failover):**
  - `node scripts/hub.js health` automatically promotes the next online teammate to **`Substitute Main`**.
  - The **`Substitute Main`** immediately steps up as Manager and alerts the user via `node scripts/hub.js poll` to ask how to proceed.

### Step 8: Milestone Reports, Standby Helping & `Main`-Only Final Sign-Off
- **User Feed Signal-Only Rule:** **Only reports, questions, and polls** appear in the VS Code AIvengers tab (`VIBE_FEED.json`) — never dump casual chatter or "thank you" messages there.
- **Milestone Reports:** Any agent can send a milestone report via `node scripts/hub.js report --agent "@YourAgent" --type milestone --title "..." --summary "..."`.
- **Early Finishers Stay Online & Help:** If an agent finishes its assigned tasks early, it MUST stay `IDLE` (online/standby) and post in `AGENT_COMMUNICATION.md` asking teammates if they need help with remaining tasks or testing. Do NOT go offline early.
- **Final Report & Team Sign-Off (`Main` Only):**
  - **ONLY `Main` (or `Substitute Main`)** concludes the project and sends the mandatory `final_summary` report (`node scripts/hub.js report --type final_summary ...`) to the AIvengers tab.
  - After sending `final_summary`, `Main` MUST notify all waiting teammates in `AGENT_COMMUNICATION.md` with a `[SIGN-OFF]` message (`node scripts/hub.js msg --from "@MainAgent" --to "@All" --type "SIGN-OFF" ...`) so teammates are never left waiting.
  - Only after **every** task is verified `[DONE]`, `final_summary` is sent, and `Main` posts `[SIGN-OFF]` may all agents sign off (`node scripts/hub.js offline "@YourAgent"`).

---

## ⚡ Compact Markdown Formats (Low Token & File Size Overhead)

To keep `.md` coordination files tiny, fast to read, and token-efficient, `scripts/hub.js` uses single-line headers:

1. **`AGENT_COMMUNICATION.md` (Messages & Read Receipts):**
   ```markdown
   ### `MSG-001` [16:40] @Antigravity -> @Copilot [HANDOFF] · API Ready ✓:@Copilot
   Implemented endpoints in `src/api.js`. Ready for UI integration.
   ```
2. **`TASKS.md` (Tasks & Locks):**
   ```markdown
   ### `TASK-001` [IN PROGRESS] @Copilot · Build UI toggle (Locks: `src/ui.js`)
   Add dark mode toggle component and unit tests.
   ```
3. **`ACTIVITY_LOG.md` (Single-Line Audit Bullet):**
   ```markdown
   - `2026-11-09 16:45` **@Copilot** Completed TASK-001 (`src/ui.js`) — Verified tests pass
   ```

---

## 🛠️ Essential Hub CLI Commands

```bash
node scripts/hub.js assemble "@YourAgent"          # Step 1: Assemble & view workspace state
node scripts/hub.js dispatch --main "@A" --agents "@A,@B" --prompt "..."  # Write USER_INBOX.md & prompt feed
node scripts/hub.js peers                          # Passive + active live status of all agents
node scripts/hub.js health                         # Check team assembly, credit/offline alerts & Main role
node scripts/hub.js wait-team --timeout 180        # Step 3: Wait for all expected teammates to assemble
node scripts/hub.js plan draft "@Main" "Summary"   # Step 4: Save team draft plan
node scripts/hub.js plan review "@Main" "Notes"    # Step 5: Mark plan submitted for user review
node scripts/hub.js plan approve "@Main" "Notes"   # Step 6: Unlock execution after user approves
node scripts/hub.js report --agent "@A" --type milestone --title "Title" --summary "..."
node scripts/hub.js ask --agent "@A" --question "..."                      # Ask user in VS Code tab & wait
node scripts/hub.js poll --agent "@A" --question "..." --options "A|B"     # Poll user in VS Code tab & wait
node scripts/hub.js reply --id ITEM-001 --answer "..."                     # Record user answer in feed
node scripts/hub.js feed [--json]                                          # Inspect reports/questions/polls
node scripts/hub.js claim TASK-001 "@Agent" "file" # Claim task & lock implementation file(s)
node scripts/hub.js complete TASK-001 "@Agent"     # Complete task & release file locks
node scripts/hub.js msg --from "@A" --to "@B" --type "HANDOFF" --subject "Subj" --body "Body"
node scripts/hub.js unread "@YourAgent"            # View unread messages
node scripts/hub.js read all "@YourAgent"          # Mark all unread messages as read (✓:@YourAgent)
node scripts/hub.js wait --for "@Peer" --timeout 90 # Wait for peer reply or status change
```
