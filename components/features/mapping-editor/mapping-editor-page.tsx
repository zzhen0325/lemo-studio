"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Plus,
  Search,
  Workflow,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

import WorkflowSelectorDialog from "@/components/features/playground-v2/Dialogs/WorkflowSelectorDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import { getApiBase } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CreateWorkflowDialog } from "./create-workflow-dialog";
import Image from "next/image";
import type { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { WorkflowAnalyzer } from "./workflow-analyzer";
import { MappingList } from "./mapping-list";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UIComponent } from "@/types/features/mapping-editor";



export function MappingEditorPage() {
  const [isWorkflowSelectorOpen, setIsWorkflowSelectorOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredWorkflows = workflows.filter(wf =>
    wf.viewComfyJSON.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [selectedWorkflow, setSelectedWorkflow] = useState<IViewComfy | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);
  const [existingComponents, setExistingComponents] = useState<UIComponent[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/view-comfy`);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.viewComfys || []);
      }
    } catch (error) {
      console.error("Failed to fetch workflows", error);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);





  const handleSelectWorkflow = (workflow: IViewComfy) => {
    console.log("handleSelectWorkflow triggered for:", workflow.viewComfyJSON.id);
    setSelectedWorkflow(workflow);
    setExistingComponents((workflow.viewComfyJSON.mappingConfig?.components as UIComponent[]) || []);
    setSelectedNode(null);
    setSelectedParameter(null);
    console.log("State updated: selectedWorkflow set");
  };

  const handleBackToLibrary = () => {
    setSelectedWorkflow(null);
    fetchWorkflows();
  };

  const handleSaveMapping = async () => {
    if (!selectedWorkflow) return;

    setIsSaving(true);
    try {
      const updatedWorkflow = {
        ...selectedWorkflow,
        viewComfyJSON: {
          ...selectedWorkflow.viewComfyJSON,
          mappingConfig: {
            ...selectedWorkflow.viewComfyJSON.mappingConfig,
            components: existingComponents
          }
        }
      };

      const res = await fetch(`${getApiBase()}/view-comfy/${selectedWorkflow.viewComfyJSON.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedWorkflow),
      });

      if (res.ok) {
        toast.success("配置已保存");
        setSelectedWorkflow(updatedWorkflow);
      } else {
        throw new Error("保存失败");
      }
    } catch (error) {
      console.error("Failed to save mapping", error);
      toast.error("保存配置失败");
    } finally {
      setIsSaving(false);
    }
  };





  const handleCreateWorkflow = (data: { title: string; coverImg: string; workflowApiJSON: WorkflowApiJSON | null }) => {
    if (!data.workflowApiJSON) {
      toast.error("创建失败：缺失 API 定义");
      return;
    }

    const newWorkflow: IViewComfy = {
      viewComfyJSON: {
        id: `config_${Date.now()}`,
        title: data.title,
        description: "",
        inputs: [],
        advancedInputs: [],
        previewImages: data.coverImg ? [data.coverImg] : [],
        mappingConfig: {
          components: []
        }
      },
      workflowApiJSON: data.workflowApiJSON
    };

    setWorkflows(prev => [newWorkflow, ...prev]);
    toast.success(`已创建并加载配置: ${data.title}`);
  };

  return (
    <div className="flex h-full w-full text-white overflow-hidden selection:bg-primary/30 p-8 md:p-12">
      <TooltipProvider>
        {selectedWorkflow ? (
          /* Workflow Detail View */
          <div className="flex-1 max-w-[1400px] mx-auto flex flex-col gap-6 h-full overflow-hidden">
            {/* Detail Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToLibrary}
                  className="rounded-xl bg-white/5 border border-white/5 hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter uppercase italic">
                    {selectedWorkflow.viewComfyJSON.title}
                  </h1>
                  <p className="text-zinc-500 text-xs font-medium tracking-wide">ID: {selectedWorkflow.viewComfyJSON.id}</p>
                </div>
              </div>
              <Button
                onClick={handleSaveMapping}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 rounded-xl px-6 font-bold uppercase tracking-widest text-xs h-10 gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>

            <ScrollArea className="flex-1 -mx-4 px-4 pb-10">
              <div className="flex flex-col gap-8 pb-10">
                {existingComponents.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">Mapped Parameters</span>
                    </div>
                    <MappingList
                      components={existingComponents}
                      onEdit={(index) => {
                        // 目前先保持简单，后续根据需要添加编辑弹窗
                        console.log("Edit component at index", index);
                      }}
                      onDelete={(index) => {
                        setExistingComponents(prev => prev.filter((_, i) => i !== index));
                      }}
                    />
                  </div>
                )}


                {/* Bottom Panel: Workflow Analyzer */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2 text-white/90">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Workflow Analyzer</span>
                  </div>
                  <div className="min-h-[400px]">
                    <WorkflowAnalyzer
                      workflowApiJSON={selectedWorkflow.workflowApiJSON as WorkflowApiJSON}
                      selectedNode={selectedNode}
                      selectedParameter={selectedParameter}
                      onNodeSelect={setSelectedNode}
                      onParameterSelect={(nodeId, paramKey) => {
                        setSelectedNode(nodeId);
                        setSelectedParameter(paramKey);
                      }}
                      existingComponents={existingComponents}
                      onComponentCreate={(newComp) => setExistingComponents(prev => [...prev, newComp])}
                      onComponentDelete={(index) => {
                        setExistingComponents(prev => prev.filter((_, i) => i !== index));
                      }}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* Library Grid View */
          <div className="flex-1 max-w-[1400px] mx-auto flex flex-col gap-10 h-full">
            {/* List Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                    Mapping <span className="text-primary not-italic">Library</span> IS UPDATED 12345
                  </h1>
                </div>
                <p className="text-zinc-500 text-sm font-medium tracking-wide">管理、映射并部署您的高级 ComfyUI 生产流</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="relative w-80 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors duration-300" />
                  <input
                    type="text"
                    placeholder="搜索库中的工作流..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 border border-white/5 rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-zinc-900/40 backdrop-blur-xl transition-all duration-300"
                  />
                </div>
              </div>
            </div>

            {/* Scrolling Grid Area */}
            <ScrollArea className="flex-1 -mx-4 px-4 mask-fade-bottom">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 pb-32">
                {/* Add New Configuration Tile */}
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="group relative aspect-[4/5] rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/[0.01] hover:bg-primary/[0.02] hover:border-primary/20 transition-all duration-700 flex flex-col items-center justify-center gap-5 overflow-hidden active:scale-95"
                >
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-500 shadow-2xl border border-white/5">
                    <Plus className="w-8 h-8 text-zinc-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-center px-6">
                    <span className="text-sm font-bold text-zinc-400 group-hover:text-zinc-100 block mb-1.5 transition-colors">新建配置</span>
                    <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                      部署新的 API 指令集<br />或从 Neuro 库加载
                    </p>
                  </div>

                  {/* Visual Accent */}
                  <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                </button>

                {filteredWorkflows.map((wf) => {
                  const cover = wf.viewComfyJSON.previewImages?.[0];

                  return (
                    <button
                      key={wf.viewComfyJSON.id}
                      onClick={() => handleSelectWorkflow(wf)}
                      className={cn(
                        "group relative aspect-[4/5] rounded-[2.5rem] border border-white/5 transition-all duration-700 overflow-hidden bg-zinc-900/50 backdrop-blur-sm shadow-xl hover:border-white/10 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-3 active:scale-[0.98]"
                      )}
                    >
                      {/* Cover Image with Ken Burns effect */}
                      {cover ? (
                        <Image
                          src={cover}
                          alt={wf.viewComfyJSON.title}
                          fill
                          className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-115 grayscale-[0.2] group-hover:grayscale-0"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#0a0a0a] flex items-center justify-center">
                          <Workflow className="w-12 h-12 text-white/5" />
                        </div>
                      )}

                      {/* Sophisticated Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end p-8 transition-all duration-700 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-90 group-hover:opacity-100 pointer-events-none">
                        <div className="flex flex-col gap-2.5 translate-y-3 group-hover:translate-y-0 transition-transform duration-700">
                          <span className="text-base font-bold text-white leading-tight truncate tracking-tight">
                            {wf.viewComfyJSON.title || "未命名"}
                          </span>

                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-white/50 font-black uppercase tracking-widest px-2 h-5 rounded-full">
                              {wf.viewComfyJSON.mappingConfig?.components?.length || 0} Nodes
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Corner Interaction Hint */}
                      <div className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center -translate-y-4 group-hover:translate-y-0 pointer-events-none">
                        <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <CreateWorkflowDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateWorkflow}
        />

      </TooltipProvider>

      <WorkflowSelectorDialog
        open={isWorkflowSelectorOpen}
        onOpenChange={setIsWorkflowSelectorOpen}
        onSelect={handleSelectWorkflow}
      />
    </div>
  );
}

export default MappingEditorPage;
