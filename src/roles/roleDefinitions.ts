export type RoleCategoryId =
  | 'leadership'
  | 'engineering'
  | 'quality_security'
  | 'design_media'
  | 'context_data'
  | 'docs_tooling';

/**
 * Three-tier file access tailored for Markdown-coordinated multi-agent teams:
 * - 'comms-md-only': Can read the codebase and write/append ONLY to the extension's
 *   shared coordination .md files (boards, reviews, briefs, digests). Cannot edit source code or project docs.
 * - 'plan-doc-only': Can write/edit coordination .md files AND project/design Markdown docs
 *   (specs, blueprints, schemas, READMEs). Cannot edit implementation source code.
 * - 'code-write': Full read/write access to source code, project docs, and coordination .md files.
 */
export type WritePermission = 'comms-md-only' | 'plan-doc-only' | 'code-write';

export type HubEscalationPolicy =
  | 'direct-user-access'     // Can ask the user questions directly via the Hub
  | 'critical-blocker-only'  // Only pings Hub if blocked after 2 failed resolution loops
  | 'escalate-to-main';      // Never pings user directly; routes questions to Slot 0 (Main) via MD

export interface AgentRoleDefinition {
  id: string;
  name: string;
  category: RoleCategoryId;
  categoryLabel: string;
  color: string;                 // Distinct #RRGGBB paint pigment color
  mainSlotOnly: boolean;
  shortDescription: string;
  writePermission: WritePermission;
  hubEscalation: HubEscalationPolicy;
  modelPairingHint: string;
  mdHandoffArtifact: string;     // What this role writes into the shared coordination .md files
  incompatibleWith: string[];    // Symmetrical list of opposing role IDs
  systemPromptDirective: string;
}

export interface DisabledRoleReason {
  roleId: string;
  blockedByRoleIds: string[];
  reasonText: string;
}

export interface RoleCategoryMeta {
  id: RoleCategoryId;
  label: string;
  mainSlotOnly?: boolean;
}

export interface EffectiveSlotProfile {
  roleIds: string[];
  roles: AgentRoleDefinition[];
  roleNames: string[];
  roleSummary: string;
  mixedColor: string;
  textColor: string;
  effectiveWritePermission: WritePermission;
  effectiveHubEscalation: HubEscalationPolicy;
}

declare const require: (id: string) => any;

const runtime = require('./roleDefinitions.js');

export const ROLE_CATEGORIES: RoleCategoryMeta[] = runtime.ROLE_CATEGORIES;
export const RAW_ROLE_DEFINITIONS: AgentRoleDefinition[] = runtime.RAW_ROLE_DEFINITIONS;
export const ROLE_REGISTRY: Record<string, AgentRoleDefinition> = runtime.ROLE_REGISTRY;
export const TEAM_ROLE_PRESETS = runtime.TEAM_ROLE_PRESETS;

export function getIncompatibleRoles(
  selectedRoleIds: string[],
  registry: Record<string, AgentRoleDefinition> = ROLE_REGISTRY,
  options?: { isMain?: boolean }
): Map<string, DisabledRoleReason> {
  return runtime.getIncompatibleRoles(selectedRoleIds, registry, options);
}

export function mixPaintColors(hexColors: string[]): string {
  return runtime.mixPaintColors(hexColors);
}

export function getContrastingTextColor(hex: string): '#FFFFFF' | '#0F172A' {
  return runtime.getContrastingTextColor(hex);
}

export function resolveEffectiveSlotProfile(
  rawRoleIds: string[] | string | undefined,
  isMain: boolean,
  registry: Record<string, AgentRoleDefinition> = ROLE_REGISTRY
): EffectiveSlotProfile {
  return runtime.resolveEffectiveSlotProfile(rawRoleIds, isMain, registry);
}

export function buildMultiRolePromptBlock(params: {
  slotIndex: number;
  participantTag: string;
  modelDisplayName: string;
  roleProfile: EffectiveSlotProfile;
  rosterSummary: string;
  hubDir: string;
  hubScriptPath?: string;
}): string {
  return runtime.buildMultiRolePromptBlock(params);
}
