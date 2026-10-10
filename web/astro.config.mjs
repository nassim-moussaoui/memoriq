// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Replaced by the real domain once it is bought (canonical URLs, sitemap).
  site: process.env.SITE_URL ?? 'https://memoriq.fr',
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
