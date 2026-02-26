import { ArrowRight, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnnotationRow, type TldrawAnnotationItem } from "./TldrawEditorWidgets";
import type { Editor } from "tldraw";

interface IntegratedInputProps {
  imageScreenBounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null;
  annotations: TldrawAnnotationItem[];
  localPrompt: string;
  setLocalPrompt: (prompt: string) => void;
  deleteAnnotation: (id: string) => void;
  onGenerate: () => void;
  isVisible: boolean;
  editor: Editor | null;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  batchSize: number;
  setBatchSize: (n: number) => void;
  modelOptions: Array<{ id: string; displayName: string }>;
}

export const IntegratedInput = ({
  imageScreenBounds,
  annotations,
  localPrompt,
  setLocalPrompt,
  deleteAnnotation,
  onGenerate,
  isVisible,
  editor,
  selectedModel,
  setSelectedModel,
  batchSize,
  setBatchSize,
  modelOptions,
}: IntegratedInputProps) => {
  if (!isVisible || !imageScreenBounds) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="absolute z-[100]"
      style={{
        left: imageScreenBounds.left - 400 - 16,
        top: imageScreenBounds.top,
        width: 400,
        height: imageScreenBounds.height,
      }}
    >
      <div className="h-full relative bg-white rounded-2xl shadow-xl shadow-black/5 border border-gray-100 p-1 flex flex-col gap-2 pointer-events-auto overflow-hidden">
        <div className="flex-1 flex flex-col bg-gray-50/50 rounded-xl border border-gray-100 focus-within:bg-white focus-within:border-gray-200 transition-all overflow-hidden h-10 min-h-[40px] max-h-[100px]">
          <Textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="输入全局修改要求..."
            className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 text-[10px] p-2 resize-none overflow-y-auto custom-scrollbar h-full min-h-full leading-relaxed"
          />
        </div>

        {annotations.length > 0 && (
          <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar px-1 py-0.5 border-t border-gray-100 pt-2">
            {annotations.map((ann) => (
              <AnnotationRow
                key={ann.id}
                ann={ann}
                editor={editor}
                deleteAnnotation={deleteAnnotation}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 px-0.5 pb-0.5 mt-auto border-t border-gray-100 pt-2 shrink-0">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 px-1.5 bg-white border-gray-100 rounded-lg text-[9px] font-bold text-gray-600 w-full shadow-none focus:ring-0">
              <SelectValue placeholder="模型" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-100 shadow-xl z-[100000]">
              {modelOptions.map((model) => (
                <SelectItem key={model.id} value={model.id} className="text-[10px] py-1.5">
                  {model.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center bg-white border border-gray-100 rounded-lg h-7 px-1 overflow-hidden">
              <Layers className="w-2.5 h-2.5 text-gray-400 shrink-0" />
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="bg-transparent border-none text-[9px] font-bold text-gray-600 w-full outline-none cursor-pointer text-center"
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}张
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={onGenerate}
              className="w-7 h-7 !bg-black hover:!bg-black/90 text-white rounded-lg p-0 shrink-0"
            >
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface SavePresetDialogProps {
  open: boolean;
  isSaving: boolean;
  presetName: string;
  onOpenChange: (open: boolean) => void;
  onPresetNameChange: (name: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SavePresetDialog({
  open,
  isSaving,
  presetName,
  onOpenChange,
  onPresetNameChange,
  onCancel,
  onConfirm,
}: SavePresetDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[425px] z-[100001] bg-white text-black border border-gray-200">
        <DialogHeader>
          <DialogTitle>存为预设</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">预设名称</Label>
            <Input
              id="name"
              value={presetName}
              onChange={(e) => onPresetNameChange(e.target.value)}
              placeholder="输入预设名称..."
              className="col-span-3"
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            取消
          </Button>
          <Button
            className="bg-black hover:bg-black/90 text-white min-w-[100px]"
            disabled={isSaving}
            onClick={onConfirm}
          >
            {isSaving ? "存储中..." : "确认存储"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
