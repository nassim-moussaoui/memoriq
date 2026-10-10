# Memoriq website

Marketing site and legal pages of the Memoriq app (Astro 5, static, FR at
the root and EN under `/en`).

```
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

`npm run dev` and `npm run build` first run `scripts/sync-from-app.mjs`,
which copies the logo (`../assets/brand`) and the onboarding texts and
verses (`../src/locales`, `../src/data/quran`) from the app, so the app
stays the single source of truth.

Deploy on Vercel: import the GitHub repo and set **Root Directory** to
`web`. `vercel.json` skips builds when neither the site nor the shared
app files changed.
