import type { Edge } from '@xyflow/react';
import type { NodeKind, WorkflowNode } from '../types';
import { getIncompatibleWith, getSuggestedSubtypesForKind, getAddableSubtypesForKind, type NodeSubtype } from './nodeCatalog';

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

/**
 * Whether every node on the board is connected (directly or transitively) to every other node -
 * i.e. there's a single connected diagram with no isolated/orphaned nodes. This is a deliberate
 * POC-only requirement layered on top of the backend-mirrored rules below (the real backend has
 * no concept of connections at all - see the note above).
 */
export function areAllNodesConnected(nodes: WorkflowNode[], edges: Edge[]): boolean {
  if (nodes.length <= 1) return true;

  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const stack = [nodes[0].id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }

  return visited.size === nodes.length;
}

export interface WorkflowIssue {
  nodeId?: string;
  message: string;
  /** Concrete subtypes that would resolve this issue if added, given what's already on the board. */
  suggestions?: NodeSubtype[];
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
  /** Concrete subtypes that would satisfy this check if added, given what's already on the board. */
  suggestions?: NodeSubtype[];
}

export interface EnableReadiness {
  ready: boolean;
  checks: ReadinessCheck[];
  /** Extra, dynamically-discovered problems mirroring the real backend's flat validation - a growing punch list rather than a fixed set of checkboxes. */
  issues: WorkflowIssue[];
  /** Non-blocking, informational tips - e.g. more Actions can still be added given what's compatible with the board right now. Doesn't affect `ready`. */
  notes: WorkflowIssue[];
}

/**
 * What's required to flip a workflow from Disabled to Enabled. Combines two layers:
 * - a direct replica of FlowStructureValidator.Validate: doesn't require an Action or Output
 *   unconditionally - the real backend validates a flat set of subtypes only (e.g. Scheduler +
 *   SaaS Core Pool Input + Delete satisfies these rules with no Output at all, since Output is
 *   only required when using an external input).
 * - a deliberate, additional POC-only rule: every node must also be connected together on the
 *   canvas (see areAllNodesConnected above) - the real backend has no concept of connections, but
 *   this product wants it enforced here anyway.
 */
export function getEnableReadiness(nodes: WorkflowNode[], edges: Edge[]): EnableReadiness {
  // Mirror the backend exactly: if any subtype is duplicated, return immediately with only the
  // duplicate errors - the combination check and all structural rules below are never evaluated.
  const duplicateIssues = getDuplicateIssues(nodes);
  if (duplicateIssues.length > 0) {
    return { ready: false, checks: [], issues: duplicateIssues, notes: [] };
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
    { label: 'A trigger node is present', done: hasTrigger, suggestions: hasTrigger ? undefined : getSuggestedSubtypesForKind('trigger', subtypeIds) },
    { label: 'An input node is present', done: hasInput, suggestions: hasInput ? undefined : getSuggestedSubtypesForKind('input', subtypeIds) },
    { label: 'All nodes are connected together', done: areAllNodesConnected(nodes, edges) },
  ];

  if (hasExternalInput && !hasOutput) {
    issues.push({
      message: 'An output is required when using an external input (Container Group New Asset Upload).',
      suggestions: getSuggestedSubtypesForKind('output', subtypeIds),
    });
  }
  if (hasInternalInput && hasExternalInput) {
    issues.push({ message: 'You cannot mix internal (SaaS Core Pool) and external (Container Group New Asset Upload) input nodes in the same flow.' });
  }
  if (hasInternalInput && !hasAction && !hasOutput) {
    issues.push({
      message: 'At least one action or output is required for internal assets.',
      suggestions: [...getSuggestedSubtypesForKind('action', subtypeIds), ...getSuggestedSubtypesForKind('output', subtypeIds)],
    });
  }

  // Action is the only kind that isn't limited to one node - once at least one is present, tell
  // the user whether more can still be added given what's already on the board (e.g. Delete is
  // incompatible with every other action, so no more can be added once it's used; Auto Tagging
  // isn't, so other actions remain addable).
  const notes: WorkflowIssue[] = [];
  if (hasAction) {
    const stillAddable = getAddableSubtypesForKind('action', subtypeIds);
    if (stillAddable.length > 0) {
      notes.push({ message: 'You can still add more actions.', suggestions: stillAddable });
    }
  }

  return { ready: checks.every((c) => c.done) && issues.length === 0, checks, issues, notes };
}
