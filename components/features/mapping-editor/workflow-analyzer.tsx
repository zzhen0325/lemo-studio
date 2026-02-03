"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Layers,
  Info,
  CheckCircle2,
  Hash,
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

interface RawWorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: {
    title?: string;
  };
  [key: string]: unknown;
}

interface WorkflowAnalyzerProps {
  workflowApiJSON: WorkflowApiJSON;
  onParameterSelect?: (nodeId: string, parameterKey: string) => void;
  existingComponents?: UIComponent[];
  onComponentCreate?: (component: UIComponent) => void;
  onComponentUpdate?: (index: number, component: UIComponent) => void;
  onComponentDelete?: (index: number) => void;
}

interface ParsedNode extends RawWorkflowNode {
  id: string;
  inputCount: number;
  primitiveInputCount: number;
  outputConnections: string[];
  hasComplexInputs: boolean;
}

export function WorkflowAnalyzer({
  workflowApiJSON,
  onParameterSelect,
  existingComponents = [],
  onComponentCreate,
  onComponentDelete
}: WorkflowAnalyzerProps) {
  const [editingParam, setEditingParam] = useState<{ nodeId: string; key: string; label: string; defaultValue: unknown } | null>(null);

  const handleQuickMap = (nodeId: string, parameterKey: string, value: unknown, targetKey: string) => {
    const target = PLAYGROUND_TARGETS.find(t => t.key === targetKey);
    if (!target) return;

    const component: UIComponent = {
      id: `pg_map_${Date.now()}`,
      type: target.type,
      label: target.label,
      properties: { defaultValue: value, paramName: target.key, placeholder: `Mapped to ${target.label}` },
      validation: {},
      mapping: { workflowPath: [nodeId, "inputs", parameterKey], parameterKey: parameterKey, defaultValue: value },
      orderIndex: existingComponents.length
    };
    onComponentCreate?.(component);
  };

  const handleCustomMapSubmit = () => {
    if (!editingParam) return;

    const component: UIComponent = {
      id: `custom_map_${Date.now()}`,
      type: typeof editingParam.defaultValue === 'number' ? 'number' : 'text',
      label: editingParam.label,
      properties: { defaultValue: editingParam.defaultValue },
      validation: {},
      mapping: { workflowPath: [editingParam.nodeId, "inputs", editingParam.key], parameterKey: editingParam.key, defaultValue: editingParam.defaultValue },
      orderIndex: existingComponents.length
    };
    onComponentCreate?.(component);
    setEditingParam(null);
  };
  // 解析工作流节点
  const parsedNodes = useMemo(() => {
    const nodes: ParsedNode[] = [];

    Object.entries(workflowApiJSON).forEach(([nodeId, nodeData]) => {
      // Calculate inputs that are NOT connections (primitive values)
      const primitiveInputCount = nodeData.inputs ? Object.values(nodeData.inputs).filter(v => !Array.isArray(v)).length : 0;
      const inputCount = nodeData.inputs ? Object.keys(nodeData.inputs).length : 0;

      // 查找输出连接
      const outputConnections: string[] = [];
      Object.entries(workflowApiJSON).forEach(([otherNodeId, otherNodeData]) => {
        if (otherNodeData.inputs) {
          Object.values(otherNodeData.inputs).forEach((inputValue) => {
            if (Array.isArray(inputValue) && inputValue[0] === nodeId) {
              outputConnections.push(otherNodeId);
            }
          });
        }
      });

      // 检查是否有复杂输入（非基本类型）
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

    return nodes.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }, [workflowApiJSON]);

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
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          <div className="flex items-center gap-2 text-white/90 text-[11px] uppercase tracking-[0.2em] font-black">
            Workflow Nodes
          </div>
        </div>
        <Badge variant="secondary" className="bg-white/5 text-zinc-500 border border-white/5 font-mono text-[10px] px-2 py-0.5 rounded-lg">
          {parsedNodes.length} ACTIVE_UNITS
        </Badge>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="columns-4 md:columns-6 xl:columns-8 gap-3 pb-6 space-y-3">
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
                  <Card
                    className={cn(
                      "transition-all duration-200",
                      isMapped
                        ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                        : "bg-[#131414] hover:bg-[#1a1b1b] border-[#2a2b2b]"
                    )}
                  >
                    <CardContent className="p-4">
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
                          <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5 bg-white/5 text-white/30 border-white/5">
                            #{node.id}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {mappedParamCount > 0 && (
                            <Badge className="text-[9px] px-1.5 h-5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20">
                              Mapped {mappedParamCount}
                            </Badge>
                          )}

                          {node.primitiveInputCount > 0 && (
                            <div className="flex items-center gap-1 text-white/20">
                              <Hash className="w-3 h-3" />
                              <span className="text-[10px] font-medium">{node.primitiveInputCount} params</span>
                            </div>
                          )}
                          {node.hasComplexInputs && (
                            <Info className="w-3 h-3 text-amber-500/50" />
                          )}
                        </div>
                      </div>

                      <motion.div
                        className="mt-4 pt-4 border-t border-white/5 space-y-1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 px-1">Parameters</div>
                        <div className="space-y-1">
                          {Object.entries(node.inputs || {}).map(([key, value]) => {
                            const isConnection = Array.isArray(value);
                            const valueType = isConnection ? "connection" : typeof value;
                            const isMapped = existingComponents.some(
                              c => c.mapping.workflowPath.includes(node.id) && c.mapping.parameterKey === key
                            );
                            const mappedCompIndex = existingComponents.findIndex(
                              c => c.mapping.workflowPath.includes(node.id) && c.mapping.parameterKey === key
                            );
                            const mappedComp = mappedCompIndex >= 0 ? existingComponents[mappedCompIndex] : null;

                            return (
                              <div
                                key={key}
                                className={cn(
                                  "group/param flex items-center justify-between p-2.5 rounded-xl text-[11px] transition-all duration-300 border bg-black/20 border-white/[0.03] hover:border-white/10"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onParameterSelect?.(node.id, key);
                                }}
                              >
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="truncate text-white/60 font-medium" title={key}>{key}</span>
                                    {isMapped && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                                    <Badge variant="outline" className={cn(
                                      "text-[8px] px-1 h-3.5 border-white/5 font-mono tracking-tighter",
                                      isConnection ? "text-amber-500/50 border-amber-500/10" : "text-white/20"
                                    )}>
                                      {isConnection ? 'LINK' : valueType.toUpperCase()}
                                    </Badge>
                                  </div>

                                  {isMapped && mappedComp && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg w-fit">
                                      <span className="text-[10px] grayscale group-hover/param:grayscale-0 transition-all">
                                        {PLAYGROUND_TARGETS.find(t => t.key === mappedComp.properties.paramName)?.icon || "💡"}
                                      </span>
                                      <span className="text-[10px] text-emerald-400/80 font-bold truncate max-w-[80px]">{mappedComp.label}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 ml-2">
                                  {!isConnection && (
                                    <>
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
                                              {PLAYGROUND_TARGETS.filter(t => {
                                                if (valueType === 'string') return t.supportedTypes.includes('string');
                                                if (valueType === 'number') return t.supportedTypes.includes('number');
                                                return false;
                                              }).map((target) => (
                                                <Button
                                                  key={target.key}
                                                  variant="ghost"
                                                  className="w-full justify-start h-9 px-2 text-[11px] text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                                  onClick={() => handleQuickMap(node.id, key, value, target.key)}
                                                >
                                                  <span className="mr-2 text-lg">{target.icon}</span>
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
                                    </>
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
      </ScrollArea >

      {/* Custom Mapping Dialog/Overlay */}
      <AnimatePresence>
        {
          editingParam && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
              onClick={() => setEditingParam(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
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
          )
        }
      </AnimatePresence >
    </div >
  );
}