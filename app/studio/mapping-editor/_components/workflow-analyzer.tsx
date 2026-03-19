"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  CheckCircle2,
  Plus,
  Zap,
  Trash2,
  X,
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAYGROUND_TARGETS } from "./parameter-mapping-panel";

// ComfyUI 原始节点的定义（非结构化数据）
interface RawWorkflowNode {
  inputs: Record<string, unknown>; // 节点的输入参数（可能是原始值或连接数组）
  class_type: string;              // 节点类型（如 KSampler, CheckpointLoaderSimple 等）
  _meta?: {
    title?: string;                // 用户自定义标题（ComfyUI 中重命名后的名称）
  };
  [key: string]: unknown;
}

// 组件输入属性接口
interface WorkflowAnalyzerProps {
  workflowApiJSON: WorkflowApiJSON; // 工作流的 API JSON 数据
  onParameterSelect?: (nodeId: string, parameterKey: string) => void; // 参数被选中时的回调
  existingComponents?: UIComponent[]; // 当前已经映射生成的 UI 组件列表
  onComponentCreate?: (component: UIComponent) => void; // 创建新映射组件的回调
  onComponentUpdate?: (index: number, component: UIComponent) => void; // 更新组件的回调
  onComponentDelete?: (index: number) => void; // 删除组件的回调
  onUpdateValue?: (nodeId: string, paramKey: string, value: unknown) => void;
}

// 经过解析扩展后的节点定义
interface ParsedNode extends RawWorkflowNode {
  id: string;                   // 节点 ID
  inputCount: number;           // 总输入数量
  primitiveInputCount: number;  // 原始值输入数量（非连接）
  outputConnections: string[];  // 该节点输出连接到的其他节点 ID 列表
  hasComplexInputs: boolean;    // 是否含有非数组且非基本类型的复杂输入
}

export function WorkflowAnalyzer({
  workflowApiJSON,
  onParameterSelect,
  existingComponents = [],
  onComponentCreate,
  onComponentDelete,
  onUpdateValue
}: WorkflowAnalyzerProps) {
  // 当前正在通过弹窗编辑标签的临时参数状态
  const [editingParam, setEditingParam] = useState<{ nodeId: string; key: string; label: string; defaultValue: unknown } | null>(null);
  const isSeedKey = (key: string) => /seed/i.test(key);
  const isValidPositiveInt = (value: unknown) => Number.isInteger(value) && Number(value) > 0;
  const createRandomSeed = () => Math.floor(Math.random() * 1_000_000_000) + 1;

  /**
   * 快速匹配逻辑：将参数直接映射到 Playground 的预设目标（如种子、步数等）
   */
  const handleQuickMap = (nodeId: string, parameterKey: string, value: unknown, targetKey: string) => {
    const target = PLAYGROUND_TARGETS.find(t => t.key === targetKey);
    if (!target) return;

    const component: UIComponent = {
      id: `pg_map_${Date.now()}`,
      type: target.type,
      label: target.label,
      properties: {
        defaultValue: value,
        paramName: target.key,
        placeholder: `已映射到 ${target.label}`
      },
      validation: {},
      mapping: {
        workflowPath: [nodeId, "inputs", parameterKey],
        parameterKey: parameterKey,
        defaultValue: value
      },
      orderIndex: existingComponents.length
    };
    onComponentCreate?.(component);
  };

  /**
   * 自定义标签映射提交逻辑
   */
  const handleCustomMapSubmit = () => {
    if (!editingParam) return;

    const component: UIComponent = {
      id: `custom_map_${Date.now()}`,
      type: typeof editingParam.defaultValue === 'number' ? 'number' : 'text', // 根据默认值自动推断类型
      label: editingParam.label,
      properties: { defaultValue: editingParam.defaultValue },
      validation: {},
      mapping: { workflowPath: [editingParam.nodeId, "inputs", editingParam.key], parameterKey: editingParam.key, defaultValue: editingParam.defaultValue },
      orderIndex: existingComponents.length
    };
    onComponentCreate?.(component);
    setEditingParam(null); // 关闭弹窗
  };
  /**
   * 解析工作流 API JSON 得到结构化的节点列表
   * 主要是计算输入输出连接，以及判定是否为原始值
   */
  const parsedNodes = useMemo(() => {
    const nodes: ParsedNode[] = [];

    Object.entries(workflowApiJSON).forEach(([nodeId, nodeData]) => {
      // 这里的 primitiveInput 指的是非数组值（在 Comfy 格式中，连接通常是 [nodeId, outputIndex] 数组）
      const primitiveInputCount = nodeData.inputs ? Object.values(nodeData.inputs).filter(v => !Array.isArray(v)).length : 0;
      const inputCount = nodeData.inputs ? Object.keys(nodeData.inputs).length : 0;

      // 寻找哪些节点引用了当前节点的输出
      const outputConnections: string[] = [];
      Object.entries(workflowApiJSON).forEach(([otherNodeId, otherNodeData]) => {
        if (otherNodeData.inputs) {
          Object.values(otherNodeData.inputs).forEach((inputValue) => {
            // 如果输入值是数组且第一个元素是当前 nodeId，说明存在输出连接
            if (Array.isArray(inputValue) && inputValue[0] === nodeId) {
              outputConnections.push(otherNodeId);
            }
          });
        }
      });

      // 检查是否包含特殊对象格式的复杂输入
      const hasComplexInputs = nodeData.inputs ?
        Object.values(nodeData.inputs).some(value =>
          typeof value === 'object' && !Array.isArray(value)
        ) : false;

      nodes.push({
        id: nodeId,
        ...nodeData,
        inputCount,
        primitiveInputCount,
        outputConnections: [...new Set(outputConnections)],
        hasComplexInputs
      });
    });

    // 默认按节点 ID 排序
    return nodes.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }, [workflowApiJSON]);

  const seedFixups = useMemo(() => {
    const updates: { nodeId: string; key: string; value: number }[] = [];
    Object.entries(workflowApiJSON).forEach(([nodeId, nodeData]) => {
      Object.entries(nodeData.inputs || {}).forEach(([key, value]) => {
        if (!isSeedKey(key) || Array.isArray(value)) return;
        if (!isValidPositiveInt(value)) {
          updates.push({ nodeId, key, value: createRandomSeed() });
        }
      });
    });
    return updates;
  }, [workflowApiJSON]);

  useEffect(() => {
    if (!onUpdateValue || seedFixups.length === 0) return;
    seedFixups.forEach(update => onUpdateValue(update.nodeId, update.key, update.value));
  }, [onUpdateValue, seedFixups]);

  /**
   * 根据节点类型字符串生成一致的视觉色调
   */

  const getNodeTypeColor = (classType: string): string => {
    const hash = classType.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    const colors = [
      "border-blue-500/30 text-blue-400 bg-blue-500/5",
      "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
      "border-purple-500/30 text-purple-400 bg-purple-500/5",
      "border-amber-500/30 text-amber-400 bg-amber-500/5",
      "border-rose-500/30 text-rose-400 bg-rose-500/5",
      "border-indigo-500/30 text-indigo-400 bg-indigo-500/5"
    ];

    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2 text-white/90 text-2xl font-black">
          Workflow Nodes
        </div>
        <Badge variant="secondary" className="bg-white/5 text-zinc-500 border border-white/5 font-mono text-[10px] px-2 py-0.5 rounded-lg">
          {parsedNodes.length} ACTIVE_UNITS
        </Badge>
      </div>

      <div className="px-2">
        <div className="columns-2 sm:columns-3 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3 w-full">
          <AnimatePresence mode="popLayout">
            {parsedNodes.map((node, index) => {
              const mappedParamCount = Object.keys(node.inputs || {}).filter(key =>
                existingComponents.some(
                  c => c.mapping.workflowPath.includes(node.id) && c.mapping.parameterKey === key
                )
              ).length;

              const isMapped = mappedParamCount > 0;

              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className="group break-inside-avoid mb-3"
                >
                  {/* 节点卡片容器 */}
                  <Card
                    className={cn(
                      "transition-all duration-200 rounded-3xl",
                      isMapped
                        ? "border-[#1688ce] bg-gradient-to-b from-[#1079BB] to-[#58B6F1]" // 映射过的节点显示深蓝色调
                        : "bg-[#131414] hover:bg-[#1a1b1b] border-[#2a2b2b]"
                    )}
                  >
                    <CardContent className="p-4">
                      {/* 卡片头部：标题与 ID */}
                      <div id={`node-${node.id}`} className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-white/90 truncate group-hover:text-white transition-colors" title={node._meta?.title || node.class_type}>
                              {node._meta?.title || node.class_type}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 border leading-relaxed uppercase tracking-wider font-bold ${getNodeTypeColor(node.class_type)}`}
                              >
                                {node.class_type}
                              </Badge>
                            </div>
                          </div>
                          <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5 bg-[#e0fcbc3e] text-white border-white/5">
                            #{node.id}
                          </Badge>
                        </div>
                      </div>

                      {/* 参数列表区域 */}
                      <motion.div
                        className="mt-4  space-y-1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="text-[10px] font-bold text-white/60 mb-2 px-1">Parameters</div>
                        <div className="space-y-1">
                          {Object.entries(node.inputs || {}).map(([key, value]) => {
                            const isConnection = Array.isArray(value);
                            // 检查该特定参数是否已存在于映射组件中
                            const isMapped = existingComponents.some(
                              c => c.mapping.workflowPath.includes(node.id) && c.mapping.parameterKey === key
                            );
                            const mappedCompIndex = existingComponents.findIndex(
                              c => c.mapping.workflowPath.includes(node.id) && c.mapping.parameterKey === key
                            );
                            const mappedComp = mappedCompIndex >= 0 ? existingComponents[mappedCompIndex] : null;

                            const isSeedParam = isSeedKey(key) && !isConnection;
                            const seedValue = isValidPositiveInt(value) ? Number(value) : undefined;
                            return (
                              <div
                                key={key}
                                className={cn(
                                  "group/param flex items-center justify-between px-4 py-3 rounded-2xl text-[11px] transition-all duration-300 ",
                                  isMapped
                                    ? "bg-[#0A649C]/50 border border-[#49AFEF] text-white" // 已映射参数显示亮绿色
                                    : "bg-black/40 border-white/[0.03] hover:border-white/10 text-white/60"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onParameterSelect?.(node.id, key);
                                }}
                              >
                                <div className="flex flex-col  w-full ">
                                  <div className="flex items-center  justify-between ">

                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={cn("text-sm font-bold truncate", isMapped ? "text-white" : "text-white/60")} title={key}>{key}</span>
                                      {isSeedParam && (
                                        <span className="text-[10px] font-mono text-white/40 truncate">
                                          {seedValue ?? "—"}
                                        </span>
                                      )}
                                    </div>


                                    {/* <Badge variant="outline" className={cn(
                                      "text-[8px] px-1.5 h-3.5 border-white/5 font-mono tracking-tighter",
                                      isConnection ? "text-white/50 border-white/10" : "text-white/20"
                                    )}>
                                      {isConnection ? 'LINK' : valueType.toUpperCase()}
                                    </Badge> */}


                                    {/* 断开连接 */}
                                    {!isConnection && (
                                      <div className="flex items-center gap-1.5">
                                        {isSeedParam && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/10 rounded-lg uppercase tracking-widest"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onUpdateValue?.(node.id, key, createRandomSeed());
                                            }}
                                          >
                                            随机
                                          </Button>
                                        )}
                                        {isMapped ? (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onComponentDelete?.(mappedCompIndex);
                                            }}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        ) : (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-white/20 hover:text-primary hover:bg-primary/10 rounded-lg"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <Zap className="w-3.5 h-3.5" />
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2 bg-zinc-900 border-white/10 backdrop-blur-xl" side="right" align="start">
                                              <div className="space-y-1">
                                                <div className="px-2 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5 mb-1">Quick Match</div>
                                                {PLAYGROUND_TARGETS.map((target) => (
                                                  <Button
                                                    key={target.key}
                                                    variant="ghost"
                                                    className="w-full justify-start h-9 px-2 text-[11px] text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                                    onClick={() => handleQuickMap(node.id, key, value, target.key)}
                                                  >
                                                    <span className="mr-2 text-lg opacity-80">{target.icon}</span>
                                                    {target.label}
                                                  </Button>
                                                ))}

                                                <div className="pt-2 mt-1 border-t border-white/5">
                                                  <Button
                                                    variant="ghost"
                                                    className="w-full justify-start h-9 px-2 text-[10px] font-bold text-primary/80 hover:text-primary hover:bg-primary/10 rounded-lg uppercase tracking-wider"
                                                    onClick={() => setEditingParam({ nodeId: node.id, key, label: key, defaultValue: value })}
                                                  >
                                                    <Plus className="w-3.5 h-3.5 mr-2" />
                                                    Custom Label
                                                  </Button>
                                                </div>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                    )}


                                  </div>

                                  {isMapped && mappedComp && (
                                    <div className="flex items-center text-[#e0fcbc] mt-2  w-full gap-1.5 px-2 py-2 bg-[#42A3E1] border border-emerald-500/10 rounded-lg ">
                                      {/* <span className="text-[10px]  ">
                                        {PLAYGROUND_TARGETS.find(t => t.key === mappedComp.properties.paramName)?.icon || "💡"}
                                      </span> */}
                                      {isMapped && <CheckCircle2 className="w-3.5 h-3.5 text-[#e0fcbc] flex-shrink-0" />}
                                      <span className="text-[10px]  font-bold ">{mappedComp.label}</span>
                                    </div>

                                  )}
                                </div>


                              </div>
                            );
                          })}
                          {Object.keys(node.inputs || {}).length === 0 && (
                            <div className="text-[10px] text-white/20 italic px-2 py-4 text-center">No configurable parameters</div>
                          )}
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {parsedNodes.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-white/20">
              <Layers className="w-12 h-12 mb-4 opacity-10" />
              <p className="text-sm font-medium">No nodes found in workflow</p>
            </div>
          )}
        </div>
      </div>

      {/* 自定义映射配置弹窗层 */}
      <AnimatePresence>
        {editingParam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-layer-dialog flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            onClick={() => setEditingParam(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* 弹窗头部 */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Create Custom Mapping</h3>
                    <p className="text-xs text-white/40 font-medium uppercase tracking-widest mt-0.5">Node #{editingParam.nodeId} • {editingParam.key}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditingParam(null)} className="rounded-full hover:bg-white/5">
                  <X className="w-5 h-5 text-white/20" />
                </Button>
              </div>

              {/* 弹窗内容：标签输入 */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">Display Label</Label>
                  <Input
                    className="h-12 bg-white/5 border-white/5 rounded-xl focus:ring-primary/20 transition-all text-sm"
                    value={editingParam.label}
                    onChange={e => setEditingParam(prev => prev ? { ...prev, label: e.target.value } : null)}
                    placeholder="Enter UI label (e.g. Master Scale)..."
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">Default Value</Label>
                  <Input
                    className="h-12 bg-white/5 border-white/5 rounded-xl text-zinc-500 font-mono text-sm"
                    value={String(editingParam.defaultValue)}
                    disabled
                  />
                </div>

                {/* 操作按钮组 */}
                <div className="flex gap-3 pt-4">
                  <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-[11px] font-bold uppercase tracking-widest" onClick={handleCustomMapSubmit}>
                    Confirm Mapping
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 rounded-xl border-white/5 bg-white/5 hover:bg-white/10 text-[11px] font-bold uppercase tracking-widest" onClick={() => setEditingParam(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
