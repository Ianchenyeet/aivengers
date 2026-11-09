# Universal AI Agent Collaboration Protocol (`AGENTS.md`)

This repository is designed for **opt-in multi-agent co-development**. Multiple AI agents (such as `@Antigravity`, `@Copilot`, `@Claude`, `@Cursor`) work together with human users.

---

## ⚡ Default Mode vs Assembly Mode

- **Normal Prompts:** By default, agents answer and edit code normally without engaging the multi-agent coordination protocol or modifying coordination files.
- **Assembly Mode (`/assemble`):** Multi-agent co-development is explicitly activated when the user inputs `/assemble` (or `/collab`) in an agent's window.

```
┌──────────────────────────────────────────────┐
│ User types prompt in normal chat window      │
│ └──> Agent executes normally as single agent │
└──────────────────────────────────────────────┘
                       │
                       ▼ User types `/assemble`
┌──────────────────────────────────────────────┐
│ Agent enters Multi-Agent Workspace Mode:     │
│ 1. Read casual request in USER_INBOX.md      │
│ 2. Check active claims & locks in TASKS.md   │
│ 3. Claim task & declare locked files         │
│ 4. Coordinate with peers in AGENT_COMM.md    │
│ 5. Complete task & log to ACTIVITY_LOG.md    │
└──────────────────────────────────────────────┘
```

---

## 📥 Casual User Inbox (`USER_INBOX.md`)

The user writes requests casually in plain text without rigid metadata or mandatory templates.
When an agent is assembled via `/assemble`:
1. It reads the raw user text from `USER_INBOX.md`.
2. It breaks down the user's intent into structured tasks in `TASKS.md` (if not already broken down).
3. It claims an unassigned task and sets file locks.

---

## 🔒 File Locking & Anti-Collision Protocol
1. **Never edit files concurrently:** If Agent A is modifying a file under an active task in `TASKS.md`, Agent B must NOT edit that file until Agent A marks the task `[DONE]` or `[IN REVIEW]` and clears the lock.
2. **Claiming:** Set `Status: [IN PROGRESS]`, `Assigned Agent: @YourAgent`, and populate `Locked Files:`.
3. **Atomic Scope:** Keep tasks small and scoped to specific files so other agents can work in parallel on non-overlapping components.

---

## 🤝 Inter-Agent Handoff Protocol
When finishing a component that feeds into another agent's domain:
1. Mark your task in `TASKS.md` as `[IN REVIEW]` or `[DONE]`.
2. Post a thread in `AGENT_COMMUNICATION.md`:
   - `@RecipientAgent: [HANDOFF] Title`
   - State what you built, file locations, test results, and what the recipient needs to do next.
3. Or run via CLI:
   ```bash
   node scripts/hub.js msg --from "@YourAgent" --to "@TargetAgent" --subject "Handoff..." --body "..."
   ```

---

## 🫡 Read Confirmations & "Roger That" Receipts
To ensure agents stay synchronized on handoffs, announcements, and task assignments:
1. **Check Pending Messages:**
   ```bash
   node scripts/hub.js unread "@YourAgent"
   ```
2. **Confirm Read (Roger That):**
   ```bash
   node scripts/hub.js read <msgId> "@YourAgent" ["optional note"]
   # Or acknowledge all unread at once:
   node scripts/hub.js read all "@YourAgent"
   ```
3. **Manual Markdown Notation:**
   In `AGENT_COMMUNICATION.md`:
   `- **Read By:** \`@YourAgent\` (YYYY-MM-DD HH:MM · "Roger that ✓")`

---

## 📦 Session Archiving & Resuming Protocol
When a sprint, milestone, or major feature phase is concluded:
- Save active state to `archives/`:
  ```bash
  node scripts/hub.js archive save [session-name]
  ```
- Start a clean sprint:
  ```bash
  node scripts/hub.js archive new [new-session-name]
  ```
- Resume an archived session:
  ```bash
  node scripts/hub.js archive resume <index-or-name>
  ```

---

## 📡 Remote User Interaction via Discord (`discord-agent-bridge`)
Collaborating agents must interact with the user via Discord whenever input is needed:
1. **Questions & Polls:**
   - For open-ended questions: call `discord_ask_question` with your `agent_name`.
   - For multiple-choice questions: call `discord_ask_poll` (pass up to 9 options; `"Others"` is automatically appended for custom typed answers).
2. **Milestones & Session Reports:**
   - Call `discord_send_report` with `report_type: "milestone"` or `"checkpoint"` on completing major phases.
   - At the conclusion of a task, call `discord_send_report` with `report_type: "final_summary"` before finishing.
3. **Format Clearly:**
   - Double-newline between paragraphs and bullet points for clean readability on Discord.
