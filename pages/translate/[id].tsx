import type { GetServerSideProps } from 'next';
import TranslatePage, {
  TranslatePageProps,
} from '@/components/translation/TranslatePage';
import { getNovelById } from '@/utils/fileStorage';
import { getChapterMetadata } from '@/utils/chapterStorage';
import type { TranslationChapter } from '@/types';

const TranslatePageRoute = (props: TranslatePageProps) => (
  <TranslatePage {...props} />
);

export const getServerSideProps: GetServerSideProps<TranslatePageProps> = async (
  context,
) => {
  const { id } = context.params ?? {};

  if (!id || typeof id !== 'string') {
    return { notFound: true };
  }

  const chapterParamRaw =
    (context.params?.chapter ?? context.query?.chapter) as
      | string
      | string[]
      | undefined;
  const chapterParam =
    typeof chapterParamRaw === 'string'
      ? chapterParamRaw
      : Array.isArray(chapterParamRaw)
        ? chapterParamRaw[0]
        : undefined;

  const baseNovel = await getNovelById(id);

  if (!baseNovel) {
    return { notFound: true };
  }

  const canonicalSegment = baseNovel.slug || baseNovel.id;

  if (id !== canonicalSegment) {
    const destination = chapterParam
      ? `/translate/${canonicalSegment}/${chapterParam}`
      : `/translate/${canonicalSegment}`;
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  const metadata = await getChapterMetadata(baseNovel.id);

  const savedChapterNumber =
    typeof baseNovel.readingChapterNumber === 'number'
      ? baseNovel.readingChapterNumber
      : null;

  const firstChapterNumber =
    metadata.length > 0 ? metadata[0].number : 1;
  const lastChapterNumber =
    metadata.length > 0
      ? metadata[metadata.length - 1].number
      : firstChapterNumber;
  const maxNavigableChapter = lastChapterNumber + 1;

  let initialChapterNumber = firstChapterNumber;

  if (chapterParam) {
    const parsed = parseInt(chapterParam, 10);
    if (
      !Number.isNaN(parsed) &&
      parsed >= firstChapterNumber &&
      parsed <= maxNavigableChapter
    ) {
      initialChapterNumber = parsed;
    }
  } else if (
    savedChapterNumber !== null &&
    savedChapterNumber >= firstChapterNumber
  ) {
    initialChapterNumber = Math.min(
      Math.max(savedChapterNumber, firstChapterNumber),
      maxNavigableChapter,
    );
  }

  const targetIndex = initialChapterNumber - 1;
  let initialLoadedChapters: TranslationChapter[] = [];

  if (metadata.length > 0 && targetIndex < metadata.length) {
    const startIdx = Math.max(targetIndex - 1, 0);
    const endIdx = targetIndex + 1;
    const novelWithChapters = await getNovelById(baseNovel.id, {
      start: startIdx + 1,
      end: endIdx + 1,
    });

    if (novelWithChapters?.chapters) {
      initialLoadedChapters = [...novelWithChapters.chapters].sort(
        (a, b) => a.number - b.number,
      );
    }
  }

  return {
    props: {
      initialNovel: { ...baseNovel, chapters: [] },
      initialChapterMetadata: metadata,
      initialChapterNumber,
      initialLoadedChapters,
    },
  };
};

export default TranslatePageRoute;
