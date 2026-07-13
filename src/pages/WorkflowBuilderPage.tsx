import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { KIND_META, SINGLETON_KINDS, getChainTailType, getEnableReadiness, isConnectionAllowed } from '../flow/nodeRules';
import { DATA_TYPE_COLORS, getSubtype, subtypesForKind, type NodeSubtype } from '../flow/nodeCatalog';
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

  // Enabled workflows are locked - guard direct URL access too, not just the list page's Edit button.
  useEffect(() => {
    if (existing?.status === 'enabled') {
      navigate('/');
    }
  }, [existing, navigate]);

  const [name, setName] = useState(existing?.name ?? 'Untitled workflow');
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(existing?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(existing?.edges ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [connecting, setConnecting] = useState<ConnectingHandle | null>(null);
  const readiness = useMemo(() => getEnableReadiness(nodes, edges), [nodes, edges]);
  // The data type the next Input/Action/Output must accept, based on whatever is already
  // wired up on the board - used to keep incompatible catalog options out of the dropdowns.
  const chainTailType = useMemo(() => getChainTailType(nodes, edges), [nodes, edges]);

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

  // Saving never blocks on validity - while Disabled, a workflow can be edited into any
  // (even incomplete) shape. Only flipping it to Enabled requires the full checklist below.
  const handleSave = () => {
    if (!name.trim()) {
      setErrors(['Workflow name is required.']);
      return;
    }
    saveWorkflow({ id: workflowId, name: name.trim(), status: 'disabled', nodes, edges, updatedAt: new Date().toISOString() });
    navigate('/');
  };

  const handleEnable = () => {
    if (!name.trim()) {
      setErrors(['Workflow name is required.']);
      return;
    }
    if (!readiness.ready) {
      setErrors(readiness.checks.filter((c) => !c.done).map((c) => `Missing: ${c.label}`));
      return;
    }
    saveWorkflow({ id: workflowId, name: name.trim(), status: 'enabled', nodes, edges, updatedAt: new Date().toISOString() });
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
          <button className="btn" onClick={handleSave}>
            Save
          </button>
          <button
            className="btn btn-primary"
            disabled={!readiness.ready}
            title={readiness.ready ? 'Save and enable this workflow' : 'Complete the checklist below to enable'}
            onClick={handleEnable}
          >
            Save &amp; Enable
          </button>
        </div>
      </div>

      <div className="readiness">
        <strong>Ready to enable?</strong> A workflow can only run once it has all of these:
        <ul>
          {readiness.checks.map((check) => (
            <li key={check.label} className={check.done ? 'check-ok' : 'check-missing'}>
              {check.done ? '✓' : '✗'} {check.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="legend">
        Required order: <strong>Trigger → Input → Action(s) → Output</strong>. Trigger, Input and Output are required
        exactly once each; Actions are optional and repeatable. Nodes only connect when their data types match too -
        each node needs/gives one of the types below, like plugging matching cable shapes together - the dropdowns
        below automatically grey out node types that wouldn't fit what's already on the board. Double-click a node to
        rename it, drag from a right (output) handle to a left (input) handle to connect - compatible nodes light up
        green while you drag - use a node's × button to delete it, and click the × on a connection line to disconnect
        it.
        <div className="type-legend">
          {Object.entries(DATA_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="type-chip" style={{ background: color }}>
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* A dropdown per kind keeps the toolbar at a fixed size no matter how many
          node subtypes get added to the catalog over time. */}
      <div className="toolbar">
        {ALL_KINDS.map((kind) => {
          const kindDisabled = SINGLETON_KINDS.includes(kind) && nodes.some((n) => n.data.kind === kind);
          return (
            <div key={kind} className="palette-group">
              <label className="palette-group-label" style={{ color: KIND_META[kind].color }}>
                {KIND_META[kind].label}
              </label>
              <select
                className="btn node-picker"
                style={{ borderColor: KIND_META[kind].color }}
                disabled={kindDisabled}
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  addNode(getSubtype(e.target.value));
                  e.target.value = '';
                }}
              >
                <option value="" disabled>
                  + Add {KIND_META[kind].label}...
                </option>
                {subtypesForKind(kind).map((subtype) => {
                  const incompatible = chainTailType !== undefined && subtype.accepts !== undefined && subtype.accepts !== chainTailType;
                  return (
                    <option key={subtype.id} value={subtype.id} disabled={incompatible}>
                      {subtype.label}
                      {subtype.accepts ? ` (needs ${subtype.accepts})` : ''}
                      {subtype.produces ? ` → gives ${subtype.produces}` : ''}
                      {incompatible ? ` — board currently gives ${chainTailType}` : ''}
                    </option>
                  );
                })}
              </select>
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
