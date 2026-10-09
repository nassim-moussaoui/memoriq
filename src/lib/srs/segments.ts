/**
 * Chunking: surahs are split into segments of 3–5 ayahs. A segment is the
 * unit of a "sabaq" (new lesson): small enough for working memory, large
 * enough to preserve the flow of the recitation.
 */
export type Segment = {
  /** 0-based segment index within the surah. */
  index: number;
  /** First ayah number, inclusive. */
  start: number;
  /** Last ayah number, inclusive. */
  end: number;
};

export function segmentSurah(versesCount: number): Segment[] {
  if (versesCount <= 5) {
    return [{ index: 0, start: 1, end: versesCount }];
  }
  // Aim for segments of 4, distributed evenly so sizes stay within 3–5.
  const count = Math.ceil(versesCount / 4);
  const base = Math.floor(versesCount / count);
  const remainder = versesCount % count;
  const segments: Segment[] = [];
  let start = 1;
  for (let i = 0; i < count; i++) {
    const size = base + (i < remainder ? 1 : 0);
    segments.push({ index: i, start, end: start + size - 1 });
    start += size;
  }
  return segments;
}
