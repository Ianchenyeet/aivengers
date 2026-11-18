<h1 align="center">AIvengers</h1>

<p align="center">
  <strong>Assemble your installed AI coding agents — Google Antigravity, GitHub Copilot, Claude Code, OpenAI Codex, Cursor, Cline, Windsurf &amp; more — into one synchronized engineering team inside VS Code.</strong>
</p>

---

## What Does AIvengers Do?

Instead of juggling separate chat tabs and copy-pasting context between different AI coding extensions, **AIvengers** adds a dedicated **AIvengers** collaboration tab in VS Code's Secondary Side Bar (right alongside Chat and Antigravity):

- **Assemble a Multi-Agent Team in Seconds:** Choose your **Main** agent in **Slot 1** (who acts as Engineering Manager, coordinates tasks, submits plans, and verifies quality) and click **`+`** to split out extra teammate slots (**Slot 2, Slot 3, ...**) — or click **`⚡ Auto-Fill Installed Team`** to populate all detected agents at once.
- **Same-Provider Multi-Model Teams & Live Copilot Tier Detection:** Run multiple different models from the same provider side by side (e.g., two Copilot models or two Antigravity models in one team), alongside Gemini 4 Argon / Hydrogen / Orchestrator, Claude, GPT-4.1, and o3 / o4-mini. AIvengers detects your GitHub Copilot tier (`Free`, `Pro`, `Pro+`, `Business`, `Enterprise`) and displays every agent's **Model Name** in team headers and reports.
- **Two-Tab Slot Picker (`🤖 Agents & Models` | `🎨 Roles`) & RYB Color Mixing:** Assign **0, 1, or multiple** non-conflicting roles from 23 specialized roles across 6 categories (or keep any slot unrestricted with 0 roles), pick team presets (`2-Agent Duo`, `3-Agent Feature Squad`, `4-Agent Interactive / Game Team`), and see each slot's outline update to its subtractive RYB paint-mixed color while conflicting opposing roles are automatically disabled.
- **Same-Session Continuity & Multi-Message History:** Follow-up prompts stay inside each agent's existing chat session by default while preserving `Message 1`, `Message 2`, ... in `USER_INBOX.md` and directing every teammate to work on the latest message.
- **Attach Files & Folders Directly:** Use **`📎 Attach Files`** and **`📁 Attach Folder`** in the composer to pass context files and directories straight into `USER_INBOX.md`, Antigravity, and Copilot Chat.
- **Signal-Only Feed & Interactive Plan Approval Polls:** No noisy agent chatter—only structured **Reports**, **Questions**, and **Polls** attributed by **Model Name** and role color appear in the AIvengers feed. Voting to approve an agent's plan poll automatically unlocks execution.
- **User-Friendly Workspace Tools:** Browse & switch **Saved Collaborations (`🕘`)**, customize global and per-agent prompt templates in **Settings (`⚙️`)**, jump straight to live **`📋 Tasks`** and **`💬 Comms`**, promote any teammate to Main (**`★`**), filter the feed, copy reports, use built-in **Prompt Starters**, or open the in-app **Quick Guide (`?`)**.
- **Passive Telemetry, File Locks & Credit-Exhaustion Failover:** Checks live IDE/agent processes in `<5ms`, locks files during edits via `TASKS.md`, supports reliable cancellation (`⏹ Stop`), and automatically promotes a **`Substitute Main`** if `Main` disconnects or hits a quota/credit limit.

---

## How to Set Up & Use AIvengers (Zero CLI Commands or Manual Skill Setup)

**No terminal commands or manual `/assemble` skill installation are required.** Everything works immediately out of the box after installing the extension:

- **Automatic Kickoff Injection:** When you click **`Send ↑`**, AIvengers automatically injects the full collaboration protocol, file paths (`USER_INBOX.md`, `AGENTS.md`, `scripts/hub.js`), model-qualified `--agent` IDs, and active role instructions directly into each agent's kickoff prompt—even if the agent does not have pre-installed slash skills.
- **Built-In Hub Fallback:** If your project does not contain a local `vibe coding tools` folder yet, AIvengers automatically runs from the hub bundled inside the extension so it works cleanly in any repository without modifying your repo files.

### Step-by-Step Setup & Usage

1. **Open the AIvengers Tab:** Click the **AIvengers** icon in VS Code's Secondary Side Bar (`Ctrl+Alt+B` or Command Palette: **`AIvengers: Focus AIvengers Tab`**).
2. **Choose Providers, Models & Optional Roles:**
   - Click **`⚡ Auto-Fill Installed Team`**, or click **Slot 1 (`Main`)** to open the two-tab picker.
   - Use **`🤖 Agents & Models`** to select the provider and exact model (or pick a preset like **2-Agent Duo**, **3-Agent Feature Squad**, or **4-Agent Interactive / Game Team**).
   - Use **`🎨 Roles`** to optionally assign **0, 1, or multiple** non-conflicting roles (conflicting opposing roles are automatically grayed out, and slot borders light up with their RYB paint-mixed color).
   - Click **`+`** next to the last slot to split out additional teammate slots—including a second or third distinct model from the same provider.
3. *(Optional)* **Copy `/assemble` Skills & Hub Files to Your Workspace (1 Click):** If you want a standalone `vibe coding tools/` folder inside your project (including `.agents/skills/assemble/SKILL.md`, `.github/skills/assemble/SKILL.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, and `.cursorrules`), run Command Palette **`AIvengers: Initialize Drop-In AIvengers Hub Folder in Workspace`**, or click **`⚙️ Settings` → `Init Hub Folder`** (or **`📦 Init Hub in Workspace`** inside the **`?`** Quick Guide).
4. **Attach Context & Send:** Type your task in the prompt box (or pick a built-in **Prompt Starter**), optionally attach files (**`📎`**) or folders (**`📁`**), and press **Enter** / **`Send ↑`**. *(For external/CLI agents enabled in Settings, click **`Copy Prompt`** on the dispatched message card and paste it into that agent's window.)*
5. **Approve Plan Polls & Track Reports:** Follow progress directly in the **AIvengers** feed, where each teammate reports by its **Model Name** and role color, and vote on Plan Polls to authorize edits outside the hub.

---

## Supported Coding Agents

AIvengers automatically scans your locally installed IDE extensions and built-in agent hosts *(the official agent extension/client itself must still be installed and signed in on your machine)*:
- **Google Antigravity** (`google.google-antigravity`) — Gemini 4 Argon / Hydrogen / Orchestrator (Argon), Gemini 3.8 Flash, Claude 5.5, GPT-OSS
- **GitHub Copilot Chat** (`github.copilot-chat` / `github.copilot`) — Live `vscode.lm` & plan-filtered models
- **Anthropic Claude Code** (`anthropic.claude-code` & built-in Claude Agent Host)
- **OpenAI Codex / ChatGPT** (`openai.chatgpt` & built-in Codex Agent Host)
- **Cline**, **Roo Code**, **Kilo Code**, **Continue**, **Windsurf**, **Sourcegraph Cody**, **Augment Code**, **Amazon Q**

---

## Platform & Antigravity Compliance (Official Extension Required)

AIvengers is strictly a **local workspace organization and prompt-dispatch tool**—it does **not** open, host, or emulate Antigravity (or any other coding agent) on other platforms:

- **Team Organization & Prompt Dispatch Only:** AIvengers helps you organize team slots, assign roles, coordinate tasks and reports through local Markdown hub files (`USER_INBOX.md`, `TASKS.md`, `AGENT_COMMUNICATION.md`), and forward your prompt to the agents you choose.
- **Official Antigravity Must Already Be Installed:** To include Antigravity in a team, the original **Google Antigravity** extension/IDE (`google.google-antigravity`) must already be installed and signed in on your machine in its official environment. AIvengers simply sends your prompts directly to your locally installed official Antigravity instance using standard workspace commands.
- **Native Extension Authentication Only:** Each coding agent uses its own official local installation and sign-in session; AIvengers stays strictly within your local editor workspace.

---

## Drop-In Portability & Zero Cross-Dependency Guarantee

Drop `vibe coding tools` into any repository to run a multi-agent session and move or remove it when finished:
- **Reads Host Project Files:** Assembled agents inspect and edit your host project outside the hub folder.
- **Zero Dependencies Outside → Inside:** No project file outside the hub folder ever imports or depends on hub files.
- **Zero Hardcoded Dependencies Inside → Outside:** Collaboration state, task locks, and session archives remain cleanly inside the hub directory.

---

## The 8-Step `/assemble` Team Workflow

1. **Read `USER_INBOX.md` & Assemble:** Agents read `USER_INBOX.md` (executing the message marked **`LATEST`** plus any attachments) and run `node scripts/hub.js assemble "@Agent"`.
2. **Gather Context:** Agents read their agent protocol `.md`, `TASKS.md`, and `AGENT_COMMUNICATION.md`, acknowledge unread messages, and inspect project files (read-only).
3. **Wait for Team:** Agents run `node scripts/hub.js health` / `wait-team` (no edits outside the hub until approved).
4. **Co-Author Plan:** Agents agree on roles and tasks and record `node scripts/hub.js plan draft`.
5. **Interactive Poll Approval:** `Main` submits a checkpoint report + poll; voting approve on the poll unlocks execution.
6. **Managed Execution & Locks:** `Main` acts as Engineering Manager; teammates claim tasks (`node scripts/hub.js claim`) and lock edited files.
7. **Passive Health & Failover:** `node scripts/hub.js health` detects `CREDIT_EXHAUSTED` or `OFFLINE` peers and promotes a `Substitute Main` automatically if `Main` drops.
8. **Milestones & Sign-Off:** Any agent posts milestones; only `Main` sends `final_summary` and posts `[SIGN-OFF]` to `@All` before anyone goes `OFFLINE`.

---

## License

MIT License — see `LICENSE` included in the extension package.
