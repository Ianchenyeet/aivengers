#!/usr/bin/env node

/**
 * vibe-commit — AI/Heuristic Git Commit Generator with Multi-Agent Attribution
 * Part of Vibe Coding Tools Suite.
 * Analyzes staged git changes, infers conventional commit type and scope,
 * generates structured summaries, and attaches Co-authored-by trailers.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LOG_PATH = path.join(ROOT_DIR, 'ACTIVITY_LOG.md');

const KNOWN_AGENTS = {
  copilot: 'GitHub Copilot <copilot@users.noreply.github.com>',
  'github copilot': 'GitHub Copilot <copilot@users.noreply.github.com>',
  antigravity: 'Antigravity <antigravity@google.com>',
  claude: 'Claude <claude@anthropic.com>',
  cursor: 'Cursor <cursor@anysphere.co>'
};

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
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      flags[key] = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function getCoAuthorTrailer(agentName) {
  if (!agentName) return null;
  const key = agentName.replace(/^@/, '').toLowerCase();
  if (KNOWN_AGENTS[key]) {
    return `Co-authored-by: ${KNOWN_AGENTS[key]}`;
  }
  if (agentName.includes('<') && agentName.includes('>')) {
    return `Co-authored-by: ${agentName.replace(/^@/, '')}`;
  }
  return `Co-authored-by: ${agentName.replace(/^@/, '')} <${key}@users.noreply.github.com>`;
}

function analyzeChanges(files) {
  if (files.length === 0) return { type: 'chore', scope: 'repo', summary: 'update workspace files' };

  let isOnlyDocs = files.every(f => f.file.endsWith('.md') || f.file.startsWith('docs/'));
  let isOnlyTests = files.every(f => f.file.includes('test') || f.file.includes('spec'));
  let isConfig = files.every(f => f.file.endsWith('.json') || f.file.startsWith('.') || f.file.endsWith('.config.js'));

  let type = 'feat';
  if (isOnlyDocs) type = 'docs';
  else if (isOnlyTests) type = 'test';
  else if (isConfig) type = 'chore';
  else if (files.every(f => f.status === 'M')) type = 'refactor';

  // Determine scope from common directory or primary file
  let dirs = files.map(f => {
    const parts = f.file.split(/[/\\]/);
    return parts.length > 1 ? parts[0] : 'root';
  });
  let scope = dirs[0] === 'root' ? 'workspace' : dirs[0];

  const additions = files.filter(f => f.status === 'A').map(f => path.basename(f.file));
  const modifications = files.filter(f => f.status === 'M').map(f => path.basename(f.file));
  const deletions = files.filter(f => f.status === 'D').map(f => path.basename(f.file));

  let summary = '';
  if (additions.length > 0 && modifications.length === 0) {
    summary = `add ${additions.slice(0, 3).join(', ')}${additions.length > 3 ? ' and more' : ''}`;
  } else if (modifications.length > 0 && additions.length === 0) {
    summary = `update ${modifications.slice(0, 3).join(', ')}${modifications.length > 3 ? ' and more' : ''}`;
  } else {
    summary = `implement updates across ${files.length} file(s)`;
  }

  return { type, scope, summary, additions, modifications, deletions };
}

function showHelp() {
  console.log(`
🚀 vibe-commit — Multi-Agent Conventional Commit Assistant

Usage:
  node src/vibe-commit.js [options]

Options:
  -a, --all               Automatically stage all tracked and untracked changes
  --type <type>           Override commit type (feat, fix, docs, refactor, test, chore)
  --scope <scope>         Override commit scope (e.g. hub, cli, docs)
  --msg <summary>         Provide custom commit summary message
  --agent <name>          Attach Co-authored-by trailer for peer agent (e.g. Copilot, Antigravity)
  --dry-run               Preview generated commit message without committing
  --help                  Show this help screen

Examples:
  node src/vibe-commit.js -a --dry-run
  node src/vibe-commit.js -a --agent Copilot
  node src/vibe-commit.js --type feat --scope cli --agent Antigravity
`);
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    return;
  }

  // 1. Stage changes if -a or --all
  if (flags.a || flags.all) {
    console.log('📦 Staging all workspace changes (git add -A)...');
    runGit('git add -A');
  }

  // 2. Inspect staged files
  const nameStatusOutput = runGit('git diff --cached --name-status');
  if (!nameStatusOutput) {
    console.log('⚠️ No staged changes found.');
    console.log('   Stage changes with `git add <files>` or pass `-a` to stage all changes.');
    return;
  }

  const files = nameStatusOutput.split('\n').filter(Boolean).map(line => {
    const [status, ...filePathParts] = line.split(/\s+/);
    return { status, file: filePathParts.join(' ') };
  });

  const analysis = analyzeChanges(files);
  const commitType = flags.type || analysis.type;
  const commitScope = flags.scope || analysis.scope;
  const commitSummary = flags.msg || analysis.summary;

  const header = `${commitType}(${commitScope}): ${commitSummary}`;

  // Build body details
  const bodyBullets = [];
  files.slice(0, 8).forEach(f => {
    const symbol = f.status === 'A' ? '• add' : f.status === 'M' ? '• update' : '• remove';
    bodyBullets.push(`${symbol} \`${f.file}\``);
  });
  if (files.length > 8) {
    bodyBullets.push(`• and ${files.length - 8} more file(s)`);
  }

  // Co-authors
  const coAuthors = [];
  if (flags.agent) {
    const trailer = getCoAuthorTrailer(flags.agent);
    if (trailer) coAuthors.push(trailer);
  }
  if (flags.coauthor) {
    const trailer = getCoAuthorTrailer(flags.coauthor);
    if (trailer) coAuthors.push(trailer);
  }

  let fullCommitMessage = `${header}\n\n${bodyBullets.join('\n')}`;
  if (coAuthors.length > 0) {
    fullCommitMessage += `\n\n${coAuthors.join('\n')}`;
  }

  console.log('='.repeat(60));
  console.log('📝 GENERATED COMMIT MESSAGE:');
  console.log('='.repeat(60));
  console.log(fullCommitMessage);
  console.log('='.repeat(60));

  if (flags['dry-run']) {
    console.log('🔍 [DRY RUN] Commit was not executed.');
    return;
  }

  // Execute git commit
  try {
    const tempFile = path.join(ROOT_DIR, '.git', 'COMMIT_MSG_TEMP.txt');
    fs.writeFileSync(tempFile, fullCommitMessage, 'utf8');
    execSync(`git commit -F "${tempFile}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    console.log('🎉 Successfully committed changes!');
  } catch (err) {
    console.error('❌ Failed to commit:', err.message);
    process.exit(1);
  }
}

main();
