# 📋 Multi-Agent Task Board & Roadmap

> **Concurrency & Collision Prevention Rule:**
> 1. **Claim Before Coding:** Before starting work, an agent must change the task status to `[IN PROGRESS]`, assign its name (`@Antigravity`, `@Copilot`, etc.), and list the files it will modify under `Locked Files`.
> 2. **File Locks:** Never edit files currently marked under `Locked Files` of another active task.
> 3. **Handoff:** If a task requires work from another agent (e.g. backend done -> frontend needed), mark `[IN REVIEW]` or post a handoff message in `AGENT_COMMUNICATION.md`.
> 4. **Completion:** When verified, mark `[DONE]`, clear `Locked Files`, and add a one-line entry in `ACTIVITY_LOG.md`.

---

## 🏃 Active Tasks (`[IN PROGRESS]`)

*(No active tasks currently claimed)*

---

## 🎯 Ready for Work (`[READY]`)

### `TASK-001`: Initial Session Planning & Decomposition
- **Status:** `[READY]`
- **Assigned Agent:** `Unassigned`
- **Description:** Read the new directive from `USER_INBOX.md` and break it down into actionable subtasks.
- **Target Files:** `USER_INBOX.md`, `TASKS.md`

---

## 🗄️ Backlog (`[BACKLOG]`)

*(Future or unprioritized items)*

---

## ✅ Completed Tasks (`[DONE]`)

*(Tasks will move here once completed and verified)*
