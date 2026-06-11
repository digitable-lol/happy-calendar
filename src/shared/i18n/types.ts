export type Locale = 'ru-RU' | 'en-US';

export enum Messages {
  NAV_DEMO = 'nav.demo',
  NAV_IDEA = 'nav.idea',
  NAV_HASH = 'nav.hash',
  NAV_PLATFORMS = 'nav.platforms',
  ACTION_OPEN_PAYLOAD = 'action.openPayload',
  ACTION_TRY_DEMO = 'action.tryDemo',
  ACTION_HOW_HASH_WORKS = 'action.howHashWorks',
  ACTION_COPY_PAYLOAD = 'action.copyPayload',
  ACTION_PAYLOAD_COPIED = 'action.payloadCopied',
  ACTION_COPY_FROM_PAYLOAD = 'action.copyFromPayload',
  HERO_BADGE = 'hero.badge',
  HERO_TITLE = 'hero.title',
  HERO_DESCRIPTION = 'hero.description',
  DEMO_LABEL = 'demo.label',
  DEMO_NEWER = 'demo.newer',
  DEMO_SAME = 'demo.same',
  DEMO_GROUP = 'demo.group',
  DEMO_SECRET = 'demo.secret',
  DEMO_CATEGORY_BUDGET = 'demo.categoryBudget',
  DEMO_PARTICIPANTS = 'demo.participants',
  DEMO_ROUND_TRIP_OK = 'demo.roundTripOk',
  DEMO_ROUND_TRIP_CHANGED = 'demo.roundTripChanged',
  HASH_PAYLOAD = 'hash.payload',
  HASH_FINGERPRINT = 'hash.fingerprint',
  HASH_ROUND_TRIP = 'hash.roundTrip',
  IDEA_EYEBROW = 'idea.eyebrow',
  IDEA_TITLE = 'idea.title',
  HASH_EYEBROW = 'hash.eyebrow',
  HASH_TITLE = 'hash.title',
  HASH_DESCRIPTION = 'hash.description',
  HASH_CORE_TITLE = 'hash.coreTitle',
  ROADMAP_EYEBROW = 'roadmap.eyebrow',
  ROADMAP_TITLE = 'roadmap.title',
  TO_TOP = 'toTop',
}

export type TranslateContextValue = {
  locale: Locale;
  setLocale: (language: Locale) => void;
};

export type Translator = (name: Messages | string, options?: Record<string, string | number>) => string;
