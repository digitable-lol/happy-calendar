import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

export type DtButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: 'primary' | 'secondary' | 'ghost'; readonly size?: 'sm' | 'lg' };

export const DtButton = ({ children, variant = 'primary', size, className, type = 'button', ...props }: DtButtonProps) => (
  <button type={type} className={cx('dt-btn', `dt-btn--${variant}`, size && `dt-btn--${size}`, className)} {...props}>{children}</button>
);

export const DtCard = ({ title, subtitle, children, muted }: { readonly title: ReactNode; readonly subtitle?: ReactNode; readonly children: ReactNode; readonly muted?: boolean }) => (
  <article className={cx('dt-card', muted && 'dt-card--muted')}><header><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</header><div>{children}</div></article>
);

export const DtHeader = ({ logo, nav, actions }: { readonly logo: ReactNode; readonly nav: ReadonlyArray<{ readonly label: string; readonly href: string; readonly tone?: 'accent' }>; readonly actions?: ReactNode }) => (
  <header className="dt-header"><div>{logo}</div><nav>{nav.map((item) => <a className={item.tone === 'accent' ? 'dt-header__accent-link' : undefined} key={item.label} href={item.href}>{item.label}</a>)}</nav><div>{actions}</div></header>
);

export const DtTag = ({ children }: { readonly children: ReactNode }) => <span className="dt-tag">{children}</span>;
export const DtBadge = ({ children }: { readonly children: ReactNode }) => <span className="dt-badge">{children}</span>;

export const DtLanguageSwitch = <T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  readonly ariaLabel: string;
  readonly options: ReadonlyArray<{ readonly label: string; readonly value: T }>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="dt-language-switch" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="dt-language-switch__trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="sr-only">{ariaLabel}</span>
        {selectedOption?.label}
        <span aria-hidden="true" className={cx('dt-language-switch__chevron', isOpen && 'dt-language-switch__chevron--open')}>⌄</span>
      </button>
      {isOpen && (
        <div aria-label={ariaLabel} className="dt-language-switch__menu" role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={cx('dt-language-switch__option', option.value === value && 'dt-language-switch__option--active')}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
