export type EventFormat = 'organized' | 'drop-in' | 'remote' | 'gift-only';
export type EventCategory = 'birthday' | 'holiday' | 'anniversary' | 'custom';
export type GiftBudget = Readonly<{ amount: number; currency: 'RUB' | 'USD' | 'EUR' | 'TRY' }>;
export type CategoryBudget = Readonly<{ category: EventCategory; title: string; budget: GiftBudget }>;
export type Participant = Readonly<{ nickname: string; avatarSeed: string }>;
export type WishlistItem = Readonly<{ id: string; title: string; priority: 'low' | 'medium' | 'high'; status: 'wanted' | 'gifted' | 'archived' }>;
export type CalendarEvent = Readonly<{ id: string; title: string; date: string; format: EventFormat; categoryBudget: CategoryBudget; wishlistUpdates: ReadonlyArray<WishlistItem> }>;
export type SessionState = Readonly<{ version: 1; groupName: string; createdAt: string; updatedAt: string; participants: ReadonlyArray<Participant>; events: ReadonlyArray<CalendarEvent> }>;
