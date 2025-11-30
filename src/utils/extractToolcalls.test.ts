import { describe, it, expect } from 'vitest';
import { extractToolcallsAndStrip } from './extractToolcalls';

describe('extractToolcallsAndStrip', () => {
  describe('properly closed code blocks', () => {
    it('should extract toolcalls from properly formatted code block', () => {
      const input = `This is the translation text.

\`\`\`toolcalls
{"reference_ops": [{"type": "reference.add", "title": "John", "content": "A character"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('This is the translation text.');
      expect(result.toolcalls).toHaveLength(1);
      expect(result.toolcalls[0]).toEqual({
        type: 'reference.add',
        title: 'John',
        content: 'A character',
      });
    });

    it('should handle case-insensitive toolcalls marker', () => {
      const input = `Translation here.

\`\`\`TOOLCALLS
{"reference_ops": [{"type": "reference.update", "id": "123", "content": "Updated"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation here.');
      expect(result.toolcalls).toHaveLength(1);
      expect(result.toolcalls[0].type).toBe('reference.update');
    });

    it('should return empty toolcalls when no code block exists', () => {
      const input = 'Just a simple translation without any toolcalls.';

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe(input);
      expect(result.toolcalls).toEqual([]);
    });

    it('should handle multiple reference ops', () => {
      const input = `Translation text.

\`\`\`toolcalls
{"reference_ops": [
  {"type": "reference.add", "title": "Character A", "content": "Description A"},
  {"type": "reference.add", "title": "Character B", "content": "Description B"},
  {"type": "reference.update", "id": "existing-id", "content": "Updated content"}
]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation text.');
      expect(result.toolcalls).toHaveLength(3);
    });
  });

  describe('unclosed code blocks (Heuristic 1)', () => {
    it('should handle unclosed code block at end of text', () => {
      const input = `This is the translation.

\`\`\`toolcalls
{"reference_ops": [{"type": "reference.add", "title": "Test", "content": "Content"}]}`;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('This is the translation.');
      expect(result.toolcalls).toHaveLength(1);
      expect(result.toolcalls[0].title).toBe('Test');
    });

    it('should handle unclosed code block with trailing backticks', () => {
      const input = `Translation here.

\`\`\`toolcalls
{"reference_ops": [{"type": "reference.add", "title": "Name", "content": "Info"}]}
\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation here.');
      expect(result.toolcalls).toHaveLength(1);
    });

    it('should handle unclosed code block with single trailing backtick', () => {
      const input = `Translation.

\`\`\`toolcalls
{"reference_ops": [{"type": "reference.add", "title": "X", "content": "Y"}]}
\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation.');
      expect(result.toolcalls).toHaveLength(1);
    });

    it('should extract JSON even with extra content after', () => {
      const input = `Translation text.

\`\`\`toolcalls
{"reference_ops": [{"type": "reference.add", "title": "A", "content": "B"}]}
Some extra text that got added`;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation text.');
      expect(result.toolcalls).toHaveLength(1);
    });
  });

  describe('alternative naming (Heuristic 2)', () => {
    it('should handle tool_calls with underscore', () => {
      const input = `The translation.

\`\`\`tool_calls
{"reference_ops": [{"type": "reference.add", "title": "Test", "content": "Data"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('The translation.');
      expect(result.toolcalls).toHaveLength(1);
    });

    it('should handle tool-calls with hyphen', () => {
      const input = `Another translation.

\`\`\`tool-calls
{"reference_ops": [{"type": "reference.add", "title": "Char", "content": "Desc"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Another translation.');
      expect(result.toolcalls).toHaveLength(1);
    });

    it('should handle toolcall singular', () => {
      const input = `Text here.

\`\`\`toolcall
{"reference_ops": [{"type": "reference.add", "title": "Single", "content": "Entry"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Text here.');
      expect(result.toolcalls).toHaveLength(1);
    });

    it('should handle space after backticks', () => {
      const input = `Translation content.

\`\`\` toolcalls
{"reference_ops": [{"type": "reference.add", "title": "Spaced", "content": "Value"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation content.');
      expect(result.toolcalls).toHaveLength(1);
    });
  });

  describe('bare JSON at end (Heuristic 3)', () => {
    it('should extract bare JSON object at end of translation', () => {
      const input = `This is a translation that ends with JSON.

{"reference_ops": [{"type": "reference.add", "title": "NoFence", "content": "Data"}]}`;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('This is a translation that ends with JSON.');
      expect(result.toolcalls).toHaveLength(1);
      expect(result.toolcalls[0].title).toBe('NoFence');
    });

    it('should handle bare JSON with extra whitespace', () => {
      const input = `Translation text here.

  {"reference_ops": [{"type": "reference.add", "title": "Whitespace", "content": "Test"}]}  `;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation text here.');
      expect(result.toolcalls).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should return original text for invalid JSON in code block', () => {
      const input = `Translation.

\`\`\`toolcalls
{invalid json here}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      // Should strip the block but have empty toolcalls due to parse failure
      expect(result.translation).toBe('Translation.');
      expect(result.toolcalls).toEqual([]);
    });

    it('should handle empty reference_ops array', () => {
      const input = `Translation.

\`\`\`toolcalls
{"reference_ops": []}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation.');
      expect(result.toolcalls).toEqual([]);
    });

    it('should normalize direct array input (not wrapped in reference_ops)', () => {
      const input = `Translation.

\`\`\`toolcalls
[{"type": "reference.add", "title": "Direct", "content": "Array"}]
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toBe('Translation.');
      expect(result.toolcalls).toHaveLength(1);
      expect(result.toolcalls[0].title).toBe('Direct');
    });

    it('should preserve multiline translation text', () => {
      const input = `# Chapter 1

This is paragraph one.

This is paragraph two.

\`\`\`toolcalls
{"reference_ops": [{"type": "reference.add", "title": "Multi", "content": "Line"}]}
\`\`\``;

      const result = extractToolcallsAndStrip(input);

      expect(result.translation).toContain('# Chapter 1');
      expect(result.translation).toContain('This is paragraph one.');
      expect(result.translation).toContain('This is paragraph two.');
      expect(result.toolcalls).toHaveLength(1);
    });
  });
});
