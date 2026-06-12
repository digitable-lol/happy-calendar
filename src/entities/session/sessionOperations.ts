import type { CalendarEvent, EventFormat, EventGroup, SessionState } from './model'

const createDate = (): string => new Date().toISOString().slice(0, 10)

const makeEventId = (seed: (() => string) | null = null): string => {
  const random =
    seed ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? () => crypto.randomUUID()
      : () => `event-${Math.random().toString(16).slice(2)}`)

  return random()
}

const normalizeBudget = (amount: number) => ({ amount, currency: 'RUB' as const })

export const buildDraftEvent = (overrides?: {
  readonly title?: string
  readonly date?: string
  readonly format?: EventFormat
  readonly categoryTitle?: string
  readonly budget?: number
  readonly createId?: () => string
  readonly authorNickname?: string
  readonly authorAvatarSeed?: string
}): CalendarEvent => {
  const createId = overrides?.createId ?? null
  return {
    id: makeEventId(createId),
    title: overrides?.title ?? 'Новое событие',
    date: overrides?.date ?? createDate(),
    format: overrides?.format ?? 'organized',
    categoryBudget: {
      category: 'custom',
      title: overrides?.categoryTitle ?? 'Другое',
      budget: normalizeBudget(overrides?.budget ?? 3000),
    },
    wishlistUpdates: [],
    authorNickname: overrides?.authorNickname,
    authorAvatarSeed: overrides?.authorAvatarSeed,
  }
}

export const addEventToGroup = (
  state: SessionState,
  groupId: string,
  event: CalendarEvent
): SessionState => {
  const targetExists = state.eventGroups.some((group) => group.id === groupId)
  if (!targetExists) {
    return state
  }

  return {
    ...state,
    events: [...state.events, event],
    eventGroups: state.eventGroups.map((group) =>
      group.id === groupId ? { ...group, eventIds: [...group.eventIds, event.id] } : group
    ),
  }
}

export const addGroupWithEvent = (
  state: SessionState,
  groupTitle: string,
  event: CalendarEvent,
  options?: { readonly groupId?: string }
): { readonly group: EventGroup; readonly state: SessionState } => {
  const groupId = options?.groupId ?? makeEventId()
  const trimmedTitle = groupTitle.trim()
  const nextState: SessionState = {
    ...state,
    events: [...state.events, event],
    eventGroups: [
      ...state.eventGroups,
      { id: groupId, title: trimmedTitle || 'Новая группа', eventIds: [event.id] },
    ],
  }

  return { group: nextState.eventGroups[nextState.eventGroups.length - 1]!, state: nextState }
}

export const removeEventFromSession = (state: SessionState, eventId: string): SessionState => {
  const nextEvents = state.events.filter((event) => event.id !== eventId)
  if (nextEvents.length === state.events.length) {
    return state
  }

  const eventIds = new Set(nextEvents.map((entry) => entry.id))
  return {
    ...state,
    events: nextEvents,
    eventGroups: state.eventGroups.map((group) => ({
      ...group,
      eventIds: group.eventIds.filter((candidateId) => eventIds.has(candidateId)),
    })),
  }
}
