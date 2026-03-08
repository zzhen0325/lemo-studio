"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Plus,
  Edit3,
  X,
  Link,
  Sparkles,
  Zap,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import {
  UIComponent,
  ComponentType,
} from "@/types/features/mapping-editor";
import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { MappingList } from "./mapping-list";

/**
 * 参数映射面板的属性定义
 */
interface ParameterMappingPanelProps {
  workflowApiJSON: WorkflowApiJSON;    // 工作流的 API JSON 定义
  selectedNode?: string | null;       // 当前选中的节点 ID
  selectedParameter?: string | null;  // 当前选中的参数键名
  existingComponents: UIComponent[];  // 已存在的 UI 组件映射列表
  onComponentCreate?: (component: UIComponent) => void;      // 创建组件的回调
  onComponentUpdate?: (index: number, component: UIComponent) => void; // 更新组件的回调
  onComponentDelete?: (index: number) => void;              // 删除组件的回调
  onParameterSelect?: (nodeId: string, parameterKey: string) => void; // 选择参数的回调
  editingComponentIndex?: number | null; // 外部触发的正在编辑的组件索引
  onCancelEdit?: () => void;            // 取消编辑的回调
  onEdit?: (index: number) => void;     // 触发编辑的回调
}

/**
 * 游乐场（Playground）支持的预定义目标映射类型
 */
export const PLAYGROUND_TARGETS = [
  { key: 'prompt', label: 'Prompt', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '📝' },
  { key: 'width', label: 'Width', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'height', label: 'Height', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'base_model', label: 'Base Model', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🤖' },
  { key: 'lora1', label: 'LoRA 1', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora2', label: 'LoRA 2', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora3', label: 'LoRA 3', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora1_strength', label: 'LoRA 1 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'lora2_strength', label: 'LoRA 2 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'lora3_strength', label: 'LoRA 3 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'batch_size', label: 'Batch Size', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '🔢' },
  { key: 'sourceImageUrl1', label: 'Reference Image 1', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
  { key: 'sourceImageUrl2', label: 'Reference Image 2', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
  { key: 'sourceImageUrl3', label: 'Reference Image 3', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
  { key: 'sourceImageUrl4', label: 'Reference Image 4', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
];

/**
 * 参数映射面板组件
 * 用于配置工作流节点参数与 UI 组件之间的映射关系
 */
export function ParameterMappingPanel({
  workflowApiJSON,
  selectedNode,
  selectedParameter,
  existingComponents,
  onComponentCreate,
  onComponentUpdate,
  onComponentDelete,
  onEdit,
  editingComponentIndex,
  onCancelEdit
}: ParameterMappingPanelProps) {
  const [localEditingIndex, setLocalEditingIndex] = useState<number | null>(null);
  const [newComponent, setNewComponent] = useState<Partial<UIComponent> | null>(null);

  // 优先级：外部传入的编辑索引 > 内部维护的编辑索引
  const effectiveEditingIndex = editingComponentIndex !== undefined && editingComponentIndex !== null
    ? editingComponentIndex
    : localEditingIndex;

  // 计算当前选中参数的详细信息
  const selectedParameterInfo = useMemo(() => {
    if (!selectedNode || !selectedParameter || !workflowApiJSON[selectedNode]) return null;
    const node = workflowApiJSON[selectedNode];
    const parameterValue = node.inputs?.[selectedParameter];
    if (parameterValue === undefined) return null;
    return {
      nodeId: selectedNode,
      parameterKey: selectedParameter,
      currentValue: parameterValue,
      valueType: Array.isArray(parameterValue) ? "connection" : typeof parameterValue, // 数组代表节点间的连接
      isConnection: Array.isArray(parameterValue),
      nodeClass: node.class_type
    };
  }, [selectedNode, selectedParameter, workflowApiJSON]);

  // 检查当前参数是否已经被映射
  const existingMappingIndex = useMemo(() => {
    if (!selectedNode || !selectedParameter) return -1;
    return existingComponents.findIndex(comp =>
      comp.mapping.workflowPath.includes(selectedNode) && comp.mapping.parameterKey === selectedParameter
    );
  }, [selectedNode, selectedParameter, existingComponents]);

  /**
   * 处理快速映射逻辑
   * 将工作流参数直接绑定到预定义的 UI 目标（如 Prompt, Width 等）
   */
  const handleDirectMapping = (nodeId: string, parameterKey: string, currentValue: unknown, targetKey: string) => {
    const target = PLAYGROUND_TARGETS.find(t => t.key === targetKey);
    if (!target) return;
    const component: UIComponent = {
      id: `pg_map_${Date.now()}`,
      type: target.type,
      label: target.label,
      properties: { defaultValue: currentValue, paramName: target.key, placeholder: `已映射到 ${target.label}` },
      validation: {},
      mapping: { workflowPath: [nodeId, "inputs", parameterKey], parameterKey: parameterKey, defaultValue: currentValue },
      orderIndex: existingComponents.length
    };
    onComponentCreate?.(component);
  };

  /**
   * 根据数据类型返回对应的样式颜色
   */
  const getValueTypeColor = (type: string) => {
    switch (type) {
      case "string": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "number": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "connection": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      default: return "text-white/40 bg-white/5 border-white/10";
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="space-y-6">
        {/* 参数详情卡片 (始终展示，无选中时置灰) */}
        <div className={cn(
          "transition-all duration-300",
          !selectedParameterInfo && "opacity-40 grayscale pointer-events-none"
        )}>
          <Card className="bg-white/[0.02] border-white/5 backdrop-blur-3xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-[12px] font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-blue-400" />
                {selectedParameterInfo ? "已选择参数 (Selected Parameter)" : "请选择参数 (Select a Parameter)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* 节点与键名展示 */}
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 font-mono text-[10px] py-1">
                  节点 {selectedParameterInfo ? `#${selectedParameterInfo.nodeId}` : "#--"}
                </Badge>
                <ArrowRight className="w-3 h-3 text-white/20" />
                <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-400 font-mono text-[10px] py-1">
                  {selectedParameterInfo ? selectedParameterInfo.parameterKey : "未选择"}
                </Badge>
              </div>

              {/* 节点类型与数据类型 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">节点类型</span>
                  <div className="text-xs text-white/60 font-medium truncate">
                    {selectedParameterInfo ? selectedParameterInfo.nodeClass : "Unknown"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">数据类型</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] border leading-relaxed",
                    selectedParameterInfo ? getValueTypeColor(selectedParameterInfo.valueType) : "text-white/20 bg-white/5 border-white/10"
                  )}>
                    {selectedParameterInfo ? selectedParameterInfo.valueType.toUpperCase() : "NONE"}
                    {selectedParameterInfo?.isConnection && <Link className="w-2.5 h-2.5 ml-1 opacity-50" />}
                  </Badge>
                </div>
              </div>

              {/* 当前默认值 */}
              <div className="space-y-2">
                <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">当前默认值</span>
                <div className="p-3 bg-black/20 rounded-xl text-[11px] font-mono text-white/40 border border-white/5 break-all max-h-24 overflow-y-auto leading-relaxed">
                  {selectedParameterInfo ? JSON.stringify(selectedParameterInfo.currentValue) : "null"}
                </div>
              </div>

              {/* 映射状态展示：连接、已映射、或待映射 */}
              {selectedParameterInfo?.isConnection ? (
                /* 1. 如果是节点连接，不可直接映射 */
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Link className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-500/80 uppercase tracking-wider">节点连接 (Node Connection)</h4>
                    <p className="text-[11px] text-amber-500/50 mt-1 leading-relaxed">该参数由另一个节点驱动，无法直接映射为 UI 组件。</p>
                  </div>
                </div>
              ) : existingMappingIndex >= 0 ? (
                /* 2. 如果已经映射过，显示已映射状态 */
                <div className="p-4 bg-primary/5 border border-primary/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider">已映射 (Already Mapped)</h4>
                      <p className="text-[11px] text-primary/50 mt-1 leading-relaxed">已配置并准备就绪。</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/40 hover:text-white hover:bg-white/5"
                    onClick={() => setLocalEditingIndex(existingMappingIndex)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                /* 3. 待映射展示快速绑定选项 */
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">快速绑定 (Quick Connect)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAYGROUND_TARGETS.map((target) => (
                      <Button
                        key={target.key}
                        variant="ghost"
                        size="sm"
                        className="justify-start bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 h-10 px-3 text-[11px] text-white/60 hover:text-white transition-all rounded-xl"
                        onClick={() => selectedParameterInfo && handleDirectMapping(selectedParameterInfo.nodeId, selectedParameterInfo.parameterKey, selectedParameterInfo.currentValue, target.key)}
                      >
                        <span className="mr-2 text-lg opacity-80">{target.icon}</span>
                        {target.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[11px] uppercase tracking-widest h-12 rounded-xl mt-4"
                    onClick={() => selectedParameterInfo && setNewComponent({
                      label: selectedParameterInfo.parameterKey,
                      type: selectedParameterInfo.valueType === 'number' ? 'number' : 'text',
                      properties: { defaultValue: selectedParameterInfo.currentValue },
                      mapping: { workflowPath: [selectedParameterInfo.nodeId, "inputs", selectedParameterInfo.parameterKey], parameterKey: selectedParameterInfo.parameterKey, defaultValue: selectedParameterInfo.currentValue },
                      validation: {},
                      orderIndex: existingComponents.length
                    })}
                  >
                    创建自定义映射 (Create Custom Mapping)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 新建映射配置区域 */}
        <AnimatePresence>
          {newComponent && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <Card className="bg-blue-500/5 border-blue-500/20 backdrop-blur-3xl">
                <CardHeader className="pb-3 border-b border-blue-500/10">
                  <CardTitle className="text-[11px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-3 h-3" />
                    新建映射配置
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">组件标签</Label>
                      <Input
                        className="bg-white/5 border-white/5 text-white h-10 rounded-lg focus:border-primary/50"
                        value={newComponent.label || ""}
                        onChange={(e) => setNewComponent(prev => prev ? { ...prev, label: e.target.value } : null)}
                        placeholder="UI 中显示的名称..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">默认值</Label>
                      <Input
                        className="bg-white/5 border-white/5 text-white h-10 rounded-lg focus:border-primary/50"
                        value={newComponent.properties?.defaultValue || ""}
                        onChange={(e) => setNewComponent(prev => prev ? { ...prev, properties: { ...prev.properties!, defaultValue: e.target.value } } : null)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest h-10 rounded-lg" onClick={() => { onComponentCreate?.(newComponent as UIComponent); setNewComponent(null); }}>
                      确认创建
                    </Button>
                    <Button variant="ghost" className="px-3 text-white/40 hover:text-white hover:bg-white/5" onClick={() => setNewComponent(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 编辑存量映射区域 */}
        <AnimatePresence>
          {effectiveEditingIndex !== null && existingComponents[effectiveEditingIndex] && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <Card className="bg-white/[0.02] border-white/10 backdrop-blur-3xl">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-[11px] font-bold text-white/40 uppercase tracking-widest">编辑映射配置</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <MappingEditor
                    component={existingComponents[effectiveEditingIndex]}
                    onSave={(updated) => { onComponentUpdate?.(effectiveEditingIndex, updated); setLocalEditingIndex(null); onCancelEdit?.(); }}
                    onCancel={() => { setLocalEditingIndex(null); onCancelEdit?.(); }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 已存在的映射列表展示 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <MappingList
          components={existingComponents}
          onEdit={(index) => onEdit?.(index)}
          onDelete={(index) => onComponentDelete?.(index)}
        />
      </motion.div>
    </div>
  );
}

/**
 * 映射编辑器内部子组件
 * 用于修改已存在的映射标签和属性
 */
function MappingEditor({ component, onSave, onCancel }: { component: UIComponent; onSave: (c: UIComponent) => void; onCancel: () => void; }) {
  const [edited, setEdited] = useState<UIComponent>(component);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">组件标签名称</Label>
        <Input
          className="bg-white/5 border-white/5 text-white h-10 rounded-lg"
          value={edited.label}
          onChange={(e) => setEdited(prev => ({ ...prev, label: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[10px] uppercase tracking-widest h-10 rounded-lg" onClick={() => onSave(edited)}>
          保存修改
        </Button>
        <Button variant="ghost" className="px-3 text-white/40 hover:text-white" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
