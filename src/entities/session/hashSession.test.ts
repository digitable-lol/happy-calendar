import { describe, expect, it } from 'vitest';
import { demoSession } from './fixtures';
import { createSessionFingerprint, createSessionPayload, isNewerSession, readSessionPayload } from './hashSession';
import { removeEventFromSession } from './sessionOperations';
import type { SessionState } from './model';

const encodePayload = (value: unknown): string => `hc1.${Buffer.from(JSON.stringify(value)).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;

describe('hash session', () => {
  const buildLargeSession = (eventCount: number): SessionState => ({
    ...demoSession,
    groupName: 'Large group',
    createdAt: '2026-06-10T09:00:00.000Z',
    updatedAt: '2026-06-10T09:00:00.000Z',
    events: Array.from({ length: eventCount }, (_, index) => ({
      ...demoSession.events[0],
      id: `event-large-${index + 1}`,
      title: `Событие ${index + 1}`,
      date: `2026-01-${String((index % 30) + 1).padStart(2, '0')}`,
      categoryBudget: {
        ...demoSession.events[0].categoryBudget,
        title: `Категория ${index + 1}`,
        budget: { ...demoSession.events[0].categoryBudget.budget, amount: 3000 + index * 100 },
      },
    })),
    eventGroups: [
      {
        id: 'group-a',
        title: 'Основная',
        eventIds: Array.from({ length: eventCount }, (_, index) => `event-large-${index + 1}`).filter((_, index) => index % 2 === 0),
      },
      {
        id: 'group-b',
        title: 'Доп',
        eventIds: Array.from({ length: eventCount }, (_, index) => `event-large-${index + 1}`).filter((_, index) => index % 2 === 1),
      },
    ],
  });

  it('creates a portable Happy Calendar payload that restores the calendar state', () => {
    const payload = createSessionPayload(demoSession);

    expect(payload.startsWith('hc1.')).toBe(true);
    expect(readSessionPayload(payload)).toEqual(demoSession);
  });

  it('keeps event groups and category budgets inside the hashed calendar payload', () => {
    const restored = readSessionPayload(createSessionPayload(demoSession));
    const event = restored.events[0];

    expect(event.categoryBudget).toEqual({
      category: 'birthday',
      title: 'Дни рождения',
      budget: { amount: 5000, currency: 'RUB' },
    });
    expect(restored.eventGroups).toEqual([
      { id: 'group-family', title: 'Семья', eventIds: ['event-birthday-001'] },
      { id: 'group-team', title: 'Друзья', eventIds: ['event-holiday-002'] },
    ]);
    expect('budget' in event).toBe(false);
  });

  it('creates deterministic payloads for the same calendar state', () => {
    const first = createSessionPayload(demoSession);
    const second = createSessionPayload({ ...demoSession });

    expect(second).toBe(first);
  });

  it('restores large payloads with all events and group links', async () => {
    const source = buildLargeSession(120);
    const payload = createSessionPayload(source);
    const restored = readSessionPayload(payload);

    expect(restored.events).toHaveLength(source.events.length);
    expect(restored.eventGroups).toEqual(source.eventGroups);
    expect(restored.events.at(0)?.title).toBe('Событие 1');
    expect(restored.events.at(-1)?.id).toBe('event-large-120');
  });

  it('changes fingerprint after deleting an event from multi-event payload', async () => {
    const source = buildLargeSession(10);
    const first = await createSessionFingerprint(source, 'family-secret');
    const next = removeEventFromSession(source, source.events[0].id);
    const second = await createSessionFingerprint(next, 'family-secret');

    expect(next.events).toHaveLength(9);
    expect(second).not.toBe(first);
  });

  it('produces same payload for equal large calendar states', () => {
    const source = buildLargeSession(25);
    const first = createSessionPayload(source);
    const second = createSessionPayload({ ...source });

    expect(second).toBe(first);
  });

  it('binds fingerprint to password', async () => {
    const first = await createSessionFingerprint(demoSession, 'family-secret');
    const second = await createSessionFingerprint(demoSession, 'another-secret');

    expect(first).not.toBe(second);
    expect(first).toMatch(/^hc-sha256-[a-f0-9]{24}$/);
  });

  it('changes fingerprint when calendar business data changes', async () => {
    const changedCalendar = {
      ...demoSession,
      events: demoSession.events.map((event) => ({
        ...event,
        categoryBudget: {
          ...event.categoryBudget,
          budget: { ...event.categoryBudget.budget, amount: 7500 },
        },
      })),
    };

    const first = await createSessionFingerprint(demoSession, 'family-secret');
    const second = await createSessionFingerprint(changedCalendar, 'family-secret');

    expect(second).not.toBe(first);
  });

  it('changes fingerprint when group composition changes', async () => {
    const firstGroup = demoSession.events[0].id;
    const secondGroup = demoSession.events[1].id;
    const groupedSession: SessionState = {
      ...demoSession,
      eventGroups: [
        { id: 'group-family', title: 'Семья', eventIds: [firstGroup] },
        { id: 'group-team', title: 'Друзья', eventIds: [secondGroup] },
      ],
    };
    const reassignedSession: SessionState = {
      ...groupedSession,
      eventGroups: [
        { id: 'group-family', title: 'Семья', eventIds: [secondGroup] },
        { id: 'group-team', title: 'Друзья', eventIds: [firstGroup] },
      ],
    };

    const first = await createSessionFingerprint(groupedSession, 'family-secret');
    const second = await createSessionFingerprint(reassignedSession, 'family-secret');

    expect(first).not.toBe(second);
  });

  it('hydrates a legacy payload without event groups', async () => {
    const legacyPayload = encodePayload({
      ...demoSession,
      eventGroups: undefined,
    } as { [key: string]: unknown });
    const restored = readSessionPayload(legacyPayload);

    expect(restored.eventGroups.length).toBeGreaterThan(0);
    expect(restored.eventGroups[0].eventIds.includes(restored.events[0].id)).toBe(true);
  });

  it('rejects unsupported payload formats', () => {
    expect(() => readSessionPayload('calendar-v0.payload')).toThrow('Unsupported Happy Calendar payload.');
  });

  it('detects freshness only when the incoming calendar is newer', () => {
    expect(isNewerSession({ updatedAt: '2026-06-11T00:00:00.000Z' }, { updatedAt: '2026-06-10T00:00:00.000Z' })).toBe(true);
    expect(isNewerSession({ updatedAt: '2026-06-10T00:00:00.000Z' }, { updatedAt: '2026-06-10T00:00:00.000Z' })).toBe(false);
    expect(isNewerSession({ updatedAt: '2026-06-09T00:00:00.000Z' }, { updatedAt: '2026-06-10T00:00:00.000Z' })).toBe(false);
  });
});
