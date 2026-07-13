import type { NodeKind } from '../types';

/**
 * Mirrors the real Fotoware Flow backend's node catalog (see
 * Fotoware.Flow.Domain.Configuration.NodeSubTypeId / NodeCompatibilityPolicy). Unlike the earlier
 * invented example, compatibility here is NOT "producer/consumer data types flowing through a pipe" -
 * it's whichever *set* of subtypes the backend allows to coexist in the same flow at all, checked
 * across the whole board, exactly like NodeCompatibilityPolicy.GetValidNextNodes.
 */
export interface NodeSubtype {
  id: string;
  kind: NodeKind;
  label: string;
  /** The other subtype ids this one is allowed to coexist with anywhere in the same flow. */
  allowedSubtypes: string[];
}

// Copied directly from Fotoware.Flow.Domain.Configuration.NodeCompatibilityPolicy.AllNodesDefinitions.
export const NODE_CATALOG: NodeSubtype[] = [
  // Triggers
  {
    id: 'Scheduler',
    kind: 'trigger',
    label: 'Scheduler',
    allowedSubtypes: [
      'SaasCorePoolInput',
      'Delete',
      'MetadataEdit',
      'TranslationAction',
      'FtpOutput',
      'AutoTaggingAction',
      'ApiRequestAction',
      'DynamicVariables',
      'SaasCorePoolOutput',
    ],
  },
  {
    id: 'ContainerGroupNewAssetUpload',
    kind: 'trigger',
    label: 'Container Group New Asset Upload',
    allowedSubtypes: ['MetadataEdit', 'SaasCorePoolOutput', 'FileRenameAction', 'FileNameToMetadataExtractionAction'],
  },

  // Inputs
  {
    id: 'SaasCorePoolInput',
    kind: 'input',
    label: 'SaaS Core Pool Input',
    allowedSubtypes: [
      'Scheduler',
      'Delete',
      'MetadataEdit',
      'TranslationAction',
      'FtpOutput',
      'AutoTaggingAction',
      'ApiRequestAction',
      'DynamicVariables',
      'SaasCorePoolOutput',
    ],
  },

  // Actions
  { id: 'Delete', kind: 'action', label: 'Delete', allowedSubtypes: ['SaasCorePoolInput', 'Scheduler'] },
  {
    id: 'MetadataEdit',
    kind: 'action',
    label: 'Metadata Edit',
    allowedSubtypes: [
      'SaasCorePoolInput',
      'ContainerGroupNewAssetUpload',
      'SaasCorePoolOutput',
      'Scheduler',
      'FtpOutput',
      'FileRenameAction',
      'FileNameToMetadataExtractionAction',
      'ApiRequestAction',
      'DynamicVariables',
      'AutoTaggingAction',
      'TranslationAction',
    ],
  },
  {
    id: 'AutoTaggingAction',
    kind: 'action',
    label: 'Auto Tagging',
    allowedSubtypes: ['Scheduler', 'SaasCorePoolInput', 'FtpOutput', 'MetadataEdit', 'TranslationAction', 'SaasCorePoolOutput'],
  },
  {
    id: 'FileRenameAction',
    kind: 'action',
    label: 'File Rename',
    allowedSubtypes: ['ContainerGroupNewAssetUpload', 'SaasCorePoolOutput', 'MetadataEdit', 'FileNameToMetadataExtractionAction'],
  },
  {
    id: 'FileNameToMetadataExtractionAction',
    kind: 'action',
    label: 'File Name to Metadata Extraction',
    allowedSubtypes: ['ContainerGroupNewAssetUpload', 'SaasCorePoolOutput', 'MetadataEdit', 'FileRenameAction'],
  },
  {
    id: 'ApiRequestAction',
    kind: 'action',
    label: 'API Request',
    allowedSubtypes: ['Scheduler', 'SaasCorePoolInput', 'MetadataEdit', 'TranslationAction', 'DynamicVariables', 'SaasCorePoolOutput'],
  },
  {
    id: 'DynamicVariables',
    kind: 'action',
    label: 'Dynamic Variables',
    allowedSubtypes: ['Scheduler', 'SaasCorePoolInput', 'MetadataEdit', 'TranslationAction', 'ApiRequestAction', 'SaasCorePoolOutput'],
  },
  {
    id: 'TranslationAction',
    kind: 'action',
    label: 'Translation',
    allowedSubtypes: [
      'SaasCorePoolInput',
      'SaasCorePoolOutput',
      'Scheduler',
      'FtpOutput',
      'ApiRequestAction',
      'DynamicVariables',
      'AutoTaggingAction',
      'MetadataEdit',
    ],
  },

  // Outputs
  {
    id: 'SaasCorePoolOutput',
    kind: 'output',
    label: 'SaaS Core Pool Output',
    allowedSubtypes: [
      'MetadataEdit',
      'TranslationAction',
      'ContainerGroupNewAssetUpload',
      'FileRenameAction',
      'FileNameToMetadataExtractionAction',
      'Scheduler',
      'SaasCorePoolInput',
      'AutoTaggingAction',
      'ApiRequestAction',
      'DynamicVariables',
    ],
  },
  {
    id: 'FtpOutput',
    kind: 'output',
    label: 'FTP Output',
    allowedSubtypes: ['MetadataEdit', 'TranslationAction', 'Scheduler', 'SaasCorePoolInput', 'AutoTaggingAction'],
  },
];

export function getSubtype(subtypeId: string): NodeSubtype {
  const subtype = NODE_CATALOG.find((s) => s.id === subtypeId);
  if (!subtype) throw new Error(`Unknown node subtype "${subtypeId}"`);
  return subtype;
}

export function subtypesForKind(kind: NodeKind): NodeSubtype[] {
  return NODE_CATALOG.filter((s) => s.kind === kind);
}

/**
 * Mirrors NodeCompatibilityPolicy.GetValidNextNodes: given the subtype ids already present in a
 * flow, returns every subtype id that's allowed to coexist with ALL of them. An empty input means
 * nothing to be incompatible with yet, so every subtype is a valid candidate.
 */
export function getValidNextSubtypeIds(currentSubtypeIds: string[]): string[] {
  if (currentSubtypeIds.length === 0) return NODE_CATALOG.map((s) => s.id);
  return NODE_CATALOG.filter((def) => currentSubtypeIds.every((id) => def.allowedSubtypes.includes(id))).map((def) => def.id);
}

/** Which of the given other subtype ids this subtype is NOT allowed to coexist with (by label), for messaging. */
export function getIncompatibleWith(subtypeId: string, otherSubtypeIds: string[]): string[] {
  const subtype = getSubtype(subtypeId);
  return otherSubtypeIds.filter((id) => id !== subtypeId && !subtype.allowedSubtypes.includes(id)).map((id) => getSubtype(id).label);
}

/**
 * Which subtypes of a given kind would actually work given what's already on the board - i.e. the
 * kind-filtered intersection of `getValidNextSubtypeIds`. This turns "you're missing a Trigger"
 * into a concrete, actionable "add Scheduler" instead of leaving the user to guess which of the
 * catalog's Trigger options would actually be accepted.
 */
export function getSuggestedSubtypesForKind(kind: NodeKind, currentSubtypeIds: string[]): NodeSubtype[] {
  const validIds = new Set(getValidNextSubtypeIds(currentSubtypeIds));
  return subtypesForKind(kind).filter((s) => validIds.has(s.id));
}

/**
 * Which subtypes of a given kind could still be added right now, given what's already on the
 * board - i.e. compatible with everything present AND not already used. Unlike
 * getSuggestedSubtypesForKind (used when a requirement is still unmet), this is for kinds that
 * already have at least one node and asks "is there room for more?" - e.g. Delete is incompatible
 * with every other action, so once it's the only action present, nothing else can be added; Auto
 * Tagging isn't, so other actions remain addable.
 */
export function getAddableSubtypesForKind(kind: NodeKind, currentSubtypeIds: string[]): NodeSubtype[] {
  const validIds = new Set(getValidNextSubtypeIds(currentSubtypeIds));
  return subtypesForKind(kind).filter((s) => validIds.has(s.id) && !currentSubtypeIds.includes(s.id));
}


