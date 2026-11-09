# Universal AI Agent Collaboration Protocol (`AGENTS.md`)

This repository is designed for multi-agent co-development. Multiple autonomous or assistant AI agents (such as `@Antigravity`, `@Copilot`, `@Claude`, `@Cursor`, `@Codex`) work together with human users.

---

## 🧭 The Core Agent Lifecycle

```
┌─────────────────┐      ┌─────────────┐      ┌──────────────┐
│  USER_INBOX.md  │ ───> │  TASKS.md   │ ───> │  Claim Task  │
│ (User Request)  │      │  (Planning) │      │  (Lock Files)│
└─────────────────┘      └─────────────┘      └──────────────┘
                                                     │
                                                     ▼
┌─────────────────┐      ┌─────────────┐      ┌──────────────┐
│  ACTIVITY_LOG   │ <─── │  Handoff /  │ <─── │ Execute Code │
│ (Audit Trail)   │      │ Done in Hub │      │   & Verify   │
└─────────────────┘      └─────────────┘      └──────────────┘
```

---

## 📜 Repository Standards for Agents

| File | Purpose | Who Writes | Who Reads |
| :--- | :--- | :--- | :--- |
| `USER_INBOX.md` | Primary user requests, answers, and priorities | Human User (and agents moving to archive) | All Agents |
| `instructions/` | Detailed specs, PRDs, schemas, guides | User & Lead Agents | All Agents |
| `TASKS.md` | Kanban board, assigned agents, locked files | All Agents | All Agents & User |
| `AGENT_COMMUNICATION.md` | Inter-agent messages, handoffs, blocker alerts | All Agents | All Agents & User |
| `DECISIONS.md` | Architecture Decision Records (ADRs) | All Agents (consensus) | All Agents |
| `ACTIVITY_LOG.md` | Chronological log of agent actions | All Agents | All Agents & User |
| `PROJECT_STATE.md` | Architecture overview & stack snapshot | All Agents | All Agents & User |

---

## 🔒 File Locking & Anti-Collision Protocol
1. **Never edit files concurrently:** If Agent A is modifying `src/app.js` under an active task in `TASKS.md`, Agent B must NOT edit `src/app.js` until Agent A marks the task `[DONE]` or `[IN REVIEW]` and clears the lock.
2. **Claiming:** Set `Status: [IN PROGRESS]`, `Assigned Agent: @YourAgent`, and populate `Locked Files:`.
3. **Atomic Scope:** Keep tasks small and scoped to specific directories or files so other agents can work in parallel on non-overlapping components.

---

## 🤝 Handoff Protocol
When finishing a component that feeds into another agent's domain:
1. Mark your task in `TASKS.md` as `[IN REVIEW]` or `[DONE]`.
2. Post a thread in `AGENT_COMMUNICATION.md`:
   - `@RecipientAgent: [HANDOFF] Title`
   - State what you built, file locations, test results, and what the recipient needs to do next.
3. If helper CLI is available, you can run:
   ```bash
   node scripts/hub.js msg --from "@YourAgent" --to "@TargetAgent" --subject "Handoff..." --body "..."
   ```

---

## 📦 Session Archiving & Resuming Protocol
When a sprint, milestone, or major feature phase is concluded:
- The user or lead agent can freeze and archive the active state into `archives/`:
  ```bash
  node scripts/hub.js archive save [session-name]
  ```
- To start a clean sprint with fresh collaboration templates:
  ```bash
  node scripts/hub.js archive new [new-session-name]
  ```
- To resume a previous collaboration session:
  ```bash
  node scripts/hub.js archive resume <index-or-name>
  ```
- When an archived session is restored, all active agents receive an announcement in `AGENT_COMMUNICATION.md` and should refresh their understanding of `USER_INBOX.md` and `TASKS.md`.
