import { useIntl } from 'react-intl';
import type { Translator } from './types';

export const useTranslate = (): Translator => {
  const intl = useIntl();

  return (name, options) => intl.formatMessage({ id: name }, options);
};
