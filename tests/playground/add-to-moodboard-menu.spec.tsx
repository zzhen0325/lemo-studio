import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddToMoodboardMenu } from '@/app/studio/playground/_components/AddToMoodboardMenu';

const toastMock = vi.fn();
const deleteStyleMock = vi.fn();
const refreshMoodboardCardsMock = vi.fn();

const mockMoodboards = [
  {
    id: 'moodboard-1',
    name: 'Clay Dreams',
    prompt: '',
    imagePaths: ['/images/reference-a.png'],
  },
  {
    id: 'moodboard-2',
    name: 'Poster References',
    prompt: '',
    imagePaths: ['/images/current.png', '/images/reference-b.png'],
  },
] as const;

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
  usePlaygroundMoodboards: () => ({
    moodboards: mockMoodboards,
    moodboardCards: [],
    moodboardCardEntries: [],
    moodboardCardByCode: new Map(),
    refreshMoodboardCards: refreshMoodboardCardsMock,
    isLoadingMoodboardCards: false,
  }),
}));

describe('AddToMoodboardMenu', () => {
  beforeEach(() => {
    toastMock.mockReset();
    deleteStyleMock.mockReset();
    refreshMoodboardCardsMock.mockReset();
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
});
