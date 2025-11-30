import { describe, it, expect } from 'vitest';
import { normalizeToolCalls } from './toolCalls';

describe('normalizeToolCalls', () => {
  describe('object with reference_ops', () => {
    it('should extract reference_ops from object', () => {
      const input = {
        reference_ops: [
          { type: 'reference.add', title: 'Test', content: 'Content' },
        ],
      };

      const result = normalizeToolCalls(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'reference.add',
        title: 'Test',
        content: 'Content',
      });
    });

    it('should handle empty reference_ops array', () => {
      const input = { reference_ops: [] };

      const result = normalizeToolCalls(input);

      expect(result).toEqual([]);
    });

    it('should handle multiple operations', () => {
      const input = {
        reference_ops: [
          { type: 'reference.add', title: 'First', content: 'Content 1' },
          { type: 'reference.update', id: '123', content: 'Content 2' },
        ],
      };

      const result = normalizeToolCalls(input);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('reference.add');
      expect(result[1].type).toBe('reference.update');
    });
  });

  describe('direct array input', () => {
    it('should return array directly if input is an array', () => {
      const input = [
        { type: 'reference.add', title: 'Direct', content: 'Array' },
      ];

      const result = normalizeToolCalls(input);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Direct');
    });

    it('should handle empty array', () => {
      const input: unknown[] = [];

      const result = normalizeToolCalls(input);

      expect(result).toEqual([]);
    });
  });

  describe('invalid inputs', () => {
    it('should return empty array for null', () => {
      const result = normalizeToolCalls(null);

      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const result = normalizeToolCalls(undefined);

      expect(result).toEqual([]);
    });

    it('should return empty array for string', () => {
      const result = normalizeToolCalls('not an object');

      expect(result).toEqual([]);
    });

    it('should return empty array for number', () => {
      const result = normalizeToolCalls(42);

      expect(result).toEqual([]);
    });

    it('should return empty array for object without reference_ops', () => {
      const input = { some_other_key: 'value' };

      const result = normalizeToolCalls(input);

      expect(result).toEqual([]);
    });

    it('should return empty array when reference_ops is not an array', () => {
      const input = { reference_ops: 'not an array' };

      const result = normalizeToolCalls(input);

      expect(result).toEqual([]);
    });

    it('should return empty array for boolean', () => {
      const result = normalizeToolCalls(true);

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle object with extra properties alongside reference_ops', () => {
      const input = {
        reference_ops: [{ type: 'reference.add', title: 'Test', content: 'C' }],
        extra_property: 'ignored',
        another: 123,
      };

      const result = normalizeToolCalls(input);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test');
    });

    it('should preserve all properties of reference operations', () => {
      const input = {
        reference_ops: [
          {
            type: 'reference.update',
            id: 'uuid-123',
            title: 'Character Name',
            content: 'Full description here',
          },
        ],
      };

      const result = normalizeToolCalls(input);

      expect(result[0]).toEqual({
        type: 'reference.update',
        id: 'uuid-123',
        title: 'Character Name',
        content: 'Full description here',
      });
    });
  });
});
