import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSessionPayload } from '../../entities/session/hashSession';
import { demoSession } from '../../entities/session/fixtures';
import { WithTranslate } from '../../shared/i18n';
import { LandingPage } from './LandingPage';

const renderLanding = () => render(
  <WithTranslate>
    <LandingPage />
  </WithTranslate>,
);

const readEventRows = (container: HTMLElement) => container.querySelectorAll<HTMLLIElement>('.workspace-event-list li');
const resetBrowserState = () => {
  window.localStorage.setItem('happy-calendar-locale', 'ru-RU');
  window.history.replaceState(null, '', '/');
};

describe('Landing page hashed session workspace', () => {
  beforeEach(() => {
    resetBrowserState();
  });
  afterEach(() => {
    cleanup();
  });

  it('switches demo payload presets by size', () => {
    const { container } = renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /^10 событий$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^1000 событий$/ }));

    expect(screen.getByRole('heading', { name: 'Demo 1000' })).toBeTruthy();
    expect(container.querySelector('.demo-tab.demo-tab--active')?.textContent).toBe('1000 событий');
  });

  it('opens workspace and supports grouped event CRUD workflows', async () => {
    const { container } = renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Завести календарь' }));

    expect(screen.getByRole('button', { name: 'Добавить группу' })).toBeTruthy();
    expect(readEventRows(container).length).toBe(1);

    const groupInput = screen.getByPlaceholderText('Новая группа');
    fireEvent.change(groupInput, { target: { value: 'Праздничная команда' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));

    const groupSelect = container.querySelector('.workspace-groups select') as HTMLSelectElement;
    expect(groupSelect.options.length).toBe(2);
    expect(groupSelect.value).toBeTruthy();

    const eventInput = screen.getByRole('textbox', { name: /Добавить событие/ }) as HTMLInputElement;
    fireEvent.change(eventInput, { target: { value: 'Тестовое событие' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Добавить событие' }).at(-1)!);

    await waitFor(() => {
      expect(readEventRows(container).length).toBe(2);
    });

    const rowDeleteButton = within(readEventRows(container)[0]).getByRole('button', { name: 'Удалить событие' });
    fireEvent.click(rowDeleteButton);

    await waitFor(() => {
      expect(readEventRows(container).length).toBe(1);
    });

    const deleteFromWorkspaceHeader = container.querySelector('.workspace-event-actions button') as HTMLButtonElement;
    expect(deleteFromWorkspaceHeader.disabled).toBe(false);
  });

  it('imports payload and continues editing in a selected imported group', async () => {
    const importedState = {
      ...demoSession,
      groupName: 'Imported Hash Calendar',
      events: [
        { ...demoSession.events[0], id: 'import-event-1' },
        { ...demoSession.events[1], id: 'import-event-2' },
      ],
      eventGroups: [
        { id: 'import-family', title: 'Семья', eventIds: ['import-event-1'] },
        { id: 'import-friends', title: 'Друзья', eventIds: ['import-event-2'] },
      ],
    };
    const importedPayload = createSessionPayload(importedState);

    const { container } = renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Завести календарь' }));
    const payloadTextarea = document.querySelector('.workspace-textarea') as HTMLTextAreaElement;
    const importButton = screen.getAllByRole('button', { name: 'Импортировать payload' }).at(-1)!;

    fireEvent.change(payloadTextarea, { target: { value: importedPayload } });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText('Payload загружен')).toBeTruthy();
      const groupSelect = document.querySelector('.workspace-groups select') as HTMLSelectElement;
      expect(groupSelect.options.length).toBe(2);
    });

    const groupSelect = document.querySelector('.workspace-groups select') as HTMLSelectElement;
    fireEvent.change(groupSelect, { target: { value: 'import-friends' } });

    await waitFor(() => {
      expect(readEventRows(container).length).toBe(1);
    });

    const eventInput = screen.getByRole('textbox', { name: /Добавить событие/ }) as HTMLInputElement;
    fireEvent.change(eventInput, { target: { value: 'Событие в друзьях' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Добавить событие' }).at(-1)!);

    await waitFor(() => {
      expect(readEventRows(container).length).toBe(2);
    });
  });

  it('shows import error for invalid payload and keeps current workspace unchanged', async () => {
    const { container } = renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Завести календарь' }));

    const firstGroup = container.querySelector('.workspace-groups select') as HTMLSelectElement;
    expect(firstGroup.value).toBe('group-demo-1');

    const payloadTextarea = document.querySelector('.workspace-textarea') as HTMLTextAreaElement;
    fireEvent.change(payloadTextarea, { target: { value: 'definitely-not-valid-payload' } });

    const importButton = screen.getAllByRole('button', { name: 'Импортировать payload' }).at(-1)!;
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText('Невалидный payload')).toBeTruthy();
    });

    expect(firstGroup.value).toBe('group-demo-1');
    expect(readEventRows(container).length).toBe(1);
  });
});
