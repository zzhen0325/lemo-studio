import React from 'react';
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { AIModel } from "@/hooks/features/PlaygroundV2/usePromptOptimization";
import { UploadedImage } from '@/components/features/playground-v2/types';


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
}

import { useDebounce } from '@/hooks/common/use-debounce';

export default function PromptInput({
  prompt,
  onPromptChange,
  onAddImages,
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
      className="w-full relative"
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) onAddImages(files);
      }}
    >
      <AutosizeTextarea
        placeholder="请描述您想要生成的图像，例如：黄色的lemo圣诞老人，淡蓝色的背景"
        value={localPrompt}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
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
            e.preventDefault();
            onAddImages(files);
          }
        }}
        className="w-full placeholder:text-white/40 bg-transparent text-white leading-relaxed tracking-wide p-2 px-4 pt-3 border-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none resize-none transition-all duration-200"
      />

      {/* 底部模糊遮罩 - 仅在非 Focus 状态且有内容时显示，用于优雅处理文字溢出 */}
      <div
        className={`absolute bottom-1 left-1 right-1 h-10 pointer-events-none bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 rounded-b-3xl z-10 ${!isFocused && prompt.length > 0 ? 'opacity-80' : 'opacity-0'
          }`}
      />
    </div>
  );
}
