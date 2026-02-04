"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layers,
  Plus,
  Search,
  Workflow,
  ChevronRight,
  ImagePlus
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
import GradualBlur from "@/components/visual-effects/GradualBlur";
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
  const [existingComponents, setExistingComponents] = useState<UIComponent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);

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
    console.log("State updated: selectedWorkflow set");
  };

  const handleBackToLibrary = () => {
    setSelectedWorkflow(null);
    // 移除 fetchWorkflows() 调用
    // 理由：handleSaveMapping 已经同步更新了本地 workflows 状态
    // 如果这里立即重新 fetch，可能会因为后端文件写入延迟导致拉取到不完整甚至空的数据（竞态条件）
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWorkflow) return;

    if (!file.type.startsWith('image/')) {
      toast.error("请选择图片文件");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${getApiBase()}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedPath = data.path;

        // 更新当前选中的工作流封面状态
        const updatedWorkflow = {
          ...selectedWorkflow,
          viewComfyJSON: {
            ...selectedWorkflow.viewComfyJSON,
            previewImages: [uploadedPath] // 统一替换为单张封面
          }
        };
        setSelectedWorkflow(updatedWorkflow);
        toast.success("图片已上传，请记得点击 Save 保存配置");
      } else {
        toast.error("上传图片失败");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("上传图片过程中出错");
    } finally {
      setIsUploading(false);
      // 重置 input 以便下次选择同一张图也能触发 onChange
      if (uploadFileRef.current) uploadFileRef.current.value = "";
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedWorkflow?.viewComfyJSON?.id) {
      toast.error("保存失败：未选择有效的工作流");
      return;
    }

    setIsSaving(true);
    try {
      const updatedViewComfyJSON = {
        ...selectedWorkflow.viewComfyJSON,
        mappingConfig: {
          ...selectedWorkflow.viewComfyJSON.mappingConfig,
          components: existingComponents
        }
      };

      const payload = {
        ...selectedWorkflow,
        viewComfyJSON: updatedViewComfyJSON
      };

      const res = await fetch(`${getApiBase()}/view-comfy/${selectedWorkflow.viewComfyJSON.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("配置已保存");
        // 更新当前选中状态
        setSelectedWorkflow(payload);
        // 同步更新外部列表状态，避免返回后看到的是旧数据或触发重新拉取时的竞态问题
        setWorkflows(prev => prev.map(wf =>
          wf.viewComfyJSON.id === selectedWorkflow.viewComfyJSON.id ? payload : wf
        ));
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(`保存失败: ${errorData.message || "服务器错误"}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to save mapping:", err);
      toast.error(`保存配置失败: ${err.message || "未知错误"}`);
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
    <div className="flex-1  h-full text-white overflow-hidden selection:bg-primary/30 p-8 pb-0">
      <TooltipProvider>
        {selectedWorkflow ? (
          /* Workflow Detail View */
          <div className="flex-1  mx-auto flex flex-col gap-6 h-full overflow-hidden">
            {/* Detail Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToLibrary}
                  className="rounded-xl bg-[#2C2D2F] border border-[#2C2D2F] hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter uppercase">
                    {selectedWorkflow.viewComfyJSON.title}
                  </h1>
                  <p className="text-zinc-500 text-xs font-medium tracking-wide">ID: {selectedWorkflow.viewComfyJSON.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={uploadFileRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleUploadCover}
                />
                <Button
                  variant="outline"
                  onClick={() => uploadFileRef.current?.click()}
                  disabled={isUploading || isSaving}
                  className="bg-[#2C2D2F] border-[#2C2D2F] hover:bg-white/10 rounded-xl px-6 font-bold uppercase tracking-widest text-xs h-10 gap-2 text-white/60 hover:text-white"
                >
                  <ImagePlus className="w-4 h-4" />
                  {isUploading ? "Uploading..." : "Upload Cover"}
                </Button>
                <Button
                  onClick={handleSaveMapping}
                  disabled={isSaving || isUploading}
                  className="bg-primary hover:bg-primary/90 rounded-xl px-6 font-bold uppercase tracking-widest text-xs h-10 gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 w-full pr-4 pb-0">
              <div className="flex flex-col gap-8 pb-10">
                {existingComponents.length > 0 && (
                  <div className="space-y-4">

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

                  <div className="min-h-[400px]">
                    <WorkflowAnalyzer
                      workflowApiJSON={selectedWorkflow.workflowApiJSON as WorkflowApiJSON}
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
          <div className="flex-1 mx-auto flex flex-col gap-10 h-full">
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
                    className="w-full h-12 border border-white/5 rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-[#2C2D2F] transition-all duration-300"
                  />
                </div>
              </div>
            </div>

            {/* Scrolling Grid Area */}
            <ScrollArea className="flex-1 w-full">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8 gap-4 pb-32">
                {/* Add New Configuration Tile */}
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="group relative aspect-[4/5] rounded-3xl border-2 border-dashed border-white/10   bg-[#2c2d2f68] hover:bg-[#31313382] transition-all duration-200 flex flex-col items-center justify-center gap-5 overflow-hidden active:scale-95"
                >
                  <div className="w-16 h-16 rounded-full bg-[#2c2d2f57] flex items-center justify-center  group-hover:scale-105 transition-all duration-200  ">
                    <Plus className="w-8 h-8 text-white " />
                  </div>
                  <div className="text-center px-6">
                    <span className="text-sm  text-white/50 group-hover:text-white block mb-1.5 transition-colors">ADD WORKFLOW</span>

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
                        "group relative aspect-[4/5] rounded-3xl   bg-[#2C2D2F] hover:bg-[#313133] transition-all duration-200 flex flex-col items-center justify-center gap-5 overflow-hidden active:scale-95"
                      )}
                    >
                      {/* Cover Image with Ken Burns effect */}
                      {cover ? (
                        <>
                          <Image
                            src={cover}
                            alt={wf.viewComfyJSON.title}
                            fill
                            className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-115 grayscale-[0.2] group-hover:grayscale-0"
                            unoptimized
                          />
                          <GradualBlur
                            position="bottom"
                            strength={3}
                            height="30%"
                            borderRadius="1.5rem"
                            zIndex={1}
                            className="opacity-90 transition-opacity duration-300 group-hover:opacity-100"
                          />
                        </>
                      ) : (
                        <div className="absolute inset-0  bg-[#2C2D2F] hover:bg-[#313133] flex items-center justify-center">
                          <Workflow className="w-12 h-12 text-white/5" />
                        </div>
                      )}

                      {/* Sophisticated Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end p-8 z-10">
                        <div className="flex flex-col gap-2.5 translate-y-3 group-hover:translate-y-0 transition-transform duration-200">
                          <span className="text-sm font-bold  text-white leading-tight truncate ">
                            {wf.viewComfyJSON.title || "未命名"}
                          </span>

                          {/* <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-white/50 font-black uppercase tracking-widest px-2 h-5 rounded-full">
                              {wf.viewComfyJSON.mappingConfig?.components?.length || 0} Nodes
                            </Badge>
                          </div> */}
                        </div>
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
