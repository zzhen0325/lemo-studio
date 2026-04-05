import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddToMoodboardMenu } from '@/app/studio/playground/_components/AddToMoodboardMenu';
import type { StyleStack } from '@/types/database';

const toastMock = vi.fn();
const deleteStyleMock = vi.fn();
const refreshMoodboardCardsMock = vi.fn();
const usePlaygroundMoodboardsMock = vi.fn();

const mockMoodboards: StyleStack[] = [
  {
    id: 'moodboard-1',
    name: 'Clay Dreams',
    prompt: '',
    imagePaths: ['/images/reference-a.png'],
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
  {
    id: 'moodboard-2',
    name: 'Poster References',
    prompt: '',
    imagePaths: ['/images/current.png', '/images/reference-b.png'],
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
];

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector: (state: { deleteStyle: typeof deleteStyleMock }) => unknown) => (
    selector({ deleteStyle: deleteStyleMock })
  ),
}));

vi.mock('@/hooks/common/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/app/studio/playground/_components/hooks/usePlaygroundMoodboards', () => ({
  usePlaygroundMoodboards: () => usePlaygroundMoodboardsMock(),
}));

function createMoodboardHookPayload() {
  return {
    moodboards: mockMoodboards,
    moodboardCards: [],
    moodboardCardEntries: [],
    moodboardCardByCode: new Map(),
    refreshMoodboardCards: refreshMoodboardCardsMock,
    isLoadingMoodboardCards: false,
  };
}

describe('AddToMoodboardMenu', () => {
  beforeEach(() => {
    toastMock.mockReset();
    deleteStyleMock.mockReset();
    refreshMoodboardCardsMock.mockReset();
    usePlaygroundMoodboardsMock.mockReset();
    usePlaygroundMoodboardsMock.mockReturnValue(createMoodboardHookPayload());
  });

  it('renders existing moodboards in the dropdown and marks already included images', async () => {
    render(<AddToMoodboardMenu imagePath="/images/current.png" />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add to Moodboard' }), {
      button: 0,
      ctrlKey: false,
    });

    const menu = await screen.findByRole('menu');

    expect(within(menu).getByText('Clay Dreams')).toBeTruthy();
    expect(within(menu).getByText('Poster References')).toBeTruthy();
    expect(within(menu).getByText('已包含')).toBeTruthy();
  });

  it('uses injected moodboard data without calling internal moodboard hook', async () => {
    render(
      <AddToMoodboardMenu
        imagePath="/images/current.png"
        moodboardsData={[...mockMoodboards]}
        moodboardCardsData={[]}
        onRefreshMoodboardCards={refreshMoodboardCardsMock}
      />
    );

    expect(usePlaygroundMoodboardsMock).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add to Moodboard' }), {
      button: 0,
      ctrlKey: false,
    });

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Clay Dreams')).toBeTruthy();
  });
});
