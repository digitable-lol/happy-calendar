import { DEFAULT_LANGUAGE, LOCALES } from './constants';
import type { Locale } from './types';

const STORAGE_KEY = 'happy-calendar-locale';

const isLocale = (value: string | null): value is Locale => Object.values(LOCALES).includes(value as Locale);

export const getLocale = (): Locale => {
  const storedLocale = localStorage.getItem(STORAGE_KEY);

  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  if (isLocale(navigator.language)) {
    return navigator.language;
  }

  return DEFAULT_LANGUAGE;
};

export const persistLocale = (locale: Locale): void => localStorage.setItem(STORAGE_KEY, locale);
