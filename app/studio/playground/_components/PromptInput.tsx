import React from 'react';
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { UploadedImage } from '@/lib/playground/types';
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ui/ShinyText";


interface PromptInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  uploadedImages: UploadedImage[];
  onRemoveImage: (index: number) => void;
  isOptimizing: boolean;
  onOptimize: () => void;
  selectedAIModel: AIModel;
  onAIModelChange: (model: AIModel) => void;
  onAddImages: (files: File[] | FileList) => void;
  isPresetGridOpen?: boolean;
  onTogglePresetGrid?: () => void;
  onFocusChange?: (focused: boolean) => void;
  isDraggingOver?: boolean;
  onDraggingOverChange?: (isDragging: boolean) => void;
}

import { useDebounce } from '@/hooks/common/use-debounce';

export default function PromptInput({
  prompt,
  onPromptChange,
  onAddImages,
  onFocusChange,
  isDraggingOver,
  onDraggingOverChange,
  isOptimizing,
}: PromptInputProps) {
  const [localPrompt, setLocalPrompt] = React.useState(prompt);
  const debouncedPrompt = useDebounce(localPrompt, 100);
  const [isFocused, setIsFocused] = React.useState(false);
  const lastSyncPrompt = React.useRef(prompt);

  // 当外部 prompt 变更时（例如 AI 优化），如果不是我们自己发出的变更，则同步到本地
  React.useEffect(() => {
    if (prompt !== lastSyncPrompt.current) {
      setLocalPrompt(prompt);
      lastSyncPrompt.current = prompt;
    }
  }, [prompt]);

  // 当防抖后的本地状态变更时，回传给父组件并更新同步记录
  React.useEffect(() => {
    if (debouncedPrompt !== lastSyncPrompt.current) {
      lastSyncPrompt.current = debouncedPrompt;
      onPromptChange(debouncedPrompt);
    }
  }, [debouncedPrompt, onPromptChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalPrompt(val);
    // Remove immediate onPromptChange to fix input lag caused by parent re-renders
    // onPromptChange(val); 
  };

  const handleBlur = () => {
    setIsFocused(false);
    // 强制进行一次最终同步
    if (localPrompt !== prompt) {
      onPromptChange(localPrompt);
      lastSyncPrompt.current = localPrompt;
    }
  };

  return (
    <div
      className={cn(
        "w-full relative rounded-2xl",
        isDraggingOver && ""
      )}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDraggingOverChange?.(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) onAddImages(files);
      }}
    >
      <AutosizeTextarea
        placeholder="请描述您想要生成的图像，例如：黄色的lemo圣诞老人，淡蓝色的背景"
        value={localPrompt}
        onFocus={() => {
          setIsFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          handleBlur();
          onFocusChange?.(false);
        }}
        minHeight={86}
        maxHeight={isFocused ? undefined : 86}
        onChange={handleChange}
        onPaste={(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          const files: File[] = [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.kind === 'file' && it.type.startsWith('image/')) {
              const f = it.getAsFile();
              if (f) files.push(f);
            }
          }
          if (files.length > 0) {
            // 阻止默认粘贴文本行为，只处理图片
            e.preventDefault();
            onAddImages(files);
          }
        }}
        className={cn(
          "w-full placeholder:text-white/40 bg-transparent max-h-[400px] leading-relaxed tracking-wide p-2 pl-4 pr-10 border-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none resize-none ",
          isOptimizing ? "text-transparent" : "text-white"
        )}
      />
      {isOptimizing && (
        <div className="pointer-events-none absolute inset-0 p-2 pl-4 pr-10 text-sm leading-relaxed tracking-wide whitespace-pre-wrap break-words">
          <ShinyText text={localPrompt} color="#ffffff9b" direction="left" shineColor="rgb(255 255 255)" speed={2} />
        </div>
      )}
    </div>
  );
}
