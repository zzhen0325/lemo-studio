"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Save,
  Download,
  Settings,
  Layers,
  Plus,
  Play
} from "lucide-react";
import { toast } from "sonner";

import { MappingConfig, UIComponent } from "@/types/features/mapping-editor";
import { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import { localStorageManager } from "@/lib/local-storage-manager";
import { WorkflowAnalyzer } from "@/components/features/mapping-editor/workflow-analyzer";
import { ParameterMappingPanel } from "@/components/features/mapping-editor/parameter-mapping-panel";
import { NodeConfigurationDialog } from "@/components/features/mapping-editor/node-configuration-dialog";
import { MappingList } from "@/components/features/mapping-editor/mapping-list";
import WorkflowSelectorDialog from "@/components/features/playground-v2/Dialogs/WorkflowSelectorDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";

interface MappingEditorPageProps {
  onNavigate?: (tab: string) => void;
}

interface LocalEditorState {
  currentConfig: MappingConfig | null;
  selectedNode: string | null;
  selectedParameter: string | null;
  selectedComponent: string | null;
  editingComponentIndex: number | null;
  isDirty: boolean;
  isLoading: boolean;
}

export function MappingEditorPage({ onNavigate }: MappingEditorPageProps) {
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

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/view-comfy');
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

      const res = await fetch('/api/view-comfy', {
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
    // 初始化编辑器
    initializeEditor();
    // 加载工作流列表
    fetchWorkflows();
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



  const handleGoToGeneration = () => {
    if (!editorState.currentConfig) {
      toast.error("请先保存配置");
      return;
    }

    if (editorState.isDirty) {
      toast.error("请先保存当前配置");
      return;
    }

    // 跳转到生成界面
    if (onNavigate) {
      // TODO: 这里的参数需要根据实际 TabValue 调整，假设生成界面是 'custom-ui' 或其他
      // 目前先提示
      toast.info("跳转功能待集成");
    }
  };

  const handleExportConfig = async () => {
    if (!editorState.currentConfig) {
      toast.error("没有可导出的配置");
      return;
    }

    try {
      const blob = await localStorageManager.exportConfig(editorState.currentConfig.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${editorState.currentConfig.title}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("配置导出成功");
    } catch (error) {
      console.error("导出配置失败:", error);
      toast.error("导出配置失败");
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 h-full overflow-y-auto">
      {/* 页面标题和操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ViewComfy 参数映射编辑器</h1>
          <p className="text-muted-foreground mt-2">
            将 ComfyUI 工作流参数映射为用户友好的界面组件
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveConfig}
            disabled={!editorState.currentConfig || !editorState.isDirty}
          >
            <Save className="w-4 h-4 mr-2" />
            保存配置
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportConfig}
            disabled={!editorState.currentConfig}
          >
            <Download className="w-4 h-4 mr-2" />
            导出配置
          </Button>

          <Button
            onClick={handleGoToGeneration}
            disabled={!editorState.currentConfig || editorState.isDirty}
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            生成界面
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            设置
          </Button>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="w-full overflow-x-auto pb-2">
        <Tabs
          value={editorState.currentConfig?.title || "default"}
          onValueChange={(val) => {
            if (val === "default") {
              // Clear selection
              setEditorState(prev => ({ ...prev, currentConfig: null }));
            } else {
              const wf = workflows.find(w => w.viewComfyJSON.title === val);
              if (wf) handleSelectWorkflow(wf);
            }
          }}
          className="w-full"
        >
          <TabsList className="w-full justify-start h-auto flex-wrap gap-2 bg-transparent p-0">
            <TabsTrigger
              value="default"
              className="rounded-full bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent px-4 py-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建/上传
            </TabsTrigger>
            {workflows.map(wf => (
              <TabsTrigger
                key={wf.viewComfyJSON.id}
                value={wf.viewComfyJSON.title}
                className="rounded-full bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent px-4 py-2"
              >
                {wf.viewComfyJSON.title || "Untitled Workflow"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* 工作流上传区域 */}
      {!editorState.currentConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              上传 ComfyUI 工作流
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-title">配置标题</Label>
              <Input
                id="config-title"
                placeholder="输入配置标题..."
                value={configTitle}
                onChange={(e) => setConfigTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow-file">工作流文件 (JSON)</Label>
              <Input
                id="workflow-file"
                type="file"
                accept=".json"
                onChange={handleWorkflowUpload}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground uppercase">或者</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <Button variant="outline" className="w-full" onClick={() => setIsWorkflowSelectorOpen(true)}>
              <Layers className="w-4 h-4 mr-2" />
              从服务器加载现有工作流
            </Button>

            <div className="text-sm text-muted-foreground">
              <p>请上传从 ComfyUI 导出的工作流 JSON 文件。</p>
              <p>文件应包含完整的节点定义和参数信息。</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主编辑区域 */}
      {editorState.currentConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          <div className="lg:col-span-2 h-full flex flex-col overflow-hidden gap-4">
            <MappingList
              components={editorState.currentConfig.uiConfig.components}
              onEdit={(index: number) => {
                setEditorState(prev => ({
                  ...prev,
                  editingComponentIndex: index,
                  selectedParameter: null, // Clear selected parameter to focus on editing
                  selectedNode: null
                }));
              }}
              onDelete={handleComponentDelete}
            />
            <WorkflowAnalyzer
              workflowApiJSON={editorState.currentConfig.workflowApiJSON}
              onNodeSelect={handleNodeSelect}
              onParameterSelect={handleParameterSelect}
              selectedNode={editorState.selectedNode}
              selectedParameter={editorState.selectedParameter}
              existingComponents={editorState.currentConfig.uiConfig.components}
            />
          </div>

          <div className="lg:col-span-1 h-full overflow-y-auto">
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
            />
          </div>
        </div>
      )}

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
