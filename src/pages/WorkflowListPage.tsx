import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteWorkflow, listWorkflows, setWorkflowStatus } from '../storage';
import { getEnableReadiness } from '../flow/nodeRules';
import type { WorkflowDefinition } from '../types';

export function WorkflowListPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);

  useEffect(() => {
    setWorkflows(listWorkflows());
  }, []);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    deleteWorkflow(id);
    setWorkflows(listWorkflows());
  };

  const handleToggleStatus = (id: string, status: 'enabled' | 'disabled') => {
    setWorkflowStatus(id, status);
    setWorkflows(listWorkflows());
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Build Workflows</h1>
        <button className="btn btn-primary" onClick={() => navigate('/builder/new')}>
          + New Workflow
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th># Nodes</th>
            <th>Status</th>
            <th>Last updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {workflows.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                No workflows yet. Create one to get started.
              </td>
            </tr>
          )}
          {workflows.map((w) => {
            const readiness = getEnableReadiness(w.nodes);
            return (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{w.nodes.length}</td>
                <td>
                  <span className={`status-badge status-${w.status}`}>{w.status}</span>
                </td>
                <td>{new Date(w.updatedAt).toLocaleString()}</td>
                <td className="row-actions">
                  {w.status === 'disabled' ? (
                    <>
                      <button className="btn" onClick={() => navigate(`/builder/${w.id}`)}>
                        Edit
                      </button>
                      <button
                        className="btn"
                        disabled={!readiness.ready}
                        title={
                          readiness.ready
                            ? 'Enable this workflow'
                            : `Cannot enable yet - missing: ${readiness.checks
                                .filter((c) => !c.done)
                                .map((c) => c.label)
                                .join('; ')}`
                        }
                        onClick={() => handleToggleStatus(w.id, 'enabled')}
                      >
                        Enable
                      </button>
                    </>
                  ) : (
                    <button className="btn" title="Disable to make it editable again" onClick={() => handleToggleStatus(w.id, 'disabled')}>
                      Disable
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={() => handleDelete(w.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
