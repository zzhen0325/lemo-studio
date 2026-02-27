'use client';

import {
  ChevronLeft,
  ChevronUp,
  Download,
  LayoutGrid,
  List,
  ListOrdered,
  Loader2,
  Plus,
  Save,
  Scissors,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { SystemPromptTextarea } from './PromptTextareas';
import {
  PROMPT_MODIFIERS,
} from './collection-detail.utils';
import type {
  CropMode,
  TranslateLang,
} from './types';

interface CollectionDetailHeaderProps {
  collectionName: string;
  imagesCount: number;
  isEditingName: boolean;
  newName: string;
  isProcessing: boolean;
  progress: { current: number; total: number } | null;
  viewMode: 'list' | 'grid';
  gridColumns: number;
  selectedCount: number;
  activePromptLang: TranslateLang;
  isPromptPanelOpen: boolean;
  systemPrompt: string;
  systemPromptLiveValue: string;
  cropMode: CropMode;
  targetSize: string;
  isBatchRenameDialogOpen: boolean;
  renamePrefix: string;
  batchPrefix: string;
  onBack: () => void;
  onStartEditingName: () => void;
  onNameChange: (value: string) => void;
  onNameCommit: () => void;
  onSwitchViewMode: (mode: 'list' | 'grid') => void;
  onGridColumnsChange: (next: number) => void;
  onSaveAllData: () => void;
  onTogglePromptPanel: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCropModeChange: (mode: CropMode) => void;
  onTargetSizeChange: (value: string) => void;
  onBatchCrop: () => void;
  onBatchRenameDialogOpenChange: (open: boolean) => void;
  onRenamePrefixChange: (value: string) => void;
  onBatchRename: () => void;
  onPrimaryBatchAction: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOptimizeSelected: () => void;
  onBatchDelete: () => void;
  onPromptLangSwitch: (lang: TranslateLang) => void;
  onExport: () => void;
  onSystemPromptCommit: (value: string) => void;
  onSystemPromptEditingChange: (editing: boolean) => void;
  onModifierChange: (modifierText: string, checked: boolean) => void;
  onCancelProcessing: () => void;
}

export function CollectionDetailHeader({
  collectionName,
  imagesCount,
  isEditingName,
  newName,
  isProcessing,
  progress,
  viewMode,
  gridColumns,
  selectedCount,
  activePromptLang,
  isPromptPanelOpen,
  systemPrompt,
  systemPromptLiveValue,
  cropMode,
  targetSize,
  isBatchRenameDialogOpen,
  renamePrefix,
  batchPrefix,
  onBack,
  onStartEditingName,
  onNameChange,
  onNameCommit,
  onSwitchViewMode,
  onGridColumnsChange,
  onSaveAllData,
  onTogglePromptPanel,
  onUpload,
  onCropModeChange,
  onTargetSizeChange,
  onBatchCrop,
  onBatchRenameDialogOpenChange,
  onRenamePrefixChange,
  onBatchRename,
  onPrimaryBatchAction,
  onSelectAll,
  onDeselectAll,
  onOptimizeSelected,
  onBatchDelete,
  onPromptLangSwitch,
  onExport,
  onSystemPromptCommit,
  onSystemPromptEditingChange,
  onModifierChange,
  onCancelProcessing,
}: CollectionDetailHeaderProps) {
  return (
    <div className="sticky top-0 left-0 z-30 bg-[#161616] px-4 py-3 border rounded-xl border-[#2e2e2e] shadow-sm shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-zinc-300 bg-[#1a1a1a] border border-[#2e2e2e] hover:text-white hover:bg-[#2a2a2a] h-9 px-3 rounded-lg shadow-sm"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <Input
                  value={newName}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={onNameCommit}
                  onKeyDown={(e) => e.key === 'Enter' && onNameCommit()}
                  autoFocus
                  className="h-8 py-1 text-lg font-semibold w-[200px] bg-[#1a1a1a] border-[#2e2e2e] text-white focus-visible:ring-1 focus-visible:ring-teal-500/50"
                />
              ) : (
                <h1
                  className="text-lg font-semibold text-zinc-100 cursor-pointer hover:bg-[#2a2a2a] px-2 rounded-md -ml-2 transition-colors select-none"
                  onDoubleClick={onStartEditingName}
                  title="Double click to rename"
                >
                  {collectionName}
                </h1>
              )}
            </div>
            <p className="text-[13px] text-zinc-500">{imagesCount} images with prompts</p>
          </div>

          {progress && (
            <div className="flex items-center ml-4 pl-4 bg-[#1a1a1a] p-2 border border-[#2e2e2e] rounded-lg animate-in fade-in slide-in-from-left-2 duration-100">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <LoadingSpinner size={12} />
                  <span>
                    处理中 {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelProcessing}
                className="h-8 px-2 text-xs text-muted-foreground bg-black/10 ml-3 border border-white/10 hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-3.5 w-3.5" />
                停止
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1a1a1a] rounded-lg p-1 border border-[#2e2e2e] h-9">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSwitchViewMode('list')}
              className={`h-8 w-8 rounded-md ${viewMode === 'list' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSwitchViewMode('grid')}
              className={`h-8 w-8 rounded-md ${viewMode === 'grid' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === 'grid' && (
            <div className="flex items-center gap-3 mr-4 w-[120px] animate-in fade-in slide-in-from-right-4">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Size</span>
              <Slider
                value={[gridColumns]}
                onValueChange={(vals) => onGridColumnsChange(vals[0])}
                min={2}
                max={10}
                step={1}
                className="w-full"
              />
            </div>
          )}

          <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1" />

          <Button
            variant="outline"
            size="sm"
            disabled={isProcessing}
            onClick={onSaveAllData}
            className="text-teal-500 border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-400 h-9 px-3 rounded-lg"
          >
            {isProcessing ? <LoadingSpinner size={16} /> : <Save className="h-4 w-4" />}
            Save All
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-teal-500 border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-400 h-9 px-3 rounded-lg"
            onClick={onTogglePromptPanel}
          >
            AI Settings
            <Wand2 className="ml-2 h-4 w-4" />
          </Button>

          <div className="w-[1px] h-4 bg-[#2e2e2e] ml-1 mr-2" />

          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*,.txt"
              className="hidden"
              onChange={onUpload}
            />
          </label>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={isProcessing} className="text-zinc-300 border-[#2e2e2e] hover:bg-[#2a2a2a] hover:text-white h-9 px-3 rounded-lg">
                <Scissors className="h-4 w-4" />
                Crop
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Crop Mode</Label>
                  <div className="flex gap-2">
                    <Select
                      value={cropMode}
                      onValueChange={(v: CropMode) => onCropModeChange(v)}
                    >
                      <SelectTrigger className="w-full h-9 bg-background border-white/10 text-xs">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Center Crop (1:1)</SelectItem>
                        <SelectItem value="longest">Scale Longest Side</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Target Size</Label>
                  <Select value={targetSize} onValueChange={onTargetSizeChange}>
                    <SelectTrigger className="w-full h-9 bg-background border-white/10 text-xs">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="512">512px</SelectItem>
                      <SelectItem value="768">768px</SelectItem>
                      <SelectItem value="1024">1024px</SelectItem>
                      <SelectItem value="2048">2048px</SelectItem>
                      <SelectItem value="original">Original Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="default"
                  size="sm"
                  disabled={isProcessing}
                  onClick={onBatchCrop}
                  className="w-full h-9 text-xs"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="h-4 w-4" />
                  )}
                  Apply Batch Crop
                </Button>

                <Dialog
                  open={isBatchRenameDialogOpen}
                  onOpenChange={onBatchRenameDialogOpenChange}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <ListOrdered className="h-4 w-4 mr-2" />
                      Batch Rename (Files)
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Batch Rename Images</DialogTitle>
                      <DialogDescription>
                        All images in this collection will be renamed to <b>prefix_01, prefix_02...</b>
                        <br />
                        <span className="text-destructive font-semibold">
                          Important: This operation cannot be easily undone.
                        </span>
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>File Prefix</Label>
                        <Input
                          placeholder="e.g. character_name_v1"
                          value={renamePrefix}
                          onChange={(e) => onRenamePrefixChange(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        onClick={() => onBatchRenameDialogOpenChange(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={onBatchRename}
                        disabled={isProcessing || !renamePrefix}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Execute Rename
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={selectedCount > 0 ? 'default' : 'outline'}
            disabled={isProcessing || (selectedCount > 0 && !batchPrefix.trim())}
            onClick={onPrimaryBatchAction}
            className={selectedCount > 0 ? 'bg-teal-600 border-teal-600 text-white hover:bg-teal-500 h-9 px-3 rounded-lg shadow-sm' : 'text-zinc-300 border-[#2e2e2e] bg-[#1a1a1a] hover:bg-[#2a2a2a] hover:text-white h-9 px-3 rounded-lg shadow-sm'}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : selectedCount > 0 ? (
              <Plus className="h-4 w-4 mr-2" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            {selectedCount > 0 ? `批量打标 (${selectedCount})` : 'Optimize All'}
          </Button>

          {selectedCount > 0 && (
            <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 rounded-lg px-2 py-1 h-9 animate-in fade-in slide-in-from-top-2 duration-100">
              <span className="text-xs font-medium text-teal-500 mr-2">{selectedCount} Selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="h-8 text-[10px] px-2 hover:bg-teal-500/20 text-teal-400"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeselectAll}
                className="h-8 text-[10px] px-2 hover:bg-teal-500/20 text-teal-400"
              >
                Deselect
              </Button>
              <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1" />

              <Button
                variant="outline"
                size="sm"
                onClick={onOptimizeSelected}
                disabled={isProcessing}
                className="h-8 text-[10px] px-3 font-bold border-teal-500/30 text-teal-500 hover:bg-teal-500/10"
                title="AI Optimize selected images"
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Wand2 className="h-3 w-3 mr-1" />
                )}
                Optimize Selected
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={onBatchDelete}
                disabled={isProcessing}
                className="h-8 text-[10px] px-3 font-bold shadow-lg"
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Delete Batch
              </Button>
            </div>
          )}

          <div className="flex items-center bg-[#1a1a1a] rounded-lg p-1 border border-[#2e2e2e] h-9">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPromptLangSwitch('zh')}
              className={`h-8 px-3 text-xs ${activePromptLang === 'zh' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              中文
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPromptLangSwitch('en')}
              className={`h-8 px-3 text-xs ${activePromptLang === 'en' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              English
            </Button>
          </div>

          <div className="w-[1px] h-4 bg-[#2e2e2e] ml-1 mr-2"></div>

          <Button variant="outline" disabled={isProcessing} onClick={onExport} className="text-zinc-300 border-[#2e2e2e] hover:bg-[#2a2a2a] hover:text-white h-9 px-3 rounded-lg">
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>
        </div>
      </div>

      {isPromptPanelOpen && (
        <div className="p-5 bg-card border border-white/10 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              System prompt for this collection
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
              onClick={onTogglePromptPanel}
              title="Collapse"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>

          <SystemPromptTextarea
            value={systemPrompt}
            onCommit={onSystemPromptCommit}
            onEditingChange={onSystemPromptEditingChange}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-2">
            {PROMPT_MODIFIERS.map((modifier) => (
              <div
                key={modifier.id}
                className="flex items-start gap-2.5 group cursor-pointer"
                onClick={() =>
                  onModifierChange(
                    modifier.text,
                    !systemPromptLiveValue.includes(modifier.text),
                  )
                }
              >
                <Checkbox
                  id={modifier.id}
                  checked={systemPrompt.includes(modifier.text)}
                  className="mt-0.5 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={(checked) =>
                    onModifierChange(modifier.text, !!checked)
                  }
                />
                <Label
                  htmlFor={modifier.id}
                  className="text-[12px] text-muted-foreground group-hover:text-foreground leading-relaxed cursor-pointer transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {modifier.label}
                </Label>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            * This prompt will be used for all images in this collection when clicking
            &quot;Optimize&quot;. Changes are auto-saved.
          </p>

          <div className="border-t border-white/10 my-4"></div>
        </div>
      )}
    </div>
  );
}
