import { ReferenceOp } from '@/types';
import { normalizeToolCalls } from './toolCalls';

/**
 * Extract toolcalls from translation text with heuristics for malformed blocks.
 * Handles various edge cases where the model doesn't properly close code blocks.
 */
export function extractToolcallsAndStrip(translation: string): {
  translation: string;
  toolcalls: ReferenceOp[];
} {
  // Try properly closed code block first
  const fenceRegex = /```toolcalls\s*([\s\S]*?)```/i;
  const match = translation.match(fenceRegex);
  if (match) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      parsed = null;
    }
    const stripped = translation.replace(fenceRegex, '').trim();
    return { translation: stripped, toolcalls: normalizeToolCalls(parsed) };
  }

  // Heuristic 1: Handle unclosed code block (```toolcalls without closing ```)
  // This captures everything after the opening fence to the end of the string
  const unclosedFenceRegex = /```toolcalls\s*([\s\S]*)$/i;
  const unclosedMatch = translation.match(unclosedFenceRegex);
  if (unclosedMatch) {
    let content = unclosedMatch[1].trim();
    // Remove trailing ` characters that might be partial closing fences
    content = content.replace(/`+\s*$/, '').trim();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON object even if there's extra content
      const jsonMatch = content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          parsed = null;
        }
      }
    }
    const stripped = translation.replace(unclosedFenceRegex, '').trim();
    return { translation: stripped, toolcalls: normalizeToolCalls(parsed) };
  }

  // Heuristic 2: Handle variations like ```tool_calls or ``` toolcalls (with space)
  const altFenceRegex = /```\s*tool[-_]?calls?\s*([\s\S]*?)(?:```|$)/i;
  const altMatch = translation.match(altFenceRegex);
  if (altMatch) {
    let content = altMatch[1].trim();
    content = content.replace(/`+\s*$/, '').trim();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          parsed = null;
        }
      }
    }
    const stripped = translation.replace(altFenceRegex, '').trim();
    return { translation: stripped, toolcalls: normalizeToolCalls(parsed) };
  }

  // Heuristic 3: Look for {"reference_ops": pattern at end of translation without any fence
  const jsonAtEndRegex = /\n\s*(\{"reference_ops"\s*:\s*\[[\s\S]*?\]\s*\})\s*$/;
  const jsonAtEndMatch = translation.match(jsonAtEndRegex);
  if (jsonAtEndMatch) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(jsonAtEndMatch[1]);
    } catch {
      parsed = null;
    }
    if (parsed) {
      const stripped = translation.replace(jsonAtEndRegex, '').trim();
      return { translation: stripped, toolcalls: normalizeToolCalls(parsed) };
    }
  }

  return { translation, toolcalls: [] };
}
