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
  Settings,
  Sparkles,
  Zap,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  UIComponent,
  ComponentType,
} from "@/types/features/mapping-editor";
import { WorkflowApiJSON } from "@/lib/workflow-api-parser";

interface ParameterMappingPanelProps {
  workflowApiJSON: WorkflowApiJSON;
  selectedNode?: string | null;
  selectedParameter?: string | null;
  existingComponents: UIComponent[];
  onComponentCreate?: (component: UIComponent) => void;
  onComponentUpdate?: (index: number, component: UIComponent) => void;
  onComponentDelete?: (index: number) => void;
  onParameterSelect?: (nodeId: string, parameterKey: string) => void;
  editingComponentIndex?: number | null;
  onCancelEdit?: () => void;
}

const PLAYGROUND_TARGETS = [
  { key: 'prompt', label: 'Prompt', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '📝' },
  { key: 'width', label: 'Width', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'height', label: 'Height', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'batch_size', label: 'Batch Size', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '🔢' },
  { key: 'model', label: 'Model', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🤖' },
  { key: 'lora', label: 'LoRA', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'sourceImageUrl', label: 'Reference Image', type: 'image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
];

export function ParameterMappingPanel({
  workflowApiJSON,
  selectedNode,
  selectedParameter,
  existingComponents,
  onComponentCreate,
  onComponentUpdate,
  editingComponentIndex,
  onCancelEdit
}: ParameterMappingPanelProps) {
  const [localEditingIndex, setLocalEditingIndex] = useState<number | null>(null);
  const [newComponent, setNewComponent] = useState<Partial<UIComponent> | null>(null);

  const effectiveEditingIndex = editingComponentIndex !== undefined && editingComponentIndex !== null
    ? editingComponentIndex
    : localEditingIndex;

  const selectedParameterInfo = useMemo(() => {
    if (!selectedNode || !selectedParameter || !workflowApiJSON[selectedNode]) return null;
    const node = workflowApiJSON[selectedNode];
    const parameterValue = node.inputs?.[selectedParameter];
    if (parameterValue === undefined) return null;
    return {
      nodeId: selectedNode,
      parameterKey: selectedParameter,
      currentValue: parameterValue,
      valueType: Array.isArray(parameterValue) ? "connection" : typeof parameterValue,
      isConnection: Array.isArray(parameterValue),
      nodeClass: node.class_type
    };
  }, [selectedNode, selectedParameter, workflowApiJSON]);

  const existingMappingIndex = useMemo(() => {
    if (!selectedNode || !selectedParameter) return -1;
    return existingComponents.findIndex(comp =>
      comp.mapping.workflowPath.includes(selectedNode) && comp.mapping.parameterKey === selectedParameter
    );
  }, [selectedNode, selectedParameter, existingComponents]);

  const handleDirectMapping = (nodeId: string, parameterKey: string, currentValue: unknown, targetKey: string) => {
    const target = PLAYGROUND_TARGETS.find(t => t.key === targetKey);
    if (!target) return;
    const component: UIComponent = {
      id: `pg_map_${Date.now()}`,
      type: target.type,
      label: target.label,
      properties: { defaultValue: currentValue, paramName: target.key, placeholder: `Mapped to ${target.label}` },
      validation: {},
      mapping: { workflowPath: [nodeId, "inputs", parameterKey], parameterKey: parameterKey, defaultValue: currentValue },
      orderIndex: existingComponents.length
    };
    onComponentCreate?.(component);
  };

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
      <AnimatePresence mode="wait">
        {selectedParameterInfo ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="bg-white/[0.02] border-white/5 backdrop-blur-3xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
              <CardHeader className="pb-4 border-b border-white/5">
                <CardTitle className="text-[12px] font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  Selected Parameter
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 font-mono text-[10px] py-1">Node #{selectedParameterInfo.nodeId}</Badge>
                  <ArrowRight className="w-3 h-3 text-white/20" />
                  <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-400 font-mono text-[10px] py-1">{selectedParameterInfo.parameterKey}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Node Type</span>
                    <div className="text-xs text-white/60 font-medium truncate">{selectedParameterInfo.nodeClass}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Data Type</span>
                    <Badge variant="outline" className={`text-[10px] border leading-relaxed ${getValueTypeColor(selectedParameterInfo.valueType)}`}>
                      {selectedParameterInfo.valueType.toUpperCase()}
                      {selectedParameterInfo.isConnection && <Link className="w-2.5 h-2.5 ml-1 opacity-50" />}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Current Value</span>
                  <div className="p-3 bg-black/20 rounded-xl text-[11px] font-mono text-white/40 border border-white/5 break-all max-h-24 overflow-y-auto leading-relaxed">
                    {JSON.stringify(selectedParameterInfo.currentValue)}
                  </div>
                </div>

                {selectedParameterInfo.isConnection ? (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Link className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-500/80 uppercase tracking-wider">Node Connection</h4>
                      <p className="text-[11px] text-amber-500/50 mt-1 leading-relaxed"> This parameter is driven by another node and cannot be mapped directly to a UI component.</p>
                    </div>
                  </div>
                ) : existingMappingIndex >= 0 ? (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-500/80 uppercase tracking-wider">Already Mapped</h4>
                        <p className="text-[11px] text-emerald-400/30 mt-1 leading-relaxed">Configured and ready. </p>
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
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Quick Connect</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {PLAYGROUND_TARGETS.filter(t => {
                        const valType = selectedParameterInfo.valueType;
                        if (valType === 'string') {
                          // Allow mapping both text and image source to a string parameter
                          return t.supportedTypes.includes('string');
                        }
                        if (valType === 'number' && t.supportedTypes.includes('number')) return true;
                        return false;
                      }).map((target) => (
                        <Button
                          key={target.key}
                          variant="ghost"
                          size="sm"
                          className="justify-start bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 h-10 px-3 text-[11px] text-white/60 hover:text-white transition-all rounded-xl"
                          onClick={() => handleDirectMapping(selectedParameterInfo.nodeId, selectedParameterInfo.parameterKey, selectedParameterInfo.currentValue, target.key)}
                        >
                          <span className="mr-2 text-lg opacity-80">{target.icon}</span>
                          {target.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-white text-black hover:bg-white/90 font-bold text-[11px] uppercase tracking-widest h-12 rounded-xl mt-4"
                      onClick={() => setNewComponent({
                        label: selectedParameterInfo.parameterKey,
                        type: selectedParameterInfo.valueType === 'number' ? 'number' : 'text',
                        properties: { defaultValue: selectedParameterInfo.currentValue },
                        mapping: { workflowPath: [selectedParameterInfo.nodeId, "inputs", selectedParameterInfo.parameterKey], parameterKey: selectedParameterInfo.parameterKey, defaultValue: selectedParameterInfo.currentValue },
                        validation: {},
                        orderIndex: existingComponents.length
                      })}
                    >
                      Create Custom Mapping
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {newComponent && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-blue-500/5 border-blue-500/20 backdrop-blur-3xl">
                  <CardHeader className="pb-3 border-b border-blue-500/10">
                    <CardTitle className="text-[11px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <Plus className="w-3 h-3" />
                      New Mapping Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Component Label</Label>
                        <Input
                          className="bg-white/5 border-white/5 text-white h-10 rounded-lg focus:border-blue-500/50"
                          value={newComponent.label || ""}
                          onChange={(e) => setNewComponent(prev => prev ? { ...prev, label: e.target.value } : null)}
                          placeholder="Display name in UI..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Default Value</Label>
                        <Input
                          className="bg-white/5 border-white/5 text-white h-10 rounded-lg focus:border-blue-500/50"
                          value={newComponent.properties?.defaultValue || ""}
                          onChange={(e) => setNewComponent(prev => prev ? { ...prev, properties: { ...prev.properties!, defaultValue: e.target.value } } : null)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] uppercase tracking-widest h-10 rounded-lg" onClick={() => { onComponentCreate?.(newComponent as UIComponent); setNewComponent(null); }}>
                        Confirm
                      </Button>
                      <Button variant="ghost" className="px-3 text-white/40 hover:text-white hover:bg-white/5" onClick={() => setNewComponent(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {effectiveEditingIndex !== null && existingComponents[effectiveEditingIndex] && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-white/[0.02] border-white/10 backdrop-blur-3xl">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Edit Mapping</CardTitle>
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
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
              <Settings className="w-8 h-8 text-white/10" />
            </div>
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-3">Editor Ready</h3>
            <p className="text-xs text-white/20 leading-relaxed max-w-[240px]">
              Select a node and pick a parameter from the workflow analyzer to start mapping.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MappingEditor({ component, onSave, onCancel }: { component: UIComponent; onSave: (c: UIComponent) => void; onCancel: () => void; }) {
  const [edited, setEdited] = useState<UIComponent>(component);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Component Label</Label>
        <Input
          className="bg-white/5 border-white/5 text-white h-10 rounded-lg"
          value={edited.label}
          onChange={(e) => setEdited(prev => ({ ...prev, label: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1 bg-white text-black hover:bg-white/90 font-bold text-[10px] uppercase tracking-widest h-10 rounded-lg" onClick={() => onSave(edited)}>
          Save Changes
        </Button>
        <Button variant="ghost" className="px-3 text-white/40 hover:text-white" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
