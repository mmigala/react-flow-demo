# Workflow Builder Demo (React Flow)

A minimal front-end-only demo showcasing [`@xyflow/react`](https://reactflow.dev/) (React Flow) for
building a visual, rule-constrained workflow editor. No backend - everything is mocked in
`localStorage`. Built with Vite + React + TypeScript.

## Business Requirements

This section reflects the current, agreed set of product requirements. It is kept up to date as new
requirements are provided - see "Keeping this section up to date" below.

### 1. Workflow list (CRUD)
- Users land on a table listing all workflows they've created.
- From the list they can create a new workflow, edit an existing one, or delete one.
- Creating or editing a workflow navigates to a dedicated builder page.

### 2. Workflow builder
- A visual, node-based editor (React Flow canvas) for building a single workflow.

### 3. Node types and ordering rules
- Four node kinds: **Trigger**, **Input**, **Action**, **Output**.
- Trigger, Input and Output are required exactly once to save a workflow as *ready*; only Action
  nodes may appear multiple times.
- The only valid order is **Trigger → Input → Action(s) → Output**; no other connection order is
  allowed.
- The UI must make this ordering and the required node types obvious to the user (legend, a live
  "ready to enable" checklist, and disabled/greyed-out options where a choice would be invalid).
- Users can add and delete nodes freely.
- Each node can be renamed (double-click a node to edit its label inline).

### 4. Typed node subtypes (data-type compatibility)
- Beyond the four kinds, each kind has multiple concrete **subtypes** (e.g. Trigger: "Order Placed",
  "Payment Received"; Input: "Load Order Details", "Load Customer Profile"; etc.), modeled on a
  simple real-world example: an e-commerce order-processing flow.
- Each subtype declares the data type it **needs** (accepts) and/or **gives** (produces) - e.g.
  `Order`, `Customer`, `Payment`, `Notification`.
- Two nodes may only be connected if, in addition to satisfying the kind ordering, the upstream
  node's produced data type matches the downstream node's required data type (like matching plug
  shapes).
- Users must not be able to pick a node subtype that is incompatible with what's already on the
  board - incompatible options are greyed out in the add-node pickers, not just rejected after the
  fact.
- The palette scales to many subtypes per kind without cluttering the UI (one dropdown per kind,
  rather than one button per subtype).
- Connections can be removed (a delete "×" appears directly on a connection line).

### 5. Workflow status: Enabled / Disabled
- Every workflow has a status: **Enabled** or **Disabled** (new workflows start Disabled).
- An **Enabled** workflow cannot be edited - it must be **Disabled** again first.
- While **Disabled**, a workflow can be edited freely, even into an incomplete/invalid state (saving
  a draft never blocks on validity).
- A workflow can only be switched to **Enabled** once it contains at least one Trigger, one Input,
  one Action and one Output, all connected together in the required order.
- The UI must make it obvious what's still missing to enable a workflow (a live readiness checklist
  in the builder, and a disabled "Enable" button with an explanatory tooltip in the list view).

### 6. Layout
- The builder canvas lays workflows out **vertically** (Trigger at the top, Output at the bottom),
  not horizontally.

### Non-functional constraints
- Minimal code - no unnecessary UI polish; this is a showcase of React Flow and the above logic, not
  a production app.
- 100% front-end; no backend/API. Data is mocked/stubbed via `localStorage`.
- No automated tests (explicitly out of scope for this demo).

### Keeping this section up to date
When new business requirements are provided for this project, update the **Business Requirements**
section above to reflect them (add/adjust the relevant bullet points) as part of implementing the
change.

## Tech stack
- [Vite](https://vite.dev/) + React + TypeScript
- [`@xyflow/react`](https://reactflow.dev/) for the flow canvas
- [`react-router-dom`](https://reactrouter.com/) for the two routes (`/` list, `/builder/:id` builder)
- `localStorage` as the mocked backend (see `src/storage.ts`)

## Project structure
```
src/
  main.tsx, App.tsx        - app entry point and routing
  types.ts                 - shared TypeScript types (WorkflowDefinition, WorkflowNodeData, ...)
  storage.ts                - localStorage-backed mock "API" (CRUD + status toggling)
  pages/
    WorkflowListPage.tsx    - the CRUD list page
    WorkflowBuilderPage.tsx - the React Flow builder page
  flow/
    FlowNode.tsx            - custom node renderer (rename, delete, type badges/handles)
    DeletableEdge.tsx        - custom edge with a delete button
    nodeCatalog.ts           - node subtype catalog (kinds, data types, needs/gives)
    nodeRules.ts             - ordering/compatibility rules, validation, readiness checklist
```

## Getting started
```powershell
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```
