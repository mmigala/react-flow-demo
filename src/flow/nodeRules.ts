import type { Edge } from '@xyflow/react';
import type { NodeKind, WorkflowNode } from '../types';
import { getSubtype } from './nodeCatalog';

// Only these kind -> kind transitions are allowed to be connected.
// This enforces: Trigger -> Input -> Action(s) -> Output
export const ALLOWED_TRANSITIONS: Record<NodeKind, NodeKind[]> = {
  trigger: ['input'],
  input: ['action', 'output'],
  action: ['action', 'output'],
  output: [],
};

// Node kinds that may only exist once per workflow.
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

/**
 * A connection is only allowed when the two nodes' kinds follow the required order
 * AND the upstream node's produced data type matches the downstream node's required
 * data type (like matching plug shapes) - e.g. a node that produces "Order" data can
 * only feed a node that accepts "Order" data.
 */
export function isConnectionAllowed(source: WorkflowNode, target: WorkflowNode): boolean {
  if (!isTransitionAllowed(source.data.kind, target.data.kind)) return false;
  const sourceSubtype = getSubtype(source.data.subtypeId);
  const targetSubtype = getSubtype(target.data.subtypeId);
  return sourceSubtype.produces !== undefined && sourceSubtype.produces === targetSubtype.accepts;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Minimal structural validation:
 * - exactly one trigger / input / output node
 * - every node has at most one outgoing and one incoming edge (linear chain, no branching)
 * - following edges from trigger visits every node exactly once and ends at output,
 *   respecting the Trigger -> Input -> Action(s) -> Output order and matching data types.
 */
export function validateWorkflow(nodes: WorkflowNode[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];

  if (nodes.length === 0) {
    return { valid: false, errors: ['Workflow is empty. Add at least a Trigger, Input and Output node.'] };
  }

  for (const kind of SINGLETON_KINDS) {
    const count = nodes.filter((n) => n.data.kind === kind).length;
    if (count !== 1) {
      errors.push(`Workflow must contain exactly one "${KIND_META[kind].label}" node (found ${count}).`);
    }
  }

  const outMap = new Map<string, Edge[]>();
  const inMap = new Map<string, Edge[]>();
  for (const edge of edges) {
    outMap.set(edge.source, [...(outMap.get(edge.source) ?? []), edge]);
    inMap.set(edge.target, [...(inMap.get(edge.target) ?? []), edge]);
  }

  for (const node of nodes) {
    if ((outMap.get(node.id)?.length ?? 0) > 1) errors.push(`Node "${node.data.label}" has more than one outgoing connection.`);
    if ((inMap.get(node.id)?.length ?? 0) > 1) errors.push(`Node "${node.data.label}" has more than one incoming connection.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const trigger = nodes.find((n) => n.data.kind === 'trigger');
  if (!trigger) {
    return { valid: false, errors };
  }

  const visited = new Set<string>();
  let current: WorkflowNode | undefined = trigger;
  while (current) {
    if (visited.has(current.id)) {
      errors.push('Workflow contains a cycle.');
      break;
    }
    visited.add(current.id);

    const nextEdge: Edge | undefined = outMap.get(current.id)?.[0];
    if (!nextEdge) {
      if (current.data.kind !== 'output') {
        errors.push(`Path ends at "${current.data.label}" (${KIND_META[current.data.kind].label}) before reaching an Output node.`);
      }
      break;
    }
    const nextNode: WorkflowNode | undefined = nodes.find((n) => n.id === nextEdge.target);
    if (!nextNode) break;
    if (!isConnectionAllowed(current, nextNode)) {
      const currentSubtype = getSubtype(current.data.subtypeId);
      const nextSubtype = getSubtype(nextNode.data.subtypeId);
      errors.push(
        `Connection from "${current.data.label}" (produces ${currentSubtype.produces ?? 'nothing'}) to "${nextNode.data.label}" (needs ${nextSubtype.accepts ?? 'nothing'}) is not allowed - data types don't match.`,
      );
      break;
    }
    current = nextNode;
  }

  const unreached = nodes.filter((n) => !visited.has(n.id));
  if (unreached.length > 0) {
    errors.push(`These nodes are not connected into the workflow path: ${unreached.map((n) => n.data.label).join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

