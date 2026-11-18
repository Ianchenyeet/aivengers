# Changelog

All notable changes to **AIvengers** are documented in this file.

## [2.2.0] — 2026-11-18
### Added & Changed
- **Official Rebrand to AIvengers:** Renamed the extension and Secondary Side Bar view to **AIvengers** with the custom metallic blue **AI** emblem (`media/icon.png` + `media/aivengers-icon.svg`).
- **Multi-Role Registry, RYB Color Mixing & Two-Tab Slot Picker:** Added 23 specialized roles across 6 categories with bidirectional conflict detection, Gossett & Chen subtractive RYB paint-color mixing on dynamic slot borders, curated team presets, split-from-front slot creation (`+`), and support for 0, 1, or multiple roles per slot.
- **Same-Provider Multi-Model Teams & Model-Name Reporting:** Added support for running distinct models from the same provider side by side while displaying each teammate's Model Name and mixed role color in headers, logs, and feed cards.
- **Interactive Quick Guide & "How to Set Up" Drawer (`?`):** Added an in-panel guide explaining setup, official local extension usage, Slot 1 (`Main`) + Slot 2+ teammates, and one-click setup actions.
- **Quick-Assemble Team & Prompt Starters:** Added **Auto-Fill Installed Team (`⚡ Auto`)**, one-click **Make Main (`★`)** slot promotion, and curated starter prompt templates (*Build Feature*, *Fix Bug*, *Code & Security Audit*, *Write & Verify Tests*) in the empty state.
- **Live Tasks & Comms Shortcuts (`📋 Tasks`, `💬 Comms`):** Added composer shortcuts with live pending/done task counters plus quick initialization of the drop-in hub folder in any workspace (`AIvengers: Initialize Drop-In AIvengers Hub Folder in Workspace`).
- **Feed Filter & One-Click Copy Report:** Filter the feed by *All*, *Reports*, *Polls & Questions*, or *Prompts*, and copy any agent report summary cleanly.

## [2.1.0] — 2026-11-16
### Added & Changed
- **Same-Session Chat Continuity:** Follow-up dispatches reuse existing host chat conversations by default while preserving `Message 1`, `Message 2`, ... in `USER_INBOX.md` and directing agents to the latest message.
- **File & Folder Attachments:** Added `📎 Attach Files` and `📁 Attach Folder` composer controls with clickable context chips forwarded directly to local chat participants.
- **Poll-Only Plan Approval & Auto Sign-Off:** Voting approve on an interactive poll automatically unlocks execution; sending `final_summary` automatically marks the session complete, posts `[SIGN-OFF]` in `AGENT_COMMUNICATION.md`, and hides the Stop button cleanly.
- **Reliable Stop & Cancellation Guard:** Stopping a session marks `AGENT_PRESENCE.json` cancelled immediately, terminates tracked session processes cleanly, pushes a `🛑 STOP` steer into open chat tabs without starting an orphan conversation, and blocks further hub calls until the next session.

## [2.0.0] — 2026-11-15
### Added
- Native VS Code Secondary Side Bar collaboration tab with automatic coding agent discovery, per-slot model selection, live `vscode.lm` model detection, custom prompt template editors, and saved session history drawer.
