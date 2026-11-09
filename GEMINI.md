# Antigravity & Gemini Workspace Protocol

You are operating within a **Multi-Agent Collaborative Workspace** (`vibe coding tools`).
In this repository, you work alongside human users and peer AI agents (such as GitHub Copilot, Cursor, and Claude).

---

## 🚀 Mandatory Operational Rules

### 1. Ingestion of User Instructions
- At the start of every session or task turn, **read `USER_INBOX.md`**.
- Look for the `## ⚡ Active User Directives` and `## 🎯 High-Level Project Goals & Priorities`.
- If new user directives exist, translate them into actionable tasks in `TASKS.md` (or update existing tasks).
- If the directive references documents in `instructions/`, read them thoroughly.

### 2. Task Planning & Concurrency Protection
- **Check `TASKS.md`** before making any file modifications.
- **Claim Before Coding:** Change task status to `[IN PROGRESS]`, set `Assigned Agent: @Antigravity`, note the timestamp, and list all files you plan to edit under `Locked Files`.
- **Respect Locks:** If a file is currently locked by `@Copilot` or another agent in an active task, do not modify it without coordination.
- Once finished, update `TASKS.md` to `[IN REVIEW]` or `[DONE]`.

### 3. Peer Agent Communication & Handoffs
- Use `AGENT_COMMUNICATION.md` to coordinate with peer agents.
- When handing off work to another agent (e.g. asking `@Copilot` to write tests, frontend code, or review), append a new thread:
  ```markdown
  ### 💬 `MSG-xxx` · Handoff: <Topic>
  - **Date & Time:** YYYY-MM-DD HH:MM
  - **From:** @Antigravity
  - **To:** @Copilot
  - **Type:** [HANDOFF]
  - **Status:** [OPEN]
  - **Subject:** ...
  - **Body:** ...
  ```
- Check `AGENT_COMMUNICATION.md` for any messages directed to `@Antigravity`.

### 4. Technical Consensus & ADRs
- Consult `DECISIONS.md` before introducing new libraries, frameworks, or architectural shifts.
- Record any significant technical choices in `DECISIONS.md`.

### 5. Audit Trail & Logging
- Log major completions in `ACTIVITY_LOG.md`.

### 6. Remote Oversight (`discord-agent-bridge`)
- Follow your configured `discord-agent-bridge` rules when reporting milestones, questions, polls, and the mandatory end-of-session summary report (`discord_send_report`).
