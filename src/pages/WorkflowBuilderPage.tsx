import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { KIND_META, SINGLETON_KINDS, getEnableReadiness, isConnectionAllowed } from '../flow/nodeRules';
import { getIncompatibleWith, getSubtype, getValidNextSubtypeIds, subtypesForKind, type NodeSubtype } from '../flow/nodeCatalog';
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
  const [infoOpenKind, setInfoOpenKind] = useState<NodeKind | null>(null);
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);
  const readiness = useMemo(() => getEnableReadiness(nodes, edges), [nodes, edges]);
  // Which subtype ids are currently allowed to be added next, mirroring
  // NodeCompatibilityPolicy.GetValidNextNodes - used to keep incompatible catalog options out of
  // the dropdowns (this rule is about co-existing anywhere in the flow, not connection order).
  const existingSubtypeIds = useMemo(() => nodes.map((n) => n.data.subtypeId), [nodes]);
  const validNextSubtypeIds = useMemo(() => getValidNextSubtypeIds(existingSubtypeIds), [existingSubtypeIds]);

  // Close the "about this node type" popover when clicking anywhere outside it.
  useEffect(() => {
    if (!infoOpenKind) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (infoPopoverRef.current && !infoPopoverRef.current.contains(e.target as Node)) {
        setInfoOpenKind(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [infoOpenKind]);


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
  // legally attach to (matching the required kind order) so the correct target is obvious.
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
      position: { x: 80 + Math.floor(count / 6) * 240, y: 60 + (count % 6) * 150 },
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
      const missingChecks = readiness.checks.filter((c) => !c.done).map((c) => `Missing: ${c.label}`);
      const issueMessages = readiness.issues.map((issue) => issue.message);
      setErrors([...missingChecks, ...issueMessages]);
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
        <strong>Ready to enable?</strong>{' '}
        {nodes.length === 0 ? (
          <>Add a Trigger, Input, Action or Output below to get started - we'll guide you through what's still needed as you go.</>
        ) : (
          <>
            These are always required, plus a few situational rules that appear below when they apply (e.g. an
            Output is only needed for certain kinds of input):
            <ul>
              {readiness.checks.map((check) => (
                <li key={check.label} className={check.done ? 'check-ok' : 'check-missing'}>
                  {check.done ? '✓' : '✗'} {check.label}
                  {!check.done && check.suggestions && (
                    <span className="suggestions">
                      {check.suggestions.length > 0 ? (
                        <>
                          {' '}
                          Try:{' '}
                          {check.suggestions.map((subtype) => (
                            <button key={subtype.id} className="suggestion-btn" onClick={() => addNode(subtype)}>
                              + {subtype.label}
                            </button>
                          ))}
                        </>
                      ) : (
                        ' - nothing on the board right now can satisfy this; remove a node to continue.'
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {readiness.issues.length > 0 && (
              <>
                <strong>Other issues to resolve:</strong>
                <ul>
                  {readiness.issues.map((issue) => (
                    <li key={issue.nodeId + issue.message} className="check-missing">
                      ⚠ {issue.message}
                      {issue.suggestions && issue.suggestions.length > 0 && (
                        <span className="suggestions">
                          {' '}
                          Try:{' '}
                          {issue.suggestions.map((subtype) => (
                            <button key={subtype.id} className="suggestion-btn" onClick={() => addNode(subtype)}>
                              + {subtype.label}
                            </button>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {readiness.notes.length > 0 && (
              <ul>
                {readiness.notes.map((note) => (
                  <li key={note.message} className="check-note">
                    💡 {note.message}
                    {note.suggestions && note.suggestions.length > 0 && (
                      <span className="suggestions">
                        {' '}
                        Try:{' '}
                        {note.suggestions.map((subtype) => (
                          <button key={subtype.id} className="suggestion-btn" onClick={() => addNode(subtype)}>
                            + {subtype.label}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="legend">
        Canvas order: <strong>Trigger → Input → Action(s) → Output</strong>. All nodes must be connected together to
        enable the workflow, in addition to a Trigger and an Input always being required. Trigger, Input and Output
        can each only be used once, but you can add as many Actions as you like. Some node types can't be combined
        with certain others - the dropdowns below grey out anything that wouldn't work with what's already on the
        board. Double-click a node to rename it, drag from a bottom (output) handle to a top (input) handle to
        connect - compatible targets light up green while you drag - use a node's × button to delete it, and click
        the × on a connection line to disconnect it.
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
              <button
                type="button"
                className="kind-info-btn"
                aria-label={`About ${KIND_META[kind].label} node types`}
                onClick={() => setInfoOpenKind((current) => (current === kind ? null : kind))}
              >
                ⓘ
              </button>
              {infoOpenKind === kind && (
                <div className="kind-info-popover" ref={infoPopoverRef}>
                  <strong>{KIND_META[kind].label} types</strong>
                  <ul>
                    {subtypesForKind(kind).map((subtype) => (
                      <li key={subtype.id}>
                        <div className="kind-info-item-label">{subtype.label}</div>
                        <div className="kind-info-item-desc">{subtype.description}</div>
                        <a className="kind-info-docs-link" href="#" onClick={(e) => e.preventDefault()}>
                          Docs ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                  const alreadyUsed = existingSubtypeIds.includes(subtype.id);
                  const incompatible = !alreadyUsed && !validNextSubtypeIds.includes(subtype.id);
                  const disabled = alreadyUsed || incompatible;
                  const reason = alreadyUsed
                    ? 'already added'
                    : incompatible
                      ? `incompatible with: ${getIncompatibleWith(subtype.id, existingSubtypeIds).join(', ')}`
                      : '';
                  return (
                    <option key={subtype.id} value={subtype.id} disabled={disabled}>
                      {subtype.label}
                      {disabled ? ` — ${reason}` : ''}
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
