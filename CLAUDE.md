# Claude Code Collaboration Protocol (`vibe coding tools`)

## ⚡ Default Mode
For standard prompts without `/assemble`:
- Respond and code normally. Do NOT access `USER_INBOX.md` or modify `TASKS.md`.

## 🚀 Assembly Mode: `/assemble`
When the user types `/assemble`:
1. Run `node scripts/hub.js assemble "@Claude"` to register your assembly in `AGENT_COMMUNICATION.md`.
2. Read the user's plain-text request in `USER_INBOX.md`.
3. Check `TASKS.md` for active locks and ready tasks.
4. Claim a task by setting `Status: [IN PROGRESS]`, `Assigned Agent: @Claude`, and listing `Locked Files`.
5. Post handoffs or review requests to `@Antigravity` / `@Copilot` in `AGENT_COMMUNICATION.md`.
6. On completion, mark `[DONE]` in `TASKS.md` and append to `ACTIVITY_LOG.md`.
