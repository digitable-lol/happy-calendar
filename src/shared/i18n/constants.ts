import EnglishLocale from './locales/en.json';
import RussianLocale from './locales/ru.json';
import type { Locale } from './types';

export const DEFAULT_LANGUAGE: Locale = 'ru-RU';

export const LOCALE_LABELS: Record<Locale, string> = {
  'ru-RU': 'RU',
  'en-US': 'EN',
};

export const MESSAGES: Record<Locale, Record<string, string>> = {
  'ru-RU': RussianLocale,
  'en-US': EnglishLocale,
};

export const AVAILABLE_LOCALES = Object.keys(MESSAGES) as ReadonlyArray<Locale>;
