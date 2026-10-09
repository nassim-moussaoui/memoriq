# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Memoriq

Mobile app (Expo SDK 57, TypeScript, Expo Router) that helps Muslims memorize surahs using scientifically proven learning methods. The full product plan lives in the approved plan file; short version:

- **Differentiator**: every mechanic maps to a documented cognitive-science effect: spaced repetition (FSRS via `ts-fsrs`), active recall (the verse starts masked (soft per-word pills) and the learner reveals the phonetic transliteration word by word after reciting out loud; no voice recognition, Anki-style self-rating only), chunking into 3 to 5 verse segments, dual coding (text + per-ayah audio), the traditional hifz structure (sabaq/sabqi/manzil) presented with its prophetic sources in the onboarding.
- **Monetization (phase 5, not wired yet)**: free = Al-Fatiha + Juz' 'Amma (surahs 78 to 114); premium via RevenueCat; "Sadaqa" = gift a subscription to a student (present as gifting, never as charity; Apple guideline 3.2.2).
- **Backend (phase 4, live)**: Supabase project `kawcqhogalppljvhgikj`: migrations `0001_init` + `0002_harden_functions` applied (6 tables, RLS on), anon key in `.env.local` (gitignored; see `.env.example`). SQLite on device stays the source of truth; `src/lib/sync.ts` does launch/post-session/manual sync (merge rule: FSRS card with more reps wins).
- **Running the app**: development build (`expo-dev-client` + EAS), because the test phone's Expo Go is stuck on SDK 54. Start with `npx expo start --dev-client`.

## Architecture

- `src/data/quran/`: **generated** offline dataset (114 chapters, 6236 verses: Uthmani text, FR Hamidullah, EN Saheeh International, transliteration). Regenerate with `node scripts/build-quran-data.mjs`; never edit by hand.
- `src/lib/quran.ts`: chapter metadata + lazy per-surah verse loading; `isFreeSurah()` is the free-tier gate.
- `src/lib/audio.ts`: reciters + everyayah.com per-ayah mp3 URLs (default: Husary Mu'allim, the teaching recitation).
- `src/lib/srs/`: the learning engine: `scheduler.ts` (ts-fsrs wrapper with no minute-level learning steps, so every stored interval is at least a day; `previewIntervals` feeds the rating cards), `db.ts` (expo-sqlite persistence, sync API), `segments.ts` (chunking), `queue.ts` (daily session sized by `budgetFor(minutesPerDay)`, with a per-day cap on new verses).
- `src/lib/notifications.ts`: the daily reminder (expo-notifications) anchored on `reviewMoment`, rescheduled after each session, plus the app icon badge.
- `src/lib/store.ts`: zustand + AsyncStorage (persist `version: 1`): plan (goal, minutesPerDay, reviewMoment), reminders, playback rate, settings, streak, premium flag. `startingSurahForGoal()` aims the first surah.
- `src/lib/i18n.ts` + `src/locales/{fr,en}.json`: all UI strings go through i18next; keep both files in sync.
- `src/app/`: Expo Router: `(tabs)` (today/library/stats/profile), `surah/[id]`, `session` (the learning loop: a new verse goes listen (autoplay, loop, listen counter) → recite (masked verse, tap-to-reveal in `src/components/recall-verse.tsx`) → evaluate; reviews skip the listen step. Ratings are plain-language cards ("Forgot / Hesitant / Got it / Perfect") showing when the verse returns; "Forgot" retries it in the same session. After the new verses of a segment, a chain step (`ChainItem` in `queue.ts`, `chain-step.tsx`) has the learner recite the whole passage in one go to train transitions; it is a consolidation exercise that never touches FSRS cards, and the surah reader opens `?mode=chain&surah=N` for passage practice on started segments. Pieces in `src/components/session/`; `?mode=ahead` builds a review-ahead session), `onboarding` (9-step flow: welcome, three science steps with live charts and a hands-on recall demo, the sunna hadith deck, three plan questions, then an animated plan summary with reminder opt-in; pieces live in `src/components/onboarding/`), `paywall` (honest "coming soon" placeholder until RevenueCat).

## Roadmap

Batches A (dead ends) and B (habit loop) are done. The remaining plan lives in `C:\Users\azert\.claude\plans\snug-munching-clarke.md`: batch C (library search and progress bars, stats charts, reader per-verse state, audio disk cache) and batch D (error boundaries, full settings, password reset and deep links, background audio).

## Conventions

- UI text: never hardcode; add to both locale files.
- Writing style, everywhere (UI strings, docs, commit messages, assistant replies): NEVER use an em dash (—). Use a colon, a comma, a period, or parentheses instead. This is a hard user requirement.
- Arabic text: `writingDirection: 'rtl'`, generous lineHeight (about 1.8x).
- Colors via `useTheme()` from `src/hooks/use-theme` (light + dark both defined in `src/constants/theme.ts`; accent = `tint`).
- SQLite access is synchronous (`getAllSync` etc.) and must stay off web (mobile-first).
- Verify with: `npx tsc --noEmit` and `npx expo lint` (0 errors expected; react-hooks rules are strict: no ref access/setState during render).
