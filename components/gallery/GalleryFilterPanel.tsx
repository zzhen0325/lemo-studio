"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { Box, SlidersHorizontal, Trash2, Type, X, type LucideIcon } from 'lucide-react';
import { getGalleryPromptCategoryLabel, type GalleryPromptCategory } from '@/app/studio/playground/_lib/prompt-history';
import { cn } from '@/lib/utils';

function FilterItem({
  label,
  isSelected,
  onClick,
  icon: Icon,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
        isSelected
          ? 'border border-white/10 bg-white/5 text-white'
          : 'text-white/60 hover:bg-black/10 hover:text-white',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-white/40')} />
      <span className="flex-1 truncate select-none">{label}</span>
    </button>
  );
}

interface GalleryFilterPanelProps {
  open: boolean;
  onClose: () => void;
  availableModels: string[];
  availablePresets: string[];
  availablePromptCategories: GalleryPromptCategory[];
  selectedModels: string[];
  selectedPresets: string[];
  selectedPromptCategories: GalleryPromptCategory[];
  onToggleModel: (value: string) => void;
  onTogglePreset: (value: string) => void;
  onTogglePromptCategory: (value: GalleryPromptCategory) => void;
  onClearFilters: () => void;
}

export function GalleryFilterPanel({
  open,
  onClose,
  availableModels,
  availablePresets,
  availablePromptCategories,
  selectedModels,
  selectedPresets,
  selectedPromptCategories,
  onToggleModel,
  onTogglePreset,
  onTogglePromptCategory,
  onClearFilters,
}: GalleryFilterPanelProps) {
  const hasActiveFilters =
    selectedModels.length > 0 || selectedPresets.length > 0 || selectedPromptCategories.length > 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="pointer-events-auto absolute inset-y-0 right-0 z-50 flex w-80 min-h-0 flex-col"
        >
          <div className="flex h-[84vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl backdrop-blur-2xl">
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-6">
              <div className="z-20 flex shrink-0 items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                    title="Close Filters"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <span className="font-serif text-xl text-white">Filters</span>
                </div>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    title="Clear Filters"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto px-2">
                <div className="flex flex-col gap-6">
                  {availableModels.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm text-white/40">Models</div>
                      <div className="space-y-1">
                        {availableModels.map((model) => (
                          <FilterItem
                            key={`gallery-filter-model-${model}`}
                            label={model}
                            isSelected={selectedModels.includes(model)}
                            onClick={() => onToggleModel(model)}
                            icon={Box}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {availablePromptCategories.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm text-white/40">Prompt Categories</div>
                      <div className="space-y-1">
                        {availablePromptCategories.map((category) => (
                          <FilterItem
                            key={`gallery-filter-category-${category}`}
                            label={getGalleryPromptCategoryLabel(category)}
                            isSelected={selectedPromptCategories.includes(category)}
                            onClick={() => onTogglePromptCategory(category)}
                            icon={Type}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {availablePresets.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm text-white/40">Presets</div>
                      <div className="space-y-1">
                        {availablePresets.map((preset) => (
                          <FilterItem
                            key={`gallery-filter-preset-${preset}`}
                            label={preset}
                            isSelected={selectedPresets.includes(preset)}
                            onClick={() => onTogglePreset(preset)}
                            icon={SlidersHorizontal}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
