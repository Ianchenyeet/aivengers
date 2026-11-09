# 🗺️ Vibe Coding Tools Suite Roadmap & Specification

> **Workspace Module:** `vibe coding tools`  
> **Lead Architect:** `@Antigravity`  
> **Target Agents:** `@Antigravity`, `@Copilot`, `@Cursor`, `@Claude`

---

## 🎯 Vision

"Vibe Coding" is high-velocity, intent-driven software development powered by LLMs. When multiple AI agents co-develop in the same repository, speed depends on frictionless handoffs, zero context switching, and automated git/task housekeeping.

The **Vibe Coding Tools Suite** provides lightweight, dependency-free utilities built right into the project to streamline multi-agent workflows.

---

## 🛠️ Planned Toolset

### 1. `vibe-commit` (Git Commit & Co-Author Generator)
- **File:** `src/vibe-commit.js`
- **Purpose:** Automatically analyzes staged git diffs, classifies conventional commit types (`feat`, `fix`, `docs`, `refactor`, `chore`), generates semantic summaries, and attaches multi-agent `Co-authored-by` trailers.
- **Key Features:**
  - Semantic heuristic analysis of changed files and directories.
  - Multi-agent attribution (`Co-authored-by: Copilot`, `Co-authored-by: Antigravity`).
  - `--dry-run` and interactive preview.
  - Auto-commit or format-only modes.

### 2. `vibe-context` (Agent Context Packager)
- **File:** `src/vibe-context.js`
- **Purpose:** Packs the current user directives, active tasks, file locks, recent ADRs, and git status into a compact, high-signal LLM prompt.
- **Key Features:**
  - One-click prompt bundling for pasting into Cursor, Copilot Chat, or Claude.
  - Target agent tailoring (`--target copilot`, `--target cursor`).
  - File token budgeting (includes essential lines while avoiding context bloat).
  - Output to console or file (`--out prompt.md`).

### 3. `vibe-check` (Multi-Agent Concurrency & Sanity Validator)
- **File:** `src/vibe-check.js`
- **Purpose:** Pre-flight sanity check before code execution or git commits.
- **Key Features:**
  - Checks if an agent has unreleased file locks on files it hasn't modified.
  - Validates markdown structure of `TASKS.md`, `USER_INBOX.md`, and `AGENT_COMMUNICATION.md`.
  - Warns if two tasks have overlapping file locks.

### 4. `vibe-handoff` (Interactive Agent Handoff Wizard)
- **File:** `src/vibe-handoff.js`
- **Purpose:** Facilitates passing the baton from Agent A (e.g. backend builder) to Agent B (e.g. test writer).
- **Key Features:**
  - Prompts or reads completed work and packages file pointers.
  - Automatically updates `TASKS.md` status to `[IN REVIEW]` and logs to `AGENT_COMMUNICATION.md`.

---

## 🚀 Phased Implementation Plan

| Phase | Milestone | Deliverables | Assigned |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Core CLI Tools | `vibe-commit.js`, `vibe-context.js` | `@Antigravity` |
| **Phase 2** | Testing & Test Suite | `tests/vibe-commit.test.js`, `tests/vibe-context.test.js` | `@Copilot` |
| **Phase 3** | Pre-commit & Concurrency Checks | `vibe-check.js`, Git hooks | `@Antigravity` / `@Copilot` |
| **Phase 4** | Interactive Handoff & UI Dashboard | `vibe-handoff.js`, HTML status visualizer | Joint |
