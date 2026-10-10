import { describe, expect, it } from '@jest/globals';

import { startingSurahForGoal } from '../store';

describe('first surah to learn', () => {
  it('starts each goal where it naturally begins', () => {
    expect(startingSurahForGoal('juzamma')).toBe(114);
    expect(startingSurahForGoal('prayer')).toBe(112);
    expect(startingSurahForGoal('hifz')).toBe(78);
  });

  it('skips surahs the learner already knows, in the order of the goal', () => {
    expect(startingSurahForGoal('juzamma', new Set([114, 113]))).toBe(112);
    expect(startingSurahForGoal('prayer', new Set([112, 113, 114]))).toBe(111);
    expect(startingSurahForGoal('hifz', new Set([78, 79]))).toBe(80);
  });

  it('moves on to Al-Fatiha once all of Juz Amma is known', () => {
    const juzAmma = new Set(Array.from({ length: 37 }, (_, i) => 78 + i));
    expect(startingSurahForGoal('juzamma', juzAmma)).toBe(1);
  });
});
