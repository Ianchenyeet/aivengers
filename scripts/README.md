# 🛠️ Workspace Coordination Scripts (`scripts/`)

Zero-dependency Node.js utilities for multi-agent coordination, passive telemetry, team plan approval, and session archiving.

---

## 🚀 `hub.js` Commands

### 1. Team Health, Passive Telemetry & Waiting
```bash
# Live passive + active status of all agents (<5ms log tailing + OS PID probe):
node scripts/hub.js peers
node scripts/hub.js peers --json
node scripts/hub.js peers --check "@Copilot"

# Check team assembly, credit exhaustion / offline alerts & Main/Substitute-Main role:
node scripts/hub.js health
node scripts/hub.js health --json

# Wait for all expected participants in USER_INBOX.md to come online:
node scripts/hub.js wait-team --timeout 180

# Wait for a specific peer reply or status change:
node scripts/hub.js wait --for "@Copilot" --timeout 90
```

### 2. Team Plan & User Approval Gate
```bash
node scripts/hub.js plan status
node scripts/hub.js plan draft "@Antigravity" "Agreed team plan summary..."
node scripts/hub.js plan review "@Antigravity" "Submitted plan to AIvengers tab for approval"
node scripts/hub.js plan approve "@Antigravity" "Approved by user in AIvengers tab"
```

### 3. Tasks, Compact Messages & Read Receipts
```bash
# Add, claim, and complete tasks:
node scripts/hub.js add-task --title "Implement feature" --agent "@Copilot" --files "src/app.js" --desc "Details"
node scripts/hub.js claim TASK-001 "@Copilot" "src/app.js"
node scripts/hub.js complete TASK-001 "@Copilot"

# Post compact message & confirm read (✓:@Agent):
node scripts/hub.js msg --from "@Antigravity" --to "@Copilot" --type "HANDOFF" --subject "Ready" --body "Done"
node scripts/hub.js unread "@Copilot"
node scripts/hub.js read all "@Copilot"
```

### 4. Session Archiving
```bash
node scripts/hub.js archive save "sprint-1"
node scripts/hub.js archive new "sprint-2"
node scripts/hub.js archive list
node scripts/hub.js archive resume 1
```
