'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { AutosizeTextarea } from '@/components/ui/autosize-text-area';
import { Textarea } from '@/components/ui/textarea';
import type { TranslateLang } from '@/components/features/dataset/collection-detail/types';

interface PromptTextareaProps {
  imageId: string;
  value: string;
  lang: TranslateLang;
  disabled?: boolean;
  onCommit: (id: string, value: string, lang: TranslateLang) => void;
  onEditingChange: (editing: boolean) => void;
}

export const PromptTextarea = memo(function PromptTextarea({
  imageId,
  value,
  lang,
  disabled,
  onCommit,
  onEditingChange,
}: PromptTextareaProps) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
    }
  }, [value, isFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onEditingChange(false);
    if (draft !== value) {
      onCommit(imageId, draft, lang);
    }
  }, [draft, imageId, lang, onCommit, onEditingChange, value]);

  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        setIsFocused(true);
        onEditingChange(true);
      }}
      onBlur={handleBlur}
      className="w-full flex-1 placeholder:text-muted-foreground/50 bg-background/40 hover:bg-background/80 border border-white/5 hover:border-white/10 text-foreground text-sm leading-relaxed p-4 focus:bg-background focus:border-primary/40 focus:ring-4 focus:ring-primary/10 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none resize-none transition-all duration-300 rounded-xl custom-scrollbar min-h-[160px]"
      placeholder="Write image description here..."
      disabled={disabled}
    />
  );
});

interface SystemPromptTextareaProps {
  value: string;
  onCommit: (value: string) => void;
  onEditingChange: (editing: boolean) => void;
}

export const SystemPromptTextarea = memo(function SystemPromptTextarea({
  value,
  onCommit,
  onEditingChange,
}: SystemPromptTextareaProps) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
    }
  }, [value, isFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onEditingChange(false);
    if (draft !== value) {
      onCommit(draft);
    }
  }, [draft, onCommit, onEditingChange, value]);

  return (
    <AutosizeTextarea
      value={draft}
      onFocus={() => {
        setIsFocused(true);
        onEditingChange(true);
      }}
      onBlur={handleBlur}
      onChange={(e) => setDraft(e.target.value)}
      className="w-full bg-background border-white/10 text-foreground text-sm p-4 focus:border-primary/50 rounded-xl min-h-[80px]"
      placeholder="What is in this image? Describe the main objects and context."
    />
  );
});
