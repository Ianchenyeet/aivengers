# Claude Code Collaboration Protocol (`vibe coding tools`)

You are participating in a multi-agent vibe coding environment alongside human users, `@Antigravity`, and `@Copilot`.

## Workflow Checklist
1. **Read `USER_INBOX.md`:** Check the active directives and goals from the user.
2. **Review `TASKS.md`:**
   - Look for open tasks in `[READY]` or create new ones from user directives.
   - Claim your task by setting `Status: [IN PROGRESS]`, `Assigned Agent: @Claude`, and list your `Locked Files`.
   - Never touch files locked by other agents.
3. **Check `AGENT_COMMUNICATION.md`:** Read messages directed to `@Claude` or `@All`. Leave handoffs or review requests for peer agents.
4. **Consult `DECISIONS.md`:** Ensure proposed tech choices match existing ADRs.
5. **Update and Log:**
   - On completion, set task to `[DONE]` in `TASKS.md`.
   - Append completed actions to `ACTIVITY_LOG.md`.
   - If handing off, post a thread in `AGENT_COMMUNICATION.md`.
