"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Layers,
  Info,
  CheckCircle2,
  Hash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { cn } from "@/lib/utils";

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
  selectedNode?: string | null;
  selectedParameter?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  onParameterSelect?: (nodeId: string, parameterKey: string) => void;
  existingComponents?: UIComponent[];
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
  selectedNode,
  selectedParameter,
  onNodeSelect,
  onParameterSelect,
  existingComponents = []
}: WorkflowAnalyzerProps) {
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

  const handleNodeClick = (nodeId: string) => {
    onNodeSelect?.(nodeId);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">
          <AnimatePresence mode="popLayout">
            {parsedNodes.map((node, index) => {
              const isSelected = selectedNode === node.id;
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
                  onClick={() => handleNodeClick(node.id)}
                  className="cursor-pointer group"
                >
                  <Card
                    className={cn(
                      "transition-all duration-500 border-white/5 bg-white/[0.01] hover:bg-white/[0.03] overflow-hidden relative rounded-2xl",
                      isSelected
                        ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_30px_rgba(59,130,246,0.1)] ring-1 ring-primary/20"
                        : isMapped
                          ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                          : ""
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
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

                      {isSelected && (
                        <motion.div
                          className="mt-4 pt-4 border-t border-white/5 space-y-1.5"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                        >
                          <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 px-1">Parameters</div>
                          <div className="space-y-1">
                            {Object.entries(node.inputs || {}).map(([key, value]) => {
                              const isConnection = Array.isArray(value);
                              const valueType = isConnection ? "connection" : typeof value;
                              const isMapped = existingComponents.some(
                                c => c.mapping.workflowPath.includes(node.id) && c.mapping.parameterKey === key
                              );
                              const isParamSelected = selectedParameter === key;

                              return (
                                <div
                                  key={key}
                                  className={cn(
                                    "flex items-center justify-between p-2.5 rounded-xl text-[11px] cursor-pointer transition-all duration-300 border",
                                    isParamSelected
                                      ? "bg-primary/10 text-white font-bold border-primary/20 shadow-inner"
                                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border-transparent",
                                    isMapped && !isParamSelected && "bg-emerald-500/[0.03] text-emerald-400 border-emerald-500/10"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onParameterSelect?.(node.id, key);
                                  }}
                                >
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    {isMapped && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                                    <span className="truncate" title={key}>{key}</span>
                                  </div>
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] px-1.5 h-4 border-white/5 font-mono tracking-tighter",
                                    isConnection ? "text-amber-500/50 border-amber-500/10" : "text-zinc-600"
                                  )}>
                                    {isConnection ? 'LINK' : valueType.toUpperCase()}
                                  </Badge>
                                </div>
                              );
                            })}
                            {Object.keys(node.inputs || {}).length === 0 && (
                              <div className="text-[10px] text-white/20 italic px-2 py-4 text-center">No configurable parameters</div>
                            )}
                          </div>
                        </motion.div>
                      )}
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
      </ScrollArea>
    </div>
  );
}