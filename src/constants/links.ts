/**
 * The Memoriq website (web/ in this repo, deployed on Vercel). Apple requires
 * the privacy policy and terms to be reachable from the paywall, and a
 * support URL on the App Store page.
 */
export const WEBSITE = 'https://memoriq.fr';

const PAGES = {
  privacy: { fr: '/confidentialite', en: '/en/privacy' },
  terms: { fr: '/conditions', en: '/en/terms' },
  support: { fr: '/support', en: '/en/support' },
  // Landing page of Supabase email links (sign-up confirmation, email change).
  confirmed: { fr: '/compte/confirme', en: '/en/account/confirmed' },
} as const;

export type WebsitePage = keyof typeof PAGES;

/** Absolute URL of a website page in the app language (French or English). */
export function websiteUrl(page: WebsitePage, language: string): string {
  return `${WEBSITE}${PAGES[page][language.startsWith('fr') ? 'fr' : 'en']}`;
}
