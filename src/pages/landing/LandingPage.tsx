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
type WorkspaceMode = 'wizard' | 'assistant';
type WorkspaceWizardPanel = 'events' | 'wishlist';
type LlmDraftEvent = {
  title: string;
  date?: string;
  format?: EventFormat;
  categoryTitle?: string;
  budget?: number;
};

type LlmDraftPlan = {
  groupTitle: string;
  events: LlmDraftEvent[];
};

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

const FAMILY_GROUP_TITLE = 'Семья';
const LLM_FALLBACK_GROUP_TITLE = 'События из чата';
const LLM_WIZARD_SAMPLE_PROMPT = `Семья:
День рождения матери | 2026-01-12
Семейный ужин | 2026-01-13`;
const LLM_WIZARD_SAMPLE_PLAN: Readonly<LlmDraftPlan> = {
  groupTitle: 'Семейные даты',
  events: [
    { title: 'День рождения матери', date: '2026-01-12', format: 'organized', categoryTitle: 'День рождения', budget: 3000 },
    { title: 'Семейный ужин', date: '2026-01-13', format: 'gift-only', categoryTitle: 'Семейный ужин', budget: 3000 },
  ],
};
const WISHLIST_PRIORITY_ORDER: ReadonlyArray<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
const toAssistantSamplePayload = () => JSON.stringify(LLM_WIZARD_SAMPLE_PLAN, null, 2);

const normalizeWishlistStatus = (value: CalendarEvent['wishlistUpdates'][number]['status']) => {
  const normalized = String(value).toLowerCase();
  return normalized === 'gifted' || normalized === 'archived' ? normalized : 'wanted';
};

const normalizeWishlistPriority = (value: CalendarEvent['wishlistUpdates'][number]['priority']) => {
  const normalized = String(value).toLowerCase();
  return normalized === 'low' || normalized === 'high' ? normalized : 'medium';
};

const parseLlmFormat = (value: unknown): EventFormat => {
  if (value === 'organized' || value === 'drop-in' || value === 'remote' || value === 'gift-only') {
    return value;
  }
  return 'organized';
};

const normalizeLlmDate = (value: string, fallback: string): string => {
  const candidate = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return candidate ?? fallback;
};

const parseEventLine = (line: string, index: number, fallbackDate: string): LlmDraftEvent => {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      title: `Событие ${index + 1}`,
      date: fallbackDate,
      format: 'organized',
      budget: 3000,
    };
  }

  const parts = trimmed.split('|').map((entry) => entry.trim()).filter(Boolean);
  const dateFromLine = parts.map((entry) => normalizeLlmDate(entry, '')).find(Boolean);
  const title = parts.find((entry) => !/\d{4}-\d{2}-\d{2}/.test(entry)) ?? trimmed;
  const normalized: LlmDraftEvent = {
    title,
    date: dateFromLine || fallbackDate,
    format: parts.some((entry) => /удаленно|remote/.test(entry.toLowerCase())) ? 'remote' : undefined,
    budget: 3000,
  };
  return normalized;
};

const buildLlmDraftFromText = (text: string, fallbackDate: string): LlmDraftPlan => {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      groupTitle: LLM_FALLBACK_GROUP_TITLE,
      events: [{ title: 'Событие 1', date: fallbackDate, format: 'organized', budget: 3000 }],
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return {
        groupTitle: LLM_FALLBACK_GROUP_TITLE,
          events: parsed
          .map((item) => ({
            title: item?.title ?? 'Событие',
            date: normalizeLlmDate(item?.date ?? '', fallbackDate),
            format: parseLlmFormat(item?.format),
            categoryTitle: item?.categoryTitle ?? 'Другое',
            budget: Number(item?.budget ?? 3000),
          }))
          .filter((entry) => Boolean(entry.title)),
      };
    }

    if (parsed && typeof parsed === 'object' && 'events' in parsed) {
      const candidate = Array.isArray((parsed as { events: unknown }).events)
        ? (parsed as { events: Array<Record<string, unknown>> }).events
        : [];
      const parsedGroupTitle = String((parsed as { groupTitle?: string }).groupTitle).trim() || LLM_FALLBACK_GROUP_TITLE;
      return {
        groupTitle: parsedGroupTitle || LLM_FALLBACK_GROUP_TITLE,
        events: candidate
          .map((entry, index) => ({
            title: String(entry?.title ?? `Событие ${index + 1}`),
            date: normalizeLlmDate(String(entry?.date ?? ''), fallbackDate),
            format: parseLlmFormat(entry?.format),
            categoryTitle: String(entry?.categoryTitle ?? 'Другое'),
            budget: Number(entry?.budget ?? 3000),
          }))
          .filter((entry) => Boolean(entry.title)),
      };
    }
  } catch {
    // mocked parser fallback
  }

  const split = trimmed
    .replace(/\s*[,;]\s*/g, '\n')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const titleLine = split.find((entry) => !entry.match(/^\d+\s*событ/iu));
  const groupTitle = split.find((entry) => entry.match(/^групп[а-яa-z]+/i))?.replace(/^групп[а-яa-z]+:*/i, '').trim() || LLM_FALLBACK_GROUP_TITLE;
  const fallbackTitle = titleLine ?? LLM_FALLBACK_GROUP_TITLE;
  const events: LlmDraftEvent[] = split.length
    ? split.map((line, index) => parseEventLine(line, index, fallbackDate))
    : [{ title: fallbackTitle, date: fallbackDate, format: 'organized', budget: 3000 }];

  return {
    groupTitle: groupTitle || LLM_FALLBACK_GROUP_TITLE,
    events,
  };
};

const buildDemoSession = (eventCount: DemoEventCount): SessionState => {
  const count = Math.max(1, eventCount);
  const baseDate = new Date(2026, 0, 1);
  const baseEvents = Array.from({ length: count }, (_, index) =>
    buildDraftEvent({
      title: `Событие ${index + 1}`,
      categoryTitle: getDemoCategory(index),
      date: toIso(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + index)),
      format: EVENT_FORMAT_OPTIONS[index % EVENT_FORMAT_OPTIONS.length],
      budget: 3000 + ((index * 500) % 8000),
      createId: () => `demo-event-${count}-${index + 1}`,
    })
  );
  const events = baseEvents.map((event, index) => {
    const author = demoSession.participants[index % demoSession.participants.length];
    return {
      ...event,
      authorNickname: author?.nickname,
      authorAvatarSeed: author?.avatarSeed,
    };
  });

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
const resolveAuthorForEvent = (event: CalendarEvent | undefined, participants: ReadonlyArray<{ nickname: string; avatarSeed: string }>) => {
  if (!event) return participants[0];
  if (event.authorNickname) {
    return (
      participants.find((entry) => entry.nickname === event.authorNickname) ?? {
        nickname: event.authorNickname,
        avatarSeed: event.authorAvatarSeed ?? `${event.authorNickname.toLowerCase()}-seed`,
      }
    );
  }

  if (!participants.length) {
    return { nickname: 'Неизвестный', avatarSeed: 'default-avatar' };
  }

  let hash = 0;
  for (let index = 0; index < event.id.length; index++) {
    hash = (hash * 31 + event.id.charCodeAt(index)) % 97_237;
  }
  return participants[hash % participants.length];
};
const createWishlistId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `wishlist-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
  const [hasCopiedPayload, setHasCopiedPayload] = useState(false);
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
  const [wishlistDraftTitle, setWishlistDraftTitle] = useState('');
  const [wishlistDraftPriority, setWishlistDraftPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('wizard');
  const [workspaceWizardPanel, setWorkspaceWizardPanel] = useState<WorkspaceWizardPanel>('events');
  const [assistantPrompt, setAssistantPrompt] = useState(LLM_WIZARD_SAMPLE_PROMPT);
  const [assistantPayload, setAssistantPayload] = useState('');
  const [assistantError, setAssistantError] = useState('');

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
  const eventAuthor = resolveAuthorForEvent(workspaceEvent, session.participants);
  const formattedLandingEventBudget = intl.formatNumber(landingEvent.categoryBudget.budget.amount, {
    style: 'currency',
    currency: landingEvent.categoryBudget.budget.currency,
    maximumFractionDigits: 0,
  });
  const formattedLandingEventDate = intl.formatDate(new Date(landingEvent.date), { day: 'numeric', month: 'long', year: 'numeric' });
  const workspaceOpenDate = new Date(selectedDate);
  const hasFamilyGroup = session.eventGroups.some((entry) => entry.title.toLowerCase() === FAMILY_GROUP_TITLE.toLowerCase());
  const familySeedDate = session.events[0]?.date ?? toIso(new Date());
  const nextFamilyAuthor = session.participants[0];
  const familyGroup = session.eventGroups.find((entry) => entry.title.toLowerCase() === FAMILY_GROUP_TITLE.toLowerCase());
  const familyEventCount = familyGroup ? familyGroup.eventIds.length : 0;
  const familyActiveEvent = familyGroup ? session.events.find((entry) => familyGroup.eventIds.includes(entry.id)) : undefined;
  const familyGuideSteps = [
    {
      key: Messages.WORKSPACE_FAMILY_STEP_GROUP,
      done: hasFamilyGroup,
    },
    {
      key: Messages.WORKSPACE_FAMILY_STEP_EVENT,
      done: familyEventCount > 0,
    },
    {
      key: Messages.WORKSPACE_FAMILY_STEP_DATE,
      done: selectedGroup?.id === familyGroup?.id && familyActiveEvent?.id === selectedEventId,
    },
    {
      key: Messages.WORKSPACE_FAMILY_STEP_WISHLIST,
      done: Boolean(selectedGroup?.id === familyGroup?.id && (selectedEventId ? (workspaceEvent?.wishlistUpdates.length ?? 0) > 0 : false)),
    },
    {
      key: Messages.WORKSPACE_FAMILY_STEP_SHARE,
      done: hasCopiedPayload,
    },
  ];

  const wishlistStatusLabel = (status: CalendarEvent['wishlistUpdates'][number]['status']) => {
    const normalized = normalizeWishlistStatus(status);
    if (normalized === 'gifted') return t(Messages.WORKSPACE_WISHLIST_STATUS_GIFTED);
    if (normalized === 'archived') return t(Messages.WORKSPACE_WISHLIST_STATUS_ARCHIVED);
    return t(Messages.WORKSPACE_WISHLIST_STATUS_WANTED);
  };

  const wishlistPriorityLabel = (priority: CalendarEvent['wishlistUpdates'][number]['priority']) => {
    const normalized = normalizeWishlistPriority(priority);
    if (normalized === 'low') return t(Messages.WORKSPACE_PRIORITY_LOW);
    if (normalized === 'high') return t(Messages.WORKSPACE_PRIORITY_HIGH);
    return t(Messages.WORKSPACE_PRIORITY_MEDIUM);
  };

  useEffect(() => {
    const syncFromHash = () => setView(window.location.hash === '#workspace' ? 'workspace' : 'landing');
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (view === 'workspace') {
      setImportPayload(payload);
      setHasCopiedPayload(false);
    }
  }, [payload, view]);

  useEffect(() => {
    if (workspaceMode === 'assistant') {
      setAssistantPrompt(LLM_WIZARD_SAMPLE_PROMPT);
      setAssistantPayload(toAssistantSamplePayload());
      setAssistantError('');
      return;
    }

    setAssistantPayload('');
    setAssistantError('');
  }, [workspaceMode]);

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
    const nextAuthor = session.participants[session.events.length % Math.max(session.participants.length, 1)];
    const nextEvent = buildDraftEvent({
      title: nextTitle,
      authorNickname: nextAuthor?.nickname,
      authorAvatarSeed: nextAuthor?.avatarSeed,
    });
    updateSession((current) => addEventToGroup(current, groupId, nextEvent));
    setSelectedGroupId(groupId);
    setSelectedEventId(nextEvent.id);
    setEventDraftTitle('Новое событие');
  };

  const addGroup = () => {
    const groupTitle = groupDraftTitle.trim();
    if (!groupTitle) return;
    const nextAuthor = session.participants[session.events.length % Math.max(session.participants.length, 1)];
    const newEvent = buildDraftEvent({
      authorNickname: nextAuthor?.nickname,
      authorAvatarSeed: nextAuthor?.avatarSeed,
    });
    const newGroupId = `group-${Math.random().toString(16).slice(2)}`;
    const { group, state } = addGroupWithEvent(session, groupTitle, newEvent, { groupId: newGroupId });
    updateSession(() => state);
    setSelectedGroupId(group.id);
    setSelectedEventId(group.eventIds[0] ?? '');
    setGroupDraftTitle('Новая группа');
  };

  const ensureFamilyGroup = () => {
    const existingFamilyGroup = session.eventGroups.find((entry) => entry.title.toLowerCase() === FAMILY_GROUP_TITLE.toLowerCase());
    if (existingFamilyGroup) {
      setSelectedGroupId(existingFamilyGroup.id);
      setSelectedEventId(existingFamilyGroup.eventIds[0] ?? '');
      return;
    }

    const nextEvent = buildDraftEvent({
      title: 'Семейный вечер',
      date: familySeedDate,
      authorNickname: nextFamilyAuthor?.nickname,
      authorAvatarSeed: nextFamilyAuthor?.avatarSeed,
    });
    const { group, state } = addGroupWithEvent(session, FAMILY_GROUP_TITLE, nextEvent, {
      groupId: `family-${Date.now()}`,
    });
    updateSession(() => state);
    setSelectedGroupId(group.id);
    setSelectedEventId(group.eventIds[0] ?? '');
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

  const generateAssistantPayload = () => {
    const plan = buildLlmDraftFromText(assistantPrompt, selectedDate);
    setAssistantPayload(JSON.stringify(plan, null, 2));
    setAssistantError('');
  };

  const applyAssistantPayload = () => {
    try {
      const parsed = assistantPayload ? JSON.parse(assistantPayload) as LlmDraftPlan : null;
      if (!parsed || !Array.isArray(parsed.events) || parsed.events.length === 0) {
        setAssistantError(t(Messages.WORKSPACE_LLM_INVALID_JSON));
        return;
      }
      const baseDate = familySeedDate;
      const authorBase = session.participants[session.events.length % Math.max(session.participants.length, 1)];
      const groupTitle = String(parsed.groupTitle || LLM_FALLBACK_GROUP_TITLE);
      const groupId = `group-llm-${Date.now()}`;
      const initialEvent = buildDraftEvent({
        title: parsed.events[0]?.title || 'Событие',
        date: normalizeLlmDate(parsed.events[0]?.date ?? '', baseDate),
        format: parsed.events[0]?.format ?? 'organized',
        categoryTitle: parsed.events[0]?.categoryTitle,
        budget: parsed.events[0]?.budget ?? 3000,
        authorNickname: authorBase?.nickname,
        authorAvatarSeed: authorBase?.avatarSeed,
      });

      const { state: baseState, group } = addGroupWithEvent(session, groupTitle, initialEvent, {
        groupId,
      });

      const nextState = parsed.events.slice(1).reduce((acc, entry, index) => {
        const fallback = session.participants[(session.events.length + index) % Math.max(session.participants.length, 1)];
        const draft = buildDraftEvent({
          title: entry.title,
          date: normalizeLlmDate(entry.date ?? '', baseDate),
          format: entry.format ?? 'organized',
          categoryTitle: entry.categoryTitle,
          budget: entry.budget ?? 3000,
          authorNickname: fallback?.nickname,
          authorAvatarSeed: fallback?.avatarSeed,
        });
        return addEventToGroup(acc, group.id, draft);
      }, baseState);

      updateSession(() => nextState);
      setSelectedGroupId(group.id);
      setSelectedEventId(group.eventIds[0] ?? '');
      setWorkspaceMode('wizard');
      setAssistantPayload('');
      setAssistantError('');
    } catch {
      setAssistantError(t(Messages.WORKSPACE_LLM_INVALID_JSON));
    }
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setHasCopiedPayload(true);
      setCopyState(Messages.ACTION_PAYLOAD_COPIED);
    } catch {
      setCopyState(Messages.ACTION_COPY_FROM_PAYLOAD);
    }
    window.setTimeout(() => setCopyState(Messages.ACTION_COPY_PAYLOAD), 1800);
  };

  const formattedCalendarDate = (value: Date) => intl.formatDate(value, { day: 'numeric' });
  const addToWishlist = () => {
    const nextTitle = wishlistDraftTitle.trim();
    if (!workspaceEvent || !nextTitle) return;
    updateEvent(workspaceEvent.id, (currentEvent) => ({
      ...currentEvent,
      wishlistUpdates: [
        ...currentEvent.wishlistUpdates,
        {
          id: createWishlistId(),
          title: nextTitle,
          priority: normalizeWishlistPriority(wishlistDraftPriority),
          status: normalizeWishlistStatus('wanted'),
        },
      ],
    }));
    setWishlistDraftTitle('');
    setWishlistDraftPriority('medium');
  };
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
          <p className="workspace-hint">{t(Messages.WORKSPACE_FAMILY_HINT)}</p>
          <div className="workspace-quick-start">
            <p>{hasFamilyGroup ? t(Messages.WORKSPACE_OPEN_FAMILY_GROUP) : t(Messages.WORKSPACE_CREATE_FAMILY_GROUP)}</p>
            <DtButton onClick={ensureFamilyGroup} size="sm" variant={hasFamilyGroup ? 'ghost' : 'secondary'}>
              {hasFamilyGroup ? t(Messages.WORKSPACE_OPEN_EXISTING_FAMILY_GROUP) : t(Messages.WORKSPACE_CREATE_FAMILY_GROUP)}
            </DtButton>
          </div>
          <div className="workspace-guide">
            <p className="workspace-guide__title">{t(Messages.WORKSPACE_FAMILY_GUIDE)}</p>
            <ol>
              {familyGuideSteps.map((step) => (
                <li key={step.key} className={step.done ? 'workspace-guide__step--done' : undefined}>
                  <span>{t(step.key)}</span>
                  <em>{step.done ? t(Messages.WORKSPACE_FAMILY_STEP_DONE) : t(Messages.WORKSPACE_FAMILY_STEP_PENDING)}</em>
                </li>
              ))}
            </ol>
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
                    const eventsOnDate = session.events.filter((item) => item.date === dayIso);
                    const hasEvent = eventsOnDate.length > 0;
                    const currentDateEventIndex = eventsOnDate.findIndex((entry) => entry.id === selectedEventId);
                    const dateEventsCount = eventsOnDate.length;
                    const firstEvent = eventsOnDate[0];
                    const firstEventAuthor = firstEvent ? resolveAuthorForEvent(firstEvent, session.participants) : undefined;
                    return (
                      <button
                        aria-label={dayIso}
                        title={hasEvent
                          ? `${firstEvent?.title ?? dayIso} · ${dateEventsCount} ${dateEventsCount === 1 ? 'событие' : 'событий'} · ${t(
                              Messages.WORKSPACE_EVENT_AUTHOR
                            )}: ${firstEventAuthor?.nickname ?? ''}`
                          : dayIso}
                        className={`calendar-cell${current ? '' : ' calendar-cell--other'}${selected ? ' calendar-cell--selected' : ''}`}
                        disabled={!current}
                        data-date={dayIso}
                        key={dayIso + String(day.getDate())}
                        onClick={() => {
                          if (hasEvent) {
                            const hasMultipleOnDate = eventsOnDate.length > 1;
                            const currentIndex = currentDateEventIndex >= 0 ? currentDateEventIndex : 0;
                            const nextEvent = eventsOnDate[hasMultipleOnDate ? (currentIndex + 1) % eventsOnDate.length : 0];
                            if (!nextEvent) {
                              return;
                            }
                            const targetGroup = session.eventGroups.find((entry) => entry.eventIds.includes(nextEvent.id));
                            if (targetGroup) {
                              setSelectedGroupId(targetGroup.id);
                            }
                            setSelectedEventId(nextEvent.id);
                          } else if (workspaceEvent) {
                            updateEvent(workspaceEvent.id, (currentEvent) => ({ ...currentEvent, date: dayIso }));
                          }
                          setCalendarMonth((monthState) => new Date(day.getFullYear(), day.getMonth(), 1));
                        }}
                        type="button"
                      >
                        <span>{formattedCalendarDate(day)}</span>
                        {hasEvent && <i aria-hidden />}
                        {dateEventsCount > 1 ? <small>{dateEventsCount}</small> : null}
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
                  <p>
                    {t(Messages.WORKSPACE_EVENT_AUTHOR)}: {eventAuthor?.nickname}
                  </p>
                  <p>Аватар: {eventAuthor?.avatarSeed}</p>
                  <p>{t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })}</p>
                </dd>
              </dl>
            </article>

            <article className="workspace-controls">
              <div className="workspace-mode-switch" role="tablist" aria-label="Workspace mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceMode === 'wizard'}
                  className={workspaceMode === 'wizard' ? 'workspace-mode-switch__tab workspace-mode-switch__tab--active' : 'workspace-mode-switch__tab'}
                  onClick={() => setWorkspaceMode('wizard')}
                >
                  {t(Messages.WORKSPACE_MODE_WIZARD)}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceMode === 'assistant'}
                  className={workspaceMode === 'assistant' ? 'workspace-mode-switch__tab workspace-mode-switch__tab--active' : 'workspace-mode-switch__tab'}
                  onClick={() => setWorkspaceMode('assistant')}
                >
                  {t(Messages.WORKSPACE_MODE_ASSISTANT)}
                </button>
              </div>

              {workspaceMode === 'assistant' ? (
                <div className="workspace-assistant" aria-label="AI assistant">
                  <label>
                    <span>{t(Messages.WORKSPACE_LLM_PROMPT)}</span>
                    <textarea
                      className="workspace-assistant__prompt"
                      rows={3}
                      value={assistantPrompt}
                      placeholder={t(Messages.WORKSPACE_LLM_PLACEHOLDER)}
                      onChange={(event) => setAssistantPrompt(event.target.value)}
                    />
                  </label>
                  <div className="workspace-payload-actions">
                    <DtButton size="sm" onClick={generateAssistantPayload}>
                      {t(Messages.WORKSPACE_LLM_GENERATE)}
                    </DtButton>
                  </div>

                  <label>
                    <span>{t(Messages.WORKSPACE_LLM_PREVIEW)}</span>
                    <textarea
                      className="workspace-textarea"
                      rows={5}
                      value={assistantPayload}
                      onChange={(event) => setAssistantPayload(event.target.value)}
                      placeholder='{"groupTitle":"Праздничный план","events":[...] }'
                    />
                  </label>
                  {assistantError ? <p className="workspace-state">{assistantError}</p> : null}
                  <div className="workspace-payload-actions">
                    <DtButton onClick={applyAssistantPayload}>
                      {t(Messages.WORKSPACE_LLM_APPLY)}
                    </DtButton>
                  </div>
                </div>
              ) : (
                <>
                  <div className="workspace-sub-switch" role="tablist" aria-label="Workspace wizard panel">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={workspaceWizardPanel === 'events'}
                      className={workspaceWizardPanel === 'events' ? 'workspace-sub-switch__tab workspace-mode-switch__tab--active' : 'workspace-sub-switch__tab'}
                      onClick={() => setWorkspaceWizardPanel('events')}
                    >
                      <span className="workspace-sub-switch__icon" aria-hidden="true">✚</span>
                      {t(Messages.WORKSPACE_PANEL_EVENTS)}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={workspaceWizardPanel === 'wishlist'}
                      className={workspaceWizardPanel === 'wishlist' ? 'workspace-sub-switch__tab workspace-mode-switch__tab--active' : 'workspace-sub-switch__tab'}
                      onClick={() => setWorkspaceWizardPanel('wishlist')}
                    >
                      <span className="workspace-sub-switch__icon" aria-hidden="true">♡</span>
                      {t(Messages.WORKSPACE_PANEL_WISHLIST)}
                    </button>
                  </div>
                  <div className="workspace-controls__grid">
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
                          <input
                            value={groupDraftTitle}
                            onChange={(value) => setGroupDraftTitle(value.target.value)}
                            placeholder={t(Messages.WORKSPACE_GROUP_PLACEHOLDER)}
                          />
                          <DtButton size="sm" onClick={addGroup}>
                            <span className="workspace-event-actions__icon" aria-hidden="true">＋</span>
                            {t(Messages.WORKSPACE_ADD_GROUP)}
                          </DtButton>
                        </div>
                      </div>
                    </label>

                    {workspaceWizardPanel === 'events' ? (
                      <>
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

                      <label className="workspace-event-adder">
                        <span>{t(Messages.WORKSPACE_ADD_EVENT)}</span>
                        <input
                          aria-label={t(Messages.WORKSPACE_ADD_EVENT)}
                          value={eventDraftTitle}
                            onChange={(value) => setEventDraftTitle(value.target.value)}
                          />
                          <DtButton
                            className="workspace-icon-button"
                            onClick={() => addEvent(selectedGroup?.id ?? session.eventGroups[0]?.id ?? '', eventDraftTitle)}
                            size="sm"
                            aria-label={t(Messages.WORKSPACE_ADD_EVENT)}
                          >
                            <span className="workspace-event-actions__icon" aria-hidden="true">＋</span>
                            <span>{t(Messages.WORKSPACE_ADD_EVENT)}</span>
                          </DtButton>
                        </label>

                        <div className="workspace-event-actions">
                          <DtButton
                            variant="ghost"
                            onClick={() => workspaceEvent?.id && removeEvent(workspaceEvent.id)}
                            disabled={session.events.length <= 1}
                            size="sm"
                            className="workspace-icon-button"
                            aria-label={t(Messages.WORKSPACE_DELETE_EVENT)}
                          >
                            <span className="workspace-event-actions__icon" aria-hidden="true">🗑</span>
                            <span className="sr-only">{t(Messages.WORKSPACE_DELETE_EVENT)}</span>
                          </DtButton>
                        </div>
                      </>
                    ) : (
                      <label className="workspace-wishlist-adder workspace-wishlist-adder--stacked">
                        <span>{t(Messages.WORKSPACE_WISHLIST_ADD)}</span>
                        <div className="workspace-wishlist-adder__inline">
                          <input
                            aria-label={t(Messages.WORKSPACE_WISHLIST_PLACEHOLDER)}
                            value={wishlistDraftTitle}
                            onChange={(event) => setWishlistDraftTitle(event.target.value)}
                            placeholder={t(Messages.WORKSPACE_WISHLIST_PLACEHOLDER)}
                          />
                          <select
                            value={wishlistDraftPriority}
                            onChange={(event) => {
                              setWishlistDraftPriority(event.target.value as 'low' | 'medium' | 'high');
                            }}
                          >
                            {WISHLIST_PRIORITY_ORDER.map((priority) => (
                              <option key={priority} value={priority}>
                                {priority === 'low'
                                  ? t(Messages.WORKSPACE_PRIORITY_LOW)
                                  : priority === 'high'
                                    ? t(Messages.WORKSPACE_PRIORITY_HIGH)
                                    : t(Messages.WORKSPACE_PRIORITY_MEDIUM)}
                              </option>
                            ))}
                          </select>
                          <DtButton size="sm" onClick={addToWishlist}>
                            {t(Messages.WORKSPACE_WISHLIST_ADD)}
                          </DtButton>
                        </div>
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="workspace-event-summary">
                <h3>{workspaceEvent?.title ?? ''}</h3>
                <p>{t(Messages.DEMO_PARTICIPANTS, { count: participantsCount })}</p>
                <p>{activeBudget?.title}</p>
                <p>{formattedEventBudget}</p>
              </div>

              <div className="workspace-card">
                <div className="dt-tag">{t(Messages.HASH_PAYLOAD)}</div>
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
                <ul className="workspace-wishlist-list">
                  {workspaceEvent?.wishlistUpdates.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.title}</strong>
                      <span>
                        {t(Messages.WORKSPACE_WISHLIST_PRIORITY)}: {wishlistPriorityLabel(entry.priority)} · {t(Messages.WORKSPACE_WISHLIST_STATUS)}:{' '}
                        {wishlistStatusLabel(entry.status)}
                      </span>
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
                          className="workspace-icon-button"
                          onClick={() => removeEvent(entry.id)}
                          disabled={session.events.length <= 1}
                        >
                          <span className="workspace-event-actions__icon" aria-hidden="true">🗑</span>
                          <span className="sr-only">{t(Messages.WORKSPACE_DELETE_EVENT)}</span>
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
