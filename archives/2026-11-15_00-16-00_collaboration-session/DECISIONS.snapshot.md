# 🏛️ Architecture Decision Records (ADRs)

> **Protocol Rule:**
> Before introducing a new framework, library, architectural pattern, or modifying core directory structures, check this document.
> Record any consensus or key technical decision here so peer agents and future sessions adhere to the same standards.

---

## Index of Decisions

- [ADR-001: Multi-Agent File-Based Collaboration Architecture](#adr-001-multi-agent-file-based-collaboration-architecture)
- [ADR-002: Tooling Runtime & Scripting Standard](#adr-002-tooling-runtime--scripting-standard)
- [ADR-003: Session Archiving & Resuming Architecture](#adr-003-session-archiving--resuming-architecture)
- [ADR-004: Opt-In /assemble Protocol & Casual User Inbox](#adr-004-opt-in-assemble-protocol--casual-user-inbox)
- [ADR-005: Agent Presence & Liveness Protocol](#adr-005-agent-presence--liveness-protocol)
- [ADR-006: Default 8-Step Team Workflow, Passive Telemetry, Credit Failover & Compact Formats](#adr-006-default-8-step-team-workflow-passive-telemetry-credit-failover--compact-formats)

---

### `ADR-001`: Multi-Agent File-Based Collaboration Architecture
- **Date:** 2026-11-09
- **Status:** `ACCEPTED`
- **Deciders:** `@Antigravity`, User
- **Context:**
  Different AI agents (Antigravity, GitHub Copilot, Claude Code, Cursor) operate in disparate runtimes and chat contexts. They need a shared, zero-friction medium to coordinate work, understand user intent, plan roadmaps, and avoid overwriting each other's changes.
- **Decision:**
  Use repository-level Markdown files as the canonical source of truth:
  - `USER_INBOX.md` for user intent and directives.
  - `TASKS.md` for Kanban planning, claims, and file locking.
  - `AGENT_COMMUNICATION.md` for inter-agent messages and handoffs.
  - `ACTIVITY_LOG.md` for historical work audit logs.
  - `DECISIONS.md` for technical alignment.
- **Consequences:**
  - **Positive:** Universal compatibility across all LLMs and tools; human-readable and git-trackable; zero external database or cloud service dependencies.
  - **Negative:** Requires agents to adhere to the protocol discipline of checking files and claiming tasks.

---

### `ADR-002`: Tooling Runtime & Scripting Standard
- **Date:** 2026-11-09
- **Status:** `ACCEPTED`
- **Deciders:** `@Antigravity`
- **Context:**
  Helper automation scripts are useful for quickly reading status, claiming tasks, and posting messages without manual markdown formatting errors.
- **Decision:**
  Write lightweight, dependency-free Node.js scripts in `scripts/` (e.g. `scripts/hub.js`), compatible with standard Node.js (already installed in the environment), accompanied by npm scripts in `package.json`.
- **Consequences:**
  - Zero external npm install required for core management.
  - Cross-platform compatible (Windows, macOS, Linux).

### `ADR-003`: Session Archiving & Resuming Architecture
- **Date:** 2026-11-09
- **Status:** `ACCEPTED`
- **Deciders:** `@Antigravity`, User
- **Context:**
  When a sprint, milestone, or topic concludes, the workspace collaboration files (`USER_INBOX.md`, `TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, `PROJECT_STATE.md`) accumulate completed tasks and long message threads. Users need a reliable, frictionless way to freeze and archive a session into a project subfolder (`archives/<timestamp>_<name>/`), reset the workspace for a fresh sprint, and easily resume an older session at any point.
- **Decision:**
  Implement file-based session management in `scripts/hub.js`:
  1. **Archive:** Copies the 5 dynamic collaboration files into `archives/<timestamp>_<name>/`, produces a `session.json` manifest with task and message stats, and generates an archive README.
  2. **Fresh Session Reset:** Cleans the 5 active files with fresh template scaffolds while preserving all static agent configurations, rules, and scripts.
  3. **Safe Resume:** Auto-backs up any active uncommitted files into `archives/_stash_<timestamp>/` prior to restoration, preventing any accidental data loss, restores the archived session, logs the event to `ACTIVITY_LOG.md`, and posts an announcement to `AGENT_COMMUNICATION.md`.
- **Consequences:**
  - **Positive:** Zero data loss guarantee; git-trackable session history; instant switching between feature sprints or agent experiments.
  - **Negative:** Users and agents must specify the session name or index when resuming.

### `ADR-004`: Opt-In /assemble Protocol & Casual User Inbox
- **Date:** 2026-11-09
- **Status:** `ACCEPTED`
- **Deciders:** User, `@Antigravity`
- **Context:**
  Originally, agents were instructed to automatically read `USER_INBOX.md` and enter multi-agent coordination on every single prompt. This caused friction when the user just wanted a quick, normal answer from a single agent. Additionally, `USER_INBOX.md` required rigid markdown templates, making writing user prompts cumbersome.
- **Decision:**
  1. **Casual Inbox:** Make `USER_INBOX.md` completely freeform. The user writes plain text naturally (just like chatting), without mandatory metadata or strict structure. Agents parse and decompose the request into `TASKS.md` themselves.
  2. **Opt-In `/assemble` Command:** Multi-agent collaboration is NOT the default. Normal prompts in any agent window behave normally. Only when the user explicitly enters `/assemble` in an agent's window does that specific agent assemble into the workspace, read `USER_INBOX.md`, check `TASKS.md`, lock files, and collaborate.
- **Consequences:**
  - **Positive:** Zero friction for the user; full control over which agents participate; normal single-agent prompts remain fast and unencumbered.
  - **Negative:** User must remember to type `/assemble` in the agent windows they want to join the collaborative task.

---

### `ADR-005`: Agent Presence & Liveness Protocol
- **Date:** 2026-11-09
- **Status:** `ACCEPTED`
- **Deciders:** User, `@Antigravity`
- **Context:**
  When multiple agents operate in separate chat windows or IDE environments, they cannot inherently see whether peer agents are currently assembled, actively executing tasks, waiting, or offline. This led to uncertainty during handoffs and round-trip coordination.
- **Decision:**
  Implement real-time presence and heartbeat tracking backed by `AGENT_PRESENCE.json` and `scripts/hub.js`:
  1. **States:** Each agent is tracked as `IDLE` (online & standing by), `RUNNING` (busy executing a task/operation), `WAITING` (waiting for peer or user), or `OFFLINE` (stale/timed out or signed off).
  2. **Automatic Lifecycle Hooking:** Presence automatically updates during normal hub commands:
     - `node scripts/hub.js assemble`: sets `IDLE` and logs initial timestamp.
     - `node scripts/hub.js claim`: sets `RUNNING` with `currentTask`.
     - `node scripts/hub.js complete`: resets to `IDLE` and clears task.
     - `node scripts/hub.js msg` / `node scripts/hub.js read`: refreshes heartbeat timestamp and current activity.
  3. **Explicit Commands & Queries:**
     - `node scripts/hub.js peers`: renders formatted table with color badges, relative time ("just now", "5m ago"), and current activity.
     - `node scripts/hub.js peers --check <@Agent>`: programmatic probe (exit code 0 if online, 1 if offline).
     - `node scripts/hub.js peers --json`: returns machine-readable JSON for agents/scripts.
     - `node scripts/hub.js ping <@Agent>`: explicit heartbeat.
     - `node scripts/hub.js busy` / `idle` / `offline`: explicit state transitions.
     - `node scripts/hub.js wait --for <@Agent>`: block/poll until peer activity or target state.
  4. **Timeout Threshold:** Heartbeats older than 15 minutes are automatically categorized as `OFFLINE (Stale)` without requiring a background server daemon.
- **Consequences:**
  - **Positive:** Zero-dependency file-based presence; complete transparency across all agent sessions; instant peer status queries.
  - **Negative:** Agents must invoke hub commands or heartbeats to keep their active timestamp fresh during long operations.

---

### `ADR-006`: Default 8-Step Team Workflow, Passive Telemetry, Credit Failover & Compact Formats
- **Date:** 2026-11-09
- **Status:** `ACCEPTED`
- **Deciders:** User, `@Antigravity`
- **Context:**
  1. The user drops the `vibe coding tools` folder into external projects and moves it out later, requiring zero cross-dependencies between the host project and `vibe coding tools`.
  2. Multi-agent collaboration needed a structured default workflow: waiting for all participants before editing host files, drafting plans while waiting, getting user plan approval on Discord via `Main`, having `Main` act as an Engineering Manager (less code-writing, more alignment/verification), handling accidental disconnects or credit exhaustion (`CREDIT_EXHAUSTED`) with automatic `Substitute Main` failover, and ensuring early finishers stay online to help until `Main` sends the sole `final_summary` report.
  3. Manual status check-ins were slow and failed when an agent abruptly ran out of credits.
  4. Verbose Markdown templates inflated `AGENT_COMMUNICATION.md`, `TASKS.md`, and `ACTIVITY_LOG.md`.
- **Decision:**
  1. **Zero Cross-Dependency Portability:** Agents read host project files outside `vibe coding tools`, but neither side may import or hardcode dependencies on the other.
  2. **Passive Telemetry Engine (`probeAllPassiveTelemetry` in `scripts/hub.js`):** Passively tail-reads `<64KB` of Antigravity transcripts (`~/.gemini/antigravity/brain/*/.system_generated/logs/transcript.jsonl`), VS Code Copilot Agent Host logs (`%APPDATA%/Code/logs/*/agenthost.log`), and Claude Code project logs (`~/.claude/projects/*/*.jsonl`), plus OS PID checks (`process.kill(pid, 0)`). Instantly detects `RUNNING`, `WAITING_APPROVAL`, `IDLE`, `CREDIT_EXHAUSTED`, and `OFFLINE` in `<5ms` without requiring manual agent check-ins.
  3. **Team Gate & Plan Approval (`wait-team`, `health`, `plan`):** Added `node scripts/hub.js wait-team`, `node scripts/hub.js health`, and `node scripts/hub.js plan [status|draft|review|approve]` to enforce team assembly and Discord user plan approval before editing host project files.
  4. **Automatic `Substitute Main` Failover:** If the designated `Main` agent is `OFFLINE` or `CREDIT_EXHAUSTED`, `hub.js health` automatically promotes the next online teammate to `Substitute Main` so it can poll the user on Discord (`discord_ask_poll`).
  5. **Compact Single-Line Markdown Formats:** Reduced messages, tasks, and activity logs to compact 1–2 line blocks with inline `✓:@Agent` read receipts and dual-format backward compatibility.
- **Consequences:**
  - **Positive:** 75%+ smaller Markdown files, `<5ms` passive online/credit-exhaustion detection, guaranteed user approval gate, and resilient manager failover.
  - **Negative:** None; legacy Markdown formats remain readable via dual-format parsers.
