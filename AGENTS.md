# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Memoriq

Mobile app (Expo SDK 57, TypeScript, Expo Router) that helps Muslims memorize surahs using scientifically proven learning methods. The full product plan lives in the approved plan file; short version:

- **Differentiator**: every mechanic maps to a documented cognitive-science effect: spaced repetition (FSRS via `ts-fsrs`), active recall (the verse starts masked (soft per-word pills) and the learner reveals the phonetic transliteration word by word after reciting out loud; no voice recognition, Anki-style self-rating only), chunking into 3 to 5 verse segments, dual coding (text + per-ayah audio), the traditional hifz structure (sabaq/sabqi/manzil) presented with its prophetic sources in the onboarding.
- **Monetization (phase 5, wired)**: free = Al-Fatiha + Juz' 'Amma (surahs 78 to 114); premium via RevenueCat; "Sadaqa" = gift a subscription to a student (present as gifting, never as charity; Apple guideline 3.2.2).
- **Backend (phase 4, live)**: Supabase project `kawcqhogalppljvhgikj`: migrations `0001_init` + `0002_harden_functions` applied (6 tables, RLS on), anon key in `.env.local` (gitignored; see `.env.example`). SQLite on device stays the source of truth; `src/lib/sync.ts` does launch/post-session/manual sync (merge rule: FSRS card with more reps wins).
- **Running the app**: development build (`expo-dev-client` + EAS), because the test phone's Expo Go is stuck on SDK 54. Start with `npx expo start --dev-client`.

## Architecture

- `src/data/quran/`: **generated** offline dataset (114 chapters, 6236 verses: Uthmani text, FR Hamidullah, EN Saheeh International, transliteration). Regenerate with `node scripts/build-quran-data.mjs`; never edit by hand.
- `src/lib/quran.ts`: chapter metadata + lazy per-surah verse loading; `isFreeSurah()` is the free-tier gate.
- `src/lib/audio.ts`: reciters + everyayah.com per-ayah mp3 URLs (default: Husary Mu'allim, the teaching recitation).
- `src/lib/audio-cache.ts`: offline cache of ayah mp3s in the documents folder (".part" download then move); `useAyahAudio` plays the cached file when present and caches the current and next verse.
- `src/lib/srs/`: the learning engine: `scheduler.ts` (ts-fsrs wrapper with no minute-level learning steps, so every stored interval is at least a day; `previewIntervals` feeds the rating cards), `db.ts` (expo-sqlite persistence, sync API), `segments.ts` (chunking), `queue.ts` (daily session sized by `budgetFor(minutesPerDay)`, with a per-day cap on new verses; `newCapReached` lets Today explain the cap, and `?mode=learn` is the explicit extra batch), `known.ts` (`markSurahsKnown`: surahs learned elsewhere go straight to review, first check spread over 7 to 45 days, nothing logged).
- `src/lib/notifications.ts`: the daily reminder (expo-notifications) anchored on `reviewMoment`, rescheduled after each session, plus the app icon badge.
- `src/lib/store.ts`: zustand + AsyncStorage (persist `version: 1`): plan (goal, minutesPerDay, reviewMoment), reminders, playback rate, settings, streak, premium flag. `startingSurahForGoal()` aims the first surah.
- `src/lib/i18n.ts` + `src/locales/{fr,en}.json`: all UI strings go through i18next; keep both files in sync.
- `assets/brand/`: the logo sources (SVG): `memoriq-icon` (full-bleed app icon), `memoriq-logo` (rounded), `memoriq-mark` (M + gold star, transparent), `memoriq-mark-mono`, `memoriq-background`. The PNGs in `assets/images/` (icon, Android adaptive layers, splash, favicon) are rendered from them; brand green `#0B7A5C`, gold `#D9A53A` to `#F6D77E`.
- `src/app/`: Expo Router: `(tabs)` (today/library/stats/profile), `surah/[id]`, `session` (the learning loop: a new verse goes listen (autoplay, loop, listen counter) → recite (masked verse, tap-to-reveal in `src/components/recall-verse.tsx`) → evaluate; reviews skip the listen step. Ratings are plain-language cards ("Forgot / Hesitant / Got it / Perfect") showing when the verse returns; "Forgot" retries it in the same session. After the new verses of a segment, a chain step (`ChainItem` in `queue.ts`, `chain-step.tsx`) has the learner recite the whole passage in one go to train transitions; it is a consolidation exercise that never touches FSRS cards, and the surah reader opens `?mode=chain&surah=N` for passage practice on started segments. Pieces in `src/components/session/`; `?mode=ahead` builds a review-ahead session), `onboarding` (9-step flow: welcome, three science steps with live charts and a hands-on recall demo, the sunna hadith deck, three plan questions, then an animated plan summary with reminder opt-in; pieces live in `src/components/onboarding/`), `paywall` (honest "coming soon" placeholder until RevenueCat).

## Website

`web/` is the marketing site and legal pages (Astro 5, static; FR at the root, EN under `/en`): home, `/confidentialite` (privacy, required by Apple), `/conditions` (terms), `/support` (support URL, required by Apple), `/compte/confirme` (landing of Supabase email links). It has its own `package.json`; `npm run dev|build` first syncs the logo and the onboarding texts from the app. It is excluded from the app's tsc, lint and Metro (`metro.config.js`). Deployed on Vercel with Root Directory `web`. Live at https://memoriq-nine.vercel.app (`WEBSITE` in `src/constants/links.ts`, used by the paywall legal links, the Profile help rows and the Supabase email redirects; change it there and in `web/astro.config.mjs` once a domain is bought).

## Roadmap

Done: batches A (dead ends) and B (habit loop); the full redesign (onboarding, session, Today, library with search and filters, stats with heatmap and forecast, grouped settings, surah reader with per-verse status); chain recitation; reliability (route-level `ErrorBoundary` via `src/components/error-screen.tsx`, offline audio cache in `src/lib/audio-cache.ts` with session prefetch, background playback and lock screen info, password reset through the `memoriq://reset-password` deep link).

Phase 5 is wired: `src/lib/purchases.ts` (react-native-purchases; `isPremium` mirrors the RevenueCat `premium` entitlement, linked to the Supabase user id; `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `test_` = Test Store, `appl_` = App Store), `paywall.tsx` (annual with 7-day trial, monthly, restore, manage), `sadaqa.tsx` (gift a year, or join the waitlist). Server: migrations 0004/0005 and the `revenuecat-webhook` edge function (`supabase/functions/`), which mirrors subscriptions and assigns gifts to the longest-waiting student through a RevenueCat promotional entitlement; it needs the `REVENUECAT_WEBHOOK_SECRET` and `REVENUECAT_SECRET_KEY` (V1) secrets. Still to do before submission: a privacy policy URL in `src/constants/links.ts`. The Supabase dashboard must list `memoriq://**` under Auth, URL Configuration, Redirect URLs for the reset link to open the app.

## Conventions

- UI text: never hardcode; add to both locale files.
- Writing style, everywhere (UI strings, docs, commit messages, assistant replies): NEVER use an em dash (—). Use a colon, a comma, a period, or parentheses instead. This is a hard user requirement.
- Arabic text: `writingDirection: 'rtl'`, generous lineHeight (about 1.8x).
- Colors via `useTheme()` from `src/hooks/use-theme` (light + dark both defined in `src/constants/theme.ts`; accent = `tint`).
- SQLite access is synchronous (`getAllSync` etc.) and must stay off web (mobile-first).
- Verify with: `npx tsc --noEmit`, `npx expo lint` (0 problems expected; react-hooks rules are strict: no ref access/setState during render) and, after any dependency change, `npx expo export --platform ios` (tsc and lint cannot see a module Metro fails to resolve).
- Keep `expo-glass-effect`, `expo-symbols` and `@expo/ui` installed even though `src/` never imports them: expo-router requires them internally without declaring them, and removing them breaks the bundle. Pin them to the versions compiled into the current native build.
