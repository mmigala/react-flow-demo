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
  type OnConnectStartParams,
} from '@xyflow/react';
import { getWorkflow, saveWorkflow } from '../storage';
import { FlowNode } from '../flow/FlowNode';
import { DeletableEdge } from '../flow/DeletableEdge';
import { KIND_META, SINGLETON_KINDS, isConnectionAllowed, validateWorkflow } from '../flow/nodeRules';
import { DATA_TYPE_COLORS, subtypesForKind, type NodeSubtype } from '../flow/nodeCatalog';
import type { NodeKind, WorkflowNode } from '../types';

const nodeTypes = { flowNode: FlowNode };
const edgeTypes = { deletable: DeletableEdge };
const defaultEdgeOptions = { type: 'deletable' };
const ALL_KINDS: NodeKind[] = ['trigger', 'input', 'action', 'output'];

interface ConnectingHandle {
  nodeId: string;
  handleType: 'source' | 'target';
}

function BuilderInner({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate();
  const existing = useMemo(() => getWorkflow(workflowId), [workflowId]);

  const [name, setName] = useState(existing?.name ?? 'Untitled workflow');
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(existing?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(existing?.edges ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [connecting, setConnecting] = useState<ConnectingHandle | null>(null);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      if (!isConnectionAllowed(sourceNode, targetNode)) return false;
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

  // While the user drags a new connection, highlight which other nodes it could
  // legally attach to (matching data type + allowed order) so the correct target is obvious.
  const onConnectStart = useCallback((_: unknown, params: OnConnectStartParams) => {
    if (params.nodeId && params.handleType) {
      setConnecting({ nodeId: params.nodeId, handleType: params.handleType });
    }
  }, []);

  const onConnectEnd = useCallback(() => setConnecting(null), []);

  const displayNodes = useMemo(() => {
    if (!connecting) return nodes;
    const connectingNode = nodes.find((n) => n.id === connecting.nodeId);
    if (!connectingNode) return nodes;
    return nodes.map((n) => {
      if (n.id === connecting.nodeId) return n;
      const compatible =
        connecting.handleType === 'source' ? isConnectionAllowed(connectingNode, n) : isConnectionAllowed(n, connectingNode);
      return { ...n, className: compatible ? 'compatible-target' : 'incompatible-target' };
    });
  }, [nodes, connecting]);

  const addNode = (subtype: NodeSubtype) => {
    const id = `${subtype.id}-${crypto.randomUUID()}`;
    const count = nodes.length;
    const newNode: WorkflowNode = {
      id,
      type: 'flowNode',
      position: { x: 60 + (count % 4) * 260, y: 80 + Math.floor(count / 4) * 160 },
      data: { label: subtype.label, kind: subtype.kind, subtypeId: subtype.id },
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
        exactly once each; Actions are optional and repeatable. Nodes only connect when their data types match too -
        each node needs/gives one of the types below, like plugging matching cable shapes together. Double-click a
        node to rename it, drag from a right (output) handle to a left (input) handle to connect - compatible nodes
        light up green while you drag - use a node's × button to delete it, and click the × on a connection line to
        disconnect it.
        <div className="type-legend">
          {Object.entries(DATA_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="type-chip" style={{ background: color }}>
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="toolbar">
        {ALL_KINDS.map((kind) => {
          const kindDisabled = SINGLETON_KINDS.includes(kind) && nodes.some((n) => n.data.kind === kind);
          return (
            <div key={kind} className="palette-group">
              <span className="palette-group-label" style={{ color: KIND_META[kind].color }}>
                {KIND_META[kind].label}
              </span>
              {subtypesForKind(kind).map((subtype) => (
                <button
                  key={subtype.id}
                  className="btn"
                  style={{ borderColor: KIND_META[kind].color }}
                  disabled={kindDisabled}
                  title={[subtype.accepts && `Needs: ${subtype.accepts}`, subtype.produces && `Gives: ${subtype.produces}`]
                    .filter(Boolean)
                    .join(' · ')}
                  onClick={() => addNode(subtype)}
                >
                  + {subtype.label}
                </button>
              ))}
            </div>
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
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
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
