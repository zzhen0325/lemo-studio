import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GalleryToolbar } from '@/components/gallery/GalleryToolbar';

vi.mock('@/components/ui/split-text', () => ({
  default: ({ text, className }: { text: string; className?: string }) => (
    <span className={className}>{text}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    type = 'button',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

describe('GalleryToolbar', () => {
  it('renders the formatted total image count in the header', () => {
    render(
      <GalleryToolbar
        activeTab="gallery"
        onActiveTabChange={vi.fn()}
        totalImageCount={1234}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        sortBy="recent"
        onSortByChange={vi.fn()}
        isFilterOpen={false}
        onFilterToggle={vi.fn()}
        hasActiveFilters={false}
        galleryScopeFilter="all"
        onGalleryScopeFilterChange={vi.fn()}
      />,
    );

    const badge = screen.getByLabelText('Total gallery images: 1,234');

    expect(badge.textContent).toContain('1,234 images');
  });
});
