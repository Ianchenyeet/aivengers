#!/usr/bin/env node

/**
 * Multi-Agent Collaboration Hub CLI ('vibe coding tools')
 * Fast, zero-dependency Node.js CLI utility for multi-agent coordination:
 * - Passive + active online/running/credit-exhaustion status detection (no manual check-in required)
 * - Compact Markdown formats for AGENT_COMMUNICATION.md, TASKS.md, and ACTIVITY_LOG.md
 * - Team assembly waiting, shared plan review/approval tracking, and Main/Substitute-Main failover
 * - Portable drop-in folder design (zero external cross-dependencies)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
let roleDefs = null;
try {
  roleDefs = require(path.join(ROOT_DIR, 'src', 'roles', 'roleDefinitions.js'));
} catch {}
const HOST_PROJECT_DIR = path.resolve(ROOT_DIR, '..');
const ARCHIVES_DIR = path.join(ROOT_DIR, 'archives');
const INBOX_PATH = path.join(ROOT_DIR, 'USER_INBOX.md');
const TASKS_PATH = path.join(ROOT_DIR, 'TASKS.md');
const COMM_PATH = path.join(ROOT_DIR, 'AGENT_COMMUNICATION.md');
const LOG_PATH = path.join(ROOT_DIR, 'ACTIVITY_LOG.md');
const DECISIONS_PATH = path.join(ROOT_DIR, 'DECISIONS.md');
const STATE_PATH = path.join(ROOT_DIR, 'PROJECT_STATE.md');
const PRESENCE_PATH = path.join(ROOT_DIR, 'AGENT_PRESENCE.json');
const FEED_PATH = path.join(ROOT_DIR, 'VIBE_FEED.json');

const DEFAULT_ONLINE_TIMEOUT_MIN = 15;
const KNOWN_AGENTS = ['@Antigravity', '@Copilot', '@Claude', '@Cursor', '@Codex'];
const OTHERS_OPTION_LABEL = 'Others (reply with custom answer)';

const COLLAB_FILES = [
  'USER_INBOX.md',
  'TASKS.md',
  'AGENT_COMMUNICATION.md',
  'ACTIVITY_LOG.md',
  'PROJECT_STATE.md',
  'AGENT_PRESENCE.json',
  'VIBE_FEED.json'
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

function getShortTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
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

function writeFileRetrySync(filePath, content, encoding = 'utf8') {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(filePath, content, encoding);
      return;
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') && attempt < 4) {
        const until = Date.now() + 35 * (attempt + 1);
        while (Date.now() < until) {}
        continue;
      }
      throw err;
    }
  }
}

function readFileTailFast(filePath, maxBytes = 65536) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const st = fs.statSync(filePath);
    const readLen = Math.min(maxBytes, st.size);
    if (readLen === 0) return { text: '', mtimeMs: st.mtimeMs, size: 0 };
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, st.size - readLen);
    fs.closeSync(fd);
    return { text: buf.toString('utf8'), mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
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
🤝 Multi-Agent Hub CLI ('vibe coding tools')

Usage:
  node scripts/hub.js [command] [subcommand] [options]

Core Collaboration Commands:
  assemble [agent]                     Assemble agent, read inbox, check team & passive status
  status                               Compact overview of inbox, live team status, plan, tasks & msgs
  peers [--json] [--check <agent>]     Fast passive+active online/running/credit status of all agents
  health                               Check team health, credit exhaustion, orphaned tasks & Main failover
  wait-team [--timeout 180]            Wait for all participating agents in USER_INBOX.md to come online
  wait --for <agent> [--timeout 60]    Wait for peer agent activity, message, or read receipt
  plan [status|draft|review|approve]   Manage shared team plan & user approval state
  dispatch --main <A> --agents <list> --prompt <text>
                                       Write USER_INBOX.md & dispatch prompt to VIBE_FEED.json
  report --agent <A> --type <T> --title <S> --summary <B>
                                       Post a milestone/checkpoint/final_summary report to Vibe tab
  ask --agent <A> --question <Q>       Post a question to Vibe tab and wait for user reply
  poll --agent <A> --question <Q> --options "A|B"
                                       Post an interactive poll to Vibe tab and wait for vote/reply
  reply --id <ITEM-ID> [--options "A"] [--answer "text"]
                                       Submit user reply to a pending question or poll
  feed [--json]                        Show reports, questions, and polls from VIBE_FEED.json
  inbox                                Print active user instructions from USER_INBOX.md
  tasks                                List tasks from TASKS.md
  claim <taskId> <agent> [files...]    Claim a task in TASKS.md and lock target files
  complete <taskId> <agent>            Mark task as [DONE] in TASKS.md and log to ACTIVITY_LOG.md
  msg --from <A> --to <B> --subject <S> --body <M> [--type <TYPE>]
                                       Post a compact message to AGENT_COMMUNICATION.md
  read <msgId|all> <agent> [note]      Confirm read on message(s) (compact ✓:@Agent receipt)
  unread <agent>                       List unread messages addressed to an agent
  log --agent <A> --action <act> [--files <files>] [--notes <notes>]
                                       Append a compact entry to ACTIVITY_LOG.md

Explicit State Overrides (Optional — passive telemetry runs automatically):
  ping <agent> [activity]              Send explicit heartbeat
  busy <agent> [task] [activity]       Mark agent as RUNNING
  idle <agent> [activity]              Mark agent as IDLE / standing by
  offline <agent> [--reason <reason>]  Mark agent as OFFLINE (or credit_exhausted)

Session Archiving & Resuming:
  archive save [name] [--new]          Archive current collaboration files into archives/<folder>
  archive list                         List all saved collaboration sessions in archives/
  archive resume <name|index>          Restore an archived session (auto-stashes current state)
  archive new [name]                   Archive current session and reset to clean compact templates
`);
}

// ============================================================
// 🔍 PASSIVE + ACTIVE AGENT TELEMETRY & LIVENESS ENGINE
// ============================================================

function getBaseProviderTag(name) {
  if (!name || typeof name !== 'string') return '@Agent';
  const cleaned = name.trim().replace(/^`+|`+$/g, '');
  if (!cleaned) return '@Agent';
  const colonIdx = cleaned.indexOf(':');
  const head = (colonIdx !== -1 ? cleaned.slice(0, colonIdx) : cleaned).replace(/^@/, '').toLowerCase();
  if (head === 'antigravity' || head === 'agy' || head === 'gemini' || head.startsWith('antigravity')) return '@Antigravity';
  if (head === 'copilot' || head === 'github-copilot' || head.startsWith('copilot')) return '@Copilot';
  if (head === 'claude' || head.startsWith('claude-code') || head === 'claude_code') return '@Claude';
  if (head === 'cursor' || head.startsWith('cursor')) return '@Cursor';
  if (head === 'codex' || head.startsWith('codex')) return '@Codex';
  if (colonIdx !== -1) return cleaned.slice(0, colonIdx).startsWith('@') ? cleaned.slice(0, colonIdx) : `@${cleaned.slice(0, colonIdx)}`;
  const raw = cleaned.replace(/^@/, '');
  return `@${raw}`;
}

function normalizeAgentName(name) {
  if (!name || typeof name !== 'string') return '@Agent';
  const trimmed = name.trim().replace(/^`+|`+$/g, '');
  if (!trimmed) return '@Agent';

  // Preserve model-qualified multi-instance participant tags like "@Copilot:gpt-4.1" or "@Antigravity:gemini-4-argon-high#2"
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    const providerPart = getBaseProviderTag(trimmed.slice(0, colonIdx));
    const suffix = trimmed.slice(colonIdx + 1).trim();
    return suffix ? `${providerPart}:${suffix}` : providerPart;
  }

  const lower = trimmed.toLowerCase().replace(/^@/, '');
  if (lower === 'antigravity' || lower === 'agy' || lower === 'gemini' || /^google[.\s-]*antigravity$/.test(lower)) return '@Antigravity';
  if (lower === 'copilot' || lower === 'github-copilot' || lower === 'github copilot') return '@Copilot';
  if (lower === 'claude' || lower === 'claude-code' || lower === 'claude code') return '@Claude';
  if (lower === 'cursor') return '@Cursor';
  if (lower === 'codex' || lower === 'openai-codex') return '@Codex';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function resolveParticipantIdentity(rawInput, presenceOverride = null) {
  const presence = presenceOverride || loadPresence();
  const slotMeta = presence && presence.slotMeta && typeof presence.slotMeta === 'object' ? presence.slotMeta : {};
  const rawClean = String(rawInput || '').trim().replace(/^`+|`+$/g, '');
  const rawLower = rawClean.toLowerCase();
  const bareLower = rawLower.replace(/^@/, '');

  const buildFromMeta = (tagKey, m) => ({
    tag: tagKey,
    providerTag: m.providerTag || getBaseProviderTag(tagKey),
    modelId: m.modelId || 'auto',
    modelLabel: m.modelLabel || '',
    displayName: m.displayName || m.modelLabel || m.providerTag || tagKey,
    roleIds: Array.isArray(m.roleIds) ? m.roleIds : [],
    roleSummary: m.roleSummary || '',
    mixedColor: m.mixedColor || '#64748B',
    writePermission: m.writePermission || 'code-write',
    hubEscalation: m.hubEscalation || 'direct-user-access',
    slotIndex: typeof m.slotIndex === 'number' ? m.slotIndex : 0,
  });

  if (rawClean) {
    // 1. Exact participant tag match (case-insensitive)
    for (const [k, m] of Object.entries(slotMeta)) {
      if (k.toLowerCase() === rawLower || k.toLowerCase() === `@${bareLower}`) {
        return buildFromMeta(k, m);
      }
    }
    // 2. Match by displayName / modelLabel / modelId (e.g. "GPT-4.1", "Claude Sonnet 4", "gemini-4-hydrogen-medium")
    for (const [k, m] of Object.entries(slotMeta)) {
      const candidates = [m.displayName, m.modelLabel, m.modelId]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      if (candidates.includes(bareLower) || candidates.includes(rawLower)) {
        return buildFromMeta(k, m);
      }
    }
    // 3. Single slot using that provider
    const baseTag = getBaseProviderTag(rawClean);
    const sameProviderEntries = Object.entries(slotMeta).filter(
      ([, m]) => (m.providerTag || getBaseProviderTag(m.tag)).toLowerCase() === baseTag.toLowerCase()
    );
    if (sameProviderEntries.length === 1) {
      return buildFromMeta(sameProviderEntries[0][0], sameProviderEntries[0][1]);
    }
  }

  const tag = normalizeAgentName(rawClean || presence.mainAgent || '@Agent');
  const providerTag = getBaseProviderTag(tag);
  const metaMatch = slotMeta[tag];
  if (metaMatch) return buildFromMeta(tag, metaMatch);

  const modelFromMap =
    (presence.agentModels && (presence.agentModels[tag] || presence.agentModels[providerTag])) || '';
  return {
    tag,
    providerTag,
    modelId: 'auto',
    modelLabel: modelFromMap,
    displayName: modelFromMap || (tag.startsWith('@') ? tag.slice(1) : tag),
    roleIds: [],
    roleSummary: '',
    mixedColor: '#64748B',
    writePermission: 'code-write',
    hubEscalation: 'direct-user-access',
    slotIndex: 0,
  };
}

const CREDIT_ERROR_REGEX = /\b(quota|credit|credits|insufficient_quota|rate_limit|rate limit|429|402|payment required|billing|exhausted|exceeded.*limit|token limit reached|out of credits)\b/i;

/**
 * Passively probes Antigravity runtime via ~/.gemini/antigravity/brain/* transcript logs
 * without requiring the agent to manually check in.
 */
function probeAntigravityPassive() {
  const home = os.homedir();
  const brainDir = path.join(home, '.gemini', 'antigravity', 'brain');
  if (!fs.existsSync(brainDir)) return null;

  try {
    const dirs = fs.readdirSync(brainDir);
    let latestFile = null;
    let latestMtime = 0;

    for (const d of dirs) {
      const p = path.join(brainDir, d, '.system_generated', 'logs', 'transcript.jsonl');
      try {
        if (fs.existsSync(p)) {
          const st = fs.statSync(p);
          if (st.mtimeMs > latestMtime) {
            latestMtime = st.mtimeMs;
            latestFile = p;
          }
        }
      } catch {}
    }

    if (!latestFile) return null;
    const tail = readFileTailFast(latestFile, 32768);
    if (!tail) return null;

    const lines = tail.text.trim().split('\n').filter(Boolean);
    let lastObj = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        lastObj = JSON.parse(lines[i]);
        break;
      } catch {}
    }

    const ageSec = Math.max(0, Math.floor((Date.now() - tail.mtimeMs) / 1000));
    const tailSample = lines.slice(-3).join(' ');

    if (lastObj && lastObj.status === 'ERROR' && CREDIT_ERROR_REGEX.test(tailSample)) {
      return {
        detected: true,
        status: 'CREDIT_EXHAUSTED',
        isOnline: false,
        lastActiveMs: tail.mtimeMs,
        detail: 'Passive telemetry: Quota/credit error in Antigravity transcript'
      };
    }

    // If modified within last 45s or step is actively executing
    if (ageSec <= 45 || (lastObj && (lastObj.status === 'RUNNING' || lastObj.type === 'USER_INPUT'))) {
      return {
        detected: true,
        status: 'RUNNING',
        isOnline: true,
        lastActiveMs: tail.mtimeMs,
        detail: `Active turn (${lastObj ? lastObj.type : 'executing'})`
      };
    }

    // If active within threshold window
    if (ageSec <= DEFAULT_ONLINE_TIMEOUT_MIN * 60) {
      return {
        detected: true,
        status: 'IDLE',
        isOnline: true,
        lastActiveMs: tail.mtimeMs,
        detail: 'Session open & ready (turn completed)'
      };
    }

    return {
      detected: true,
      status: 'OFFLINE',
      isOnline: false,
      lastActiveMs: tail.mtimeMs,
      detail: `Last transcript activity ${formatRelativeTime(new Date(tail.mtimeMs).toISOString())}`
    };
  } catch {
    return null;
  }
}

/**
 * Passively probes GitHub Copilot runtime via %APPDATA%/Code/logs/* /agenthost.log
 * without requiring Copilot to manually check in.
 */
function probeCopilotPassive() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const logsRoot = path.join(appData, 'Code', 'logs');
  if (!fs.existsSync(logsRoot)) return null;

  try {
    const dirs = fs.readdirSync(logsRoot);
    let latestLog = null;
    let latestMtime = 0;

    for (const d of dirs) {
      const p = path.join(logsRoot, d, 'agenthost.log');
      try {
        if (fs.existsSync(p)) {
          const st = fs.statSync(p);
          if (st.mtimeMs > latestMtime) {
            latestMtime = st.mtimeMs;
            latestLog = p;
          }
        }
      } catch {}
    }

    if (!latestLog) return null;
    const tail = readFileTailFast(latestLog, 65536);
    if (!tail) return null;

    const rawLines = tail.text.split('\n');
    const events = [];

    for (const line of rawLines) {
      if (!line.includes('[Copilot') && !line.includes('[AgentHostTurnTiming]')) continue;
      if (
        line.includes('hidden customization policy') ||
        line.includes('Managed settings resolved') ||
        line.includes('MCP server') ||
        line.includes('Syncing permission mode: source=config-change') ||
        line.includes('Discarded pre-warmed session')
      ) {
        continue;
      }
      events.push(line.trim());
    }

    if (events.length === 0) return null;
    const lastEvent = events[events.length - 1];
    const tsMatch = lastEvent.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
    const eventTimeMs = tsMatch ? new Date(tsMatch[1].replace(' ', 'T')).getTime() : tail.mtimeMs;
    const ageSec = Math.max(0, Math.floor((Date.now() - eventTimeMs) / 1000));

    // Check recent errors for credit/quota exhaustion
    const recentSlice = events.slice(-6).join('\n');
    if (recentSlice.includes('[error]') && CREDIT_ERROR_REGEX.test(recentSlice)) {
      return {
        detected: true,
        status: 'CREDIT_EXHAUSTED',
        isOnline: false,
        lastActiveMs: eventTimeMs,
        detail: 'Passive telemetry: Quota/rate-limit error in Copilot agenthost.log'
      };
    }

    if (lastEvent.includes('Requesting confirmation for tool call')) {
      return {
        detected: true,
        status: 'WAITING',
        isOnline: true,
        lastActiveMs: eventTimeMs,
        detail: 'Waiting for tool confirmation in VS Code'
      };
    }

    const toolStartMatch = lastEvent.match(/Tool started:\s*([^\s]+)/);
    if (
      toolStartMatch ||
      lastEvent.includes('session.send() returned') ||
      lastEvent.includes('Full message received: 0 chars') ||
      (ageSec <= 30 && !lastEvent.includes('Session idle') && !lastEvent.includes('SDK session disconnect'))
    ) {
      const toolName = toolStartMatch ? toolStartMatch[1] : 'turn';
      return {
        detected: true,
        status: 'RUNNING',
        isOnline: true,
        lastActiveMs: eventTimeMs,
        detail: `Executing in Copilot (${toolName})`
      };
    }

    if (lastEvent.includes('Session idle') || lastEvent.includes('Full message received:')) {
      const isRecent = ageSec <= DEFAULT_ONLINE_TIMEOUT_MIN * 60;
      return {
        detected: true,
        status: isRecent ? 'IDLE' : 'OFFLINE',
        isOnline: isRecent,
        lastActiveMs: eventTimeMs,
        detail: isRecent ? 'Copilot session idle & ready' : `Copilot idle since ${formatRelativeTime(new Date(eventTimeMs).toISOString())}`
      };
    }

    if (lastEvent.includes('SDK session disconnect')) {
      return {
        detected: true,
        status: 'OFFLINE',
        isOnline: false,
        lastActiveMs: eventTimeMs,
        detail: 'Copilot SDK session disconnected'
      };
    }

    return {
      detected: true,
      status: ageSec <= DEFAULT_ONLINE_TIMEOUT_MIN * 60 ? 'IDLE' : 'OFFLINE',
      isOnline: ageSec <= DEFAULT_ONLINE_TIMEOUT_MIN * 60,
      lastActiveMs: eventTimeMs,
      detail: 'Copilot session detected'
    };
  } catch {
    return null;
  }
}

/**
 * Passively probes Claude Code via ~/.claude/projects transcripts if present.
 */
function probeClaudePassive() {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(claudeDir)) return null;
  try {
    let latestFile = null;
    let latestMtime = 0;
    for (const sub of fs.readdirSync(claudeDir)) {
      const subPath = path.join(claudeDir, sub);
      if (!fs.statSync(subPath).isDirectory()) continue;
      for (const f of fs.readdirSync(subPath)) {
        if (!f.endsWith('.jsonl')) continue;
        const fp = path.join(subPath, f);
        const st = fs.statSync(fp);
        if (st.mtimeMs > latestMtime) {
          latestMtime = st.mtimeMs;
          latestFile = fp;
        }
      }
    }
    if (!latestFile) return null;
    const tail = readFileTailFast(latestFile, 16384);
    if (!tail) return null;
    const ageSec = Math.max(0, Math.floor((Date.now() - tail.mtimeMs) / 1000));
    if (CREDIT_ERROR_REGEX.test(tail.text.slice(-2000))) {
      return { detected: true, status: 'CREDIT_EXHAUSTED', isOnline: false, lastActiveMs: tail.mtimeMs, detail: 'Credit/quota limit detected in Claude log' };
    }
    if (ageSec <= 40) {
      return { detected: true, status: 'RUNNING', isOnline: true, lastActiveMs: tail.mtimeMs, detail: 'Active Claude turn' };
    }
    if (ageSec <= DEFAULT_ONLINE_TIMEOUT_MIN * 60) {
      return { detected: true, status: 'IDLE', isOnline: true, lastActiveMs: tail.mtimeMs, detail: 'Claude session idle' };
    }
    return { detected: true, status: 'OFFLINE', isOnline: false, lastActiveMs: tail.mtimeMs, detail: 'Claude session inactive' };
  } catch {
    return null;
  }
}

/**
 * Passively probes all supported agents on the host machine in <5ms.
 */
function probeAllPassiveTelemetry() {
  const results = {};
  const agy = probeAntigravityPassive();
  if (agy) results['@Antigravity'] = agy;
  const cop = probeCopilotPassive();
  if (cop) results['@Copilot'] = cop;
  const cla = probeClaudePassive();
  if (cla) results['@Claude'] = cla;
  return results;
}

/**
 * Extracts participating agents and Main role assignment from USER_INBOX.md and AGENT_PRESENCE.json.
 */
function parseInboxParticipantsAndRoles() {
  const text = getCasualInboxText();
  const cleanText = text && text !== '(USER_INBOX.md is empty)' ? text : '';
  const lower = cleanText.toLowerCase();
  const participants = new Set();
  const agentModels = {};

  let assignedMain = null;
  let hasExplicitMain = false;
  let hasExplicitParticipants = false;

  // 1. Check structured header lines written by VS Code Extension / hub.js dispatch
  const slotMainMatch = cleanText.match(/(?:^|\n)\s*\*{0,2}Main\s+Agent(?:\s*\(Slot\s*1\))?\s*:?\*{0,2}\s*:?\s*(@?[A-Za-z0-9._:#-]+)/i);
  if (slotMainMatch) {
    assignedMain = normalizeAgentName(slotMainMatch[1]);
    participants.add(assignedMain);
    hasExplicitMain = true;
  }

  const listMatch = cleanText.match(/(?:^|\n)\s*\*{0,2}Participating\s+Agents\s*:?\*{0,2}\s*:?\s*([^\n]+)/i);
  if (listMatch) {
    hasExplicitParticipants = true;
    const rawLine = listMatch[1];
    const atMentions = rawLine.match(/@[A-Za-z0-9._:#-]+/g);
    if (atMentions && atMentions.length > 0) {
      for (const m of atMentions) {
        participants.add(normalizeAgentName(m));
      }
      const modelSegRegex = /(@[A-Za-z0-9._:#-]+)\s*\([^)]*?Model:\s*([^|·)]+)/gi;
      let mm;
      while ((mm = modelSegRegex.exec(rawLine)) !== null) {
        agentModels[normalizeAgentName(mm[1])] = mm[2].trim();
      }
    } else {
      for (const part of rawLine.split(/[,|]+/)) {
        const cleaned = part.replace(/\([^)]*\)/g, '').trim();
        if (cleaned) participants.add(normalizeAgentName(cleaned));
      }
    }
  }

  const modelsLineMatch = cleanText.match(/(?:^|\n)\s*\*{0,2}Agent\s+Models\s*:?\*{0,2}\s*:?\s*(\{[^\n]+\})/i);
  if (modelsLineMatch) {
    try {
      const parsed = JSON.parse(modelsLineMatch[1]);
      for (const [k, v] of Object.entries(parsed)) {
        agentModels[normalizeAgentName(k)] = typeof v === 'string' ? v : (v && (v.label || v.id)) || '';
      }
    } catch {}
  }

  // 2. Fallback to casual keyword detection only when structured Participating Agents header is absent
  if (!hasExplicitParticipants && cleanText) {
    if (/\b(antigravity|agy|gemini)\b/i.test(lower)) participants.add('@Antigravity');
    if (/\b(copilot|github\s*copilot)\b/i.test(lower)) participants.add('@Copilot');
    if (/\b(claude)\b/i.test(lower)) participants.add('@Claude');
    if (/\b(cursor)\b/i.test(lower)) participants.add('@Cursor');
    if (/\b(codex)\b/i.test(lower)) participants.add('@Codex');

    const atMatches = cleanText.match(/@[A-Za-z][A-Za-z0-9._-]*/g) || [];
    for (const m of atMatches) {
      const norm = normalizeAgentName(m);
      if (!['@All', '@System', '@User', '@Main', '@Unassigned', '@Agent'].includes(norm)) {
        participants.add(norm);
      }
    }
  }

  if (!hasExplicitMain) {
    const mainMatch =
      lower.match(/\bmain\s*(?:agent|manager|lead)?\s*[:=-]\s*@?([a-z0-9._-]+)\b/i) ||
      lower.match(/\b@?([a-z0-9._-]+)\s+(?:is|as)\s+(?:the\s+)?main\b/i);
    if (mainMatch && mainMatch[1]) {
      assignedMain = normalizeAgentName(mainMatch[1]);
      participants.add(assignedMain);
      hasExplicitMain = true;
    }
  }

  // 3. Also check presence.expectedParticipants & mainAgent if inbox wasn't explicitly cleared
  if (cleanText && fs.existsSync(PRESENCE_PATH)) {
    try {
      const pData = JSON.parse(fs.readFileSync(PRESENCE_PATH, 'utf8'));
      if (Array.isArray(pData.expectedParticipants)) {
        for (const ep of pData.expectedParticipants) {
          if (ep) participants.add(normalizeAgentName(ep));
        }
      }
      if (!hasExplicitMain && pData.mainAgent) {
        assignedMain = normalizeAgentName(pData.mainAgent);
      }
      if (pData.agentModels && typeof pData.agentModels === 'object') {
        for (const [k, v] of Object.entries(pData.agentModels)) {
          if (!agentModels[k]) agentModels[k] = v;
        }
      }
    } catch {}
  }

  return {
    participants: Array.from(participants),
    assignedMain,
    hasExplicitMain,
    agentModels
  };
}

function defaultPresenceObject(title = 'New Collaboration') {
  const timeId = getFileSafeTimestamp();
  const safeTitle = title || 'New Collaboration';
  return {
    updatedAt: getTimestamp(),
    onlineTimeoutMinutes: DEFAULT_ONLINE_TIMEOUT_MIN,
    sessionId: `session-${timeId}`,
    sessionFolder: `${timeId}_${sanitizeName(safeTitle)}`,
    sessionTitle: safeTitle,
    dispatchedAtIso: null,
    sessionCancelled: false,
    cancelledAtIso: null,
    sessionCompleted: false,
    completedAtIso: null,
    latestMessageNumber: 0,
    sessionMessages: [],
    cliPids: [],
    mainAgent: null,
    expectedParticipants: [],
    agentModels: {},
    slotMeta: {},
    savedSlots: null,
    plan: {
      status: 'NONE', // NONE | DRAFT | TEAM_REVIEWED | USER_APPROVED | CANCELLED
      summary: '',
      reviewedBy: [],
      approvedByUser: false,
      updatedAt: null
    },
    agents: {}
  };
}

function loadPresence() {
  if (fs.existsSync(PRESENCE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(PRESENCE_PATH, 'utf8'));
      if (data && data.agents) {
        if (!data.plan) {
          data.plan = { status: 'NONE', summary: '', reviewedBy: [], approvedByUser: false, updatedAt: null };
        }
        if (!Array.isArray(data.expectedParticipants)) {
          data.expectedParticipants = [];
        }
        if (!data.agentModels || typeof data.agentModels !== 'object') {
          data.agentModels = {};
        }
        if (data.mainAgent === undefined) {
          data.mainAgent = null;
        }
        if (!data.sessionId) {
          data.sessionId = `session-${getFileSafeTimestamp()}`;
        }
        if (!data.sessionTitle) {
          data.sessionTitle = 'New Collaboration';
        }
        if (!data.sessionFolder) {
          data.sessionFolder = `${getFileSafeTimestamp()}_${sanitizeName(data.sessionTitle)}`;
        }
        if (data.dispatchedAtIso === undefined) {
          data.dispatchedAtIso = null;
        }
        if (data.sessionCancelled === undefined) {
          data.sessionCancelled = false;
        }
        if (data.cancelledAtIso === undefined) {
          data.cancelledAtIso = null;
        }
        if (data.sessionCompleted === undefined) {
          data.sessionCompleted = false;
        }
        if (data.completedAtIso === undefined) {
          data.completedAtIso = null;
        }
        if (data.latestMessageNumber === undefined) {
          data.latestMessageNumber = Array.isArray(data.sessionMessages) ? data.sessionMessages.length : 0;
        }
        if (!Array.isArray(data.sessionMessages)) {
          data.sessionMessages = [];
        }
        if (!Array.isArray(data.cliPids)) {
          data.cliPids = [];
        }
        if (!data.slotMeta || typeof data.slotMeta !== 'object') {
          data.slotMeta = {};
        }
        if (data.savedSlots === undefined) {
          data.savedSlots = null;
        }
        return data;
      }
    } catch {}
  }
  return defaultPresenceObject();
}

function savePresence(presence) {
  presence.updatedAt = getTimestamp();
  try {
    writeFileRetrySync(PRESENCE_PATH, JSON.stringify(presence, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error(`Error saving ${PRESENCE_PATH}:`, err.message);
  }
}

function hasFinalSummarySinceLastPrompt(feed, presence) {
  if (presence && presence.sessionCompleted) {
    return true;
  }
  const items = feed && Array.isArray(feed.items) ? feed.items : [];
  let lastPromptIdx = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i] && items[i].kind === 'user_prompt') {
      lastPromptIdx = i;
      break;
    }
  }
  if (lastPromptIdx === -1) return false;
  for (let i = lastPromptIdx + 1; i < items.length; i++) {
    const it = items[i];
    if (it && it.kind === 'report' && String(it.reportType || '').toLowerCase() === 'final_summary') {
      return true;
    }
  }
  return false;
}

function ensureSignOffMessagePosted(mainAgent, title) {
  try {
    let comm = readFileSafe(COMM_PATH);
    if (!comm) return false;
    const messages = parseMessages(comm);
    const presence = loadPresence();
    const latestMsg = messages[messages.length - 1];
    if (latestMsg && String(latestMsg.type || '').toUpperCase() === 'SIGN-OFF') {
      return false;
    }
    const msgId = getNextMsgId(comm);
    const sender = normalizeAgentName(mainAgent || presence.mainAgent || '@Main');
    const entry = formatCompactMessage({
      id: msgId,
      from: sender,
      to: '@All',
      type: 'SIGN-OFF',
      subject: 'Final summary sent — Session Complete',
      body: `Final session summary report ("${title || 'Session Complete'}") has been sent. All tasks are complete; teammates may now run \`node scripts/hub.js offline "@YourAgent"\` and conclude.`
    });
    comm = comm.trimEnd() + '\n\n' + entry + '\n';
    writeFileRetrySync(COMM_PATH, comm, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function enforceNotCancelled(flags = {}) {
  const presence = loadPresence();
  if (presence.sessionCancelled) {
    if (flags && flags.json) {
      console.log(JSON.stringify({
        ok: false,
        status: 'cancelled',
        error: 'SESSION_CANCELLED_BY_USER',
        message: 'STOP: Session was cancelled by the user in the Vibe Coding tab. Abort all work and end your turn immediately without calling any more tools or sending reports.'
      }, null, 2));
    } else {
      console.log('🛑 SESSION CANCELLED BY USER IN VIBE CODING TAB.');
      console.log('STOP ALL WORK IMMEDIATELY. Do NOT call any more tools, do NOT send any reports or messages, and end your turn now.');
    }
    process.exit(4);
  }
}

function updateAgentPresence(agentName, updates = {}) {
  const agent = normalizeAgentName(agentName);
  const presence = loadPresence();
  const existing = presence.agents[agent] || {
    status: 'IDLE',
    assembled: true,
    currentTask: null,
    activity: 'Joined workspace',
    joinedAt: getTimestamp()
  };

  const now = new Date();
  const updated = {
    ...existing,
    assembled: existing.assembled !== undefined ? existing.assembled : true,
    ...updates,
    pid: process.ppid || existing.pid || null,
    lastSeen: getTimestamp(),
    lastSeenIso: now.toISOString()
  };

  presence.agents[agent] = updated;
  savePresence(presence);
  return updated;
}

function formatRelativeTime(isoOrMs) {
  if (!isoOrMs) return 'never';
  const time = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  if (isNaN(time)) return 'unknown';
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 0 || diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Merges passive OS/IDE log telemetry with workspace presence & expected participants.
 * Does NOT require agents to manually check in to know if they are online, running, or out of credits.
 */
function getCombinedAgentStatuses(timeoutMinutes = DEFAULT_ONLINE_TIMEOUT_MIN) {
  const presence = loadPresence();
  const passive = probeAllPassiveTelemetry();
  const { participants, assignedMain, hasExplicitMain, agentModels } = parseInboxParticipantsAndRoles();
  const dispatchedMs = presence.dispatchedAtIso ? new Date(presence.dispatchedAtIso).getTime() : 0;
  const feed = loadFeed();
  const isCompleted = !presence.sessionCancelled && hasFinalSummarySinceLastPrompt(feed, presence);

  if (isCompleted && !presence.sessionCompleted) {
    presence.sessionCompleted = true;
    presence.completedAtIso = new Date().toISOString();
    savePresence(presence);
    ensureSignOffMessagePosted(presence.mainAgent, 'Final Summary');
  }

  const slotMeta = presence.slotMeta && typeof presence.slotMeta === 'object' ? presence.slotMeta : {};
  const coveredProviders = new Set(
    participants.map((p) => (slotMeta[p] && slotMeta[p].providerTag) || getBaseProviderTag(p))
  );

  const allNames = new Set([
    ...participants,
    ...Object.keys(presence.agents),
    ...Object.keys(passive).filter((k) => !coveredProviders.has(k))
  ]);

  const combined = {};

  for (const name of allNames) {
    const meta = slotMeta[name] || null;
    const providerTag = (meta && meta.providerTag) || getBaseProviderTag(name);
    const rec = presence.agents[name] || null;
    const pas = passive[name] || (providerTag ? passive[providerTag] : null) || null;
    const isExpected = participants.includes(name);
    const isAssembled = Boolean(rec && rec.assembled === true && rec.status !== 'OFFLINE');

    const recMs = rec && rec.lastSeenIso ? new Date(rec.lastSeenIso).getTime() : 0;
    const pasMs = pas && pas.lastActiveMs ? pas.lastActiveMs : 0;
    const bestMs = Math.max(recMs, pasMs);
    const bestIso = bestMs > 0 ? new Date(bestMs).toISOString() : null;
    const diffMin = bestMs > 0 ? (Date.now() - bestMs) / 60000 : Infinity;

    let status = 'OFFLINE';
    let label = '⚪ OFFLINE';
    let isOnline = false;
    let source = pas ? 'passive-telemetry' : (rec ? 'hub-state' : 'none');
    let activity = (rec && rec.activity) || (pas && pas.detail) || 'Inactive';

    if (presence.sessionCancelled) {
      status = 'OFFLINE';
      label = '⚪ CANCELLED';
      isOnline = false;
      activity = 'Session cancelled by user';
    } else if (isCompleted) {
      status = 'IDLE';
      label = '🟢 COMPLETED';
      isOnline = false;
      activity = 'Session completed (final_summary sent)';
    }
    // 1. Check credit exhaustion / fatal error first
    else if ((rec && rec.status === 'CREDIT_EXHAUSTED') || (pas && pas.status === 'CREDIT_EXHAUSTED')) {
      status = 'CREDIT_EXHAUSTED';
      label = '🔴 CREDIT_EXHAUSTED';
      isOnline = false;
      activity = (pas && pas.detail) || (rec && rec.activity) || 'Out of credits / quota error';
    }
    // 2. Check if passively detected as RUNNING right now
    else if (pas && pas.status === 'RUNNING') {
      status = 'RUNNING';
      label = '🟡 RUNNING';
      isOnline = true;
      activity = pas.detail + (rec && rec.currentTask ? ` [${rec.currentTask}]` : '');
    }
    // 3. Check if passively WAITING for tool confirmation
    else if (pas && pas.status === 'WAITING') {
      status = 'WAITING';
      label = '🟠 WAITING_APPROVAL';
      isOnline = true;
      activity = pas.detail;
    }
    // 4. Check if explicitly marked OFFLINE by user/agent
    else if (rec && rec.status === 'OFFLINE' && (rec.assembled === false || recMs >= pasMs)) {
      status = 'OFFLINE';
      label = '⚪ OFFLINE';
      isOnline = false;
    }
    // 5. Check if active within timeout window (either via passive telemetry or hub commands)
    else if (diffMin <= timeoutMinutes) {
      if (rec && rec.status === 'RUNNING' && (!pas || pas.status !== 'IDLE')) {
        status = 'RUNNING';
        label = '🟡 RUNNING';
        isOnline = true;
      } else {
        status = 'IDLE';
        label = '🟢 ONLINE (IDLE)';
        isOnline = true;
      }
    } else {
      status = 'OFFLINE';
      label = bestMs > 0 ? `⚪ OFFLINE (${formatRelativeTime(bestIso)})` : '⚪ OFFLINE';
      isOnline = false;
    }

    if (
      !presence.sessionCancelled &&
      !isCompleted &&
      isExpected &&
      !isAssembled &&
      status !== 'CREDIT_EXHAUSTED' &&
      status !== 'OFFLINE' &&
      (!pasMs || !dispatchedMs || pasMs < dispatchedMs - 5000)
    ) {
      activity = 'Online in IDE (not yet assembled for this session)';
    }

    const modelFromMap = agentModels[name] || (presence.agentModels && presence.agentModels[name]) || '';
    const modelLabel = (meta && meta.modelLabel) || modelFromMap || '';
    const displayName = (meta && (meta.displayName || meta.modelLabel)) || modelLabel || (name.startsWith('@') ? name.slice(1) : name);

    combined[name] = {
      agent: name,
      providerTag,
      modelLabel,
      displayName,
      roleIds: meta && Array.isArray(meta.roleIds) ? meta.roleIds : [],
      roleSummary: (meta && meta.roleSummary) || '',
      mixedColor: (meta && meta.mixedColor) || null,
      writePermission: (meta && meta.writePermission) || null,
      slotIndex: meta && typeof meta.slotIndex === 'number' ? meta.slotIndex : null,
      status,
      label,
      isOnline,
      isExpected,
      isAssembled,
      currentTask: (rec && rec.currentTask) || null,
      activity,
      lastSeenIso: bestIso,
      relativeTime: formatRelativeTime(bestIso),
      source,
      pidAlive: rec && rec.pid ? isPidAlive(rec.pid) : null
    };
  }

  // Determine Main Agent & Substitute Main failover (no default agent unless explicitly selected)
  const primaryMain = (hasExplicitMain ? assignedMain : null) || presence.mainAgent || assignedMain || (participants.length > 0 ? participants[0] : null);
  const mainState = primaryMain ? combined[primaryMain] : null;
  let effectiveMain = primaryMain;
  let failoverActive = false;

  if (!presence.sessionCancelled && !isCompleted && primaryMain && participants.length > 0 && (!mainState || !mainState.isOnline || mainState.status === 'CREDIT_EXHAUSTED')) {
    const onlineCandidates = Object.values(combined).filter(a => a.isOnline && a.agent !== primaryMain);
    if (onlineCandidates.length > 0) {
      const preferred = onlineCandidates.find(a => a.isExpected) || onlineCandidates[0];
      effectiveMain = preferred.agent;
      failoverActive = true;
    }
  }

  return {
    agents: combined,
    participants,
    primaryMain,
    effectiveMain,
    failoverActive,
    sessionId: presence.sessionId || null,
    sessionFolder: presence.sessionFolder || null,
    sessionTitle: presence.sessionTitle || 'New Collaboration',
    sessionCancelled: Boolean(presence.sessionCancelled),
    sessionCompleted: Boolean(isCompleted),
    latestMessageNumber: presence.latestMessageNumber || 0,
    savedSlots: presence.savedSlots || null,
    slotMeta,
    agentModels: (presence.agentModels && Object.keys(presence.agentModels).length > 0) ? presence.agentModels : agentModels,
    plan: presence.plan || { status: 'NONE', summary: '', reviewedBy: [], approvedByUser: false }
  };
}

// ============================================================
// 📥 CASUAL INBOX & COMPACT MARKDOWN PARSERS
// ============================================================

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

/**
 * Parses both the new Ultra-Compact message format and legacy verbose message format:
 * Compact format:
 *   ### `MSG-001` [16:40] @Antigravity -> @Copilot [HANDOFF] · Subject text ✓:@Copilot
 *   Message body line 1...
 */
function parseMessages(commContent) {
  const messages = [];
  if (!commContent) return messages;

  const blocks = commContent.match(/### (?:💬 )?`(MSG-\d+)`[\s\S]*?(?=\n### (?:💬 )?`MSG-|$)/g);
  if (!blocks) return messages;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const header = lines[0];

    // Try compact format first:
    // ### `MSG-001` [16:40] @From -> @To [TYPE] · Subject ✓:@Reader1,@Reader2
    const compactMatch = header.match(
      /^###\s+(?:💬\s+)?`(MSG-\d+)`\s+\[([^\]]+)\]\s+([^\s]+)\s*->\s*([^\s]+)\s+\[([^\]]+)\]\s*·\s*(.*?)(?:\s+✓:([^\n]+))?$/
    );

    if (compactMatch) {
      const [, id, dateTime, from, to, type, subject, readByRaw] = compactMatch;
      const body = lines.slice(1).join('\n').trim();
      messages.push({
        id,
        isCompact: true,
        fullBlock: block,
        dateTime: dateTime.trim(),
        from: from.trim(),
        to: to.trim(),
        type: type.trim(),
        status: 'OPEN',
        readBy: readByRaw ? readByRaw.trim() : '',
        subject: subject.trim(),
        body
      });
      continue;
    }

    // Fallback: Legacy verbose format
    const idMatch = block.match(/### (?:💬 )?`(MSG-\d+)`/);
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
      isCompact: false,
      fullBlock: block,
      dateTime: dateMatch ? dateMatch[1].trim() : '',
      from: fromMatch ? fromMatch[1].trim() : '',
      to: toMatch ? toMatch[1].trim() : '',
      type: typeMatch ? typeMatch[1].trim() : '',
      status: statusMatch ? statusMatch[1].trim() : '',
      readBy: readByMatch ? readByMatch[1].trim() : '',
      subject: subjectMatch ? subjectMatch[1].trim() : ''
    });
  }

  return messages;
}

function getNextMsgId(commContent) {
  const matches = commContent.match(/`(MSG-(\d+))`/g);
  let maxNum = 0;
  if (matches) {
    for (const m of matches) {
      const n = parseInt(m.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `MSG-${String(maxNum + 1).padStart(3, '0')}`;
}

function formatCompactMessage({ id, time, from, to, type, subject, body, readBy }) {
  const receiptSuffix = readBy ? ` ✓:${readBy}` : '';
  const cleanBody = (body || '').trim();
  return `### \`${id}\` [${time || getShortTime()}] ${from} -> ${to} [${type.toUpperCase()}] · ${subject}${receiptSuffix}\n${cleanBody}`;
}

// ============================================================
// 🚀 CORE WORKSPACE COMMANDS
// ============================================================

function cmdAssemble(agentName) {
  enforceNotCancelled();
  const identity = resolveParticipantIdentity(agentName);
  const agent = identity.tag;
  const displayTitle = identity.displayName || agent;
  const roleTagStr = identity.roleSummary ? ` · Roles: ${identity.roleSummary} (${identity.mixedColor})` : '';
  const userText = getCasualInboxText();

  updateAgentPresence(agent, {
    status: 'IDLE',
    assembled: true,
    currentTask: null,
    activity: `Assembled (${displayTitle})${roleTagStr}`
  });

  const state = getCombinedAgentStatuses();
  const isMain = Boolean(state.effectiveMain && state.effectiveMain.toLowerCase() === agent.toLowerCase());

  console.log('='.repeat(65));
  console.log(`🚀 ${displayTitle.toUpperCase()} [${agent}] ASSEMBLED (${isMain ? 'MAIN / MANAGER' : 'PARTICIPANT'}${roleTagStr})`);
  console.log('='.repeat(65));

  console.log('\n📥 USER INBOX:');
  console.log(userText ? `"${userText}"` : '(Empty)');

  // Post compact assembly entry in AGENT_COMMUNICATION.md
  let comm = readFileSafe(COMM_PATH);
  const msgId = getNextMsgId(comm);
  const entry = formatCompactMessage({
    id: msgId,
    from: `${displayTitle} [${identity.mixedColor}]`,
    to: '@All',
    type: 'ASSEMBLE',
    subject: `${displayTitle} (${agent}) assembled`,
    body: `Online and assembled (${isMain ? 'Main/Manager' : 'Participant'}${roleTagStr}).`
  });
  comm = comm.trimEnd() + '\n\n' + entry + '\n';
  writeFileRetrySync(COMM_PATH, comm, 'utf8');

  cmdLogInternal(displayTitle, `Assembled (${agent}${roleTagStr})`, 'USER_INBOX.md, TASKS.md');
  syncCurrentSessionToArchive();

  // Show team assembly status
  console.log('\n👥 TEAM ONLINE & ASSEMBLY STATUS (Passive + Active Telemetry):');
  const allAgents = Object.values(state.agents);
  const missingParticipants = [];
  for (const a of allAgents) {
    const roleTag = (state.effectiveMain && a.agent === state.effectiveMain) ? ' [MAIN]' : (a.isExpected ? ' [REQ]' : '');
    const asmTag = a.isAssembled ? 'Assembled' : 'Not assembled yet';
    console.log(`  • ${(a.agent + roleTag).padEnd(20)} ${a.label.padEnd(22)} (${asmTag} · ${a.relativeTime})`);
    if (a.isExpected && (!a.isOnline || !a.isAssembled)) {
      missingParticipants.push(a.agent);
    }
  }

  if (state.failoverActive) {
    console.log(`\n⚠️ FAILOVER NOTICE: Primary Main (${state.primaryMain}) is offline/unavailable.`);
    console.log(`   👉 ${state.effectiveMain} is now Acting Main (Substitute Manager)!`);
  }

  console.log(`\n📐 PLAN STATUS: [${state.plan.status}] (User Approved: ${state.plan.approvedByUser ? 'YES ✅' : 'NO ⏳'})`);
  if (!state.plan.approvedByUser) {
    console.log(`   🔒 Lock Rule: Do NOT edit project files outside 'vibe coding tools' until the team is assembled AND the user approves the plan in the AIvengers tab!`);
  }

  if (missingParticipants.length > 0) {
    console.log(`\n⏳ WAITING FOR TEAMMATES: ${missingParticipants.join(', ')}`);
    console.log(`   Run: node scripts/hub.js wait-team --timeout 180`);
    console.log(`   (While waiting, you may analyze files and draft/discuss the plan in AGENT_COMMUNICATION.md, but do NOT edit files outside this folder.)`);
  }

  const unread = getUnreadMessages(agent);
  console.log(`\n📬 UNREAD MESSAGES (${unread.length}):`);
  if (unread.length === 0) {
    console.log('  ✨ None.');
  } else {
    for (const m of unread) {
      console.log(`  • ${m.id} [${m.dateTime}] ${m.from}: ${m.subject}`);
    }
    console.log(`  👉 Acknowledge all: node scripts/hub.js read all "${agent}"`);
  }
  console.log('='.repeat(65));
}

function cmdStatus() {
  const state = getCombinedAgentStatuses();
  console.log('='.repeat(65));
  console.log('🤖 MULTI-AGENT WORKSPACE STATUS');
  console.log('='.repeat(65));

  console.log('\n📥 USER INBOX:');
  const userText = getCasualInboxText();
  console.log(userText ? `  "${userText}"` : '  (Empty)');

  console.log(`\n👥 LIVE TEAM STATUS (Main: ${state.effectiveMain || '(None selected)'}${state.failoverActive ? ' [SUBSTITUTE]' : ''}):`);
  for (const a of Object.values(state.agents)) {
    const roleTag = (state.effectiveMain && a.agent === state.effectiveMain) ? '[MAIN]' : '•     ';
    const taskStr = a.currentTask ? ` [${a.currentTask}]` : '';
    console.log(`  ${roleTag} ${a.agent.padEnd(14)} ${a.label.padEnd(22)} ${a.activity}${taskStr} (${a.relativeTime})`);
  }

  console.log(`\n📐 SHARED PLAN: [${state.plan.status}] · Approved by User: ${state.plan.approvedByUser ? 'YES ✅' : 'NO ⏳'}`);
  if (state.plan.reviewedBy && state.plan.reviewedBy.length > 0) {
    console.log(`   Reviewed by: ${state.plan.reviewedBy.join(', ')}`);
  }
  if (state.plan.summary) {
    console.log(`   Summary: ${state.plan.summary}`);
  }

  const tasks = readFileSafe(TASKS_PATH);
  const activeSection = tasks.match(/## 🏃 Active Tasks[\s\S]*?(?=## 🎯 Ready|## 🗄️ Backlog|## ✅ Completed|$)/);
  console.log('\n📋 ACTIVE TASKS:');
  if (activeSection) {
    const body = activeSection[0].replace(/## 🏃 Active Tasks[^\n]*\n/, '').replace(/^---$/gm, '').trim();
    console.log(body || '  (None)');
  }

  const comm = readFileSafe(COMM_PATH);
  const messages = parseMessages(comm);
  console.log(`\n💬 RECENT MESSAGES (${messages.length} total):`);
  messages.slice(-3).forEach(m => {
    const r = m.readBy ? ` ✓:${m.readBy}` : '';
    console.log(`  • ${m.id} [${m.dateTime}] ${m.from}->${m.to} [${m.type}] ${m.subject}${r}`);
    if (m.body) console.log(`    ${m.body.split('\n')[0].slice(0, 100)}`);
  });

  console.log('='.repeat(65));
}

function cmdInbox() {
  console.log(readFileSafe(INBOX_PATH));
}

function cmdTasks() {
  console.log(readFileSafe(TASKS_PATH));
}

function cmdClaim(taskId, agentName, lockedFiles) {
  enforceNotCancelled();
  if (!taskId || !agentName) {
    console.error('Error: claim requires <taskId> and <agentName>');
    process.exit(1);
  }

  const identity = resolveParticipantIdentity(agentName);
  const agentFormatted = identity.tag;
  const state = getCombinedAgentStatuses();

  // Warn if writePermission restricts outside file edits
  const writeTier = identity.writePermission || 'code-write';
  const nonMdLocks = (lockedFiles || []).filter(
    (f) => f && !/\.md$/i.test(String(f).trim())
  );
  if (nonMdLocks.length > 0 && writeTier !== 'code-write') {
    console.log(`⚠️ Role Tier Notice (${writeTier}): ${identity.displayName} has roles [${identity.roleSummary || 'Markdown Only'}]. Delegate outside source code locks (${nonMdLocks.join(', ')}) to a Coder-tier teammate.`);
  }

  // Warn if locking files outside vibe coding tools before user plan approval
  const locksStr = lockedFiles && lockedFiles.length > 0
    ? lockedFiles.map(f => `\`${f}\``).join(', ')
    : 'none';

  let tasks = readFileSafe(TASKS_PATH);
  // Match either compact `### \`TASK-001\` ...` or legacy `### \`TASK-001\`: ...`
  const taskRegex = new RegExp(`### \`${taskId}\`[\\s\\S]*?(?=\\n### |\\n## |$)`);
  const match = tasks.match(taskRegex);

  if (!match) {
    console.error(`Error: Task ${taskId} not found in ${TASKS_PATH}`);
    process.exit(1);
  }

  const existingBlock = match[0].trim();
  const lines = existingBlock.split('\n');
  // Extract title & description from either compact or legacy block
  let title = taskId;
  const headerTitleMatch = lines[0].match(/### `[^`]+`(?::\s*|\s+\[[^\]]+\]\s+[^\s]+\s*·\s*)([^\n(]+)/);
  if (headerTitleMatch) title = headerTitleMatch[1].trim();

  let desc = '';
  const legacyDescMatch = existingBlock.match(/- \*\*Description:\*\*\s*([^\n]+)/);
  if (legacyDescMatch) {
    desc = legacyDescMatch[1].trim();
  } else if (lines.length > 1 && !lines[1].startsWith('- **')) {
    desc = lines.slice(1).join('\n').trim();
  }

  const compactBlock = `### \`${taskId}\` [IN PROGRESS] ${agentFormatted} · ${title} (Locks: ${locksStr})${desc ? `\n${desc}` : ''}`;

  tasks = tasks.replace(match[0], '').replace(/\n{3,}/g, '\n\n').trim();
  tasks = tasks.replace('*(No active tasks currently claimed)*', '');

  const activeHeader = '## 🏃 Active Tasks (`[IN PROGRESS]`)';
  if (tasks.includes(activeHeader)) {
    tasks = tasks.replace(activeHeader, `${activeHeader}\n\n${compactBlock}`);
  } else {
    tasks = `${activeHeader}\n\n${compactBlock}\n\n` + tasks;
  }

  writeFileRetrySync(TASKS_PATH, tasks.trim() + '\n', 'utf8');

  updateAgentPresence(agentFormatted, {
    status: 'RUNNING',
    currentTask: taskId,
    activity: `Working on ${taskId}`
  });

  cmdLogInternal(identity.displayName || agentFormatted, `Claimed ${taskId}`, lockedFiles ? lockedFiles.join(', ') : 'none');
  console.log(`✅ Claimed ${taskId} for ${identity.displayName || agentFormatted} (${agentFormatted}, Locks: ${locksStr})`);
  if (!state.plan.approvedByUser) {
    console.log(`⚠️ Reminder: Plan is not yet marked approved by user. Do not modify files outside 'vibe coding tools' until approved!`);
  }
}

function cmdComplete(taskId, agentName) {
  enforceNotCancelled();
  if (!taskId || !agentName) {
    console.error('Error: complete requires <taskId> and <agentName>');
    process.exit(1);
  }

  const identity = resolveParticipantIdentity(agentName);
  const agentFormatted = identity.tag;
  let tasks = readFileSafe(TASKS_PATH);
  const taskRegex = new RegExp(`### \`${taskId}\`[\\s\\S]*?(?=\\n### |\\n## |$)`);
  const match = tasks.match(taskRegex);

  if (!match) {
    console.error(`Error: Task ${taskId} not found in ${TASKS_PATH}`);
    process.exit(1);
  }

  const existingBlock = match[0].trim();
  const lines = existingBlock.split('\n');
  let title = taskId;
  const headerTitleMatch = lines[0].match(/### `[^`]+`(?::\s*|\s+\[[^\]]+\]\s+[^\s]+\s*·\s*)([^\n(]+)/);
  if (headerTitleMatch) title = headerTitleMatch[1].trim();

  let desc = '';
  const legacyDescMatch = existingBlock.match(/- \*\*Description:\*\*\s*([^\n]+)/);
  if (legacyDescMatch) {
    desc = legacyDescMatch[1].trim();
  } else if (lines.length > 1 && !lines[1].startsWith('- **')) {
    desc = lines.slice(1).join('\n').trim();
  }

  const compactDone = `### \`${taskId}\` [DONE] ${agentFormatted} · ${title}${desc ? `\n${desc}` : ''}`;

  tasks = tasks.replace(match[0], '').replace(/\n{3,}/g, '\n\n').trim();
  const completedHeader = '## ✅ Completed Tasks (`[DONE]`)';
  if (tasks.includes(completedHeader)) {
    tasks = tasks.replace(completedHeader, `${completedHeader}\n\n${compactDone}`);
  } else {
    tasks += `\n\n${completedHeader}\n\n${compactDone}\n`;
  }

  writeFileRetrySync(TASKS_PATH, tasks.trim() + '\n', 'utf8');

  updateAgentPresence(agentFormatted, {
    status: 'IDLE',
    currentTask: null,
    activity: `Completed ${taskId}, standing by to assist team`
  });

  cmdLogInternal(identity.displayName || agentFormatted, `Completed ${taskId}`, 'none');
  console.log(`🎉 Completed ${taskId} by ${identity.displayName || agentFormatted} (${agentFormatted}). Stay on standby (IDLE) or check if teammates need help until Main sends the final report!`);
}

function cmdMsg(flags) {
  enforceNotCancelled(flags);
  const fromIdentity = resolveParticipantIdentity(flags.from || '@Agent');
  const from = fromIdentity.tag;
  const to = flags.to ? (flags.to.startsWith('@') ? flags.to : `@${flags.to}`) : '@All';
  const type = (flags.type || 'MSG').toUpperCase();
  const subject = flags.subject || 'Update';
  const body = flags.body || '';

  let comm = readFileSafe(COMM_PATH);
  const msgId = getNextMsgId(comm);
  const entry = formatCompactMessage({
    id: msgId,
    from,
    to,
    type,
    subject,
    body
  });

  comm = comm.trimEnd() + '\n\n' + entry + '\n';
  writeFileRetrySync(COMM_PATH, comm, 'utf8');

  updateAgentPresence(from, {
    activity: `Posted ${msgId} to ${to}: ${subject.slice(0, 32)}`
  });

  console.log(`📨 Posted ${msgId} (${fromIdentity.displayName} [${from}] -> ${to}): ${subject}`);
}

function cmdLogInternal(agent, action, files, notes) {
  let log = readFileSafe(LOG_PATH);
  const filePart = files && files !== 'none' && files !== 'N/A' ? ` (\`${files}\`)` : '';
  const notePart = notes ? ` — ${notes}` : '';
  const line = `- \`${getTimestamp()}\` **${agent}** ${action}${filePart}${notePart}`;
  log = log.trimEnd() + '\n' + line + '\n';
  writeFileRetrySync(LOG_PATH, log, 'utf8');
}

function cmdLog(flags) {
  const agent = normalizeAgentName(flags.agent || '@Agent');
  const action = flags.action || 'Update';
  const files = flags.files || '';
  const notes = flags.notes || '';

  cmdLogInternal(agent, action, files, notes);
  console.log(`📝 Logged action to ${LOG_PATH}`);
}

// ============================================================
// 👥 PEERS, HEALTH, TEAM-WAIT & PLAN COMMANDS
// ============================================================

function cmdPeers(flags = {}, positional = []) {
  const timeoutMin = parseInt(flags.timeout || DEFAULT_ONLINE_TIMEOUT_MIN, 10);
  const state = getCombinedAgentStatuses(timeoutMin);
  const agentList = Object.values(state.agents);

  const rawTarget = typeof flags.check === 'string'
    ? flags.check
    : (positional && positional[1] && !positional[1].startsWith('-') ? positional[1] : (flags.check === true ? flags.agent : null));

  if (rawTarget) {
    const target = normalizeAgentName(rawTarget);
    const data = state.agents[target];
    if (!data) {
      console.log(`❌ Agent ${target} is not detected.`);
      process.exit(1);
    }
    console.log(`Agent ${target}: ${data.label}`);
    console.log(`  Status:       ${data.status} (Source: ${data.source})`);
    console.log(`  Is Online:    ${data.isOnline ? 'YES' : 'NO'}`);
    console.log(`  Assembled:    ${data.isAssembled ? 'YES' : 'NO'}`);
    console.log(`  Role:         ${state.effectiveMain === target ? 'MAIN (Manager)' : 'Participant'}`);
    console.log(`  Current Task: ${data.currentTask || '(None)'}`);
    console.log(`  Activity:     ${data.activity}`);
    console.log(`  Last Active:  ${data.relativeTime}`);
    process.exit(data.isOnline ? 0 : 1);
  }

  if (flags.json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  console.log('='.repeat(72));
  console.log(`👥 LIVE AGENT STATUS (Passive Telemetry + Hub State · Main: ${state.effectiveMain || '(None selected)'})`);
  console.log('='.repeat(72));

  if (agentList.length === 0) {
    console.log('  (No agents detected)');
  } else {
    for (const a of agentList) {
      const role = (state.effectiveMain && a.agent === state.effectiveMain) ? '[MAIN]' : (a.isExpected ? '[TEAM]' : ' PEER ');
      const asm = a.isAssembled ? 'Assembled' : 'Unassembled';
      console.log(`${role} ${a.agent.padEnd(14)} ${a.label.padEnd(22)} [${asm.padEnd(11)}] (${a.relativeTime})`);
      console.log(`       Activity: ${a.activity}`);
    }
  }

  if (state.failoverActive) {
    console.log(`\n🚨 FAILOVER ACTIVE: ${state.primaryMain} is offline/exhausted -> ${state.effectiveMain} is Substitute Main!`);
  }
  console.log('='.repeat(72));
}

function cmdHealth() {
  const state = getCombinedAgentStatuses();
  const tasksText = readFileSafe(TASKS_PATH);
  const droppedAgents = [];
  const notAssembled = state.participants.filter(
    (p) => !state.agents[p] || !state.agents[p].isAssembled
  );

  for (const a of Object.values(state.agents)) {
    if (a.status === 'CREDIT_EXHAUSTED' || (a.isExpected && a.isAssembled && !a.isOnline)) {
      droppedAgents.push(a);
    }
  }

  console.log('='.repeat(68));
  console.log('🩺 WORKSPACE TEAM HEALTH & CREDIT FAILOVER CHECK');
  console.log('='.repeat(68));
  console.log(`Primary Main:   ${state.primaryMain || '(None selected)'}`);
  console.log(`Effective Main: ${state.effectiveMain || '(None selected)'}${state.failoverActive ? ' (⚠️ SUBSTITUTE MAIN ACTIVE)' : (state.effectiveMain ? ' (Healthy)' : '')}`);
  console.log(`📐 Plan Status:    [${state.plan.status}] (User Approved: ${state.plan.approvedByUser ? 'YES' : 'NO'})`);

  if (state.sessionCancelled) {
    console.log('\n⛔ SESSION CANCELLED BY USER — Stop all ongoing work immediately.');
  } else if (state.sessionCompleted) {
    console.log('\n✅ SESSION COMPLETE — Main has sent the final_summary report.');
  } else if (droppedAgents.length > 0) {
    console.log(`\n🚨 ALERT: ${droppedAgents.length} agent(s) experienced offline/credit-shortage:`);
    for (const d of droppedAgents) {
      console.log(`  • ${d.agent}: ${d.label} — ${d.activity}`);
      if (d.currentTask || tasksText.includes(`[IN PROGRESS] ${d.agent}`)) {
        console.log(`    ⚠️ Holds incomplete task(s)!`);
      }
    }
    console.log(`\n👉 REQUIRED ACTION FOR ${state.effectiveMain || 'Acting Main'}:`);
    console.log(`   Send a poll via \`node scripts/hub.js poll\` to notify the user in the AIvengers tab and ask whether to:`);
    console.log(`   1) Take over ${droppedAgents.map(d => d.agent).join(', ')}'s incomplete tasks`);
    console.log(`   2) Continue working on remaining tasks without them`);
    console.log(`   3) Wait for the user to restore/top-up the agent`);
  } else if (notAssembled.length > 0) {
    console.log(`\n⏳ WAITING FOR TEAM ASSEMBLY: ${notAssembled.join(', ')} not assembled yet.`);
    console.log(`   👉 Run: node scripts/hub.js wait-team --timeout 180 (or poll user if timed out)`);
  } else {
    console.log('\n✅ All assembled agents are healthy and online.');
  }
  console.log('='.repeat(68));
}

function cmdWaitTeam(flags = {}) {
  enforceNotCancelled(flags);
  const timeoutSec = parseInt(flags.timeout || '180', 10);
  const startTime = Date.now();

  console.log(`[Team Wait] Checking if all participating agents from USER_INBOX.md are online & assembled... (Timeout: ${timeoutSec}s)`);
  console.log(`[Team Wait] Note: While waiting, you may plan/discuss in AGENT_COMMUNICATION.md, but do NOT edit files outside 'vibe coding tools'.`);

  function checkReady() {
    const rawPresence = loadPresence();
    if (rawPresence.sessionCancelled) {
      return { cancelled: true, ready: false, missing: [], expected: [], state: null };
    }
    const state = getCombinedAgentStatuses();
    const expected = state.participants.length > 0 ? state.participants : Object.keys(state.agents);
    const missing = [];
    for (const p of expected) {
      const a = state.agents[p];
      if (!a || !a.isOnline || !a.isAssembled) {
        missing.push(p);
      }
    }
    return { cancelled: false, ready: missing.length === 0, missing, expected, state };
  }

  const init = checkReady();
  if (init.cancelled) {
    console.log('⛔ Session cancelled by user — aborting wait.');
    process.exit(4);
  }
  if (init.ready && init.expected.length > 0) {
    console.log(`🎉 All expected participants (${init.expected.join(', ')}) are ONLINE and ASSEMBLED!`);
    process.exit(0);
  }

  const interval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const res = checkReady();
    if (res.cancelled) {
      clearInterval(interval);
      console.log('\n⛔ Session cancelled by user — aborting wait.');
      process.exit(4);
    }
    if (res.ready && res.expected.length > 0) {
      clearInterval(interval);
      console.log(`\n🎉 All expected participants (${res.expected.join(', ')}) are now ONLINE and ASSEMBLED!`);
      process.exit(0);
    }
    if (elapsed >= timeoutSec) {
      clearInterval(interval);
      console.log(`\n⏰ [Wait Timeout] Still waiting for: ${res.missing.join(', ')} after ${timeoutSec}s.`);
      console.log(`👉 ACTION: Run \`node scripts/hub.js poll\` to ask the user in the AIvengers tab whether to start work without ${res.missing.join(', ')} or keep waiting.`);
      process.exit(2);
    }
  }, 2500);
}

function cmdPlan(positional = [], flags = {}) {
  const sub = (positional[1] || 'status').toLowerCase();
  if (sub !== 'status') {
    enforceNotCancelled(flags);
  }
  const presence = loadPresence();
  if (!presence.plan) {
    presence.plan = { status: 'NONE', summary: '', reviewedBy: [], approvedByUser: false, updatedAt: null };
  }

  if (sub === 'draft' || sub === 'set') {
    const agent = normalizeAgentName(flags.agent || positional[2] || presence.mainAgent || '@Agent');
    const summary = flags.summary || positional.slice(3).join(' ') || 'Draft collaboration plan posted in TASKS.md / AGENT_COMMUNICATION.md';
    presence.plan.status = 'DRAFT';
    presence.plan.summary = summary;
    presence.plan.reviewedBy = [agent];
    presence.plan.approvedByUser = false;
    presence.plan.updatedAt = getTimestamp();
    savePresence(presence);
    cmdLogInternal(agent, `Drafted team plan`, 'TASKS.md', summary);
    syncCurrentSessionToArchive();
    console.log(`📝 Plan set to [DRAFT] by ${agent}: "${summary}"`);
    console.log(`👉 Next: Teammates review with: node scripts/hub.js plan review "@Teammate"`);
    return;
  }

  if (sub === 'review') {
    const agent = normalizeAgentName(flags.agent || positional[2] || presence.mainAgent || '@Agent');
    if (!presence.plan.reviewedBy.includes(agent)) {
      presence.plan.reviewedBy.push(agent);
    }
    presence.plan.status = 'TEAM_REVIEWED';
    presence.plan.updatedAt = getTimestamp();
    savePresence(presence);
    cmdLogInternal(agent, `Reviewed & agreed to team plan`, 'TASKS.md');
    syncCurrentSessionToArchive();
    console.log(`🤝 ${agent} marked the team plan as reviewed! (Reviewed by: ${presence.plan.reviewedBy.join(', ')})`);
    console.log(`👉 Next: Main Agent must send the plan to the AIvengers tab for user approval, then run: node scripts/hub.js plan approve`);
    return;
  }

  if (sub === 'approve' || sub === 'approved') {
    const agent = normalizeAgentName(flags.agent || positional[2] || presence.mainAgent || '@User');
    presence.plan.status = 'USER_APPROVED';
    presence.plan.approvedByUser = true;
    presence.plan.updatedAt = getTimestamp();
    savePresence(presence);
    cmdLogInternal(agent, `Recorded User Approval for team plan`, 'TASKS.md');
    syncCurrentSessionToArchive();
    console.log(`✅ Plan marked as [USER_APPROVED]! Agents may now claim tasks and edit target project files.`);
    return;
  }

  console.log(`📐 Plan Status: [${presence.plan.status}]`);
  console.log(`   User Approved: ${presence.plan.approvedByUser ? 'YES ✅' : 'NO ⏳'}`);
  console.log(`   Reviewed By:   ${presence.plan.reviewedBy.join(', ') || '(None)'}`);
  console.log(`   Summary:       ${presence.plan.summary || '(None)'}`);
}

function cmdPing(agentArg, activityArg) {
  enforceNotCancelled();
  if (!agentArg) {
    console.error('Error: ping requires <agentName>');
    process.exit(1);
  }
  const agent = normalizeAgentName(agentArg);
  const updated = updateAgentPresence(agent, activityArg ? { activity: activityArg } : {});
  console.log(`💓 Heartbeat for ${agent} at ${updated.lastSeen} (${updated.activity})`);
}

function cmdBusy(agentArg, taskOrActivity, activityArg) {
  enforceNotCancelled();
  if (!agentArg) {
    console.error('Error: busy requires <agentName> [task] [activity]');
    process.exit(1);
  }
  const agent = normalizeAgentName(agentArg);
  let task = null;
  let activity = taskOrActivity || 'Running task';
  if (taskOrActivity && /^TASK-\d+/i.test(taskOrActivity)) {
    task = taskOrActivity.toUpperCase();
    activity = activityArg || `Working on ${task}`;
  } else if (activityArg) {
    activity = `${taskOrActivity}: ${activityArg}`;
  }

  const updated = updateAgentPresence(agent, {
    status: 'RUNNING',
    currentTask: task,
    activity
  });
  console.log(`🟡 ${agent} marked RUNNING: ${updated.activity}${task ? ` (${task})` : ''}`);
}

function cmdIdle(agentArg, activityArg) {
  enforceNotCancelled();
  if (!agentArg) {
    console.error('Error: idle requires <agentName> [activity]');
    process.exit(1);
  }
  const agent = normalizeAgentName(agentArg);
  const updated = updateAgentPresence(agent, {
    status: 'IDLE',
    currentTask: null,
    activity: activityArg || 'Standing by in workspace'
  });
  console.log(`🟢 ${agent} marked IDLE: ${updated.activity}`);
}

function cmdOffline(agentArg, flags = {}) {
  if (!agentArg) {
    console.error('Error: offline requires <agentName>');
    process.exit(1);
  }
  const agent = normalizeAgentName(agentArg);
  const isCredit = flags.reason && CREDIT_ERROR_REGEX.test(flags.reason);
  updateAgentPresence(agent, {
    status: isCredit ? 'CREDIT_EXHAUSTED' : 'OFFLINE',
    assembled: false,
    currentTask: isCredit ? undefined : null,
    activity: flags.reason || 'Signed off from session'
  });
  console.log(`${isCredit ? '🔴' : '⚪'} ${agent} marked ${isCredit ? 'CREDIT_EXHAUSTED' : 'OFFLINE'}`);
}

function cmdWait(flags, positional) {
  enforceNotCancelled(flags);
  let targetAgent = flags.for || flags.agent || positional[1] || 'Copilot';
  targetAgent = normalizeAgentName(targetAgent);

  const timeoutSec = parseInt(flags.timeout || '60', 10);
  const targetStatus = flags.status ? flags.status.toUpperCase() : null;
  const watchMsg = flags['watch-msg'] || flags.msg;
  const startTime = Date.now();
  const initialMsgCount = parseMessages(readFileSafe(COMM_PATH)).length;

  console.log(`[Watcher] Waiting for ${targetAgent}... (Timeout: ${timeoutSec}s)`);

  function checkEvent() {
    const state = getCombinedAgentStatuses();
    if (state.sessionCancelled) {
      return {
        type: 'SESSION_CANCELLED',
        detail: 'Session cancelled by user — aborting wait.'
      };
    }
    if (state.sessionCompleted) {
      return {
        type: 'SESSION_COMPLETED',
        detail: 'Main sent final_summary report — session is complete. You may now sign off (node scripts/hub.js offline)!'
      };
    }
    const agentData = state.agents[targetAgent];
    if (agentData) {
      if (agentData.status === 'CREDIT_EXHAUSTED') {
        return {
          type: 'CREDIT_EXHAUSTED',
          detail: `🚨 ${targetAgent} hit credit/quota exhaustion: ${agentData.activity}`
        };
      }
      if (targetStatus && agentData.status === targetStatus) {
        return {
          type: 'STATUS_MATCH',
          detail: `${targetAgent} is ${agentData.status} (${agentData.activity})`
        };
      }
    }

    if (fs.existsSync(COMM_PATH)) {
      const comm = readFileSafe(COMM_PATH);
      const messages = parseMessages(comm);

      if (watchMsg) {
        const cleanMsg = watchMsg.toUpperCase();
        const found = messages.find(m => m.id === cleanMsg);
        if (found && found.readBy && found.readBy.toLowerCase().includes(targetAgent.toLowerCase())) {
          return {
            type: 'READ_RECEIPT',
            detail: `${targetAgent} confirmed read on ${cleanMsg} (✓:${found.readBy})`
          };
        }
      }

      if (messages.length > initialMsgCount) {
        const latest = messages[messages.length - 1];
        if (latest.from.toLowerCase() === targetAgent.toLowerCase()) {
          return {
            type: 'NEW_MESSAGE',
            detail: `${targetAgent} posted ${latest.id}: "${latest.subject}"\n${latest.body || ''}`
          };
        }
      }
    }

    return null;
  }

  const init = checkEvent();
  if (init) {
    if (init.type === 'SESSION_CANCELLED') {
      console.log(`\n⛔ [${init.type}] ${init.detail}`);
      process.exit(4);
    }
    console.log(`\n🎉 [${init.type}] ${init.detail}`);
    return;
  }

  const interval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const ev = checkEvent();
    if (ev) {
      clearInterval(interval);
      if (ev.type === 'SESSION_CANCELLED') {
        console.log(`\n⛔ [${ev.type}] ${ev.detail}`);
        process.exit(4);
      }
      console.log(`\n🎉 [${ev.type}] ${ev.detail}`);
      process.exit(ev.type === 'CREDIT_EXHAUSTED' ? 3 : 0);
    }
    if (elapsed >= timeoutSec) {
      clearInterval(interval);
      console.log(`\n⏰ [Timeout] ${timeoutSec}s elapsed without event from ${targetAgent}.`);
      process.exit(1);
    }
  }, 2000);
}

// ============================================================
// 💬 COMPACT MESSAGE READ RECEIPTS
// ============================================================

function getUnreadMessages(agentFormatted) {
  const comm = readFileSafe(COMM_PATH);
  const messages = parseMessages(comm);
  const unread = [];
  const agentLower = normalizeAgentName(agentFormatted).toLowerCase();

  for (const msg of messages) {
    const fromLower = msg.from.toLowerCase();
    const toLower = msg.to.toLowerCase();
    const readByLower = (msg.readBy || '').toLowerCase();

    if (fromLower === agentLower) continue;
    const addressedToAgent = toLower === agentLower || toLower === '@all' || toLower === 'all';
    if (!addressedToAgent) continue;

    if (!readByLower.includes(agentLower)) {
      unread.push(msg);
    }
  }
  return unread;
}

function confirmMessageRead(comm, msgId, agentFormatted, note) {
  const agent = normalizeAgentName(agentFormatted);
  const msgRegex = new RegExp(`(### (?:💬 )?\`${msgId}\`[\\s\\S]*?)(?=\\n### (?:💬 )?\`MSG-|$)`);
  const match = comm.match(msgRegex);
  if (!match) {
    return { success: false, reason: `Message ${msgId} not found` };
  }

  let block = match[0];
  const lines = block.split('\n');
  const header = lines[0];

  // Check if compact header
  if (header.includes('->') && !block.includes('- **From:**')) {
    if (header.toLowerCase().includes(`✓:`) && header.split('✓:')[1].toLowerCase().includes(agent.toLowerCase())) {
      return { success: false, alreadyRead: true, msgId };
    }
    if (header.includes('✓:')) {
      lines[0] = `${header},${agent}`;
    } else {
      lines[0] = `${header} ✓:${agent}`;
    }
    const updatedComm = comm.replace(block, lines.join('\n'));
    return { success: true, updatedComm, msgId, agent, note: note || '✓' };
  }

  // Legacy verbose fallback
  const receipt = `\`${agent}\` (${getShortTime()})`;
  const readByRegex = /- \*\*Read By:\*\*\s*([^\n]*)/;
  const readByMatch = block.match(readByRegex);
  if (readByMatch) {
    const existing = readByMatch[1].trim();
    if (existing.toLowerCase().includes(agent.toLowerCase())) {
      return { success: false, alreadyRead: true, msgId };
    }
    const newReadBy = (!existing || existing === '(none)')
      ? `- **Read By:** ${receipt}`
      : `- **Read By:** ${existing}, ${receipt}`;
    block = block.replace(readByRegex, newReadBy);
  } else {
    block += `\n- **Read By:** ${receipt}\n`;
  }
  return { success: true, updatedComm: comm.replace(match[0], block), msgId, agent, note: note || '✓' };
}

function cmdRead(targetArg, agentArg, noteArg) {
  enforceNotCancelled();
  let target = targetArg;
  let agent = agentArg;
  const note = noteArg;

  if (target && target.startsWith('@') && agent && (agent.toUpperCase().startsWith('MSG-') || agent.toLowerCase() === 'all' || /^\d+$/.test(agent))) {
    const tmp = target;
    target = agent;
    agent = tmp;
  }

  if (!target || !agent) {
    console.error('Usage: node scripts/hub.js read <MSG-ID|all> <agentName>');
    process.exit(1);
  }

  const agentFormatted = normalizeAgentName(agent);
  let comm = readFileSafe(COMM_PATH);
  if (!comm) process.exit(1);

  if (target.toLowerCase() === 'all' || target === '--all') {
    const unread = getUnreadMessages(agentFormatted);
    if (unread.length === 0) {
      console.log(`✨ No unread messages for ${agentFormatted}.`);
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
      writeFileRetrySync(COMM_PATH, comm, 'utf8');
      updateAgentPresence(agentFormatted, { activity: `Read ${confirmedIds.join(', ')}` });
      cmdLogInternal(agentFormatted, `Read ${confirmedIds.join(', ')}`, 'AGENT_COMMUNICATION.md');
      console.log(`🫡 Marked read (${confirmedIds.join(', ')}) by ${agentFormatted}`);
    }
    return;
  }

  let cleanId = target.replace(/[`\s]/g, '').toUpperCase();
  if (/^\d+$/.test(cleanId)) {
    cleanId = `MSG-${String(parseInt(cleanId, 10)).padStart(3, '0')}`;
  }

  const res = confirmMessageRead(comm, cleanId, agentFormatted, note);
  if (res.alreadyRead) {
    console.log(`ℹ️ ${cleanId} already read by ${agentFormatted}.`);
    return;
  }
  if (!res.success) {
    console.error(`Error: ${res.reason}`);
    process.exit(1);
  }

  writeFileRetrySync(COMM_PATH, res.updatedComm, 'utf8');
  updateAgentPresence(agentFormatted, { activity: `Read ${cleanId}` });
  cmdLogInternal(agentFormatted, `Read ${cleanId}`, 'AGENT_COMMUNICATION.md');
  console.log(`🫡 Marked ${cleanId} read by ${agentFormatted}`);
}

function cmdUnread(agentName) {
  enforceNotCancelled();
  if (!agentName) {
    console.error('Usage: node scripts/hub.js unread "@Agent"');
    process.exit(1);
  }
  const agentFormatted = normalizeAgentName(agentName);
  const unread = getUnreadMessages(agentFormatted);

  console.log(`📬 UNREAD MESSAGES FOR ${agentFormatted} (${unread.length}):`);
  if (unread.length === 0) {
    console.log('  ✨ All caught up!');
  } else {
    for (const m of unread) {
      console.log(`  • ${m.id} [${m.dateTime}] ${m.from} -> ${m.to} [${m.type}] · ${m.subject}`);
      if (m.body) console.log(`    ${m.body}`);
    }
  }
}

// ============================================================
// 📦 SESSION ARCHIVING & COMPACT TEMPLATES
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
  return { focus: firstLine.slice(0, 40), summary: userText.slice(0, 160).replace(/\s+/g, ' ') };
}

function countTaskStats() {
  const tasks = readFileSafe(TASKS_PATH);
  const completed = (tasks.match(/(\[DONE\]|- \*\*Status:\*\* `\[DONE\]`)/g) || []).length;
  const inProgress = (tasks.match(/(\[IN PROGRESS\]|- \*\*Status:\*\* `\[IN PROGRESS\]`)/g) || []).length;
  const ready = (tasks.match(/(\[READY\]|- \*\*Status:\*\* `\[READY\]`)/g) || []).length;
  return { completed, inProgress, ready, total: completed + inProgress + ready };
}

function countMessageStats() {
  const comm = readFileSafe(COMM_PATH);
  return (comm.match(/### (?:💬 )?`MSG-\d+`/g) || []).length;
}

function resetToFreshSession(newSessionTitle) {
  const timestamp = getTimestamp();
  const shortTime = getShortTime();
  const sessionName = newSessionTitle || 'New Collaboration';

  const freshInbox = `# 📥 User Inbox

> Write your prompt, role assignments, and participating agents casually below.
> Type \`/assemble\` in each participating agent's window to start.

---

<!-- WRITE CASUALLY BELOW THIS LINE -->

`;

  const freshTasks = `# 📋 Multi-Agent Task Board

> Compact Format: \`### \`TASK-ID\` [STATUS] @Agent · Title (Locks: \`file1\`, \`file2\`)\`
> Do NOT edit files outside \`vibe coding tools\` until all participants are online and the user approves the plan in the AIvengers tab.

---

## 🏃 Active Tasks (\`[IN PROGRESS]\`)

*(No active tasks currently claimed)*

## 🎯 Ready for Work (\`[READY]\`)

### \`TASK-001\` [READY] @Unassigned · Team Assembly & Shared Plan (Locks: none)
Read \`USER_INBOX.md\`, wait for all participants, formulate team plan, and submit to user in the AIvengers tab for approval.

## 🗄️ Backlog (\`[BACKLOG]\`)

## ✅ Completed Tasks (\`[DONE]\`)
`;

  const freshComm = `# 💬 Agent Communication Board

> Compact Format: \`### \`MSG-ID\` [HH:MM] @From -> @To [TYPE] · Subject ✓:@Reader\`

---

## 🧵 Messages

### \`MSG-001\` [${shortTime}] @System -> @All [INFO] · Session "${sessionName}" initialized
Check \`USER_INBOX.md\`, wait for all participants to come online, agree on a plan, and have Main submit it in the AIvengers tab for user approval.
`;

  const freshLog = `# 📜 Activity Log

- \`${timestamp}\` **@System** Initialized session: ${sessionName}
`;

  let state = readFileSafe(STATE_PATH);
  if (!state) {
    state = `# 🧭 Project State\n\n- **Session:** ${sessionName}\n- **Updated:** ${timestamp}\n`;
  }

  const freshPresence = defaultPresenceObject(sessionName);

  const freshFeed = {
    updatedAt: timestamp,
    items: []
  };

  fs.writeFileSync(INBOX_PATH, freshInbox, 'utf8');
  fs.writeFileSync(TASKS_PATH, freshTasks, 'utf8');
  fs.writeFileSync(COMM_PATH, freshComm, 'utf8');
  fs.writeFileSync(LOG_PATH, freshLog, 'utf8');
  fs.writeFileSync(STATE_PATH, state, 'utf8');
  fs.writeFileSync(PRESENCE_PATH, JSON.stringify(freshPresence, null, 2) + '\n', 'utf8');
  fs.writeFileSync(FEED_PATH, JSON.stringify(freshFeed, null, 2) + '\n', 'utf8');
}

function isGenericSessionTitle(title) {
  return !title || [
    'New Collaboration',
    'New Collaboration Session',
    'Vibe Session',
    'Collaboration Session',
    'session',
  ].includes(String(title).trim());
}

function deriveTitleFromCurrentSession(feed, inboxText) {
  const promptItem = (feed.items || []).find((i) => i && i.kind === 'user_prompt' && i.prompt);
  if (promptItem && promptItem.prompt) {
    const firstLine = String(promptItem.prompt).split('\n').map((l) => l.trim()).find(Boolean);
    if (firstLine) return firstLine.slice(0, 48);
  }
  const promptMatch = String(inboxText || '').match(/##\s*Prompt\s*\n+([^\n]+)/i);
  if (promptMatch && promptMatch[1]) {
    const clean = promptMatch[1].trim();
    if (clean && clean !== '(No prompt text provided)') return clean.slice(0, 48);
  }
  return extractSessionSummary().focus || 'Collaboration Session';
}

function syncCurrentSessionToArchive(customTitle, slotsOverride) {
  const presence = loadPresence();
  const feed = loadFeed();
  const inbox = getCasualInboxText();
  if (slotsOverride !== undefined) {
    presence.savedSlots = slotsOverride;
  }

  const hasContent =
    (Array.isArray(feed.items) && feed.items.length > 0) ||
    (inbox && inbox !== '(USER_INBOX.md is empty)' && inbox.trim().length > 0);
  const existingFolderPath = presence.sessionFolder ? path.join(ARCHIVES_DIR, presence.sessionFolder) : '';
  const folderExists = Boolean(existingFolderPath && fs.existsSync(existingFolderPath));

  if (!hasContent && !folderExists) {
    return null;
  }

  let title = customTitle || presence.sessionTitle;
  if (!customTitle && isGenericSessionTitle(title)) {
    title = deriveTitleFromCurrentSession(feed, inbox);
  }
  const timeId = getFileSafeTimestamp();
  const folderName = presence.sessionFolder || `${timeId}_${sanitizeName(title)}`;

  presence.sessionFolder = folderName;
  presence.sessionTitle = title || 'Collaboration Session';
  savePresence(presence);

  if (!fs.existsSync(ARCHIVES_DIR)) {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  }
  const targetDir = path.join(ARCHIVES_DIR, folderName);
  fs.mkdirSync(targetDir, { recursive: true });

  const copiedFiles = [];
  COLLAB_FILES.forEach((file) => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, file));
      copiedFiles.push(file);
    }
  });

  if (fs.existsSync(DECISIONS_PATH)) {
    fs.copyFileSync(DECISIONS_PATH, path.join(targetDir, 'DECISIONS.snapshot.md'));
  }

  const taskStats = countTaskStats();
  const messageCount = countMessageStats();
  const nowIso = new Date().toISOString();
  const meta = {
    id: presence.sessionId || `session-${folderName}`,
    name: sanitizeName(presence.sessionTitle),
    title: presence.sessionTitle,
    folder: folderName,
    updatedAt: getTimestamp(),
    updatedAtIso: nowIso,
    archivedAt: getTimestamp(),
    mainAgent: presence.mainAgent || null,
    participants: Array.isArray(presence.expectedParticipants) ? presence.expectedParticipants : [],
    agentModels: presence.agentModels || {},
    savedSlots: presence.savedSlots || null,
    sessionCancelled: Boolean(presence.sessionCancelled),
    summary: extractSessionSummary().summary,
    feedCount: Array.isArray(feed.items) ? feed.items.length : 0,
    stats: {
      tasksCompleted: taskStats.completed,
      tasksInProgress: taskStats.inProgress,
      tasksReady: taskStats.ready,
      messages: messageCount
    },
    files: copiedFiles
  };

  fs.writeFileSync(path.join(targetDir, 'session.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return meta;
}

function getArchiveFolderList() {
  if (!fs.existsSync(ARCHIVES_DIR)) return [];
  return fs.readdirSync(ARCHIVES_DIR)
    .filter((name) => {
      const fullPath = path.join(ARCHIVES_DIR, name);
      try {
        return fs.statSync(fullPath).isDirectory() && !name.startsWith('.') && !name.startsWith('_stash_');
      } catch {
        return false;
      }
    });
}

function readSessionMetaFromFolder(folderName, activeFolder) {
  const folderPath = path.join(ARCHIVES_DIR, folderName);
  let meta = {};
  const metaPath = path.join(folderPath, 'session.json');
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
    } catch {}
  }

  let folderPresence = {};
  const presPath = path.join(folderPath, 'AGENT_PRESENCE.json');
  if (fs.existsSync(presPath)) {
    try {
      folderPresence = JSON.parse(fs.readFileSync(presPath, 'utf8')) || {};
    } catch {}
  }

  let folderFeed = { items: [] };
  const feedPath = path.join(folderPath, 'VIBE_FEED.json');
  if (fs.existsSync(feedPath)) {
    try {
      folderFeed = JSON.parse(fs.readFileSync(feedPath, 'utf8')) || { items: [] };
    } catch {}
  }

  const stat = fs.statSync(folderPath);
  const updatedAtIso = meta.updatedAtIso || folderFeed.updatedAt || stat.mtime.toISOString();
  return {
    id: meta.id || folderPresence.sessionId || `session-${folderName}`,
    folder: folderName,
    title: meta.title || folderPresence.sessionTitle || folderName,
    updatedAt: meta.updatedAt || meta.archivedAt || folderPresence.updatedAt || '',
    updatedAtIso,
    mainAgent: meta.mainAgent !== undefined ? meta.mainAgent : (folderPresence.mainAgent || null),
    participants: Array.isArray(meta.participants)
      ? meta.participants
      : (Array.isArray(folderPresence.expectedParticipants) ? folderPresence.expectedParticipants : []),
    agentModels: meta.agentModels || folderPresence.agentModels || {},
    savedSlots: meta.savedSlots || folderPresence.savedSlots || null,
    sessionCancelled: meta.sessionCancelled !== undefined ? meta.sessionCancelled : Boolean(folderPresence.sessionCancelled),
    summary: meta.summary || '',
    feedCount: meta.feedCount !== undefined ? meta.feedCount : (Array.isArray(folderFeed.items) ? folderFeed.items.length : 0),
    stats: meta.stats || { tasksCompleted: 0, tasksInProgress: 0, tasksReady: 0, messages: 0 },
    isActive: Boolean(activeFolder && folderName === activeFolder)
  };
}

function listSavedSessions() {
  syncCurrentSessionToArchive();
  const presence = loadPresence();
  const folders = getArchiveFolderList();
  const items = folders.map((f) => readSessionMetaFromFolder(f, presence.sessionFolder));
  items.sort((a, b) => {
    const tA = Date.parse(a.updatedAtIso || '') || 0;
    const tB = Date.parse(b.updatedAtIso || '') || 0;
    if (tB !== tA) return tB - tA;
    return b.folder.localeCompare(a.folder);
  });
  return items;
}

function resolveArchiveFolder(targetArg) {
  const entries = getArchiveFolderList().sort().reverse();
  if (!targetArg) return null;
  const numericIndex = parseInt(targetArg, 10);
  if (!isNaN(numericIndex) && String(numericIndex) === String(targetArg).trim() && numericIndex >= 1 && numericIndex <= entries.length) {
    return entries[numericIndex - 1];
  }
  const exact = entries.find((e) => e === targetArg);
  if (exact) return exact;
  for (const folder of entries) {
    const meta = readSessionMetaFromFolder(folder, null);
    if (meta.id === targetArg) return folder;
  }
  return entries.find((e) => e.toLowerCase().includes(String(targetArg).toLowerCase())) || null;
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

  const copiedFiles = [];
  COLLAB_FILES.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, file));
      copiedFiles.push(file);
    }
  });

  if (fs.existsSync(DECISIONS_PATH)) {
    fs.copyFileSync(DECISIONS_PATH, path.join(targetDir, 'DECISIONS.snapshot.md'));
  }

  const taskStats = countTaskStats();
  const messageCount = countMessageStats();
  const presence = loadPresence();
  const feed = loadFeed();

  const meta = {
    id: `session-${timeId}`,
    name: cleanName,
    title: sessionNameArg || presence.sessionTitle || focus,
    folder: folderName,
    updatedAt: getTimestamp(),
    updatedAtIso: new Date().toISOString(),
    archivedAt: getTimestamp(),
    archivedBy: flags.agent || '@User',
    mainAgent: presence.mainAgent || null,
    participants: presence.expectedParticipants || [],
    agentModels: presence.agentModels || {},
    savedSlots: presence.savedSlots || null,
    summary,
    feedCount: Array.isArray(feed.items) ? feed.items.length : 0,
    stats: {
      tasksCompleted: taskStats.completed,
      tasksInProgress: taskStats.inProgress,
      tasksReady: taskStats.ready,
      messages: messageCount
    },
    files: copiedFiles
  };

  fs.writeFileSync(path.join(targetDir, 'session.json'), JSON.stringify(meta, null, 2), 'utf8');

  const archiveReadme = `# 📦 Archived Session: ${meta.title}

- **Folder:** \`${folderName}\`
- **Archived At:** ${meta.archivedAt}
- **Summary:** ${summary}
- **Stats:** ${taskStats.completed} done, ${taskStats.inProgress} active, ${messageCount} msgs.
`;
  fs.writeFileSync(path.join(targetDir, 'README.md'), archiveReadme, 'utf8');

  cmdLogInternal(meta.archivedBy, `Archived session to ${folderName}`, copiedFiles.join(', '));
  if (!flags.json) {
    console.log(`📦 Archived session to archives/${folderName}`);
  }

  if (flags.new) {
    resetToFreshSession(typeof flags.new === 'string' ? flags.new : undefined);
    if (!flags.json) {
      console.log(`✨ Workspace reset to fresh compact templates.`);
    }
  }
  return folderName;
}

function cmdArchiveList(flags = {}) {
  const sessions = listSavedSessions();
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, sessions }, null, 2));
    return;
  }
  console.log(`🗃️ SAVED COLLABORATION SESSIONS (${sessions.length}):`);
  sessions.forEach((s, idx) => {
    const activeMark = s.isActive ? ' [ACTIVE]' : '';
    console.log(`  [${idx + 1}] ${s.title}${activeMark} (${s.folder})`);
  });
}

function cmdSessionSwitch(targetArg, flags = {}) {
  if (!fs.existsSync(ARCHIVES_DIR)) {
    console.error('Error: archives/ directory does not exist.');
    process.exit(1);
  }
  syncCurrentSessionToArchive();
  const selectedFolder = resolveArchiveFolder(targetArg);
  if (!selectedFolder) {
    console.error(`Error: Session '${targetArg}' not found.`);
    process.exit(1);
  }

  const sourceDir = path.join(ARCHIVES_DIR, selectedFolder);
  COLLAB_FILES.forEach((file) => {
    const src = path.join(sourceDir, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ROOT_DIR, file));
  });

  const meta = readSessionMetaFromFolder(selectedFolder, selectedFolder);
  const restoredPresence = loadPresence();
  restoredPresence.sessionFolder = selectedFolder;
  restoredPresence.sessionTitle = meta.title || restoredPresence.sessionTitle || selectedFolder;
  if (meta.savedSlots && !restoredPresence.savedSlots) {
    restoredPresence.savedSlots = meta.savedSlots;
  }
  savePresence(restoredPresence);
  cmdLogInternal('@System', `Switched to session ${selectedFolder}`, COLLAB_FILES.join(', '));

  if (flags.json) {
    console.log(JSON.stringify({ ok: true, session: meta, presence: loadPresence(), feed: loadFeed() }, null, 2));
  } else {
    console.log(`🔄 Switched to session ${selectedFolder} ("${restoredPresence.sessionTitle}")`);
  }
}

function cmdSessionRename(targetArg, newTitle, flags = {}) {
  if (!targetArg || !newTitle) {
    console.error('Usage: node scripts/hub.js session rename <folder> <newTitle>');
    process.exit(1);
  }
  const selectedFolder = resolveArchiveFolder(targetArg);
  if (!selectedFolder) {
    console.error(`Error: Session '${targetArg}' not found.`);
    process.exit(1);
  }
  const folderPath = path.join(ARCHIVES_DIR, selectedFolder);
  const metaPath = path.join(folderPath, 'session.json');
  const existing = readSessionMetaFromFolder(selectedFolder, null);
  const cleanTitle = String(newTitle).trim();
  const updatedMeta = { ...existing, title: cleanTitle, updatedAt: getTimestamp(), updatedAtIso: new Date().toISOString() };
  fs.writeFileSync(metaPath, JSON.stringify(updatedMeta, null, 2) + '\n', 'utf8');

  const currentPresence = loadPresence();
  if (currentPresence.sessionFolder === selectedFolder) {
    currentPresence.sessionTitle = cleanTitle;
    savePresence(currentPresence);
    const archivedPresPath = path.join(folderPath, 'AGENT_PRESENCE.json');
    if (fs.existsSync(archivedPresPath)) {
      fs.writeFileSync(archivedPresPath, JSON.stringify(currentPresence, null, 2) + '\n', 'utf8');
    }
  }
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, folder: selectedFolder, title: cleanTitle }, null, 2));
  } else {
    console.log(`✏️ Renamed session ${selectedFolder} to "${cleanTitle}"`);
  }
}

function cmdSessionDelete(targetArg, flags = {}) {
  if (!targetArg) {
    console.error('Usage: node scripts/hub.js session delete <folder>');
    process.exit(1);
  }
  const selectedFolder = resolveArchiveFolder(targetArg);
  if (!selectedFolder) {
    console.error(`Error: Session '${targetArg}' not found.`);
    process.exit(1);
  }
  const currentPresence = loadPresence();
  const wasActive = currentPresence.sessionFolder === selectedFolder;
  fs.rmSync(path.join(ARCHIVES_DIR, selectedFolder), { recursive: true, force: true });
  if (wasActive) {
    resetToFreshSession('New Collaboration');
  }
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, deleted: selectedFolder, resetActive: wasActive }, null, 2));
  } else {
    console.log(`🗑️ Deleted saved session ${selectedFolder}`);
  }
}

function cmdSessionNew(titleArg, flags = {}) {
  syncCurrentSessionToArchive();
  const cleanTitle = titleArg || flags.title || 'New Collaboration';
  resetToFreshSession(cleanTitle);
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, presence: loadPresence(), feed: loadFeed() }, null, 2));
  } else {
    console.log(`✨ Started new collaboration session: "${cleanTitle}"`);
  }
}

function cmdArchiveResume(targetArg, flags = {}) {
  if (!targetArg) {
    cmdArchiveList(flags);
    return;
  }
  cmdSessionSwitch(targetArg, flags);
}

function handleArchive(args, flags) {
  const sub = args[1] ? args[1].toLowerCase() : 'list';
  const target = flags.folder || flags.id || args[2];
  if (sub === 'save') return cmdArchiveSave(target, flags);
  if (sub === 'list') return cmdArchiveList(flags);
  if (sub === 'switch' || sub === 'resume' || sub === 'restore' || sub === 'open') {
    return cmdSessionSwitch(target, flags);
  }
  if (sub === 'rename') {
    const newTitle = flags.title || args.slice(3).join(' ');
    return cmdSessionRename(target, newTitle, flags);
  }
  if (sub === 'delete' || sub === 'remove' || sub === 'rm') {
    return cmdSessionDelete(target, flags);
  }
  if (sub === 'new') {
    if (args[0] && args[0].toLowerCase() === 'session') {
      return cmdSessionNew(target, flags);
    }
    flags.new = target || true;
    return cmdArchiveSave(undefined, flags);
  }
  console.log(`Valid session/archive subcommands: list, save, switch, rename, delete, new`);
}

// ============================================================
// 📰 AIVENGERS TAB FEED (VIBE_FEED.json)
// ============================================================

function loadFeed() {
  if (fs.existsSync(FEED_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(FEED_PATH, 'utf8'));
      if (data && Array.isArray(data.items)) {
        return data;
      }
    } catch {}
  }
  return {
    updatedAt: getTimestamp(),
    items: []
  };
}

function saveFeed(feed) {
  feed.updatedAt = getTimestamp();
  try {
    writeFileRetrySync(FEED_PATH, JSON.stringify(feed, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error(`Error saving ${FEED_PATH}:`, err.message);
  }
}

function getNextFeedItemId(feed) {
  let maxNum = 0;
  for (const item of feed.items || []) {
    if (item && typeof item.id === 'string') {
      const m = item.id.match(/^ITEM-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
  }
  return `ITEM-${String(maxNum + 1).padStart(3, '0')}`;
}

function appendFeedItem(item) {
  const feed = loadFeed();
  const id = getNextFeedItemId(feed);
  const entry = {
    id,
    timestamp: getTimestamp(),
    timestampIso: new Date().toISOString(),
    ...item
  };
  feed.items.push(entry);
  saveFeed(feed);
  return entry;
}

function parseListOptionInput(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  const str = String(raw).trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
    } catch {}
  }
  const sep = str.includes('|') ? '|' : ',';
  return str.split(sep).map(s => s.trim()).filter(Boolean);
}

function isOthersOption(optText) {
  if (!optText) return false;
  const normalized = String(optText).trim().toLowerCase();
  return (
    normalized === 'other' ||
    normalized === 'others' ||
    normalized.startsWith('others (') ||
    normalized.startsWith('other (') ||
    /^\d+\.\s*others?\b/i.test(normalized)
  );
}

function waitForFeedReply(itemId, timeoutSeconds = 1800) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutSeconds * 1000;
    const check = () => {
      const presence = loadPresence();
      const feed = loadFeed();
      const item = (feed.items || []).find(i => i.id === itemId);
      if (presence.sessionCancelled || (item && item.status === 'cancelled')) {
        return {
          status: 'cancelled',
          item_id: itemId,
          agent_name: item ? item.agent : undefined,
          answer: 'Session cancelled by user',
          selected_options: [],
          timestamp: presence.cancelledAtIso || new Date().toISOString()
        };
      }
      if (item && item.status === 'answered' && item.reply) {
        const selectedOptions = Array.isArray(item.reply.selectedOptions) ? item.reply.selectedOptions : [];
        const answer = item.reply.answer || '';
        return {
          status: item.kind === 'poll' && selectedOptions.length > 0 && !answer
            ? 'answered_via_poll'
            : 'answered_via_message',
          item_id: item.id,
          agent_name: item.agent,
          answer,
          selected_options: selectedOptions,
          timestamp: item.reply.timestamp || item.answeredAtIso || new Date().toISOString()
        };
      }
      return null;
    };

    const immediate = check();
    if (immediate) return resolve(immediate);

    const timer = setInterval(() => {
      const found = check();
      if (found) {
        clearInterval(timer);
        resolve(found);
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(timer);
        resolve({
          status: 'timeout',
          item_id: itemId,
          waited_seconds: timeoutSeconds,
          hint: `User has not replied yet. Use \`node scripts/hub.js reply --id ${itemId}\` or reply in the Vibe Coding tab.`
        });
      }
    }, 1000);
  });
}

function cmdDispatch(flags = {}) {
  const promptText = flags['prompt-file']
    ? readFileSafe(path.resolve(flags['prompt-file'])).trim()
    : String(flags.prompt || '').trim();

  const rawAgents = parseListOptionInput(flags.agents);
  const rawMain = flags.main || rawAgents[0];
  if (!rawMain) {
    console.error('Error: Slot 1 (Main agent) must be selected.');
    process.exit(1);
  }
  const mainAgent = normalizeAgentName(rawMain);

  const orderedSet = new Set([mainAgent]);
  for (const a of rawAgents) {
    orderedSet.add(normalizeAgentName(a));
  }
  const participants = Array.from(orderedSet);

  const parsedModels = {};
  if (flags.models) {
    try {
      const rawModels = typeof flags.models === 'string' ? JSON.parse(flags.models) : flags.models;
      if (rawModels && typeof rawModels === 'object') {
        for (const [agentKey, modelVal] of Object.entries(rawModels)) {
          const normKey = normalizeAgentName(agentKey);
          if (typeof modelVal === 'string') {
            parsedModels[normKey] = modelVal;
          } else if (modelVal && typeof modelVal === 'object') {
            parsedModels[normKey] = modelVal.label || modelVal.id || '';
          }
        }
      }
    } catch {}
  }

  let parsedAttachments = [];
  if (flags.attachments) {
    try {
      const rawAtt = typeof flags.attachments === 'string' ? JSON.parse(flags.attachments) : flags.attachments;
      if (Array.isArray(rawAtt)) {
        parsedAttachments = rawAtt
          .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
              const clean = item.trim();
              if (!clean) return null;
              let isDir = false;
              try {
                isDir = fs.existsSync(clean) && fs.statSync(clean).isDirectory();
              } catch {}
              return { path: clean, name: path.basename(clean) || clean, isDirectory: isDir };
            }
            if (typeof item === 'object' && item.path) {
              return {
                path: String(item.path),
                name: String(item.name || path.basename(String(item.path)) || item.path),
                isDirectory: Boolean(item.isDirectory)
              };
            }
            return null;
          })
          .filter(Boolean);
      }
    } catch {}
  }

  let parsedSlots;
  if (flags.slots) {
    try {
      const rawSlots = typeof flags.slots === 'string' ? JSON.parse(flags.slots) : flags.slots;
      if (Array.isArray(rawSlots)) parsedSlots = rawSlots;
    } catch {}
  }

  let parsedSlotMetaInput = {};
  const rawSlotMetaFlag = flags['slot-meta'] || flags.slotMeta;
  if (rawSlotMetaFlag) {
    try {
      const rawMetaObj = typeof rawSlotMetaFlag === 'string' ? JSON.parse(rawSlotMetaFlag) : rawSlotMetaFlag;
      if (rawMetaObj && typeof rawMetaObj === 'object' && !Array.isArray(rawMetaObj)) {
        parsedSlotMetaInput = rawMetaObj;
      }
    } catch {}
  }

  const normalizedSlotMeta = {};
  for (const [k, val] of Object.entries(parsedSlotMetaInput)) {
    if (!val || typeof val !== 'object') continue;
    const normTag = normalizeAgentName(val.tag || k);
    normalizedSlotMeta[normTag] = {
      tag: normTag,
      providerTag: val.providerTag || getBaseProviderTag(normTag),
      modelId: val.modelId || 'auto',
      modelLabel: val.modelLabel || parsedModels[normTag] || '',
      displayName: val.displayName || val.modelLabel || parsedModels[normTag] || normTag.replace(/^@/, ''),
      roleIds: Array.isArray(val.roleIds) ? val.roleIds : [],
      roleSummary: val.roleSummary || '',
      mixedColor: val.mixedColor || '#64748B',
      textColor: val.textColor || (roleDefs ? roleDefs.getContrastingTextColor(val.mixedColor || '#64748B') : '#FFFFFF'),
      writePermission: val.writePermission || 'code-write',
      hubEscalation: val.hubEscalation || 'direct-user-access',
      slotIndex: typeof val.slotIndex === 'number' ? val.slotIndex : 0
    };
  }

  participants.forEach((p, idx) => {
    if (!normalizedSlotMeta[p]) {
      const slotGuess = Array.isArray(parsedSlots)
        ? (parsedSlots.find((s) => s && normalizeAgentName(s.participantTag || '') === p) || parsedSlots[idx] || null)
        : null;
      const roleInput = slotGuess
        ? (Array.isArray(slotGuess.roleIds) ? slotGuess.roleIds : (slotGuess.roleId ? [slotGuess.roleId] : undefined))
        : undefined;
      const profile = roleDefs ? roleDefs.resolveEffectiveSlotProfile(roleInput, idx === 0) : null;
      const modelLabel = parsedModels[p] || (slotGuess && (slotGuess.modelLabel || slotGuess.modelId)) || '';
      const providerTag = getBaseProviderTag(p);
      const displayName = modelLabel || providerTag.replace(/^@/, '');
      const mixedColor = (profile && profile.mixedColor) || '#64748B';
      normalizedSlotMeta[p] = {
        tag: p,
        providerTag,
        modelId: (slotGuess && slotGuess.modelId) || 'auto',
        modelLabel,
        displayName,
        roleIds: profile ? profile.roleIds : [],
        roleSummary: profile ? profile.roleSummary : '',
        mixedColor,
        textColor: profile ? profile.textColor : '#FFFFFF',
        writePermission: profile ? profile.effectiveWritePermission : 'code-write',
        hubEscalation: profile ? profile.effectiveHubEscalation : 'direct-user-access',
        slotIndex: idx
      };
    }
    if (!parsedModels[p] && normalizedSlotMeta[p].displayName) {
      parsedModels[p] = normalizedSlotMeta[p].displayName;
    }
  });

  const presence = loadPresence();
  const existingFeed = loadFeed();
  let existingMessages = Array.isArray(presence.sessionMessages) ? [...presence.sessionMessages] : [];
  if (existingMessages.length === 0) {
    const priorPrompts = (existingFeed.items || []).filter((i) => i && i.kind === 'user_prompt');
    existingMessages = priorPrompts.map((p, idx) => ({
      number: p.messageNumber || (idx + 1),
      timestamp: p.timestamp || getTimestamp(),
      timestampIso: p.timestampIso || new Date().toISOString(),
      prompt: p.prompt || '',
      attachments: Array.isArray(p.attachments) ? p.attachments : [],
      mainAgent: p.mainAgent || mainAgent,
      participants: Array.isArray(p.participants) ? p.participants : participants,
      models: p.models || {},
      slotMeta: p.slotMeta || {}
    }));
  }

  const dispatchedAtIso = new Date().toISOString();
  const messageNumber = existingMessages.length + 1;
  const newMsgRecord = {
    number: messageNumber,
    timestamp: getTimestamp(),
    timestampIso: dispatchedAtIso,
    prompt: promptText || '(No prompt text provided)',
    attachments: parsedAttachments,
    mainAgent,
    participants,
    models: parsedModels,
    slotMeta: normalizedSlotMeta
  };
  const allMessages = [...existingMessages, newMsgRecord];

  const formatParticipantEntry = (p, idx) => {
    const m = normalizedSlotMeta[p] || {};
    const meta = [];
    if (idx === 0) meta.push('Main');
    if (m.displayName || parsedModels[p]) meta.push(`Model: ${m.displayName || parsedModels[p]}`);
    if (m.roleSummary) meta.push(`Roles: ${m.roleSummary} [${m.mixedColor || '#64748B'}]`);
    if (m.writePermission) meta.push(`Tier: ${m.writePermission}`);
    return meta.length > 0 ? `${p} (${meta.join(' · ')})` : p;
  };

  const mainMeta = normalizedSlotMeta[mainAgent] || {};
  const mainModelNote = (mainMeta.displayName || parsedModels[mainAgent])
    ? ` (Model: ${mainMeta.displayName || parsedModels[mainAgent]}${mainMeta.roleSummary ? ` · Roles: ${mainMeta.roleSummary} [${mainMeta.mixedColor}]` : ''})`
    : '';
  const participantsLine = participants.map(formatParticipantEntry).join(', ');
  const modelsLine = Object.keys(parsedModels).length > 0
    ? `\n**Agent Models:** ${JSON.stringify(parsedModels)}`
    : '';
  const slotRolesLines = participants.map((p, idx) => {
    const m = normalizedSlotMeta[p] || {};
    const badge = idx === 0 ? 'Main' : `Slot ${idx + 1}`;
    const roleLabel = m.roleSummary || 'General';
    return `- **${m.displayName || p}** (${badge}, ID: \`${p}\`): Roles: ${roleLabel} | Color: \`${m.mixedColor || '#64748B'}\` | Write Tier: \`${m.writePermission || 'code-write'}\` | Escalation: \`${m.hubEscalation || 'direct-user-access'}\``;
  }).join('\n');

  const activeDirective = messageNumber > 1
    ? `**Active Target:** 🎯 **Work on Message ${messageNumber} (LATEST)** below. Previous messages (\`Message 1\`..\`Message ${messageNumber - 1}\`) are kept in this same session for context.`
    : `**Active Target:** 🎯 **Work on Message 1 (LATEST)** below.`;

  const renderedMessages = allMessages.map((msg) => {
    const isLatest = msg.number === messageNumber;
    const heading = isLatest
      ? `### 🎯 Message ${msg.number} (LATEST — WORK ON THIS MESSAGE) *(${msg.timestamp || ''})*`
      : `### Message ${msg.number} *(${msg.timestamp || ''} — Previous)*`;
    let attSection = '';
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const attLines = msg.attachments.map((a) => `- \`${a.path}\` (${a.isDirectory ? 'Folder' : 'File'})`);
      attSection = `**Attached Files / Folders:**\n${attLines.join('\n')}\n\n`;
    }
    return `${heading}\n${attSection}${msg.prompt || '(No prompt text provided)'}`;
  }).join('\n\n---\n\n');

  const inboxContent = `# 📥 User Inbox

> Write your prompt, role assignments, and participating agents casually below.
> Type \`/assemble\` in each participating agent's window to start.

---

<!-- WRITE CASUALLY BELOW THIS LINE -->

**Main Agent (Slot 1):** ${mainAgent}${mainModelNote}
**Participating Agents:** ${participantsLine}${modelsLine}
${activeDirective}

### 🎨 Team Roles & Write Permissions
${slotRolesLines}

## 📜 Session Messages

${renderedMessages}
`;

  writeFileRetrySync(INBOX_PATH, inboxContent, 'utf8');

  const wasCancelledOrCompleted = Boolean(presence.sessionCancelled || presence.sessionCompleted);
  presence.sessionId = presence.sessionId || `session-${getFileSafeTimestamp()}`;
  if (flags.title) {
    presence.sessionTitle = String(flags.title).trim();
  } else if (isGenericSessionTitle(presence.sessionTitle) && promptText) {
    const firstPromptLine = promptText.split('\n').map((l) => l.trim()).find(Boolean);
    if (firstPromptLine) presence.sessionTitle = firstPromptLine.slice(0, 48);
  }
  presence.mainAgent = mainAgent;
  presence.expectedParticipants = participants;
  presence.agentModels = parsedModels;
  presence.slotMeta = normalizedSlotMeta;
  if (parsedSlots) {
    presence.savedSlots = parsedSlots;
  }
  presence.dispatchedAtIso = dispatchedAtIso;
  presence.sessionCancelled = false;
  presence.cancelledAtIso = null;
  presence.sessionCompleted = false;
  presence.completedAtIso = null;
  presence.latestMessageNumber = messageNumber;
  presence.sessionMessages = allMessages;
  presence.plan = {
    status: 'NONE',
    summary: '',
    reviewedBy: [],
    approvedByUser: false,
    updatedAt: getTimestamp()
  };

  const resetAllAssembly = (messageNumber === 1 || wasCancelledOrCompleted) && !flags['keep-assembled'];
  if (!presence.agents) {
    presence.agents = {};
  }
  for (const key of Object.keys(presence.agents)) {
    const inTeam = participants.includes(key);
    if (!resetAllAssembly && inTeam && presence.agents[key].assembled === true) {
      presence.agents[key].status = 'IDLE';
      presence.agents[key].currentTask = null;
      presence.agents[key].activity = `Follow-up Message ${messageNumber} dispatched`;
    } else {
      presence.agents[key].assembled = false;
      presence.agents[key].currentTask = null;
      presence.agents[key].status = 'OFFLINE';
      presence.agents[key].activity = 'Awaiting session assembly';
    }
  }
  savePresence(presence);

  if (messageNumber > 1) {
    try {
      let comm = readFileSafe(COMM_PATH);
      if (comm) {
        const msgId = getNextMsgId(comm);
        const boardNote = formatCompactMessage({
          id: msgId,
          from: '@User',
          to: '@All',
          type: 'PROMPT',
          subject: `Message ${messageNumber} dispatched — work on Message ${messageNumber}`,
          body: promptText ? promptText.slice(0, 200) : 'See USER_INBOX.md'
        });
        comm = comm.trimEnd() + '\n\n' + boardNote + '\n';
        writeFileRetrySync(COMM_PATH, comm, 'utf8');
      }
    } catch {}
  }

  const entry = appendFeedItem({
    kind: 'user_prompt',
    status: 'dispatched',
    agent: '@User',
    messageNumber,
    attachments: parsedAttachments,
    mainAgent,
    participants,
    models: parsedModels,
    slotMeta: normalizedSlotMeta,
    prompt: promptText
  });

  const mainLabel = (normalizedSlotMeta[mainAgent] && normalizedSlotMeta[mainAgent].displayName) || mainAgent;
  const teamLabels = participants.map((p) => (normalizedSlotMeta[p] && normalizedSlotMeta[p].displayName) || p).join(', ');
  cmdLogInternal(
    '@User',
    `Dispatched Message ${messageNumber} (${entry.id})`,
    'USER_INBOX.md',
    `Main: ${mainLabel}; Team: ${teamLabels}${parsedAttachments.length ? `; Attachments: ${parsedAttachments.length}` : ''}`
  );
  const sessionMeta = syncCurrentSessionToArchive(presence.sessionTitle, parsedSlots);
  const finalPresence = loadPresence();

  if (flags.json) {
    console.log(JSON.stringify({
      ok: true,
      entry,
      messageNumber,
      isFollowUp: messageNumber > 1,
      attachments: parsedAttachments,
      mainAgent,
      participants,
      models: parsedModels,
      slotMeta: normalizedSlotMeta,
      sessionId: finalPresence.sessionId,
      sessionFolder: sessionMeta ? sessionMeta.folder : finalPresence.sessionFolder,
      sessionTitle: sessionMeta ? sessionMeta.title : finalPresence.sessionTitle
    }, null, 2));
  } else {
    console.log(`🚀 Dispatched Message ${messageNumber} (${entry.id}) -> Main: ${mainLabel} | Team: ${teamLabels}`);
  }
}

function cmdReport(flags = {}) {
  enforceNotCancelled(flags);
  const identity = resolveParticipantIdentity(flags.agent || loadPresence().mainAgent || '@Agent');
  const agent = identity.tag;
  const agentLabel = identity.displayName || agent;
  const reportType = (flags.type || flags['report-type'] || 'milestone').toLowerCase();
  const title = flags.title || 'Agent Report';
  const summary = flags.summary || flags.body || '';
  const filesChanged = parseListOptionInput(flags.files || flags['files-changed']);
  const nextSteps = flags.next || flags['next-steps'] || '';

  const entry = appendFeedItem({
    kind: 'report',
    status: 'logged',
    agent,
    agentLabel,
    modelLabel: identity.modelLabel || agentLabel,
    providerTag: identity.providerTag,
    roleIds: identity.roleIds,
    roleSummary: identity.roleSummary,
    mixedColor: identity.mixedColor,
    writePermission: identity.writePermission,
    reportType,
    title,
    summary,
    filesChanged,
    nextSteps
  });

  const isFinalSummary = reportType === 'final_summary';
  if (isFinalSummary) {
    const presence = loadPresence();
    presence.sessionCompleted = true;
    presence.completedAtIso = new Date().toISOString();
    if (presence.agents) {
      for (const key of Object.keys(presence.agents)) {
        presence.agents[key].assembled = false;
        presence.agents[key].status = 'OFFLINE';
        presence.agents[key].currentTask = null;
        presence.agents[key].activity = 'Session completed (final_summary sent)';
      }
    }
    savePresence(presence);
    ensureSignOffMessagePosted(agent, title);
  } else {
    updateAgentPresence(agent, {
      activity: `Reported ${reportType}: ${title.slice(0, 32)}`
    });
  }

  cmdLogInternal(agentLabel, `Posted ${reportType} report (${entry.id}): ${title}`, filesChanged.join(', ') || 'none');
  syncCurrentSessionToArchive();

  const teamReminder = isFinalSummary
    ? 'IMPORTANT: Send a sign-off message to your teammates in AGENT_COMMUNICATION.md before going offline so no teammate is left waiting.'
    : undefined;

  if (flags.json) {
    console.log(JSON.stringify({ status: 'report_sent', item_id: entry.id, agent, agentLabel, entry, ...(teamReminder ? { reminder: teamReminder } : {}) }, null, 2));
  } else {
    console.log(`📋 Posted ${reportType} report ${entry.id} by ${agentLabel} (${agent}): "${title}"`);
    if (teamReminder) {
      console.log(`📢 ${teamReminder}`);
    }
  }
}

async function cmdAsk(flags = {}) {
  enforceNotCancelled(flags);
  const identity = resolveParticipantIdentity(flags.agent || loadPresence().mainAgent || '@Agent');
  const agent = identity.tag;
  const agentLabel = identity.displayName || agent;
  const question = flags.question || '';
  const context = flags.context || '';
  const timeoutSec = parseInt(flags.timeout || '1800', 10);
  const shouldWait = !(flags['no-wait'] === true || flags['no-wait'] === 'true' || flags.wait === 'false' || flags.wait === false);

  if (!question) {
    console.error('Error: ask requires --question "<text>"');
    process.exit(1);
  }

  const entry = appendFeedItem({
    kind: 'question',
    status: 'pending',
    agent,
    agentLabel,
    modelLabel: identity.modelLabel || agentLabel,
    providerTag: identity.providerTag,
    roleIds: identity.roleIds,
    roleSummary: identity.roleSummary,
    mixedColor: identity.mixedColor,
    writePermission: identity.writePermission,
    question,
    context
  });

  updateAgentPresence(agent, {
    status: 'WAITING',
    activity: `Waiting for user answer (${entry.id})`
  });
  cmdLogInternal(agentLabel, `Asked question (${entry.id})`, 'VIBE_FEED.json', question.slice(0, 60));
  syncCurrentSessionToArchive();

  if (!shouldWait) {
    console.log(JSON.stringify({ status: 'sent_non_blocking', item_id: entry.id, agent, agentLabel }, null, 2));
    return;
  }

  const res = await waitForFeedReply(entry.id, timeoutSec);
  updateAgentPresence(agent, res.status === 'cancelled'
    ? { status: 'OFFLINE', assembled: false, activity: 'Session cancelled by user' }
    : { status: 'IDLE', activity: `Received user reply (${entry.id})` });
  syncCurrentSessionToArchive();
  console.log(JSON.stringify(res, null, 2));
}

async function cmdPoll(flags = {}) {
  enforceNotCancelled(flags);
  const identity = resolveParticipantIdentity(flags.agent || loadPresence().mainAgent || '@Agent');
  const agent = identity.tag;
  const agentLabel = identity.displayName || agent;
  const question = flags.question || '';
  const context = flags.context || '';
  const allowMultiselect = flags.multiselect === true || flags.multiselect === 'true';
  const timeoutSec = parseInt(flags.timeout || '1800', 10);
  const shouldWait = !(flags['no-wait'] === true || flags['no-wait'] === 'true' || flags.wait === 'false' || flags.wait === false);

  const rawOptions = parseListOptionInput(flags.options).filter(opt => !isOthersOption(opt)).slice(0, 9);
  if (!question || rawOptions.length === 0) {
    console.error('Error: poll requires --question "<text>" and --options "Opt1|Opt2"');
    process.exit(1);
  }
  const finalOptions = [...rawOptions, OTHERS_OPTION_LABEL];

  const entry = appendFeedItem({
    kind: 'poll',
    status: 'pending',
    agent,
    agentLabel,
    modelLabel: identity.modelLabel || agentLabel,
    providerTag: identity.providerTag,
    roleIds: identity.roleIds,
    roleSummary: identity.roleSummary,
    mixedColor: identity.mixedColor,
    writePermission: identity.writePermission,
    question,
    context,
    options: finalOptions,
    allowMultiselect
  });

  updateAgentPresence(agent, {
    status: 'WAITING',
    activity: `Waiting for poll vote (${entry.id})`
  });
  cmdLogInternal(agentLabel, `Asked poll (${entry.id})`, 'VIBE_FEED.json', question.slice(0, 60));
  syncCurrentSessionToArchive();

  if (!shouldWait) {
    console.log(JSON.stringify({ status: 'sent_non_blocking', item_id: entry.id, agent, agentLabel, options: finalOptions }, null, 2));
    return;
  }

  const res = await waitForFeedReply(entry.id, timeoutSec);
  updateAgentPresence(agent, res.status === 'cancelled'
    ? { status: 'OFFLINE', assembled: false, activity: 'Session cancelled by user' }
    : { status: 'IDLE', activity: `Received poll answer (${entry.id})` });
  syncCurrentSessionToArchive();
  console.log(JSON.stringify(res, null, 2));
}

function cmdReply(flags = {}, positional = []) {
  const rawId = flags.id || positional[1];
  if (!rawId) {
    console.error('Error: reply requires --id <ITEM-ID>');
    process.exit(1);
  }
  const cleanId = rawId.trim().toUpperCase();
  const feed = loadFeed();
  const idx = (feed.items || []).findIndex(i => i.id.toUpperCase() === cleanId);
  if (idx === -1) {
    console.error(`Error: Feed item ${cleanId} not found.`);
    process.exit(1);
  }

  const selectedOptions = parseListOptionInput(flags.options);
  const answer = flags.answer || flags.text || '';
  const nowIso = new Date().toISOString();

  feed.items[idx].status = 'answered';
  feed.items[idx].answeredAt = getTimestamp();
  feed.items[idx].answeredAtIso = nowIso;
  feed.items[idx].reply = {
    selectedOptions,
    answer,
    timestamp: nowIso
  };

  saveFeed(feed);
  const summaryNote = [...selectedOptions, answer].filter(Boolean).join(' · ') || 'Answered';

  // Auto-mark plan approved when the user approves via poll/question reply
  const approvesPlan =
    /\b(approve|approved|accept|proceed|yes|lgtm|start|run)\b/i.test(summaryNote) &&
    !/\b(revise|reject|cancel|no|wait|deny)\b/i.test(summaryNote);
  if (approvesPlan) {
    const presence = loadPresence();
    if (!presence.plan || !presence.plan.approvedByUser) {
      presence.plan = {
        ...(presence.plan || {}),
        status: 'USER_APPROVED',
        approvedByUser: true,
        updatedAt: getTimestamp()
      };
      savePresence(presence);
    }
  }

  cmdLogInternal('@User', `Replied to ${cleanId}`, 'VIBE_FEED.json', summaryNote.slice(0, 60));
  syncCurrentSessionToArchive();

  if (flags.json) {
    console.log(JSON.stringify({ ok: true, item: feed.items[idx] }, null, 2));
  } else {
    console.log(`✅ Recorded reply for ${cleanId}: ${summaryNote}`);
  }
}

function cmdFeed(flags = {}) {
  const feed = loadFeed();
  if (flags.json) {
    console.log(JSON.stringify(feed, null, 2));
    return;
  }
  console.log(`📰 VIBE FEED (${feed.items.length} items):`);
  if (feed.items.length === 0) {
    console.log('  (No reports, questions, or polls yet)');
    return;
  }
  for (const item of feed.items) {
    const statusTag = item.status ? ` [${item.status.toUpperCase()}]` : '';
    if (item.kind === 'report') {
      console.log(`  • ${item.id} [${item.timestamp}] ${item.agent} · REPORT (${item.reportType}): ${item.title}`);
    } else if (item.kind === 'question') {
      console.log(`  • ${item.id} [${item.timestamp}] ${item.agent} · QUESTION${statusTag}: ${item.question}`);
    } else if (item.kind === 'poll') {
      console.log(`  • ${item.id} [${item.timestamp}] ${item.agent} · POLL${statusTag}: ${item.question}`);
    } else if (item.kind === 'user_prompt') {
      console.log(`  • ${item.id} [${item.timestamp}] @User · PROMPT (Main: ${item.mainAgent}): ${item.prompt}`);
    }
  }
}

function cmdCancel(flags = {}) {
  const nowIso = new Date().toISOString();
  const reason = String(flags.reason || 'Cancelled by user from Vibe Coding tab').trim();
  const presence = loadPresence();
  const pidsToKill = Array.isArray(presence.cliPids) ? [...presence.cliPids] : [];
  for (const pid of pidsToKill) {
    if (!pid || typeof pid !== 'number') continue;
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch {}
  }
  presence.cliPids = [];
  presence.sessionCancelled = true;
  presence.cancelledAtIso = nowIso;
  if (presence.plan && (presence.plan.status === 'REVIEW' || presence.plan.status === 'DRAFT' || presence.plan.status === 'TEAM_REVIEWED')) {
    presence.plan.status = 'CANCELLED';
    presence.plan.updatedAt = getTimestamp();
  }
  if (presence.agents) {
    for (const key of Object.keys(presence.agents)) {
      presence.agents[key].assembled = false;
      presence.agents[key].status = 'OFFLINE';
      presence.agents[key].currentTask = null;
      presence.agents[key].activity = 'Session cancelled by user';
    }
  }
  savePresence(presence);

  const feed = loadFeed();
  let cancelledPendingCount = 0;
  for (const item of feed.items || []) {
    if (item && (item.kind === 'question' || item.kind === 'poll') && item.status === 'pending') {
      item.status = 'cancelled';
      item.cancelledAt = getTimestamp();
      item.cancelledAtIso = nowIso;
      cancelledPendingCount++;
    }
  }
  saveFeed(feed);

  const entry = appendFeedItem({
    kind: 'report',
    status: 'logged',
    agent: '@System',
    reportType: 'cancelled',
    title: 'Session Cancelled',
    summary: reason,
    filesChanged: [],
    nextSteps: 'You can send a revised prompt or switch sessions from History.'
  });

  cmdLogInternal('@User', 'Cancelled ongoing session', 'VIBE_FEED.json', reason);
  syncCurrentSessionToArchive();

  if (flags.json) {
    console.log(JSON.stringify({ ok: true, cancelledAtIso: nowIso, cancelledPendingCount, entry }, null, 2));
  } else {
    console.log(`🛑 Cancelled ongoing collaboration session (${cancelledPendingCount} pending prompt(s) closed).`);
  }
}

async function main() {
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
    case 'dispatch':
      cmdDispatch(flags);
      break;
    case 'report':
      cmdReport(flags);
      break;
    case 'ask':
      await cmdAsk(flags);
      break;
    case 'poll':
      await cmdPoll(flags);
      break;
    case 'reply':
      cmdReply(flags, positional);
      break;
    case 'feed':
      cmdFeed(flags);
      break;
    case 'status':
      cmdStatus();
      break;
    case 'peers':
    case 'who':
    case 'online':
    case 'agents':
    case 'presence':
      cmdPeers(flags, positional);
      break;
    case 'health':
    case 'check-team':
      cmdHealth();
      break;
    case 'wait-team':
      cmdWaitTeam(flags);
      break;
    case 'plan':
      cmdPlan(positional, flags);
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
    case 'ping':
    case 'heartbeat':
      cmdPing(positional[1], positional.slice(2).join(' ') || flags.activity);
      break;
    case 'busy':
    case 'running':
      cmdBusy(positional[1], positional[2], positional.slice(3).join(' ') || flags.activity);
      break;
    case 'idle':
    case 'standby':
      cmdIdle(positional[1], positional.slice(2).join(' ') || flags.activity);
      break;
    case 'offline':
      cmdOffline(positional[1], flags);
      break;
    case 'wait':
      cmdWait(flags, positional);
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
      cmdArchiveResume(positional[1]);
      break;
    case 'sessions':
      cmdArchiveList(flags);
      break;
    case 'cancel':
    case 'stop':
      cmdCancel(flags);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
