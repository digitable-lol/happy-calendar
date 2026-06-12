import { useContext } from 'react';
import { DtLanguageSwitch } from '../digitable/DigitableUI';
import { AVAILABLE_LOCALES, LOCALE_LABELS } from './constants';
import { TranslateContext } from './WithTranslate';

export const LanguagePicker = () => {
  const { locale, setLocale } = useContext(TranslateContext);
  const localeOptions = AVAILABLE_LOCALES;

  return (
    <DtLanguageSwitch
      ariaLabel="Language"
      onChange={setLocale}
      options={localeOptions.map((language) => ({ label: LOCALE_LABELS[language] ?? language, value: language }))}
      value={locale}
    />
  );
};
