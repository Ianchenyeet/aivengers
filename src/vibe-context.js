#!/usr/bin/env node

/**
 * vibe-context — Multi-Agent Workspace Context Packager
 * Part of Vibe Coding Tools Suite.
 * Bundles active user directives, task board state, file locks, recent ADRs,
 * and git status into a compact, high-signal LLM prompt for peer agents.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INBOX_PATH = path.join(ROOT_DIR, 'USER_INBOX.md');
const TASKS_PATH = path.join(ROOT_DIR, 'TASKS.md');
const COMM_PATH = path.join(ROOT_DIR, 'AGENT_COMMUNICATION.md');
const DECISIONS_PATH = path.join(ROOT_DIR, 'DECISIONS.md');
const STATE_PATH = path.join(ROOT_DIR, 'PROJECT_STATE.md');

function readFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {}
  return '';
}

function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function showHelp() {
  console.log(`
🧭 vibe-context — Multi-Agent Context Packager

Usage:
  node src/vibe-context.js [options]

Options:
  --target <agent>       Tailor prompt for target agent: 'copilot', 'cursor', 'claude', or 'all'
  --out <filepath>       Write bundled context to a file (e.g. .context.md)
  --include-files        Include snippets of locked / modified files
  --help                 Show this help screen

Examples:
  node src/vibe-context.js
  node src/vibe-context.js --target copilot --out copilot_prompt.md
`);
}

function buildContext(targetAgent, includeFiles) {
  const target = (targetAgent || 'Agent').toUpperCase();
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

  // 1. User Directives
  const inbox = readFileSafe(INBOX_PATH);
  const activeDirectiveMatch = inbox.match(/## ⚡ Active User Directives[\s\S]*?(?=---|\n## )/);
  const activeDirective = activeDirectiveMatch
    ? activeDirectiveMatch[0].replace(/## ⚡ Active User Directives[^\n]*\n/, '').trim()
    : '(No active user directives found)';

  // 2. Active Tasks & Locks
  const tasks = readFileSafe(TASKS_PATH);
  const activeTasksMatch = tasks.match(/## 🏃 Active Tasks[\s\S]*?(?=## 🎯 Ready|## 🗄️ Backlog|## ✅ Completed|$)/);
  const activeTasks = activeTasksMatch
    ? activeTasksMatch[0].replace(/## 🏃 Active Tasks[^\n]*\n/, '').trim()
    : '(No active tasks claimed)';

  const readyTasksMatch = tasks.match(/## 🎯 Ready for Work[\s\S]*?(?=## 🗄️ Backlog|## ✅ Completed|$)/);
  const readyTasks = readyTasksMatch
    ? readyTasksMatch[0].replace(/## 🎯 Ready for Work[^\n]*\n/, '').trim()
    : '(No tasks ready)';

  // 3. Recent Communications
  const comm = readFileSafe(COMM_PATH);
  const msgMatches = comm.match(/### 💬 `MSG-\d+`[^\n]*\n(?:[^\n]*\n){1,8}/g);
  const recentMsgs = msgMatches && msgMatches.length > 0
    ? msgMatches.slice(-3).map(m => m.trim()).join('\n\n')
    : '(No recent messages)';

  // 4. Architecture Decisions
  const decisions = readFileSafe(DECISIONS_PATH);
  const adrListMatch = decisions.match(/## Index of Decisions[\s\S]*?(?=---)/);
  const adrs = adrListMatch ? adrListMatch[0].trim() : '(No ADRs indexed)';

  // 5. Git Status
  const gitStatus = runGit('git status -s') || '(Clean working directory)';

  let prompt = `# 🤖 Multi-Agent Context Briefing for @${target}
Generated at: ${timestamp}

## 📥 Active User Directive
${activeDirective}

## 📋 Task Board Snapshot
### Active In-Progress (Check Locks):
${activeTasks}

### Ready Tasks (Available to Claim):
${readyTasks}

## 💬 Recent Inter-Agent Threads
${recentMsgs}

## 🏛️ Architectural Guardrails (ADRs)
${adrs}

## 🔍 Current Git Modified Files
\`\`\`
${gitStatus}
\`\`\`

## 📌 Protocol Checklist for @${target}:
1. Check locked files above: Do NOT modify files locked by another active agent.
2. If picking up a task, claim it first in \`TASKS.md\` with your agent tag.
3. Post handoffs or reviews to peer agents in \`AGENT_COMMUNICATION.md\`.
4. Log completions to \`TASKS.md\` and \`ACTIVITY_LOG.md\`.
`;

  return prompt;
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    return;
  }

  const targetAgent = flags.target || 'Copilot';
  const context = buildContext(targetAgent, flags['include-files']);

  if (flags.out) {
    const outPath = path.resolve(ROOT_DIR, flags.out);
    fs.writeFileSync(outPath, context, 'utf8');
    console.log(`✅ Bundled context written to: ${flags.out}`);
  } else {
    console.log(context);
  }
}

main();
