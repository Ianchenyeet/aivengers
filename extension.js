'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const roleDefs = require('./src/roles/roleDefinitions');

const VIEW_ID = 'aivengers.panel';
const STATE_SLOTS_KEY = 'vibeCoding.selectedSlots.v2';
const STATE_SETTINGS_KEY = 'vibeCoding.settings.v1';
const OTHERS_PREFIX = 'others (';

const DEFAULT_GLOBAL_PROMPT_TEMPLATE = [
  '/assemble',
  'You are {{agent}} (Model: {{agentLabel}}, Role: {{roleLabel}}). Main agent: {{mainAgent}}. Participating team: {{teamList}}.',
  '{{activeMessageDirective}}',
  '{{modelNote}}',
  'Collaboration hub directory: "{{hubDir}}"',
  'User prompt saved in "{{inboxPath}}" (work ONLY on the latest message while keeping prior session messages for context):',
  '{{attachmentsNote}}',
  '{{userPrompt}}',
  '{{planRule}}',
  '{{multiRoleBlock}}',
].join('\n\n');

const DEFAULT_AGENT_PROMPTS = {
  '@antigravity': {
    mode: 'append',
    template:
      'If a specific model ID was requested for your slot, honor it throughout planning and execution.',
  },
  '@copilot': {
    mode: 'append',
    template:
      'Operate in Agent Mode, check `node "{{hubScriptPath}}" health`, and coordinate with teammates in the hub before making outside edits.',
  },
  '@claude': { mode: 'append', template: '' },
  '@codex': { mode: 'append', template: '' },
};

const DEFAULT_SETTINGS = {
  autoLaunchAgents: true,
  startNewConversation: false,
  keepFocusOnSend: true,
  attachInboxFile: true,
  requirePlanApproval: true,
  showAllKnownAgents: false,
  antigravityLaunchMode: 'ui_with_cli_fallback',
  globalPromptTemplate: '',
  agentPrompts: {},
  customModels: [],
};

/**
 * Curated Antigravity model catalog (matches local Antigravity IDE models).
 */
const ANTIGRAVITY_MODELS = [
  { id: 'auto', label: 'Auto (Current Model)', group: 'Default' },
  { id: 'gemini-pro-orchestrator-g1-pro', label: 'Orchestrator (Argon)', group: 'Gemini 4' },
  { id: 'gemini-4-argon-high', label: 'Gemini 4 Argon (High)', group: 'Gemini 4' },
  { id: 'gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)', group: 'Gemini 4' },
  { id: 'gemini-4-argon-low', label: 'Gemini 4 Argon (Low)', group: 'Gemini 4' },
  { id: 'gemini-4-hydrogen-xhigh', label: 'Gemini 4 Hydrogen (XHigh)', group: 'Gemini 4' },
  { id: 'gemini-4-hydrogen-high', label: 'Gemini 4 Hydrogen (High)', group: 'Gemini 4' },
  { id: 'gemini-4-hydrogen-medium', label: 'Gemini 4 Hydrogen (Medium)', group: 'Gemini 4' },
  { id: 'gemini-4-hydrogen-low', label: 'Gemini 4 Hydrogen (Low)', group: 'Gemini 4' },
  { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)', group: 'Gemini 3.8' },
  { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)', group: 'Gemini 3.8' },
  { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)', group: 'Gemini 3.8' },
  { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 (High)', group: 'Claude' },
  { id: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5 (Medium)', group: 'Claude' },
  { id: 'claude-opus-5-5-low', label: 'Claude Opus 5.5 (Low)', group: 'Claude' },
  { id: 'claude-sonnet-5-5-high', label: 'Claude Sonnet 5.5 (High)', group: 'Claude' },
  { id: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 (Medium)', group: 'Claude' },
  { id: 'claude-sonnet-5-5-low', label: 'Claude Sonnet 5.5 (Low)', group: 'Claude' },
  { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)', group: 'OpenAI OSS' },
];

/**
 * Curated Copilot Chat fallback model catalog (merged with live `vscode.lm.selectChatModels()`).
 */
const COPILOT_FALLBACK_MODELS = [
  { id: 'auto', label: 'Auto (Copilot Default)', group: 'Default', minTier: 'free' },
  { id: 'gpt-4.1', label: 'GPT-4.1', vendor: 'copilot', family: 'gpt-4.1', group: 'OpenAI', minTier: 'free' },
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'copilot', family: 'gpt-4o', group: 'OpenAI', minTier: 'free' },
  { id: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', vendor: 'copilot', family: 'claude-3.5-sonnet', group: 'Anthropic', minTier: 'free' },
  { id: 'o3-mini', label: 'OpenAI o3-mini', vendor: 'copilot', family: 'o3-mini', group: 'OpenAI Reasoning', minTier: 'free' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', vendor: 'copilot', family: 'gemini-2.0-flash', group: 'Google', minTier: 'free' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'copilot', family: 'claude-sonnet-4', group: 'Anthropic', minTier: 'pro' },
  { id: 'claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', vendor: 'copilot', family: 'claude-3.7-sonnet', group: 'Anthropic', minTier: 'pro' },
  { id: 'o4-mini', label: 'OpenAI o4-mini', vendor: 'copilot', family: 'o4-mini', group: 'OpenAI Reasoning', minTier: 'pro' },
  { id: 'o3', label: 'OpenAI o3', vendor: 'copilot', family: 'o3', group: 'OpenAI Reasoning', minTier: 'pro' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vendor: 'copilot', family: 'gemini-2.5-pro', group: 'Google', minTier: 'pro' },
  { id: 'claude-opus-4', label: 'Claude Opus 4', vendor: 'copilot', family: 'claude-opus-4', group: 'Anthropic', minTier: 'pro_plus' },
];

const CLAUDE_MODELS = [
  { id: 'auto', label: 'Auto (Claude Default)', group: 'Default' },
  { id: 'claude-opus-4', label: 'Claude Opus 4', group: 'Anthropic' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', group: 'Anthropic' },
  { id: 'claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', group: 'Anthropic' },
  { id: 'claude-3.5-haiku', label: 'Claude Haiku 3.5', group: 'Anthropic' },
];

const CODEX_MODELS = [
  { id: 'auto', label: 'Auto (Codex Default)', group: 'Default' },
  { id: 'o3', label: 'o3', group: 'OpenAI' },
  { id: 'o4-mini', label: 'o4-mini', group: 'OpenAI' },
  { id: 'gpt-4.1', label: 'GPT-4.1', group: 'OpenAI' },
  { id: 'codex-mini', label: 'Codex Mini', group: 'OpenAI' },
];

/**
 * Registry of genuine AI coding agent extensions (excludes domain helper participants like Azure, Unity MCP, upgrade tools).
 */
const KNOWN_AGENT_EXTENSIONS = [
  {
    id: 'google.google-antigravity',
    tag: '@Antigravity',
    label: 'Antigravity',
    description: 'Google Antigravity coding agent',
    badge: 'AGY',
    launchType: 'antigravity',
    models: ANTIGRAVITY_MODELS,
  },
  {
    id: 'github.copilot-chat',
    tag: '@Copilot',
    label: 'GitHub Copilot',
    description: 'GitHub Copilot Chat coding agent',
    badge: 'COP',
    launchType: 'copilot_chat',
    models: COPILOT_FALLBACK_MODELS,
  },
  {
    id: 'github.copilot',
    tag: '@Copilot',
    label: 'GitHub Copilot',
    description: 'GitHub Copilot extension',
    badge: 'COP',
    launchType: 'copilot_chat',
    models: COPILOT_FALLBACK_MODELS,
  },
  {
    id: 'anthropic.claude-code',
    tag: '@Claude',
    label: 'Claude Code',
    description: 'Anthropic Claude Code agent',
    badge: 'CLD',
    launchType: 'claude_ext',
    models: CLAUDE_MODELS,
  },
  {
    id: 'openai.chatgpt',
    tag: '@Codex',
    label: 'Codex',
    description: 'OpenAI Codex / ChatGPT extension',
    badge: 'CDX',
    launchType: 'codex_ext',
    models: CODEX_MODELS,
  },
  {
    id: 'saoudrizwan.claude-dev',
    tag: '@Cline',
    label: 'Cline',
    description: 'Cline autonomous coding agent',
    badge: 'CLN',
    launchType: 'extension_chat',
    commandCandidates: ['cline.plusButtonClicked', 'cline.SidebarProvider.focus'],
    models: [{ id: 'auto', label: 'Auto (Cline Profile)', group: 'Default' }],
  },
  {
    id: 'rooveterinaryinc.roo-cline',
    tag: '@Roo',
    label: 'Roo Code',
    description: 'Roo Code autonomous coding agent',
    badge: 'ROO',
    launchType: 'extension_chat',
    commandCandidates: ['roo-cline.plusButtonClicked', 'roo-cline.SidebarProvider.focus'],
    models: [{ id: 'auto', label: 'Auto (Roo Profile)', group: 'Default' }],
  },
  {
    id: 'kilocode.kilo-code',
    tag: '@Kilo',
    label: 'Kilo Code',
    description: 'Kilo Code AI coding agent',
    badge: 'KLO',
    launchType: 'extension_chat',
    commandCandidates: ['kilo-code.plusButtonClicked', 'kilo-code.SidebarProvider.focus'],
    models: [{ id: 'auto', label: 'Auto (Kilo Profile)', group: 'Default' }],
  },
  {
    id: 'continue.continue',
    tag: '@Continue',
    label: 'Continue',
    description: 'Continue AI coding agent',
    badge: 'CNT',
    launchType: 'extension_chat',
    commandCandidates: ['continue.newSession', 'continue.focusContinueInput'],
    models: [{ id: 'auto', label: 'Auto (Continue Profile)', group: 'Default' }],
  },
  {
    id: 'codeium.codeium',
    tag: '@Windsurf',
    label: 'Windsurf',
    description: 'Codeium / Windsurf Cascade agent',
    badge: 'WND',
    launchType: 'extension_chat',
    commandCandidates: ['codeium.openChatView', 'codeium.chat.focus'],
    models: [{ id: 'auto', label: 'Auto (Cascade Default)', group: 'Default' }],
  },
  {
    id: 'codeium.windsurf',
    tag: '@Windsurf',
    label: 'Windsurf',
    description: 'Windsurf Cascade coding agent',
    badge: 'WND',
    launchType: 'extension_chat',
    commandCandidates: ['windsurf.openChatView', 'codeium.openChatView'],
    models: [{ id: 'auto', label: 'Auto (Cascade Default)', group: 'Default' }],
  },
  {
    id: 'sourcegraph.cody-ai',
    tag: '@Cody',
    label: 'Sourcegraph Cody',
    description: 'Sourcegraph Cody coding agent',
    badge: 'CDY',
    launchType: 'extension_chat',
    commandCandidates: ['cody.chat.newPanel', 'cody.focus'],
    models: [{ id: 'auto', label: 'Auto (Cody Default)', group: 'Default' }],
  },
  {
    id: 'augment.vscode-augment',
    tag: '@Augment',
    label: 'Augment Code',
    description: 'Augment Code coding agent',
    badge: 'AUG',
    launchType: 'extension_chat',
    commandCandidates: ['vscode-augment.focusChat', 'augment.chat.focus'],
    models: [{ id: 'auto', label: 'Auto (Augment Default)', group: 'Default' }],
  },
  {
    id: 'amazonwebservices.amazon-q-vscode',
    tag: '@AmazonQ',
    label: 'Amazon Q',
    description: 'Amazon Q Developer coding agent',
    badge: 'AMQ',
    launchType: 'extension_chat',
    commandCandidates: ['aws.amazonq.focusChat', 'amazonq.focus'],
    models: [{ id: 'auto', label: 'Auto (Amazon Q Default)', group: 'Default' }],
  },
];

const BUILTIN_HOST_PROVIDERS = [
  {
    command: 'workbench.action.chat.openNewSessionSidebar.agent-host-claude',
    id: 'builtin:agent-host-claude',
    tag: '@Claude',
    label: 'Claude (Agent Host)',
    description: 'Built-in VS Code Claude Agent Host',
    badge: 'CLD',
    launchType: 'session_sidebar',
    models: CLAUDE_MODELS,
  },
  {
    command: 'workbench.action.chat.openNewSessionSidebar.agent-host-codex',
    id: 'builtin:agent-host-codex',
    tag: '@Codex',
    label: 'Codex (Agent Host)',
    description: 'Built-in VS Code Codex Agent Host',
    badge: 'CDX',
    launchType: 'session_sidebar',
    models: CODEX_MODELS,
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonSafe(filePath, fallback) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return fallback;
}

function isHubDirectory(dir) {
  if (!dir) return false;
  try {
    return (
      fs.existsSync(path.join(dir, 'scripts', 'hub.js')) &&
      (fs.existsSync(path.join(dir, 'USER_INBOX.md')) ||
        fs.existsSync(path.join(dir, 'AGENTS.md')))
    );
  } catch {
    return false;
  }
}

/**
 * Resolves the active `vibe coding tools` hub folder without hardcoding host project paths.
 */
function resolveHubDir(context) {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    if (isHubDirectory(root)) {
      return root;
    }
    const nestedDefault = path.join(root, 'vibe coding tools');
    if (isHubDirectory(nestedDefault)) {
      return nestedDefault;
    }
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        const sub = path.join(root, entry.name);
        if (isHubDirectory(sub)) {
          return sub;
        }
      }
    } catch {}
  }

  if (context && isHubDirectory(context.extensionPath)) {
    return context.extensionPath;
  }
  return context ? context.extensionPath : __dirname;
}

function execHubCommand(hubDir, args) {
  const hubScript = path.join(hubDir, 'scripts', 'hub.js');
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(hubScript)) {
      reject(new Error(`hub.js not found at ${hubScript}`));
      return;
    }
    execFile(
      process.execPath,
      [hubScript, ...args],
      { cwd: hubDir, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message || 'hub.js failed').trim()));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function dedupeModels(baseModels, extraModels) {
  const result = [];
  const seen = new Set();
  for (const m of [...(baseModels || []), ...(extraModels || [])]) {
    if (!m || !m.id) continue;
    const key = String(m.id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: m.id,
      label: m.label || m.name || m.id,
      vendor: m.vendor || undefined,
      family: m.family || undefined,
      group: m.group || 'Models',
      live: Boolean(m.live),
    });
  }
  return result;
}

function withTimeout(promise, ms, fallbackVal = null) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => setTimeout(() => resolve(fallbackVal), ms)),
  ]);
}

let cachedCopilotPlan = null;
let cachedCopilotPlanTs = 0;

/**
 * Infers chat model availability using the official VS Code `vscode.lm` API non-interactively.
 */
async function detectCopilotUserPlan(forceRefresh = false) {
  const now = Date.now();
  const ttl = cachedCopilotPlan && cachedCopilotPlan.detected ? 5 * 60 * 1000 : 12 * 1000;
  if (!forceRefresh && cachedCopilotPlan && now - cachedCopilotPlanTs < ttl) {
    return cachedCopilotPlan;
  }

  const fallback = {
    tier: 'unknown',
    label: 'Chat Models',
    sku: '',
    rawPlan: '',
    chatEnabled: true,
    detected: false,
  };

  try {
    if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
      cachedCopilotPlan = fallback;
      cachedCopilotPlanTs = now;
      return fallback;
    }

    const models = await withTimeout(vscode.lm.selectChatModels({ vendor: 'copilot' }), 2000, []).catch(() => []);
    const liveCount = Array.isArray(models) ? models.length : 0;
    const families = new Set(
      (Array.isArray(models) ? models : []).map((m) => String(m.family || m.id || '').toLowerCase())
    );

    let tier = 'unknown';
    let label = liveCount > 0 ? 'Live Tier' : 'Default';
    if (liveCount > 0) {
      if (Array.from(families).some((f) => /opus|o3|gpt-5/.test(f))) {
        tier = 'pro_plus';
        label = 'Full Live Models';
      } else {
        tier = 'pro';
        label = 'Active Live Models';
      }
    }

    const result = {
      tier,
      label,
      sku: '',
      rawPlan: tier,
      chatEnabled: true,
      detected: liveCount > 0,
    };
    cachedCopilotPlan = result;
    cachedCopilotPlanTs = now;
    return result;
  } catch {
    cachedCopilotPlan = fallback;
    cachedCopilotPlanTs = now;
    return fallback;
  }
}

function filterCopilotFallbackModels(planTier) {
  return COPILOT_FALLBACK_MODELS.filter((m) => {
    if (m.id === 'auto') return true;
    if (planTier === 'free') return m.minTier === 'free';
    if (planTier === 'pro' || planTier === 'business') return m.minTier !== 'pro_plus';
    return true;
  }).map((m) => ({
    ...m,
    group:
      m.id === 'auto'
        ? 'Default'
        : planTier && planTier !== 'unknown'
          ? `${m.group || 'Models'} (${planTier === 'free' ? 'Free Tier' : 'Plan Estimate'})`
          : `${m.group || 'Models'} (Fallback)`,
  }));
}

/**
 * Fetches live chat models exposed via `vscode.lm.selectChatModels()` when supported by the VS Code API.
 */
async function queryLiveVsCodeModels() {
  try {
    if (vscode.lm && typeof vscode.lm.selectChatModels === 'function') {
      for (const extId of ['github.copilot-chat', 'github.copilot']) {
        try {
          const ext = vscode.extensions.getExtension(extId);
          if (ext && !ext.isActive) {
            await withTimeout(ext.activate(), 3500, null);
          }
        } catch {}
      }

      const [copilotRaw, allRaw] = await Promise.all([
        withTimeout(vscode.lm.selectChatModels({ vendor: 'copilot' }), 3000, []).catch(() => []),
        withTimeout(vscode.lm.selectChatModels(), 3000, []).catch(() => []),
      ]);

      const merged = [];
      const seenIds = new Set();
      for (const m of [...(Array.isArray(copilotRaw) ? copilotRaw : []), ...(Array.isArray(allRaw) ? allRaw : [])]) {
        if (!m || !m.id) continue;
        const key = String(m.id).toLowerCase();
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        const vendor = m.vendor || 'copilot';
        merged.push({
          id: m.id,
          label: m.name || m.id,
          vendor,
          family: m.family || m.id,
          group:
            String(vendor).toLowerCase() === 'copilot'
              ? 'Available in Your Copilot Plan (Live)'
              : `Live (${vendor})`,
          live: true,
        });
      }
      return merged;
    }
  } catch {}
  return [];
}

/**
 * Discovers installed coding agents and their selectable models (filtering out non-agent helper extensions).
 */
async function discoverInstalledAgents(settings = DEFAULT_SETTINGS) {
  let commandSet = new Set();
  try {
    const allCommands = await vscode.commands.getCommands(true);
    commandSet = new Set(allCommands);
  } catch {}

  const [liveLmModels, copilotPlan] = await Promise.all([
    queryLiveVsCodeModels(),
    detectCopilotUserPlan(),
  ]);
  const liveCopilotModels = liveLmModels.filter(
    (m) => !m.vendor || String(m.vendor).toLowerCase() === 'copilot'
  );

  const customModels = Array.isArray(settings?.customModels) ? settings.customModels : [];
  const discovered = [];
  const seenKeys = new Set();

  const attachCustomModels = (agentKey, models) => {
    const customForAgent = customModels
      .filter((cm) => cm && String(cm.agentKey || '').toLowerCase() === agentKey)
      .map((cm) => ({
        id: cm.id,
        label: cm.label || cm.id,
        vendor: cm.vendor || undefined,
        family: cm.family || cm.id,
        group: cm.group || 'Custom Models',
      }));
    return dedupeModels(models, customForAgent);
  };

  // Sort KNOWN_AGENT_EXTENSIONS priority: github.copilot-chat before github.copilot if both are installed
  const sortedExtensions = [...vscode.extensions.all].sort((a, b) => {
    const aChat = String(a.id || '').toLowerCase() === 'github.copilot-chat' ? 0 : 1;
    const bChat = String(b.id || '').toLowerCase() === 'github.copilot-chat' ? 0 : 1;
    return aChat - bChat;
  });

  // 1. Scan installed extensions against KNOWN_AGENT_EXTENSIONS (strict coding agent allowlist)
  for (const ext of sortedExtensions) {
    const extIdLower = String(ext.id || '').toLowerCase();
    const known = KNOWN_AGENT_EXTENSIONS.find((k) => k.id.toLowerCase() === extIdLower);
    if (!known) {
      continue;
    }

    const key = known.tag.toLowerCase();
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    let agentModels = known.models || [{ id: 'auto', label: 'Auto (Default)', group: 'Default' }];
    let planInfo = null;
    let description = known.description;

    if (key === '@copilot') {
      planInfo = {
        ...copilotPlan,
        liveModelCount: liveCopilotModels.length,
      };
      if (liveCopilotModels.length > 0) {
        // Strictly surface only live models available for this account/plan (plus Auto)
        const autoEntry = [{ id: 'auto', label: 'Auto (Copilot Default)', group: 'Default' }];
        agentModels = dedupeModels(autoEntry, liveCopilotModels);
        description = `${known.description} · ${copilotPlan.label} (${liveCopilotModels.length} live)`;
      } else {
        agentModels = filterCopilotFallbackModels(copilotPlan.tier);
        description = copilotPlan.detected
          ? `${known.description} · ${copilotPlan.label} (plan-filtered)`
          : known.description;
      }
    }

    discovered.push({
      key,
      id: ext.id,
      tag: known.tag,
      label: known.label,
      description,
      badge: known.badge,
      installed: true,
      version: ext.packageJSON?.version || '',
      launchType: known.launchType,
      commandCandidates: known.commandCandidates || [],
      planInfo,
      models: attachCustomModels(key, agentModels),
    });
  }

  // 2. Built-in VS Code Agent Host coding agents (Claude / Codex)
  for (const host of BUILTIN_HOST_PROVIDERS) {
    if (!commandSet.has(host.command)) {
      continue;
    }
    const key = host.tag.toLowerCase();
    if (seenKeys.has(key)) {
      const existing = discovered.find((d) => d.key === key);
      if (existing && !existing.sessionCommand) {
        existing.sessionCommand = host.command;
      }
      continue;
    }
    seenKeys.add(key);
    discovered.push({
      key,
      id: host.id,
      tag: host.tag,
      label: host.label,
      description: host.description,
      badge: host.badge,
      installed: true,
      version: 'built-in',
      launchType: host.launchType,
      sessionCommand: host.command,
      models: attachCustomModels(key, host.models),
    });
  }

  // 3. Optionally include uninstalled known coding agents if enabled in Settings
  if (settings && settings.showAllKnownAgents) {
    for (const known of KNOWN_AGENT_EXTENSIONS) {
      const key = known.tag.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      discovered.push({
        key,
        id: known.id,
        tag: known.tag,
        label: known.label,
        description: `${known.description} (External / CLI)`,
        badge: known.badge,
        installed: false,
        version: 'external',
        launchType: known.launchType,
        commandCandidates: known.commandCandidates || [],
        models: attachCustomModels(key, known.models || [{ id: 'auto', label: 'Auto (Default)', group: 'Default' }]),
      });
    }
  }

  return discovered;
}

function interpolateTemplate(template, vars) {
  return String(template || '')
    .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : match
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildKickoffPrompt({
  agent,
  model,
  isMain,
  mainAgentTag,
  participantEntries,
  hubDir,
  promptText,
  settings,
  messageNumber = 1,
  attachments = [],
  slotIndex = 0,
  participantTag = '',
  modelDisplayName = '',
  roleProfile = null,
  rosterSummary = '',
}) {
  const inboxPath = path.join(hubDir, 'USER_INBOX.md');
  const hubScriptPath = path.join(hubDir, 'scripts', 'hub.js');
  const agentsDocPath = path.join(hubDir, 'AGENTS.md');
  const effectiveProfile =
    roleProfile || roleDefs.resolveEffectiveSlotProfile(undefined, isMain);
  const effectiveTag = participantTag || agent.tag;
  const effectiveDisplayName =
    modelDisplayName ||
    (model && model.id && model.id !== 'auto'
      ? model.label
      : `${agent.label} (${model?.label || 'Auto'})`);
  const role = isMain ? 'Main' : 'Teammate';
  const roleLabel = isMain
    ? `Main · ${effectiveProfile.roleSummary || 'Engineering Manager'}`
    : effectiveProfile.roleSummary || 'Teammate';
  const teamSummary = participantEntries
    .map((entry, idx) => {
      const tag = entry.participantTag || entry.agent.tag;
      const name = entry.displayName || entry.modelLabel || tag;
      const roleTxt = entry.roleProfile?.roleSummary ? `, Roles: ${entry.roleProfile.roleSummary}` : '';
      return idx === 0
        ? `${name} [${tag}] (Main${roleTxt})`
        : `${name} [${tag}]${roleTxt ? ` (${roleTxt.replace(/^,\s*/, '')})` : ''}`;
    })
    .join(', ');

  const modelInstruction =
    model && model.id && model.id !== 'auto'
      ? agent.launchType === 'antigravity'
        ? `Target model for this slot: "${effectiveDisplayName}" (\`${model.id}\`). If you are not running on \`${model.id}\`, switch to it cleanly before starting implementation (e.g., if in a swarm or ask/switch model).`
        : `Target model for this slot: "${effectiveDisplayName}" (\`${model.id}\`).`
      : '';

  const activeMessageDirective =
    messageNumber > 1
      ? `Continuation in same session — **Message ${messageNumber} (LATEST)**. Earlier messages (Message 1..${messageNumber - 1}) remain in "${inboxPath}" for context; focus your work on **Message ${messageNumber}**.`
      : `Current active task: **Message 1 (LATEST)** in "${inboxPath}".`;

  const attachmentsNote =
    Array.isArray(attachments) && attachments.length > 0
      ? `Attached files/folders for Message ${messageNumber}:\n` +
        attachments.map((a) => `- \`${a.path}\` (${a.isDirectory ? 'Folder' : 'File'})`).join('\n')
      : '';

  const s = settings || DEFAULT_SETTINGS;
  const signoffReminder = isMain
    ? ` When all tasks are complete and you send the \`final_summary\` report, you MUST also post a \`[SIGN-OFF]\` message to \`@All\` via \`node "${hubScriptPath}" msg --from "${effectiveTag}" --to "@All" --type "SIGN-OFF" ...\` before going offline so teammates are never left waiting.`
    : ` Stay on standby until ${mainAgentTag} sends a \`[SIGN-OFF]\` message / \`final_summary\` report, then sign off with \`node "${hubScriptPath}" offline "${effectiveTag}"\`.`;

  const planRule =
    s.requirePlanApproval === false
      ? `Follow the workflow in "${agentsDocPath}". Run \`node "${hubScriptPath}" assemble "${effectiveTag}"\` first and coordinate tasks cleanly. Post reports, questions, and polls to the AIvengers tab via \`node "${hubScriptPath}" report|ask|poll --agent "${effectiveTag}"\`.${signoffReminder}`
      : `Follow the 8-step /assemble workflow in "${agentsDocPath}". Run \`node "${hubScriptPath}" assemble "${effectiveTag}"\` first. Wait for all participants before editing files outside the hub folder, and do NOT modify outside files until the plan is approved via the poll in the VS Code AIvengers tab. Post reports, questions, and polls to the AIvengers tab via \`node "${hubScriptPath}" report|ask|poll --agent "${effectiveTag}"\`.${signoffReminder}`;

  const multiRoleBlock = roleDefs.buildMultiRolePromptBlock({
    slotIndex,
    participantTag: effectiveTag,
    modelDisplayName: effectiveDisplayName,
    roleProfile: effectiveProfile,
    rosterSummary,
    hubDir,
    hubScriptPath,
  });

  const vars = {
    agent: effectiveTag,
    agentLabel: effectiveDisplayName,
    role,
    roleLabel,
    roleSummary: effectiveProfile.roleSummary || roleLabel,
    roleColor: effectiveProfile.mixedColor || '#64748B',
    writePermission: effectiveProfile.effectiveWritePermission || 'code-write',
    multiRoleBlock,
    mainAgent: mainAgentTag,
    teamList: teamSummary,
    modelLabel: model?.label || 'Auto',
    modelId: model?.id || 'auto',
    modelNote: modelInstruction,
    messageNumber: String(messageNumber),
    activeMessageDirective,
    attachmentsNote,
    hubDir,
    inboxPath,
    hubScriptPath,
    planRule,
    userPrompt: promptText,
  };

  const agentKey = String(agent.key || agent.tag || '').toLowerCase();
  const savedAgentMap = s.agentPrompts && typeof s.agentPrompts === 'object' ? s.agentPrompts : {};
  const hasSavedAgentCfg = Object.prototype.hasOwnProperty.call(savedAgentMap, agentKey);
  const agentCfg = hasSavedAgentCfg
    ? savedAgentMap[agentKey]
    : DEFAULT_AGENT_PROMPTS[agentKey] || { mode: 'append', template: '' };

  const globalTemplate =
    typeof s.globalPromptTemplate === 'string' && s.globalPromptTemplate.trim()
      ? s.globalPromptTemplate
      : DEFAULT_GLOBAL_PROMPT_TEMPLATE;

  let rendered = '';
  if (agentCfg && agentCfg.mode === 'override' && String(agentCfg.template || '').trim()) {
    rendered = interpolateTemplate(agentCfg.template, vars);
  } else {
    rendered = interpolateTemplate(globalTemplate, vars);
    if (agentCfg && String(agentCfg.template || '').trim()) {
      const extra = interpolateTemplate(agentCfg.template, vars);
      if (extra) rendered = `${rendered}\n\n${extra}`;
    }
  }

  if (!rendered.includes('/assemble')) {
    rendered = `/assemble\n\n${rendered}`;
  }
  if (multiRoleBlock && !rendered.includes('Multi-Role Identity & Markdown Coordination Protocol')) {
    rendered = `${rendered}\n\n${multiRoleBlock}`;
  }
  if (promptText && !rendered.includes(promptText)) {
    rendered = `${rendered}\n\nMessage ${messageNumber} (LATEST):\n${promptText}`;
  }
  return rendered;
}

function toVscodeFileUri(fsPath) {
  if (vscode.Uri && typeof vscode.Uri.file === 'function') {
    const uri = vscode.Uri.file(fsPath);
    if (uri && typeof uri.toString === 'function') {
      const str = uri.toString();
      if (str && !str.startsWith('[object')) return uri;
    }
    return { ...uri, fsPath, toString: () => `file:///${String(fsPath).replace(/\\/g, '/').replace(/^\/+/, '')}` };
  }
  return { fsPath, toString: () => `file:///${String(fsPath).replace(/\\/g, '/').replace(/^\/+/, '')}` };
}

async function launchSingleAgent(
  entry,
  isMain,
  mainAgentTag,
  participantEntries,
  hubDir,
  promptText,
  settings,
  providerRef = null,
  dispatchMeta = {}
) {
  const { agent, model } = entry;
  const {
    messageNumber = 1,
    sessionId = 'default',
    attachments = [],
    slotIndex = typeof entry.slotIndex === 'number' ? entry.slotIndex : 0,
    participantTag = entry.participantTag || agent.tag,
    modelDisplayName = entry.displayName || '',
    roleProfile = entry.roleProfile || null,
    rosterSummary = '',
    providerInstanceIndex = typeof entry.providerInstanceIndex === 'number' ? entry.providerInstanceIndex : 0,
  } = dispatchMeta || {};

  const effTag = participantTag || agent.tag;
  const effModelLabel = modelDisplayName || (model && model.id !== 'auto' ? model.label : `${agent.label} (${model?.label || 'Auto'})`);
  const baseResultMeta = {
    tag: effTag,
    providerTag: agent.tag,
    label: effModelLabel,
    displayName: effModelLabel,
    modelLabel: effModelLabel,
    roleSummary: roleProfile?.roleSummary || '',
    mixedColor: roleProfile?.mixedColor || '#64748B',
  };

  const kickoff = buildKickoffPrompt({
    agent,
    model,
    isMain,
    mainAgentTag,
    participantEntries,
    hubDir,
    promptText,
    settings,
    messageNumber,
    attachments,
    slotIndex,
    participantTag: effTag,
    modelDisplayName: effModelLabel,
    roleProfile,
    rosterSummary,
  });

  if (!agent.installed && agent.launchType !== 'session_sidebar') {
    return { ...baseResultMeta, status: 'inbox_ready' };
  }

  const slotLaunchKey = `${slotIndex}:${agent.key}:${model?.id || 'auto'}`;
  const launchedSet = providerRef?.launchedSessionAgents?.get(sessionId);
  const alreadyInSession = Boolean(
    (launchedSet && (launchedSet.has(slotLaunchKey) || (providerInstanceIndex === 0 && launchedSet.has(agent.tag)))) ||
    messageNumber > 1
  );
  const shouldStartNewChat = Boolean(
    settings?.startNewConversation === true ||
    (!alreadyInSession && messageNumber === 1) ||
    providerInstanceIndex > 0
  );

  const recordLaunched = () => {
    if (providerRef && providerRef.launchedSessionAgents) {
      let set = providerRef.launchedSessionAgents.get(sessionId);
      if (!set) {
        set = new Set();
        providerRef.launchedSessionAgents.set(sessionId, set);
      }
      set.add(slotLaunchKey);
      if (providerInstanceIndex === 0) {
        set.add(agent.tag);
      }
    }
  };

  try {
    if (agent.launchType === 'antigravity') {
      const cmds = await vscode.commands.getCommands(true);
      if (cmds.includes('antigravity.toggleChatFocus')) {
        await withTimeout(vscode.commands.executeCommand('antigravity.toggleChatFocus'), 2500, null);
        await sleep(450);
      } else if (cmds.includes('antigravity.panel.focus')) {
        await withTimeout(vscode.commands.executeCommand('antigravity.panel.focus'), 2000, null);
        await sleep(450);
      }

      if (shouldStartNewChat && cmds.includes('antigravity.startNewConversation')) {
        await withTimeout(vscode.commands.executeCommand('antigravity.startNewConversation'), 2500, null);
        await sleep(450);
      }

      if (cmds.includes('antigravity.addContext') && cmds.includes('antigravity.triggerSend')) {
        const attItems = (Array.isArray(attachments) ? attachments : [])
          .filter((a) => a && a.path)
          .map((a) => ({ type: 'file', uri: toVscodeFileUri(a.path).toString() }));
        if (attItems.length > 0) {
          await withTimeout(vscode.commands.executeCommand('antigravity.addContext', ...attItems, kickoff), 2500, null);
        } else {
          await withTimeout(vscode.commands.executeCommand('antigravity.addContext', kickoff), 2000, null);
        }
        await sleep(250);
        await withTimeout(vscode.commands.executeCommand('antigravity.triggerSend'), 2000, null);
        await sleep(300);
        recordLaunched();
        return {
          ...baseResultMeta,
          status: 'auto_submitted',
        };
      }

      if (cmds.includes('antigravity.panel.focus')) {
        await withTimeout(vscode.commands.executeCommand('antigravity.panel.focus'), 2000, null);
        recordLaunched();
        return { ...baseResultMeta, status: 'opened' };
      }
    }

    if (agent.launchType === 'copilot_chat') {
      const cmds = await vscode.commands.getCommands(true);
      const copilotMustNewChat = shouldStartNewChat || providerInstanceIndex > 0;
      if (copilotMustNewChat && cmds.includes('workbench.action.chat.newChat')) {
        await vscode.commands.executeCommand('workbench.action.chat.newChat');
        await sleep(260);
      }

      const openArgs = {
        mode: 'agent',
        query: kickoff,
        isPartialQuery: false,
      };
      const attachUris = [];
      const inboxPath = path.join(hubDir, 'USER_INBOX.md');
      if (settings.attachInboxFile !== false && fs.existsSync(inboxPath) && vscode.Uri?.file) {
        attachUris.push(vscode.Uri.file(inboxPath));
      }
      if (Array.isArray(attachments) && vscode.Uri?.file) {
        for (const att of attachments) {
          if (att && att.path) {
            attachUris.push(vscode.Uri.file(att.path));
          }
        }
      }
      if (attachUris.length > 0) {
        openArgs.attachFiles = attachUris;
      }

      if (model && model.id && model.id !== 'auto') {
        try {
          await vscode.commands.executeCommand('workbench.action.chat.open', {
            ...openArgs,
            modelSelector: {
              id: model.id,
              vendor: model.vendor || 'copilot',
              family: model.family || model.id,
            },
          });
          recordLaunched();
          return {
            ...baseResultMeta,
            status: 'auto_submitted',
          };
        } catch {
          // Selected model ID may not match active tier's loaded models — retry without modelSelector so prompt still submits
        }
      }

      await vscode.commands.executeCommand('workbench.action.chat.open', openArgs);
      recordLaunched();
      return {
        ...baseResultMeta,
        status: 'auto_submitted',
      };
    }

    if (agent.launchType === 'session_sidebar' && agent.sessionCommand) {
      await vscode.commands.executeCommand(agent.sessionCommand, { prompt: kickoff });
      recordLaunched();
      return {
        ...baseResultMeta,
        status: 'auto_submitted',
      };
    }

    if (agent.launchType === 'claude_ext') {
      const cmds = await vscode.commands.getCommands(true);
      const claudeCmd = [
        'claude-vscode.editor.open',
        'claude-vscode.sidebar.open',
        'claude-code.openChat',
      ].find((c) => cmds.includes(c));
      if (claudeCmd) {
        await vscode.commands.executeCommand(claudeCmd);
        return { ...baseResultMeta, status: 'opened_run_assemble' };
      }
    }

    if (Array.isArray(agent.commandCandidates) && agent.commandCandidates.length > 0) {
      const cmds = await vscode.commands.getCommands(true);
      const match = agent.commandCandidates.find((c) => cmds.includes(c));
      if (match) {
        await vscode.commands.executeCommand(match);
        return { ...baseResultMeta, status: 'opened_run_assemble' };
      }
    }

    const ext = vscode.extensions.getExtension(agent.id);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    return { ...baseResultMeta, status: 'inbox_ready' };
  } catch (err) {
    return {
      ...baseResultMeta,
      status: 'inbox_ready',
      error: err.message || String(err),
    };
  }
}

function getTasksSummary(hubDir) {
  try {
    const tasksPath = path.join(hubDir, 'TASKS.md');
    if (!fs.existsSync(tasksPath)) return { active: 0, done: 0, total: 0 };
    const content = fs.readFileSync(tasksPath, 'utf8');
    let active = 0;
    let done = 0;
    for (const line of content.split(/\r?\n/)) {
      if (!/^###\s+`TASK-/i.test(line)) continue;
      if (/\[DONE\]/i.test(line)) {
        done++;
      } else if (!/@Unassigned\s*·\s*Team Assembly & Shared Plan/i.test(line)) {
        active++;
      }
    }
    return { active, done, total: active + done };
  } catch {
    return { active: 0, done: 0, total: 0 };
  }
}

/**
 * Manages the AIvengers secondary sidebar webview tab, settings, model pickers, and orchestration.
 */
class VibeCodingViewProvider {
  constructor(context) {
    this.context = context;
    this.view = null;
    this.hubDir = resolveHubDir(context);
    this.installedAgents = [];
    this.latestPeers = null;
    this.latestSessions = [];
    this.watchers = [];
    this.pollTimer = null;
    this.refreshDebounceTimer = null;
    this.liveModelRetryTimer = null;
    this.fallbackTimers = new Set();
    this.activeChildProcesses = new Set();
    this.launchedSessionAgents = new Map();
  }

  scheduleFallbackTimer(delayMs, fn) {
    const t = setTimeout(() => {
      this.fallbackTimers.delete(t);
      try {
        fn();
      } catch {}
    }, delayMs);
    this.fallbackTimers.add(t);
    return t;
  }

  clearFallbackTimers() {
    for (const t of this.fallbackTimers) {
      clearTimeout(t);
    }
    this.fallbackTimers.clear();
  }

  killActiveChildProcesses() {
    for (const child of this.activeChildProcesses) {
      try {
        if (typeof child.kill === 'function') {
          child.kill('SIGTERM');
        }
      } catch {}
    }
    this.activeChildProcesses.clear();
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    const mediaRoot = path.join(this.context?.extensionPath || this.hubDir || __dirname, 'media');
    const localRoots =
      vscode.Uri && typeof vscode.Uri.file === 'function'
        ? [this.hubDir, mediaRoot]
            .filter((p, i, arr) => Boolean(p) && arr.indexOf(p) === i)
            .map((p) => vscode.Uri.file(p))
        : [];
    webviewView.webview.options = {
      enableScripts: true,
      ...(localRoots.length > 0 ? { localResourceRoots: localRoots } : {}),
    };
    webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      this.handleWebviewMessage(msg).catch((err) => {
        this.postMessage({ type: 'error', message: err.message || String(err) });
      });
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshState(true);
      }
    });

    webviewView.onDidDispose(() => {
      this.disposeWatchers();
      this.clearFallbackTimers();
      this.view = null;
    });

    this.setupWatchers();
    this.refreshAgents().then(() => this.refreshState(true));
  }

  postMessage(payload) {
    if (this.view) {
      this.view.webview.postMessage(payload);
    }
  }

  getSettings() {
    const stored = this.context.workspaceState.get(STATE_SETTINGS_KEY) || {};
    let cfg = {};
    try {
      const legacyCfg = vscode.workspace.getConfiguration('vibeCoding');
      if (legacyCfg) {
        for (const k of Object.keys(DEFAULT_SETTINGS)) {
          const val = legacyCfg.get(k);
          if (val !== undefined) cfg[k] = val;
        }
      }
      const vsCfg = vscode.workspace.getConfiguration('aivengers');
      if (vsCfg) {
        for (const k of Object.keys(DEFAULT_SETTINGS)) {
          const val = vsCfg.get(k);
          if (val !== undefined) cfg[k] = val;
        }
      }
    } catch {}
    return { ...DEFAULT_SETTINGS, ...cfg, ...stored };
  }

  async saveSettings(patch) {
    const merged = { ...this.getSettings(), ...(patch || {}) };
    await this.context.workspaceState.update(STATE_SETTINGS_KEY, merged);
    try {
      const vsCfg = vscode.workspace.getConfiguration('aivengers');
      if (vsCfg && typeof vsCfg.update === 'function') {
        for (const [k, v] of Object.entries(patch || {})) {
          await vsCfg.update(k, v, vscode.ConfigurationTarget.Global);
        }
      }
    } catch {}
    this.postMessage({ type: 'settings', settings: merged });
    return merged;
  }

  normalizeSlots(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
      return [null];
    }
    return raw.map((item, idx) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const profile = roleDefs.resolveEffectiveSlotProfile(undefined, idx === 0);
        return {
          agentKey: item.toLowerCase(),
          modelId: 'auto',
          modelLabel: 'Auto (Default)',
          roleIds: profile.roleIds,
          roleSummary: profile.roleSummary,
          mixedColor: profile.mixedColor,
          textColor: profile.textColor,
          writePermission: profile.effectiveWritePermission,
          hubEscalation: profile.effectiveHubEscalation,
        };
      }
      if (item && typeof item === 'object' && item.agentKey) {
        const rawRoles = Array.isArray(item.roleIds)
          ? item.roleIds
          : item.roleId
            ? [item.roleId]
            : undefined;
        const profile = roleDefs.resolveEffectiveSlotProfile(rawRoles, idx === 0);
        return {
          agentKey: String(item.agentKey).toLowerCase(),
          modelId: item.modelId || 'auto',
          modelLabel: item.modelLabel || 'Auto',
          vendor: item.vendor || undefined,
          family: item.family || undefined,
          roleIds: profile.roleIds,
          roleSummary: profile.roleSummary,
          mixedColor: profile.mixedColor,
          textColor: profile.textColor,
          writePermission: profile.effectiveWritePermission,
          hubEscalation: profile.effectiveHubEscalation,
        };
      }
      return null;
    });
  }

  getSavedSlots() {
    return this.normalizeSlots(this.context.workspaceState.get(STATE_SLOTS_KEY));
  }

  async saveSlots(slots) {
    const sanitized = this.normalizeSlots(slots);
    await this.context.workspaceState.update(STATE_SLOTS_KEY, sanitized);
  }

  async refreshAgents() {
    this.hubDir = resolveHubDir(this.context);
    const settings = this.getSettings();
    this.installedAgents = await discoverInstalledAgents(settings);

    const copilotAgent = this.installedAgents.find((a) => a.key === '@copilot');
    if (copilotAgent && copilotAgent.planInfo && copilotAgent.planInfo.liveModelCount === 0 && !this.liveModelRetryTimer) {
      this.liveModelRetryTimer = setTimeout(() => {
        this.liveModelRetryTimer = null;
        this.refreshAgents().catch(() => {});
      }, 2500);
    } else if (copilotAgent && copilotAgent.planInfo && copilotAgent.planInfo.liveModelCount > 0 && this.liveModelRetryTimer) {
      clearTimeout(this.liveModelRetryTimer);
      this.liveModelRetryTimer = null;
    }

    this.postMessage({
      type: 'agents',
      agents: this.installedAgents,
      slots: this.getSavedSlots(),
      settings,
      hubDir: this.hubDir,
      defaultGlobalTemplate: DEFAULT_GLOBAL_PROMPT_TEMPLATE,
      defaultAgentPrompts: DEFAULT_AGENT_PROMPTS,
      roleCategories: roleDefs.ROLE_CATEGORIES,
      roleRegistry: roleDefs.ROLE_REGISTRY,
      teamPresets: roleDefs.TEAM_ROLE_PRESETS,
    });
  }

  async refreshState(includePeers = false) {
    this.hubDir = resolveHubDir(this.context);
    const feedPath = path.join(this.hubDir, 'VIBE_FEED.json');
    const presencePath = path.join(this.hubDir, 'AGENT_PRESENCE.json');
    const feed = readJsonSafe(feedPath, { updatedAt: '', items: [] });
    const presence = readJsonSafe(presencePath, {
      mainAgent: null,
      expectedParticipants: [],
      agentModels: {},
      plan: { status: 'NONE', approvedByUser: false },
      agents: {},
    });

    if (includePeers) {
      try {
        const raw = await execHubCommand(this.hubDir, ['peers', '--json']);
        this.latestPeers = JSON.parse(raw);
      } catch {}
      try {
        const rawSessions = await execHubCommand(this.hubDir, ['sessions', '--json']);
        const parsedSessions = JSON.parse(rawSessions);
        if (parsedSessions && Array.isArray(parsedSessions.sessions)) {
          this.latestSessions = parsedSessions.sessions;
        }
      } catch {}
    }

    let currentSlots = this.getSavedSlots();
    if (
      Array.isArray(presence.savedSlots) &&
      presence.savedSlots.some(Boolean) &&
      !currentSlots.some(Boolean)
    ) {
      await this.saveSlots(presence.savedSlots);
      currentSlots = this.getSavedSlots();
    }

    this.postMessage({
      type: 'state',
      hubDir: this.hubDir,
      feed,
      presence,
      peers: this.latestPeers,
      sessions: this.latestSessions,
      tasksSummary: getTasksSummary(this.hubDir),
      slots: currentSlots,
      settings: this.getSettings(),
    });
  }

  setupWatchers() {
    this.disposeWatchers();
    const watchedNames = ['VIBE_FEED.json', 'AGENT_PRESENCE.json', 'USER_INBOX.md', 'TASKS.md'];
    const scheduleRefresh = () => {
      if (this.refreshDebounceTimer) {
        clearTimeout(this.refreshDebounceTimer);
      }
      this.refreshDebounceTimer = setTimeout(() => {
        this.refreshState(true);
      }, 180);
    };

    for (const fileName of watchedNames) {
      try {
        const pattern = new vscode.RelativePattern(this.hubDir, fileName);
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange(scheduleRefresh);
        watcher.onDidCreate(scheduleRefresh);
        watcher.onDidDelete(scheduleRefresh);
        this.watchers.push(watcher);
      } catch {}
    }

    this.pollTimer = setInterval(() => {
      if (this.view && this.view.visible) {
        this.refreshState(true);
      }
    }, 5000);
  }

  disposeWatchers() {
    for (const w of this.watchers) {
      try {
        w.dispose();
      } catch {}
    }
    this.watchers = [];
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
    if (this.liveModelRetryTimer) {
      clearTimeout(this.liveModelRetryTimer);
      this.liveModelRetryTimer = null;
    }
  }

  async pickAttachments({ folder = false } = {}) {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: !folder,
      canSelectFolders: Boolean(folder),
      openLabel: folder ? 'Attach Folder(s)' : 'Attach File(s)',
    });
    if (!picked || !Array.isArray(picked)) return [];
    const results = [];
    for (const uri of picked) {
      const fsPath = uri && (uri.fsPath || uri.path);
      if (!fsPath) continue;
      let isDirectory = Boolean(folder);
      try {
        if (fs.existsSync(fsPath)) {
          isDirectory = fs.statSync(fsPath).isDirectory();
        }
      } catch {}
      results.push({
        path: fsPath,
        name: path.basename(fsPath) || fsPath,
        isDirectory,
      });
    }
    return results;
  }

  async cancelOngoingSession(reason = 'Stopped by user in AIvengers tab') {
    this.clearFallbackTimers();
    this.killActiveChildProcesses();

    const presence = readJsonSafe(path.join(this.hubDir, 'AGENT_PRESENCE.json'), {});
    const expected = Array.isArray(presence.expectedParticipants) ? presence.expectedParticipants : [];
    const antigravityWasParticipant = expected.some((t) => String(t).toLowerCase() === '@antigravity');

    // Mark hub cancelled FIRST so any running agent CLI/MCP/hub commands abort immediately with exit code 4
    try {
      await execHubCommand(this.hubDir, ['cancel', '--reason', reason, '--json']);
    } catch {}

    try {
      const cmds = await withTimeout(vscode.commands.getCommands(true), 2000, []);
      const cmdSet = new Set(Array.isArray(cmds) ? cmds : []);

      // Cancel VS Code native chat / Copilot Chat turns
      for (const cancelCmd of [
        'workbench.action.chat.cancel',
        'workbench.action.chat.localModel.cancel',
        'workbench.action.chat.stopAgentHostProfile',
      ]) {
        if (cmdSet.has(cancelCmd)) {
          await withTimeout(vscode.commands.executeCommand(cancelCmd), 1500, null).catch(() => {});
        }
      }

      // Cancel Antigravity turn via interrupt/cancel command if present; NEVER startNewConversation (keep session continuity)
      const agyCancelCmds = (Array.isArray(cmds) ? cmds : []).filter((c) =>
        /^antigravity\..*(cancel|stop|abort|interrupt)/i.test(c)
      );
      for (const c of agyCancelCmds) {
        await withTimeout(vscode.commands.executeCommand(c), 1500, null).catch(() => {});
      }
      if (agyCancelCmds.length === 0 && antigravityWasParticipant) {
        if (cmdSet.has('antigravity.toggleChatFocus')) {
          await withTimeout(vscode.commands.executeCommand('antigravity.toggleChatFocus'), 1500, null).catch(() => {});
          await sleep(250);
        } else if (cmdSet.has('antigravity.panel.focus')) {
          await withTimeout(vscode.commands.executeCommand('antigravity.panel.focus'), 1500, null).catch(() => {});
          await sleep(250);
        }
        if (cmdSet.has('antigravity.addContext') && cmdSet.has('antigravity.triggerSend')) {
          const stopDirective = `🛑 STOP: The user cancelled this AIvengers session (${reason}). Stop working immediately, do not edit any files, and do not run further commands.`;
          await withTimeout(vscode.commands.executeCommand('antigravity.addContext', stopDirective), 1500, null).catch(() => {});
          await sleep(200);
          await withTimeout(vscode.commands.executeCommand('antigravity.triggerSend'), 1500, null).catch(() => {});
        }
      }
    } catch {}

    this.postMessage({ type: 'dispatching', active: false });
    this.postMessage({ type: 'sessionCancelled' });
    await this.refreshState(true);
  }

  async handleDispatch(rawSlots, promptText, rawAttachments = []) {
    const cleanPrompt = String(promptText || '').trim();
    if (!cleanPrompt) {
      this.postMessage({ type: 'error', message: 'Please enter a prompt before sending.' });
      return;
    }

    this.clearFallbackTimers();

    const normalizedAttachments = [];
    const seenAttPaths = new Set();
    for (const att of Array.isArray(rawAttachments) ? rawAttachments : []) {
      const attPath = typeof att === 'string' ? att.trim() : att && att.path ? String(att.path).trim() : '';
      if (!attPath || seenAttPaths.has(attPath)) continue;
      seenAttPaths.add(attPath);
      let isDirectory = Boolean(att && att.isDirectory);
      try {
        if (fs.existsSync(attPath)) {
          isDirectory = fs.statSync(attPath).isDirectory();
        }
      } catch {}
      normalizedAttachments.push({
        path: attPath,
        name: (att && att.name) || path.basename(attPath) || attPath,
        isDirectory,
      });
    }

    const settings = this.getSettings();
    const slots = this.normalizeSlots(rawSlots);
    const agentsByKey = new Map(this.installedAgents.map((a) => [a.key, a]));

    const slot1 = slots[0];
    const slot1Agent = slot1 ? agentsByKey.get(slot1.agentKey) : null;
    if (!slot1Agent) {
      this.postMessage({
        type: 'error',
        message: 'Slot 1 (Main) requires a selected coding agent before sending a message.',
      });
      return;
    }

    const validSlotEntries = [];
    const baseTagTotals = new Map();
    for (const s of slots) {
      const agent = s ? agentsByKey.get(s.agentKey) : null;
      if (!agent) continue;
      baseTagTotals.set(agent.tag, (baseTagTotals.get(agent.tag) || 0) + 1);
      validSlotEntries.push({ slot: s, agent });
    }

    const selectedEntries = [];
    const baseTagSeen = new Map();
    const usedParticipantTags = new Set();
    const displayNameTotals = new Map();
    const slotMetaMap = {};

    for (let entryIdx = 0; entryIdx < validSlotEntries.length; entryIdx++) {
      const { slot: s, agent } = validSlotEntries[entryIdx];
      const matchedModel =
        (agent.models || []).find((m) => m.id === s.modelId) ||
        (s.modelId && s.modelId !== 'auto'
          ? { id: s.modelId, label: s.modelLabel || s.modelId, vendor: s.vendor, family: s.family }
          : (agent.models || [])[0] || { id: 'auto', label: 'Auto' });

      const providerInstanceIndex = baseTagSeen.get(agent.tag) || 0;
      baseTagSeen.set(agent.tag, providerInstanceIndex + 1);
      const totalForBase = baseTagTotals.get(agent.tag) || 1;

      let participantTag = agent.tag;
      if (totalForBase > 1) {
        const cleanModelSlug = String(matchedModel.id && matchedModel.id !== 'auto' ? matchedModel.id : `slot-${entryIdx + 1}`)
          .replace(/[^A-Za-z0-9._-]+/g, '-');
        participantTag = `${agent.tag}:${cleanModelSlug}`;
        if (usedParticipantTags.has(participantTag)) {
          participantTag = `${participantTag}#${entryIdx + 1}`;
        }
      }
      usedParticipantTags.add(participantTag);

      let baseDisplayName =
        matchedModel && matchedModel.id && matchedModel.id !== 'auto' && matchedModel.label
          ? matchedModel.label
          : `${agent.label} (${matchedModel?.label || 'Auto'})`;
      const nameCount = (displayNameTotals.get(baseDisplayName) || 0) + 1;
      displayNameTotals.set(baseDisplayName, nameCount);
      const displayName = nameCount > 1 ? `${baseDisplayName} (#${nameCount})` : baseDisplayName;

      const roleProfile = roleDefs.resolveEffectiveSlotProfile(
        Array.isArray(s.roleIds) ? s.roleIds : s.roleId ? [s.roleId] : undefined,
        entryIdx === 0
      );

      slotMetaMap[participantTag] = {
        tag: participantTag,
        providerTag: agent.tag,
        modelId: matchedModel.id || 'auto',
        modelLabel: matchedModel.label || 'Auto',
        displayName,
        roleIds: roleProfile.roleIds,
        roleSummary: roleProfile.roleSummary,
        mixedColor: roleProfile.mixedColor,
        textColor: roleProfile.textColor,
        writePermission: roleProfile.effectiveWritePermission,
        hubEscalation: roleProfile.effectiveHubEscalation,
        slotIndex: entryIdx,
      };

      selectedEntries.push({
        agent,
        model: matchedModel,
        modelId: matchedModel.id,
        modelLabel: matchedModel.label,
        slotIndex: entryIdx,
        providerInstanceIndex,
        participantTag,
        displayName,
        roleProfile,
      });
    }

    const participantTags = selectedEntries.map((e) => e.participantTag);
    const mainAgentTag = selectedEntries[0].participantTag;
    const modelsMap = {};
    for (const e of selectedEntries) {
      modelsMap[e.participantTag] = { id: e.model.id || 'auto', label: e.displayName };
    }
    const rosterSummary = selectedEntries
      .map(
        (e, i) =>
          `  - Slot ${i + 1}${i === 0 ? ' (Main)' : ''}: ${e.displayName} [ID: ${e.participantTag}] — Roles: ${e.roleProfile.roleSummary || 'None (Unrestricted)'} (${e.roleProfile.mixedColor}) | Tier: ${e.roleProfile.effectiveWritePermission}`
      )
      .join('\n');

    this.postMessage({ type: 'dispatching', active: true });

    let tempPromptFile = null;
    try {
      const enrichedSlots = selectedEntries.map((e) => ({
        agentKey: e.agent.key,
        modelId: e.modelId,
        modelLabel: e.modelLabel,
        displayName: e.displayName,
        participantTag: e.participantTag,
        vendor: e.model.vendor || undefined,
        family: e.model.family || undefined,
        roleIds: e.roleProfile.roleIds,
        roleSummary: e.roleProfile.roleSummary,
        mixedColor: e.roleProfile.mixedColor,
        textColor: e.roleProfile.textColor,
        writePermission: e.roleProfile.effectiveWritePermission,
        hubEscalation: e.roleProfile.effectiveHubEscalation,
      }));
      const args = [
        'dispatch',
        '--main',
        mainAgentTag,
        '--agents',
        participantTags.join(','),
        '--slots',
        JSON.stringify(enrichedSlots),
        '--slot-meta',
        JSON.stringify(slotMetaMap),
        '--json',
      ];
      if (Object.keys(modelsMap).length > 0) {
        args.push('--models', JSON.stringify(modelsMap));
      }
      if (normalizedAttachments.length > 0) {
        args.push('--attachments', JSON.stringify(normalizedAttachments));
      }
      if (cleanPrompt.length > 6000) {
        tempPromptFile = path.join(this.hubDir, `.tmp_prompt_${Date.now()}.txt`);
        fs.writeFileSync(tempPromptFile, cleanPrompt, 'utf8');
        args.push('--prompt-file', tempPromptFile);
      } else {
        args.push('--prompt', cleanPrompt);
      }

      const raw = await execHubCommand(this.hubDir, args);
      const dispatchResult = JSON.parse(raw);
      const dispatchMeta = {
        messageNumber: dispatchResult?.messageNumber || 1,
        sessionId: dispatchResult?.sessionId || 'default',
        attachments:
          Array.isArray(dispatchResult?.attachments) && dispatchResult.attachments.length > 0
            ? dispatchResult.attachments
            : normalizedAttachments,
        rosterSummary,
      };

      let launchResults = [];
      if (settings.autoLaunchAgents !== false) {
        const resultByIndex = new Array(selectedEntries.length);

        // 1. Launch Antigravity FIRST sequentially so Copilot Chat focus does not preempt Antigravity addContext/triggerSend
        for (let idx = 0; idx < selectedEntries.length; idx++) {
          const entry = selectedEntries[idx];
          if (entry.agent.launchType === 'antigravity') {
            resultByIndex[idx] = await launchSingleAgent(
              entry,
              idx === 0,
              mainAgentTag,
              selectedEntries,
              this.hubDir,
              cleanPrompt,
              settings,
              this,
              {
                ...dispatchMeta,
                slotIndex: entry.slotIndex,
                participantTag: entry.participantTag,
                modelDisplayName: entry.displayName,
                roleProfile: entry.roleProfile,
                providerInstanceIndex: entry.providerInstanceIndex,
              }
            );
            await sleep(500);
          }
        }

        // 2. Launch remaining agents sequentially for native chat UIs or concurrently for extension activations
        let chatChain = Promise.resolve();
        const enqueueChat = (fn) => {
          const next = chatChain.then(fn, fn);
          chatChain = next.then(() => sleep(450), () => sleep(450));
          return next;
        };

        await Promise.all(
          selectedEntries.map(async (entry, idx) => {
            if (entry.agent.launchType === 'antigravity') return;
            const isNativeChat =
              entry.agent.launchType === 'copilot_chat' ||
              entry.agent.launchType === 'session_sidebar';
            const run = () =>
              launchSingleAgent(
                entry,
                idx === 0,
                mainAgentTag,
                selectedEntries,
                this.hubDir,
                cleanPrompt,
                settings,
                this,
                {
                  ...dispatchMeta,
                  slotIndex: entry.slotIndex,
                  participantTag: entry.participantTag,
                  modelDisplayName: entry.displayName,
                  roleProfile: entry.roleProfile,
                  providerInstanceIndex: entry.providerInstanceIndex,
                }
              );
            resultByIndex[idx] = isNativeChat ? await enqueueChat(run) : await run();
          })
        );

        launchResults = resultByIndex.filter(Boolean);
      } else {
        launchResults = selectedEntries.map((e) => ({
          tag: e.participantTag,
          providerTag: e.agent.tag,
          label: e.displayName,
          displayName: e.displayName,
          modelLabel: e.displayName,
          roleSummary: e.roleProfile.roleSummary,
          mixedColor: e.roleProfile.mixedColor,
          status: 'inbox_ready',
        }));
      }

      if (dispatchResult?.entry?.id) {
        const feedPath = path.join(this.hubDir, 'VIBE_FEED.json');
        const feed = readJsonSafe(feedPath, null);
        if (feed && Array.isArray(feed.items)) {
          const item = feed.items.find((i) => i.id === dispatchResult.entry.id);
          if (item) {
            item.launchResults = launchResults;
            fs.writeFileSync(feedPath, JSON.stringify(feed, null, 2) + '\n', 'utf8');
          }
        }
      }

      if (settings.keepFocusOnSend !== false && settings.autoLaunchAgents !== false) {
        setTimeout(() => {
          vscode.commands.executeCommand(`${VIEW_ID}.focus`).then(undefined, () => {});
        }, 750);
      }

      await this.refreshState(true);
    } finally {
      if (tempPromptFile && fs.existsSync(tempPromptFile)) {
        try {
          fs.unlinkSync(tempPromptFile);
        } catch {}
      }
      this.postMessage({ type: 'dispatching', active: false });
    }
  }

  async handleWebviewMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ready':
        await this.refreshAgents();
        await this.refreshState(true);
        break;

      case 'refreshAgents':
        await this.refreshAgents();
        await this.refreshState(true);
        break;

      case 'updateSlots':
        await this.saveSlots(msg.slots);
        break;

      case 'saveSettings': {
        await this.saveSettings(msg.patch);
        await this.refreshAgents();
        break;
      }

      case 'addCustomModel': {
        const entry = msg.model;
        if (!entry || !entry.agentKey || !entry.id) return;
        const current = this.getSettings();
        const nextList = [
          ...(Array.isArray(current.customModels) ? current.customModels : []).filter(
            (c) =>
              !(
                String(c.agentKey).toLowerCase() === String(entry.agentKey).toLowerCase() &&
                String(c.id).toLowerCase() === String(entry.id).toLowerCase()
              )
          ),
          {
            agentKey: String(entry.agentKey).toLowerCase(),
            id: String(entry.id).trim(),
            label: String(entry.label || entry.id).trim(),
            group: String(entry.group || 'Custom Models').trim(),
          },
        ];
        await this.saveSettings({ customModels: nextList });
        await this.refreshAgents();
        break;
      }

      case 'removeCustomModel': {
        const current = this.getSettings();
        const nextList = (Array.isArray(current.customModels) ? current.customModels : []).filter(
          (c) =>
            !(
              String(c.agentKey).toLowerCase() === String(msg.agentKey || '').toLowerCase() &&
              String(c.id).toLowerCase() === String(msg.id || '').toLowerCase()
            )
        );
        await this.saveSettings({ customModels: nextList });
        await this.refreshAgents();
        break;
      }

      case 'dispatch':
        await this.saveSlots(msg.slots);
        await this.handleDispatch(msg.slots, msg.prompt, msg.attachments || []);
        break;

      case 'pickAttachments': {
        const picked = await this.pickAttachments({ folder: Boolean(msg.folder) });
        if (picked.length > 0) {
          this.postMessage({ type: 'attachmentsPicked', attachments: picked });
        }
        break;
      }

      case 'replyQuestion': {
        const itemId = String(msg.itemId || '').trim();
        const answer = String(msg.answer || '').trim();
        if (!itemId || !answer) return;
        await execHubCommand(this.hubDir, ['reply', '--id', itemId, '--answer', answer, '--json']);
        await this.refreshState(true);
        break;
      }

      case 'replyPoll': {
        const itemId = String(msg.itemId || '').trim();
        const selectedOptions = Array.isArray(msg.selectedOptions) ? msg.selectedOptions : [];
        const customAnswer = String(msg.answer || '').trim();
        if (!itemId) return;
        const hasOthers = selectedOptions.some((o) =>
          String(o).trim().toLowerCase().startsWith(OTHERS_PREFIX)
        );
        if (selectedOptions.length === 0 && !customAnswer) {
          this.postMessage({ type: 'error', message: 'Select an option before submitting.' });
          return;
        }
        if (hasOthers && !customAnswer) {
          this.postMessage({
            type: 'error',
            message: 'Please type your custom answer for "Others".',
          });
          return;
        }
        const args = ['reply', '--id', itemId, '--json'];
        if (selectedOptions.length > 0) {
          args.push('--options', JSON.stringify(selectedOptions));
        }
        if (customAnswer) {
          args.push('--answer', customAnswer);
        }
        await execHubCommand(this.hubDir, args);
        await this.refreshState(true);
        break;
      }

      case 'newSession':
        await this.newSession(msg.title);
        break;

      case 'cancelSession':
        await this.cancelOngoingSession(msg.reason || 'Cancelled by user in AIvengers tab');
        break;

      case 'switchSession': {
        if (!msg.folder) return;
        this.clearFallbackTimers();
        this.launchedSessionAgents.clear();
        const rawSwitch = await execHubCommand(this.hubDir, ['session', 'switch', String(msg.folder), '--json']);
        let restoredSlots = null;
        try {
          const parsed = JSON.parse(rawSwitch);
          const candidate = parsed?.presence?.savedSlots || parsed?.session?.savedSlots;
          if (Array.isArray(candidate) && candidate.some(Boolean)) {
            await this.saveSlots(candidate);
            restoredSlots = this.getSavedSlots();
          }
        } catch {}
        await this.refreshState(true);
        if (restoredSlots) {
          this.postMessage({ type: 'sessionSwitched', slots: restoredSlots });
        }
        break;
      }

      case 'renameSession': {
        if (!msg.folder || !msg.title) return;
        await execHubCommand(this.hubDir, [
          'session',
          'rename',
          String(msg.folder),
          '--title',
          String(msg.title).trim(),
          '--json',
        ]);
        await this.refreshState(true);
        break;
      }

      case 'deleteSession': {
        if (!msg.folder) return;
        await execHubCommand(this.hubDir, ['session', 'delete', String(msg.folder), '--json']);
        await this.refreshState(true);
        break;
      }

      case 'savePromptTemplates': {
        const patch = {};
        if (typeof msg.globalPromptTemplate === 'string') {
          patch.globalPromptTemplate = msg.globalPromptTemplate;
        }
        if (msg.agentPrompts && typeof msg.agentPrompts === 'object') {
          patch.agentPrompts = msg.agentPrompts;
        }
        if (typeof msg.antigravityLaunchMode === 'string') {
          patch.antigravityLaunchMode = msg.antigravityLaunchMode;
        }
        await this.saveSettings(patch);
        await this.refreshState(false);
        break;
      }

      case 'resetPromptTemplates': {
        const current = this.getSettings();
        const nextAgentPrompts = { ...(current.agentPrompts || {}) };
        if (msg.agentKey) {
          delete nextAgentPrompts[String(msg.agentKey).toLowerCase()];
          await this.saveSettings({ agentPrompts: nextAgentPrompts });
        } else {
          await this.saveSettings({ globalPromptTemplate: '', agentPrompts: {} });
        }
        await this.refreshState(false);
        break;
      }

      case 'openInbox':
        await this.openInboxFile();
        break;

      case 'openTasks':
        await this.openHubMarkdownFile('TASKS.md');
        break;

      case 'openComms':
        await this.openHubMarkdownFile('AGENT_COMMUNICATION.md');
        break;

      case 'openAgentsDoc':
        await this.openHubMarkdownFile('AGENTS.md');
        break;

      case 'initWorkspaceHub':
        await this.initWorkspaceHub();
        break;

      case 'copyText':
        if (msg.text) {
          await vscode.env.clipboard.writeText(String(msg.text));
          vscode.window.showInformationMessage(String(msg.toast || 'Copied to clipboard.'));
        }
        break;

      case 'openVsCodeSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aivengers.');
        break;

      case 'openFile':
        if (msg.filePath) {
          const resolved = path.isAbsolute(msg.filePath)
            ? msg.filePath
            : path.resolve(this.hubDir, msg.filePath);
          if (fs.existsSync(resolved)) {
            const uri = vscode.Uri.file(resolved);
            let isDir = false;
            try {
              isDir = fs.statSync(resolved).isDirectory();
            } catch {}
            if (isDir) {
              await vscode.commands.executeCommand('revealInExplorer', uri);
            } else {
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, { preview: true });
            }
          }
        }
        break;

      case 'copyKickoff':
        if (msg.promptText) {
          const presence = readJsonSafe(path.join(this.hubDir, 'AGENT_PRESENCE.json'), {});
          const mainTag = presence.mainAgent || 'Slot 1 Main';
          const team =
            Array.isArray(presence.expectedParticipants) && presence.expectedParticipants.length > 0
              ? presence.expectedParticipants
              : [];
          const text = `/assemble — Team: ${team.join(', ')} (Main: ${mainTag}). Check "${path.join(this.hubDir, 'USER_INBOX.md')}" and follow AGENTS.md.\n\nPrompt:\n${msg.promptText}`;
          await vscode.env.clipboard.writeText(text);
          vscode.window.showInformationMessage('Copied /assemble kickoff prompt to clipboard.');
        }
        break;
    }
  }

  openSettingsPanel() {
    this.postMessage({ type: 'toggleSettings', open: true });
  }

  openHistoryPanel() {
    this.postMessage({ type: 'toggleHistory', open: true });
  }

  openGuidePanel() {
    this.postMessage({ type: 'toggleGuide', open: true });
  }

  async newSession(title) {
    this.clearFallbackTimers();
    this.launchedSessionAgents.clear();
    this.hubDir = resolveHubDir(this.context);
    await execHubCommand(this.hubDir, ['session', 'new', String(title || 'New Collaboration'), '--json']);
    await this.refreshState(true);
  }

  async openHubMarkdownFile(fileName) {
    this.hubDir = resolveHubDir(this.context);
    const targetPath = path.join(this.hubDir, fileName);
    if (fs.existsSync(targetPath)) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
      await vscode.window.showTextDocument(doc, { preview: false });
    } else {
      this.postMessage({ type: 'error', message: `${fileName} not found in AIvengers hub folder.` });
    }
  }

  async openInboxFile() {
    return this.openHubMarkdownFile('USER_INBOX.md');
  }

  async initWorkspaceHub() {
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length === 0) {
      vscode.window.showErrorMessage('Open a project folder in VS Code first to initialize an AIvengers hub.');
      return;
    }
    const workspaceRoot = folders[0].uri.fsPath;
    if (isHubDirectory(workspaceRoot)) {
      this.hubDir = workspaceRoot;
      this.setupWatchers();
      await this.refreshState(true);
      vscode.window.showInformationMessage(`AIvengers hub is already active at ${workspaceRoot}`);
      return;
    }

    const destDir = path.join(workspaceRoot, 'vibe coding tools');
    if (isHubDirectory(destDir)) {
      this.hubDir = destDir;
      this.setupWatchers();
      await this.refreshState(true);
      vscode.window.showInformationMessage(`AIvengers hub is already active at ${destDir}`);
      return;
    }

    const srcDir = this.context?.extensionPath || __dirname;
    const copyTree = (src, dst) => {
      if (!fs.existsSync(src)) return;
      const st = fs.statSync(src);
      if (st.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true });
        for (const item of fs.readdirSync(src)) {
          copyTree(path.join(src, item), path.join(dst, item));
        }
      } else {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
    };

    try {
      fs.mkdirSync(destDir, { recursive: true });
      for (const rel of ['scripts', 'src', '.github', '.agents', 'AGENTS.md', 'GEMINI.md', 'CLAUDE.md', '.cursorrules']) {
        copyTree(path.join(srcDir, rel), path.join(destDir, rel));
      }
      await execHubCommand(destDir, ['session', 'new', 'New Collaboration', '--json']);
      this.hubDir = destDir;
      this.setupWatchers();
      await this.refreshAgents();
      await this.refreshState(true);
      vscode.window.showInformationMessage(`Initialized drop-in AIvengers hub at "${destDir}".`);
    } catch (err) {
      const msg = err.message || String(err);
      this.postMessage({ type: 'error', message: `Could not initialize workspace hub: ${msg}` });
    }
  }

  getLogoUri(webview) {
    try {
      const iconPath = path.join(this.context?.extensionPath || __dirname, 'media', 'icon.png');
      if (!fs.existsSync(iconPath)) return '';
      if (webview && typeof webview.asWebviewUri === 'function' && vscode.Uri?.file) {
        const uri = String(webview.asWebviewUri(vscode.Uri.file(iconPath)));
        if (uri && !uri.startsWith('[object')) return uri;
      }
      return `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;
    } catch {
      return '';
    }
  }

  getWebviewHtml(webview) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const logoUri = this.getLogoUri(webview);
    const headerBrandImg = logoUri
      ? `<img class="brand-logo-sm" src="${logoUri}" alt="AIvengers" />`
      : '<span aria-hidden="true">⚡</span>';
    const guideBrandImg = logoUri
      ? `<img class="brand-logo-lg" src="${logoUri}" alt="AIvengers" />`
      : '<div class="empty-mark">AI</div>';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIvengers</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --fg: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border, rgba(128, 128, 128, 0.22));
      --surface: var(--vscode-editor-background);
      --surface-hover: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.14));
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border, rgba(128, 128, 128, 0.35));
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --btn-sec-bg: var(--vscode-button-secondaryBackground);
      --btn-sec-fg: var(--vscode-button-secondaryForeground);
      --accent: var(--vscode-focusBorder, #3b82f6);
      --ok: #22c55e;
      --warn: #f59e0b;
      --err: #ef4444;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      overflow: hidden;
    }

    .app {
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: relative;
    }

    /* Clean Chat Toolbar */
    .header-bar {
      padding: 7px 10px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .team-pills {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
      min-width: 0;
      flex: 1;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 24px;
      padding: 0 7px;
      border-radius: 5px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--fg);
      font-size: 11.5px;
      cursor: pointer;
    }
    .icon-btn:hover, .icon-btn.active {
      background: var(--surface-hover);
      border-color: var(--border);
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(128, 128, 128, 0.12);
      border: 1.5px solid var(--pill-color, var(--border));
      white-space: nowrap;
    }
    .role-mini-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.32);
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .dot.running { background: #eab308; }
    .dot.idle { background: #22c55e; }
    .dot.waiting { background: #3b82f6; }
    .dot.offline { background: #71717a; }
    .dot.credit { background: #ef4444; }

    .plan-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 9px;
      border-radius: 6px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.35);
      font-size: 11.5px;
    }
    .plan-banner.approved {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.35);
    }

    .error-banner {
      padding: 6px 10px;
      margin: 6px 10px 0;
      border-radius: 6px;
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: var(--fg);
      font-size: 12px;
      display: none;
    }

    /* Settings Drawer */
    .settings-drawer {
      position: absolute;
      inset: 42px 0 0 0;
      background: var(--bg);
      z-index: 40;
      display: none;
      flex-direction: column;
      overflow-y: auto;
      padding: 12px;
      gap: 12px;
    }
    .settings-drawer.open {
      display: flex;
    }

    .settings-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .settings-head h3 {
      margin: 0;
      font-size: 13.5px;
      font-weight: 600;
    }

    .settings-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
    }
    .settings-group-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }

    .toggle-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .toggle-desc {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .toggle-sub {
      font-size: 11px;
      color: var(--muted);
    }

    .custom-model-form {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-row {
      display: flex;
      gap: 6px;
    }
    .field-input, .field-select {
      flex: 1;
      min-width: 0;
      padding: 5px 7px;
      border-radius: 5px;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      color: var(--input-fg);
      font-family: inherit;
      font-size: 12px;
    }
    .custom-model-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .custom-model-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11.5px;
      padding: 4px 6px;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.1);
    }

    /* Chat Stream (Signal-Only: Reports, Questions & Polls) */
    .feed {
      flex: 1;
      overflow-y: auto;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .empty-state {
      margin: auto;
      text-align: center;
      max-width: 280px;
      color: var(--muted);
      line-height: 1.5;
      padding: 20px 10px;
    }
    .empty-mark {
      width: 38px;
      height: 38px;
      margin: 0 auto 10px;
      border-radius: 10px;
      background: rgba(128, 128, 128, 0.12);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--fg);
      font-size: 15px;
    }
    .empty-state h3 {
      margin: 0 0 6px;
      color: var(--fg);
      font-size: 14px;
      font-weight: 600;
    }
    .empty-state p {
      margin: 0 0 6px;
      font-size: 12px;
    }

    /* Chat Messages */
    .msg-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .msg-row.user {
      align-items: flex-end;
    }
    .user-bubble {
      max-width: 92%;
      background: rgba(59, 130, 246, 0.16);
      border: 1px solid rgba(59, 130, 246, 0.32);
      border-radius: 10px 10px 3px 10px;
      padding: 8px 11px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .user-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      font-size: 10.5px;
      color: var(--muted);
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--card-accent, var(--border));
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    }
    .card.question, .card.poll {
      border-left: 3px solid var(--card-accent, var(--accent));
    }
    .card.answered {
      border-left: 3px solid var(--ok);
    }

    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      flex-wrap: wrap;
    }
    .card-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .avatar-dot {
      width: 19px;
      height: 19px;
      border-radius: 50%;
      background: var(--dot-bg, rgba(59, 130, 246, 0.22));
      color: var(--dot-fg, var(--fg));
      border: 1.5px solid rgba(255, 255, 255, 0.25);
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .badge {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.15);
    }
    .badge.role-pill {
      border-radius: 999px;
      font-size: 10px;
      padding: 1px 7px;
      border: 1px solid rgba(255, 255, 255, 0.22);
    }
    .badge.report { background: rgba(59, 130, 246, 0.16); color: #60a5fa; }
    .badge.checkpoint { background: rgba(139, 92, 246, 0.18); color: #c084fc; }
    .badge.final_summary { background: rgba(16, 185, 129, 0.18); color: #34d399; }
    .badge.cancelled { background: rgba(239, 68, 68, 0.18); color: #f87171; }
    .badge.pending { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
    .badge.answered { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
    .badge.model { font-weight: 500; opacity: 0.9; }
    .card.cancelled { border-left: 3px solid var(--err); opacity: 0.9; }
    .plan-chip {
      display: inline-flex;
      align-items: center;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.16);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.35);
      white-space: nowrap;
    }

    /* Top-left Session Switcher & Saved Collaborations Drawer */
    .session-switcher-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 195px;
      height: 24px;
      padding: 0 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--fg);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      min-width: 0;
    }
    .session-switcher-btn:hover, .session-switcher-btn.active {
      background: var(--surface-hover);
      border-color: var(--accent);
    }
    .session-title-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .session-count-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 0 5px;
      border-radius: 999px;
      background: rgba(128, 128, 128, 0.2);
      color: var(--muted);
      flex-shrink: 0;
    }

    .history-drawer {
      position: absolute;
      inset: 42px 0 0 0;
      background: var(--bg);
      z-index: 42;
      display: none;
      flex-direction: column;
      overflow-y: auto;
      padding: 12px;
      gap: 10px;
    }
    .history-drawer.open {
      display: flex;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .history-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      cursor: pointer;
    }
    .history-card:hover {
      border-color: var(--accent);
      background: var(--surface-hover);
    }
    .history-card.active {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.1);
    }
    .history-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .history-card-title {
      font-size: 12.5px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }
    .history-card-actions {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
    }
    .history-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      flex-wrap: wrap;
      font-size: 10.5px;
      color: var(--muted);
    }

    /* Prompt Templates Editor */
    .prompt-editor-area {
      width: 100%;
      min-height: 88px;
      padding: 6px 8px;
      border-radius: 5px;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      color: var(--input-fg);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11.5px;
      line-height: 1.45;
      resize: vertical;
    }
    .placeholder-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip-insert {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: rgba(128, 128, 128, 0.12);
      color: var(--fg);
      cursor: pointer;
    }
    .chip-insert:hover {
      border-color: var(--accent);
      background: var(--surface-hover);
    }

    .card-time {
      font-size: 10.5px;
      color: var(--muted);
    }
    .card-title {
      font-weight: 600;
      font-size: 13px;
      line-height: 1.35;
    }
    .card-context {
      font-size: 11px;
      color: var(--muted);
    }
    .card-body {
      font-size: 12.5px;
      line-height: 1.5;
      word-break: break-word;
    }
    .card-body p { margin: 0 0 6px; }
    .card-body p:last-child { margin-bottom: 0; }
    .card-body ul { margin: 4px 0 6px 16px; padding: 0; }
    .card-body li { margin-bottom: 3px; }
    .card-body pre {
      background: rgba(128, 128, 128, 0.12);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 7px 9px;
      overflow-x: auto;
      font-size: 11.5px;
      margin: 6px 0;
    }
    .card-body code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11.5px;
      background: rgba(128, 128, 128, 0.16);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .card-body pre code {
      background: transparent;
      padding: 0;
    }

    .files-list, .launch-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .file-chip {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.12);
      border: 1px solid var(--border);
      color: var(--fg);
      cursor: pointer;
    }
    .file-chip:hover { border-color: var(--accent); }

    /* Interactive Question & Poll Controls */
    .reply-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 2px;
    }
    .reply-input, .poll-custom-input {
      width: 100%;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      color: var(--input-fg);
      font-family: inherit;
      font-size: 12.5px;
      resize: vertical;
    }
    .poll-options {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .poll-opt {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: rgba(128, 128, 128, 0.06);
      cursor: pointer;
      font-size: 12px;
      line-height: 1.35;
    }
    .poll-opt:hover { border-color: var(--accent); }
    .poll-opt.selected {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.14);
    }
    .answered-box {
      padding: 6px 8px;
      border-radius: 6px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      font-size: 12px;
    }

    button {
      font-family: inherit;
      cursor: pointer;
      border-radius: 5px;
      border: 1px solid transparent;
      font-size: 12px;
      padding: 5px 10px;
    }
    .btn-primary {
      background: var(--btn-bg);
      color: var(--btn-fg);
      font-weight: 600;
    }
    .btn-primary:hover:not(:disabled) { background: var(--btn-hover); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-sec {
      background: var(--btn-sec-bg);
      color: var(--btn-sec-fg);
    }
    .btn-danger {
      background: rgba(239, 68, 68, 0.16);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.42);
      font-weight: 600;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.28);
    }
    .stop-top-btn {
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.38);
      background: rgba(239, 68, 68, 0.12);
      font-weight: 600;
    }
    .stop-top-btn:hover {
      background: rgba(239, 68, 68, 0.25);
    }
    .footer-btns {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .btn-xs { padding: 3px 8px; font-size: 11px; }

    /* Bottom Genuine Chat Composer + Slots Bar */
    .composer-area {
      position: relative;
      border-top: 1px solid var(--border);
      padding: 8px 10px 10px;
      background: var(--bg);
      display: flex;
      flex-direction: column;
      gap: 7px;
      flex-shrink: 0;
    }

    .slots-row {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    @keyframes slotSplitFromPrev {
      0% {
        opacity: 0.3;
        transform: translateX(-28px) scale(0.76);
        border-color: var(--split-from-color, var(--accent));
        box-shadow: 0 0 18px var(--split-from-color, var(--accent));
      }
      65% {
        opacity: 1;
        transform: translateX(3px) scale(1.04);
      }
      100% {
        opacity: 1;
        transform: translateX(0) scale(1);
        border-color: var(--slot-color, var(--input-border));
      }
    }

    .slot-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 999px;
      border: 2px solid var(--slot-color, var(--input-border));
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.08)), var(--surface);
      box-shadow: 0 2px 10px -3px var(--slot-color, transparent);
      color: var(--fg);
      font-size: 11px;
      cursor: pointer;
      max-width: 100%;
      transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.25s ease, background 0.2s ease;
    }
    .slot-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px -2px var(--slot-color, var(--accent));
    }
    .slot-chip.active {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.14), 0 4px 14px -2px var(--slot-color, var(--accent));
    }
    .slot-chip.splitting-from-prev {
      animation: slotSplitFromPrev 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .slot-chip.empty-required {
      border: 2px dashed var(--warn);
      box-shadow: none;
    }
    .slot-pigment-dots {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .slot-color-swatch {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      border: 1.5px solid rgba(255, 255, 255, 0.65);
      flex-shrink: 0;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.35);
    }
    .slot-pigment-dots .slot-color-swatch + .slot-color-swatch {
      margin-left: -3px;
    }
    .slot-role-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
      max-width: 104px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .slot-tag {
      font-size: 10px;
      font-weight: 700;
      opacity: 0.9;
      white-space: nowrap;
    }
    .slot-tag.main-tag {
      color: var(--slot-color, #60a5fa);
      opacity: 1;
    }
    .slot-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 165px;
      font-weight: 600;
    }
    .slot-model {
      color: var(--muted);
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 95px;
    }
    .slot-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      font-size: 11px;
      line-height: 1;
      opacity: 0.7;
      padding: 0;
      background: transparent;
      color: var(--fg);
    }
    .slot-remove:hover {
      opacity: 1;
      background: rgba(239, 68, 68, 0.25);
    }

    .add-slot-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 50%;
      border: 1.5px dashed var(--input-border);
      background: transparent;
      color: var(--fg);
      font-size: 15px;
      font-weight: 600;
      line-height: 1;
      transition: transform 0.14s ease, border-color 0.15s ease, background 0.15s ease;
    }
    .add-slot-btn:hover {
      border-color: var(--accent);
      background: var(--surface-hover);
      transform: scale(1.06);
    }

    /* Two-Tab Searchable Agents + Roles Picker Popover */
    .picker-popover {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: calc(100% - 4px);
      max-height: 410px;
      display: none;
      flex-direction: column;
      background: var(--vscode-menu-background, var(--surface));
      color: var(--vscode-menu-foreground, var(--fg));
      border: 1px solid var(--vscode-menu-border, var(--border));
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);
      z-index: 50;
      overflow: hidden;
    }
    .picker-popover.open {
      display: flex;
    }

    .picker-tabs {
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid var(--border);
      background: rgba(128, 128, 128, 0.06);
      flex-shrink: 0;
    }
    .picker-tab {
      flex: 1;
      padding: 7px 10px;
      font-size: 11.5px;
      font-weight: 600;
      background: transparent;
      color: var(--muted);
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }
    .picker-tab:hover {
      color: var(--fg);
      background: var(--surface-hover);
    }
    .picker-tab.active {
      color: var(--fg);
      background: var(--surface);
      border-bottom-color: var(--tab-accent, var(--accent));
    }

    .preset-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      background: rgba(128, 128, 128, 0.04);
      flex-shrink: 0;
    }
    .preset-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-right: 2px;
    }
    .preset-chip {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--fg);
      cursor: pointer;
    }
    .preset-chip:hover {
      border-color: var(--accent);
      background: var(--surface-hover);
    }

    .paint-mix-banner {
      padding: 7px 9px;
      border-bottom: 1px solid var(--border);
      background: rgba(128, 128, 128, 0.06);
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex-shrink: 0;
    }
    .paint-formula-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 10.5px;
    }
    .paint-dots-chain {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .paint-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.45);
      display: inline-block;
      flex-shrink: 0;
    }
    .paint-dot.mixed {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.85);
    }
    .paint-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .active-role-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.24);
    }
    .active-role-rm {
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 11px;
      padding: 0 1px;
      line-height: 1;
      opacity: 0.85;
    }
    .active-role-rm:hover { opacity: 1; }

    .role-opt {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: inherit;
      width: 100%;
      text-align: left;
      cursor: pointer;
    }
    .role-opt:hover:not(.disabled) { background: var(--surface-hover); }
    .role-opt.selected {
      background: rgba(59, 130, 246, 0.14);
      border-color: var(--role-color, var(--accent));
    }
    .role-opt.disabled {
      opacity: 0.42;
      filter: grayscale(0.75);
      cursor: not-allowed;
    }
    .role-tier-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid var(--border);
      white-space: nowrap;
    }
    .role-tier-badge.tier-code {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.35);
    }
    .role-tier-badge.tier-plan {
      background: rgba(245, 158, 11, 0.16);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.35);
    }
    .role-tier-badge.tier-comms {
      background: rgba(59, 130, 246, 0.16);
      color: #60a5fa;
      border-color: rgba(59, 130, 246, 0.35);
    }
    .role-conflict-pill {
      font-size: 9.5px;
      color: #f87171;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 1px 5px;
      border-radius: 4px;
      margin-top: 3px;
      display: inline-block;
    }

    .picker-head {
      padding: 7px 9px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 600;
    }
    .picker-head-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .picker-search-wrap {
      padding: 6px 8px 2px;
    }
    .picker-search {
      width: 100%;
      padding: 4px 7px;
      border-radius: 5px;
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      color: var(--input-fg);
      font-family: inherit;
      font-size: 11.5px;
      outline: none;
    }
    .picker-list {
      overflow-y: auto;
      padding: 5px 6px 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .picker-section {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      padding: 5px 6px 2px;
    }
    .picker-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      background: transparent;
      color: inherit;
      width: 100%;
    }
    .picker-item:hover { background: var(--surface-hover); }
    .picker-item.selected { background: rgba(59, 130, 246, 0.16); }
    .picker-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    .agent-badge {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.22);
      flex-shrink: 0;
    }
    .picker-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .picker-title {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .picker-sub {
      font-size: 10.5px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .picker-right {
      font-size: 10.5px;
      color: var(--muted);
      flex-shrink: 0;
    }

    /* Modern Chat Input Box */
    .prompt-box {
      border: 1px solid var(--input-border);
      background: var(--input-bg);
      border-radius: 10px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .prompt-box:focus-within { border-color: var(--accent); }

    .prompt-context-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 11px;
      color: var(--muted);
    }
    .ctx-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(128, 128, 128, 0.16);
      border: 1px solid var(--border);
      color: var(--fg);
      cursor: pointer;
      font-size: 10.5px;
    }
    .ctx-chip:hover {
      background: var(--surface-hover);
      border-color: var(--accent);
    }
    .composer-attachments {
      display: none;
      flex-wrap: wrap;
      gap: 5px;
    }
    .composer-attachments.has-items {
      display: flex;
    }
    .attach-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(59, 130, 246, 0.12);
      color: var(--fg);
      font-size: 10.5px;
    }
    .attach-pill-rm {
      border: none;
      background: transparent;
      color: var(--muted);
      padding: 0 2px;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
    }
    .attach-pill-rm:hover { color: var(--err); }

    .prompt-input {
      width: 100%;
      min-height: 44px;
      max-height: 150px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--input-fg);
      font-family: inherit;
      font-size: 12.5px;
      resize: vertical;
      line-height: 1.4;
      padding: 0;
    }

    .prompt-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .hint-text {
      font-size: 10.5px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .send-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      border-radius: 6px;
    }

    /* AIvengers Branding, Guide, Starters, Filters & Slot Promote */
    .brand-logo-sm {
      width: 15px;
      height: 15px;
      object-fit: contain;
      flex-shrink: 0;
      border-radius: 3px;
    }
    .brand-logo-lg {
      width: 60px;
      height: 60px;
      object-fit: contain;
      margin: 0 auto 8px;
      display: block;
    }
    .slot-promote {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      font-size: 10px;
      line-height: 1;
      opacity: 0.72;
      padding: 0;
      background: transparent;
      color: var(--fg);
    }
    .slot-promote:hover {
      opacity: 1;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.2);
    }
    .guide-drawer {
      position: absolute;
      inset: 42px 0 0 0;
      background: var(--bg);
      z-index: 41;
      display: none;
      flex-direction: column;
      overflow-y: auto;
      padding: 12px;
      gap: 10px;
    }
    .guide-drawer.open {
      display: flex;
    }
    .guide-hero {
      text-align: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .guide-hero h4 {
      margin: 2px 0 6px;
      font-size: 14px;
      font-weight: 700;
    }
    .guide-hero p {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
    }
    .guide-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      line-height: 1.45;
    }
    .guide-card strong {
      font-size: 12px;
    }
    .guide-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .empty-actions {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    .starter-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
    }
    .starter-chip {
      font-size: 11px;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--fg);
      cursor: pointer;
    }
    .starter-chip:hover {
      border-color: var(--accent);
      background: var(--surface-hover);
    }
    .feed-filter-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
    .filter-pill {
      font-size: 10.5px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .filter-pill:hover {
      color: var(--fg);
      background: var(--surface-hover);
    }
    .filter-pill.active {
      background: rgba(59, 130, 246, 0.16);
      border-color: var(--accent);
      color: var(--fg);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="header-bar">
      <div class="header-top">
        <button class="session-switcher-btn" id="historyBtn" title="AIvengers Saved Collaborations (switch, rename, or manage past sessions)">
          ${headerBrandImg}
          <span class="session-title-text" id="currentSessionTitle">New Collaboration</span>
          <span class="session-count-badge" id="sessionCountBadge">0</span>
          <span style="opacity:0.65">▾</span>
        </button>
        <div class="header-actions">
          <button class="icon-btn stop-top-btn" id="stopSessionTopBtn" title="Cancel ongoing session on all agents" style="display:none">⏹ Stop</button>
          <button class="icon-btn" id="rescanBtn" title="Refresh detected coding agents & Copilot plan models">↻</button>
          <button class="icon-btn" id="newSessionBtn" title="New collaboration session">+</button>
          <button class="icon-btn" id="guideBtn" title="About AIvengers & Quick Start Guide">?</button>
          <button class="icon-btn" id="settingsBtn" title="AIvengers Settings">⚙️</button>
        </div>
      </div>
      <div class="team-pills" id="teamPills">
        <span class="status-pill"><span class="dot offline"></span>Pick Slot 1 (Main) to start</span>
      </div>
    </div>

    <div class="error-banner" id="errorBanner"></div>

    <div class="history-drawer" id="historyDrawer">
      <div class="settings-head">
        <h3>🕘 Saved Collaborations</h3>
        <div class="footer-btns">
          <button class="btn-primary btn-xs" id="historyNewBtn">+ New</button>
          <button class="btn-sec btn-xs" id="closeHistoryBtn">Done</button>
        </div>
      </div>
      <input class="picker-search" id="historySearchInput" placeholder="Search saved collaborations..." />
      <div class="history-list" id="historyList"></div>
    </div>

    <div class="guide-drawer" id="guideDrawer">
      <div class="settings-head">
        <h3>⚡ About AIvengers</h3>
        <button class="btn-sec btn-xs" id="closeGuideBtn">Done</button>
      </div>
      <div class="guide-hero">
        ${guideBrandImg}
        <h4>AIvengers — Multi-Agent AI Coding Hub</h4>
        <p>Assemble your installed VS Code AI coding agents (Antigravity, GitHub Copilot, Claude Code, Codex, Cursor, Cline &amp; more) into one coordinated engineering team—including multiple models from the same provider.</p>
      </div>
      <div class="guide-card">
        <strong>🚀 How to Set Up &amp; Use (Zero CLI Setup)</strong>
        <span>No terminal commands or manual <code>/assemble</code> skill setup needed. Pick providers &amp; models in <strong>🤖 Agents &amp; Models</strong> (plus optional 0+ roles in <strong>🎨 Roles</strong>), click <strong>+</strong> to split teammate slots, type your task, and hit <strong>Send ↑</strong>. AIvengers injects the full protocol automatically and falls back to its built-in hub. <em>Optional:</em> click <strong>📦 Init Hub in Workspace</strong> below to copy <code>vibe coding tools/</code> and bundled skills into your repo in one click.</span>
      </div>
      <div class="guide-card">
        <strong>1. Slot 1 = Main Engineering Manager</strong>
        <span>Assign your lead agent &amp; exact model in Slot 1. Main breaks down tasks, keeps teammates aligned, submits plans, verifies quality, and signs off with <code>final_summary</code>.</span>
      </div>
      <div class="guide-card">
        <strong>2. Slot 2+ = Specialist Teammates &amp; Role Colors</strong>
        <span>Click <strong>+</strong> to split out extra slots (even distinct models from the same provider), or click <strong>⚡ Auto</strong>. Assign 0, 1, or multiple compatible roles in <strong>🎨 Roles</strong> to color slot outlines via RYB paint mixing, and click <strong>★</strong> anytime to promote a teammate to Main.</span>
      </div>
      <div class="guide-card">
        <strong>3. Signal-Only Feed &amp; Plan Approval Polls</strong>
        <span>No noisy agent chatter—only structured <strong>Reports</strong>, <strong>Questions</strong>, and <strong>Polls</strong> appear here. Voting approve on a plan poll automatically unlocks execution.</span>
      </div>
      <div class="guide-card">
        <strong>4. Same-Session Continuity, Attachments &amp; Failover</strong>
        <span>Follow-up messages reuse your open agent chats while keeping <code>Message 1</code>, <code>Message 2</code> history in <code>USER_INBOX.md</code>. Attach files/folders directly and rely on passive failover if any agent hits a quota limit.</span>
      </div>
      <div class="guide-card">
        <strong>🛡️ Official Agent Usage (Local Extensions Required)</strong>
        <span>AIvengers is purely a local team-organization and prompt-dispatch tool—it never opens or emulates Antigravity on other platforms. Your original official Antigravity and agent extensions must already be installed locally; AIvengers simply sends prompts to them within their native environment.</span>
      </div>
      <div class="guide-actions">
        <button class="btn-primary btn-xs" data-action="autoFillTeam">⚡ Auto-Fill Installed Team</button>
        <button class="btn-sec btn-xs" data-action="guideOpenAgents">📄 Open AGENTS.md</button>
        <button class="btn-sec btn-xs" data-action="initWorkspaceHub">📦 Init Hub in Workspace</button>
      </div>
    </div>

    <div class="settings-drawer" id="settingsDrawer">
      <div class="settings-head">
        <h3>⚙️ AIvengers Settings</h3>
        <button class="btn-sec btn-xs" id="closeSettingsBtn">Done</button>
      </div>
      <div id="settingsBody"></div>
    </div>

    <div class="feed" id="feedContainer"></div>

    <div class="composer-area" id="composerArea">
      <div class="picker-popover" id="pickerPopover"></div>

      <div class="slots-row" id="slotsRow"></div>

      <div class="prompt-box">
        <div class="prompt-context-bar">
          <button class="ctx-chip" id="openInboxChip" title="Open USER_INBOX.md">📄 Inbox</button>
          <button class="ctx-chip" id="openTasksChip" title="Open TASKS.md task board & file locks">📋 Tasks</button>
          <button class="ctx-chip" id="openCommsChip" title="Open AGENT_COMMUNICATION.md team log">💬 Comms</button>
          <button class="ctx-chip" id="attachFileChip" title="Attach files to this message">📎 Files</button>
          <button class="ctx-chip" id="attachFolderChip" title="Attach folder to this message">📁 Folder</button>
          <span id="detectedMetaLabel"></span>
        </div>
        <div class="composer-attachments" id="composerAttachments"></div>
        <textarea
          class="prompt-input"
          id="promptInput"
          placeholder="Ask your AIvengers team what to build, debug, review, or test..."
        ></textarea>
        <div class="prompt-footer">
          <span class="hint-text" id="sendHint">Choose a coding agent & model in Slot 1</span>
          <div class="footer-btns">
            <button class="btn-danger btn-xs stop-btn" id="stopSessionBtn" style="display:none" title="Cancel ongoing session on all agents">⏹ Stop</button>
            <button class="btn-primary send-btn" id="sendBtn" disabled>Send ↑</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const BRAND_LOGO_URI = ${JSON.stringify(logoUri)};
      ${roleDefs.getWebviewRoleHelpersSource()}

      const state = {
        agents: [],
        slots: [null],
        roleCategories: [],
        roleRegistry: {},
        teamPresets: [],
        defaultGlobalTemplate: '',
        defaultAgentPrompts: {},
        settings: {
          autoLaunchAgents: true,
          startNewConversation: false,
          keepFocusOnSend: true,
          attachInboxFile: true,
          requirePlanApproval: true,
          showAllKnownAgents: false,
          antigravityLaunchMode: 'ui_with_cli_fallback',
          globalPromptTemplate: '',
          agentPrompts: {},
          customModels: [],
        },
        picker: {
          openSlotIdx: null,
          tab: 'agents',
          step: 'agents',
          activeAgentKey: null,
          search: '',
          lastSplitSlotIdx: null,
          lastSplitFromColor: null,
        },
        settingsOpen: false,
        historyOpen: false,
        guideOpen: false,
        feedFilter: 'all',
        historySearch: '',
        renamingFolder: null,
        renameDraft: '',
        confirmDeleteFolder: null,
        selectedPromptAgent: '@antigravity',
        promptDraftGlobal: '',
        promptDraftAgents: {},
        promptDraftAgyMode: 'ui_with_cli_fallback',
        promptDraftsInitialized: false,
        feed: { items: [] },
        presence: null,
        peers: null,
        tasksSummary: { active: 0, done: 0, total: 0 },
        sessions: [],
        dispatching: false,
        draftAttachments: [],
        pollDrafts: {},
        questionDrafts: {},
      };

      const feedEl = document.getElementById('feedContainer');
      const teamPillsEl = document.getElementById('teamPills');
      const errorBannerEl = document.getElementById('errorBanner');
      const slotsRowEl = document.getElementById('slotsRow');
      const popoverEl = document.getElementById('pickerPopover');
      const promptEl = document.getElementById('promptInput');
      const sendBtnEl = document.getElementById('sendBtn');
      const stopSessionBtnEl = document.getElementById('stopSessionBtn');
      const stopSessionTopBtnEl = document.getElementById('stopSessionTopBtn');
      const sendHintEl = document.getElementById('sendHint');
      const detectedMetaEl = document.getElementById('detectedMetaLabel');
      const historyBtnEl = document.getElementById('historyBtn');
      const currentSessionTitleEl = document.getElementById('currentSessionTitle');
      const sessionCountBadgeEl = document.getElementById('sessionCountBadge');
      const historyDrawerEl = document.getElementById('historyDrawer');
      const historySearchInputEl = document.getElementById('historySearchInput');
      const historyListEl = document.getElementById('historyList');
      const closeHistoryBtnEl = document.getElementById('closeHistoryBtn');
      const historyNewBtnEl = document.getElementById('historyNewBtn');
      const guideDrawerEl = document.getElementById('guideDrawer');
      const guideBtnEl = document.getElementById('guideBtn');
      const closeGuideBtnEl = document.getElementById('closeGuideBtn');
      const settingsDrawerEl = document.getElementById('settingsDrawer');
      const settingsBodyEl = document.getElementById('settingsBody');
      const settingsBtnEl = document.getElementById('settingsBtn');
      const closeSettingsBtnEl = document.getElementById('closeSettingsBtn');
      const rescanBtnEl = document.getElementById('rescanBtn');
      const newSessionBtnEl = document.getElementById('newSessionBtn');
      const openInboxChipEl = document.getElementById('openInboxChip');
      const openTasksChipEl = document.getElementById('openTasksChip');
      const openCommsChipEl = document.getElementById('openCommsChip');
      const attachFileChipEl = document.getElementById('attachFileChip');
      const attachFolderChipEl = document.getElementById('attachFolderChip');
      const composerAttachmentsEl = document.getElementById('composerAttachments');

      function esc(str) {
        return String(str == null ? '' : str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function renderFormattedText(raw) {
        const safe = esc(raw || '').trim();
        if (!safe) return '';
        // Split out fenced code blocks first so internal newlines remain intact
        const segments = safe.split(/(\`\`\`[\\s\\S]*?\`\`\`)/g);
        return segments
          .map((seg) => {
            if (seg.startsWith('\`\`\`') && seg.endsWith('\`\`\`')) {
              const code = seg.slice(3, -3).replace(/^[a-zA-Z0-9_-]*\\r?\\n/, '');
              return '<pre><code>' + code + '</code></pre>';
            }
            const paragraphs = seg.split(/\\r?\\n\\s*\\r?\\n/);
            return paragraphs
              .filter((p) => p.trim())
              .map((block) => {
                const lines = block.split(/\\r?\\n/);
                const isList = lines.every((l) => /^\\s*(?:[-*•]|\\d+\\.)\\s+/.test(l));
                const formatInline = (text) =>
                  text
                    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
                    .replace(/\`([^\`]+)\`/g, '<code>$1</code>');

                if (isList) {
                  const items = lines
                    .map((l) => '<li>' + formatInline(l.replace(/^\\s*(?:[-*•]|\\d+\\.)\\s+/, '')) + '</li>')
                    .join('');
                  return '<ul>' + items + '</ul>';
                }
                const formattedLines = lines
                  .map((l) => {
                    if (/^#{1,4}\\s+/.test(l)) {
                      return '<strong>' + formatInline(l.replace(/^#{1,4}\\s+/, '')) + '</strong>';
                    }
                    return formatInline(l);
                  })
                  .join('<br/>');
                return '<p>' + formattedLines + '</p>';
              })
              .join('');
          })
          .join('');
      }

      function showError(msg) {
        if (!msg) {
          errorBannerEl.style.display = 'none';
          errorBannerEl.textContent = '';
          return;
        }
        errorBannerEl.textContent = msg;
        errorBannerEl.style.display = 'block';
        setTimeout(() => {
          errorBannerEl.style.display = 'none';
        }, 6000);
      }

      function updateSendState() {
        const slot1 = state.slots[0];
        const hasMain = Boolean(slot1 && slot1.agentKey);
        const hasText = promptEl.value.trim().length > 0;
        sendBtnEl.disabled = state.dispatching || !hasMain || !hasText;
        if (state.dispatching) {
          sendBtnEl.textContent = 'Starting...';
          sendHintEl.textContent = 'Writing USER_INBOX.md & launching agents...';
        } else if (!hasMain) {
          sendBtnEl.textContent = 'Send ↑';
          sendHintEl.textContent = 'Select an agent & model in Slot 1 (Main) to send';
        } else {
          const count = state.slots.filter((s) => s && s.agentKey).length;
          sendBtnEl.textContent = count > 1 ? 'Send (' + count + ') ↑' : 'Send ↑';
          sendHintEl.textContent = 'Enter to send • Shift+Enter newline';
        }
      }

      function hasTerminalReportAfterLastPrompt(items) {
        let lastPromptIdx = -1;
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i] && items[i].kind === 'user_prompt') {
            lastPromptIdx = i;
            break;
          }
        }
        for (let i = lastPromptIdx + 1; i < items.length; i++) {
          const it = items[i];
          if (
            it &&
            it.kind === 'report' &&
            (it.reportType === 'final_summary' || it.reportType === 'cancelled')
          ) {
            return true;
          }
        }
        return false;
      }

      function canCancelSession() {
        if (state.dispatching) return true;
        const pres = state.presence || {};
        if (pres.sessionCancelled || pres.sessionCompleted) return false;
        if (state.peers && (state.peers.sessionCancelled || state.peers.sessionCompleted)) return false;

        const items = state.feed && Array.isArray(state.feed.items) ? state.feed.items : [];
        if (hasTerminalReportAfterLastPrompt(items)) return false;

        const hasPendingPrompt = items.some(
          (i) => (i.kind === 'question' || i.kind === 'poll') && i.status === 'pending'
        );
        if (hasPendingPrompt) return true;

        const peersMap = (state.peers && state.peers.agents) || pres.agents || {};
        const hasDispatched = Boolean(pres.dispatchedAtIso);
        const hasActivePeer = Object.values(peersMap).some(
          (a) =>
            a &&
            (a.assembled ||
              ['RUNNING', 'WAITING', 'PENDING'].includes(a.status) ||
              (hasDispatched && a.status === 'IDLE'))
        );
        return Boolean(hasActivePeer || hasDispatched);
      }

      function renderAttachments() {
        const list = Array.isArray(state.draftAttachments) ? state.draftAttachments : [];
        composerAttachmentsEl.classList.toggle('has-items', list.length > 0);
        if (list.length === 0) {
          composerAttachmentsEl.innerHTML = '';
          return;
        }
        composerAttachmentsEl.innerHTML = list
          .map((att, idx) => {
            const icon = att && att.isDirectory ? '📁' : '📎';
            const label = esc((att && (att.name || att.path)) || 'Attachment');
            const title = esc((att && att.path) || '');
            return (
              '<span class="attach-pill" title="' +
              title +
              '"><span>' +
              icon +
              ' ' +
              label +
              '</span><button type="button" class="attach-pill-rm" data-action="removeAttachment" data-idx="' +
              idx +
              '" title="Remove attachment">×</button></span>'
            );
          })
          .join('');
      }

      function renderGuide() {
        guideBtnEl.classList.toggle('active', state.guideOpen);
        guideDrawerEl.classList.toggle('open', state.guideOpen);
      }

      function computeSlotProfile(slot, slotIdx) {
        const reg = state.roleRegistry || {};
        const rawRoles = slot && Array.isArray(slot.roleIds)
          ? slot.roleIds
          : slot && slot.roleId
            ? [slot.roleId]
            : [];
        if (typeof resolveEffectiveSlotProfile === 'function' && Object.keys(reg).length > 0) {
          return resolveEffectiveSlotProfile(rawRoles, slotIdx === 0, reg);
        }
        return {
          roleIds: rawRoles,
          roles: [],
          roleNames: [],
          roleSummary: (slot && slot.roleSummary) || '',
          mixedColor: (slot && slot.mixedColor) || '#64748B',
          textColor: (slot && slot.textColor) || '#FFFFFF',
          effectiveWritePermission: (slot && slot.writePermission) || 'code-write',
          effectiveHubEscalation: (slot && slot.hubEscalation) || 'direct-user-access',
        };
      }

      function getSlotModelDisplay(slot, agentsByKey) {
        if (!slot || !slot.agentKey) return 'Select Agent';
        const ag = agentsByKey ? agentsByKey.get(slot.agentKey) : state.agents.find((a) => a.key === slot.agentKey);
        if (slot.modelId && slot.modelId !== 'auto' && slot.modelLabel) {
          return slot.modelLabel;
        }
        if (ag) {
          return ag.label + (slot.modelLabel ? ' (' + slot.modelLabel + ')' : '');
        }
        return slot.modelLabel || slot.agentKey;
      }

      function applyTeamPreset(presetId) {
        const list = Array.isArray(state.teamPresets) ? state.teamPresets : Object.values(state.teamPresets || {});
        const preset = list.find((p) => p && (p.id === presetId || p.key === presetId));
        if (!preset || !Array.isArray(preset.slots)) return;
        const neededCount = preset.slots.length;
        const next = state.slots.slice();
        while (next.length < neededCount) {
          const front = [...next].reverse().find((s) => s && s.agentKey) || null;
          if (front) {
            const ag = state.agents.find((a) => a.key === front.agentKey);
            const usedModels = new Set(
              next.filter((s) => s && s.agentKey === front.agentKey).map((s) => s.modelId)
            );
            const nextModel = ag && Array.isArray(ag.models)
              ? ag.models.find((m) => m.id !== 'auto' && !usedModels.has(m.id)) || ag.models[0] || { id: 'auto', label: 'Auto' }
              : { id: front.modelId || 'auto', label: front.modelLabel || 'Auto' };
            next.push({
              agentKey: front.agentKey,
              modelId: nextModel.id || 'auto',
              modelLabel: nextModel.label || 'Auto',
              vendor: nextModel.vendor || undefined,
              family: nextModel.family || undefined,
              roleIds: [],
            });
          } else {
            next.push(null);
          }
        }
        preset.slots.forEach((pSlot, idx) => {
          const targetRoles = Array.isArray(pSlot)
            ? pSlot
            : Array.isArray(pSlot?.roleIds)
              ? pSlot.roleIds
              : [];
          const cur = next[idx];
          if (cur && cur.agentKey) {
            const profile = computeSlotProfile({ ...cur, roleIds: targetRoles }, idx);
            next[idx] = {
              ...cur,
              roleIds: profile.roleIds,
              roleSummary: profile.roleSummary,
              mixedColor: profile.mixedColor,
              textColor: profile.textColor,
              writePermission: profile.effectiveWritePermission,
              hubEscalation: profile.effectiveHubEscalation,
            };
          } else if (state.agents.length > 0) {
            const ag = state.agents[idx % state.agents.length];
            const firstModel = (ag.models && ag.models[0]) || { id: 'auto', label: 'Auto' };
            const profile = computeSlotProfile({ roleIds: targetRoles }, idx);
            next[idx] = {
              agentKey: ag.key,
              modelId: firstModel.id || 'auto',
              modelLabel: firstModel.label || 'Auto',
              vendor: firstModel.vendor || undefined,
              family: firstModel.family || undefined,
              roleIds: profile.roleIds,
              roleSummary: profile.roleSummary,
              mixedColor: profile.mixedColor,
              textColor: profile.textColor,
              writePermission: profile.effectiveWritePermission,
              hubEscalation: profile.effectiveHubEscalation,
            };
          }
        });
        state.slots = next;
        vscode.postMessage({ type: 'updateSlots', slots: state.slots });
        renderSlots();
        renderPopover();
        renderHeader();
      }

      function toggleSlotRole(slotIdx, roleId) {
        if (slotIdx === null || slotIdx < 0 || slotIdx >= state.slots.length) return;
        const slot = state.slots[slotIdx];
        if (!slot || !slot.agentKey) {
          showError('Choose a coding agent & model in the Agents tab for this slot first.');
          return;
        }
        const isMain = slotIdx === 0;
        const reg = state.roleRegistry || {};
        const currentProfile = computeSlotProfile(slot, slotIdx);
        const currentIds = currentProfile.roleIds.slice();
        const exists = currentIds.includes(roleId);

        if (exists) {
          const remaining = currentIds.filter((id) => id !== roleId);
          const updated = computeSlotProfile({ roleIds: remaining }, slotIdx);
          state.slots[slotIdx] = {
            ...slot,
            roleIds: updated.roleIds,
            roleSummary: updated.roleSummary,
            mixedColor: updated.mixedColor,
            textColor: updated.textColor,
            writePermission: updated.effectiveWritePermission,
            hubEscalation: updated.effectiveHubEscalation,
          };
        } else {
          const disabledMap = typeof getIncompatibleRoles === 'function'
            ? getIncompatibleRoles(currentIds, reg, { isMain })
            : new Map();
          const candidateDef = reg[roleId];
          const conflictInfo = disabledMap.get(roleId);
          const isLeadSwap =
            isMain &&
            candidateDef &&
            candidateDef.category === 'leadership' &&
            conflictInfo &&
            conflictInfo.blockedByRoleIds.every((bid) => reg[bid] && reg[bid].category === 'leadership');

          let nextIds;
          if (isLeadSwap) {
            const nonLeadIds = currentIds.filter((id) => !(reg[id] && reg[id].category === 'leadership'));
            nextIds = [roleId, ...nonLeadIds];
          } else if (conflictInfo) {
            showError(conflictInfo.reasonText || 'Incompatible with an already-selected role.');
            return;
          } else {
            nextIds = [...currentIds, roleId];
          }

          const updated = computeSlotProfile({ roleIds: nextIds }, slotIdx);
          state.slots[slotIdx] = {
            ...slot,
            roleIds: updated.roleIds,
            roleSummary: updated.roleSummary,
            mixedColor: updated.mixedColor,
            textColor: updated.textColor,
            writePermission: updated.effectiveWritePermission,
            hubEscalation: updated.effectiveHubEscalation,
          };
        }

        vscode.postMessage({ type: 'updateSlots', slots: state.slots });
        renderSlots();
        renderPopover();
        renderHeader();
      }

      function applyAutoFillTeam() {
        const installed = state.agents.filter((ag) => ag && ag.installed !== false);
        const candidates = installed.length > 0 ? installed : state.agents.slice();
        if (candidates.length === 0) {
          showError('No coding agents detected yet. Click Refresh or enable uninstalled agents in Settings.');
          return;
        }
        const existingModelByAgent = new Map(
          state.slots
            .filter((s) => s && s.agentKey)
            .map((s) => [String(s.agentKey).toLowerCase(), s])
        );
        const seenTags = new Set();
        const nextSlots = [];
        for (const ag of candidates) {
          const tagKey = String(ag.tag || ag.key).toLowerCase();
          if (seenTags.has(tagKey)) continue;
          seenTags.add(tagKey);
          const idx = nextSlots.length;
          const prev = existingModelByAgent.get(String(ag.key).toLowerCase());
          const firstModel = (ag.models && ag.models[0]) || { id: 'auto', label: 'Auto' };
          const profile = computeSlotProfile(prev, idx);
          nextSlots.push({
            agentKey: ag.key,
            modelId: prev?.modelId || firstModel.id || 'auto',
            modelLabel: prev?.modelLabel || firstModel.label || 'Auto',
            vendor: prev?.vendor || firstModel.vendor || undefined,
            family: prev?.family || firstModel.family || undefined,
            roleIds: profile.roleIds,
            roleSummary: profile.roleSummary,
            mixedColor: profile.mixedColor,
            textColor: profile.textColor,
            writePermission: profile.effectiveWritePermission,
            hubEscalation: profile.effectiveHubEscalation,
          });
        }
        if (nextSlots.length > 0) {
          state.slots = nextSlots;
          state.guideOpen = false;
          vscode.postMessage({ type: 'updateSlots', slots: state.slots });
          closePicker();
          renderGuide();
          renderHeader();
          renderFeed();
        }
      }

      function promoteSlotToMain(slotIdx) {
        if (slotIdx <= 0 || slotIdx >= state.slots.length || !state.slots[slotIdx]?.agentKey) return;
        const next = state.slots.slice();
        const prevMain = next[0] || null;
        const promotedRaw = next[slotIdx];
        const promotedProfile = computeSlotProfile(promotedRaw, 0);
        next[0] = {
          ...promotedRaw,
          roleIds: promotedProfile.roleIds,
          roleSummary: promotedProfile.roleSummary,
          mixedColor: promotedProfile.mixedColor,
          textColor: promotedProfile.textColor,
          writePermission: promotedProfile.effectiveWritePermission,
          hubEscalation: promotedProfile.effectiveHubEscalation,
        };
        if (prevMain && prevMain.agentKey) {
          const demotedProfile = computeSlotProfile(prevMain, slotIdx);
          next[slotIdx] = {
            ...prevMain,
            roleIds: demotedProfile.roleIds,
            roleSummary: demotedProfile.roleSummary,
            mixedColor: demotedProfile.mixedColor,
            textColor: demotedProfile.textColor,
            writePermission: demotedProfile.effectiveWritePermission,
            hubEscalation: demotedProfile.effectiveHubEscalation,
          };
        } else {
          next.splice(slotIdx, 1);
        }
        state.slots = next;
        vscode.postMessage({ type: 'updateSlots', slots: state.slots });
        closePicker();
        renderHeader();
      }

      function renderHeader() {
        const pres = state.presence || {};
        const currentTitle = pres.sessionTitle || 'New Collaboration';
        currentSessionTitleEl.textContent = currentTitle;
        currentSessionTitleEl.title = currentTitle;
        sessionCountBadgeEl.textContent = String((state.sessions || []).length);
        historyBtnEl.classList.toggle('active', state.historyOpen);

        const ts = state.tasksSummary || { active: 0, done: 0, total: 0 };
        if (openTasksChipEl) {
          openTasksChipEl.textContent = ts.total > 0 ? '📋 Tasks (' + ts.active + '/' + ts.total + ')' : '📋 Tasks';
        }

        const showStop = canCancelSession();
        stopSessionTopBtnEl.style.display = showStop ? 'inline-flex' : 'none';
        stopSessionBtnEl.style.display = showStop ? 'inline-flex' : 'none';

        const peersAgents = state.peers && state.peers.agents ? state.peers.agents : null;
        const expected =
          (state.peers && state.peers.participants) ||
          (state.presence && state.presence.expectedParticipants) ||
          [];
        const mainAgent =
          (state.peers && state.peers.effectiveMain) ||
          (state.presence && state.presence.mainAgent) ||
          null;
        const modelMap =
          (state.peers && state.peers.agentModels) ||
          (state.presence && state.presence.agentModels) ||
          {};
        const slotMetaMap =
          (state.peers && state.peers.slotMeta) ||
          (state.presence && state.presence.slotMeta) ||
          {};

        if (!expected.length) {
          const selected = state.slots.filter((s) => s && s.agentKey);
          if (selected.length === 0) {
            teamPillsEl.innerHTML =
              '<span class="status-pill"><span class="dot offline"></span>No active session</span>';
          } else {
            const byKey = new Map(state.agents.map((a) => [a.key, a]));
            teamPillsEl.innerHTML = selected
              .map((s, idx) => {
                const profile = computeSlotProfile(s, idx);
                const modelDisp = getSlotModelDisplay(s, byKey);
                const mainTag = idx === 0 ? ' · Main' : '';
                const pillStyle = 'style="--pill-color:' + esc(profile.mixedColor) + '"';
                const swatch = '<span class="role-mini-dot" style="background:' + esc(profile.mixedColor) + '"></span>';
                return (
                  '<span class="status-pill" ' +
                  pillStyle +
                  ' title="' +
                  esc(modelDisp + ' — ' + profile.roleSummary) +
                  '"><span class="dot idle"></span>' +
                  swatch +
                  esc(modelDisp + mainTag) +
                  '</span>'
                );
              })
              .join('');
          }
        } else {
          teamPillsEl.innerHTML = expected
            .map((tag) => {
              const info = peersAgents && peersAgents[tag];
              const meta = slotMetaMap[tag] || {};
              const status = info ? info.status : 'OFFLINE';
              const dotClass =
                status === 'RUNNING'
                  ? 'running'
                  : status === 'IDLE'
                    ? 'idle'
                    : status === 'WAITING'
                      ? 'waiting'
                      : status === 'CREDIT_EXHAUSTED'
                        ? 'credit'
                        : 'offline';
              const isMain = mainAgent && tag.toLowerCase() === mainAgent.toLowerCase();
              const modelName = meta.displayName || info?.displayName || modelMap[tag] || meta.modelLabel || tag;
              const pillColor = meta.mixedColor || info?.mixedColor || '';
              const roleInfo = meta.roleSummary || info?.roleSummary || '';
              const pillStyle = pillColor ? 'style="--pill-color:' + esc(pillColor) + '"' : '';
              const swatch = pillColor ? '<span class="role-mini-dot" style="background:' + esc(pillColor) + '"></span>' : '';
              return (
                '<span class="status-pill" ' +
                pillStyle +
                ' title="' +
                esc(modelName + (roleInfo ? ' [' + roleInfo + ']' : '') + ': ' + (info?.activity || status)) +
                '"><span class="dot ' +
                dotClass +
                '"></span>' +
                swatch +
                esc(modelName + (isMain ? ' (Main)' : '')) +
                '</span>'
              );
            })
            .join('');
        }
      }

      function renderHistory() {
        historyDrawerEl.classList.toggle('open', state.historyOpen);
        historyBtnEl.classList.toggle('active', state.historyOpen);
        if (!state.historyOpen) return;

        const q = (state.historySearch || '').trim().toLowerCase();
        const sessions = (state.sessions || []).filter((s) => {
          if (!q) return true;
          return (
            String(s.title || '').toLowerCase().includes(q) ||
            String(s.summary || '').toLowerCase().includes(q) ||
            (Array.isArray(s.participants) ? s.participants.join(' ').toLowerCase().includes(q) : false)
          );
        });

        if (sessions.length === 0) {
          historyListEl.innerHTML =
            '<div class="empty-state" style="padding:24px 8px">' +
            '<h3>' +
            (q ? 'No matching collaborations' : 'No saved collaborations yet') +
            '</h3>' +
            '<p>Send a prompt to start and automatically save your first multi-agent session.</p>' +
            '</div>';
          return;
        }

        historyListEl.innerHTML = sessions
          .map((s) => {
            const isRenaming = state.renamingFolder === s.folder;
            const isConfirmDelete = state.confirmDeleteFolder === s.folder;
            const teamText = Array.isArray(s.participants) && s.participants.length > 0
              ? s.participants.map((p) => p + (s.mainAgent === p ? ' (Main)' : '')).join(', ')
              : 'Team not dispatched yet';
            const statsText = (s.feedCount || 0) + ' items';

            let topHtml = '';
            if (isRenaming) {
              topHtml =
                '<div class="form-row" style="width:100%" data-stop-switch="1">' +
                '<input class="field-input" data-rename-input="' +
                esc(s.folder) +
                '" value="' +
                esc(state.renameDraft) +
                '" />' +
                '<button class="btn-primary btn-xs" data-action="saveRename" data-folder="' +
                esc(s.folder) +
                '">Save</button>' +
                '<button class="btn-sec btn-xs" data-action="cancelRename">✕</button>' +
                '</div>';
            } else {
              topHtml =
                '<div class="history-card-top">' +
                '<span class="history-card-title">' +
                esc(s.title || s.folder) +
                '</span>' +
                '<div class="history-card-actions">' +
                (s.isActive ? '<span class="badge answered">Active</span>' : '') +
                (s.sessionCancelled ? '<span class="badge cancelled">Stopped</span>' : '') +
                '<button class="btn-sec btn-xs" data-action="startRename" data-folder="' +
                esc(s.folder) +
                '" data-title="' +
                esc(s.title || '') +
                '" title="Rename session">✏️</button>' +
                (isConfirmDelete
                  ? '<button class="btn-danger btn-xs" data-action="confirmDeleteSession" data-folder="' +
                    esc(s.folder) +
                    '">Confirm</button>' +
                    '<button class="btn-sec btn-xs" data-action="cancelDeleteSession">✕</button>'
                  : '<button class="btn-sec btn-xs" data-action="askDeleteSession" data-folder="' +
                    esc(s.folder) +
                    '" title="Delete session">🗑️</button>') +
                '</div></div>';
            }

            return (
              '<div class="history-card ' +
              (s.isActive ? 'active' : '') +
              '" data-action="switchSession" data-folder="' +
              esc(s.folder) +
              '">' +
              topHtml +
              '<div class="history-card-meta">' +
              '<span>' +
              esc(teamText) +
              '</span>' +
              '<span>' +
              esc((s.updatedAt || '') + ' · ' + statsText) +
              '</span></div></div>'
            );
          })
          .join('');
      }

      function renderSlots() {
        const agentsByKey = new Map(state.agents.map((a) => [a.key, a]));
        detectedMetaEl.textContent = state.agents.length + ' coding agent' + (state.agents.length === 1 ? '' : 's') + ' ready';

        let html = '';
        state.slots.forEach((slot, idx) => {
          const agent = slot && slot.agentKey ? agentsByKey.get(slot.agentKey) : null;
          const isMain = idx === 0;
          const isOpen = state.picker.openSlotIdx === idx;
          const profile = computeSlotProfile(slot, idx);
          const isSplitting = state.picker.lastSplitSlotIdx === idx;
          const classes = [
            'slot-chip',
            isMain && !agent ? 'empty-required' : '',
            isOpen ? 'active' : '',
            isSplitting ? 'splitting-from-prev' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const tagLabel = isMain ? 'Main' : 'Slot ' + (idx + 1);
          const hasSpecificModel = Boolean(agent && slot.modelId && slot.modelId !== 'auto' && slot.modelLabel);
          const primaryName = agent
            ? (hasSpecificModel ? slot.modelLabel : agent.label)
            : 'Select Agent';
          const providerSub = agent
            ? (hasSpecificModel ? agent.label : (slot.modelLabel || ''))
            : '';

          let slotStyle = '';
          if (agent) {
            slotStyle =
              '--slot-color:' +
              esc(profile.mixedColor) +
              ';--slot-text:' +
              esc(profile.textColor) +
              (isSplitting && state.picker.lastSplitFromColor
                ? ';--split-from-color:' + esc(state.picker.lastSplitFromColor)
                : '');
          }

          let pigmentHtml = '';
          if (agent && Array.isArray(profile.roles) && profile.roles.length > 0) {
            const dots = profile.roles
              .slice(0, 4)
              .map(
                (r) =>
                  '<span class="slot-color-swatch" style="background:' +
                  esc(r.color || '#64748B') +
                  '" title="' +
                  esc(r.name) +
                  '"></span>'
              )
              .join('');
            pigmentHtml = '<span class="slot-pigment-dots">' + dots + '</span>';
          }

          const shortRole = agent && profile.roleIds.length > 0
            ? (profile.roleIds.length === 1
                ? (profile.roles[0]?.name || profile.roleSummary)
                : profile.roleIds.length + ' roles')
            : '';

          html +=
            '<div class="' +
            classes +
            '" style="' +
            slotStyle +
            '" data-action="toggleSlot" data-slot="' +
            idx +
            '" title="' +
            esc(agent ? primaryName + ' (' + agent.label + ')' + (profile.roleSummary ? ' · Roles: ' + profile.roleSummary + ' [' + profile.mixedColor + ']' : ' · Unrestricted (No roles)') : 'Choose an agent & roles') +
            '">';
          html += pigmentHtml;
          html += '<span class="slot-tag ' + (isMain ? 'main-tag' : '') + '">' + esc(tagLabel) + '</span>';
          html += '<span class="slot-name">' + esc(primaryName) + '</span>';
          if (providerSub) {
            html += '<span class="slot-model">· ' + esc(providerSub) + '</span>';
          }
          if (shortRole) {
            html +=
              '<span class="slot-role-pill" style="background:' +
              esc(profile.mixedColor) +
              ';color:' +
              esc(profile.textColor) +
              '">' +
              esc(shortRole) +
              '</span>';
          }
          html += '<span style="opacity:0.65">▾</span>';
          if (!isMain && agent) {
            html +=
              '<button class="slot-promote" data-action="promoteSlotToMain" data-slot="' +
              idx +
              '" title="Make Main (swap into Slot 1)">★</button>';
          }
          if (!isMain) {
            html +=
              '<button class="slot-remove" data-action="removeSlot" data-slot="' +
              idx +
              '" title="Remove slot">×</button>';
          }
          html += '</div>';
        });

        html +=
          '<button class="add-slot-btn" data-action="addSlot" title="Split out a new teammate slot from front slot">+</button>';
        if (state.agents.length > 1) {
          html +=
            '<button class="ctx-chip" data-action="autoFillTeam" title="Auto-fill all detected coding agents into slots">⚡ Auto</button>';
        }
        slotsRowEl.innerHTML = html;
        updateSendState();
      }

      function renderPopover() {
        const slotIdx = state.picker.openSlotIdx;
        if (slotIdx === null || slotIdx >= state.slots.length) {
          popoverEl.classList.remove('open');
          popoverEl.innerHTML = '';
          return;
        }

        const prevFocusedSearch = document.activeElement && document.activeElement.id === 'pickerSearchInput';
        const agentsByKey = new Map(state.agents.map((a) => [a.key, a]));
        const currentSlot = state.slots[slotIdx];
        const query = (state.picker.search || '').trim().toLowerCase();
        const activeTab = state.picker.tab === 'roles' ? 'roles' : 'agents';
        const profile = computeSlotProfile(currentSlot, slotIdx);

        let html =
          '<div class="picker-tabs">' +
          '<button type="button" class="picker-tab ' +
          (activeTab === 'agents' ? 'active' : '') +
          '" data-action="switchPickerTab" data-tab="agents">🤖 Agents &amp; Models</button>' +
          '<button type="button" class="picker-tab ' +
          (activeTab === 'roles' ? 'active' : '') +
          '" style="--tab-accent:' +
          esc(profile.mixedColor) +
          '" data-action="switchPickerTab" data-tab="roles"><span class="role-mini-dot" style="background:' +
          esc(profile.mixedColor) +
          '"></span>🎨 Roles (' +
          profile.roleIds.length +
          ')</button>' +
          '</div>';

        if (activeTab === 'roles') {
          const isMain = slotIdx === 0;
          const reg = state.roleRegistry || {};
          const categories = Array.isArray(state.roleCategories) && state.roleCategories.length > 0
            ? state.roleCategories
            : [];
          const hasAgent = Boolean(currentSlot && currentSlot.agentKey);
          const slotModelLabel = hasAgent ? getSlotModelDisplay(currentSlot, agentsByKey) : 'Unassigned Slot';

          html +=
            '<div class="picker-head">' +
            '<span>' +
            (isMain ? 'Main (Slot 1)' : 'Slot ' + (slotIdx + 1)) +
            ' Roles · ' +
            esc(slotModelLabel) +
            '</span>' +
            '<div class="picker-head-actions">' +
            (profile.roleIds.length > 0
              ? '<button type="button" class="btn-sec btn-xs" data-action="clearSlotRoles">Clear Roles</button>'
              : '') +
            '<span class="badge role-pill" style="background:' +
            esc(profile.mixedColor) +
            ';color:' +
            esc(profile.textColor) +
            '">' +
            esc(profile.mixedColor) +
            '</span>' +
            '</div>' +
            '</div>';

          if (!hasAgent) {
            html +=
              '<div class="picker-section" style="padding:10px;text-transform:none">' +
              'Pick a coding agent &amp; model in the <strong>🤖 Agents &amp; Models</strong> tab first to customize roles for this slot.' +
              '</div>';
            popoverEl.innerHTML = html;
            popoverEl.classList.add('open');
            return;
          }

          const tierBadgeClass =
            profile.effectiveWritePermission === 'comms-md-only'
              ? 'tier-comms'
              : profile.effectiveWritePermission === 'plan-doc-only'
                ? 'tier-plan'
                : 'tier-code';
          const tierLabelText =
            profile.effectiveWritePermission === 'comms-md-only'
              ? '💬 Comms MD Only'
              : profile.effectiveWritePermission === 'plan-doc-only'
                ? '📋 Plan Docs Only'
                : '💻 Code Write';
          const escLabelText =
            profile.effectiveHubEscalation === 'escalate-to-main'
              ? 'Escalate to Main'
              : profile.effectiveHubEscalation === 'critical-blocker-only'
                ? 'Critical Blockers Only'
                : 'Direct User Hub';

          const pigmentChain = profile.roles
            .map(
              (r) =>
                '<span class="paint-dot" style="background:' +
                esc(r.color || '#64748B') +
                '" title="' +
                esc(r.name + ' (' + (r.color || '') + ')') +
                '"></span>'
            )
            .join('<span style="opacity:0.65">+</span>');

          html += '<div class="paint-mix-banner">';
          if (profile.roles.length === 0) {
            html +=
              '<div class="paint-formula-row">' +
              '<span class="paint-dots-chain">' +
              '<span class="paint-dot mixed" style="background:' +
              esc(profile.mixedColor) +
              '"></span>' +
              '<span>No roles selected (Unrestricted · ' +
              esc(profile.mixedColor) +
              ')</span></span>' +
              '<span style="display:inline-flex;gap:4px;align-items:center">' +
              '<span class="role-tier-badge ' +
              tierBadgeClass +
              '">' +
              tierLabelText +
              '</span>' +
              '<span class="role-tier-badge">' +
              esc(escLabelText) +
              '</span>' +
              '</span>' +
              '</div></div>';
          } else {
            html +=
              '<div class="paint-formula-row">' +
              '<span class="paint-dots-chain">' +
              pigmentChain +
              '<span style="opacity:0.75">→</span>' +
              '<span class="paint-dot mixed" style="background:' +
              esc(profile.mixedColor) +
              '" title="Mixed RYB Pigment ' +
              esc(profile.mixedColor) +
              '"></span>' +
              '<code style="font-size:10px">' +
              esc(profile.mixedColor) +
              '</code></span>' +
              '<span style="display:inline-flex;gap:4px;align-items:center">' +
              '<span class="role-tier-badge ' +
              tierBadgeClass +
              '">' +
              tierLabelText +
              '</span>' +
              '<span class="role-tier-badge">' +
              esc(escLabelText) +
              '</span>' +
              '</span>' +
              '</div>';

            html += '<div class="paint-chip-row">';
            for (const r of profile.roles) {
              const rColor = r.color || '#64748B';
              html +=
                '<span class="active-role-chip" style="background:' +
                esc(rColor) +
                ';color:' +
                esc(typeof getContrastingTextColor === 'function' ? getContrastingTextColor(rColor) : '#FFFFFF') +
                '"><span>' +
                esc(r.name) +
                '</span><button type="button" class="active-role-rm" data-action="toggleRole" data-role="' +
                esc(r.id) +
                '" title="Remove role">×</button></span>';
            }
            html += '</div></div>';
          }

          html +=
            '<div class="picker-search-wrap">' +
            '<input class="picker-search" id="pickerSearchInput" placeholder="Filter 23 roles or categories..." value="' +
            esc(state.picker.search) +
            '" />' +
            '</div>';

          const disabledMap =
            typeof getIncompatibleRoles === 'function'
              ? getIncompatibleRoles(profile.roleIds, reg, { isMain })
              : new Map();
          const catIconMap = {
            leadership: '👑',
            engineering: '💻',
            quality_security: '🛡️',
            design_media: '🎨',
            context_data: '🔍',
            docs_tooling: '📝',
          };

          html += '<div class="picker-list">';
          let matchedAnyRole = false;
          for (const cat of categories) {
            const catRoles = Object.values(reg).filter((r) => r && r.category === cat.id);
            const filtered = catRoles.filter(
              (r) =>
                !query ||
                r.name.toLowerCase().includes(query) ||
                (r.shortDescription || '').toLowerCase().includes(query) ||
                cat.label.toLowerCase().includes(query) ||
                r.writePermission.toLowerCase().includes(query)
            );
            if (filtered.length === 0) continue;
            matchedAnyRole = true;
            const catIcon = cat.icon || catIconMap[cat.id] || '🧩';
            html += '<div class="picker-section">' + esc(catIcon + ' ' + cat.label) + '</div>';
            for (const r of filtered) {
              const rColor = r.color || '#64748B';
              const isSelected = profile.roleIds.includes(r.id);
              let disableEntry = !isSelected ? disabledMap.get(r.id) : null;
              let switchNote = '';
              if (
                disableEntry &&
                isMain &&
                r.category === 'leadership' &&
                disableEntry.blockedByRoleIds.every((bid) => reg[bid] && reg[bid].category === 'leadership')
              ) {
                disableEntry = null;
                switchNote = '🔀 Click to switch Main leadership role';
              }
              const isDisabled = Boolean(disableEntry);
              const rTierCls =
                r.writePermission === 'comms-md-only'
                  ? 'tier-comms'
                  : r.writePermission === 'plan-doc-only'
                    ? 'tier-plan'
                    : 'tier-code';
              const rTierTxt =
                r.writePermission === 'comms-md-only'
                  ? 'Comms MD'
                  : r.writePermission === 'plan-doc-only'
                    ? 'Plan MD'
                    : 'Code';
              html +=
                '<button type="button" class="role-opt ' +
                (isSelected ? 'selected' : '') +
                ' ' +
                (isDisabled ? 'disabled' : '') +
                '" style="--role-color:' +
                esc(rColor) +
                '" data-action="toggleRole" data-role="' +
                esc(r.id) +
                '" ' +
                (isDisabled ? 'aria-disabled="true" title="' + esc(disableEntry.reasonText) + '"' : '') +
                '>' +
                '<span class="picker-left" style="align-items:flex-start">' +
                '<span class="paint-dot" style="margin-top:3px;background:' +
                esc(rColor) +
                '"></span>' +
                '<span class="picker-meta">' +
                '<span class="picker-title">' +
                esc(r.name) +
                ' <span class="role-tier-badge ' +
                rTierCls +
                '">' +
                rTierTxt +
                '</span></span>' +
                '<span class="picker-sub" style="white-space:normal">' +
                esc(r.shortDescription || '') +
                '</span>' +
                (isDisabled
                  ? '<span class="role-conflict-pill">🔒 ' + esc(disableEntry.reasonText) + '</span>'
                  : switchNote
                    ? '<span class="picker-sub">' + esc(switchNote) + '</span>'
                    : '') +
                '</span></span>' +
                '<span class="picker-right">' +
                (isSelected ? '✓' : '') +
                '</span></button>';
            }
          }
          if (!matchedAnyRole) {
            html += '<div class="picker-section">No matching roles found</div>';
          }
          html += '</div>';

          popoverEl.innerHTML = html;
          popoverEl.classList.add('open');
          if (prevFocusedSearch) {
            const searchInp = document.getElementById('pickerSearchInput');
            if (searchInp) {
              searchInp.focus();
              searchInp.setSelectionRange(searchInp.value.length, searchInp.value.length);
            }
          }
          return;
        }

        // Tab 1: Agents & Models
        const presets = Array.isArray(state.teamPresets) ? state.teamPresets : Object.values(state.teamPresets || {});
        if (presets.length > 0) {
          html += '<div class="preset-bar"><span class="preset-label">Presets:</span>';
          for (const pr of presets) {
            const pId = pr.id || pr.key || '';
            const pName = pr.name || pr.label || pId;
            html +=
              '<button type="button" class="preset-chip" data-action="applyPreset" data-preset="' +
              esc(pId) +
              '" title="' +
              esc(pr.description || '') +
              '">' +
              esc(pName) +
              '</button>';
          }
          html += '</div>';
        }

        if (state.picker.step === 'models' && state.picker.activeAgentKey && agentsByKey.has(state.picker.activeAgentKey)) {
          const ag = agentsByKey.get(state.picker.activeAgentKey);
          const models = (ag.models || []).filter(
            (m) =>
              !query ||
              m.label.toLowerCase().includes(query) ||
              m.id.toLowerCase().includes(query) ||
              (m.group || '').toLowerCase().includes(query)
          );

          const grouped = new Map();
          for (const m of models) {
            const g = m.group || 'Models';
            if (!grouped.has(g)) grouped.set(g, []);
            grouped.get(g).push(m);
          }

          const planBadge = ag.planInfo && ag.planInfo.label
            ? '<span class="plan-chip">' + esc(ag.planInfo.label) + '</span>'
            : '';

          html +=
            '<div class="picker-head">' +
            '<button class="btn-sec btn-xs" data-action="backToAgents">← Providers</button>' +
            '<span>' +
            esc(ag.label) +
            ' Models ' +
            planBadge +
            '</span>' +
            '<button class="btn-sec btn-xs" data-action="clearSlot">Clear</button>' +
            '</div>';

          html +=
            '<div class="picker-search-wrap">' +
            '<input class="picker-search" id="pickerSearchInput" placeholder="Filter models..." value="' +
            esc(state.picker.search) +
            '" />' +
            '</div>';

          html += '<div class="picker-list">';
          if (grouped.size === 0) {
            html += '<div class="picker-section">No matching models</div>';
          } else {
            for (const [groupName, list] of grouped.entries()) {
              html += '<div class="picker-section">' + esc(groupName) + '</div>';
              for (const m of list) {
                const isSelected =
                  currentSlot &&
                  currentSlot.agentKey === ag.key &&
                  currentSlot.modelId === m.id;
                const otherSlotsUsingModel = state.slots
                  .map((s, i) => (s && s.agentKey === ag.key && s.modelId === m.id && i !== slotIdx ? (i === 0 ? 'Main' : 'Slot ' + (i + 1)) : null))
                  .filter(Boolean);
                const rightText = isSelected
                  ? '✓ This slot'
                  : otherSlotsUsingModel.length > 0
                    ? 'Also in ' + otherSlotsUsingModel.join(', ')
                    : '';
                html +=
                  '<button class="picker-item ' +
                  (isSelected ? 'selected' : '') +
                  '" data-action="pickModel" data-agent="' +
                  esc(ag.key) +
                  '" data-model-id="' +
                  esc(m.id) +
                  '" data-model-label="' +
                  esc(m.label) +
                  '" data-vendor="' +
                  esc(m.vendor || '') +
                  '" data-family="' +
                  esc(m.family || '') +
                  '">' +
                  '<span class="picker-left"><span class="picker-meta">' +
                  '<span class="picker-title">' +
                  esc(m.label) +
                  '</span>' +
                  '<span class="picker-sub">' +
                  esc(m.id) +
                  (m.live ? ' · live' : '') +
                  '</span>' +
                  '</span></span>' +
                  '<span class="picker-right">' +
                  esc(rightText) +
                  '</span></button>';
              }
            }
          }
          html += '</div>';

          popoverEl.innerHTML = html;
          popoverEl.classList.add('open');
          const searchInp = document.getElementById('pickerSearchInput');
          if (searchInp && (prevFocusedSearch || query === '')) {
            searchInp.focus();
            searchInp.setSelectionRange(searchInp.value.length, searchInp.value.length);
          }
          return;
        }

        // Step 1: Select Coding Agent Provider (same provider allowed across multiple slots)
        const filteredAgents = state.agents.filter(
          (ag) =>
            !query ||
            ag.label.toLowerCase().includes(query) ||
            ag.tag.toLowerCase().includes(query) ||
            (ag.description || '').toLowerCase().includes(query)
        );

        html +=
          '<div class="picker-head">' +
          '<span>' +
          (slotIdx === 0 ? 'Select Main Agent (Slot 1)' : 'Select Teammate (Slot ' + (slotIdx + 1) + ')') +
          '</span>' +
          '<div class="picker-head-actions">' +
          (currentSlot ? '<button class="btn-sec btn-xs" data-action="clearSlot">Clear</button>' : '') +
          '</div></div>';

        html +=
          '<div class="picker-search-wrap">' +
          '<input class="picker-search" id="pickerSearchInput" placeholder="Search coding providers..." value="' +
          esc(state.picker.search) +
          '" />' +
          '</div>';

        html += '<div class="picker-list">';
        if (filteredAgents.length === 0) {
          html += '<div class="picker-section">No coding agents match filter</div>';
        } else {
          for (const ag of filteredAgents) {
            const matchingIndices = state.slots
              .map((s, i) => (s && s.agentKey === ag.key ? i : -1))
              .filter((i) => i !== -1);
            const isCurrent = Boolean(currentSlot && currentSlot.agentKey === ag.key);
            const slotLabels = matchingIndices.map((i) => (i === 0 ? 'Main' : 'Slot ' + (i + 1)));
            const slotNote = slotLabels.length > 0
              ? slotLabels.join(', ') + (ag.models && ag.models.length > 1 ? ' · ' + ag.models.length + ' models →' : '')
              : (ag.models ? ag.models.length + ' models →' : ag.tag);

            const agPlanBadge = ag.planInfo && ag.planInfo.label
              ? ' <span class="plan-chip">' + esc(ag.planInfo.label) + '</span>'
              : '';
            html +=
              '<button class="picker-item ' +
              (isCurrent ? 'selected' : '') +
              '" data-action="chooseAgentStep" data-key="' +
              esc(ag.key) +
              '">' +
              '<span class="picker-left">' +
              '<span class="agent-badge">' +
              esc(ag.badge || 'AGT') +
              '</span>' +
              '<span class="picker-meta">' +
              '<span class="picker-title">' +
              esc(ag.label) +
              agPlanBadge +
              '</span>' +
              '<span class="picker-sub">' +
              esc(ag.description || ag.id) +
              '</span>' +
              '</span>' +
              '</span>' +
              '<span class="picker-right">' +
              esc(slotNote) +
              '</span>' +
              '</button>';
          }
        }
        html += '</div>';

        popoverEl.innerHTML = html;
        popoverEl.classList.add('open');
        if (prevFocusedSearch) {
          const searchInp = document.getElementById('pickerSearchInput');
          if (searchInp) {
            searchInp.focus();
            searchInp.setSelectionRange(searchInp.value.length, searchInp.value.length);
          }
        }
      }

      function syncPromptDraftsFromSettings(force = false) {
        if (!force && state.promptDraftsInitialized) return;
        const s = state.settings || {};
        state.promptDraftGlobal =
          typeof s.globalPromptTemplate === 'string' && s.globalPromptTemplate.trim()
            ? s.globalPromptTemplate
            : state.defaultGlobalTemplate || '';
        state.promptDraftAgyMode = s.antigravityLaunchMode || 'ui_with_cli_fallback';
        const mergedAgents = {};
        const defMap = state.defaultAgentPrompts || {};
        const savedMap = s.agentPrompts && typeof s.agentPrompts === 'object' ? s.agentPrompts : {};
        for (const key of new Set([...Object.keys(defMap), ...Object.keys(savedMap)])) {
          const base = savedMap[key] || defMap[key] || { mode: 'append', template: '' };
          mergedAgents[key] = {
            mode: base.mode === 'override' ? 'override' : 'append',
            template: String(base.template || ''),
          };
        }
        state.promptDraftAgents = mergedAgents;
        state.promptDraftsInitialized = true;
      }

      function renderSettings() {
        settingsBtnEl.classList.toggle('active', state.settingsOpen);
        settingsDrawerEl.classList.toggle('open', state.settingsOpen);
        if (!state.settingsOpen) return;

        syncPromptDraftsFromSettings(false);
        const s = state.settings || {};
        const toggleItem = (key, title, desc) =>
          '<label class="toggle-row">' +
          '<span class="toggle-desc"><span>' +
          esc(title) +
          '</span><span class="toggle-sub">' +
          esc(desc) +
          '</span></span>' +
          '<input type="checkbox" data-setting="' +
          esc(key) +
          '" ' +
          (s[key] !== false && (key !== 'showAllKnownAgents' || Boolean(s[key])) ? 'checked' : '') +
          ' /></label>';

        const agentOpts = state.agents
          .map((ag) => '<option value="' + esc(ag.key) + '">' + esc(ag.label) + '</option>')
          .join('');

        const knownPromptKeys = Array.from(
          new Set([
            ...state.agents.map((a) => a.key),
            '@antigravity',
            '@copilot',
            '@claude',
            '@codex',
            ...Object.keys(state.promptDraftAgents || {}),
          ])
        );
        if (!knownPromptKeys.includes(state.selectedPromptAgent)) {
          state.selectedPromptAgent = knownPromptKeys[0] || '@antigravity';
        }
        const promptAgentOpts = knownPromptKeys
          .map((k) => {
            const ag = state.agents.find((a) => a.key === k);
            const label = ag ? ag.label + ' (' + k + ')' : k;
            return (
              '<option value="' +
              esc(k) +
              '"' +
              (k === state.selectedPromptAgent ? ' selected' : '') +
              '>' +
              esc(label) +
              '</option>'
            );
          })
          .join('');

        const activeAgentDraft = (state.promptDraftAgents && state.promptDraftAgents[state.selectedPromptAgent]) || {
          mode: 'append',
          template: '',
        };
        const agyMode = state.promptDraftAgyMode || s.antigravityLaunchMode || 'ui_with_cli_fallback';

        const placeholders = ['{{agent}}', '{{agentLabel}}', '{{roleLabel}}', '{{roleSummary}}', '{{roleColor}}', '{{multiRoleBlock}}', '{{mainAgent}}', '{{teamList}}', '{{userPrompt}}', '{{activeMessageDirective}}', '{{attachmentsNote}}', '{{planRule}}'];
        const chipsHtml = placeholders
          .map(
            (ph) =>
              '<button type="button" class="chip-insert" data-action="insertPlaceholder" data-token="' +
              esc(ph) +
              '">' +
              esc(ph) +
              '</button>'
          )
          .join('');

        const customListHtml = (s.customModels || [])
          .map(
            (cm) =>
              '<div class="custom-model-item">' +
              '<span><strong>' +
              esc(cm.agentKey) +
              '</strong> · ' +
              esc(cm.label) +
              ' <code>' +
              esc(cm.id) +
              '</code></span>' +
              '<button class="btn-sec btn-xs" data-action="removeCustomModel" data-agent="' +
              esc(cm.agentKey) +
              '" data-id="' +
              esc(cm.id) +
              '">×</button></div>'
          )
          .join('');

        settingsBodyEl.innerHTML =
          '<div class="settings-group">' +
          '<div class="settings-group-title">Orchestration</div>' +
          toggleItem('autoLaunchAgents', 'Auto-launch agents on Send', 'Simultaneously open/send prompts to all selected slots.') +
          toggleItem('startNewConversation', 'Start fresh conversation per dispatch', 'Off (default): reuse the same agent chat session on follow-up messages. On: start a new chat every message.') +
          toggleItem('keepFocusOnSend', 'Keep focus on AIvengers tab', 'Returns to this tab after triggering other agent windows.') +
          toggleItem('attachInboxFile', 'Attach USER_INBOX.md in Copilot Chat', 'Passes USER_INBOX.md as file context on Copilot launch.') +
          toggleItem('requirePlanApproval', 'Require user plan approval gate', 'Prompts agents to pause before editing outside hub files.') +
          toggleItem('showAllKnownAgents', 'Show uninstalled coding agents', 'Include CLI/external agents such as Claude Code or Codex even if extension is missing.') +
          '<div class="custom-model-form" style="margin-top:4px">' +
          '<span class="toggle-sub">Antigravity Assembly Mode</span>' +
          '<select class="field-select" id="antigravityModeSelect">' +
          '<option value="ui_with_cli_fallback"' + (agyMode === 'ui_with_cli_fallback' ? ' selected' : '') + '>UI + agy CLI Fallback if not assembled (Recommended)</option>' +
          '<option value="ui_only"' + (agyMode === 'ui_only' ? ' selected' : '') + '>IDE Chat Panel UI Only</option>' +
          '<option value="cli_only"' + (agyMode === 'cli_only' ? ' selected' : '') + '>Headless agy CLI Only (Selected Model)</option>' +
          '</select>' +
          '</div>' +
          '</div>' +
          '<div class="settings-group">' +
          '<div class="settings-group-title">Prompt Templates (All Agents & Individual Agents)</div>' +
          '<span class="toggle-sub">Shared prompt template sent to all participating agents:</span>' +
          '<textarea class="prompt-editor-area" id="globalPromptInput">' +
          esc(state.promptDraftGlobal || '') +
          '</textarea>' +
          '<div class="placeholder-chips">' +
          chipsHtml +
          '</div>' +
          '<span class="toggle-sub" style="margin-top:4px">Individual agent instruction:</span>' +
          '<div class="form-row">' +
          '<select class="field-select" id="agentPromptSelect">' +
          promptAgentOpts +
          '</select>' +
          '<select class="field-select" id="agentPromptModeSelect">' +
          '<option value="append"' + (activeAgentDraft.mode !== 'override' ? ' selected' : '') + '>Append to Global</option>' +
          '<option value="override"' + (activeAgentDraft.mode === 'override' ? ' selected' : '') + '>Override Global</option>' +
          '</select>' +
          '</div>' +
          '<textarea class="prompt-editor-area" id="agentPromptInput" placeholder="Extra or replacement instructions for this agent...">' +
          esc(activeAgentDraft.template || '') +
          '</textarea>' +
          '<div class="form-row">' +
          '<button class="btn-primary btn-xs" id="savePromptsBtn">Save Prompt Settings</button>' +
          '<button class="btn-sec btn-xs" id="resetAgentPromptBtn">Reset Agent</button>' +
          '<button class="btn-sec btn-xs" id="resetAllPromptsBtn">Reset All</button>' +
          '</div>' +
          '</div>' +
          '<div class="settings-group">' +
          '<div class="settings-group-title">Custom Models</div>' +
          '<div class="custom-model-form">' +
          '<select class="field-select" id="customAgentSelect">' +
          (agentOpts || '<option value="@copilot">GitHub Copilot</option>') +
          '</select>' +
          '<div class="form-row">' +
          '<input class="field-input" id="customModelIdInput" placeholder="Model ID (e.g. gpt-5)" />' +
          '<input class="field-input" id="customModelLabelInput" placeholder="Display label (optional)" />' +
          '</div>' +
          '<button class="btn-primary btn-xs" id="addCustomModelBtn">Add Custom Model</button>' +
          '</div>' +
          (customListHtml ? '<div class="custom-model-list">' + customListHtml + '</div>' : '') +
          '</div>' +
          '<div class="settings-group">' +
          '<div class="settings-group-title">Workspace Actions</div>' +
          '<div class="form-row">' +
          '<button class="btn-sec btn-xs" data-action="settingsOpenInbox">Open USER_INBOX.md</button>' +
          '<button class="btn-sec btn-xs" data-action="initWorkspaceHub">Init Hub Folder</button>' +
          '<button class="btn-sec btn-xs" data-action="settingsNewSession">Reset Session</button>' +
          '<button class="btn-sec btn-xs" data-action="openVsCodeSettings">VS Code Settings JSON</button>' +
          '</div></div>';
      }

      const STARTER_PROMPTS = {
        feature: 'Design and implement [describe feature]. Split backend, UI, and tests across the AIvengers team and propose the plan via poll before editing host files.',
        bug: 'Investigate and fix [describe bug or failing test]. Identify root cause first, propose the fix plan via poll, then patch and verify end-to-end.',
        audit: 'Audit [target files/module] for correctness, edge cases, security issues, and performance bottlenecks. Report prioritized findings and await poll before applying fixes.',
        tests: 'Write comprehensive unit and integration tests for [module/feature], run the test suite, and report coverage/results cleanly.',
      };

      function renderFeed() {
        const items = (state.feed && Array.isArray(state.feed.items) ? state.feed.items : []).filter(
          (i) => ['user_prompt', 'report', 'question', 'poll'].includes(i.kind)
        );

        if (items.length === 0) {
          const emptyLogo = BRAND_LOGO_URI
            ? '<img class="brand-logo-lg" src="' + esc(BRAND_LOGO_URI) + '" alt="AIvengers" />'
            : '<div class="empty-mark">AI</div>';
          feedEl.innerHTML =
            '<div class="empty-state">' +
            emptyLogo +
            '<h3>AIvengers — Assemble Your AI Coding Team</h3>' +
            '<p>Pick your <strong>Main</strong> manager agent &amp; model in <strong>Slot 1</strong> below, add specialist teammates with <strong>+</strong> (or click <strong>⚡ Auto-Fill</strong>), and coordinate from one clean feed.</p>' +
            '<p>Only structured <strong>Reports</strong>, <strong>Questions</strong>, and <strong>Plan Approval Polls</strong> appear here — zero noisy agent chatter.</p>' +
            '<div class="empty-actions">' +
            '<button class="btn-primary btn-xs" data-action="autoFillTeam">⚡ Auto-Fill Installed Team</button>' +
            '<button class="btn-sec btn-xs" data-action="openGuide">📖 How It Works</button>' +
            '</div>' +
            '<div class="starter-grid">' +
            '<button class="starter-chip" data-action="useStarterPrompt" data-starter="feature">🏗️ Build Feature</button>' +
            '<button class="starter-chip" data-action="useStarterPrompt" data-starter="bug">🐛 Fix Bug</button>' +
            '<button class="starter-chip" data-action="useStarterPrompt" data-starter="audit">🔍 Code &amp; Security Audit</button>' +
            '<button class="starter-chip" data-action="useStarterPrompt" data-starter="tests">🧪 Write &amp; Verify Tests</button>' +
            '</div>' +
            '</div>';
          return;
        }

        const counts = {
          all: items.length,
          report: items.filter((i) => i.kind === 'report').length,
          interactive: items.filter((i) => i.kind === 'question' || i.kind === 'poll').length,
          prompt: items.filter((i) => i.kind === 'user_prompt').length,
        };
        const filter = state.feedFilter || 'all';
        const filteredItems = items.filter((i) => {
          if (filter === 'report') return i.kind === 'report';
          if (filter === 'interactive') return i.kind === 'question' || i.kind === 'poll';
          if (filter === 'prompt') return i.kind === 'user_prompt';
          return true;
        });

        const activeQuestionInputs = feedEl.querySelectorAll('textarea[data-question-id]');
        activeQuestionInputs.forEach((ta) => {
          state.questionDrafts[ta.dataset.questionId] = ta.value;
        });
        const activePollCustomInputs = feedEl.querySelectorAll('input[data-poll-custom-id]');
        activePollCustomInputs.forEach((inp) => {
          const d = state.pollDrafts[inp.dataset.pollCustomId] || { selected: [], custom: '' };
          d.custom = inp.value;
          state.pollDrafts[inp.dataset.pollCustomId] = d;
        });

        let html =
          '<div class="feed-filter-bar">' +
          '<button class="filter-pill ' + (filter === 'all' ? 'active' : '') + '" data-action="setFeedFilter" data-filter="all">All (' + counts.all + ')</button>' +
          '<button class="filter-pill ' + (filter === 'report' ? 'active' : '') + '" data-action="setFeedFilter" data-filter="report">Reports (' + counts.report + ')</button>' +
          '<button class="filter-pill ' + (filter === 'interactive' ? 'active' : '') + '" data-action="setFeedFilter" data-filter="interactive">Polls &amp; Q (' + counts.interactive + ')</button>' +
          '<button class="filter-pill ' + (filter === 'prompt' ? 'active' : '') + '" data-action="setFeedFilter" data-filter="prompt">Prompts (' + counts.prompt + ')</button>' +
          '</div>';

        if (filteredItems.length === 0) {
          html += '<div class="empty-state" style="padding:20px 8px"><p>No items match the selected filter.</p></div>';
        }

        for (const item of filteredItems) {
          const time = esc(item.timestamp || '');
          const presSlotMeta = (state.presence && state.presence.slotMeta) || {};
          const presAgentModels = (state.presence && state.presence.agentModels) || {};
          const fallbackSlotInfo =
            (item.agent && presSlotMeta[item.agent]) ||
            (state.peers && state.peers.slotMeta && state.peers.slotMeta[item.agent]) ||
            {};
          const resolvedActorName =
            item.agentLabel ||
            item.modelLabel ||
            fallbackSlotInfo.displayName ||
            (item.agent && presAgentModels[item.agent]) ||
            item.agent ||
            '@Agent';
          const agentName = esc(resolvedActorName);
          const actorColor = item.mixedColor || fallbackSlotInfo.mixedColor || '';
          const actorTextColor = actorColor
            ? (typeof getContrastingTextColor === 'function' ? getContrastingTextColor(actorColor) : '#FFFFFF')
            : '';
          const actorRoles = item.roleSummary || fallbackSlotInfo.roleSummary || '';
          const dotStyle = actorColor
            ? 'style="--dot-bg:' + esc(actorColor) + ';--dot-fg:' + esc(actorTextColor) + '"'
            : '';
          const rolePillHtml = actorRoles
            ? '<span class="badge role-pill" style="' +
              (actorColor
                ? 'background:' + esc(actorColor) + ';color:' + esc(actorTextColor)
                : '') +
              '" title="Assigned Roles">' +
              esc(actorRoles) +
              '</span>'
            : '';
          const initial = esc(String(resolvedActorName).replace(/^@/, '').slice(0, 1).toUpperCase());

          if (item.kind === 'user_prompt') {
            const models = item.models || {};
            const itemSlotMeta = item.slotMeta || {};
            const teamHtml = Array.isArray(item.participants)
              ? item.participants
                  .map((p, i) => {
                    const sm = itemSlotMeta[p] || {};
                    const display = sm.displayName || models[p] || p;
                    const colorDot = sm.mixedColor
                      ? '<span class="role-mini-dot" style="background:' + esc(sm.mixedColor) + '"></span>'
                      : '';
                    return (
                      '<span style="display:inline-flex;align-items:center;gap:3px">' +
                      colorDot +
                      esc(display + (i === 0 ? ' [Main]' : '')) +
                      '</span>'
                    );
                  })
                  .join('<span>, </span>')
              : '';
            html += '<div class="msg-row user"><div class="user-bubble">';
            html += '<div class="user-meta"><strong>You</strong>';
            if (item.messageNumber) {
              html += '<span class="badge">Message ' + esc(item.messageNumber) + '</span>';
            }
            if (teamHtml) html += '<span>·</span>' + teamHtml;
            html += '<span>· ' + time + '</span></div>';
            html += '<div class="card-body">' + renderFormattedText(item.prompt || '') + '</div>';
            if (Array.isArray(item.attachments) && item.attachments.length > 0) {
              html += '<div class="files-list">';
              for (const att of item.attachments) {
                if (!att || !att.path) continue;
                const label = att.name || String(att.path).split(/[\\\\/]/).pop() || att.path;
                html +=
                  '<button class="file-chip" data-action="openFile" data-file="' +
                  esc(att.path) +
                  '" title="' +
                  esc(att.path) +
                  '">' +
                  (att.isDirectory ? '📁 ' : '📎 ') +
                  esc(label) +
                  '</button>';
              }
              html += '</div>';
            }
            if (Array.isArray(item.launchResults) && item.launchResults.length > 0) {
              html += '<div class="launch-list">';
              for (const lr of item.launchResults) {
                const icon = lr.status === 'auto_submitted' ? '✓' : lr.status === 'opened_run_assemble' ? '↗' : '•';
                const lrName = lr.displayName || lr.modelLabel || lr.tag;
                const lrStyle = lr.mixedColor ? 'style="--pill-color:' + esc(lr.mixedColor) + '"' : '';
                html +=
                  '<span class="status-pill" ' +
                  lrStyle +
                  ' title="' +
                  esc((lr.tag || '') + (lr.roleSummary ? ' · ' + lr.roleSummary : '')) +
                  '">' +
                  icon +
                  ' ' +
                  esc(lrName) +
                  '</span>';
              }
              html +=
                '<button class="btn-sec btn-xs" data-action="copyKickoff" data-prompt="' +
                esc(item.prompt || '') +
                '">Copy Prompt</button>';
              html += '</div>';
            }
            html += '</div></div>';
            continue;
          }

          if (item.kind === 'report') {
            const rType = String(item.reportType || 'milestone').toLowerCase();
            const badgeClass =
              rType === 'checkpoint'
                ? 'checkpoint'
                : rType === 'final_summary'
                  ? 'final_summary'
                  : rType === 'cancelled'
                    ? 'cancelled'
                    : 'report';
            const typeLabel =
              rType === 'checkpoint'
                ? 'Checkpoint'
                : rType === 'final_summary'
                  ? 'Final Summary'
                  : rType === 'cancelled'
                    ? 'Cancelled'
                    : rType === 'detailed_update'
                      ? 'Update'
                      : 'Milestone';

            const cardAccentStyle = rType !== 'cancelled' && actorColor
              ? 'style="--card-accent:' + esc(actorColor) + '"'
              : '';
            html += '<div class="card ' + (rType === 'cancelled' ? 'cancelled' : '') + '" ' + cardAccentStyle + '>';
            html +=
              '<div class="card-head"><div class="card-badges">' +
              '<span class="avatar-dot" ' + dotStyle + '>' +
              initial +
              '</span>' +
              '<strong>' +
              agentName +
              '</strong>' +
              rolePillHtml +
              '<span class="badge ' +
              badgeClass +
              '">' +
              typeLabel +
              '</span>' +
              '</div><div class="footer-btns">' +
              '<button class="btn-sec btn-xs" data-action="copyReport" data-id="' +
              esc(item.id) +
              '" title="Copy report">📋 Copy</button>' +
              '<span class="card-time">' +
              time +
              '</span></div></div>';
            if (item.title) html += '<div class="card-title">' + esc(item.title) + '</div>';
            if (item.summary) html += '<div class="card-body">' + renderFormattedText(item.summary) + '</div>';
            if (Array.isArray(item.filesChanged) && item.filesChanged.length > 0) {
              html += '<div class="files-list">';
              for (const f of item.filesChanged) {
                const base = String(f).split(/[\\\\/]/).pop() || f;
                html +=
                  '<button class="file-chip" data-action="openFile" data-file="' +
                  esc(f) +
                  '" title="' +
                  esc(f) +
                  '">📄 ' +
                  esc(base) +
                  '</button>';
              }
              html += '</div>';
            }
            if (item.nextSteps) {
              html +=
                '<div class="card-context"><strong>Next:</strong> ' +
                renderFormattedText(item.nextSteps) +
                '</div>';
            }
            html += '</div>';
            continue;
          }

          if (item.kind === 'question') {
            const answered = item.status === 'answered';
            const cancelled = item.status === 'cancelled';
            const qAccentStyle = !answered && !cancelled && actorColor
              ? 'style="--card-accent:' + esc(actorColor) + '"'
              : '';
            html += '<div class="card question ' + (answered ? 'answered' : cancelled ? 'cancelled' : '') + '" ' + qAccentStyle + '>';
            html +=
              '<div class="card-head"><div class="card-badges">' +
              '<span class="avatar-dot" ' + dotStyle + '>' +
              initial +
              '</span>' +
              '<strong>' +
              agentName +
              '</strong>' +
              rolePillHtml +
              '<span class="badge">Question</span>' +
              '<span class="badge ' +
              (answered ? 'answered' : cancelled ? 'cancelled' : 'pending') +
              '">' +
              (answered ? '✓ Answered' : cancelled ? 'Cancelled' : 'Needs Reply') +
              '</span>' +
              '</div><span class="card-time">' +
              time +
              '</span></div>';
            if (item.context) html += '<div class="card-context">Context: ' + esc(item.context) + '</div>';
            html += '<div class="card-body">' + renderFormattedText(item.question || '') + '</div>';

            if (answered && item.reply) {
              html +=
                '<div class="answered-box"><strong>Your Reply:</strong> ' +
                esc(item.reply.answer || '(No text)') +
                '</div>';
            } else if (cancelled) {
              html += '<div class="card-context">⏹ Cancelled before user reply.</div>';
            } else {
              const draftVal = state.questionDrafts[item.id] || '';
              html += '<div class="reply-box">';
              html +=
                '<textarea class="reply-input" rows="2" data-question-id="' +
                esc(item.id) +
                '" placeholder="Reply to ' +
                agentName +
                '...">' +
                esc(draftVal) +
                '</textarea>';
              html +=
                '<div><button class="btn-primary btn-xs" data-action="submitQuestion" data-id="' +
                esc(item.id) +
                '">Send Reply</button></div>';
              html += '</div>';
            }
            html += '</div>';
            continue;
          }

          if (item.kind === 'poll') {
            const answered = item.status === 'answered';
            const cancelled = item.status === 'cancelled';
            const options = Array.isArray(item.options) ? item.options : [];
            const draft = state.pollDrafts[item.id] || { selected: [], custom: '' };
            const pAccentStyle = !answered && !cancelled && actorColor
              ? 'style="--card-accent:' + esc(actorColor) + '"'
              : '';

            html += '<div class="card poll ' + (answered ? 'answered' : cancelled ? 'cancelled' : '') + '" ' + pAccentStyle + '>';
            html +=
              '<div class="card-head"><div class="card-badges">' +
              '<span class="avatar-dot" ' + dotStyle + '>' +
              initial +
              '</span>' +
              '<strong>' +
              agentName +
              '</strong>' +
              rolePillHtml +
              '<span class="badge">Poll</span>' +
              '<span class="badge ' +
              (answered ? 'answered' : cancelled ? 'cancelled' : 'pending') +
              '">' +
              (answered ? '✓ Voted' : cancelled ? 'Cancelled' : item.allowMultiselect ? 'Multi-Select' : 'Single Choice') +
              '</span>' +
              '</div><span class="card-time">' +
              time +
              '</span></div>';
            if (item.context) html += '<div class="card-context">Context: ' + esc(item.context) + '</div>';
            html += '<div class="card-body">' + renderFormattedText(item.question || '') + '</div>';

            if (answered && item.reply) {
              const picked = Array.isArray(item.reply.selectedOptions)
                ? item.reply.selectedOptions.join(', ')
                : '';
              const ans = item.reply.answer ? ' — ' + item.reply.answer : '';
              html +=
                '<div class="answered-box"><strong>Selected:</strong> ' +
                esc(picked || '(Custom)') +
                esc(ans) +
                '</div>';
            } else if (cancelled) {
              html += '<div class="card-context">⏹ Poll cancelled by user.</div>';
            } else {
              html += '<div class="poll-options">';
              options.forEach((opt, optIdx) => {
                const isSelected = draft.selected.includes(opt);
                const inputType = item.allowMultiselect ? 'checkbox' : 'radio';
                html +=
                  '<label class="poll-opt ' +
                  (isSelected ? 'selected' : '') +
                  '" data-action="togglePollOpt" data-id="' +
                  esc(item.id) +
                  '" data-opt="' +
                  esc(opt) +
                  '" data-multi="' +
                  (item.allowMultiselect ? '1' : '0') +
                  '">' +
                  '<input type="' +
                  inputType +
                  '" name="poll-' +
                  esc(item.id) +
                  '" ' +
                  (isSelected ? 'checked' : '') +
                  ' data-opt-idx="' +
                  optIdx +
                  '" />' +
                  '<span>' +
                  esc(opt) +
                  '</span></label>';
              });
              html += '</div>';

              const showCustom = draft.selected.some((o) =>
                String(o).trim().toLowerCase().startsWith('others (')
              );
              if (showCustom) {
                html +=
                  '<input type="text" class="poll-custom-input" data-poll-custom-id="' +
                  esc(item.id) +
                  '" value="' +
                  esc(draft.custom || '') +
                  '" placeholder="Type your custom answer..." />';
              }

              html +=
                '<div><button class="btn-primary btn-xs" data-action="submitPoll" data-id="' +
                esc(item.id) +
                '">Submit Vote</button></div>';
            }
            html += '</div>';
          }
        }

        const wasNearBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 60;
        feedEl.innerHTML = html;
        if (wasNearBottom) {
          feedEl.scrollTop = feedEl.scrollHeight;
        }
      }

      function closePicker() {
        state.picker = {
          openSlotIdx: null,
          tab: 'agents',
          step: 'agents',
          activeAgentKey: null,
          search: '',
          lastSplitSlotIdx: null,
          lastSplitFromColor: null,
        };
        renderSlots();
        renderPopover();
      }

      function dispatchCurrentPrompt() {
        if (sendBtnEl.disabled) return;
        const promptText = promptEl.value;
        const attachments = Array.isArray(state.draftAttachments) ? state.draftAttachments.slice() : [];
        promptEl.value = '';
        state.draftAttachments = [];
        renderAttachments();
        updateSendState();
        vscode.postMessage({
          type: 'dispatch',
          slots: state.slots,
          prompt: promptText,
          attachments,
        });
      }

      document.addEventListener('input', (e) => {
        if (!e.target) return;
        if (e.target.id === 'pickerSearchInput') {
          state.picker.search = e.target.value;
          renderPopover();
          return;
        }
        if (e.target.id === 'historySearchInput') {
          state.historySearch = e.target.value;
          renderHistory();
          return;
        }
        if (e.target.dataset && e.target.dataset.renameInput) {
          state.renameDraft = e.target.value;
          return;
        }
        if (e.target.id === 'globalPromptInput') {
          state.promptDraftGlobal = e.target.value;
          return;
        }
        if (e.target.id === 'agentPromptInput') {
          const k = state.selectedPromptAgent;
          const prev = state.promptDraftAgents[k] || { mode: 'append', template: '' };
          state.promptDraftAgents[k] = { ...prev, template: e.target.value };
          return;
        }
      });

      document.addEventListener('change', (e) => {
        if (!e.target) return;
        const settingInp = e.target.closest('input[data-setting]');
        if (settingInp) {
          const key = settingInp.dataset.setting;
          const val = Boolean(settingInp.checked);
          state.settings[key] = val;
          vscode.postMessage({ type: 'saveSettings', patch: { [key]: val } });
          return;
        }
        if (e.target.id === 'antigravityModeSelect') {
          const val = e.target.value;
          state.promptDraftAgyMode = val;
          state.settings.antigravityLaunchMode = val;
          vscode.postMessage({ type: 'saveSettings', patch: { antigravityLaunchMode: val } });
          return;
        }
        if (e.target.id === 'agentPromptSelect') {
          state.selectedPromptAgent = e.target.value;
          renderSettings();
          return;
        }
        if (e.target.id === 'agentPromptModeSelect') {
          const k = state.selectedPromptAgent;
          const prev = state.promptDraftAgents[k] || { mode: 'append', template: '' };
          state.promptDraftAgents[k] = { ...prev, mode: e.target.value };
        }
      });

      document.addEventListener('click', (e) => {
        // History Drawer actions (prevent row switch when clicking inline controls)
        const saveRenameBtn = e.target.closest('[data-action="saveRename"]');
        if (saveRenameBtn) {
          e.stopPropagation();
          const folder = saveRenameBtn.dataset.folder;
          const title = (state.renameDraft || '').trim();
          state.renamingFolder = null;
          if (folder && title) {
            vscode.postMessage({ type: 'renameSession', folder, title });
          }
          renderHistory();
          return;
        }
        if (e.target.closest('[data-action="cancelRename"]')) {
          e.stopPropagation();
          state.renamingFolder = null;
          renderHistory();
          return;
        }
        if (e.target.closest('[data-stop-switch]')) {
          e.stopPropagation();
          return;
        }
        const startRenameBtn = e.target.closest('[data-action="startRename"]');
        if (startRenameBtn) {
          e.stopPropagation();
          state.renamingFolder = startRenameBtn.dataset.folder;
          state.renameDraft = startRenameBtn.dataset.title || '';
          state.confirmDeleteFolder = null;
          renderHistory();
          const inp = historyListEl.querySelector('input[data-rename-input]');
          if (inp) inp.focus();
          return;
        }
        const askDelBtn = e.target.closest('[data-action="askDeleteSession"]');
        if (askDelBtn) {
          e.stopPropagation();
          state.confirmDeleteFolder = askDelBtn.dataset.folder;
          state.renamingFolder = null;
          renderHistory();
          return;
        }
        if (e.target.closest('[data-action="cancelDeleteSession"]')) {
          e.stopPropagation();
          state.confirmDeleteFolder = null;
          renderHistory();
          return;
        }
        const confirmDelBtn = e.target.closest('[data-action="confirmDeleteSession"]');
        if (confirmDelBtn) {
          e.stopPropagation();
          const folder = confirmDelBtn.dataset.folder;
          state.confirmDeleteFolder = null;
          vscode.postMessage({ type: 'deleteSession', folder });
          renderHistory();
          return;
        }
        const switchSessCard = e.target.closest('[data-action="switchSession"]');
        if (switchSessCard) {
          const folder = switchSessCard.dataset.folder;
          if (folder) {
            state.historyOpen = false;
            renderHistory();
            vscode.postMessage({ type: 'switchSession', folder });
          }
          return;
        }

        // Settings Prompt Template actions
        const chipBtn = e.target.closest('[data-action="insertPlaceholder"]');
        if (chipBtn) {
          const token = chipBtn.dataset.token || '';
          const globalTa = document.getElementById('globalPromptInput');
          if (globalTa && token) {
            const pos = typeof globalTa.selectionStart === 'number' ? globalTa.selectionStart : globalTa.value.length;
            const end = typeof globalTa.selectionEnd === 'number' ? globalTa.selectionEnd : globalTa.value.length;
            globalTa.value = globalTa.value.slice(0, pos) + token + globalTa.value.slice(end);
            state.promptDraftGlobal = globalTa.value;
            globalTa.focus();
            globalTa.setSelectionRange(pos + token.length, pos + token.length);
          }
          return;
        }
        if (e.target && e.target.id === 'savePromptsBtn') {
          const gEl = document.getElementById('globalPromptInput');
          const aEl = document.getElementById('agentPromptInput');
          const mEl = document.getElementById('agentPromptModeSelect');
          const agyEl = document.getElementById('antigravityModeSelect');
          if (gEl) state.promptDraftGlobal = gEl.value;
          if (aEl && state.selectedPromptAgent) {
            state.promptDraftAgents[state.selectedPromptAgent] = {
              mode: mEl ? mEl.value : 'append',
              template: aEl.value,
            };
          }
          const agyMode = agyEl ? agyEl.value : state.promptDraftAgyMode;
          const globalToSave =
            state.promptDraftGlobal.trim() === String(state.defaultGlobalTemplate || '').trim()
              ? ''
              : state.promptDraftGlobal;
          vscode.postMessage({
            type: 'savePromptTemplates',
            globalPromptTemplate: globalToSave,
            agentPrompts: state.promptDraftAgents,
            antigravityLaunchMode: agyMode,
          });
          e.target.textContent = 'Saved ✓';
          setTimeout(() => {
            if (document.getElementById('savePromptsBtn')) {
              document.getElementById('savePromptsBtn').textContent = 'Save Prompt Settings';
            }
          }, 1500);
          return;
        }
        if (e.target && e.target.id === 'resetAgentPromptBtn') {
          const k = state.selectedPromptAgent;
          const defCfg = (state.defaultAgentPrompts && state.defaultAgentPrompts[k]) || { mode: 'append', template: '' };
          state.promptDraftAgents[k] = { ...defCfg };
          vscode.postMessage({ type: 'resetPromptTemplates', agentKey: k });
          renderSettings();
          return;
        }
        if (e.target && e.target.id === 'resetAllPromptsBtn') {
          state.promptDraftsInitialized = false;
          vscode.postMessage({ type: 'resetPromptTemplates' });
          syncPromptDraftsFromSettings(true);
          renderSettings();
          return;
        }

        if (e.target.closest('[data-action="autoFillTeam"]')) {
          e.stopPropagation();
          applyAutoFillTeam();
          return;
        }
        if (e.target.closest('[data-action="openGuide"]')) {
          state.guideOpen = true;
          state.settingsOpen = false;
          state.historyOpen = false;
          renderGuide();
          renderSettings();
          renderHistory();
          return;
        }
        if (e.target.closest('[data-action="guideOpenAgents"]')) {
          vscode.postMessage({ type: 'openAgentsDoc' });
          return;
        }
        if (e.target.closest('[data-action="initWorkspaceHub"]')) {
          vscode.postMessage({ type: 'initWorkspaceHub' });
          return;
        }
        const starterBtn = e.target.closest('[data-action="useStarterPrompt"]');
        if (starterBtn) {
          const kind = starterBtn.dataset.starter;
          const tpl = STARTER_PROMPTS[kind];
          if (tpl) {
            promptEl.value = tpl;
            updateSendState();
            promptEl.focus();
          }
          return;
        }
        const filterBtn = e.target.closest('[data-action="setFeedFilter"]');
        if (filterBtn) {
          state.feedFilter = filterBtn.dataset.filter || 'all';
          renderFeed();
          return;
        }
        const copyReportBtn = e.target.closest('[data-action="copyReport"]');
        if (copyReportBtn) {
          const id = copyReportBtn.dataset.id;
          const found = (state.feed && Array.isArray(state.feed.items) ? state.feed.items : []).find(
            (x) => x && x.id === id
          );
          if (found) {
            const parts = [
              found.title ? '# ' + found.title : '',
              found.summary || '',
              found.nextSteps ? 'Next Steps:\\n' + found.nextSteps : '',
            ].filter(Boolean);
            vscode.postMessage({
              type: 'copyText',
              text: parts.join('\\n\\n'),
              toast: 'Copied agent report to clipboard.',
            });
          }
          return;
        }
        const promoteBtn = e.target.closest('[data-action="promoteSlotToMain"]');
        if (promoteBtn) {
          e.stopPropagation();
          promoteSlotToMain(Number(promoteBtn.dataset.slot));
          return;
        }

        const switchTabBtn = e.target.closest('[data-action="switchPickerTab"]');
        if (switchTabBtn && state.picker.openSlotIdx !== null) {
          state.picker.tab = switchTabBtn.dataset.tab === 'roles' ? 'roles' : 'agents';
          state.picker.search = '';
          renderPopover();
          return;
        }

        const presetBtn = e.target.closest('[data-action="applyPreset"]');
        if (presetBtn) {
          applyTeamPreset(presetBtn.dataset.preset);
          return;
        }

        const clearRolesBtn = e.target.closest('[data-action="clearSlotRoles"]');
        if (clearRolesBtn && state.picker.openSlotIdx !== null) {
          e.stopPropagation();
          const idx = state.picker.openSlotIdx;
          const slot = state.slots[idx];
          if (slot && slot.agentKey) {
            const emptyProfile = computeSlotProfile({ roleIds: [] }, idx);
            state.slots[idx] = {
              ...slot,
              roleIds: [],
              roleSummary: emptyProfile.roleSummary,
              mixedColor: emptyProfile.mixedColor,
              textColor: emptyProfile.textColor,
              writePermission: emptyProfile.effectiveWritePermission,
              hubEscalation: emptyProfile.effectiveHubEscalation,
            };
            vscode.postMessage({ type: 'updateSlots', slots: state.slots });
            renderSlots();
            renderPopover();
            renderHeader();
          }
          return;
        }

        const toggleRoleBtn = e.target.closest('[data-action="toggleRole"]');
        if (toggleRoleBtn && state.picker.openSlotIdx !== null) {
          e.stopPropagation();
          const roleId = toggleRoleBtn.dataset.role;
          if (!roleId) return;
          if (toggleRoleBtn.classList.contains('disabled')) {
            const titleMsg = toggleRoleBtn.getAttribute('title');
            if (titleMsg) showError(titleMsg);
            return;
          }
          toggleSlotRole(state.picker.openSlotIdx, roleId);
          return;
        }

        const removeBtn = e.target.closest('[data-action="removeSlot"]');
        if (removeBtn) {
          e.stopPropagation();
          const idx = Number(removeBtn.dataset.slot);
          if (idx > 0 && idx < state.slots.length) {
            state.slots.splice(idx, 1);
            if (state.picker.openSlotIdx === idx) state.picker.openSlotIdx = null;
            else if (state.picker.openSlotIdx !== null && state.picker.openSlotIdx > idx) {
              state.picker.openSlotIdx--;
            }
            vscode.postMessage({ type: 'updateSlots', slots: state.slots });
            renderSlots();
            renderPopover();
            renderHeader();
          }
          return;
        }

        const slotToggle = e.target.closest('[data-action="toggleSlot"]');
        if (slotToggle) {
          const idx = Number(slotToggle.dataset.slot);
          if (state.picker.openSlotIdx === idx) {
            closePicker();
            return;
          }
          const existing = state.slots[idx];
          state.picker = {
            openSlotIdx: idx,
            tab: 'agents',
            step: existing && existing.agentKey ? 'models' : 'agents',
            activeAgentKey: existing && existing.agentKey ? existing.agentKey : null,
            search: '',
            lastSplitSlotIdx: null,
            lastSplitFromColor: null,
          };
          renderSlots();
          renderPopover();
          return;
        }

        const addSlotBtn = e.target.closest('[data-action="addSlot"]');
        if (addSlotBtn) {
          const frontIdx = state.slots.length - 1;
          const frontSlot = (frontIdx >= 0 && state.slots[frontIdx] && state.slots[frontIdx].agentKey)
            ? state.slots[frontIdx]
            : [...state.slots].reverse().find((s) => s && s.agentKey) || null;
          const newIdx = state.slots.length;
          let splitSlot = null;
          let fromColor = null;

          if (frontSlot && frontSlot.agentKey) {
            const frontProfile = computeSlotProfile(frontSlot, Math.max(0, state.slots.indexOf(frontSlot)));
            fromColor = frontProfile.mixedColor;
            const ag = state.agents.find((a) => a.key === frontSlot.agentKey);
            const usedModelsForProvider = new Set(
              state.slots
                .filter((s) => s && s.agentKey === frontSlot.agentKey)
                .map((s) => s.modelId)
            );
            const nextModel = ag && Array.isArray(ag.models)
              ? ag.models.find((m) => m.id !== 'auto' && !usedModelsForProvider.has(m.id)) ||
                ag.models.find((m) => m.id !== frontSlot.modelId) ||
                ag.models[0] ||
                { id: 'auto', label: 'Auto' }
              : { id: frontSlot.modelId || 'auto', label: frontSlot.modelLabel || 'Auto' };
            const defProfile = computeSlotProfile({ roleIds: [] }, newIdx);
            splitSlot = {
              agentKey: frontSlot.agentKey,
              modelId: nextModel.id || 'auto',
              modelLabel: nextModel.label || 'Auto',
              vendor: nextModel.vendor || undefined,
              family: nextModel.family || undefined,
              roleIds: defProfile.roleIds,
              roleSummary: defProfile.roleSummary,
              mixedColor: defProfile.mixedColor,
              textColor: defProfile.textColor,
              writePermission: defProfile.effectiveWritePermission,
              hubEscalation: defProfile.effectiveHubEscalation,
            };
          }

          state.slots.push(splitSlot);
          state.picker = {
            openSlotIdx: newIdx,
            tab: 'agents',
            step: splitSlot ? 'models' : 'agents',
            activeAgentKey: splitSlot ? splitSlot.agentKey : null,
            search: '',
            lastSplitSlotIdx: newIdx,
            lastSplitFromColor: fromColor,
          };
          vscode.postMessage({ type: 'updateSlots', slots: state.slots });
          renderSlots();
          renderPopover();
          renderHeader();
          setTimeout(() => {
            if (state.picker.lastSplitSlotIdx === newIdx) {
              state.picker.lastSplitSlotIdx = null;
              state.picker.lastSplitFromColor = null;
              const chip = slotsRowEl.querySelector('[data-slot="' + newIdx + '"]');
              if (chip) chip.classList.remove('splitting-from-prev');
            }
          }, 480);
          return;
        }

        const chooseAgentBtn = e.target.closest('[data-action="chooseAgentStep"]');
        if (chooseAgentBtn && state.picker.openSlotIdx !== null) {
          const key = chooseAgentBtn.dataset.key;
          const ag = state.agents.find((a) => a.key === key);
          if (!ag) return;
          if ((ag.models || []).length <= 1) {
            const m = (ag.models && ag.models[0]) || { id: 'auto', label: 'Auto' };
            assignSlot(state.picker.openSlotIdx, ag.key, m);
          } else {
            state.picker.step = 'models';
            state.picker.activeAgentKey = key;
            state.picker.search = '';
            renderPopover();
          }
          return;
        }

        const backBtn = e.target.closest('[data-action="backToAgents"]');
        if (backBtn) {
          state.picker.step = 'agents';
          state.picker.search = '';
          renderPopover();
          return;
        }

        const clearBtn = e.target.closest('[data-action="clearSlot"]');
        if (clearBtn && state.picker.openSlotIdx !== null) {
          state.slots[state.picker.openSlotIdx] = null;
          vscode.postMessage({ type: 'updateSlots', slots: state.slots });
          closePicker();
          renderHeader();
          return;
        }

        const pickModelBtn = e.target.closest('[data-action="pickModel"]');
        if (pickModelBtn && state.picker.openSlotIdx !== null) {
          assignSlot(state.picker.openSlotIdx, pickModelBtn.dataset.agent, {
            id: pickModelBtn.dataset.modelId,
            label: pickModelBtn.dataset.modelLabel,
            vendor: pickModelBtn.dataset.vendor || undefined,
            family: pickModelBtn.dataset.family || undefined,
          });
          return;
        }

        if (e.target && e.target.id === 'addCustomModelBtn') {
          const agKey = document.getElementById('customAgentSelect')?.value;
          const mId = document.getElementById('customModelIdInput')?.value.trim();
          const mLabel = document.getElementById('customModelLabelInput')?.value.trim();
          if (!agKey || !mId) {
            showError('Enter a Model ID to add a custom model.');
            return;
          }
          vscode.postMessage({
            type: 'addCustomModel',
            model: { agentKey: agKey, id: mId, label: mLabel || mId, group: 'Custom Models' },
          });
          return;
        }

        const rmCustomBtn = e.target.closest('[data-action="removeCustomModel"]');
        if (rmCustomBtn) {
          vscode.postMessage({
            type: 'removeCustomModel',
            agentKey: rmCustomBtn.dataset.agent,
            id: rmCustomBtn.dataset.id,
          });
          return;
        }

        if (e.target.closest('[data-action="settingsOpenInbox"]')) {
          vscode.postMessage({ type: 'openInbox' });
          return;
        }
        if (e.target.closest('[data-action="settingsNewSession"]')) {
          state.settingsOpen = false;
          renderSettings();
          vscode.postMessage({ type: 'newSession' });
          return;
        }
        if (e.target.closest('[data-action="openVsCodeSettings"]')) {
          vscode.postMessage({ type: 'openVsCodeSettings' });
          return;
        }

        const pollLabel = e.target.closest('[data-action="togglePollOpt"]');
        if (pollLabel) {
          e.preventDefault();
          const itemId = pollLabel.dataset.id;
          const opt = pollLabel.dataset.opt;
          const multi = pollLabel.dataset.multi === '1';
          const draft = state.pollDrafts[itemId] || { selected: [], custom: '' };
          if (multi) {
            draft.selected = draft.selected.includes(opt)
              ? draft.selected.filter((x) => x !== opt)
              : [...draft.selected, opt];
          } else {
            draft.selected = [opt];
          }
          state.pollDrafts[itemId] = draft;
          renderFeed();
          return;
        }

        const submitQ = e.target.closest('[data-action="submitQuestion"]');
        if (submitQ) {
          const id = submitQ.dataset.id;
          const ta = feedEl.querySelector('textarea[data-question-id="' + id + '"]');
          const ans = ta ? ta.value.trim() : '';
          if (!ans) {
            showError('Please enter an answer before sending.');
            return;
          }
          delete state.questionDrafts[id];
          vscode.postMessage({ type: 'replyQuestion', itemId: id, answer: ans });
          return;
        }

        const submitP = e.target.closest('[data-action="submitPoll"]');
        if (submitP) {
          const id = submitP.dataset.id;
          const draft = state.pollDrafts[id] || { selected: [], custom: '' };
          const customInput = feedEl.querySelector('input[data-poll-custom-id="' + id + '"]');
          const customVal = customInput ? customInput.value.trim() : draft.custom || '';
          vscode.postMessage({
            type: 'replyPoll',
            itemId: id,
            selectedOptions: draft.selected,
            answer: customVal,
          });
          delete state.pollDrafts[id];
          return;
        }

        if (e.target.closest('[data-action="removeAttachment"]')) {
          const rmBtn = e.target.closest('[data-action="removeAttachment"]');
          const idx = Number(rmBtn && rmBtn.dataset ? rmBtn.dataset.idx : -1);
          if (!Number.isNaN(idx) && idx >= 0 && idx < state.draftAttachments.length) {
            state.draftAttachments.splice(idx, 1);
            renderAttachments();
          }
          return;
        }

        const openFileBtn = e.target.closest('[data-action="openFile"]');
        if (openFileBtn) {
          vscode.postMessage({ type: 'openFile', filePath: openFileBtn.dataset.file });
          return;
        }

        const copyBtn = e.target.closest('[data-action="copyKickoff"]');
        if (copyBtn) {
          vscode.postMessage({ type: 'copyKickoff', promptText: copyBtn.dataset.prompt });
          return;
        }

        if (state.picker.openSlotIdx !== null && !e.target.closest('#composerArea')) {
          closePicker();
        }
      });

      function assignSlot(slotIdx, agentKey, model) {
        const prevSlot = state.slots[slotIdx] || null;
        const profile = computeSlotProfile(prevSlot, slotIdx);
        state.slots[slotIdx] = {
          agentKey,
          modelId: model.id || 'auto',
          modelLabel: model.label || model.id || 'Auto',
          vendor: model.vendor || undefined,
          family: model.family || undefined,
          roleIds: profile.roleIds,
          roleSummary: profile.roleSummary,
          mixedColor: profile.mixedColor,
          textColor: profile.textColor,
          writePermission: profile.effectiveWritePermission,
          hubEscalation: profile.effectiveHubEscalation,
        };
        vscode.postMessage({ type: 'updateSlots', slots: state.slots });
        closePicker();
        renderHeader();
      }

      historyBtnEl.addEventListener('click', () => {
        state.historyOpen = !state.historyOpen;
        if (state.historyOpen) {
          state.settingsOpen = false;
          state.guideOpen = false;
        }
        renderHistory();
        renderSettings();
        renderGuide();
      });
      closeHistoryBtnEl.addEventListener('click', () => {
        state.historyOpen = false;
        renderHistory();
      });
      historyNewBtnEl.addEventListener('click', () => {
        state.historyOpen = false;
        state.guideOpen = false;
        renderHistory();
        renderGuide();
        vscode.postMessage({ type: 'newSession' });
      });

      guideBtnEl.addEventListener('click', () => {
        state.guideOpen = !state.guideOpen;
        if (state.guideOpen) {
          state.historyOpen = false;
          state.settingsOpen = false;
        }
        renderGuide();
        renderHistory();
        renderSettings();
      });
      closeGuideBtnEl.addEventListener('click', () => {
        state.guideOpen = false;
        renderGuide();
      });

      settingsBtnEl.addEventListener('click', () => {
        state.settingsOpen = !state.settingsOpen;
        if (state.settingsOpen) {
          state.historyOpen = false;
          state.guideOpen = false;
        }
        renderHistory();
        renderSettings();
        renderGuide();
      });
      closeSettingsBtnEl.addEventListener('click', () => {
        state.settingsOpen = false;
        renderSettings();
      });
      rescanBtnEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'refreshAgents' });
      });
      newSessionBtnEl.addEventListener('click', () => {
        state.historyOpen = false;
        state.guideOpen = false;
        renderHistory();
        renderGuide();
        vscode.postMessage({ type: 'newSession' });
      });
      stopSessionTopBtnEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancelSession' });
      });
      stopSessionBtnEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancelSession' });
      });
      openInboxChipEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'openInbox' });
      });
      openTasksChipEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'openTasks' });
      });
      openCommsChipEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'openComms' });
      });
      attachFileChipEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'pickAttachments', folder: false });
      });
      attachFolderChipEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'pickAttachments', folder: true });
      });

      promptEl.addEventListener('input', updateSendState);
      promptEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          dispatchCurrentPrompt();
        }
      });
      sendBtnEl.addEventListener('click', dispatchCurrentPrompt);

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === 'agents') {
          state.agents = Array.isArray(msg.agents) ? msg.agents : [];
          if (Array.isArray(msg.roleCategories)) {
            state.roleCategories = msg.roleCategories;
          }
          if (msg.roleRegistry && typeof msg.roleRegistry === 'object') {
            state.roleRegistry = msg.roleRegistry;
          }
          if (Array.isArray(msg.teamPresets) || (msg.teamPresets && typeof msg.teamPresets === 'object')) {
            state.teamPresets = msg.teamPresets;
          }
          if (msg.defaultGlobalTemplate) {
            state.defaultGlobalTemplate = msg.defaultGlobalTemplate;
          }
          if (msg.defaultAgentPrompts) {
            state.defaultAgentPrompts = msg.defaultAgentPrompts;
          }
          if (Array.isArray(msg.slots) && msg.slots.length > 0) {
            state.slots = msg.slots;
          }
          if (msg.settings) {
            state.settings = msg.settings;
            if (!state.promptDraftsInitialized) {
              syncPromptDraftsFromSettings(true);
            }
          }
          renderSlots();
          renderPopover();
          renderSettings();
          renderHeader();
          renderFeed();
        } else if (msg.type === 'settings') {
          if (msg.settings) {
            state.settings = msg.settings;
            syncPromptDraftsFromSettings(true);
          }
          renderSettings();
        } else if (msg.type === 'state') {
          if (msg.feed) state.feed = msg.feed;
          if (msg.presence) state.presence = msg.presence;
          if (msg.peers) state.peers = msg.peers;
          if (msg.tasksSummary) state.tasksSummary = msg.tasksSummary;
          if (Array.isArray(msg.sessions)) state.sessions = msg.sessions;
          if (msg.settings) state.settings = msg.settings;
          if (Array.isArray(msg.slots) && msg.slots.length > 0 && !state.slots.some(Boolean)) {
            state.slots = msg.slots;
            renderSlots();
          }
          renderHeader();
          renderFeed();
          if (state.historyOpen) renderHistory();
        } else if (msg.type === 'sessionSwitched') {
          if (Array.isArray(msg.slots) && msg.slots.length > 0) {
            state.slots = msg.slots;
            renderSlots();
          }
          state.draftAttachments = [];
          renderAttachments();
          state.historyOpen = false;
          state.guideOpen = false;
          renderHistory();
          renderGuide();
          renderHeader();
        } else if (msg.type === 'attachmentsPicked') {
          const incoming = Array.isArray(msg.attachments) ? msg.attachments : [];
          const byPath = new Set((state.draftAttachments || []).map((a) => a && a.path).filter(Boolean));
          for (const att of incoming) {
            if (!att || !att.path || byPath.has(att.path)) continue;
            byPath.add(att.path);
            state.draftAttachments.push(att);
          }
          renderAttachments();
        } else if (msg.type === 'sessionCancelled') {
          state.dispatching = false;
          updateSendState();
          renderHeader();
        } else if (msg.type === 'toggleSettings') {
          state.settingsOpen = msg.open !== undefined ? Boolean(msg.open) : !state.settingsOpen;
          if (state.settingsOpen) {
            state.historyOpen = false;
            state.guideOpen = false;
          }
          renderHistory();
          renderSettings();
          renderGuide();
        } else if (msg.type === 'toggleHistory') {
          state.historyOpen = msg.open !== undefined ? Boolean(msg.open) : !state.historyOpen;
          if (state.historyOpen) {
            state.settingsOpen = false;
            state.guideOpen = false;
          }
          renderHistory();
          renderSettings();
          renderGuide();
        } else if (msg.type === 'toggleGuide') {
          state.guideOpen = msg.open !== undefined ? Boolean(msg.open) : !state.guideOpen;
          if (state.guideOpen) {
            state.historyOpen = false;
            state.settingsOpen = false;
          }
          renderGuide();
          renderHistory();
          renderSettings();
        } else if (msg.type === 'dispatching') {
          state.dispatching = Boolean(msg.active);
          updateSendState();
          renderHeader();
        } else if (msg.type === 'error') {
          showError(msg.message);
        }
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
  }
}

function activate(context) {
  const provider = new VibeCodingViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('aivengers.focus', () => {
      vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    }),
    vscode.commands.registerCommand('aivengers.refreshAgents', () => provider.refreshAgents()),
    vscode.commands.registerCommand('aivengers.newSession', () => provider.newSession()),
    vscode.commands.registerCommand('aivengers.openInbox', () => provider.openInboxFile()),
    vscode.commands.registerCommand('aivengers.openSettings', () => provider.openSettingsPanel()),
    vscode.commands.registerCommand('aivengers.openGuide', () => provider.openGuidePanel()),
    vscode.commands.registerCommand('aivengers.initWorkspaceHub', () => provider.initWorkspaceHub()),
    vscode.commands.registerCommand('aivengers.cancelSession', () => provider.cancelOngoingSession('Stopped via command')),
    vscode.commands.registerCommand('aivengers.openHistory', () => provider.openHistoryPanel()),
    vscode.extensions.onDidChange(() => provider.refreshAgents()),
    vscode.lm && typeof vscode.lm.onDidChangeChatModels === 'function'
      ? vscode.lm.onDidChangeChatModels(() => provider.refreshAgents())
      : { dispose() {} },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aivengers') || e.affectsConfiguration('vibeCoding')) {
        provider.refreshAgents();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      provider.refreshAgents();
      provider.setupWatchers();
      provider.refreshState(true);
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  discoverInstalledAgents,
  resolveHubDir,
  getTasksSummary,
  buildKickoffPrompt,
  launchSingleAgent,
  toVscodeFileUri,
  detectCopilotUserPlan,
  queryLiveVsCodeModels,
  VibeCodingViewProvider,
  DEFAULT_GLOBAL_PROMPT_TEMPLATE,
  DEFAULT_AGENT_PROMPTS,
};
