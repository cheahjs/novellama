import { describe, it, expect } from 'vitest';
import { postProcessTranslation } from './postProcessTranslation';
import { TranslationPostprocessOptions } from '@/types';

describe('postProcessTranslation', () => {
  describe('with no options', () => {
    it('should return translation unchanged when options is undefined', () => {
      const input = 'Some translation text with <tag>xml</tag> and ```code```';

      const result = postProcessTranslation(input, undefined);

      expect(result).toBe(input);
    });

    it('should return translation unchanged when all options are false', () => {
      const input = 'Some translation text with <tag>xml</tag>';
      const options: TranslationPostprocessOptions = {
        removeXmlTags: false,
        removeCodeBlocks: false,
        trimWhitespace: false,
        truncateAfterSecondHeader: false,
      };

      const result = postProcessTranslation(input, options);

      expect(result).toBe(input);
    });
  });

  describe('removeXmlTags', () => {
    const options: TranslationPostprocessOptions = {
      removeXmlTags: true,
      removeCodeBlocks: false,
      trimWhitespace: false,
      truncateAfterSecondHeader: false,
    };

    it('should remove simple XML tags', () => {
      const input = 'Hello <b>world</b>!';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Hello world!');
    });

    it('should remove self-closing tags', () => {
      const input = 'Line one<br/>Line two';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Line oneLine two');
    });

    it('should remove tags with attributes', () => {
      const input = 'Click <a href="http://example.com" target="_blank">here</a> now';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Click here now');
    });

    it('should remove nested tags', () => {
      const input = '<div><p>Nested <strong>content</strong></p></div>';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Nested content');
    });

    it('should remove translation wrapper tags', () => {
      const input = '<translation>The translated content here.</translation>';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('The translated content here.');
    });

    it('should handle multiple tags on same line', () => {
      const input = '<p>First</p><p>Second</p><p>Third</p>';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('FirstSecondThird');
    });
  });

  describe('removeCodeBlocks', () => {
    const options: TranslationPostprocessOptions = {
      removeXmlTags: false,
      removeCodeBlocks: true,
      trimWhitespace: false,
      truncateAfterSecondHeader: false,
    };

    it('should remove code blocks with language specifier', () => {
      const input = `Some text before.

\`\`\`javascript
const x = 1;
\`\`\`

Some text after.`;

      const result = postProcessTranslation(input, options);

      expect(result).toBe(`Some text before.



Some text after.`);
    });

    it('should remove code blocks without language specifier', () => {
      const input = `Before.

\`\`\`
code here
\`\`\`

After.`;

      const result = postProcessTranslation(input, options);

      expect(result).toBe(`Before.



After.`);
    });

    it('should remove multiple code blocks', () => {
      const input = `Text \`\`\`block1\`\`\` more \`\`\`block2\`\`\` end`;

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Text  more  end');
    });

    it('should remove toolcalls code block', () => {
      const input = `Translation.

\`\`\`toolcalls
{"reference_ops": []}
\`\`\``;

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Translation.\n\n');
    });
  });

  describe('trimWhitespace', () => {
    const options: TranslationPostprocessOptions = {
      removeXmlTags: false,
      removeCodeBlocks: false,
      trimWhitespace: true,
      truncateAfterSecondHeader: false,
    };

    it('should trim leading whitespace', () => {
      const input = '   \n\n  Some text';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Some text');
    });

    it('should trim trailing whitespace', () => {
      const input = 'Some text   \n\n  ';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Some text');
    });

    it('should trim both leading and trailing whitespace', () => {
      const input = '\t  \n  Text in the middle  \n\t  ';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Text in the middle');
    });

    it('should preserve internal whitespace', () => {
      const input = '  Line one\n\nLine two  ';

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Line one\n\nLine two');
    });
  });

  describe('truncateAfterSecondHeader', () => {
    const options: TranslationPostprocessOptions = {
      removeXmlTags: false,
      removeCodeBlocks: false,
      trimWhitespace: false,
      truncateAfterSecondHeader: true,
    };

    it('should truncate content after second markdown header', () => {
      const input = `# Chapter 1

Content of chapter 1.

# Chapter 2

This should be removed.`;

      const result = postProcessTranslation(input, options);

      // The function truncates at the newline before the second header
      expect(result).toBe(`# Chapter 1

Content of chapter 1.
`);
    });

    it('should not truncate when only one header exists', () => {
      const input = `# Only Header

All content here should remain.

Including this paragraph.`;

      const result = postProcessTranslation(input, options);

      expect(result).toBe(input);
    });

    it('should not truncate when no headers exist', () => {
      const input = 'Plain text without any headers.';

      const result = postProcessTranslation(input, options);

      expect(result).toBe(input);
    });

    it('should only match headers at start of line', () => {
      const input = `# Real Header

Some text with # in the middle should not trigger truncation.

More content.`;

      const result = postProcessTranslation(input, options);

      expect(result).toBe(input);
    });

    it('should handle consecutive headers', () => {
      const input = `# First
# Second`;

      const result = postProcessTranslation(input, options);

      expect(result).toBe('# First');
    });
  });

  describe('combined options', () => {
    it('should apply all transformations in order', () => {
      const input = `  <wrapper>
# Chapter Title

Content with <b>bold</b> text.

\`\`\`code
something
\`\`\`

# Next Chapter

More content.
</wrapper>  `;

      const options: TranslationPostprocessOptions = {
        removeXmlTags: true,
        removeCodeBlocks: true,
        trimWhitespace: true,
        truncateAfterSecondHeader: true,
      };

      const result = postProcessTranslation(input, options);

      // Should remove XML tags, code blocks, trim whitespace, and truncate after second header
      expect(result).not.toContain('<wrapper>');
      expect(result).not.toContain('</wrapper>');
      expect(result).not.toContain('<b>');
      expect(result).not.toContain('```');
      expect(result).not.toContain('Next Chapter');
      expect(result).toContain('# Chapter Title');
      expect(result).toContain('Content with bold text.');
      expect(result.startsWith(' ')).toBe(false);
      expect(result.endsWith(' ')).toBe(false);
    });

    it('should handle removeXmlTags and trimWhitespace together', () => {
      const input = '  <div>  Content  </div>  ';
      const options: TranslationPostprocessOptions = {
        removeXmlTags: true,
        removeCodeBlocks: false,
        trimWhitespace: true,
        truncateAfterSecondHeader: false,
      };

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Content');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const input = '';
      const options: TranslationPostprocessOptions = {
        removeXmlTags: true,
        removeCodeBlocks: true,
        trimWhitespace: true,
        truncateAfterSecondHeader: true,
      };

      const result = postProcessTranslation(input, options);

      expect(result).toBe('');
    });

    it('should handle string with only whitespace', () => {
      const input = '   \n\t\n   ';
      const options: TranslationPostprocessOptions = {
        removeXmlTags: false,
        removeCodeBlocks: false,
        trimWhitespace: true,
        truncateAfterSecondHeader: false,
      };

      const result = postProcessTranslation(input, options);

      expect(result).toBe('');
    });

    it('should handle malformed XML gracefully', () => {
      const input = 'Text with <unclosed tag and <another> proper </another>';
      const options: TranslationPostprocessOptions = {
        removeXmlTags: true,
        removeCodeBlocks: false,
        trimWhitespace: false,
        truncateAfterSecondHeader: false,
      };

      const result = postProcessTranslation(input, options);

      expect(result).toBe('Text with  proper ');
    });

    it('should handle unclosed code blocks', () => {
      const input = 'Text ```unclosed code block without end';
      const options: TranslationPostprocessOptions = {
        removeXmlTags: false,
        removeCodeBlocks: true,
        trimWhitespace: false,
        truncateAfterSecondHeader: false,
      };

      // Unclosed blocks won't match the regex pattern, so they remain
      const result = postProcessTranslation(input, options);

      expect(result).toBe(input);
    });
  });
});
