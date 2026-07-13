import type { Edge, Node } from '@xyflow/react';

export type NodeKind = 'trigger' | 'input' | 'action' | 'output';

export type WorkflowStatus = 'enabled' | 'disabled';

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  /** Which concrete node template (from the catalog) this node is an instance of. */
  subtypeId: string;
}

export type WorkflowNode = Node<WorkflowNodeData>;

export interface WorkflowDefinition {
  id: string;
  name: string;
  /** Enabled workflows are locked - they can't be edited until disabled again. */
  status: WorkflowStatus;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: Edge[];
}
