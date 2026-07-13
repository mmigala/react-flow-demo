import type { WorkflowDefinition } from './types';

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
      name: 'New user onboarding',
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'trigger-1', type: 'flowNode', position: { x: 0, y: 100 }, data: { label: 'User signed up', kind: 'trigger' } },
        { id: 'input-1', type: 'flowNode', position: { x: 220, y: 100 }, data: { label: 'Read user profile', kind: 'input' } },
        { id: 'action-1', type: 'flowNode', position: { x: 440, y: 100 }, data: { label: 'Send welcome email', kind: 'action' } },
        { id: 'output-1', type: 'flowNode', position: { x: 660, y: 100 }, data: { label: 'Mark onboarding complete', kind: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'input-1' },
        { id: 'e2', source: 'input-1', target: 'action-1' },
        { id: 'e3', source: 'action-1', target: 'output-1' },
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
