"use client";

import { } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link, Check, Plus, Edit3 } from "lucide-react";
import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { MappingConfig } from "@/types/features/mapping-editor";

interface NodeConfigurationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nodeId: string | null;
    workflowApiJSON: WorkflowApiJSON | null;
    mappingConfig: MappingConfig | null;
    onUpdateValue: (nodeId: string, paramKey: string, value: unknown) => void;
    onParameterSelect?: (nodeId: string, paramKey: string) => void;
}

export function NodeConfigurationDialog({
    open,
    onOpenChange,
    nodeId,
    workflowApiJSON,
    mappingConfig,
    onUpdateValue,
    onParameterSelect
}: NodeConfigurationDialogProps) {
    if (!nodeId || !workflowApiJSON || !workflowApiJSON[nodeId]) {
        return null;
    }

    const node = workflowApiJSON[nodeId];
    const inputs = node.inputs || {};

    // Helper to check if a parameter is mapped
    const getMappingInfo = (paramKey: string) => {
        if (!mappingConfig?.uiConfig?.components) return null;

        return mappingConfig.uiConfig.components.find(comp =>
            comp.mapping.workflowPath[0] === nodeId &&
            comp.mapping.parameterKey === paramKey
        );
    };

    const getDisplayValue = (value: unknown) => {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>{node._meta?.title || node.class_type}</span>
                        <Badge variant="outline" className="font-mono text-xs font-normal">ID: {nodeId}</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        {node.class_type}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 px-1">
                    <div className="space-y-6">
                        {/* Configurable Parameters Section */}
                        <div>
                            <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                                Configurable Parameters
                                <Badge variant="secondary" className="text-[10px] h-5">{Object.values(inputs).filter(v => !Array.isArray(v)).length}</Badge>
                            </div>
                            <div className="space-y-4">
                                {Object.entries(inputs)
                                    .filter(([, value]) => !Array.isArray(value))
                                    .map(([key, value]) => {
                                        const mapping = getMappingInfo(key);
                                        // Cast to string | number for rendering in Input component
                                        const displayValue = value as string | number;
                                        return (
                                            <div key={key} className="space-y-2 p-3 rounded-md bg-muted/10 border hover:border-primary/50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-medium">
                                                        {key}
                                                    </Label>
                                                    {mapping ? (
                                                        <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 hover:bg-green-200">
                                                            <Check className="w-3 h-3 mr-1" />
                                                            Mapped
                                                        </Badge>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[10px] px-2"
                                                            onClick={() => onParameterSelect?.(nodeId, key)}
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" />
                                                            Add Mapping
                                                        </Button>
                                                    )}
                                                </div>

                                                {mapping && (
                                                    <div className="flex items-center justify-between bg-muted/50 p-2 rounded text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] bg-background">{mapping.type}</Badge>
                                                            <span className="font-medium">{mapping.label}</span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-5 w-5 p-0 hover:text-destructive"
                                                            onClick={() => onParameterSelect?.(nodeId, key)}
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                )}

                                                <Input
                                                    value={getDisplayValue(displayValue)}
                                                    className="bg-background"
                                                    onChange={(e) => {
                                                        let newValue: unknown = e.target.value;
                                                        if (typeof value === 'number' && !isNaN(Number(newValue)) && newValue !== '') {
                                                            newValue = Number(newValue);
                                                        }
                                                        onUpdateValue(nodeId, key, newValue);
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                {Object.values(inputs).filter(v => !Array.isArray(v)).length === 0 && (
                                    <div className="text-center py-4 text-muted-foreground text-sm italic bg-muted/30 rounded-md">
                                        No configurable parameters found.
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Connected Parameters Section */}
                        {Object.values(inputs).some(v => Array.isArray(v)) && (
                            <div>
                                <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                                    <Link className="w-3 h-3" />
                                    Connected Inputs
                                </div>
                                <div className="space-y-2">
                                    {Object.entries(inputs)
                                        .filter(([, value]) => Array.isArray(value))
                                        .map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                                                <span className="font-mono text-muted-foreground">{key}</span>
                                                <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground bg-background font-normal">
                                                    Connected to Node {(value as (string | number)[])[0]}
                                                </Badge>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
