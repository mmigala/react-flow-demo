import { getEnableReadiness } from './flow/nodeRules';
import type { WorkflowDefinition, WorkflowStatus } from './types';

// Mocked "backend" - everything lives in localStorage so the demo works FE-only.
const STORAGE_KEY = 'reactflow-demo.workflows';

function readAll(): WorkflowDefinition[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedAndPersist();
  try {
    return JSON.parse(raw) as WorkflowDefinition[];
  } catch {
    return seedAndPersist();
  }
}

function writeAll(workflows: WorkflowDefinition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
}

function seedAndPersist(): WorkflowDefinition[] {
  const seed: WorkflowDefinition[] = [
    {
      id: 'sample-1',
      name: 'Scheduled auto-tagging',
      status: 'disabled',
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'trigger-1', type: 'flowNode', position: { x: 0, y: 0 }, data: { label: 'Scheduler', kind: 'trigger', subtypeId: 'Scheduler' } },
        { id: 'input-1', type: 'flowNode', position: { x: 0, y: 150 }, data: { label: 'SaaS Core Pool Input', kind: 'input', subtypeId: 'SaasCorePoolInput' } },
        { id: 'action-1', type: 'flowNode', position: { x: 0, y: 300 }, data: { label: 'Auto Tagging', kind: 'action', subtypeId: 'AutoTaggingAction' } },
        { id: 'action-2', type: 'flowNode', position: { x: 0, y: 450 }, data: { label: 'Metadata Edit', kind: 'action', subtypeId: 'MetadataEdit' } },
        { id: 'output-1', type: 'flowNode', position: { x: 0, y: 600 }, data: { label: 'SaaS Core Pool Output', kind: 'output', subtypeId: 'SaasCorePoolOutput' } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'input-1' },
        { id: 'e2', source: 'input-1', target: 'action-1' },
        { id: 'e3', source: 'action-1', target: 'action-2' },
        { id: 'e4', source: 'action-2', target: 'output-1' },
      ],
    },
  ];
  writeAll(seed);
  return seed;
}

export function listWorkflows(): WorkflowDefinition[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return readAll().find((w) => w.id === id);
}

export function saveWorkflow(workflow: WorkflowDefinition): void {
  const all = readAll();
  const idx = all.findIndex((w) => w.id === workflow.id);
  const updated = { ...workflow, updatedAt: new Date().toISOString() };
  if (idx === -1) {
    all.push(updated);
  } else {
    all[idx] = updated;
  }
  writeAll(all);
}

export function deleteWorkflow(id: string): void {
  writeAll(readAll().filter((w) => w.id !== id));
}

/**
 * Flips a workflow's status. Enabling is rejected (with the missing checklist items) unless
 * it has at least one Trigger/Input/Action/Output all connected together; disabling is always allowed.
 */
export function setWorkflowStatus(id: string, status: WorkflowStatus): { ok: boolean; errors: string[] } {
  const all = readAll();
  const workflow = all.find((w) => w.id === id);
  if (!workflow) return { ok: false, errors: ['Workflow not found.'] };

  if (status === 'enabled') {
    const readiness = getEnableReadiness(workflow.nodes);
    if (!readiness.ready) {
      const missingChecks = readiness.checks.filter((c) => !c.done).map((c) => `Missing: ${c.label}`);
      const issueMessages = readiness.issues.map((issue) => issue.message);
      return { ok: false, errors: [...missingChecks, ...issueMessages] };
    }
  }

  saveWorkflow({ ...workflow, status });
  return { ok: true, errors: [] };
}
