import { NODE_CATALOG } from '../flow/nodeCatalog';

/** What the model returns: node subtype ids in order, plus edges referencing those indices. */
export interface GeneratedWorkflow {
  nodes: { subtypeId: string }[];
  edges: { source: number; target: number }[];
}

const MODEL = 'gemini-3.1-flash-lite';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nodes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          subtypeId: { type: 'STRING', enum: NODE_CATALOG.map((s) => s.id) },
        },
        required: ['subtypeId'],
      },
    },
    edges: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          source: { type: 'INTEGER' },
          target: { type: 'INTEGER' },
        },
        required: ['source', 'target'],
      },
    },
  },
  required: ['nodes', 'edges'],
};

function buildSystemInstruction(): string {
  const catalogText = NODE_CATALOG.map(
    (s) => `- id: "${s.id}", kind: ${s.kind}, label: "${s.label}" - ${s.description} Can coexist with: [${s.allowedSubtypes.join(', ')}].`,
  ).join('\n');

  return `You design workflows for a visual workflow builder app. A workflow is a set of nodes (each a specific subtype) connected by edges.

Available node subtypes:
${catalogText}

Rules you MUST follow when designing a workflow:
1. Every workflow needs at least one Trigger subtype and one Input subtype ("Container Group New Asset Upload" counts as both by itself).
2. Edges may only connect: Trigger -> Input, Input -> Action, Input -> Output, Action -> Action, Action -> Output. Never connect backwards or skip in a way that violates this order.
3. Every node must end up connected (directly or transitively) to every other node - no isolated nodes.
4. Never include the same subtype id more than once.
5. Only include subtypes together if each one's "Can coexist with" list includes every other subtype id you're using.
6. Reference nodes in "edges" by their 0-based index in the "nodes" array you return.
7. Keep the workflow as small and focused as possible while satisfying the user's request - don't add unrelated nodes.

Given the user's prompt, return only the JSON described by the response schema - no explanation text.`;
}

/**
 * Asks Gemini to design a workflow (as node subtype ids + edges) for the given natural-language
 * prompt. Whatever comes back is NOT trusted blindly - the caller places it on the canvas and the
 * app's existing readiness panel (getEnableReadiness) will surface any rule violations exactly
 * like it does for anything a human places manually.
 */
export async function generateWorkflowFromPrompt(prompt: string): Promise<GeneratedWorkflow> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Copy .env.example to .env and set VITE_GEMINI_API_KEY, then restart the dev server.');
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // This is a simple structured-extraction task, not something that benefits from extended
        // reasoning - disabling "thinking" cuts latency (and cost) substantially.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  let parsed: GeneratedWorkflow;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned a response that could not be parsed as JSON.');
  }

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Gemini returned an unexpected shape (missing nodes/edges array).');
  }

  return parsed;
}
