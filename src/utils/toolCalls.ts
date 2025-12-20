import { ReferenceOp } from '@/types';

type ToolCallsObject = { reference_ops?: ReferenceOp[] };

export function normalizeToolCalls(input: unknown): ReferenceOp[] {
  if (Array.isArray(input)) {
    return input as ReferenceOp[];
  }

  if (input && typeof input === 'object') {
    const referenceOps = (input as ToolCallsObject).reference_ops;
    if (Array.isArray(referenceOps)) {
      return referenceOps;
    }
  }

  return [];
}
