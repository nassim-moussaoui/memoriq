import { verseFiles } from "@/data/quran/verses";

export type Chapter = {
  id: number;
  nameArabic: string;
  nameSimple: string;
  nameFr: string;
  nameEn: string;
  revelationPlace: "makkah" | "madinah";
  versesCount: number;
};

export type Verse = {
  /** Ayah number within the surah (1-based). */
  v: number;
  /** Uthmani Arabic text. */
  ar: string;
  /** French translation (Muhammad Hamidullah). */
  fr: string;
  /** English translation (Saheeh International). */
  en: string;
  /** Latin transliteration. */
  tr: string;
};

export const chapters: Chapter[] = require("@/data/quran/chapters.json");

export function getChapter(id: number): Chapter {
  const chapter = chapters[id - 1];
  if (!chapter) throw new Error(`Unknown surah ${id}`);
  return chapter;
}

const verseCache = new Map<number, Verse[]>();

export function getVerses(surahId: number): Verse[] {
  let verses = verseCache.get(surahId);
  if (!verses) {
    const load = verseFiles[surahId];
    if (!load) throw new Error(`Unknown surah ${surahId}`);
    verses = load() as Verse[];
    verseCache.set(surahId, verses);
  }
  return verses;
}

/** Juz' 'Amma (surahs 78–114) plus Al-Fatiha are included in the free plan. */
const JUZ_AMMA_FIRST_SURAH = 78;

export function isFreeSurah(id: number): boolean {
  return id === 1 || id >= JUZ_AMMA_FIRST_SURAH;
}
