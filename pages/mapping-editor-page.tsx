"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Save,
  Layers,
  Plus,
  Search,
  Workflow,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { MappingConfig, UIComponent } from "@/types/features/mapping-editor";
import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { localStorageManager } from "@/lib/local-storage-manager";
import { WorkflowAnalyzer } from "@/components/features/mapping-editor/workflow-analyzer";
import { ParameterMappingPanel } from "@/components/features/mapping-editor/parameter-mapping-panel";
import { NodeConfigurationDialog } from "@/components/features/mapping-editor/node-configuration-dialog";
import WorkflowSelectorDialog from "@/components/features/playground-v2/Dialogs/WorkflowSelectorDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import { getApiBase } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarContent } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";


interface LocalEditorState {
  currentConfig: MappingConfig | null;
  selectedNode: string | null;
  selectedParameter: string | null;
  selectedComponent: string | null;
  editingComponentIndex: number | null;
  isDirty: boolean;
  isLoading: boolean;
}

export function MappingEditorPage() {
  const [editorState, setEditorState] = useState<LocalEditorState>({
    currentConfig: null,
    selectedNode: null,
    selectedParameter: null,
    selectedComponent: null,
    editingComponentIndex: null,
    isDirty: false,
    isLoading: false
  });

  const [configTitle, setConfigTitle] = useState("");
  const [isWorkflowSelectorOpen, setIsWorkflowSelectorOpen] = useState(false);
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWorkflows = workflows.filter(wf =>
    wf.viewComfyJSON.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const initializeEditor = useCallback(async () => {
    try {
      setEditorState(prev => ({ ...prev, isLoading: true }));

      // 加载编辑器设置
      const settings = await localStorageManager.getEditorSettings();
      console.log("编辑器设置已加载:", settings);

      // Check for pending workflow from Playground
      const pendingWorkflowStr = localStorage.getItem("MAPPING_EDITOR_INITIAL_WORKFLOW");
      if (pendingWorkflowStr) {
        try {
          const workflow = JSON.parse(pendingWorkflowStr);
          // Assuming workflow has workflowApiJSON
          if (workflow.workflowApiJSON) {
            const newConfig: MappingConfig = {
              id: `config_${Date.now()}`,
              title: workflow.viewComfyJSON?.id || "Untitled Workflow",
              description: "Imported from Playground",
              workflowApiJSON: workflow.workflowApiJSON,
              uiConfig: {
                layout: { type: "grid", columns: 2, gap: 16 },
                theme: { primaryColor: "#3b82f6", backgroundColor: "#ffffff" },
                components: []
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setEditorState(prev => ({
              ...prev,
              currentConfig: newConfig,
              isDirty: true
            }));
            setConfigTitle(newConfig.title);
            toast.success("已加载选中的工作流");
            localStorage.removeItem("MAPPING_EDITOR_INITIAL_WORKFLOW");
          }
        } catch (e) {
          console.error("Failed to parse pending workflow", e);
        }
      }

      setEditorState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error("初始化编辑器失败:", error);
      toast.error("初始化编辑器失败");
      setEditorState(prev => ({ ...prev, isLoading: false }));
    }
  }, [setConfigTitle]);

  const handleSaveConfig = useCallback(async () => {
    if (!editorState.currentConfig) {
      toast.error("没有可保存的配置");
      return;
    }

    try {
      setEditorState(prev => ({ ...prev, isLoading: true }));

      // 1. Save to local storage (backup)
      await localStorageManager.saveConfig(editorState.currentConfig);

      // 2. Save to server
      const updatedWorkflows = workflows.map(wf => {
        if (wf.viewComfyJSON.title === editorState.currentConfig!.title) {
          return {
            ...wf,
            viewComfyJSON: {
              ...wf.viewComfyJSON,
              mappingConfig: {
                components: editorState.currentConfig!.uiConfig.components
              }
            }
          };
        }
        return wf;
      });

      // Check if it's a new workflow
      const exists = workflows.some(w => w.viewComfyJSON.title === editorState.currentConfig!.title);
      if (!exists) {
        // Create basic ViewComfy structure
        const newWorkflow: IViewComfy = {
          viewComfyJSON: {
            id: editorState.currentConfig.id,
            title: editorState.currentConfig.title,
            description: editorState.currentConfig.description || "",
            inputs: [], // Should ideally be parsed from API
            advancedInputs: [],
            previewImages: [],
            mappingConfig: {
              components: editorState.currentConfig.uiConfig.components
            }
          },
          workflowApiJSON: editorState.currentConfig.workflowApiJSON
        };
        updatedWorkflows.push(newWorkflow);
      }

      const payload = {
        appTitle: "ViewComfy",
        appImg: "",
        viewComfys: updatedWorkflows
      };

      const res = await fetch(`${getApiBase()}/view-comfy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to save to server");
      }

      setEditorState(prev => ({
        ...prev,
        isDirty: false,
        isLoading: false
      }));

      toast.success("配置已保存到服务器");

      // Refresh list
      fetchWorkflows();

    } catch (error) {
      console.error("保存配置失败:", error);
      toast.error("保存配置失败");
      setEditorState(prev => ({ ...prev, isLoading: false }));
    }
  }, [editorState.currentConfig, workflows, fetchWorkflows]);

  useEffect(() => {
    // 并行初始化编辑器和加载工作流列表
    Promise.all([initializeEditor(), fetchWorkflows()]);
  }, [initializeEditor, fetchWorkflows]);

  // Auto-save effect
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (editorState.isDirty && editorState.currentConfig) {
      timer = setTimeout(() => {
        handleSaveConfig();
      }, 30000); // 30 seconds auto-save
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [editorState.isDirty, editorState.currentConfig, handleSaveConfig]);





  const handleWorkflowUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setEditorState(prev => ({ ...prev, isLoading: true }));

      const text = await file.text();
      const workflowApiJSON: WorkflowApiJSON = JSON.parse(text);

      // 验证工作流格式
      if (!workflowApiJSON || typeof workflowApiJSON !== 'object') {
        throw new Error('无效的工作流文件格式');
      }


      // 创建新的映射配置
      const newConfig: MappingConfig = {
        id: `config_${Date.now()}`,
        title: configTitle || file.name.replace('.json', ''),
        description: `从 ${file.name} 导入的工作流配置`,
        workflowApiJSON,
        uiConfig: {
          layout: {
            type: "grid",
            columns: 2,
            gap: 16
          },
          theme: {
            primaryColor: "#3b82f6",
            backgroundColor: "#ffffff"
          },
          components: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setEditorState(prev => ({
        ...prev,
        currentConfig: newConfig,
        isDirty: true,
        isLoading: false
      }));

      toast.success("工作流文件上传成功");
    } catch (error) {
      console.error("上传工作流失败:", error);
      toast.error("上传工作流失败：" + (error as Error).message);
      setEditorState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleSelectWorkflow = (workflow: IViewComfy) => {
    try {
      if (!workflow.workflowApiJSON) {
        toast.error("该工作流没有包含 API 定义");
        return;
      }

      const existingComponents = (workflow.viewComfyJSON.mappingConfig?.components ?? []) as UIComponent[];

      const newConfig: MappingConfig = {
        id: workflow.viewComfyJSON.id || `config_${Date.now()}`,
        title: workflow.viewComfyJSON.title || "Untitled Workflow",
        description: workflow.viewComfyJSON.description || "",
        workflowApiJSON: workflow.workflowApiJSON as WorkflowApiJSON,
        uiConfig: {
          layout: { type: "grid", columns: 2, gap: 16 },
          theme: { primaryColor: "#3b82f6", backgroundColor: "#ffffff" },
          components: existingComponents
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setEditorState(prev => ({
        ...prev,
        currentConfig: newConfig,
        isDirty: false
      }));
      setConfigTitle(newConfig.title);
      toast.success(`已加载工作流: ${newConfig.title}`);
    } catch (error) {
      console.error("加载工作流失败:", error);
      toast.error("加载工作流失败");
    }
  };





  const handleNodeSelect = (nodeId: string) => {
    setEditorState(prev => ({
      ...prev,
      selectedNode: nodeId,
      selectedParameter: null
    }));
    // setIsNodeDialogOpen(true); // Removed dialog
  };

  const handleParameterSelect = (nodeId: string, parameterKey: string) => {
    setEditorState(prev => ({
      ...prev,
      selectedNode: nodeId,
      selectedParameter: parameterKey
    }));
  };

  const handleComponentCreate = (component: UIComponent) => {
    if (!editorState.currentConfig) return;

    const updatedComponents = [...editorState.currentConfig.uiConfig.components, component];

    const updatedConfig = {
      ...editorState.currentConfig,
      uiConfig: {
        ...editorState.currentConfig.uiConfig,
        components: updatedComponents
      },
      updatedAt: new Date().toISOString()
    };

    setEditorState(prev => ({
      ...prev,
      currentConfig: updatedConfig,
      isDirty: true
    }));

    toast.success("组件映射创建成功");
  };

  const handleComponentUpdate = (index: number, component: UIComponent) => {
    if (!editorState.currentConfig) return;

    const updatedComponents = [...editorState.currentConfig.uiConfig.components];
    updatedComponents[index] = component;

    const updatedConfig = {
      ...editorState.currentConfig,
      uiConfig: {
        ...editorState.currentConfig.uiConfig,
        components: updatedComponents
      },
      updatedAt: new Date().toISOString()
    };

    setEditorState(prev => ({
      ...prev,
      currentConfig: updatedConfig,
      isDirty: true
    }));

    toast.success("组件映射更新成功");
  };

  const handleComponentDelete = (index: number) => {
    if (!editorState.currentConfig) return;

    const updatedComponents = editorState.currentConfig.uiConfig.components.filter((_, i) => i !== index);

    const updatedConfig = {
      ...editorState.currentConfig,
      uiConfig: {
        ...editorState.currentConfig.uiConfig,
        components: updatedComponents
      },
      updatedAt: new Date().toISOString()
    };

    setEditorState(prev => ({
      ...prev,
      currentConfig: updatedConfig,
      isDirty: true
    }));

    toast.success("组件映射删除成功");
  };

  const handleNodeValueUpdate = (nodeId: string, paramKey: string, value: unknown) => {
    if (!editorState.currentConfig) return;

    const updatedWorkflow = {
      ...editorState.currentConfig.workflowApiJSON,
      [nodeId]: {
        ...editorState.currentConfig.workflowApiJSON[nodeId],
        inputs: {
          ...editorState.currentConfig.workflowApiJSON[nodeId].inputs,
          [paramKey]: value
        }
      }
    };

    const updatedConfig = {
      ...editorState.currentConfig,
      workflowApiJSON: updatedWorkflow,
      updatedAt: new Date().toISOString()
    };

    setEditorState(prev => ({
      ...prev,
      currentConfig: updatedConfig,
      isDirty: true
    }));
  };

  if (editorState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030303]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          />
          <p className="text-white/40 text-sm font-medium tracking-widest uppercase">加载中</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-black/10 text-white overflow-hidden selection:bg-primary/30">
      <TooltipProvider>
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 64 : 260 }}
          className={cn(
            "relative flex flex-col border-r border-white/5 bg-black/0 transition-all duration-300 ease-in-out z-30",
            sidebarCollapsed && "items-center"
          )}
        >
          <div className="p-4 flex items-center justify-between border-b border-white/5 h-16">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Workflow className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-bold tracking-tight text-sm uppercase text-white/60">Library</span>
              </motion.div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 text-white/20 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", sidebarCollapsed && "rotate-180")} />
            </Button>
          </div>

          <SidebarContent className="flex-1 flex flex-col gap-4 p-3 overflow-hidden">
            {!sidebarCollapsed && (
              <div className="px-1">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-primary/50 transition-colors" />
                  <Input
                    placeholder="搜索工作流..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white/[0.03] border-white/5 h-9 text-xs rounded-xl focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 -mx-3 px-3">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-10 px-3 rounded-xl transition-all duration-200",
                    !editorState.currentConfig ? "bg-primary/10 text-primary border border-primary/10" : "text-white/40 hover:bg-white/5 hover:text-white"
                  )}
                  onClick={() => setEditorState(prev => ({ ...prev, currentConfig: null }))}
                >
                  <Plus className={cn("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                  {!sidebarCollapsed && <span className="text-sm font-medium">新建配置</span>}
                </Button>

                <div className="my-4 px-3 flex items-center gap-2">
                  <Separator className="flex-1 bg-white/5" />
                  {!sidebarCollapsed && <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">最近的工作流</span>}
                  <Separator className="flex-1 bg-white/5" />
                </div>

                {filteredWorkflows.map((wf) => {
                  const isActive = editorState.currentConfig?.title === wf.viewComfyJSON.title;
                  return (
                    <Button
                      key={wf.viewComfyJSON.id}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start h-11 px-3 rounded-xl transition-all duration-200 group relative",
                        isActive ? "bg-white/5 text-white border border-white/10 shadow-lg" : "text-white/40 hover:bg-white/[0.03] hover:text-white"
                      )}
                      onClick={() => handleSelectWorkflow(wf)}
                    >
                      <Layers className={cn("w-4 h-4", !sidebarCollapsed && "mr-3", isActive ? "text-primary" : "text-white/20")} />
                      {!sidebarCollapsed && (
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="text-sm font-medium truncate w-full">{wf.viewComfyJSON.title || "未命名工作流"}</span>
                          {isActive && <motion.div layoutId="active-indicator" className="absolute left-0 w-1 h-5 bg-primary rounded-full" />}
                        </div>
                      )}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </SidebarContent>
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white/[0.01]">
          <main className="flex-1 flex flex-col relative overflow-hidden z-10">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-sm z-20">
              <div className="flex items-center gap-4">
                {editorState.currentConfig ? (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <h2 className="text-sm font-bold tracking-tight text-white/90 leading-none mb-1">
                        {editorState.currentConfig.title}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter">Workflow Module</span>
                        {editorState.isDirty && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest">Unsaved</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Module Ready</h2>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={!editorState.currentConfig || !editorState.isDirty}
                  className="h-9 px-5 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl gap-2 disabled:opacity-30 disabled:bg-white/5 disabled:border-white/5 disabled:text-zinc-600"
                >
                  <Save className="w-3.5 h-3.5" />
                  Sync Changes
                </Button>
              </div>
            </header>

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {!editorState.currentConfig ? (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="absolute inset-0 flex items-center justify-center p-12"
                >
                  <Card className="max-w-2xl w-full bg-white/[0.01] border-white/5 backdrop-blur-3xl shadow-2xl rounded-[2.5rem] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <CardHeader className="text-center pt-16 pb-8 relative">
                      <div className="w-24 h-24 rounded-[2rem] bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(59,130,246,0.1)] group-hover:shadow-[0_0_60px_rgba(59,130,246,0.2)] transition-all duration-700">
                        <Upload className="w-10 h-10 text-primary animate-pulse" />
                      </div>
                      <CardTitle className="text-3xl font-bold tracking-tight mb-3 text-white">Initialize Workflow</CardTitle>
                      <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
                        Deploy a ComfyUI API definition or select from your neural library to begin parameter synthesis.
                      </p>
                    </CardHeader>
                    <CardContent className="px-16 pb-16 space-y-8 relative">
                      <div className="grid gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] px-1">Deployment Name</Label>
                          <Input
                            placeholder="Enter a distinctive title..."
                            value={configTitle}
                            onChange={(e) => setConfigTitle(e.target.value)}
                            className="bg-white/[0.02] border-white/5 h-14 rounded-2xl focus:ring-1 focus:ring-primary/20 transition-all px-5 text-sm"
                          />
                        </div>
                        <div className="relative group/upload">
                          <Input
                            type="file"
                            accept=".json"
                            onChange={handleWorkflowUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="border-2 border-dashed border-white/5 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-white/[0.01] group-hover/upload:bg-primary/[0.03] group-hover/upload:border-primary/30 transition-all duration-500">
                            <Plus className="w-8 h-8 text-zinc-700 group-hover/upload:text-primary group-hover/upload:scale-110 transition-all duration-500" />
                            <div className="text-center">
                                <span className="text-xs font-bold text-zinc-500 group-hover/upload:text-zinc-300 block mb-1">Upload JSON Definition</span>
                                <span className="text-[10px] text-zinc-700">API format exported from ComfyUI</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 py-2">
                        <Separator className="flex-1 bg-white/5" />
                        <span className="text-[10px] font-bold text-zinc-800 uppercase tracking-[0.3em]">OR</span>
                        <Separator className="flex-1 bg-white/5" />
                      </div>

                      <Button
                        variant="ghost"
                        className="w-full h-16 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] transition-all gap-3 shadow-inner"
                        onClick={() => setIsWorkflowSelectorOpen(true)}
                      >
                        <Layers className="w-4 h-4 text-primary" />
                        Load from Neural Library
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="editor-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full"
                >
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="h-full"
                  >
                    <ResizablePanel defaultSize={65} minSize={40}>
                      <div className="h-full flex flex-col p-6 gap-6">
                        <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.01] border border-white/5 rounded-3xl p-6 backdrop-blur-md">
                           <WorkflowAnalyzer
                            workflowApiJSON={editorState.currentConfig.workflowApiJSON}
                            onNodeSelect={handleNodeSelect}
                            onParameterSelect={handleParameterSelect}
                            selectedNode={editorState.selectedNode}
                            selectedParameter={editorState.selectedParameter}
                            existingComponents={editorState.currentConfig.uiConfig.components}
                          />
                        </div>
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={35} minSize={25}>
                      <div className="h-full p-6 pl-0">
                        <div className="h-full bg-white/[0.01] border border-white/5 rounded-3xl p-6 backdrop-blur-md overflow-y-auto">
                          <ParameterMappingPanel
                            workflowApiJSON={editorState.currentConfig.workflowApiJSON}
                            selectedNode={editorState.selectedNode}
                            selectedParameter={editorState.selectedParameter}
                            existingComponents={editorState.currentConfig.uiConfig.components}
                            onComponentCreate={handleComponentCreate}
                            onComponentUpdate={handleComponentUpdate}
                            onComponentDelete={handleComponentDelete}
                            onParameterSelect={handleParameterSelect}
                            editingComponentIndex={editorState.editingComponentIndex}
                            onCancelEdit={() => setEditorState(prev => ({ ...prev, editingComponentIndex: null }))}
                            onEdit={(index: number) => {
                              setEditorState(prev => ({
                                ...prev,
                                editingComponentIndex: index,
                                selectedParameter: null,
                                selectedNode: null
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </TooltipProvider>

      <WorkflowSelectorDialog
        open={isWorkflowSelectorOpen}
        onOpenChange={setIsWorkflowSelectorOpen}
        onSelect={handleSelectWorkflow}
      />

      <NodeConfigurationDialog
        open={isNodeDialogOpen}
        onOpenChange={setIsNodeDialogOpen}
        nodeId={editorState.selectedNode}
        workflowApiJSON={editorState.currentConfig?.workflowApiJSON || null}
        mappingConfig={editorState.currentConfig}
        onUpdateValue={handleNodeValueUpdate}
        onParameterSelect={handleParameterSelect}
      />
    </div>
  );
}

export default MappingEditorPage;
