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
