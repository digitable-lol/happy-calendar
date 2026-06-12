import type { SessionState } from './model';

export const demoSession: SessionState = {
  version: 1,
  groupName: 'Friends & Family',
  createdAt: '2026-06-10T09:00:00.000Z',
  updatedAt: '2026-06-10T09:00:00.000Z',
  participants: [
    { nickname: 'pixel-marat', avatarSeed: 'cyan-fox' },
    { nickname: 'luna-party', avatarSeed: 'purple-cat' },
    { nickname: 'budget-owl', avatarSeed: 'green-owl' },
  ],
  events: [
    {
      id: 'event-birthday-001',
      title: 'День рождения Лены',
      date: '2026-07-14',
      format: 'organized',
      categoryBudget: {
        category: 'birthday',
        title: 'Дни рождения',
        budget: { amount: 5000, currency: 'RUB' },
      },
      wishlistUpdates: [{ id: 'wishlist-lena-001', title: 'Настольная игра', priority: 'high', status: 'wanted' }],
    },
    {
      id: 'event-holiday-002',
      title: 'Праздник Дня победы',
      date: '2026-07-29',
      format: 'drop-in',
      categoryBudget: {
        category: 'holiday',
        title: 'Праздники',
        budget: { amount: 7000, currency: 'RUB' },
      },
      wishlistUpdates: [{ id: 'wishlist-victory-002', title: 'Билеты в музей', priority: 'medium', status: 'wanted' }],
    },
  ],
  eventGroups: [
    {
      id: 'group-family',
      title: 'Семья',
      eventIds: ['event-birthday-001'],
    },
    {
      id: 'group-team',
      title: 'Друзья',
      eventIds: ['event-holiday-002'],
    },
  ],
};
