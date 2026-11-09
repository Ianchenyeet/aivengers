# 🛠️ Workspace Coordination Scripts (`scripts/`)

This directory provides utilities for coordinating tasks, messages, and status across multiple AI agents and human users.

---

## 🚀 `hub.js` (Multi-Agent Coordination CLI)

A zero-dependency Node.js CLI script to manage the workspace without needing to manually edit Markdown formatting.

### 📌 Commands

#### 1. View Workspace Status
```bash
node scripts/hub.js status
# or
npm run status
```
Displays:
- Active user directives from `USER_INBOX.md`
- Tasks in progress & locked files from `TASKS.md`
- Ready tasks available to be claimed
- Recent messages from `AGENT_COMMUNICATION.md`

#### 2. Check User Directives
```bash
node scripts/hub.js inbox
# or
npm run inbox
```

#### 3. Claim a Task & Lock Files
```bash
node scripts/hub.js claim TASK-002 @Copilot "instructions/vibe_tools_roadmap.md"
```
- Sets task status to `[IN PROGRESS]`
- Assigns `@Copilot`
- Declares locked files
- Automatically logs to `ACTIVITY_LOG.md`

#### 4. Complete a Task
```bash
node scripts/hub.js complete TASK-002 @Copilot
```
- Sets status to `[DONE]`
- Moves to completed section
- Logs completion to `ACTIVITY_LOG.md`

#### 5. Post a Message to Peer Agents
```bash
node scripts/hub.js msg --from "@Antigravity" --to "@Copilot" --type "HANDOFF" --subject "Backend Ready" --body "I implemented the API endpoints in /src/api. Please create frontend tests."
```

#### 6. Append to Activity Log
```bash
node scripts/hub.js log --agent "@Copilot" --action "Added unit tests" --files "tests/api.test.js" --notes "100% coverage"
```

---

## 📦 Session Archiving & Resuming

Manage distinct sprints, milestones, or experiments cleanly without cluttering the active board:

### 1. Save Session to Archive
```bash
node scripts/hub.js archive save [name]
# or
npm run archive:save -- "milestone-1"
```
Copies `USER_INBOX.md`, `TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, and `PROJECT_STATE.md` into `archives/<timestamp>_<name>/` along with `session.json` and a human-readable `README.md`.

### 2. Start a Clean Session (Auto-Archive + Reset)
```bash
node scripts/hub.js archive new "Next Feature"
# or
npm run archive:new -- "Next Feature"
```
Freezes and archives the current session, then resets active files to pristine collaboration templates with instructions and guidelines intact.

### 3. List All Saved Sessions
```bash
node scripts/hub.js archive list
# or
npm run sessions
```

### 4. Resume an Archived Session
```bash
# Resume by list index:
node scripts/hub.js archive resume 1

# Or resume by folder name/substring:
node scripts/hub.js archive resume "milestone-1"
```
Restores all collaboration files to the active workspace. Automatically creates a safety backup of any active uncommitted files into `archives/_stash_<timestamp>/` so work is never lost!
