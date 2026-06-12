import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { DtBadge, DtButton, DtCard, DtHeader, DtTag } from '../../shared/digitable/DigitableUI';
import { demoSession } from '../../entities/session/fixtures';
import { type CalendarEvent, type EventFormat, type EventGroup, type SessionState } from '../../entities/session/model';
import { createSessionFingerprint, createSessionPayload, isNewerSession, readSessionPayload } from '../../entities/session/hashSession';
import { addEventToGroup, addGroupWithEvent, buildDraftEvent, removeEventFromSession } from '../../entities/session/sessionOperations';
import { LanguagePicker, Messages, useTranslate } from '../../shared/i18n';
import { features, functionalCore, platforms, principles } from './content';
import './landing.css';

type AppView = 'landing' | 'workspace';
type DemoEventCount = 1 | 10 | 1000;

const EVENT_FORMAT_OPTIONS: ReadonlyArray<EventFormat> = ['organized', 'drop-in', 'remote', 'gift-only'];
const DEMO_EVENT_COUNTS: ReadonlyArray<DemoEventCount> = [1, 10, 1000];

const getDemoCategory = (index: number): string => {
  if (index % 4 === 0) return 'Семейный ужин';
  if (index % 4 === 1) return 'День рождения';
  if (index % 4 === 2) return 'Юбилей';
  return 'Событие';
};

const getDemoLabel = (value: number, locale: string): string => {
  if (locale.startsWith('ru')) {
    if (value === 1) return '1 событие';
    return `${value} событий`;
  }
  if (value === 1) return '1 event';
  return `${value} events`;
};

const buildDemoSession = (eventCount: DemoEventCount): SessionState => {
  const count = Math.max(1, eventCount);
  const baseDate = new Date(2026, 0, 1);
  const events = Array.from({ length: count }, (_, index) =>
    buildDraftEvent({
      title: `Событие ${index + 1}`,
      categoryTitle: getDemoCategory(index),
      date: toIso(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + index)),
      format: EVENT_FORMAT_OPTIONS[index % EVENT_FORMAT_OPTIONS.length],
      budget: 3000 + ((index * 500) % 8000),
      createId: () => `demo-event-${count}-${index + 1}`,
    })
  );

  return {
    ...demoSession,
    groupName: `Demo ${count}`,
    createdAt: '2026-06-10T09:00:00.000Z',
    updatedAt: new Date('2026-06-11T08:30:00.000Z').toISOString(),
    events,
    eventGroups: [{ id: `group-demo-${count}`, title: `Демонстрация (${count} событий)`, eventIds: events.map((event) => event.id) }],
  };
};

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

const findPrimaryEvent = (session: SessionState): CalendarEvent => session.events[0] as CalendarEvent;
const selectActiveGroup = (
  session: SessionState,
  groupId: string,
  eventId: string
): [EventGroup | undefined, CalendarEvent | undefined] => {
  const selectedGroup = session.eventGroups.find((group) => group.id === groupId) ?? session.eventGroups[0];
  const normalizedEvent = session.events.find(
    (event) => event.id === eventId && (selectedGroup ? selectedGroup.eventIds.includes(event.id) : false)
  ) ?? (selectedGroup ? session.events.find((event) => selectedGroup.eventIds.includes(event.id)) : undefined) ?? session.events[0];
  if (!selectedGroup) {
    return [session.eventGroups[0], normalizedEvent];
  }
  return [selectedGroup, normalizedEvent];
};

export const LandingPage = () => {
  const intl = useIntl();
  const t = useTranslate();
  const [view, setView] = useState<AppView>('landing');
  const [activeDemoCount, setActiveDemoCount] = useState<DemoEventCount>(DEMO_EVENT_COUNTS[0]);
  const [sessionState, setSessionState] = useState<SessionState>(() =>
    buildDemoSession(activeDemoCount)
  );
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
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [groupDraftTitle, setGroupDraftTitle] = useState('Новая группа');
  const [eventDraftTitle, setEventDraftTitle] = useState('Новое событие');

  const session = sessionState;
  const payload = useMemo(() => createSessionPayload(session), [session]);
  const isFresh = isNewerSession(session, demoSession);
  const participantsCount = session.participants.length;
  const monthDays = useMemo(() => pickMonthDays(calendarMonth), [calendarMonth]);
  const isCurrentMonth = (value: Date) => value.getMonth() === calendarMonth.getMonth() && value.getFullYear() === calendarMonth.getFullYear();
  const monthLabel = intl.formatDate(calendarMonth, { month: 'long', year: 'numeric' });
  const weekdays = useMemo(() => {
    const weekBase = new Date(2026, 0, 4);
    return Array.from({ length: 7 }, (_, index) => intl.formatDate(new Date(2026, 0, 4 + index), { weekday: 'short' }));
  }, [intl]);

  const [selectedGroup, selectedWorkspaceEvent] = useMemo(
    () => selectActiveGroup(session, selectedGroupId, selectedEventId),
    [session, selectedGroupId, selectedEventId]
  );
  const workspaceGroupEvents = selectedGroup ? session.events.filter((item) => selectedGroup.eventIds.includes(item.id)) : [];
  const workspaceEvent = selectedWorkspaceEvent ?? session.events[0];
  const landingEvent = findPrimaryEvent(session);
  const selectedDate = workspaceEvent?.date ?? workspaceGroupEvents[0]?.date ?? toIso(new Date());

  const activeBudget = workspaceEvent?.categoryBudget;
  const formattedCategoryBudget = activeBudget
    ? intl.formatNumber(activeBudget.budget.amount, { style: 'currency', currency: activeBudget.budget.currency, maximumFractionDigits: 0 })
    : '';
  const formattedEventBudget = activeBudget
    ? intl.formatNumber(activeBudget.budget.amount, { style: 'currency', currency: activeBudget.budget.currency, maximumFractionDigits: 0 })
    : '';
  const formattedEventDate = workspaceEvent
    ? intl.formatDate(new Date(workspaceEvent.date), { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const formattedLandingEventBudget = intl.formatNumber(landingEvent.categoryBudget.budget.amount, {
    style: 'currency',
    currency: landingEvent.categoryBudget.budget.currency,
    maximumFractionDigits: 0,
  });
  const formattedLandingEventDate = intl.formatDate(new Date(landingEvent.date), { day: 'numeric', month: 'long', year: 'numeric' });
  const workspaceOpenDate = new Date(selectedDate);

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

  useEffect(() => {
    if (!session.eventGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(session.eventGroups[0]?.id ?? '');
      return;
    }
    if (!session.events.some((event) => event.id === selectedEventId)) {
      const fallback = workspaceGroupEvents[0] ?? session.events[0];
      setSelectedEventId(fallback?.id ?? '');
    }
  }, [session.eventGroups, session.events, selectedGroupId, selectedEventId, workspaceGroupEvents]);

  useEffect(() => {
    const targetGroup = session.eventGroups.find((group) => group.id === selectedGroupId);
    const eventInGroup = selectedEventId && targetGroup?.eventIds.includes(selectedEventId);
    if (!targetGroup || !eventInGroup) {
      const fallback = targetGroup?.eventIds[0] ?? session.events[0]?.id ?? '';
      setSelectedEventId(fallback);
    }
  }, [session.events, selectedGroupId, selectedEventId, session.eventGroups]);

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

  const updateEvent = (eventId: string, updater: (current: CalendarEvent) => CalendarEvent) => {
    updateSession((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === eventId ? updater(item) : item)),
    }));
  };

  const addEvent = (groupId: string, title: string) => {
    if (!groupId) return;
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const nextEvent = buildDraftEvent({ title: nextTitle });
    updateSession((current) => addEventToGroup(current, groupId, nextEvent));
    setSelectedGroupId(groupId);
    setSelectedEventId(nextEvent.id);
    setEventDraftTitle('Новое событие');
  };

  const addGroup = () => {
    const groupTitle = groupDraftTitle.trim();
    if (!groupTitle) return;
    const newEvent = buildDraftEvent();
    const newGroupId = `group-${Math.random().toString(16).slice(2)}`;
    const { group, state } = addGroupWithEvent(session, groupTitle, newEvent, { groupId: newGroupId });
    updateSession(() => state);
    setSelectedGroupId(group.id);
    setSelectedEventId(group.eventIds[0] ?? '');
    setGroupDraftTitle('Новая группа');
  };

  const applyDemoSession = (eventCount: DemoEventCount) => {
    setActiveDemoCount(eventCount);
    setSessionState(buildDemoSession(eventCount));
    setSelectedGroupId(`group-demo-${eventCount}`);
    setSelectedEventId(`demo-event-${eventCount}-1`);
    setImportPayload('');
  };

  const removeEvent = (eventId: string) => {
    if (session.events.length <= 1) {
      return;
    }

    updateSession((current) => removeEventFromSession(current, eventId));
    setSelectedEventId('');
    setImportMessage(null);
  };

  const applyPayload = async () => {
    try {
      const restored = readSessionPayload(importPayload);
      setSessionState(restored);
      setSelectedGroupId(restored.eventGroups[0]?.id ?? '');
      setSelectedEventId(restored.events[0]?.id ?? '');
      setImportMessage(Messages.WORKSPACE_IMPORT_SUCCESS);
      setView('workspace');
      window.location.hash = '#workspace';
      return;
    } catch {
      setImportMessage(Messages.WORKSPACE_IMPORT_ERROR);
      return;
    }
  };

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
          logo={
            <a className="brand" href="#top">
              <img src="/images/high_dimension_logo.png" alt="" />
              <strong>Digitable.HappyCalendar</strong>
            </a>
          }
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
                          if (!workspaceEvent) return;
                          updateEvent(workspaceEvent.id, (currentEvent) => ({ ...currentEvent, date: dayIso }));
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
                  <strong>{workspaceEvent?.title ?? t(Messages.WORKSPACE_EMPTY_EVENT)}</strong>
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
                  <span>{t(Messages.WORKSPACE_GROUP_TITLE)}</span>
                  <div className="workspace-groups">
                    <select
                      value={selectedGroup?.id ?? ''}
                      onChange={(value) => setSelectedGroupId(value.target.value)}
                    >
                      {session.eventGroups.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.title}
                        </option>
                      ))}
                    </select>
                    <div className="workspace-groups-actions">
                      <input value={groupDraftTitle} onChange={(value) => setGroupDraftTitle(value.target.value)} placeholder={t(Messages.WORKSPACE_GROUP_PLACEHOLDER)} />
                      <DtButton size="sm" onClick={addGroup}>
                        {t(Messages.WORKSPACE_ADD_GROUP)}
                      </DtButton>
                    </div>
                  </div>
                </label>

                <label>
                  <span>{t(Messages.WORKSPACE_EVENT_TITLE)}</span>
                  <input
                    value={workspaceEvent?.title ?? ''}
                    onChange={(value) => {
                      if (!workspaceEvent) return;
                      updateEvent(workspaceEvent.id, (current) => ({ ...current, title: value.target.value }));
                    }}
                  />
                </label>

                <label>
                  <span>{t(Messages.WORKSPACE_EVENT_DATE)}</span>
                  <input
                    type="date"
                    value={toInputDate(workspaceEvent?.date ?? toIso(new Date()))}
                    onChange={(value) => {
                      if (!workspaceEvent) return;
                      const normalized = toInputDate(value.target.value);
                      updateEvent(workspaceEvent.id, (current) => ({ ...current, date: normalized }));
                      setCalendarMonth((current) => {
                        const nextDate = new Date(normalized);
                        return current.getMonth() === nextDate.getMonth() && current.getFullYear() === nextDate.getFullYear()
                          ? current
                          : new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
                      });
                    }}
                  />
                </label>

                <label>
                  <span>{t(Messages.WORKSPACE_FORMAT)}</span>
                  <select
                    value={workspaceEvent?.format ?? EVENT_FORMAT_OPTIONS[0]}
                    onChange={(value) => {
                      if (!workspaceEvent) return;
                      updateEvent(workspaceEvent.id, (current) => ({ ...current, format: value.target.value as EventFormat }));
                    }}
                  >
                    {EVENT_FORMAT_OPTIONS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="range-field">
                  <span>{t(Messages.DEMO_CATEGORY_BUDGET, { category: activeBudget?.title ?? '—', budget: formattedCategoryBudget })}</span>
                  <input
                    type="range"
                    min="1000"
                    max="12000"
                    step="500"
                    value={clamp(activeBudget?.budget.amount ?? 3000, 1000, 12000)}
                    onChange={(value) => {
                      if (!workspaceEvent || !activeBudget) return;
                      const nextBudget = Number(value.target.value);
                      updateEvent(workspaceEvent.id, (currentEvent) => ({
                        ...currentEvent,
                        categoryBudget: { ...currentEvent.categoryBudget, budget: { ...currentEvent.categoryBudget.budget, amount: nextBudget } },
                      }));
                    }}
                  />
                </label>

                <div className="workspace-event-actions">
                  <DtButton
                    variant="ghost"
                    onClick={() => workspaceEvent?.id && removeEvent(workspaceEvent.id)}
                    disabled={session.events.length <= 1}
                    size="sm"
                  >
                    {t(Messages.WORKSPACE_DELETE_EVENT)}
                  </DtButton>
                </div>

                <label className="workspace-event-adder">
                  <span>{t(Messages.WORKSPACE_ADD_EVENT)}</span>
                  <input value={eventDraftTitle} onChange={(value) => setEventDraftTitle(value.target.value)} />
                  <DtButton onClick={() => addEvent(selectedGroup?.id ?? session.eventGroups[0]?.id ?? '', eventDraftTitle)} size="sm">
                    {t(Messages.WORKSPACE_ADD_EVENT)}
                  </DtButton>
                </label>
              </div>

              <div className="workspace-event-summary">
                <h3>{workspaceEvent?.title ?? ''}</h3>
                <p>{t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })}</p>
                <p>{activeBudget?.title}</p>
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
                    <dd>
                      <code>{fingerprint}</code>
                    </dd>
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
              <p className="workspace-event-group-title">
                {t(Messages.WORKSPACE_EVENTS)}: {selectedGroup?.title}
              </p>
              {workspaceEvent?.wishlistUpdates.length ? (
                <ul>
                  {workspaceEvent?.wishlistUpdates.map((entry) => (
                    <li key={entry.id}>
                      {entry.title} · {entry.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t(Messages.WORKSPACE_EMPTY_WISHLIST)}</p>
              )}
            </DtCard>
            <DtCard title={t(Messages.WORKSPACE_EVENTS)} muted>
              {workspaceGroupEvents.length ? (
                <ul className="workspace-event-list">
                  {workspaceGroupEvents.map((entry) => (
                    <li key={entry.id}>
                      <div className={`workspace-event-list__item${entry.id === workspaceEvent?.id ? ' workspace-event-list__item--active' : ''}`}>
                        <button
                          onClick={() => {
                            setSelectedEventId(entry.id);
                            setSelectedGroupId(selectedGroup?.id ?? '');
                          }}
                          type="button"
                        >
                          <span>{entry.title}</span>
                          <span>{intl.formatDate(new Date(entry.date), { month: 'numeric', day: 'numeric' })}</span>
                        </button>
                        <DtButton
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEvent(entry.id)}
                          disabled={session.events.length <= 1}
                        >
                          {t(Messages.WORKSPACE_DELETE_EVENT)}
                        </DtButton>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t(Messages.WORKSPACE_EMPTY_EVENTS)}</p>
              )}
            </DtCard>
          </div>
          <p className="workspace-meta">
            <strong>{t(Messages.WORKSPACE_PREVIEW_TITLE)}:</strong> {toIso(workspaceOpenDate)} · {session.events.length} {t(Messages.WORKSPACE_EVENTS)}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dt-canvas landing">
      <DtHeader
        logo={
          <a className="brand" href="#top">
            <img src="/images/high_dimension_logo.png" alt="" />
            <strong>Digitable.HappyCalendar</strong>
          </a>
        }
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
            <a className="dt-btn dt-btn--secondary dt-btn--lg" href="#hash">
              {t(Messages.ACTION_HOW_HASH_WORKS)}
            </a>
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

          <div className="demo-tabs" role="tablist" aria-label="Demo payload presets">
            {DEMO_EVENT_COUNTS.map((entry) => (
              <button
                className={`demo-tab${activeDemoCount === entry ? ' demo-tab--active' : ''}`}
                key={entry}
                onClick={() => applyDemoSession(entry)}
                type="button"
              >
                {getDemoLabel(entry, intl.locale)}
              </button>
            ))}
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
              <span>{t(Messages.DEMO_CATEGORY_BUDGET, { category: landingEvent.categoryBudget.title, budget: formattedLandingEventBudget })}</span>
              <input
                type="range"
                min="1000"
                max="12000"
                step="500"
                value={clamp(landingEvent.categoryBudget.budget.amount, 1000, 12000)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!landingEvent) return;
                  updateEvent(landingEvent.id, (currentEvent) => ({
                    ...currentEvent,
                    categoryBudget: { ...currentEvent.categoryBudget, budget: { ...currentEvent.categoryBudget.budget, amount: next } },
                  }));
                }}
              />
            </label>
          </div>

          <div className="event-card">
            <div>
              <strong>{landingEvent.title}</strong>
              <p>
                {formattedLandingEventDate} · {t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })} · {landingEvent.categoryBudget.title}
              </p>
            </div>
            <b>{formattedLandingEventBudget}</b>
          </div>

          <dl className="hash-list">
            <div>
              <dt>{t(Messages.HASH_PAYLOAD)}</dt>
              <dd>
                <code>{shorten(payload)}</code>
              </dd>
            </div>
            <div>
              <dt>{t(Messages.HASH_FINGERPRINT)}</dt>
              <dd>
                <code>{fingerprint}</code>
              </dd>
            </div>
            <div>
              <dt>{t(Messages.HASH_ROUND_TRIP)}</dt>
              <dd>{isFresh ? t(Messages.DEMO_ROUND_TRIP_OK) : t(Messages.DEMO_ROUND_TRIP_CHANGED)}</dd>
            </div>
          </dl>

          <DtButton variant="ghost" onClick={copyPayload}>
            {t(copyState)}
          </DtButton>
        </aside>
      </section>

      <section className="section" id="idea">
        <p className="eyebrow">{t(Messages.IDEA_EYEBROW)}</p>
        <h2>{t(Messages.IDEA_TITLE)}</h2>
        <div className="idea-visual" aria-hidden="true">
          <img src="/images/happy-calendar-brand-bg.png" alt="" />
          <span className="idea-visual__mark">
            <img src="/images/high_dimension_logo.png" alt="" />
          </span>
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
            {functionalCore.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
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
