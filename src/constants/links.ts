/**
 * Legal pages shown on the paywall (Apple requires both for subscriptions).
 * Terms default to Apple's standard EULA; the privacy policy URL must be
 * filled in before submitting to the App Store (the link stays hidden while
 * it is empty).
 */
export const LegalLinks = {
  terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  privacy: '',
} as const;
