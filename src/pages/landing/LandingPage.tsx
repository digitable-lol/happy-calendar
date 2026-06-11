import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { DtBadge, DtButton, DtCard, DtHeader, DtTag } from '../../shared/digitable/DigitableUI';
import { demoSession } from '../../entities/session/fixtures';
import type { SessionState } from '../../entities/session/model';
import { createSessionFingerprint, createSessionPayload, isNewerSession, readSessionPayload } from '../../entities/session/hashSession';
import { LanguagePicker, Messages, useTranslate } from '../../shared/i18n';
import { buildDemoSessionPreview } from '../../widgets/session-preview/sessionPreview';
import { features, functionalCore, platforms, principles } from './content';
import './landing.css';

const preview = buildDemoSessionPreview();

const buildDraftSession = (groupName: string, categoryBudget: number): SessionState => ({
  ...demoSession,
  groupName,
  updatedAt: new Date('2026-06-11T08:30:00.000Z').toISOString(),
  events: demoSession.events.map((event) => ({
    ...event,
    categoryBudget: {
      ...event.categoryBudget,
      budget: {
        ...event.categoryBudget.budget,
        amount: categoryBudget,
      },
    },
  })),
});

const shorten = (value: string, start = 34, end = 16) => `${value.slice(0, start)}...${value.slice(-end)}`;

export const LandingPage = () => {
  const intl = useIntl();
  const t = useTranslate();
  const [groupName, setGroupName] = useState(demoSession.groupName);
  const [categoryBudget, setCategoryBudget] = useState(demoSession.events[0].categoryBudget.budget.amount);
  const [secret, setSecret] = useState('family-secret');
  const [fingerprint, setFingerprint] = useState('calculating...');
  const [copyState, setCopyState] = useState<Messages>(Messages.ACTION_COPY_PAYLOAD);
  const [showToTop, setShowToTop] = useState(false);
  const draftSession = useMemo(() => buildDraftSession(groupName.trim() || demoSession.groupName, categoryBudget), [categoryBudget, groupName]);
  const payload = useMemo(() => createSessionPayload(draftSession), [draftSession]);
  const restored = useMemo(() => readSessionPayload(payload), [payload]);
  const isFresh = isNewerSession(restored, demoSession);
  const event = draftSession.events[0];

  useEffect(() => {
    let active = true;
    setFingerprint('calculating...');
    createSessionFingerprint(draftSession, secret).then((value) => {
      if (active) setFingerprint(value);
    });
    return () => {
      active = false;
    };
  }, [draftSession, secret]);

  useEffect(() => {
    const updateToTopVisibility = () => setShowToTop(window.scrollY > 160);
    updateToTopVisibility();
    window.addEventListener('scroll', updateToTopVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateToTopVisibility);
  }, []);

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState(Messages.ACTION_PAYLOAD_COPIED);
    } catch {
      setCopyState(Messages.ACTION_COPY_FROM_PAYLOAD);
    }
    window.setTimeout(() => setCopyState(Messages.ACTION_COPY_PAYLOAD), 1800);
  };

  const formattedCategoryBudget = intl.formatNumber(categoryBudget, { style: 'currency', currency: event.categoryBudget.budget.currency, maximumFractionDigits: 0 });
  const formattedEventBudget = intl.formatNumber(event.categoryBudget.budget.amount, { style: 'currency', currency: event.categoryBudget.budget.currency, maximumFractionDigits: 0 });
  const formattedEventDate = intl.formatDate(new Date(event.date), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <main className="dt-canvas landing">
      <DtHeader
        logo={<a className="brand" href="#top"><img src="/images/high_dimension_logo.png" alt="" /><strong>Digitable.HappyCalendar</strong></a>}
        nav={[{ label: t(Messages.NAV_DEMO), href: '#demo', tone: 'accent' }, { label: t(Messages.NAV_IDEA), href: '#idea' }, { label: t(Messages.NAV_HASH), href: '#hash' }, { label: t(Messages.NAV_PLATFORMS), href: '#roadmap' }]}
        actions={<><LanguagePicker /><a className="dt-btn dt-btn--primary dt-btn--sm" href="#demo">{t(Messages.ACTION_OPEN_PAYLOAD)}</a></>}
      />

      <section className="hero" id="top">
        <div className="hero-copy">
          <DtBadge>{t(Messages.HERO_BADGE)}</DtBadge>
          <h1>{t(Messages.HERO_TITLE).replace('.', '.\n')}</h1>
          <p>{t(Messages.HERO_DESCRIPTION)}</p>
          <div className="actions">
            <a className="dt-btn dt-btn--primary dt-btn--lg" href="#demo">{t(Messages.ACTION_TRY_DEMO)}</a>
            <a className="dt-btn dt-btn--secondary dt-btn--lg" href="#hash">{t(Messages.ACTION_HOW_HASH_WORKS)}</a>
          </div>
          <div className="tags">{principles.map((x) => <DtTag key={x}>{t(x)}</DtTag>)}</div>
        </div>

        <aside className="demo-panel" id="demo" aria-label="Демо хеш-сессии">
          <div className="demo-panel__top">
            <div>
              <span className="eyebrow">{t(Messages.DEMO_LABEL)}</span>
              <h2>{draftSession.groupName}</h2>
            </div>
            <span className={isFresh ? 'status status--fresh' : 'status'}>{isFresh ? t(Messages.DEMO_NEWER) : t(Messages.DEMO_SAME)}</span>
          </div>

          <div className="editor-grid">
            <label>
              <span>{t(Messages.DEMO_GROUP)}</span>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
            </label>
            <label>
              <span>{t(Messages.DEMO_SECRET)}</span>
              <input value={secret} onChange={(event) => setSecret(event.target.value)} />
            </label>
            <label className="range-field">
              <span>{t(Messages.DEMO_CATEGORY_BUDGET, { category: event.categoryBudget.title, budget: formattedCategoryBudget })}</span>
              <input type="range" min="1000" max="12000" step="500" value={categoryBudget} onChange={(event) => setCategoryBudget(Number(event.target.value))} />
            </label>
          </div>

          <div className="event-card">
            <div>
              <strong>{event.title}</strong>
              <p>{formattedEventDate} · {t(Messages.DEMO_PARTICIPANTS, { count: preview.participantsCount })} · {event.categoryBudget.title}</p>
            </div>
            <b>{formattedEventBudget}</b>
          </div>

          <dl className="hash-list">
            <div><dt>{t(Messages.HASH_PAYLOAD)}</dt><dd><code>{shorten(payload)}</code></dd></div>
            <div><dt>{t(Messages.HASH_FINGERPRINT)}</dt><dd><code>{fingerprint}</code></dd></div>
            <div><dt>{t(Messages.HASH_ROUND_TRIP)}</dt><dd>{restored.groupName === draftSession.groupName ? t(Messages.DEMO_ROUND_TRIP_OK) : t(Messages.DEMO_ROUND_TRIP_CHANGED)}</dd></div>
          </dl>

          <DtButton variant="ghost" onClick={copyPayload}>{t(copyState)}</DtButton>
        </aside>
      </section>

      <section className="section" id="idea">
        <p className="eyebrow">{t(Messages.IDEA_EYEBROW)}</p>
        <h2>{t(Messages.IDEA_TITLE)}</h2>
        <div className="idea-visual" aria-hidden="true">
          <img src="/images/happy-calendar-brand-bg.png" alt="" />
          <span className="idea-visual__mark"><img src="/images/high_dimension_logo.png" alt="" /></span>
        </div>
        <div className="grid">{features.map(([title, text]) => <DtCard key={title} title={t(title)}>{t(text)}</DtCard>)}</div>
      </section>

      <section className="section split" id="hash">
        <div>
          <p className="eyebrow">{t(Messages.HASH_EYEBROW)}</p>
          <h2>{t(Messages.HASH_TITLE)}</h2>
          <p>{t(Messages.HASH_DESCRIPTION)}</p>
        </div>
        <DtCard title={t(Messages.HASH_CORE_TITLE)}>
          <ol>
            {functionalCore.map((item) => <li key={item}>{t(item)}</li>)}
          </ol>
        </DtCard>
      </section>

      <section className="section" id="roadmap">
        <p className="eyebrow">{t(Messages.ROADMAP_EYEBROW)}</p>
        <h2>{t(Messages.ROADMAP_TITLE)}</h2>
        <div className="grid">{platforms.map(([title, text, muted]) => <DtCard key={title} title={t(title)} muted={muted}>{t(text)}</DtCard>)}</div>
      </section>

      <a className={showToTop ? 'to-top to-top--visible' : 'to-top'} href="#top" aria-label={t(Messages.TO_TOP)}>
        <span aria-hidden="true">↑</span>
      </a>
    </main>
  );
};
