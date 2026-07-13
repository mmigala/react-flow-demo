import type { NodeKind } from '../types';

/**
 * The "plug shape" each node socket speaks. A connection is only allowed when
 * the upstream node's `produces` type matches the downstream node's `accepts` type
 * (in addition to respecting the Trigger -> Input -> Action(s) -> Output kind order).
 */
export type DataType = 'Order' | 'Customer' | 'Payment' | 'Notification';

export const DATA_TYPE_COLORS: Record<DataType, string> = {
  Order: '#f59e0b',
  Customer: '#0891b2',
  Payment: '#7c3aed',
  Notification: '#db2777',
};

export interface NodeSubtype {
  id: string;
  kind: NodeKind;
  label: string;
  /** Data type this node needs from the upstream node. Absent for triggers (they start the chain). */
  accepts?: DataType;
  /** Data type this node hands to the downstream node. Absent for outputs (they terminate the chain). */
  produces?: DataType;
}

// A simple, realistic example: an e-commerce order-processing workflow.
// Two sensible chains it supports:
//   Order Placed -> Load Order Details -> Apply Discount -> Charge Card -> Confirm Payment
//   Order Placed -> Load Customer Profile -> Send Email -> Log Notification
export const NODE_CATALOG: NodeSubtype[] = [
  { id: 'order-placed', kind: 'trigger', label: 'Order Placed', produces: 'Order' },
  { id: 'payment-received', kind: 'trigger', label: 'Payment Received', produces: 'Payment' },

  { id: 'load-order', kind: 'input', label: 'Load Order Details', accepts: 'Order', produces: 'Order' },
  { id: 'load-customer', kind: 'input', label: 'Load Customer Profile', accepts: 'Order', produces: 'Customer' },

  { id: 'apply-discount', kind: 'action', label: 'Apply Discount', accepts: 'Order', produces: 'Order' },
  { id: 'charge-card', kind: 'action', label: 'Charge Card', accepts: 'Order', produces: 'Payment' },
  { id: 'send-email', kind: 'action', label: 'Send Email', accepts: 'Customer', produces: 'Notification' },

  { id: 'update-order-status', kind: 'output', label: 'Update Order Status', accepts: 'Order' },
  { id: 'confirm-payment', kind: 'output', label: 'Confirm Payment', accepts: 'Payment' },
  { id: 'log-notification', kind: 'output', label: 'Log Notification', accepts: 'Notification' },
];

export function getSubtype(subtypeId: string): NodeSubtype {
  const subtype = NODE_CATALOG.find((s) => s.id === subtypeId);
  if (!subtype) throw new Error(`Unknown node subtype "${subtypeId}"`);
  return subtype;
}

export function subtypesForKind(kind: NodeKind): NodeSubtype[] {
  return NODE_CATALOG.filter((s) => s.kind === kind);
}
