import { createContext, useMemo, useState, type PropsWithChildren } from 'react';
import { IntlProvider } from 'react-intl';
import { DEFAULT_LANGUAGE, MESSAGES } from './constants';
import type { Locale, TranslateContextValue } from './types';
import { getLocale, persistLocale } from './utils';

export const TranslateContext = createContext<TranslateContextValue>({
  locale: DEFAULT_LANGUAGE,
  setLocale: () => undefined,
});

export const WithTranslate = ({ children }: PropsWithChildren) => {
  const [locale, setLocale] = useState<Locale>(() => getLocale());
  const messages = useMemo(() => MESSAGES[locale], [locale]);

  const handleSetLocale = (language: Locale) => {
    persistLocale(language);
    setLocale(language);
  };

  return (
    <TranslateContext.Provider value={{ locale, setLocale: handleSetLocale }}>
      <IntlProvider messages={messages} locale={locale} defaultLocale={DEFAULT_LANGUAGE}>
        {children}
      </IntlProvider>
    </TranslateContext.Provider>
  );
};
