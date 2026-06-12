import { describe, expect, it } from 'vitest';
import { demoSession } from './fixtures';
import { addEventToGroup, addGroupWithEvent, buildDraftEvent, removeEventFromSession } from './sessionOperations';
import type { SessionState } from './model';

describe('session operations', () => {
  const seedOne = () => 'seed-event-1';
  const seedTwo = () => 'seed-event-2';
  const seedGroup = () => 'seed-group-1';

  const toSeedEvent = (title: string, seed: () => string) =>
    buildDraftEvent({
      title,
      date: '2026-07-12',
      createId: seed,
      budget: 4200,
      categoryTitle: 'Тест',
    });

  it('adds a new event into an existing group and keeps sessions immutable', () => {
    const base: SessionState = {
      ...demoSession,
      events: [{ ...demoSession.events[0] }],
      eventGroups: [{ ...demoSession.eventGroups[0], eventIds: ['seed-event-base'] }],
    };
    const nextEvent = toSeedEvent('Событие в группе', seedOne);
    const next = addEventToGroup(base, 'group-family', nextEvent);

    expect(next).not.toBe(base);
    expect(next.events).toEqual([base.events[0], nextEvent]);
    expect(next.eventGroups).toEqual([
      {
        ...base.eventGroups[0],
        eventIds: ['seed-event-base', 'seed-event-1'],
      },
    ]);
  });

  it('does not mutate state when adding event to missing group', () => {
    const base: SessionState = {
      ...demoSession,
      events: [demoSession.events[0]],
      eventGroups: [demoSession.eventGroups[0]],
    };
    const nextEvent = toSeedEvent('Несуществующая группа', seedOne);

    const next = addEventToGroup(base, 'group-missing', nextEvent);
    expect(next).toBe(base);
  });

  it('adds a new group with its first event', () => {
    const base: SessionState = {
      ...demoSession,
      events: [demoSession.events[0]],
      eventGroups: [demoSession.eventGroups[0]],
    };
    const event = toSeedEvent('Первая группа', seedOne);
    const created = addGroupWithEvent(base, 'Коллеги', event, { groupId: seedGroup() });

    expect(created.group).toEqual({
      id: 'seed-group-1',
      title: 'Коллеги',
      eventIds: ['seed-event-1'],
    });
    expect(created.state.events.at(-1)).toEqual(event);
    expect(created.state.eventGroups.at(-1)).toEqual(created.group);
    expect(created.state.events.length).toBe(base.events.length + 1);
    expect(created.state.eventGroups.length).toBe(base.eventGroups.length + 1);
  });

  it('creates a draft event with expected defaults', () => {
    const event = buildDraftEvent({ createId: seedOne });

    expect(event.id).toBe('seed-event-1');
    expect(event.title).toBe('Новое событие');
    expect(event.format).toBe('organized');
    expect(event.wishlistUpdates).toEqual([]);
    expect(event.categoryBudget).toMatchObject({
      category: 'custom',
      title: 'Другое',
      budget: { currency: 'RUB', amount: 3000 },
    });
  });

  it('adds multiple seeded events to different groups', () => {
    const base: SessionState = {
      ...demoSession,
      events: [],
      eventGroups: [
        { id: 'group-family', title: 'Семья', eventIds: [] },
        { id: 'group-team', title: 'Друзья', eventIds: [] },
      ],
    };
    const first = toSeedEvent('Family', seedOne);
    const second = toSeedEvent('Team', seedTwo);

    const firstUpdated = addEventToGroup(base, 'group-family', first);
    const secondUpdated = addEventToGroup(firstUpdated, 'group-team', second);

    expect(secondUpdated.eventGroups[0].eventIds).toEqual(['seed-event-1']);
    expect(secondUpdated.eventGroups[1].eventIds).toEqual(['seed-event-2']);
    expect(secondUpdated.events).toEqual([first, second]);
  });

  it('removes one event and detaches it from every group', () => {
    const base: SessionState = {
      ...demoSession,
      events: [
        { ...demoSession.events[0], id: 'event-1', title: 'Событие 1' },
        { ...demoSession.events[1], id: 'event-2', title: 'Событие 2' },
      ],
      eventGroups: [
        { id: 'group-family', title: 'Семья', eventIds: ['event-1', 'event-2'] },
        { id: 'group-team', title: 'Друзья', eventIds: ['event-2'] },
      ],
    };

    const next = removeEventFromSession(base, 'event-1');

    expect(next.events).toEqual([base.events[1]]);
    expect(next.eventGroups).toEqual([
      { id: 'group-family', title: 'Семья', eventIds: ['event-2'] },
      { id: 'group-team', title: 'Друзья', eventIds: ['event-2'] },
    ]);
  });

  it('does nothing when removing an absent event', () => {
    const next = removeEventFromSession(demoSession, 'event-missing');

    expect(next).toBe(demoSession);
  });
});
