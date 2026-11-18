# Changelog

All notable changes to **AIvengers** are documented in this file.

## [2.2.0] — 2026-11-16
### Added & Changed
- **Official Rebrand to AIvengers:** Renamed the extension and Secondary Side Bar view to **AIvengers** with the custom metallic blue **AI** emblem (`media/icon.png` + `media/aivengers-icon.svg`).
- **Interactive Quick Guide & "What AIvengers Does" Drawer (`?`):** Added an in-panel guide explaining how Slot 1 (`Main` Engineering Manager) and Slot 2+ (Specialist Teammates) collaborate, with one-click setup actions.
- **Quick-Assemble Team & Prompt Starters:** Added **Auto-Fill Installed Team (`⚡ Auto`)**, one-click **Make Main (`★`)** slot promotion, and curated starter prompt templates (*Build Feature*, *Fix Bug*, *Code & Security Audit*, *Write & Verify Tests*) in the empty state.
- **Live Tasks & Comms Shortcuts (`📋 Tasks`, `💬 Comms`):** Added composer shortcuts with live pending/done task counters plus quick initialization of the drop-in hub folder in any workspace (`AIvengers: Initialize Drop-In AIvengers Hub Folder in Workspace`).
- **Feed Filter & One-Click Copy Report:** Filter the feed by *All*, *Reports*, *Polls & Questions*, or *Prompts*, and copy any agent report summary cleanly.

## [2.1.0] — 2026-11-16
### Added & Changed
- **Same-Session Chat Continuity:** Follow-up dispatches reuse existing Antigravity and Copilot Chat conversations by default while preserving `Message 1`, `Message 2`, ... in `USER_INBOX.md` and directing agents to the latest message.
- **File & Folder Attachments:** Added `📎 Attach Files` and `📁 Attach Folder` composer controls with clickable context chips forwarded directly to Antigravity and Copilot Chat.
- **Poll-Only Plan Approval & Auto Sign-Off:** Voting approve on an interactive poll automatically unlocks execution; sending `final_summary` automatically marks the session complete, posts `[SIGN-OFF]` in `AGENT_COMMUNICATION.md`, and hides the Stop button cleanly.
- **Reliable Stop & Cancellation Guard:** Stopping a session marks `AGENT_PRESENCE.json` cancelled immediately, terminates tracked CLI PIDs, pushes a `🛑 STOP` steer into Antigravity without starting an orphan conversation, and blocks further `hub.js` / MCP calls with exit code `4`.

## [2.0.0] — 2026-11-15
### Added
- Native VS Code Secondary Side Bar collaboration tab with automatic coding agent discovery, per-slot model selection, GitHub Copilot plan detection, custom prompt template editors, and saved session history drawer.
