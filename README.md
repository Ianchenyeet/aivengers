# AIvengers

**Assemble your locally installed VS Code AI coding extensions and built-in chat participants into one synchronized engineering team.**

---

## What Does AIvengers Do?

Instead of juggling separate chat tabs and copy-pasting context between different coding tools, **AIvengers** adds a dedicated **AIvengers** collaboration tab in VS Code's Secondary Side Bar:

- **Assemble a Multi-Agent Team in Seconds:** Choose your **Main** agent in **Slot 1** (who coordinates tasks, submits plans, and verifies quality) and click **`+`** to split out extra teammate slots (**Slot 2, Slot 3, ...**) — or click **`⚡ Auto-Fill Installed Team`** to populate all detected extensions at once.
- **Same-Provider Multi-Model Teams & Live Model Detection:** Run multiple different models from the same provider side by side in separate slots, query live available language models via the official `vscode.lm` API, and display every agent's **Model Name** in team headers and reports.
- **Two-Tab Slot Picker (`🤖 Agents & Models` | `🎨 Roles`) & RYB Color Mixing:** Assign **0, 1, or multiple** non-conflicting roles from 23 specialized roles across 6 categories (or leave any slot unrestricted with 0 roles), pick curated team presets (`2-Agent Duo`, `3-Agent Feature Squad`, `4-Agent Interactive / Game Team`), and see each slot's outline update to its subtractive RYB paint-mixed color while opposing roles are automatically disabled.
- **Same-Session Continuity & Multi-Message History:** Follow-up prompts stay inside open chat sessions while preserving `Message 1`, `Message 2`, ... history in `USER_INBOX.md` and directing every teammate to work on the latest message.
- **Attach Files & Folders Directly:** Use **`📎 Attach Files`** and **`📁 Attach Folder`** in the composer to pass workspace context files and directories straight into `USER_INBOX.md` and chat prompts.
- **Signal-Only Feed & Interactive Plan Approval Polls:** No noisy agent chatter—only structured **Reports**, **Questions**, and **Polls** attributed by **Model Name** and role color appear in the AIvengers feed. Voting to approve an agent's plan poll unlocks implementation outside the hub.
- **Workspace Productivity Tools:** Browse & switch **Saved Collaborations (`🕘`)**, customize global and per-slot prompt templates in **Settings (`⚙️`)**, jump straight to live **`📋 Tasks`** and **`💬 Comms`**, promote any teammate to Main (**`★`**), filter the feed, copy reports, use built-in **Prompt Starters**, or open the in-app **Quick Guide (`?`)**.
- **Passive Status Tracking, File Locks & Failover:** Tracks session status via workspace files, manages task locks in `TASKS.md`, supports clean cancellation (`⏹ Stop`), and automatically promotes a **`Substitute Main`** if `Main` goes offline or hits a quota limit.

---

## How to Set Up & Use AIvengers (Zero CLI Commands or Manual Skill Setup)

**No terminal commands or manual `/assemble` skill installation are required.** Everything works immediately out of the box after installing the extension:

- **Automatic Kickoff Injection:** When you click **`Send ↑`**, AIvengers automatically injects the collaboration instructions, file paths (`USER_INBOX.md`, `AGENTS.md`, `scripts/hub.js`), participant IDs, and active role directives directly into each teammate's kickoff prompt.
- **Built-In Hub Fallback:** If your project does not contain a local `vibe coding tools` folder yet, AIvengers automatically runs from the hub bundled inside the extension so it works cleanly in any repository without modifying your repo files.

### Step-by-Step Setup & Usage

1. **Open the AIvengers Tab:** Click the **AIvengers** icon in VS Code's Secondary Side Bar (`Ctrl+Alt+B` or Command Palette: **`AIvengers: Focus AIvengers Tab`**).
2. **Choose Extensions, Models & Optional Roles:**
   - Click **`⚡ Auto-Fill Installed Team`**, or click **Slot 1 (`Main`)** to open the two-tab picker.
   - Use **`🤖 Agents & Models`** to select an installed chat extension and exact model (or pick a preset like **2-Agent Duo**, **3-Agent Feature Squad**, or **4-Agent Interactive / Game Team**).
   - Use **`🎨 Roles`** to optionally assign **0, 1, or multiple** non-conflicting roles (conflicting opposing roles are automatically disabled, and slot borders light up with their RYB paint-mixed color).
   - Click **`+`** next to the last slot to split out additional teammate slots—including a second or third distinct model from the same provider.
3. *(Optional)* **Initialize Local Workspace Hub (1 Click):** If you want a standalone `vibe coding tools/` folder copied into your workspace (`AGENTS.md`, scripts, and role definitions), run Command Palette **`AIvengers: Initialize Drop-In AIvengers Hub Folder in Workspace`**, or click **`⚙️ Settings` → `Init Hub Folder`** (or **`📦 Init Hub in Workspace`** inside the **`?`** Quick Guide).
4. **Attach Context & Send:** Type your task in the prompt box (or pick a built-in **Prompt Starter**), optionally attach files (**`📎`**) or folders (**`📁`**), and press **Enter** / **`Send ↑`**. *(For external CLI tools enabled in Settings, click **`Copy Prompt`** on the dispatched message card and paste it into that tool's window.)*
5. **Approve Plan Polls & Track Reports:** Follow progress directly in the **AIvengers** feed, where each teammate reports by its **Model Name** and role color, and vote on Plan Polls to authorize edits outside the hub.

---

## Supported Extensions & Host Compliance

AIvengers automatically scans your **locally installed** VS Code AI coding extensions, built-in chat participants, and available `vscode.lm` language models in your current editor environment.

AIvengers is strictly a **local workspace organization and prompt-dispatch tool**—it does **not** open, host, or run local agent extensions on other platforms:

- **Team Organization & Prompt Dispatch Only:** AIvengers helps you organize team slots, assign roles, coordinate tasks and reports through local Markdown hub files (`USER_INBOX.md`, `TASKS.md`, `AGENT_COMMUNICATION.md`), and forward your prompt to the agents you choose.
- **Official Local Extensions Required:** To include an agent or IDE chat assistant in a team, the original official extension/client must already be installed and signed in on your machine in its native environment. AIvengers simply forwards your prompts to those locally installed official extensions using standard editor commands.
- **Native Extension Authentication Only:** Each coding assistant uses its own official local installation and sign-in session; AIvengers operates strictly within your local editor workspace.

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
