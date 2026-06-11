import { useContext } from 'react';
import { DtLanguageSwitch } from '../digitable/DigitableUI';
import { LOCALE_LABELS, LOCALES } from './constants';
import { TranslateContext } from './WithTranslate';

export const LanguagePicker = () => {
  const { locale, setLocale } = useContext(TranslateContext);

  return (
    <DtLanguageSwitch
      ariaLabel="Language"
      onChange={setLocale}
      options={Object.values(LOCALES).map((language) => ({ label: LOCALE_LABELS[language], value: language }))}
      value={locale}
    />
  );
};
