# 🏛️ Architecture Decision Records (ADRs)

> **Protocol Rule:**
> Before introducing a new framework, library, architectural pattern, or modifying core directory structures, check this document.
> Record any consensus or key technical decision here so peer agents and future sessions adhere to the same standards.

---

## Index of Decisions

- [ADR-001: Multi-Agent File-Based Collaboration Architecture](#adr-001-multi-agent-file-based-collaboration-architecture)
- [ADR-002: Tooling Runtime & Scripting Standard](#adr-002-tooling-runtime--scripting-standard)
- [ADR-003: Session Archiving & Resuming Architecture](#adr-003-session-archiving--resuming-architecture)

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
