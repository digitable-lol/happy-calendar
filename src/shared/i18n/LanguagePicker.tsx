import { useContext } from 'react';
import { LOCALE_LABELS, LOCALES } from './constants';
import type { Locale } from './types';
import { TranslateContext } from './WithTranslate';

export const LanguagePicker = () => {
  const { locale, setLocale } = useContext(TranslateContext);

  return (
    <label className="language-picker">
      <span className="sr-only">Language</span>
      <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label="Language">
        {Object.values(LOCALES).map((language) => (
          <option key={language} value={language}>
            {LOCALE_LABELS[language]}
          </option>
        ))}
      </select>
    </label>
  );
};
