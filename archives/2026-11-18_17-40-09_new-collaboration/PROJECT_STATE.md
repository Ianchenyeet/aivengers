# 🧭 Project State & Architecture Overview

> **Purpose:** Quick context snapshot for any agent starting a session. Read this to immediately understand the repository layout, tech stack, and conventions.

---

## 🏗️ Repository Overview
- **Project Name:** Vibe Coding Tools
- **Workspace Path:** `c:\Users\user\Downloads\vibe coding tools`
- **Primary Goal:** Multi-agent collaborative development environment for building vibe coding utilities, scripts, and workflows.

## 🛠️ Tech Stack & Runtime Environment
- **Node.js:** v24+
- **Python:** 3.14+
- **Version Control:** Git
- **Operating System:** Windows 11 (PowerShell)

## 📂 Core Collaboration Map
```
vibe coding tools/
├── USER_INBOX.md           # User requests, answers, and guidelines (Read first!)
├── TASKS.md                # Task planning board, claims, and file locks
├── AGENT_PRESENCE.json     # Real-time peer presence & liveness state
├── AGENT_COMMUNICATION.md  # Inter-agent chat, handoffs, and questions
├── DECISIONS.md            # Architecture Decision Records (ADRs)
├── ACTIVITY_LOG.md         # Chronological audit log of agent actions
├── PROJECT_STATE.md        # This file - high-level project snapshot
├── instructions/           # Deep-dive specs and user briefs
│   └── README.md
├── scripts/                # Helper automation tools
│   ├── hub.js              # Multi-agent coordination CLI
│   └── README.md
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot instructions
├── .cursor/
│   └── rules/              # Cursor IDE rules
├── GEMINI.md               # Antigravity / Gemini CLI instructions
├── CLAUDE.md               # Claude Code instructions
├── AGENTS.md               # Universal Agent instructions
├── package.json            # Node script shortcuts
└── README.md               # Comprehensive workspace guide
```

## 🔄 Agent Workflow Summary
1. **Read `USER_INBOX.md`** to check for fresh user directives or feedback.
2. **Read `TASKS.md`** to find existing tasks or create new sub-tasks.
3. **Claim the Task** in `TASKS.md` and declare locked files.
4. **Code and Verify** within declared scope.
5. **Update State:** Mark task `[DONE]` or `[IN REVIEW]`, update `ACTIVITY_LOG.md`, and notify peer agents in `AGENT_COMMUNICATION.md`.
