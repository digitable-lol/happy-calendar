export const features = [
  ['feature.calendar.title', 'feature.calendar.text'],
  ['feature.budget.title', 'feature.budget.text'],
  ['feature.wishlist.title', 'feature.wishlist.text'],
  ['feature.hash.title', 'feature.hash.text'],
] as const;

export const principles = [
  'principle.noBackend',
  'principle.noDatabase',
  'principle.noPersonalData',
  'principle.passwordPayload',
  'principle.functionalCore',
  'principle.mobileDesktop',
] as const;

export const platforms = [
  ['platform.web.title', 'platform.web.text'],
  ['platform.mobile.title', 'platform.mobile.text'],
  ['platform.desktop.title', 'platform.desktop.text'],
  ['platform.core.title', 'platform.core.text'],
] as const;

export const functionalCore = [
  'hash.core.canonicalJson',
  'hash.core.payload',
  'hash.core.fingerprint',
  'hash.core.freshness',
] as const;
