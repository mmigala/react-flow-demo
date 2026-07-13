# Execution Plan – React Flow Workflow Builder Demo

## Goal
Small demo app (Vite + React + TypeScript) showing:
1. A CRUD list page of "workflows" (mocked in localStorage, no backend).
2. A builder page using [@xyflow/react](https://reactflow.dev/) (the current React Flow package) to visually build a workflow.
3. Enforced node model: `trigger` → `input` → `action` (0..n) → `output`, only `action` allowed multiple times, others required exactly once.
4. Add/delete nodes via a toolbar palette (buttons disable once a singleton node type is placed).
5. Rename nodes via a small inline edit (double-click a node → edit its label).
6. Save validates the structure (all required types present, edges form the single allowed order) before persisting.

## Stack
- Vite + React + TypeScript (fast scaffold, minimal boilerplate)
- `@xyflow/react` for the flow canvas
- `react-router-dom` for 2 routes: `/` (list) and `/builder/:id` (new/edit)
- No backend: `localStorage` used as the "database", wrapped in a tiny storage module so it reads like a mocked API.
- No test framework added (explicitly out of scope per request).

## Data Model
```ts
type NodeKind = 'trigger' | 'input' | 'action' | 'output';

interface WorkflowNodeData {
  label: string;
  kind: NodeKind;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: Node<WorkflowNodeData>[]; // React Flow nodes
  edges: Edge[];
  updatedAt: string;
}
```

## Pages
### 1. Workflow List Page (`/`)
- Simple HTML table: Name, Node count, Updated date, Edit / Delete actions.
- "New Workflow" button → navigates to `/builder/new`.
- Delete → confirm → remove from localStorage.
- Edit → navigate to `/builder/:id`.

### 2. Workflow Builder Page (`/builder/:id`)
- Toolbar palette: buttons "Add Trigger", "Add Input", "Add Action", "Add Output".
  - Trigger/Input/Output buttons become disabled once one exists (singleton enforcement).
  - Action button always enabled (multiple allowed).
- Canvas: `ReactFlow` with custom node renderer color-coded per kind, showing kind badge + label.
- Legend banner: "Required order: Trigger → Input → Action(s) → Output. Trigger, Input and Output are required exactly once; Actions are optional and repeatable."
- Connections restricted via `isValidConnection`: only edges matching the allowed order graph are accepted (trigger→input, input→action/output, action→action/output).
- Delete node: select node + press Delete/Backspace, or use the node's own "×" button.
- Rename node: double-click node → inline text input to edit label.
- Save button: validates exactly-one trigger/input/output exist and that a connected path trigger→input→(actions)→output exists; shows inline error banner if invalid; otherwise persists to localStorage and navigates back to list.
- Cancel/back button to return to list without saving.

## Validation Rules (kept intentionally simple)
1. Count check: exactly 1 trigger, exactly 1 input, exactly 1 output; ≥0 actions.
2. Edge check: every node must be part of one connected chain starting at trigger and ending at output, in kind order trigger→input→action*→output (actions chain linearly if more than one).
3. On violation: show a red banner listing what's missing/wrong; block save.

## File Structure
```
reactflow demo/
  PLAN.md
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    types.ts
    storage.ts               (localStorage mock "API")
    pages/
      WorkflowListPage.tsx
      WorkflowBuilderPage.tsx
    flow/
      FlowNode.tsx            (custom node component)
      nodeRules.ts            (allowed kind transitions + validation fn)
```

## Out of Scope (per request)
- No automated tests.
- No backend/API/persistence beyond localStorage.
- No advanced styling/design polish, drag-and-drop palette, undo/redo, etc.

## Steps
1. Scaffold Vite React-TS project in this folder.
2. Install `@xyflow/react` and `react-router-dom`.
3. Add types + localStorage-backed storage module with seed/mock data.
4. Build List page (CRUD table).
5. Build Builder page with custom nodes, palette, validation, save/cancel.
6. Wire up routing in `App.tsx`.
7. Run dev server to smoke-test the flow end to end.
