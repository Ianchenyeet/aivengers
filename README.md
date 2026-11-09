# 🤖 Vibe Coding Tools — Multi-Agent Collaboration Workspace

A structured, zero-friction workspace architecture where different AI coding agents (such as **Google Antigravity**, **GitHub Copilot**, **Claude Code**, and **Cursor**) seamlessly cooperate, communicate, plan, and receive instructions from the user using file-based protocols.

---

## 🌟 Key Capabilities

- **📥 File-Based User Directives (`USER_INBOX.md`):** The human user writes goals, prompts, or feedback in a single markdown file; any active agent reads it and begins planning or execution.
- **📋 Concurrency & Task Board (`TASKS.md`):** Shared Kanban board with agent claiming and **file-locking** to guarantee agents never overwrite each other's code.
- **💬 Inter-Agent Message Board (`AGENT_COMMUNICATION.md`):** Threaded message board for agent-to-agent communication, handoffs (e.g. backend to frontend), review requests, questions, and blocker alerts.
- **🏛️ Architecture Decision Records (`DECISIONS.md`):** Prevents "decision ping-pong" where agents contradict or rewrite each other's technical choices.
- **📜 Chronological Audit Trail (`ACTIVITY_LOG.md`):** Full visibility into who changed what, when, and why.
- **⚡ Lightweight Hub CLI (`scripts/hub.js`):** Fast, zero-dependency Node.js CLI tool for agents and users to view status, claim tasks, post handoff messages, and record logs without formatting errors.
- **🔌 Multi-Platform Agent Support:** Pre-configured instruction files for **Antigravity** (`GEMINI.md`), **GitHub Copilot** (`.github/copilot-instructions.md`), **Cursor** (`.cursorrules` & `.cursor/rules/`), **Claude Code** (`CLAUDE.md`), and **Universal Agents** (`AGENTS.md`).

---

## 📂 Workspace Layout

```
vibe coding tools/
├── USER_INBOX.md           # 📥 Where the user writes commands, goals & answers
├── TASKS.md                # 📋 Shared task board with agent claims & file locks
├── AGENT_COMMUNICATION.md  # 💬 Asynchronous inter-agent chat & handoffs
├── DECISIONS.md            # 🏛️ Architecture Decision Records (ADRs)
├── ACTIVITY_LOG.md         # 📜 Chronological activity & change log
├── PROJECT_STATE.md        # 🧭 Quick tech stack & architecture snapshot
├── instructions/           # 📖 Detailed feature specifications & PRDs
│   └── README.md
├── scripts/                # 🛠️ Hub coordination CLI utilities
│   ├── hub.js
│   └── README.md
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot workspace configuration
├── .cursor/
│   └── rules/agent-collaboration.mdc # Cursor IDE rules
├── .cursorrules            # Cursor legacy configuration
├── GEMINI.md               # Google Antigravity & Gemini configuration
├── CLAUDE.md               # Claude Code configuration
├── AGENTS.md               # Universal Agent protocol specification
├── package.json            # NPM helper scripts
└── README.md               # This documentation
```

---

## 👤 How the Human User Interacts

### 1. Give New Instructions
Open **`USER_INBOX.md`** and write your request under `## ⚡ Active User Directives`:
```markdown
### 📌 Current Focus: Build Git Commit Message Generator CLI
- **Requested By:** User
- **Status:** [READY]
- **Summary:** Create a Node.js tool in src/git-vibe.js that generates commit messages based on git diff.
```

### 2. For Large Feature Specs
Drop a spec file into `instructions/` (e.g. `instructions/git_vibe_spec.md`) and reference it in `USER_INBOX.md`.

### 3. Check Overall Progress
Run in terminal:
```bash
node scripts/hub.js status
# or
npm run status
```

---

## 🤖 How AI Agents Operate

When any AI agent opens this folder, its designated rules file (`GEMINI.md`, `.github/copilot-instructions.md`, etc.) activates the **Agent Lifecycle**:

```
1. Ingest User Directive  ──>  Read USER_INBOX.md
2. Check Task Board       ──>  Read TASKS.md
3. Claim Task & Lock      ──>  Mark [IN PROGRESS] with agent name & target files
4. Implement & Test       ──>  Work only within locked files
5. Handoff or Complete    ──>  Post in AGENT_COMMUNICATION.md, mark [DONE],
                               and append to ACTIVITY_LOG.md
```

### 🔒 File Locking (Preventing Collisions)
Before modifying code:
1. An agent checks `TASKS.md` for active tasks.
2. If another agent lists `src/db.js` under `Locked Files`, **no other agent may touch `src/db.js`** until that task is marked `[DONE]` or `[IN REVIEW]`.
3. To claim a task with CLI:
   ```bash
   node scripts/hub.js claim TASK-002 @Copilot "src/db.js" "tests/db.test.js"
   ```

### 🤝 Inter-Agent Handoffs
Example: `@Antigravity` builds the backend and wants `@Copilot` to create UI components and unit tests:
```bash
node scripts/hub.js msg --from "@Antigravity" --to "@Copilot" --type "HANDOFF" --subject "Backend API Ready" --body "API is in src/api.js. Please build the frontend React components in src/components/ and write tests."
```
`@Copilot` reads `AGENT_COMMUNICATION.md`, acknowledges the request, claims the next task in `TASKS.md`, and proceeds!

---

## 🛠️ Hub CLI Quick Reference

### Workspace Operations
| Command | Description |
| :--- | :--- |
| `npm run status` | Display user directives, active tasks, locks, and messages |
| `npm run inbox` | Print full content of `USER_INBOX.md` |
| `npm run tasks` | Print full content of `TASKS.md` |
| `node scripts/hub.js claim <ID> <Agent> [Files...]` | Claim task and set file locks |
| `node scripts/hub.js complete <ID> <Agent>` | Mark task completed and log it |
| `node scripts/hub.js msg --from <A> --to <B> --subject <S> --body <M>` | Post inter-agent message |
| `node scripts/hub.js log --agent <A> --action <X> --files <F>` | Record action in audit log |

### 📦 Session Archiving & Resuming
| Command | Description |
| :--- | :--- |
| `npm run archive:save [name]` | Save current collaboration files to `archives/<timestamp>_<name>/` |
| `npm run archive:list` (or `npm run sessions`) | List all saved sessions with task stats and summaries |
| `npm run archive:resume <name or index>` | Restore an archived session back into active workspace (auto-stashes active state) |
| `npm run archive:new [name]` | Archive current session and prepare clean collaboration templates for a new sprint |

---

## 📦 How Session Archiving & Resuming Works

When a feature sprint or multi-agent co-development session concludes:

1. **Save Current Session:**
   ```bash
   node scripts/hub.js archive save "vibe-commit-tool"
   # or
   npm run archive:save -- "vibe-commit-tool"
   ```
   Copies `USER_INBOX.md`, `TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`, and `PROJECT_STATE.md` into `archives/YYYY-MM-DD_vibe-commit-tool/` along with a `session.json` metadata file and an archive README.

2. **Start a Fresh Session:**
   ```bash
   node scripts/hub.js archive new "vibe-prompt-enhancer"
   ```
   Archives the active files and resets the workspace to clean templates with empty task boards and instructions intact.

3. **Browse Saved Sessions:**
   ```bash
   npm run sessions
   ```

4. **Resume Any Session:**
   ```bash
   node scripts/hub.js archive resume 1
   # or by name:
   node scripts/hub.js archive resume "vibe-commit-tool"
   ```
   Restores all collaboration files to the workspace root, takes an automatic safety backup of current active files in `archives/_stash_<timestamp>/`, and notifies active agents in `AGENT_COMMUNICATION.md`.

---

---

## 🌐 Remote Discord Bridge Integration
Agents configured with `discord-agent-bridge` can also send progress updates, ask polls, or provide completion summaries directly to the user's mobile/desktop Discord channel.
