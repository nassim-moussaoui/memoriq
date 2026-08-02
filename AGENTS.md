# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Memoriq

Mobile app (Expo SDK 57, TypeScript, Expo Router) that helps Muslims memorize surahs using scientifically proven learning methods. The full product plan lives in the approved plan file; short version:

- **Differentiator**: every mechanic maps to a documented cognitive-science effect — spaced repetition (FSRS via `ts-fsrs`), active recall with progressive text masking, chunking into 3–5 verse segments, dual coding (text + per-ayah audio), the traditional hifz structure (sabaq/sabqi/manzil) reframed as spaced repetition.
- **Monetization (phase 5, not wired yet)**: free = Al-Fatiha + Juz' 'Amma (surahs 78–114); premium via RevenueCat; "Sadaqa" = gift a subscription to a student (present as gifting, never as charity — Apple guideline 3.2.2).
- **Backend (phase 4, live)**: Supabase project `kawcqhogalppljvhgikj` — migrations `0001_init` + `0002_harden_functions` applied (6 tables, RLS on), anon key in `.env.local` (gitignored; see `.env.example`). SQLite on device stays the source of truth; `src/lib/sync.ts` does launch/post-session/manual sync (merge rule: FSRS card with more reps wins).
- **Running the app**: development build (`expo-dev-client` + EAS), because the test phone's Expo Go is stuck on SDK 54. Start with `npx expo start --dev-client`.

## Architecture

- `src/data/quran/` — **generated** offline dataset (114 chapters, 6236 verses: Uthmani text, FR Hamidullah, EN Saheeh International, transliteration). Regenerate with `node scripts/build-quran-data.mjs`; never edit by hand.
- `src/lib/quran.ts` — chapter metadata + lazy per-surah verse loading; `isFreeSurah()` is the free-tier gate.
- `src/lib/audio.ts` — reciters + everyayah.com per-ayah mp3 URLs (default: Husary Mu'allim, the teaching recitation).
- `src/lib/srs/` — the learning engine: `scheduler.ts` (ts-fsrs wrapper), `db.ts` (expo-sqlite persistence, sync API), `segments.ts` (chunking), `queue.ts` (daily session = new segment + due reviews).
- `src/lib/store.ts` — zustand + AsyncStorage: settings, onboarding, streak, premium flag.
- `src/lib/i18n.ts` + `src/locales/{fr,en}.json` — all UI strings go through i18next; keep both files in sync.
- `src/app/` — Expo Router: `(tabs)` (today/library/stats/profile), `surah/[id]`, `session` (the learning loop), `onboarding` (science explainer), `paywall` (placeholder until RevenueCat).

## Conventions

- UI text: never hardcode — add to both locale files.
- Arabic text: `writingDirection: 'rtl'`, generous lineHeight (~1.8×).
- Colors via `useTheme()` from `src/hooks/use-theme` (light + dark both defined in `src/constants/theme.ts`; accent = `tint`).
- SQLite access is synchronous (`getAllSync` etc.) and must stay off web (mobile-first).
- Verify with: `npx tsc --noEmit` and `npx expo lint` (0 errors expected; react-hooks rules are strict — no ref access/setState during render).
