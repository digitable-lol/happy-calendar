import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { DtBadge, DtButton, DtCard, DtHeader, DtTag } from '../../shared/digitable/DigitableUI';
import { demoSession } from '../../entities/session/fixtures';
import { type CalendarEvent, type EventFormat, type SessionState } from '../../entities/session/model';
import { createSessionFingerprint, createSessionPayload, isNewerSession, readSessionPayload } from '../../entities/session/hashSession';
import { LanguagePicker, Messages, useTranslate } from '../../shared/i18n';
import { features, functionalCore, platforms, principles } from './content';
import './landing.css';

type AppView = 'landing' | 'workspace';

const EVENT_FORMAT_OPTIONS: ReadonlyArray<EventFormat> = ['organized', 'drop-in', 'remote', 'gift-only'];

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toInputDate = (value: string) => value.slice(0, 10);
const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const isSameDate = (left: string, right: string) => left === right;
const shorten = (value: string, start = 34, end = 16) => `${value.slice(0, start)}...${value.slice(-end)}`;

const pickMonthDays = (monthStart: Date): Date[] => {
  const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export const LandingPage = () => {
  const intl = useIntl();
  const t = useTranslate();
  const [view, setView] = useState<AppView>('landing');
  const [sessionState, setSessionState] = useState<SessionState>(() => buildDraftSession(demoSession.groupName, demoSession.events[0].categoryBudget.budget.amount));
  const [secret, setSecret] = useState('family-secret');
  const [fingerprint, setFingerprint] = useState('calculating...');
  const [copyState, setCopyState] = useState<Messages>(Messages.ACTION_COPY_PAYLOAD);
  const [importPayload, setImportPayload] = useState('');
  const [importMessage, setImportMessage] = useState<Messages | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const eventDate = demoSession.events[0]?.date ?? new Date().toISOString();
    const baseDate = new Date(eventDate);
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });
  const [showToTop, setShowToTop] = useState(false);
  const session = sessionState;
  const event = session.events[0] as CalendarEvent;
  const payload = useMemo(() => createSessionPayload(session), [session]);

  const isFresh = isNewerSession(session, demoSession);

  const participantsCount = session.participants.length;
  const monthDays = useMemo(() => pickMonthDays(calendarMonth), [calendarMonth]);
  const isCurrentMonth = (value: Date) => value.getMonth() === calendarMonth.getMonth() && value.getFullYear() === calendarMonth.getFullYear();
  const selectedDate = event.date;
  const budgetInput = event.categoryBudget.budget.amount;
  const formattedCategoryBudget = intl.formatNumber(budgetInput, { style: 'currency', currency: event.categoryBudget.budget.currency, maximumFractionDigits: 0 });
  const formattedEventBudget = intl.formatNumber(event.categoryBudget.budget.amount, { style: 'currency', currency: event.categoryBudget.budget.currency, maximumFractionDigits: 0 });
  const formattedEventDate = intl.formatDate(new Date(event.date), { day: 'numeric', month: 'long', year: 'numeric' });
  const monthLabel = intl.formatDate(calendarMonth, { month: 'long', year: 'numeric' });
  const weekdays = useMemo(() => {
    const weekBase = new Date(2026, 0, 4);
    return Array.from({ length: 7 }, (_, index) => intl.formatDate(new Date(2026, 0, 4 + index), { weekday: 'short' }));
  }, [intl]);

  useEffect(() => {
    const syncFromHash = () => setView(window.location.hash === '#workspace' ? 'workspace' : 'landing');
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (view === 'workspace') {
      setImportPayload(payload);
    }
  }, [payload, view]);

  useEffect(() => {
    let active = true;
    setFingerprint('calculating...');
    createSessionFingerprint(session, secret).then((value) => {
      if (active) setFingerprint(value);
    });
    return () => {
      active = false;
    };
  }, [session, secret]);

  useEffect(() => {
    const updateToTopVisibility = () => setShowToTop(window.scrollY > 160);
    updateToTopVisibility();
    window.addEventListener('scroll', updateToTopVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateToTopVisibility);
  }, []);

  const openWorkspace = () => {
    setView('workspace');
    setImportMessage(null);
    window.location.hash = '#workspace';
  };

  const closeWorkspace = () => {
    setView('landing');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
  };

  const updateSession = (updater: (current: SessionState) => SessionState) => {
    setSessionState((current) => {
      const next = updater(current);
      return { ...next, updatedAt: new Date().toISOString() };
    });
  };

  const updateEvent = (updater: (current: CalendarEvent) => CalendarEvent) => {
    updateSession((current) => ({
      ...current,
      events: current.events.map((item, index) => (index === 0 ? updater(item) : item)),
    }));
  };

  const applyPayload = async () => {
    try {
      const restored = readSessionPayload(importPayload);
      setSessionState(restored);
      setImportMessage(Messages.WORKSPACE_IMPORT_SUCCESS);
      setView('workspace');
      window.location.hash = '#workspace';
      return;
    } catch {
      setImportMessage(Messages.WORKSPACE_IMPORT_ERROR);
      return;
    }
  };

  const openDate = new Date(selectedDate);

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState(Messages.ACTION_PAYLOAD_COPIED);
    } catch {
      setCopyState(Messages.ACTION_COPY_FROM_PAYLOAD);
    }
    window.setTimeout(() => setCopyState(Messages.ACTION_COPY_PAYLOAD), 1800);
  };

  const formattedCalendarDate = (value: Date) => intl.formatDate(value, { day: 'numeric' });
  const workspaceNavItems = [{ label: t(Messages.NAV_DEMO), href: '#workspace', tone: 'accent' }] as const;
  const landingNavItems = [
    { label: t(Messages.NAV_DEMO), href: '#workspace', tone: 'accent' },
    { label: t(Messages.NAV_IDEA), href: '#idea' },
    { label: t(Messages.NAV_HASH), href: '#hash' },
    { label: t(Messages.NAV_PLATFORMS), href: '#roadmap' },
  ] as const;

  const workspaceHeaderActions = (
    <>
      <LanguagePicker />
      <DtButton variant="secondary" size="sm" onClick={closeWorkspace}>
        {t(Messages.ACTION_BACK_TO_LANDING)}
      </DtButton>
    </>
  );

  if (view === 'workspace') {
    return (
      <main className="dt-canvas landing">
        <DtHeader
          logo={<a className="brand" href="#top"><img src="/images/high_dimension_logo.png" alt="" /><strong>Digitable.HappyCalendar</strong></a>}
          nav={[...workspaceNavItems]}
          actions={workspaceHeaderActions}
        />
        <section className="section workspace" id="workspace">
          <p className="eyebrow">{t(Messages.WORKSPACE_BADGE)}</p>
          <div className="workspace-head">
            <h2>{t(Messages.WORKSPACE_TITLE)}</h2>
            <span className={isFresh ? 'status status--fresh' : 'status'}>{isFresh ? t(Messages.DEMO_NEWER) : t(Messages.DEMO_SAME)}</span>
          </div>

          <div className="workspace-grid">
            <article className="calendar-shell">
              <div className="calendar-shell__title">{t(Messages.WORKSPACE_CALENDAR_TITLE)}</div>
              <div className="calendar-card">
                <header className="calendar-toolbar">
                  <button
                    className="calendar-nav calendar-nav--left"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    type="button"
                  >
                    ←
                  </button>
                  <strong>{monthLabel}</strong>
                  <button
                    className="calendar-nav"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    type="button"
                  >
                    →
                  </button>
                </header>
                <div className="calendar-weekdays">
                  {weekdays.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {monthDays.map((day) => {
                    const dayIso = toIso(day);
                    const current = isCurrentMonth(day);
                    const selected = isSameDate(dayIso, selectedDate);
                    const hasEvent = session.events.some((item) => item.date === dayIso);
                    return (
                      <button
                        className={`calendar-cell${current ? '' : ' calendar-cell--other'}${selected ? ' calendar-cell--selected' : ''}`}
                        disabled={!current}
                        key={dayIso + String(day.getDate())}
                        onClick={() => {
                          updateEvent((currentEvent) => ({ ...currentEvent, date: dayIso }));
                          setCalendarMonth((monthState) => new Date(day.getFullYear(), day.getMonth(), 1));
                        }}
                        type="button"
                      >
                        <span>{formattedCalendarDate(day)}</span>
                        {hasEvent && <i aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <dl className="calendar-note">
                <dt>{t(Messages.WORKSPACE_EVENT_TITLE)}</dt>
                <dd>
                  <strong>{event.title}</strong>
                  <p>{formattedEventDate}</p>
                  <p>{t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })}</p>
                </dd>
              </dl>
            </article>

            <article className="workspace-controls">
              <div className="workspace-controls__grid">
                <label>
                  <span>{t(Messages.DEMO_GROUP)}</span>
                  <input
                    value={session.groupName}
                    onChange={(value) => {
                      updateSession((current) => ({ ...current, groupName: value.target.value }));
                    }}
                  />
                </label>

                <label>
                  <span>{t(Messages.DEMO_SECRET)}</span>
                  <input value={secret} onChange={(value) => setSecret(value.target.value)} />
                </label>

                <label>
                  <span>{t(Messages.WORKSPACE_EVENT_TITLE)}</span>
                  <input
                    value={event.title}
                    onChange={(value) => updateEvent((current) => ({ ...current, title: value.target.value }))}
                  />
                </label>

                <label>
                  <span>{t(Messages.WORKSPACE_EVENT_DATE)}</span>
                  <input
                    type="date"
                    value={toInputDate(event.date)}
                    onChange={(value) => {
                      const normalized = toInputDate(value.target.value);
                      updateEvent((current) => ({ ...current, date: normalized }));
                      setCalendarMonth((current) => {
                        const nextDate = new Date(normalized);
                        return current.getMonth() === nextDate.getMonth() && current.getFullYear() === nextDate.getFullYear() ? current : new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
                      });
                    }}
                  />
                </label>

                <label>
                  <span>{t(Messages.WORKSPACE_FORMAT)}</span>
                  <select value={event.format} onChange={(value) => updateEvent((current) => ({ ...current, format: value.target.value as EventFormat }))}>
                    {EVENT_FORMAT_OPTIONS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="range-field">
                  <span>{t(Messages.DEMO_CATEGORY_BUDGET, { category: event.categoryBudget.title, budget: formattedCategoryBudget })}</span>
                  <input
                    type="range"
                    min="1000"
                    max="12000"
                    step="500"
                    value={budgetInput}
                    onChange={(value) => {
                      const nextBudget = Number(value.target.value);
                      updateEvent((currentEvent) => ({
                        ...currentEvent,
                        categoryBudget: { ...currentEvent.categoryBudget, budget: { ...currentEvent.categoryBudget.budget, amount: nextBudget } },
                      }));
                    }}
                  />
                </label>
              </div>

              <div className="workspace-event-summary">
                <h3>{event.title}</h3>
                <p>{t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })}</p>
                <p>{event.categoryBudget.title}</p>
                <p>{formattedEventBudget}</p>
              </div>

              <div className="workspace-card">
                <div className="dt-tag">{t(Messages.HASH_PAYLOAD)}</div>
                <textarea className="workspace-textarea" rows={5} value={importPayload} onChange={(event) => setImportPayload(event.target.value)} />
                <div className="workspace-payload-actions">
                  <DtButton variant="ghost" onClick={copyPayload}>
                    {copyState}
                  </DtButton>
                  <DtButton onClick={applyPayload}>{t(Messages.WORKSPACE_IMPORT_PAYLOAD)}</DtButton>
                </div>
                <p className="workspace-state">{importMessage ? t(importMessage) : ''}</p>
                <dl className="hash-list">
                  <div>
                    <dt>{t(Messages.HASH_FINGERPRINT)}</dt>
                    <dd><code>{fingerprint}</code></dd>
                  </div>
                  <div>
                    <dt>{t(Messages.HASH_ROUND_TRIP)}</dt>
                    <dd>{isFresh ? t(Messages.DEMO_ROUND_TRIP_OK) : t(Messages.DEMO_ROUND_TRIP_CHANGED)}</dd>
                  </div>
                  <div>
                    <dt>{t(Messages.WORKSPACE_CREATED_AT)}</dt>
                    <dd>{formattedEventDate}</dd>
                  </div>
                </dl>
              </div>
            </article>
          </div>

          <div className="workspace-events">
            <DtCard title={t(Messages.WORKSPACE_WISHLIST)} muted>
              {event.wishlistUpdates.length ? (
                <ul>
                  {event.wishlistUpdates.map((entry) => (
                    <li key={entry.id}>
                      {entry.title} · {entry.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t(Messages.WORKSPACE_EMPTY_WISHLIST)}</p>
              )}
            </DtCard>
          </div>
          <p className="workspace-meta">
            <strong>{t(Messages.WORKSPACE_PREVIEW_TITLE)}:</strong> {toIso(openDate)} · {session.events.length} {t(Messages.WORKSPACE_EVENTS)}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dt-canvas landing">
        <DtHeader
          logo={<a className="brand" href="#top"><img src="/images/high_dimension_logo.png" alt="" /><strong>Digitable.HappyCalendar</strong></a>}
        nav={landingNavItems}
        actions={
          <>
            <LanguagePicker />
            <DtButton size="sm" onClick={openWorkspace}>
              {t(Messages.ACTION_OPEN_PAYLOAD)}
            </DtButton>
          </>
        }
      />

      <section className="hero" id="top">
        <div className="hero-copy">
          <DtBadge>{t(Messages.HERO_BADGE)}</DtBadge>
          <h1>{t(Messages.HERO_TITLE).replace('.', '.\n')}</h1>
          <p>{t(Messages.HERO_DESCRIPTION)}</p>
          <div className="actions">
            <DtButton variant="primary" size="lg" onClick={openWorkspace}>
              {t(Messages.ACTION_TRY_DEMO)}
            </DtButton>
            <a className="dt-btn dt-btn--secondary dt-btn--lg" href="#hash">{t(Messages.ACTION_HOW_HASH_WORKS)}</a>
          </div>
          <div className="tags">{principles.map((x) => <DtTag key={x}>{t(x)}</DtTag>)}</div>
        </div>

        <aside className="demo-panel" id="demo" aria-label="Демо хеш-сессии">
          <div className="demo-panel__top">
            <div>
              <span className="eyebrow">{t(Messages.DEMO_LABEL)}</span>
              <h2>{session.groupName}</h2>
            </div>
            <span className={isFresh ? 'status status--fresh' : 'status'}>{isFresh ? t(Messages.DEMO_NEWER) : t(Messages.DEMO_SAME)}</span>
          </div>

          <div className="editor-grid">
            <label>
              <span>{t(Messages.DEMO_GROUP)}</span>
              <input value={session.groupName} onChange={(event) => updateSession((current) => ({ ...current, groupName: event.target.value }))} />
            </label>
            <label>
              <span>{t(Messages.DEMO_SECRET)}</span>
              <input value={secret} onChange={(event) => setSecret(event.target.value)} />
            </label>
            <label className="range-field">
              <span>{t(Messages.DEMO_CATEGORY_BUDGET, { category: event.categoryBudget.title, budget: formattedCategoryBudget })}</span>
              <input
                type="range"
                min="1000"
                max="12000"
                step="500"
                value={clamp(budgetInput, 1000, 12000)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  updateEvent((currentEvent) => ({
                    ...currentEvent,
                    categoryBudget: { ...currentEvent.categoryBudget, budget: { ...currentEvent.categoryBudget.budget, amount: next } },
                  }));
                }}
              />
            </label>
          </div>

          <div className="event-card">
            <div>
              <strong>{event.title}</strong>
              <p>{formattedEventDate} · {t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })} · {event.categoryBudget.title}</p>
            </div>
            <b>{formattedEventBudget}</b>
          </div>

          <dl className="hash-list">
            <div><dt>{t(Messages.HASH_PAYLOAD)}</dt><dd><code>{shorten(payload)}</code></dd></div>
            <div><dt>{t(Messages.HASH_FINGERPRINT)}</dt><dd><code>{fingerprint}</code></dd></div>
            <div><dt>{t(Messages.HASH_ROUND_TRIP)}</dt><dd>{isFresh ? t(Messages.DEMO_ROUND_TRIP_OK) : t(Messages.DEMO_ROUND_TRIP_CHANGED)}</dd></div>
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
