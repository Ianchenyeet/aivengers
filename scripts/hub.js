#!/usr/bin/env node

/**
 * Multi-Agent Collaboration Hub CLI
 * Zero-dependency Node.js CLI utility for multi-agent coordination.
 * Used by human users and AI agents (Antigravity, Copilot, Claude, Cursor)
 * to query status, claim tasks, post inter-agent messages, update logs,
 * and archive/resume collaboration sessions.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARCHIVES_DIR = path.join(ROOT_DIR, 'archives');
const INBOX_PATH = path.join(ROOT_DIR, 'USER_INBOX.md');
const TASKS_PATH = path.join(ROOT_DIR, 'TASKS.md');
const COMM_PATH = path.join(ROOT_DIR, 'AGENT_COMMUNICATION.md');
const LOG_PATH = path.join(ROOT_DIR, 'ACTIVITY_LOG.md');
const DECISIONS_PATH = path.join(ROOT_DIR, 'DECISIONS.md');
const STATE_PATH = path.join(ROOT_DIR, 'PROJECT_STATE.md');

const COLLAB_FILES = [
  'USER_INBOX.md',
  'TASKS.md',
  'AGENT_COMMUNICATION.md',
  'ACTIVITY_LOG.md',
  'PROJECT_STATE.md'
];

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

function getFileSafeTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${mins}-${secs}`;
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
  node scripts/hub.js [command] [subcommand] [options]

Workspace Commands:
  assemble [agent]                     Assemble an agent into the workspace (reads inbox & announces)
  status                               Show active user directives, in-progress tasks, and messages
  inbox                                Print active user instructions from USER_INBOX.md
  tasks                                List tasks from TASKS.md
  claim <taskId> <agent> [files...]    Claim a task in TASKS.md and lock files
  complete <taskId> <agent>            Mark task as [DONE] in TASKS.md and log to ACTIVITY_LOG.md
  msg --from <agent> --to <target> --subject <subj> --body <text> [--type <TYPE>]
                                       Post a message to AGENT_COMMUNICATION.md
  read <msgId|all> <agent> [note]      Confirm read on message(s) ("Roger that" receipt)
  unread <agent>                       List unread messages addressed to an agent
  log --agent <agent> --action <act> --files <files> [--notes <notes>]
                                       Record an entry into ACTIVITY_LOG.md

Session Archiving & Resuming Commands:
  archive save [name] [--new]          Archive current collaboration files into archives/<folder>
                                       (pass --new to archive & start a fresh session immediately)
  archive list                         List all saved collaboration sessions in archives/
  archive resume <name|index>          Restore an archived session back into the workspace
                                       (auto-backs up current active state before restoring)
  archive new [name]                   Archive current session and initialize fresh collaboration files

Aliases:
  save [name]                          Alias for 'archive save'
  resume <name|index>                  Alias for 'archive resume'
  sessions                             Alias for 'archive list'
  read <msgId|all> <agent> [note]      Alias for 'read' / 'ack' / 'roger'
  ack <msgId|all> <agent> [note]       Alias for 'read'
  roger <msgId|all> <agent> [note]     Alias for 'read'
  unread <agent>                       List unread messages for an agent
  help                                 Show this help screen
`);
}

function getCasualInboxText() {
  const raw = readFileSafe(INBOX_PATH);
  if (!raw) return '(USER_INBOX.md is empty)';
  const marker = '<!-- WRITE CASUALLY BELOW THIS LINE -->';
  if (raw.includes(marker)) {
    return raw.split(marker)[1].trim();
  }
  const parts = raw.split(/^---$/m);
  if (parts.length > 1) {
    return parts.slice(1).join('---').trim();
  }
  return raw.replace(/^#\s+[^\n]*\n/, '').trim();
}

function cmdAssemble(agentName) {
  const agent = agentName ? (agentName.startsWith('@') ? agentName : `@${agentName}`) : '@Agent';
  const timestamp = getTimestamp();
  const userText = getCasualInboxText();

  console.log('='.repeat(60));
  console.log(`🚀 ${agent.toUpperCase()} ASSEMBLED INTO WORKSPACE`);
  console.log('='.repeat(60));

  console.log('\n📥 USER INBOX (Casual Request):');
  console.log(userText ? `"${userText}"\n` : '(No instructions in USER_INBOX.md yet)\n');

  // Post assembly thread in AGENT_COMMUNICATION.md
  let comm = readFileSafe(COMM_PATH);
  const countMatches = comm.match(/### 💬 `MSG-(\d+)`/g);
  let nextNum = 1;
  if (countMatches && countMatches.length > 0) {
    const last = countMatches[countMatches.length - 1];
    const num = parseInt(last.replace(/\D/g, ''), 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  const msgId = `MSG-${String(nextNum).padStart(3, '0')}`;
  const assembleMsg = `
### 💬 \`${msgId}\` · Agent Assembled via /assemble
- **Date & Time:** ${timestamp}
- **From:** \`${agent}\`
- **To:** \`@All\`
- **Type:** \`[ASSEMBLE]\`
- **Status:** \`[OPEN]\`
- **Read By:** (none)
- **Subject:** ${agent} Joined Workspace
- **Body:**
  > ${agent} has been assembled into the workspace via \`/assemble\`.
  > User Request: "${userText.slice(0, 120)}${userText.length > 120 ? '...' : ''}"
`;
  comm = comm.trimEnd() + '\n\n' + assembleMsg.trim() + '\n';
  fs.writeFileSync(COMM_PATH, comm, 'utf8');

  // Log to ACTIVITY_LOG.md
  cmdLogInternal(agent, 'Assembled into workspace (/assemble)', 'USER_INBOX.md, TASKS.md', 'Joined multi-agent collaboration session');

  console.log(`📋 CURRENT TASK BOARD STATUS:`);
  const tasks = readFileSafe(TASKS_PATH);
  const activeSection = tasks.match(/## 🏃 Active Tasks[\s\S]*?(?=## 🎯 Ready|## 🗄️ Backlog|## ✅ Completed|$)/);
  if (activeSection) {
    console.log(activeSection[0].trim());
  }
  const readySection = tasks.match(/## 🎯 Ready for Work[\s\S]*?(?=## 🗄️ Backlog|## ✅ Completed|$)/);
  if (readySection) {
    console.log('\n' + readySection[0].trim());
  }

  // Check for unread messages for this agent
  const unread = getUnreadMessages(agent);
  console.log(`\n📬 UNREAD MESSAGES FOR ${agent.toUpperCase()} (${unread.length}):`);
  if (unread.length === 0) {
    console.log('  ✨ All messages have been confirmed read (inbox up to date).');
  } else {
    for (const msg of unread) {
      console.log(`  • ${msg.id} · ${msg.subject} (From: ${msg.from}, Date: ${msg.dateTime})`);
    }
    console.log(`\n  👉 Confirm read with: node scripts/hub.js read <MSG-ID> "${agent}"`);
    console.log(`  👉 Or mark all read:  node scripts/hub.js read all "${agent}"`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`💡 Next Steps for ${agent}:`);
  console.log(`   1. If user request needs tasks, break it down and add to TASKS.md`);
  console.log(`   2. Claim a task: node scripts/hub.js claim <taskId> "${agent}" "files..."`);
  console.log(`   3. Confirm read on messages: node scripts/hub.js read all "${agent}"`);
  console.log(`   4. Coordinate handoffs in AGENT_COMMUNICATION.md`);
  console.log('='.repeat(60));
}

function cmdStatus() {
  console.log('='.repeat(60));
  console.log('🤖 MULTI-AGENT WORKSPACE STATUS OVERVIEW');
  console.log('='.repeat(60));

  // 1. Inbox
  console.log('\n📥 USER INBOX (Prompt):');
  const userText = getCasualInboxText();
  console.log(userText ? `  "${userText}"` : '  (USER_INBOX.md is empty — write your prompt there!)');

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
  const msgMatches = comm.match(/### 💬 `MSG-\d+`[^\n]*\n(?:[^\n]*\n){1,10}/g);
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

  // Remove existing block from its current location
  tasks = tasks.replace(existingBlock, '').trim();

  // Insert into ## 🏃 Active Tasks section
  const activeHeader = '## 🏃 Active Tasks (`[IN PROGRESS]`)';
  if (tasks.includes(activeHeader)) {
    tasks = tasks.replace(
      activeHeader,
      `${activeHeader}\n\n${updatedBlock.trim()}`
    );
  } else {
    tasks = `${activeHeader}\n\n${updatedBlock.trim()}\n\n` + tasks;
  }

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
- **Read By:** (none)
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

// ============================================================
// 💬 MESSAGE READING & ACKNOWLEDGEMENT ("ROGER THAT") FUNCTIONS
// ============================================================

function parseMessages(commContent) {
  const messages = [];
  const matches = commContent.match(/### 💬 `(MSG-\d+)`[\s\S]*?(?=\n### 💬 `MSG-|$)/g);
  if (!matches) return messages;

  for (const block of matches) {
    const idMatch = block.match(/### 💬 `(MSG-\d+)`/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const dateMatch = block.match(/- \*\*Date & Time:\*\*\s*([^\n]+)/);
    const fromMatch = block.match(/- \*\*From:\*\*\s*`?([^`\n]+)`?/);
    const toMatch = block.match(/- \*\*To:\*\*\s*`?([^`\n]+)`?/);
    const typeMatch = block.match(/- \*\*Type:\*\*\s*`?\[?([^\n`\]]+)\]?`?/);
    const statusMatch = block.match(/- \*\*Status:\*\*\s*`?\[?([^\n`\]]+)\]?`?/);
    const readByMatch = block.match(/- \*\*Read By:\*\*\s*([^\n]+)/);
    const subjectMatch = block.match(/- \*\*Subject:\*\*\s*([^\n]+)/);

    messages.push({
      id,
      fullBlock: block,
      dateTime: dateMatch ? dateMatch[1].trim() : '',
      from: fromMatch ? fromMatch[1].trim() : '',
      to: toMatch ? toMatch[1].trim() : '',
      type: typeMatch ? typeMatch[1].trim() : '',
      status: statusMatch ? statusMatch[1].trim() : '',
      readBy: readByMatch ? readByMatch[1].trim() : null,
      subject: subjectMatch ? subjectMatch[1].trim() : '',
    });
  }
  return messages;
}

function getUnreadMessages(agentFormatted) {
  const comm = readFileSafe(COMM_PATH);
  const messages = parseMessages(comm);
  const unread = [];

  const agentLower = (agentFormatted || '').toLowerCase();

  for (const msg of messages) {
    const fromLower = msg.from.toLowerCase();
    const toLower = msg.to.toLowerCase();
    const readByLower = (msg.readBy || '').toLowerCase();

    // Skip self-authored messages
    if (fromLower === agentLower) continue;

    // Check if addressed to agent or to all
    const addressedToAgent = toLower === agentLower || toLower === '@all' || toLower === 'all';
    if (!addressedToAgent) continue;

    // Check if not read yet
    if (!readByLower.includes(agentLower)) {
      unread.push(msg);
    }
  }

  return unread;
}

function confirmMessageRead(comm, msgId, agentFormatted, note) {
  const timestamp = getTimestamp();
  const ackNote = note ? note.trim() : 'Roger that ✓';
  const receipt = `\`${agentFormatted}\` (${timestamp} · "${ackNote}")`;

  const msgRegex = new RegExp(`(### 💬 \`${msgId}\`[\\s\\S]*?)(?=\\n### 💬 \`MSG-|$)`);
  const match = comm.match(msgRegex);
  if (!match) {
    return { success: false, reason: `Message ${msgId} not found` };
  }

  let block = match[0];

  const readByRegex = /- \*\*Read By:\*\*\s*([^\n]*)/;
  const readByMatch = block.match(readByRegex);

  if (readByMatch) {
    const existing = readByMatch[1].trim();
    if (existing.toLowerCase().includes(agentFormatted.toLowerCase())) {
      return { success: false, alreadyRead: true, msgId };
    }
    let newReadBy;
    if (!existing || existing === '(none)') {
      newReadBy = `- **Read By:** ${receipt}`;
    } else {
      newReadBy = `- **Read By:** ${existing}, ${receipt}`;
    }
    block = block.replace(readByRegex, newReadBy);
  } else {
    const statusRegex = /(- \*\*Status:\*\*[^\n]*\n)/;
    if (block.match(statusRegex)) {
      block = block.replace(statusRegex, `$1- **Read By:** ${receipt}\n`);
    } else {
      const subjRegex = /(- \*\*Subject:\*\*[^\n]*)/;
      if (block.match(subjRegex)) {
        block = block.replace(subjRegex, `- **Read By:** ${receipt}\n$1`);
      } else {
        block += `\n- **Read By:** ${receipt}\n`;
      }
    }
  }

  const updatedComm = comm.replace(match[0], block);
  return { success: true, updatedComm, msgId, agent: agentFormatted, note: ackNote };
}

function cmdRead(targetArg, agentArg, noteArg) {
  let target = targetArg;
  let agent = agentArg;
  let note = noteArg;

  // Handle reversed arguments gracefully (e.g. read @Agent MSG-001)
  if (target && target.startsWith('@') && agent && (agent.toUpperCase().startsWith('MSG-') || agent.toLowerCase() === 'all' || /^\d+$/.test(agent))) {
    const tmp = target;
    target = agent;
    agent = tmp;
  }

  if (!target || !agent) {
    console.error('Error: read requires <msgId|all> and <agentName>');
    console.log('Usage: node scripts/hub.js read <MSG-ID|all> <agentName> ["Roger that!"]');
    console.log('Example: node scripts/hub.js read MSG-008 "@Copilot" "Roger that!"');
    process.exit(1);
  }

  const agentFormatted = agent.startsWith('@') ? agent : `@${agent}`;
  let comm = readFileSafe(COMM_PATH);
  if (!comm) {
    console.error(`Error: Could not read ${COMM_PATH}`);
    process.exit(1);
  }

  const isAll = target.toLowerCase() === 'all' || target === '--all';

  if (isAll) {
    const unread = getUnreadMessages(agentFormatted);
    if (unread.length === 0) {
      console.log(`✨ No unread messages to confirm for ${agentFormatted}.`);
      return;
    }

    const confirmedIds = [];
    for (const msg of unread) {
      const res = confirmMessageRead(comm, msg.id, agentFormatted, note);
      if (res.success) {
        comm = res.updatedComm;
        confirmedIds.push(msg.id);
      }
    }

    if (confirmedIds.length > 0) {
      fs.writeFileSync(COMM_PATH, comm, 'utf8');
      const noteStr = note ? ` ("${note}")` : ' ("Roger that ✓")';
      cmdLogInternal(agentFormatted, `Confirmed read on ${confirmedIds.length} message(s): ${confirmedIds.join(', ')}`, 'AGENT_COMMUNICATION.md', `Read receipts confirmed${noteStr}`);
      console.log(`🫡 Confirmed read on ${confirmedIds.length} message(s) by ${agentFormatted}${noteStr}:`);
      console.log(`   ${confirmedIds.join(', ')}`);
    } else {
      console.log(`No messages were updated.`);
    }
    return;
  }

  // Single message
  let cleanId = target.replace(/[`\s]/g, '').toUpperCase();
  if (/^\d+$/.test(cleanId)) {
    cleanId = `MSG-${String(parseInt(cleanId, 10)).padStart(3, '0')}`;
  }

  const res = confirmMessageRead(comm, cleanId, agentFormatted, note);
  if (res.alreadyRead) {
    console.log(`ℹ️ Message ${cleanId} was already marked as read by ${agentFormatted}.`);
    return;
  }
  if (!res.success) {
    console.error(`Error: ${res.reason || `Message ${cleanId} not found in ${COMM_PATH}`}`);
    process.exit(1);
  }

  fs.writeFileSync(COMM_PATH, res.updatedComm, 'utf8');
  cmdLogInternal(agentFormatted, `Confirmed read ${cleanId} ("${res.note}")`, 'AGENT_COMMUNICATION.md', 'Read receipt confirmed (Roger that)');
  console.log(`🫡 Confirmed read on ${cleanId} by ${agentFormatted}: "${res.note}"`);
}

function cmdUnread(agentName) {
  if (!agentName) {
    console.error('Error: unread requires <agentName> (e.g. node scripts/hub.js unread "@Copilot")');
    process.exit(1);
  }
  const agentFormatted = agentName.startsWith('@') ? agentName : `@${agentName}`;
  const unread = getUnreadMessages(agentFormatted);

  console.log('='.repeat(60));
  console.log(`📬 UNREAD MESSAGES FOR ${agentFormatted.toUpperCase()} (${unread.length})`);
  console.log('='.repeat(60));

  if (unread.length === 0) {
    console.log(`\n✨ All caught up! No unread messages for ${agentFormatted}.\n`);
  } else {
    console.log('');
    for (const msg of unread) {
      console.log(`• ${msg.id} · ${msg.subject}`);
      console.log(`  From: ${msg.from}  |  Date: ${msg.dateTime}  |  Type: [${msg.type}]`);
    }
    console.log('\n👉 To confirm read (Roger that):');
    console.log(`   node scripts/hub.js read <MSG-ID> "${agentFormatted}" ["custom note"]`);
    console.log(`   # Or mark all as read:`);
    console.log(`   node scripts/hub.js read all "${agentFormatted}"\n`);
  }
  console.log('='.repeat(60));
}

// ============================================================
// 📦 SESSION ARCHIVING & RESUMING FUNCTIONS
// ============================================================

function sanitizeName(name) {
  if (!name) return 'session';
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
}

function extractSessionSummary() {
  const userText = getCasualInboxText();
  if (!userText || userText === '(USER_INBOX.md is empty)') {
    return { focus: 'Collaboration Session', summary: 'General multi-agent workspace session' };
  }
  const lines = userText.split('\n').map(l => l.replace(/^[#\-*>\s]+/, '').trim()).filter(Boolean);
  const firstLine = lines[0] || 'Active Session';
  const focus = firstLine.slice(0, 40);
  const summary = userText.slice(0, 160).replace(/\s+/g, ' ');
  return { focus, summary };
}

function countTaskStats() {
  const tasks = readFileSafe(TASKS_PATH);
  const completed = (tasks.match(/- \*\*Status:\*\* `\[DONE\]`/g) || []).length;
  const inProgress = (tasks.match(/- \*\*Status:\*\* `\[IN PROGRESS\]`/g) || []).length;
  const ready = (tasks.match(/- \*\*Status:\*\* `\[READY\]`/g) || []).length;
  return { completed, inProgress, ready, total: completed + inProgress + ready };
}

function countMessageStats() {
  const comm = readFileSafe(COMM_PATH);
  const msgs = (comm.match(/### 💬 `MSG-\d+`/g) || []).length;
  return msgs;
}

function resetToFreshSession(newSessionTitle) {
  const timestamp = getTimestamp();
  const sessionName = newSessionTitle || 'New Collaboration Session';

  // 1. Fresh USER_INBOX.md
  const freshInbox = `# 📥 User Inbox

> **How this works:**
> Just type whatever you want done below in plain English (or any language) — no rules, no template to fill out, no rigid format. Talk casually just like you're chatting with an AI.
> 
> **To start agents:**
> Agents will NOT automatically pick up this file on normal prompts. Whenever you're ready for specific agents to work on what's written here, just go to their chat windows and type:
> \`/assemble\`

---

<!-- WRITE CASUALLY BELOW THIS LINE -->

`;

  // 2. Fresh TASKS.md
  const freshTasks = `# 📋 Multi-Agent Task Board & Roadmap

> **Concurrency & Collision Prevention Rule:**
> 1. **Claim Before Coding:** Before starting work, an agent must change the task status to \`[IN PROGRESS]\`, assign its name (\`@Antigravity\`, \`@Copilot\`, etc.), and list the files it will modify under \`Locked Files\`.
> 2. **File Locks:** Never edit files currently marked under \`Locked Files\` of another active task.
> 3. **Handoff:** If a task requires work from another agent (e.g. backend done -> frontend needed), mark \`[IN REVIEW]\` or post a handoff message in \`AGENT_COMMUNICATION.md\`.
> 4. **Completion:** When verified, mark \`[DONE]\`, clear \`Locked Files\`, and add a one-line entry in \`ACTIVITY_LOG.md\`.

---

## 🏃 Active Tasks (\`[IN PROGRESS]\`)

*(No active tasks currently claimed)*

---

## 🎯 Ready for Work (\`[READY]\`)

### \`TASK-001\`: Initial Session Planning & Decomposition
- **Status:** \`[READY]\`
- **Assigned Agent:** \`Unassigned\`
- **Description:** Read the new directive from \`USER_INBOX.md\` and break it down into actionable subtasks.
- **Target Files:** \`USER_INBOX.md\`, \`TASKS.md\`

---

## 🗄️ Backlog (\`[BACKLOG]\`)

*(Future or unprioritized items)*

---

## ✅ Completed Tasks (\`[DONE]\`)

*(Tasks will move here once completed and verified)*
`;

  // 3. Fresh AGENT_COMMUNICATION.md
  const freshComm = `# 💬 Inter-Agent Communication & Handoff Board

This file serves as the asynchronous communication hub for all AI agents working in this repository (e.g. \`@Antigravity\`, \`@Copilot\`, \`@Claude\`, \`@Cursor\`).

### 📌 How Agents Use This Board:
1. **Posting a Message:** Append a new message at the bottom under [Active Threads](#active-threads).
2. **Tagging:** Use \`@AgentName\` (e.g. \`@Copilot\`, \`@Antigravity\`, \`@All\`).
3. **Message Types:**
   - \`[HANDOFF]\`: Passing work to another agent with context, completed files, and next actions.
   - \`[REVIEW_REQUEST]\`: Requesting peer agent review or automated test verification.
   - \`[QUESTION]\`: Asking another agent or the user for architectural or implementation clarification.
   - \`[BLOCKER]\`: Declaring a blocker or dependency conflict.
   - \`[ANNOUNCEMENT]\`: General workspace updates.
4. **Resolution:** When an issue or handoff is completed, mark status as \`[RESOLVED]\`.

---

## 🧵 Active Threads

### 💬 \`MSG-001\` · New Collaboration Session Started
- **Date & Time:** ${timestamp}
- **From:** \`@System\`
- **To:** \`@All\`
- **Type:** \`[ANNOUNCEMENT]\`
- **Status:** \`[OPEN]\`
- **Subject:** Fresh Collaboration Session Initialized
- **Body:**
  > Welcome to the new collaboration session: "${sessionName}".
  > Please check \`USER_INBOX.md\` for active user directives and claim tasks in \`TASKS.md\`.
`;

  // 4. Fresh ACTIVITY_LOG.md
  const freshLog = `# 📜 Agent Activity & Audit Log

A chronological log of actions, completed tasks, commits, and handoffs executed by participating agents.

---

### Activity Feed

| Timestamp (UTC+8) | Agent | Action / Event | Target Files / Scope | Notes |
| :--- | :--- | :--- | :--- | :--- |
| \`${timestamp}\` | \`@System\` | Session Initialized | Workspace root | Started fresh collaboration session: ${sessionName} |

---
`;

  // 5. Fresh or updated PROJECT_STATE.md
  let state = readFileSafe(STATE_PATH);
  if (!state) {
    state = `# 🧭 Project State & Architecture Overview\n\n- **Current Session:** ${sessionName}\n- **Updated:** ${timestamp}\n`;
  }

  fs.writeFileSync(INBOX_PATH, freshInbox, 'utf8');
  fs.writeFileSync(TASKS_PATH, freshTasks, 'utf8');
  fs.writeFileSync(COMM_PATH, freshComm, 'utf8');
  fs.writeFileSync(LOG_PATH, freshLog, 'utf8');
  fs.writeFileSync(STATE_PATH, state, 'utf8');
}

function cmdArchiveSave(sessionNameArg, flags = {}) {
  const { focus, summary } = extractSessionSummary();
  const rawName = sessionNameArg || focus || 'session';
  const cleanName = sanitizeName(rawName);
  const timeId = getFileSafeTimestamp();
  const folderName = `${timeId}_${cleanName}`;
  const targetDir = path.join(ARCHIVES_DIR, folderName);

  if (!fs.existsSync(ARCHIVES_DIR)) {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy collaboration files into archive folder
  const copiedFiles = [];
  COLLAB_FILES.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, file));
      copiedFiles.push(file);
    }
  });

  // Also copy DECISIONS.md snapshot for reference
  if (fs.existsSync(DECISIONS_PATH)) {
    fs.copyFileSync(DECISIONS_PATH, path.join(targetDir, 'DECISIONS.snapshot.md'));
  }

  const taskStats = countTaskStats();
  const messageCount = countMessageStats();

  const meta = {
    id: `session-${timeId}`,
    name: cleanName,
    title: focus,
    folder: folderName,
    archivedAt: getTimestamp(),
    archivedBy: flags.agent || '@User',
    summary: summary,
    stats: {
      tasksCompleted: taskStats.completed,
      tasksInProgress: taskStats.inProgress,
      tasksReady: taskStats.ready,
      messages: messageCount
    },
    files: copiedFiles
  };

  fs.writeFileSync(path.join(targetDir, 'session.json'), JSON.stringify(meta, null, 2), 'utf8');

  // Also create a quick README inside the archive folder for human browsing
  const archiveReadme = `# 📦 Archived Session: ${focus}

- **Folder:** \`${folderName}\`
- **Archived At:** ${meta.archivedAt}
- **Archived By:** ${meta.archivedBy}
- **Summary:** ${summary}
- **Statistics:** ${taskStats.completed} completed tasks, ${taskStats.inProgress} in-progress, ${messageCount} messages.

### Included Files:
${copiedFiles.map(f => `- [\`${f}\`](./${f})`).join('\n')}

---
*To resume this session in the active workspace, run:*
\`\`\`bash
node scripts/hub.js archive resume "${folderName}"
# or
npm run archive:resume -- "${folderName}"
\`\`\`
`;
  fs.writeFileSync(path.join(targetDir, 'README.md'), archiveReadme, 'utf8');

  // Record in current ACTIVITY_LOG.md before resetting
  cmdLogInternal(meta.archivedBy, `Archived session to ${folderName}`, copiedFiles.join(', '), summary);

  console.log(`\n📦 Session successfully archived!`);
  console.log(`   Location: archives/${folderName}`);
  console.log(`   Title:    ${focus}`);
  console.log(`   Stats:    ${taskStats.completed} completed tasks, ${messageCount} messages`);

  if (flags.new) {
    resetToFreshSession(typeof flags.new === 'string' ? flags.new : undefined);
    console.log(`\n✨ Workspace reset: Fresh collaboration session initialized!`);
    console.log(`   Ready for your next directives in USER_INBOX.md`);
  } else {
    console.log(`\n💡 Tip: Run 'node scripts/hub.js archive new' or pass '--new' if you want to start a clean session now.`);
  }

  return folderName;
}

function cmdArchiveList() {
  console.log('='.repeat(60));
  console.log('🗃️ ARCHIVED COLLABORATION SESSIONS (archives/)');
  console.log('='.repeat(60));

  if (!fs.existsSync(ARCHIVES_DIR)) {
    console.log('\n  (No archives directory found. No sessions saved yet.)');
    console.log('='.repeat(60));
    return;
  }

  const entries = fs.readdirSync(ARCHIVES_DIR)
    .filter(name => {
      const fullPath = path.join(ARCHIVES_DIR, name);
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('.') && !name.startsWith('_stash_');
    })
    .sort()
    .reverse();

  if (entries.length === 0) {
    console.log('\n  (No saved sessions found in archives/)');
    console.log('='.repeat(60));
    return;
  }

  console.log(`\nFound ${entries.length} saved session(s):\n`);

  entries.forEach((folderName, index) => {
    const sessionJsonPath = path.join(ARCHIVES_DIR, folderName, 'session.json');
    let title = folderName;
    let archivedAt = 'Unknown date';
    let summary = 'No summary';
    let stats = '';

    if (fs.existsSync(sessionJsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        title = meta.title || meta.name || folderName;
        archivedAt = meta.archivedAt || archivedAt;
        summary = meta.summary || summary;
        if (meta.stats) {
          stats = `(${meta.stats.tasksCompleted} done, ${meta.stats.messages} msgs)`;
        }
      } catch (e) {
        // Fallback
      }
    }

    console.log(`  [${index + 1}] 📁 ${folderName}`);
    console.log(`      Title:   ${title}`);
    console.log(`      Date:    ${archivedAt} ${stats}`);
    console.log(`      Summary: ${summary.slice(0, 80)}${summary.length > 80 ? '...' : ''}\n`);
  });

  console.log('='.repeat(60));
  console.log(`To resume any session, run:`);
  console.log(`  node scripts/hub.js archive resume <index or folderName>`);
  console.log(`Example: node scripts/hub.js archive resume 1`);
  console.log('='.repeat(60));
}

function cmdArchiveResume(targetArg, flags = {}) {
  if (!fs.existsSync(ARCHIVES_DIR)) {
    console.error('Error: archives/ directory does not exist. Nothing to resume.');
    process.exit(1);
  }

  const entries = fs.readdirSync(ARCHIVES_DIR)
    .filter(name => {
      const fullPath = path.join(ARCHIVES_DIR, name);
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('.') && !name.startsWith('_stash_');
    })
    .sort()
    .reverse();

  if (entries.length === 0) {
    console.error('Error: No saved sessions found in archives/.');
    process.exit(1);
  }

  if (!targetArg) {
    console.log('Please specify which session to resume:\n');
    cmdArchiveList();
    return;
  }

  let selectedFolder = null;

  // 1. Check if index number (1-based)
  const numericIndex = parseInt(targetArg, 10);
  if (!isNaN(numericIndex) && numericIndex >= 1 && numericIndex <= entries.length) {
    selectedFolder = entries[numericIndex - 1];
  } else {
    // 2. Check exact folder name match
    if (entries.includes(targetArg)) {
      selectedFolder = targetArg;
    } else {
      // 3. Partial match (case-insensitive)
      const query = targetArg.toLowerCase();
      const match = entries.find(e => e.toLowerCase().includes(query));
      if (match) {
        selectedFolder = match;
      }
    }
  }

  if (!selectedFolder) {
    console.error(`Error: Could not find archived session matching '${targetArg}'.`);
    console.log('Available sessions:');
    entries.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
    process.exit(1);
  }

  const sourceDir = path.join(ARCHIVES_DIR, selectedFolder);

  // Safety Backup: Auto-stash current active state before overwriting
  const stashFolder = `_stash_${getFileSafeTimestamp()}`;
  const stashDir = path.join(ARCHIVES_DIR, stashFolder);
  fs.mkdirSync(stashDir, { recursive: true });
  COLLAB_FILES.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(stashDir, file));
    }
  });

  // Restore archived files to workspace root
  let restoredCount = 0;
  COLLAB_FILES.forEach(file => {
    const src = path.join(sourceDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(ROOT_DIR, file));
      restoredCount++;
    }
  });

  // Read restored session info
  let sessionTitle = selectedFolder;
  const metaPath = path.join(sourceDir, 'session.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      sessionTitle = meta.title || meta.name || sessionTitle;
    } catch (e) {}
  }

  // Log resumption to ACTIVITY_LOG.md
  cmdLogInternal('@System', `Resumed session from archives/${selectedFolder}`, COLLAB_FILES.join(', '), `Active files safely stashed in archives/${stashFolder}`);

  // Post announcement in AGENT_COMMUNICATION.md
  let comm = readFileSafe(COMM_PATH);
  const countMatches = comm.match(/### 💬 `MSG-(\d+)`/g);
  let nextNum = 1;
  if (countMatches && countMatches.length > 0) {
    const last = countMatches[countMatches.length - 1];
    const num = parseInt(last.replace(/\D/g, ''), 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  const msgId = `MSG-${String(nextNum).padStart(3, '0')}`;
  const resumeMsg = `
### 💬 \`${msgId}\` · Session Resumed from Archive
- **Date & Time:** ${getTimestamp()}
- **From:** \`@System\`
- **To:** \`@All\`
- **Type:** \`[ANNOUNCEMENT]\`
- **Status:** \`[OPEN]\`
- **Read By:** (none)
- **Subject:** Session "${sessionTitle}" Resumed
- **Body:**
  > Archived session \`${selectedFolder}\` has been restored to the workspace.
  > Previous active files were safely backed up to \`archives/${stashFolder}\`.
  > Agents should re-read \`USER_INBOX.md\` and \`TASKS.md\` to continue work from this restored state.
`;
  comm = comm.trimEnd() + '\n\n' + resumeMsg.trim() + '\n';
  fs.writeFileSync(COMM_PATH, comm, 'utf8');

  console.log(`\n🔄 Session successfully restored!`);
  console.log(`   Source: archives/${selectedFolder}`);
  console.log(`   Title:  ${sessionTitle}`);
  console.log(`   Restored ${restoredCount} collaboration files.`);
  console.log(`   🛡️ Safety backup of previous state saved to archives/${stashFolder}`);
  console.log(`\nActive workspace is now running the restored session. Run 'npm run status' to view.`);
}

function handleArchive(args, flags) {
  const subCommand = args[1] ? args[1].toLowerCase() : 'list';
  const target = args[2];

  switch (subCommand) {
    case 'save':
      cmdArchiveSave(target, flags);
      break;
    case 'list':
      cmdArchiveList();
      break;
    case 'resume':
    case 'restore':
      cmdArchiveResume(target, flags);
      break;
    case 'new':
      flags.new = target || true;
      cmdArchiveSave(undefined, flags);
      break;
    default:
      console.log(`Unknown archive subcommand: '${subCommand}'`);
      console.log(`Valid archive subcommands: save, list, resume, new`);
      break;
  }
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
    case 'assemble':
    case 'collab':
      cmdAssemble(positional[1]);
      break;
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
    case 'read':
    case 'ack':
    case 'roger':
    case 'confirm':
      cmdRead(positional[1], positional[2], positional.slice(3).join(' ') || flags.note);
      break;
    case 'unread':
      cmdUnread(positional[1]);
      break;
    case 'log':
      cmdLog(flags);
      break;
    case 'archive':
    case 'session':
      handleArchive(positional, flags);
      break;
    case 'save':
      cmdArchiveSave(positional[1], flags);
      break;
    case 'resume':
    case 'restore':
      cmdArchiveResume(positional[1], flags);
      break;
    case 'sessions':
      cmdArchiveList();
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main();
