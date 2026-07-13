import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
} from '@xyflow/react';
import { getWorkflow, saveWorkflow } from '../storage';
import { FlowNode } from '../flow/FlowNode';
import { KIND_META, SINGLETON_KINDS, isTransitionAllowed, validateWorkflow } from '../flow/nodeRules';
import type { NodeKind, WorkflowNode } from '../types';

const nodeTypes = { flowNode: FlowNode };
const ALL_KINDS: NodeKind[] = ['trigger', 'input', 'action', 'output'];

function BuilderInner({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate();
  const existing = useMemo(() => getWorkflow(workflowId), [workflowId]);

  const [name, setName] = useState(existing?.name ?? 'Untitled workflow');
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(existing?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(existing?.edges ?? []);
  const [errors, setErrors] = useState<string[]>([]);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      if (!isTransitionAllowed(sourceNode.data.kind, targetNode.data.kind)) return false;
      const sourceHasOutgoing = edges.some((e) => e.source === connection.source);
      const targetHasIncoming = edges.some((e) => e.target === connection.target);
      return !sourceHasOutgoing && !targetHasIncoming;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e-${connection.source}-${connection.target}` }, eds));
    },
    [setEdges],
  );

  const addNode = (kind: NodeKind) => {
    const id = `${kind}-${crypto.randomUUID()}`;
    const actionCount = nodes.filter((n) => n.data.kind === 'action').length;
    const label = kind === 'action' ? `Action ${actionCount + 1}` : KIND_META[kind].label;
    const count = nodes.length;
    const newNode: WorkflowNode = {
      id,
      type: 'flowNode',
      position: { x: 80 + (count % 5) * 180, y: 80 + Math.floor(count / 5) * 140 },
      data: { label, kind },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setErrors(['Workflow name is required.']);
      return;
    }
    const result = validateWorkflow(nodes, edges);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    saveWorkflow({ id: workflowId, name: name.trim(), nodes, edges, updatedAt: new Date().toISOString() });
    navigate('/');
  };

  return (
    <div className="page builder-page">
      <div className="page-header">
        <input className="workflow-name-input" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="builder-actions">
          <button className="btn" onClick={() => navigate('/')}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      <div className="legend">
        Required order: <strong>Trigger → Input → Action(s) → Output</strong>. Trigger, Input and Output are required
        exactly once each. Actions are optional and can be added multiple times. Double-click a node to rename it,
        drag from the right handle to the left handle of the next node to connect, select a node and use its × button
        to delete it.
      </div>

      <div className="toolbar">
        {ALL_KINDS.map((kind) => {
          const disabled = SINGLETON_KINDS.includes(kind) && nodes.some((n) => n.data.kind === kind);
          return (
            <button
              key={kind}
              className="btn"
              style={{ borderColor: KIND_META[kind].color }}
              disabled={disabled}
              onClick={() => addNode(kind)}
            >
              + {KIND_META[kind].label}
            </button>
          );
        })}
      </div>

      {errors.length > 0 && (
        <div className="error-banner">
          <ul>
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const workflowId = useMemo(() => (id && id !== 'new' ? id : crypto.randomUUID()), [id]);

  return (
    <ReactFlowProvider>
      <BuilderInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
