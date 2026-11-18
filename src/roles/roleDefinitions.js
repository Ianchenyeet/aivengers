'use strict';

/**
 * Multi-role registry, symmetrical mutual exclusion matrix, Gossett & Chen subtractive
 * RYB paint-color mixing, three-tier Markdown file-access resolution, and prompt composition.
 */

const ROLE_CATEGORIES = [
  { id: 'leadership', label: 'Leadership & Orchestration', mainSlotOnly: true },
  { id: 'engineering', label: 'Engineering & Implementation', mainSlotOnly: false },
  { id: 'quality_security', label: 'Quality, Testing & Security', mainSlotOnly: false },
  { id: 'design_media', label: 'Design, Visuals & Interactive Media', mainSlotOnly: false },
  { id: 'context_data', label: 'Context, Research & Data', mainSlotOnly: false },
  { id: 'docs_tooling', label: 'Documentation & Tooling', mainSlotOnly: false },
];

const RAW_ROLE_DEFINITIONS = [
  // Category 1: Leadership & Orchestration (mainSlotOnly: true)
  {
    id: 'hybrid_lead',
    name: 'Hybrid Lead',
    category: 'leadership',
    categoryLabel: 'Leadership & Orchestration',
    color: '#D97706',
    mainSlotOnly: true,
    shortDescription: 'Writes core implementation code while coordinating teammates and compiling the final report.',
    writePermission: 'code-write',
    hubEscalation: 'direct-user-access',
    modelPairingHint: 'Strong reasoning + coding model',
    mdHandoffArtifact: 'Owns the master task checklist in TASKS.md, assigns subtasks to online agents, logs progress, and delivers final_summary.',
    incompatibleWith: ['pure_manager', 'sync_monitor'],
    systemPromptDirective:
      'Act as Hybrid Lead: own the master task checklist in TASKS.md, verify online teammates before delegating, write core implementation code cleanly, and compile the final_summary report + [SIGN-OFF].',
  },
  {
    id: 'pure_manager',
    name: 'Pure Manager',
    category: 'leadership',
    categoryLabel: 'Leadership & Orchestration',
    color: '#7C3AED',
    mainSlotOnly: true,
    shortDescription: 'Strictly non-coding engineering manager: decomposes specs into MD tickets, tracks online agents, and synthesizes final delivery.',
    writePermission: 'plan-doc-only',
    hubEscalation: 'direct-user-access',
    modelPairingHint: 'High-context planning / orchestrator model',
    mdHandoffArtifact: 'Owns the master task board in TASKS.md, ticket assignments, dependency order, and final user summary.',
    incompatibleWith: [
      'hybrid_lead',
      'sync_monitor',
      'general_coder',
      'code_writer',
      'debugger',
      'integrator',
      'qa_engineer',
      'perf_optimizer',
      'general_designer',
      'ui_ux_designer',
      'designer_2d',
      'designer_3d',
      'audio_designer',
      'devops_engineer',
    ],
    systemPromptDirective:
      'Act as Pure Manager: you are STRICTLY FORBIDDEN from writing or editing implementation source code. Decompose user goals into Markdown tickets in TASKS.md, check agent online/presence status, coordinate handoffs, unblock teammates, and synthesize final reports.',
  },
  {
    id: 'product_specifier',
    name: 'Product Specifier',
    category: 'leadership',
    categoryLabel: 'Leadership & Orchestration',
    color: '#DB2777',
    mainSlotOnly: true,
    shortDescription: 'Translates user prompts into concrete requirements, edge cases, and acceptance criteria before coding begins.',
    writePermission: 'plan-doc-only',
    hubEscalation: 'direct-user-access',
    modelPairingHint: 'Product-thinking / clarifying model',
    mdHandoffArtifact: 'Writes structured `Requirements & Acceptance Criteria` blocks in the coordination .md files.',
    incompatibleWith: ['sync_monitor', 'code_writer', 'general_coder'],
    systemPromptDirective:
      'Act as Product Specifier: convert ambiguous goals into explicit Requirements & Acceptance Criteria sections in shared .md files before implementation starts, and clarify scope gaps with the user via Hub ask/poll.',
  },
  {
    id: 'sync_monitor',
    name: 'Sync & Blocker Monitor',
    category: 'leadership',
    categoryLabel: 'Leadership & Orchestration',
    color: '#0891B2',
    mainSlotOnly: true,
    shortDescription: 'Impartial MD board monitor that scans agent presence and logs to catch stalls, loops, and overlapping locks.',
    writePermission: 'comms-md-only',
    hubEscalation: 'direct-user-access',
    modelPairingHint: 'Fast, low-latency monitoring model',
    mdHandoffArtifact: 'Appends `Status Digest & Conflict Alerts` blocks to AGENT_COMMUNICATION.md without altering source code or ticket ownership.',
    incompatibleWith: [
      'hybrid_lead',
      'pure_manager',
      'product_specifier',
      'general_coder',
      'code_writer',
      'debugger',
      'integrator',
      'qa_engineer',
      'perf_optimizer',
      'general_designer',
      'ui_ux_designer',
      'designer_2d',
      'designer_3d',
      'audio_designer',
      'devops_engineer',
    ],
    systemPromptDirective:
      'Act as Sync & Blocker Monitor: run online/health checks, scan shared .md logs for stalled agents, circular revisions, or conflicting file claims, and append compact `Status Digest & Conflict Alerts` blocks (never edit source code).',
  },

  // Category 2: Engineering & Implementation (mainSlotOnly: false)
  {
    id: 'general_coder',
    name: 'General Coder',
    category: 'engineering',
    categoryLabel: 'Engineering & Implementation',
    color: '#2563EB',
    mainSlotOnly: false,
    shortDescription: 'Full-stack generalist for self-contained features, bug fixes, and general implementation.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Balanced coding model',
    mdHandoffArtifact: 'Claims tasks in TASKS.md and posts `Implementation Summary & Changed Files` notes in AGENT_COMMUNICATION.md.',
    incompatibleWith: [
      'pure_manager',
      'sync_monitor',
      'code_reviewer',
      'security_auditor',
      'code_architect',
      'product_specifier',
      'code_writer',
      'codebase_explorer',
    ],
    systemPromptDirective:
      'Act as General Coder: claim your tasks and file locks cleanly in TASKS.md, implement requested features and fixes end-to-end, and post `Implementation Summary & Changed Files` upon completion.',
  },
  {
    id: 'code_architect',
    name: 'Code Planner / Architect',
    category: 'engineering',
    categoryLabel: 'Engineering & Implementation',
    color: '#4F46E5',
    mainSlotOnly: false,
    shortDescription: 'Designs file trees, module contracts, and data flow in Markdown blueprints prior to coding.',
    writePermission: 'plan-doc-only',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'Deep architectural reasoning model',
    mdHandoffArtifact: 'Writes `Architecture Blueprint` sections (file tree, interfaces, data flow) in coordination/spec .md files.',
    incompatibleWith: ['code_writer', 'general_coder'],
    systemPromptDirective:
      'Act as Code Planner / Architect: define clear interfaces, boundaries, and data flows in `Architecture Blueprint` Markdown sections before production code is written; do not write implementation source code unless paired with another code-write role.',
  },
  {
    id: 'code_writer',
    name: 'Code Writer / Implementer',
    category: 'engineering',
    categoryLabel: 'Engineering & Implementation',
    color: '#0284C7',
    mainSlotOnly: false,
    shortDescription: 'Focused feature/module implementer executing assigned Markdown specs fast and cleanly.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Fast, accurate code-generation model',
    mdHandoffArtifact: 'Updates assigned ticket status (`IN_PROGRESS` -> `READY_FOR_REVIEW`) with file diff notes in .md.',
    incompatibleWith: [
      'pure_manager',
      'sync_monitor',
      'code_reviewer',
      'security_auditor',
      'qa_engineer',
      'code_architect',
      'product_specifier',
      'general_coder',
      'codebase_explorer',
      'api_researcher',
      'perf_optimizer',
    ],
    systemPromptDirective:
      'Act as Code Writer / Implementer: follow approved Architecture Blueprints and ticket contracts strictly, claim locks before modifying code, and transition ticket status to `READY_FOR_REVIEW` with diff notes.',
  },
  {
    id: 'code_reviewer',
    name: 'Code Checker / Reviewer',
    category: 'engineering',
    categoryLabel: 'Engineering & Implementation',
    color: '#E11D48',
    mainSlotOnly: false,
    shortDescription: 'Independent reviewer checking code diffs against specs, edge cases, and team quality bars.',
    writePermission: 'comms-md-only',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'Strong analytical review model',
    mdHandoffArtifact: 'Writes `Code Audit & Revision Checklist` blocks in AGENT_COMMUNICATION.md.',
    incompatibleWith: ['code_writer', 'general_coder'],
    systemPromptDirective:
      'Act as Code Checker / Reviewer: audit diffs and files produced by teammates against specifications and architecture contracts, and log actionable `Code Audit & Revision Checklist` findings in coordination .md files without editing source code.',
  },
  {
    id: 'debugger',
    name: 'Debugger / Root-Cause Analyst',
    category: 'engineering',
    categoryLabel: 'Engineering & Implementation',
    color: '#EA580C',
    mainSlotOnly: false,
    shortDescription: 'Isolates failures, reads stack traces, reproduces bugs, and applies targeted fixes.',
    writePermission: 'code-write',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'Deep diagnostic / reasoning model',
    mdHandoffArtifact: 'Writes `Root-Cause Analysis & Patch Log` blocks in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor'],
    systemPromptDirective:
      'Act as Debugger / Root-Cause Analyst: reproduce errors cleanly, trace failing execution paths to root cause before patching, document findings in `Root-Cause Analysis & Patch Log`, and verify fixes.',
  },
  {
    id: 'integrator',
    name: 'Integrator / Merge Resolver',
    category: 'engineering',
    categoryLabel: 'Engineering & Implementation',
    color: '#0D9488',
    mainSlotOnly: false,
    shortDescription: 'Connects parallel modules, aligns imports/types, and resolves integration mismatches.',
    writePermission: 'code-write',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'High-context multi-file model',
    mdHandoffArtifact: 'Logs `Integration & Wiring Status` updates in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'codebase_explorer'],
    systemPromptDirective:
      'Act as Integrator / Merge Resolver: reconcile interfaces across modules built by teammates, fix cross-file import/type mismatches, verify end-to-end wiring, and post `Integration & Wiring Status` updates.',
  },

  // Category 3: Quality, Testing & Security (mainSlotOnly: false)
  {
    id: 'qa_engineer',
    name: 'QA / Test Engineer',
    category: 'quality_security',
    categoryLabel: 'Quality, Testing & Security',
    color: '#16A34A',
    mainSlotOnly: false,
    shortDescription: 'Authors unit/integration tests and mocks from acceptance criteria and logs verification runs.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Detail-oriented test / coding model',
    mdHandoffArtifact: 'Writes `Test Plan & Verification Results` blocks in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'code_writer'],
    systemPromptDirective:
      'Act as QA / Test Engineer: build rigorous automated tests covering acceptance criteria and boundary cases, execute real test commands, and record exact pass/fail evidence in `Test Plan & Verification Results`.',
  },
  {
    id: 'security_auditor',
    name: 'Security & Edge-Case Auditor',
    category: 'quality_security',
    categoryLabel: 'Quality, Testing & Security',
    color: '#991B1B',
    mainSlotOnly: false,
    shortDescription: 'Audits for injection, auth, secret exposure, race conditions, and crash paths without mutating source code.',
    writePermission: 'comms-md-only',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'Security-focused analytical model',
    mdHandoffArtifact: 'Writes `Security & Hardening Findings` blocks in coordination .md files.',
    incompatibleWith: ['code_writer', 'general_coder'],
    systemPromptDirective:
      'Act as Security & Edge-Case Auditor: inspect code paths for security flaws, unsafe input handling, leaked secrets, and race/null edge cases; document exact line-level remediation steps in `Security & Hardening Findings` without directly modifying source files.',
  },
  {
    id: 'perf_optimizer',
    name: 'Performance Optimizer',
    category: 'quality_security',
    categoryLabel: 'Quality, Testing & Security',
    color: '#CA8A04',
    mainSlotOnly: false,
    shortDescription: 'Profiles hot paths, memory leaks, redundant renders, and slow I/O while preserving behavior.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Performance & systems-tuning model',
    mdHandoffArtifact: 'Writes `Performance Benchmark & Refactor Log` blocks in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'code_writer'],
    systemPromptDirective:
      'Act as Performance Optimizer: measure before optimizing, eliminate hot-loop bottlenecks, memory leaks, and redundant renders/I/O while keeping exact behavior, and document results in `Performance Benchmark & Refactor Log`.',
  },

  // Category 4: Design, Visuals & Interactive Media (mainSlotOnly: false)
  {
    id: 'general_designer',
    name: 'General Designer',
    category: 'design_media',
    categoryLabel: 'Design, Visuals & Interactive Media',
    color: '#EC4899',
    mainSlotOnly: false,
    shortDescription: 'Owns holistic visual direction, aesthetic polish, layout harmony, and cohesive UX.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Multimodal / UI-strong model',
    mdHandoffArtifact: 'Writes `Visual Direction & UX Notes` in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'ui_ux_designer', 'designer_2d', 'designer_3d'],
    systemPromptDirective:
      'Act as General Designer: ensure visual hierarchy, color harmony, spacing, typography, and cohesive interaction polish across the entire experience, logging decisions in `Visual Direction & UX Notes`.',
  },
  {
    id: 'ui_ux_designer',
    name: 'UI / UX Designer',
    category: 'design_media',
    categoryLabel: 'Design, Visuals & Interactive Media',
    color: '#F43F5E',
    mainSlotOnly: false,
    shortDescription: 'Builds responsive component layouts, CSS/Tailwind styling, interactive states, and accessibility.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Frontend / CSS design model',
    mdHandoffArtifact: 'Logs component states, layout specs, and accessibility notes in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'general_designer'],
    systemPromptDirective:
      'Act as UI / UX Designer: craft responsive layouts, clear interactive states (hover/focus/loading/empty/error), keyboard/ARIA accessibility, and log UX specs in coordination .md files.',
  },
  {
    id: 'designer_2d',
    name: '2D Designer / Technical Artist',
    category: 'design_media',
    categoryLabel: 'Design, Visuals & Interactive Media',
    color: '#F59E0B',
    mainSlotOnly: false,
    shortDescription: 'Crafts SVGs, CSS keyframes, Canvas 2D rendering, sprite configs, and 2D effects.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Creative coding / SVG & Canvas model',
    mdHandoffArtifact: 'Documents SVG/Canvas asset specs and animation hooks in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'general_designer'],
    systemPromptDirective:
      'Act as 2D Designer / Technical Artist: produce crisp vector SVGs, smooth animations, Canvas 2D draw routines, and visual particle/effect parameters, documenting animation hooks in shared .md files.',
  },
  {
    id: 'designer_3d',
    name: '3D Designer / Spatial Developer',
    category: 'design_media',
    categoryLabel: 'Design, Visuals & Interactive Media',
    color: '#8B5CF6',
    mainSlotOnly: false,
    shortDescription: 'Creates Three.js/WebGL scenes, procedural geometry, shaders/materials, cameras, and lighting.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: '3D graphics / shader coding model',
    mdHandoffArtifact: 'Documents scene hierarchy, camera/lighting configs, and shader parameters in .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'general_designer'],
    systemPromptDirective:
      'Act as 3D Designer / Spatial Developer: implement clean WebGL/Three.js scene graphs, shaders/materials, camera rigs, and frame-rate-conscious lighting while documenting parameters in coordination .md files.',
  },
  {
    id: 'audio_designer',
    name: 'Procedural Audio Designer',
    category: 'design_media',
    categoryLabel: 'Design, Visuals & Interactive Media',
    color: '#06B6D4',
    mainSlotOnly: false,
    shortDescription: 'Implements Web Audio API synthesizers, procedural sound effects, and dynamic audio cues.',
    writePermission: 'code-write',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Web Audio / interactive DSP model',
    mdHandoffArtifact: 'Documents sound-event triggers and synth presets in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor'],
    systemPromptDirective:
      'Act as Procedural Audio Designer: build clean zero-asset Web Audio API synthesizers and responsive event sound cues with volume/mute safety, documenting sound trigger IDs in coordination .md files.',
  },

  // Category 5: Context, Research & Data (mainSlotOnly: false)
  {
    id: 'codebase_explorer',
    name: 'Codebase Explorer / Librarian',
    category: 'context_data',
    categoryLabel: 'Context, Research & Data',
    color: '#10B981',
    mainSlotOnly: false,
    shortDescription: 'Read-only repository scout mapping files, symbols, and call sites into compact MD briefs.',
    writePermission: 'comms-md-only',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Large-context / fast search model',
    mdHandoffArtifact: 'Writes compact `Codebase Map & Context Brief` sections in coordination .md files.',
    incompatibleWith: ['code_writer', 'general_coder', 'integrator', 'devops_engineer'],
    systemPromptDirective:
      'Act as Codebase Explorer / Librarian: trace file paths, exports, dependencies, and call sites across the codebase and write compact `Codebase Map & Context Brief` notes into shared .md files without modifying source code.',
  },
  {
    id: 'api_researcher',
    name: 'API & Library Researcher',
    category: 'context_data',
    categoryLabel: 'Context, Research & Data',
    color: '#3B82F6',
    mainSlotOnly: false,
    shortDescription: 'Verifies installed SDK versions, API signatures, and framework caveats into MD reference notes.',
    writePermission: 'comms-md-only',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'High-accuracy docs / research model',
    mdHandoffArtifact: 'Writes `API & Dependency Reference` notes in coordination .md files.',
    incompatibleWith: ['code_writer'],
    systemPromptDirective:
      'Act as API & Library Researcher: inspect installed package manifests, type definitions, and official APIs to supply accurate `API & Dependency Reference` notes in shared .md files without modifying source code.',
  },
  {
    id: 'data_architect',
    name: 'Data & Schema Architect',
    category: 'context_data',
    categoryLabel: 'Context, Research & Data',
    color: '#6366F1',
    mainSlotOnly: false,
    shortDescription: 'Defines persistence schemas, JSON contracts, state stores, and validation rules in Markdown.',
    writePermission: 'plan-doc-only',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'Systems / schema modeling model',
    mdHandoffArtifact: 'Writes `Data Schema & State Contract` specifications in coordination .md files.',
    incompatibleWith: [],
    systemPromptDirective:
      'Act as Data & Schema Architect: define explicit schemas, state structures, migration/backward-compatibility rules, and validation invariants in `Data Schema & State Contract` Markdown sections.',
  },

  // Category 6: Documentation & Tooling (mainSlotOnly: false)
  {
    id: 'tech_writer',
    name: 'Technical Writer',
    category: 'docs_tooling',
    categoryLabel: 'Documentation & Tooling',
    color: '#84CC16',
    mainSlotOnly: false,
    shortDescription: 'Updates READMEs, architecture guides, and changelogs from verified completed work.',
    writePermission: 'plan-doc-only',
    hubEscalation: 'escalate-to-main',
    modelPairingHint: 'Clear technical prose model',
    mdHandoffArtifact: 'Updates README.md, docs, and changelogs, logging completed doc updates in coordination .md files.',
    incompatibleWith: [],
    systemPromptDirective:
      'Act as Technical Writer: author clear, accurate README, changelog, and architectural documentation reflecting observed code behavior only, and record doc updates in coordination .md files.',
  },
  {
    id: 'devops_engineer',
    name: 'DevOps & Build Engineer',
    category: 'docs_tooling',
    categoryLabel: 'Documentation & Tooling',
    color: '#475569',
    mainSlotOnly: false,
    shortDescription: 'Manages build scripts, linters, packaging, CI configs, and environment tooling.',
    writePermission: 'code-write',
    hubEscalation: 'critical-blocker-only',
    modelPairingHint: 'Tooling & scripting model',
    mdHandoffArtifact: 'Logs build, bundling, and environment configuration updates in coordination .md files.',
    incompatibleWith: ['pure_manager', 'sync_monitor', 'codebase_explorer'],
    systemPromptDirective:
      'Act as DevOps & Build Engineer: maintain build/lint/package scripts and environment tooling cleanly, verify commands pass, and log build changes in shared .md files.',
  },
];

function normalizeAndAssertSymmetry(rawDefinitions) {
  const registry = {};
  for (const def of rawDefinitions) {
    registry[def.id] = {
      ...def,
      color: String(def.color || '#64748B').toUpperCase(),
      incompatibleWith: Array.from(new Set(Array.isArray(def.incompatibleWith) ? def.incompatibleWith : [])),
    };
  }

  // Enforce bidirectional symmetry + rule completeness:
  // pure_manager and sync_monitor are incompatible with ALL code-write roles
  const codeWriteIds = Object.values(registry)
    .filter((r) => r.writePermission === 'code-write')
    .map((r) => r.id);

  for (const mgrId of ['pure_manager', 'sync_monitor']) {
    if (registry[mgrId]) {
      const set = new Set([...registry[mgrId].incompatibleWith, ...codeWriteIds]);
      set.delete(mgrId);
      registry[mgrId].incompatibleWith = Array.from(set);
    }
  }

  // Mirror every A -> B into B -> A so incompatibility is always strictly bidirectional
  for (const roleA of Object.values(registry)) {
    for (const targetId of roleA.incompatibleWith) {
      if (targetId === roleA.id) continue;
      const roleB = registry[targetId];
      if (!roleB) {
        throw new Error(`Role "${roleA.id}" references unknown incompatible role "${targetId}"`);
      }
      if (!roleB.incompatibleWith.includes(roleA.id)) {
        roleB.incompatibleWith.push(roleA.id);
      }
    }
  }

  // Normalize ordering and assert strict symmetry
  for (const roleA of Object.values(registry)) {
    roleA.incompatibleWith = Array.from(new Set(roleA.incompatibleWith.filter((id) => id !== roleA.id)));
    for (const targetId of roleA.incompatibleWith) {
      if (!registry[targetId].incompatibleWith.includes(roleA.id)) {
        throw new Error(`Symmetry assertion failed: ${roleA.id} <-> ${targetId}`);
      }
    }
  }

  return registry;
}

const ROLE_REGISTRY = normalizeAndAssertSymmetry(RAW_ROLE_DEFINITIONS);

// ============================================================
// 🎨 Gossett & Chen Subtractive RYB Paint-Color Mixing Engine
// ============================================================

function hexToRgb(hex) {
  const clean = String(hex || '#64748B').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 0.39, g: 0.45, b: 0.55 };
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function rgbToHex({ r, g, b }) {
  const toByte = (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

function rgbToRyb({ r, g, b }) {
  const w = Math.min(r, g, b);
  r -= w;
  g -= w;
  b -= w;
  const mg = Math.max(r, g, b);

  let y = Math.min(r, g);
  r -= y;
  g -= y;

  if (b > 0 && g > 0) {
    b /= 2;
    g /= 2;
  }
  y += g;
  b += g;

  const my = Math.max(r, y, b);
  if (my > 0) {
    const n = mg / my;
    r *= n;
    y *= n;
    b *= n;
  }
  return { r: r + w, y: y + w, b: b + w };
}

function rybToRgb({ r, y, b }) {
  const w = Math.min(r, y, b);
  r -= w;
  y -= w;
  b -= w;
  const my = Math.max(r, y, b);

  let g = Math.min(y, b);
  y -= g;
  b -= g;

  if (b > 0 && g > 0) {
    b *= 2;
    g *= 2;
  }
  r += y;
  g += y;

  const mg = Math.max(r, g, b);
  if (mg > 0) {
    const n = my / mg;
    r *= n;
    g *= n;
    b *= n;
  }
  return { r: r + w, g: g + w, b: b + w };
}

/**
 * Mixes 1 or more role hex colors like physical paint in RYB pigment space,
 * preserving pigment vibrancy when multiple roles are blended.
 */
function mixPaintColors(hexColors) {
  if (!Array.isArray(hexColors) || hexColors.length === 0) return '#64748B';
  if (hexColors.length === 1) return String(hexColors[0] || '#64748B').toUpperCase();

  const rybs = hexColors.map((hex) => rgbToRyb(hexToRgb(hex)));
  const count = rybs.length;

  const mixedRyb = {
    r: rybs.reduce((acc, c) => acc + c.r, 0) / count,
    y: rybs.reduce((acc, c) => acc + c.y, 0) / count,
    b: rybs.reduce((acc, c) => acc + c.b, 0) / count,
  };

  const maxPigment = Math.max(mixedRyb.r, mixedRyb.y, mixedRyb.b);
  const avgSourceMax = rybs.reduce((acc, c) => acc + Math.max(c.r, c.y, c.b), 0) / count;
  if (maxPigment > 0 && maxPigment < avgSourceMax) {
    const boost = Math.min(1.25, avgSourceMax / maxPigment);
    mixedRyb.r = Math.min(1, mixedRyb.r * boost);
    mixedRyb.y = Math.min(1, mixedRyb.y * boost);
    mixedRyb.b = Math.min(1, mixedRyb.b * boost);
  }

  return rgbToHex(rybToRgb(mixedRyb));
}

function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function getContrastingTextColor(hex) {
  return getRelativeLuminance(hex) > 0.34 ? '#0F172A' : '#FFFFFF';
}

// ============================================================
// 🛡️ Conflict Detection, Permissions & Slot Profile Resolution
// ============================================================

function getIncompatibleRoles(selectedRoleIds, registry = ROLE_REGISTRY, options = {}) {
  const activeIds = Array.isArray(selectedRoleIds)
    ? selectedRoleIds.filter((id) => Boolean(registry && registry[id]))
    : [];
  const disabledMap = new Map();
  const isMain = options && typeof options.isMain === 'boolean' ? options.isMain : null;

  for (const candidate of Object.values(registry || {})) {
    if (isMain === false && candidate.mainSlotOnly) {
      disabledMap.set(candidate.id, {
        roleId: candidate.id,
        blockedByRoleIds: [],
        reasonText: 'Restricted to Slot 1 (Main) only',
      });
      continue;
    }

    if (activeIds.includes(candidate.id)) continue;

    const blockers = [];
    for (const activeId of activeIds) {
      const activeRole = registry[activeId];
      if (!activeRole) continue;
      if (
        (Array.isArray(activeRole.incompatibleWith) && activeRole.incompatibleWith.includes(candidate.id)) ||
        (Array.isArray(candidate.incompatibleWith) && candidate.incompatibleWith.includes(activeId))
      ) {
        blockers.push(activeId);
      }
    }

    if (blockers.length > 0) {
      const blockerNames = blockers.map((id) => registry[id]?.name || id);
      const hasPureMgr = blockers.includes('pure_manager') && candidate.writePermission === 'code-write';
      const hasSyncMon = blockers.includes('sync_monitor') && candidate.writePermission === 'code-write';
      const extraHint = hasPureMgr
        ? ' (cannot combine with code-writing roles)'
        : hasSyncMon
          ? ' (impartial monitor cannot mutate source code)'
          : '';
      disabledMap.set(candidate.id, {
        roleId: candidate.id,
        blockedByRoleIds: blockers,
        reasonText: `Opposes ${blockerNames.join(', ')}${extraHint}`,
      });
    }
  }

  return disabledMap;
}

const WRITE_PERMISSION_RANK = {
  'comms-md-only': 1,
  'plan-doc-only': 2,
  'code-write': 3,
};

const HUB_ESCALATION_RANK = {
  'escalate-to-main': 1,
  'critical-blocker-only': 2,
  'direct-user-access': 3,
};

function resolveEffectiveSlotProfile(rawRoleIds, isMain, registry = ROLE_REGISTRY) {
  const inputList = Array.isArray(rawRoleIds)
    ? rawRoleIds
    : typeof rawRoleIds === 'string' && rawRoleIds.trim()
      ? [rawRoleIds.trim()]
      : [];

  const valid = [];
  for (const id of inputList) {
    const def = registry[id];
    if (!def) continue;
    if (!isMain && def.mainSlotOnly) continue;
    if (valid.includes(id)) continue;
    const conflictsWithEarlier = valid.some((prevId) => {
      const prev = registry[prevId];
      return prev && (prev.incompatibleWith.includes(id) || def.incompatibleWith.includes(prevId));
    });
    if (!conflictsWithEarlier) {
      valid.push(id);
    }
  }

  const roles = valid.map((id) => registry[id]).filter(Boolean);
  if (roles.length === 0) {
    return {
      roleIds: [],
      roles: [],
      roleNames: [],
      roleSummary: '',
      mixedColor: '#64748B',
      textColor: '#FFFFFF',
      effectiveWritePermission: 'code-write',
      effectiveHubEscalation: 'direct-user-access',
    };
  }

  const roleNames = roles.map((r) => r.name);
  const mixedColor = mixPaintColors(roles.map((r) => r.color));
  const textColor = getContrastingTextColor(mixedColor);

  let effectiveWritePermission = 'comms-md-only';
  for (const r of roles) {
    if ((WRITE_PERMISSION_RANK[r.writePermission] || 0) > (WRITE_PERMISSION_RANK[effectiveWritePermission] || 0)) {
      effectiveWritePermission = r.writePermission;
    }
  }

  let effectiveHubEscalation = 'escalate-to-main';
  for (const r of roles) {
    if ((HUB_ESCALATION_RANK[r.hubEscalation] || 0) > (HUB_ESCALATION_RANK[effectiveHubEscalation] || 0)) {
      effectiveHubEscalation = r.hubEscalation;
    }
  }

  return {
    roleIds: valid,
    roles,
    roleNames,
    roleSummary: roleNames.join(' + '),
    mixedColor,
    textColor,
    effectiveWritePermission,
    effectiveHubEscalation,
  };
}

// ============================================================
// 🎭 Curated Multi-Role Team Presets
// ============================================================

const TEAM_ROLE_PRESETS = [
  {
    id: 'duo_2_agent',
    name: '2-Agent Duo',
    description: 'Slot 1: Hybrid Lead + Code Architect | Slot 2: Code Reviewer + Security Auditor + QA Engineer',
    slots: [
      ['hybrid_lead', 'code_architect'],
      ['code_reviewer', 'security_auditor', 'qa_engineer'],
    ],
  },
  {
    id: 'squad_3_agent',
    name: '3-Agent Feature Squad',
    description: 'Slot 1: Pure Manager + Product Specifier | Slot 2: Code Writer | Slot 3: Code Reviewer + QA Engineer',
    slots: [
      ['pure_manager', 'product_specifier'],
      ['code_writer'],
      ['code_reviewer', 'qa_engineer'],
    ],
  },
  {
    id: 'interactive_4_agent',
    name: '4-Agent Interactive / Game Team',
    description: 'Slot 1: Pure Manager + Code Architect | Slot 2: Code Writer | Slot 3: UI/UX + 2D + Audio | Slot 4: QA + Debugger',
    slots: [
      ['pure_manager', 'code_architect'],
      ['code_writer'],
      ['ui_ux_designer', 'designer_2d', 'audio_designer'],
      ['qa_engineer', 'debugger'],
    ],
  },
];

// ============================================================
// 🧩 Unified Multi-Role Prompt & Markdown Coordination Composer
// ============================================================

function formatPermissionGuardrail(permission) {
  if (permission === 'comms-md-only') {
    return 'Effective File-Access Tier: `comms-md-only` — You MUST read the codebase and write/append your reports, reviews, audits, and handoffs ONLY to the extension\'s shared coordination `.md` files (`TASKS.md`, `AGENT_COMMUNICATION.md`, `ACTIVITY_LOG.md`). You are STRICTLY FORBIDDEN from creating, modifying, or deleting project source code or project documentation files.';
  }
  if (permission === 'plan-doc-only') {
    return 'Effective File-Access Tier: `plan-doc-only` — You may write/edit the extension\'s shared coordination `.md` files AND project planning/documentation Markdown files (`README.md`, specs, architecture blueprints, schemas). You are STRICTLY FORBIDDEN from modifying implementation source code.';
  }
  return 'Effective File-Access Tier: `code-write` — You have full read/write access to project source code, project documentation, and the shared coordination `.md` files.';
}

function formatHubEscalationRule(policy, isMain) {
  if (policy === 'direct-user-access') {
    return 'Hub Escalation Policy: `direct-user-access` — You may ask clarifying questions or submit plan polls directly to the user via the AIvengers Hub (`node ... report|ask|poll`).';
  }
  if (policy === 'critical-blocker-only') {
    return 'Hub Escalation Policy: `critical-blocker-only` — Resolve design/implementation questions in `AGENT_COMMUNICATION.md` with teammates first; only ping the user Hub directly if blocked after 2 failed resolution loops.';
  }
  return isMain
    ? 'Hub Escalation Policy: Route final approvals and questions cleanly in the AIvengers Hub.'
    : 'Hub Escalation Policy: `escalate-to-main` — NEVER ping the user Hub directly with questions; route questions to Slot 1 (Main) inside `AGENT_COMMUNICATION.md`.';
}

function buildMultiRolePromptBlock({
  slotIndex = 0,
  participantTag,
  modelDisplayName,
  roleProfile,
  rosterSummary,
  hubDir,
  hubScriptPath,
}) {
  const slotNum = slotIndex + 1;
  const profile = roleProfile || resolveEffectiveSlotProfile([], slotIndex === 0);
  const scriptRef = hubScriptPath || (hubDir ? `${hubDir}/scripts/hub.js` : 'scripts/hub.js');
  const hasRoles = profile.roles && profile.roles.length > 0;
  const roleDisplay = profile.roleSummary || 'None (Unrestricted General Agent)';
  const signatureHeader = `### [Slot ${slotNum} | ${modelDisplayName || participantTag} | ${roleDisplay} | ${profile.mixedColor}]`;

  const directives = hasRoles
    ? profile.roles
        .map((r) => `- **${r.name} (${r.color}):** ${r.systemPromptDirective} (MD Artifact: ${r.mdHandoffArtifact})`)
        .join('\n')
    : '';

  const lines = [
    `## Multi-Role Identity & Markdown Coordination Protocol`,
    `- **Participant Identity Tag (pass as \`--agent\` in all hub.js calls):** \`${participantTag}\` (Display Name / Model: **${modelDisplayName || participantTag}**)`,
    hasRoles
      ? `- **Assigned Roles:** ${profile.roleSummary} | **Mixed Paint Signature:** \`${profile.mixedColor}\``
      : `- **Assigned Roles:** None (Unrestricted General Agent) | **Paint Color:** \`${profile.mixedColor}\``,
    `- **Required Markdown Section Signature:** Prefix every section or message you write in shared coordination \`.md\` files with:\n  \`${signatureHeader}\``,
    `- **${formatPermissionGuardrail(profile.effectiveWritePermission)}**`,
    `- **${formatHubEscalationRule(profile.effectiveHubEscalation, slotIndex === 0)}**`,
    `- **Markdown Concurrency & Presence Etiquette:** Always verify teammate availability via \`node "${scriptRef}" peers\` / \`health\` before delegating or waiting on handoffs (never block indefinitely on an offline slot). Use append-only / role-scoped sections in shared \`.md\` files, and explicitly claim target source file paths in \`TASKS.md\` (\`hub.js claim\`) before editing source code so parallel writers never collide.`,
    rosterSummary ? `- **${rosterSummary}**` : '',
    directives ? `### Role Directives & Expected MD Artifacts\n${directives}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Emits self-contained pure helper JS source for the VS Code webview `<script>` so UI
 * conflict detection, RYB color mixing, and slot profile resolution never drift or duplicate logic.
 */
function getWebviewRoleHelpersSource() {
  return [
    hexToRgb.toString(),
    rgbToHex.toString(),
    rgbToRyb.toString(),
    rybToRgb.toString(),
    mixPaintColors.toString(),
    getRelativeLuminance.toString(),
    getContrastingTextColor.toString(),
    getIncompatibleRoles.toString(),
    `const WRITE_PERMISSION_RANK = ${JSON.stringify(WRITE_PERMISSION_RANK)};`,
    `const HUB_ESCALATION_RANK = ${JSON.stringify(HUB_ESCALATION_RANK)};`,
    resolveEffectiveSlotProfile.toString(),
  ].join('\n');
}

module.exports = {
  ROLE_CATEGORIES,
  RAW_ROLE_DEFINITIONS,
  ROLE_REGISTRY,
  TEAM_ROLE_PRESETS,
  normalizeAndAssertSymmetry,
  hexToRgb,
  rgbToHex,
  rgbToRyb,
  rybToRgb,
  mixPaintColors,
  getRelativeLuminance,
  getContrastingTextColor,
  getIncompatibleRoles,
  resolveEffectiveSlotProfile,
  buildMultiRolePromptBlock,
  getWebviewRoleHelpersSource,
};
