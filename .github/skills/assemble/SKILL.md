---
name: assemble
description: "Assemble into the multi-agent workspace, read USER_INBOX.md, and coordinate with peer agents."
disable-model-invocation: true
---
You are now assembled into the Multi-Agent Workspace (`vibe coding tools`).

Follow this workflow:
1. Run `node scripts/hub.js assemble "@Copilot"` to register your assembly in the workspace.
2. Read `USER_INBOX.md` to see what the user asked for.
3. Review `TASKS.md` to see current tasks and locked files.
4. Claim an available task in `TASKS.md` or decompose the user's request.
5. Work on the task, respecting locks held by other agents.
6. Post any handoffs or updates to `@Antigravity` or `@All` in `AGENT_COMMUNICATION.md`.
