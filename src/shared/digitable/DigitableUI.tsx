import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

export type DtButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: 'primary' | 'secondary' | 'ghost'; readonly size?: 'sm' | 'lg' };

export const DtButton = ({ children, variant = 'primary', size, className, type = 'button', ...props }: DtButtonProps) => (
  <button type={type} className={cx('dt-btn', `dt-btn--${variant}`, size && `dt-btn--${size}`, className)} {...props}>{children}</button>
);

export const DtCard = ({ title, subtitle, children }: { readonly title: ReactNode; readonly subtitle?: ReactNode; readonly children: ReactNode }) => (
  <article className="dt-card"><header><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</header><div>{children}</div></article>
);

export const DtHeader = ({ logo, nav, actions }: { readonly logo: ReactNode; readonly nav: ReadonlyArray<{ readonly label: string; readonly href: string }>; readonly actions?: ReactNode }) => (
  <header className="dt-header"><div>{logo}</div><nav>{nav.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}</nav><div>{actions}</div></header>
);

export const DtTag = ({ children }: { readonly children: ReactNode }) => <span className="dt-tag">{children}</span>;
export const DtBadge = ({ children }: { readonly children: ReactNode }) => <span className="dt-badge">{children}</span>;
