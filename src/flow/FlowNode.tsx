import { useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { KIND_META } from './nodeRules';
import { DATA_TYPE_COLORS, getSubtype } from './nodeCatalog';
import type { WorkflowNode } from '../types';

export function FlowNode({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { setNodes, deleteElements } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const meta = KIND_META[data.kind];
  const subtype = getSubtype(data.subtypeId);

  const commitRename = () => {
    const nextLabel = draft.trim() || data.label;
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: nextLabel } } : n)));
    setEditing(false);
  };

  return (
    <div
      className="flow-node"
      style={{ borderColor: meta.color, boxShadow: selected ? `0 0 0 2px ${meta.color}` : undefined }}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
    >
      {subtype.accepts && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: DATA_TYPE_COLORS[subtype.accepts] }}
          title={`Needs: ${subtype.accepts}`}
        />
      )}

      <div className="flow-node-badge" style={{ background: meta.color }}>
        {meta.label}
      </div>

      {editing ? (
        <input
          className="flow-node-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(data.label);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div className="flow-node-label">{data.label}</div>
      )}

      <div className="flow-node-types">
        {subtype.accepts && (
          <span className="type-chip" style={{ background: DATA_TYPE_COLORS[subtype.accepts] }}>
            needs {subtype.accepts}
          </span>
        )}
        {subtype.produces && (
          <span className="type-chip" style={{ background: DATA_TYPE_COLORS[subtype.produces] }}>
            gives {subtype.produces}
          </span>
        )}
      </div>

      <button
        className="flow-node-delete"
        title="Delete node"
        onClick={() => deleteElements({ nodes: [{ id }] })}
      >
        ×
      </button>

      {subtype.produces && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: DATA_TYPE_COLORS[subtype.produces] }}
          title={`Produces: ${subtype.produces}`}
        />
      )}
    </div>
  );
}
