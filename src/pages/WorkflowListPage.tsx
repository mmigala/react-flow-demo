import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteWorkflow, listWorkflows } from '../storage';
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
            <th>Last updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {workflows.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-cell">
                No workflows yet. Create one to get started.
              </td>
            </tr>
          )}
          {workflows.map((w) => (
            <tr key={w.id}>
              <td>{w.name}</td>
              <td>{w.nodes.length}</td>
              <td>{new Date(w.updatedAt).toLocaleString()}</td>
              <td className="row-actions">
                <button className="btn" onClick={() => navigate(`/builder/${w.id}`)}>
                  Edit
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(w.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
