import { TranslationPostprocessOptions } from '@/types';

export function postProcessTranslation(
  translation: string,
  options?: TranslationPostprocessOptions,
): string {
  if (!options) {
    return translation;
  }

  let output = translation;

  if (options.removeXmlTags) {
    output = output.replace(/<\/?[^>]*>/g, '');
  }

  if (options.removeCodeBlocks) {
    output = output.replace(/```[\s\S]*?```/g, '');
  }

  if (options.trimWhitespace) {
    output = output.trim();
  }

  if (options.truncateAfterSecondHeader) {
    const secondHeaderIndex = output.indexOf('\n# ');
    if (secondHeaderIndex !== -1) {
      output = output.substring(0, secondHeaderIndex);
    }
  }

  return output;
}
