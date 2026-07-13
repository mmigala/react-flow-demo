import type { NodeKind, WorkflowNode } from '../types';
import { getIncompatibleWith } from './nodeCatalog';

// Only these kind -> kind transitions are allowed to be connected.
// This enforces: Trigger -> Input -> Action(s) -> Output
// NOTE: the real Fotoware Flow backend doesn't have this ordering concept yet (see
// NodeCompatibilityPolicy/FlowStructureValidator - both operate on a flat set of subtypes,
// not a connected chain, and don't require nodes to be connected at all). We keep this layer
// anyway as forward-looking POC behavior: this is how flows should visually work once the
// backend adds real ordering support. It restricts which connections can be drawn on the
// canvas, but (see getEnableReadiness below) it does NOT gate whether a workflow can be enabled.
export const ALLOWED_TRANSITIONS: Record<NodeKind, NodeKind[]> = {
  trigger: ['input'],
  input: ['action', 'output'],
  action: ['action', 'output'],
  output: [],
};

// Node kinds that may only exist once per workflow (for the chain/ordering layer).
export const SINGLETON_KINDS: NodeKind[] = ['trigger', 'input', 'output'];

export const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  trigger: { label: 'Trigger', color: '#7c3aed' },
  input: { label: 'Input', color: '#2563eb' },
  action: { label: 'Action', color: '#059669' },
  output: { label: 'Output', color: '#dc2626' },
};

export function isTransitionAllowed(sourceKind: NodeKind, targetKind: NodeKind): boolean {
  return ALLOWED_TRANSITIONS[sourceKind].includes(targetKind);
}

/** A connection is only allowed when the two nodes' kinds follow the required order. */
export function isConnectionAllowed(source: WorkflowNode, target: WorkflowNode): boolean {
  return isTransitionAllowed(source.data.kind, target.data.kind);
}

export interface WorkflowIssue {
  nodeId?: string;
  message: string;
}

/** Mirrors FlowStructureValidator's duplicate-subtype check: no subtype id may be used more than once. */
export function getDuplicateIssues(nodes: WorkflowNode[]): WorkflowIssue[] {
  const bySubtype = new Map<string, WorkflowNode[]>();
  for (const node of nodes) {
    bySubtype.set(node.data.subtypeId, [...(bySubtype.get(node.data.subtypeId) ?? []), node]);
  }
  const issues: WorkflowIssue[] = [];
  for (const group of bySubtype.values()) {
    if (group.length <= 1) continue;
    // The backend emits exactly one error per distinct duplicated subtype value (not one per
    // repeated instance) and isn't tied to a specific node - mirror that here.
    issues.push({ message: `Node subtype "${group[0].data.label}" was added more than once.` });
  }
  return issues;
}

/**
 * Mirrors NodeCompatibilityPolicy + FlowStructureValidator.AddErrorsIfIncorrectCombinationsOfNodesAreUsed:
 * every subtype present must be compatible (via getValidNextSubtypeIds) with every OTHER subtype
 * present, regardless of whether they're connected. Reported per offending node.
 */
export function getCombinationIssues(nodes: WorkflowNode[]): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  for (const node of nodes) {
    const otherSubtypeIds = nodes.filter((n) => n.id !== node.id).map((n) => n.data.subtypeId);
    const conflicts = getIncompatibleWith(node.data.subtypeId, otherSubtypeIds);
    if (conflicts.length > 0) {
      issues.push({ nodeId: node.id, message: `"${node.data.label}" is not allowed in this combination together with: ${conflicts.join(', ')}.` });
    }
  }
  return issues;
}

export interface ReadinessCheck {
  label: string;
  done: boolean;
}

export interface EnableReadiness {
  ready: boolean;
  checks: ReadinessCheck[];
  /** Extra, dynamically-discovered problems mirroring the real backend's flat validation - a growing punch list rather than a fixed set of checkboxes. */
  issues: WorkflowIssue[];
}

/**
 * What's required to flip a workflow from Disabled to Enabled - a direct replica of
 * FlowStructureValidator.Validate. This intentionally does NOT require nodes to be connected via
 * edges, nor does it require an Action or Output unconditionally - the real backend validates a
 * flat set of subtypes only (e.g. Scheduler + SaaS Core Pool Input + Delete is a valid, enable-able
 * flow with no Output at all, since Output is only required when using an external input).
 * Connections/ordering on the canvas remain a separate, forward-looking UI feature (see
 * isConnectionAllowed above) that doesn't gate enabling.
 */
export function getEnableReadiness(nodes: WorkflowNode[]): EnableReadiness {
  // Mirror the backend exactly: if any subtype is duplicated, return immediately with only the
  // duplicate errors - the combination check and all structural rules below are never evaluated.
  const duplicateIssues = getDuplicateIssues(nodes);
  if (duplicateIssues.length > 0) {
    return { ready: false, checks: [], issues: duplicateIssues };
  }

  const issues: WorkflowIssue[] = [...getCombinationIssues(nodes)];

  const hasKind = (kind: NodeKind) => nodes.some((n) => n.data.kind === kind);
  const subtypeIds = nodes.map((n) => n.data.subtypeId);
  const hasExternalInput = subtypeIds.includes('ContainerGroupNewAssetUpload');
  const hasInternalInput = subtypeIds.includes('SaasCorePoolInput');
  const hasTrigger = hasKind('trigger') || hasExternalInput;
  const hasInput = hasKind('input') || hasExternalInput;
  const hasOutput = hasKind('output');
  const hasAction = hasKind('action');

  const checks: ReadinessCheck[] = [
    { label: 'A trigger node is present', done: hasTrigger },
    { label: 'An input node is present', done: hasInput },
  ];

  if (hasExternalInput && !hasOutput) {
    issues.push({ message: 'An output is required when using an external input (Container Group New Asset Upload).' });
  }
  if (hasInternalInput && hasExternalInput) {
    issues.push({ message: 'You cannot mix internal (SaaS Core Pool) and external (Container Group New Asset Upload) input nodes in the same flow.' });
  }
  if (hasInternalInput && !hasAction && !hasOutput) {
    issues.push({ message: 'At least one action or output is required for internal assets.' });
  }

  return { ready: checks.every((c) => c.done) && issues.length === 0, checks, issues };
}
