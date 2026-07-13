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
      name: 'Order to payment',
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'trigger-1', type: 'flowNode', position: { x: 0, y: 100 }, data: { label: 'Order Placed', kind: 'trigger', subtypeId: 'order-placed' } },
        { id: 'input-1', type: 'flowNode', position: { x: 260, y: 100 }, data: { label: 'Load Order Details', kind: 'input', subtypeId: 'load-order' } },
        { id: 'action-1', type: 'flowNode', position: { x: 520, y: 100 }, data: { label: 'Apply Discount', kind: 'action', subtypeId: 'apply-discount' } },
        { id: 'action-2', type: 'flowNode', position: { x: 780, y: 100 }, data: { label: 'Charge Card', kind: 'action', subtypeId: 'charge-card' } },
        { id: 'output-1', type: 'flowNode', position: { x: 1040, y: 100 }, data: { label: 'Confirm Payment', kind: 'output', subtypeId: 'confirm-payment' } },
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
