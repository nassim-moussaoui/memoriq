// Copies what the website shares with the app, so the app stays the single
// source of truth: the logo SVGs, and the onboarding texts (hadiths, verse
// translations) plus the few Quran verses shown on the site. Runs before
// every `dev` and `build`; the outputs are gitignored.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(web, '..');

// 1. Logo files.
const brandSrc = join(app, 'assets', 'brand');
const brandOut = join(web, 'public', 'brand');
mkdirSync(brandOut, { recursive: true });
for (const file of readdirSync(brandSrc)) copyFileSync(join(brandSrc, file), join(brandOut, file));
copyFileSync(join(brandSrc, 'memoriq-logo.svg'), join(web, 'public', 'favicon.svg'));

// 2. Texts and verses.
const pick = (locale) => {
  const o = JSON.parse(readFileSync(join(app, 'src', 'locales', `${locale}.json`), 'utf8')).onboarding;
  const hadiths = [1, 2, 3, 4].map((n) => ({
    title: o[`hadith${n}Title`],
    quote: o[`hadith${n}Quote`],
    narrator: o[`hadith${n}Narrator`],
    source: o[`hadith${n}Source`],
    method: o[`hadith${n}Method`],
  }));
  return { hadiths, welcomeVerse: o.welcomeVerse, welcomeVerseSource: o.welcomeVerseSource, sunnaBody: o.sunnaBody };
};
const verse = (surah, ayah) => {
  const verses = JSON.parse(readFileSync(join(app, 'src', 'data', 'quran', 'verses', `surah-${surah}.json`), 'utf8'));
  const v = verses[ayah - 1];
  return { ar: v.ar.trim(), tr: v.tr, fr: v.fr, en: v.en };
};

const out = join(web, 'src', 'generated');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, 'app-content.json'),
  JSON.stringify({ fr: pick('fr'), en: pick('en'), verses: { qamar17: verse(54, 17), ikhlas1: verse(112, 1) } }, null, 2),
);
console.log('synced brand and app content');
