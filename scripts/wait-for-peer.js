#!/usr/bin/env node

/**
 * Wait for a peer agent to read a message or post a new message in AGENT_COMMUNICATION.md.
 * Supports both the compact single-line header format and legacy multi-line format.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const COMM_PATH = path.join(ROOT_DIR, 'AGENT_COMMUNICATION.md');

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

const { flags, positional } = parseArgs(process.argv.slice(2));

let targetAgent = flags.agent || positional[0] || 'Copilot';
if (!targetAgent.startsWith('@')) targetAgent = '@' + targetAgent;
const targetLower = targetAgent.toLowerCase();

let watchMsg = (flags['watch-msg'] || flags.msg || positional[1] || 'MSG-001').toUpperCase();
if (!watchMsg.startsWith('MSG-')) watchMsg = 'MSG-' + watchMsg;
const watchNum = parseInt(watchMsg.replace(/\D/g, ''), 10) || 0;

const timeoutSec = parseInt(flags.timeout || positional[2] || '600', 10);

console.log(`[Watcher] Monitoring AGENT_COMMUNICATION.md for ${targetAgent} (watch: ${watchMsg}, timeout: ${timeoutSec}s)...`);

const startTime = Date.now();

function parseMessages(content) {
  const blocks = content.split(/(?=^### (?:💬 )?`MSG-\d+`)/m).filter(b => /^### (?:💬 )?`MSG-\d+`/.test(b.trim()));
  const messages = [];

  for (const block of blocks) {
    const firstLine = block.split('\n')[0].trim();
    const compactMatch = firstLine.match(/^### `(MSG-(\d+))`\s+\[([^\]]+)\]\s+(@\S+)\s*->\s*(@\S+)\s+\[([^\]]+)\]\s*·\s*(.*?)(?:\s+✓:([^\n]+))?$/);
    if (compactMatch) {
      const readBy = compactMatch[8]
        ? compactMatch[8].split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];
      messages.push({
        id: compactMatch[1],
        num: parseInt(compactMatch[2], 10),
        from: compactMatch[4],
        to: compactMatch[5],
        subject: compactMatch[7].trim(),
        readBy,
        raw: block.trim(),
      });
      continue;
    }

    const legacyId = firstLine.match(/^### 💬 `(MSG-(\d+))`\s*·\s*(.+)$/);
    if (legacyId) {
      const getField = (name) => {
        const m = block.match(new RegExp(`- \\*\\*${name}:\\*\\*\\s*(.+)`));
        return m ? m[1].trim() : '';
      };
      const from = getField('From').replace(/`/g, '');
      const readByRaw = getField('Read By');
      const readBy = [];
      const rRegex = /`(@[^`]+)`/g;
      let rm;
      while ((rm = rRegex.exec(readByRaw)) !== null) {
        readBy.push(rm[1].toLowerCase());
      }
      messages.push({
        id: legacyId[1],
        num: parseInt(legacyId[2], 10),
        from,
        subject: legacyId[3].trim(),
        readBy,
        raw: block.trim(),
      });
    }
  }
  return messages;
}

function check() {
  if (!fs.existsSync(COMM_PATH)) return null;
  const content = fs.readFileSync(COMM_PATH, 'utf8');
  const messages = parseMessages(content);

  const watched = messages.find(m => m.id === watchMsg);
  if (watched && watched.readBy.includes(targetLower)) {
    return {
      type: 'READ_RECEIPT',
      detail: `Agent ${targetAgent} marked ${watchMsg} as read (✓).`,
    };
  }

  for (const m of messages) {
    if (m.num > watchNum && m.from.toLowerCase() === targetLower) {
      return {
        type: 'NEW_MESSAGE',
        detail: `Agent ${targetAgent} posted ${m.id} (${m.subject}):\n${m.raw}`,
      };
    }
  }

  return null;
}

const immediate = check();
if (immediate) {
  console.log(`\n🎉 [Watcher Alert] ${immediate.type}: ${immediate.detail}`);
  process.exit(0);
}

const interval = setInterval(() => {
  const elapsed = (Date.now() - startTime) / 1000;
  const result = check();
  if (result) {
    clearInterval(interval);
    console.log(`\n🎉 [Watcher Alert] ${result.type}: ${result.detail}`);
    process.exit(0);
  }
  if (elapsed >= timeoutSec) {
    clearInterval(interval);
    console.log(`\n⏰ [Watcher] Timeout reached (${timeoutSec}s) without activity from ${targetAgent}.`);
    process.exit(1);
  }
}, 2500);
