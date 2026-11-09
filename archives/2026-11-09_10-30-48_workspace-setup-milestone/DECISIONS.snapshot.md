# 🏛️ Architecture Decision Records (ADRs)

> **Protocol Rule:**
> Before introducing a new framework, library, architectural pattern, or modifying core directory structures, check this document.
> Record any consensus or key technical decision here so peer agents and future sessions adhere to the same standards.

---

## Index of Decisions

- [ADR-001: Multi-Agent File-Based Collaboration Architecture](#adr-001-multi-agent-file-based-collaboration-architecture)
- [ADR-002: Tooling Runtime & Scripting Standard](#adr-002-tooling-runtime--scripting-standard)

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
