#!/usr/bin/env node

/**
 * Multi-Agent Collaboration Hub CLI
 * Zero-dependency Node.js CLI utility for multi-agent coordination.
 * Used by human users and AI agents (Antigravity, Copilot, Claude, Cursor)
 * to query status, claim tasks, post inter-agent messages, and update logs.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INBOX_PATH = path.join(ROOT_DIR, 'USER_INBOX.md');
const TASKS_PATH = path.join(ROOT_DIR, 'TASKS.md');
const COMM_PATH = path.join(ROOT_DIR, 'AGENT_COMMUNICATION.md');
const LOG_PATH = path.join(ROOT_DIR, 'ACTIVITY_LOG.md');
const DECISIONS_PATH = path.join(ROOT_DIR, 'DECISIONS.md');

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

function readFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return '';
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
🤝 Multi-Agent Hub CLI ('vibe coding tools')

Usage:
  node scripts/hub.js [command] [options]

Commands:
  status                               Show active user directives, in-progress tasks, and messages
  inbox                                Print active user instructions from USER_INBOX.md
  tasks                                List tasks from TASKS.md
  claim <taskId> <agent> [files...]    Claim a task in TASKS.md and lock files
  complete <taskId> <agent>            Mark task as [DONE] in TASKS.md and log to ACTIVITY_LOG.md
  msg --from <agent> --to <target> --subject <subj> --body <text> [--type <TYPE>]
                                       Post a message to AGENT_COMMUNICATION.md
  log --agent <agent> --action <act> --files <files> [--notes <notes>]
                                       Record an entry into ACTIVITY_LOG.md
  help                                 Show this help screen
`);
}

function cmdStatus() {
  console.log('='.repeat(60));
  console.log('🤖 MULTI-AGENT WORKSPACE STATUS OVERVIEW');
  console.log('='.repeat(60));

  // 1. Inbox
  const inbox = readFileSafe(INBOX_PATH);
  console.log('\n📥 ACTIVE USER DIRECTIVE:');
  const directiveMatch = inbox.match(/## ⚡ Active User Directives[\s\S]*?(?=---|\n## )/);
  if (directiveMatch) {
    const cleaned = directiveMatch[0].replace(/## ⚡ Active User Directives[^\n]*\n/, '').trim();
    console.log(cleaned || '  (No active directives)');
  } else {
    console.log('  (Could not parse active directives)');
  }

  // 2. Active Tasks
  const tasks = readFileSafe(TASKS_PATH);
  console.log('\n📋 IN-PROGRESS TASKS & LOCKED FILES:');
  const activeSection = tasks.match(/## 🏃 Active Tasks[\s\S]*?(?=## 🎯 Ready|## 🗄️ Backlog|## ✅ Completed|$)/);
  if (activeSection) {
    const inProgress = activeSection[0].replace(/## 🏃 Active Tasks[^\n]*\n/, '').trim();
    console.log(inProgress || '  (No tasks currently in progress)');
  }

  // 3. Ready Tasks
  console.log('\n🎯 READY TASKS:');
  const readySection = tasks.match(/## 🎯 Ready for Work[\s\S]*?(?=## 🗄️ Backlog|## ✅ Completed|$)/);
  if (readySection) {
    const ready = readySection[0].replace(/## 🎯 Ready for Work[^\n]*\n/, '').trim();
    console.log(ready || '  (No tasks waiting in ready state)');
  }

  // 4. Latest Messages
  const comm = readFileSafe(COMM_PATH);
  console.log('\n💬 RECENT AGENT THREADS:');
  const msgMatches = comm.match(/### 💬 `MSG-\d+`[^\n]*\n(?:[^\n]*\n){1,8}/g);
  if (msgMatches && msgMatches.length > 0) {
    const recent = msgMatches.slice(-2);
    recent.forEach((m) => console.log(m.trim() + '\n'));
  } else {
    console.log('  (No messages found)');
  }

  console.log('='.repeat(60));
}

function cmdInbox() {
  const inbox = readFileSafe(INBOX_PATH);
  console.log(inbox);
}

function cmdTasks() {
  const tasks = readFileSafe(TASKS_PATH);
  console.log(tasks);
}

function cmdClaim(taskId, agentName, lockedFiles) {
  if (!taskId || !agentName) {
    console.error('Error: claim requires <taskId> and <agentName>');
    process.exit(1);
  }

  const agentFormatted = agentName.startsWith('@') ? agentName : `@${agentName}`;
  const filesList = lockedFiles && lockedFiles.length > 0
    ? lockedFiles.map(f => `  - \`${f}\``).join('\n')
    : '  - *(None specified)*';

  let tasks = readFileSafe(TASKS_PATH);
  const taskRegex = new RegExp(`### \`${taskId}\`:[\\s\\S]*?(?=\\n### |\\n## |$)`, 'g');
  const match = tasks.match(taskRegex);

  if (!match) {
    console.error(`Error: Task ${taskId} not found in ${TASKS_PATH}`);
    process.exit(1);
  }

  const existingBlock = match[0];
  let updatedBlock = existingBlock
    .replace(/- \*\*Status:\*\* .*/, `- **Status:** \`[IN PROGRESS]\``)
    .replace(/- \*\*Assigned Agent:\*\* .*/, `- **Assigned Agent:** \`${agentFormatted}\``);

  if (updatedBlock.includes('- **Claimed At:**')) {
    updatedBlock = updatedBlock.replace(/- \*\*Claimed At:\*\* .*/, `- **Claimed At:** ${getTimestamp()}`);
  } else {
    updatedBlock = updatedBlock.replace(/- \*\*Assigned Agent:\*\* .*/, `$& \n- **Claimed At:** ${getTimestamp()}`);
  }

  if (lockedFiles && lockedFiles.length > 0) {
    if (updatedBlock.includes('- **Locked Files:**')) {
      updatedBlock = updatedBlock.replace(/- \*\*Locked Files:\*\*[\s\S]*?(?=\n- \*\*|$)/, `- **Locked Files:**\n${filesList}`);
    } else {
      updatedBlock = updatedBlock.replace(/- \*\*Assigned Agent:\*\* .*/, `$& \n- **Locked Files:**\n${filesList}`);
    }
  }

  tasks = tasks.replace(existingBlock, updatedBlock);
  fs.writeFileSync(TASKS_PATH, tasks, 'utf8');

  // Log in ACTIVITY_LOG.md
  cmdLogInternal(agentFormatted, `Claimed ${taskId}`, lockedFiles ? lockedFiles.join(', ') : 'None', 'Task started');
  console.log(`✅ Successfully claimed ${taskId} for ${agentFormatted}`);
}

function cmdComplete(taskId, agentName) {
  if (!taskId || !agentName) {
    console.error('Error: complete requires <taskId> and <agentName>');
    process.exit(1);
  }

  const agentFormatted = agentName.startsWith('@') ? agentName : `@${agentName}`;
  let tasks = readFileSafe(TASKS_PATH);
  const taskRegex = new RegExp(`### \`${taskId}\`:[\\s\\S]*?(?=\\n### |\\n## |$)`, 'g');
  const match = tasks.match(taskRegex);

  if (!match) {
    console.error(`Error: Task ${taskId} not found in ${TASKS_PATH}`);
    process.exit(1);
  }

  const existingBlock = match[0];
  let updatedBlock = existingBlock
    .replace(/- \*\*Status:\*\* .*/, `- **Status:** \`[DONE]\``)
    .replace(/- \*\*Assigned Agent:\*\* .*/, `- **Assigned Agent:** \`${agentFormatted}\` (Completed)`);

  // Move under ## ✅ Completed Tasks
  tasks = tasks.replace(existingBlock, '').trim();
  const completedHeader = '## ✅ Completed Tasks (`[DONE]`)';
  if (tasks.includes(completedHeader)) {
    tasks = tasks.replace(
      completedHeader,
      `${completedHeader}\n\n${updatedBlock.trim()}`
    );
  } else {
    tasks += `\n\n${completedHeader}\n\n${updatedBlock.trim()}\n`;
  }

  fs.writeFileSync(TASKS_PATH, tasks, 'utf8');
  cmdLogInternal(agentFormatted, `Completed ${taskId}`, 'N/A', 'Task finished and verified');
  console.log(`🎉 Task ${taskId} marked as completed by ${agentFormatted}`);
}

function cmdMsg(flags) {
  const from = flags.from ? (flags.from.startsWith('@') ? flags.from : `@${flags.from}`) : '@Agent';
  const to = flags.to ? (flags.to.startsWith('@') ? flags.to : `@${flags.to}`) : '@All';
  const type = flags.type || 'HANDOFF';
  const subject = flags.subject || 'Status Update';
  const body = flags.body || '(No body provided)';

  let comm = readFileSafe(COMM_PATH);
  const countMatches = comm.match(/### 💬 `MSG-(\d+)`/g);
  let nextNum = 1;
  if (countMatches && countMatches.length > 0) {
    const last = countMatches[countMatches.length - 1];
    const num = parseInt(last.replace(/\D/g, ''), 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  const msgId = `MSG-${String(nextNum).padStart(3, '0')}`;

  const entry = `
### 💬 \`${msgId}\` · ${subject}
- **Date & Time:** ${getTimestamp()}
- **From:** \`${from}\`
- **To:** \`${to}\`
- **Type:** \`[${type.toUpperCase()}]\`
- **Status:** \`[OPEN]\`
- **Subject:** ${subject}
- **Body:**
  > ${body.replace(/\n/g, '\n  > ')}
`;

  comm = comm.trimEnd() + '\n\n' + entry.trim() + '\n';
  fs.writeFileSync(COMM_PATH, comm, 'utf8');
  console.log(`📨 Message ${msgId} posted to ${COMM_PATH}`);
}

function cmdLogInternal(agent, action, files, notes) {
  let log = readFileSafe(LOG_PATH);
  const row = `| \`${getTimestamp()}\` | \`${agent}\` | ${action} | \`${files}\` | ${notes || ''} |\n`;
  log = log.trimEnd() + '\n' + row;
  fs.writeFileSync(LOG_PATH, log, 'utf8');
}

function cmdLog(flags) {
  const agent = flags.agent ? (flags.agent.startsWith('@') ? flags.agent : `@${flags.agent}`) : '@Agent';
  const action = flags.action || 'Code update';
  const files = flags.files || 'Workspace';
  const notes = flags.notes || '';

  cmdLogInternal(agent, action, files, notes);
  console.log(`📝 Logged action into ${LOG_PATH}`);
}

function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    cmdStatus();
    return;
  }

  const { flags, positional } = parseArgs(rawArgs);
  const command = positional[0] ? positional[0].toLowerCase() : 'help';

  switch (command) {
    case 'status':
      cmdStatus();
      break;
    case 'inbox':
      cmdInbox();
      break;
    case 'tasks':
      cmdTasks();
      break;
    case 'claim':
      cmdClaim(positional[1], positional[2], positional.slice(3));
      break;
    case 'complete':
      cmdComplete(positional[1], positional[2]);
      break;
    case 'msg':
      cmdMsg(flags);
      break;
    case 'log':
      cmdLog(flags);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main();
