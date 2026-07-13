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
- Four node kinds: **Trigger**, **Input**, **Action**, **Output** (mirrors `NodeTypeId` in the real
  Fotoware Flow backend: `Fotoware.Flow.Domain.Configuration.NodeType.cs`).
- The only valid connection order on the canvas is **Trigger → Input → Action(s) → Output**; no
  other connection order is allowed. **Note:** the real backend doesn't have this ordering concept
  yet, nor does it require nodes to be connected at all - it validates a flat set of subtypes (see
  `FlowStructureValidator.cs`). This layer is kept in the POC anyway as forward-looking behavior -
  it's how flows are meant to visually work once the backend gains real ordering support - but it's
  a canvas-only feature and does **not** gate whether a workflow can be enabled (see section 4b).
- The UI must make this ordering obvious to the user (legend, live green/dim highlighting while
  dragging a connection).
- Users can add and delete nodes freely.
- Each node can be renamed (double-click a node to edit its label inline).

### 4. Real node subtypes and their compatibility rules
- Node subtypes and names are taken directly from the real backend's catalog (`NodeSubTypeId` in
  `Fotoware.Flow.Domain.Configuration.NodeSubType.cs`), e.g. Triggers: *Scheduler*, *Container Group
  New Asset Upload*; Input: *SaaS Core Pool Input*; Actions: *Delete*, *Metadata Edit*, *Auto
  Tagging*, *File Rename*, *File Name to Metadata Extraction*, *API Request*, *Dynamic Variables*,
  *Translation*; Outputs: *SaaS Core Pool Output*, *FTP Output*.
- Compatibility between subtypes mirrors `NodeCompatibilityPolicy.cs` - **not** a producer/consumer
  data-type model. Each subtype declares which other subtypes it may coexist with **anywhere in the
  same flow**; a candidate subtype is valid to add only if it's compatible with *every* subtype
  already present (`GetValidNextNodes`), independent of how (or whether) nodes are connected.
- Duplicate subtypes are never allowed - the same subtype cannot appear twice in one flow (mirrors
  `FlowStructureValidator`'s duplicate check).
- The add-node dropdowns grey out any subtype that's already used or incompatible with what's
  currently on the board, with the reason shown in the option text - this is the backend's own
  stated purpose for `GetValidNextNodes` ("determine which nodes are valid to add next").
- The palette scales to many subtypes per kind without cluttering the UI (one dropdown per kind,
  rather than one button per subtype).
- Connections can be removed (a delete "×" appears directly on a connection line).

### 4b. Structural validation (mirrors `FlowStructureValidator`)
Enabling a workflow is a **direct replica** of the real backend's structural rules - it intentionally
does **not** require nodes to be connected, nor an Action or Output unconditionally (e.g. Scheduler +
SaaS Core Pool Input + Delete is a valid, enable-able flow with no Output node at all, exactly like
the backend, since Output is only required when using an external input):
- A Trigger and an Input node are always required. **Container Group New Asset Upload** is a Trigger
  subtype that also counts as satisfying the Input requirement by itself (same dual role it has in
  the backend), since it's an all-in-one external-asset-upload entry point.
- An Output is required only when using that external input (Container Group New Asset Upload).
- Internal input (SaaS Core Pool Input) and external input (Container Group New Asset Upload)
  cannot be mixed in the same flow.
- At least one Action or Output is required when using the internal input.
- All of the above, plus the duplicate-subtype and pairwise-compatibility checks from section 4,
  surface as a single, open-ended **issues list** in the "Ready to enable?" panel (in addition to
  the fixed Trigger/Input checklist) - each entry names the exact problem, so adding new backend
  rules later only ever adds rows to this list rather than requiring new UI.

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
    FlowNode.tsx            - custom node renderer (rename, delete)
    DeletableEdge.tsx        - custom edge with a delete button
    nodeCatalog.ts           - real subtype catalog + coexistence rules (mirrors NodeCompatibilityPolicy)
    nodeRules.ts             - ordering chain validation + structural rules (mirrors FlowStructureValidator)
```

## Getting started
```powershell
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```
