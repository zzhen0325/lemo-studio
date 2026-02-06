import { WorkflowApiJSON, IInputField } from "@/lib/workflow-api-parser";

// 组件类型枚举
export type ComponentType =
  | "text"
  | "textarea"
  | "number"
  | "slider"
  | "select"
  | "checkbox"
  | "radio"
  | "image"
  | "file"
  | "color"
  | "date"
  | "time"
  | "reference_image"
  | "switch"; // 添加switch类型

// 验证规则接口
export interface ValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: string; // 自定义验证函数
}

// 组件属性接口
export interface ComponentProperties {
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  min?: number;
  max?: number;
  step?: number;
  multiple?: boolean;
  accept?: string; // 文件类型限制
  rows?: number; // textarea行数
  cols?: number; // textarea列数
  disabled?: boolean;
  readonly?: boolean;
  paramName?: string; // 参数名称
  mappingPath?: string; // 映射路径
  valueTransform?: string; // 值转换函数
}

// 参数映射接口
export interface ParameterMapping {
  workflowPath: string[]; // 工作流中的路径，如 ["3", "inputs", "seed"]
  parameterKey: string; // 参数键名
  transformFunction?: string; // 转换函数代码
  defaultValue?: any; // 默认值
}

// UI组件接口
export interface UIComponent {
  id: string;
  type: ComponentType;
  label: string;
  properties: ComponentProperties;
  validation: ValidationRules;
  mapping: ParameterMapping;
  orderIndex: number;
  groupId?: string; // 组件分组ID
}

// 布局配置接口
export interface LayoutConfig {
  type: "grid" | "flex" | "tabs";
  columns?: number;
  gap?: number;
  responsive?: boolean;
}

// 主题配置接口
export interface ThemeConfig {
  primaryColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  spacing?: number;
}

// UI配置接口
export interface UIConfig {
  components: UIComponent[];
  layout: LayoutConfig;
  theme: ThemeConfig;
  groups?: ComponentGroup[];
  viewComfyEndpoint?: string; // ViewComfy端点URL
  workflowTemplate?: any; // 工作流模板数据
}

// 组件分组接口
export interface ComponentGroup {
  id: string;
  title: string;
  description?: string;
  collapsed?: boolean;
  orderIndex: number;
}

// 映射配置接口
export interface MappingConfig {
  id: string;
  title: string;
  description?: string;
  workflowApiJSON: WorkflowApiJSON;
  uiConfig: UIConfig;
  createdAt: string;
  updatedAt: string;
  version?: string;
  tags?: string[];
}

// 工作流节点接口
export interface WorkflowNode {
  id: string;
  classType: string;
  title: string;
  inputs: WorkflowNodeInput[];
  meta?: {
    title?: string;
    description?: string;
  };
}

// 工作流节点输入接口
export interface WorkflowNodeInput {
  key: string;
  value: any;
  type: string;
  path: string[];
  isConnected?: boolean; // 是否已连接到其他节点
  isMappable?: boolean; // 是否可映射
}

// 映射连接接口
export interface MappingConnection {
  id: string;
  sourceNodeId: string;
  sourceInputKey: string;
  targetComponentId: string;
  transformFunction?: string;
}

// 编辑器状态接口
export interface EditorState {
  currentConfig?: MappingConfig;
  selectedNode?: WorkflowNode;
  selectedComponent?: UIComponent;
  selectedConnection?: MappingConnection;
  isPreviewMode: boolean;
  isDirty: boolean; // 是否有未保存的更改
}

// 预览数据接口
export interface PreviewData {
  [componentId: string]: any;
}

// 导出配置接口
export interface ExportConfig {
  includeWorkflow: boolean;
  includePreview: boolean;
  format: "json" | "yaml";
  minify: boolean;
}

// 导入结果接口
export interface ImportResult {
  success: boolean;
  config?: MappingConfig;
  errors?: string[];
  warnings?: string[];
}

// 本地存储键名常量
export const STORAGE_KEYS = {
  MAPPING_CONFIGS: "mapping_configs",
  CURRENT_CONFIG: "current_mapping_config",
  EDITOR_SETTINGS: "editor_settings",
  RECENT_CONFIGS: "recent_mapping_configs",
} as const;

// 编辑器设置接口
export interface EditorSettings {
  autoSave: boolean;
  autoSaveInterval: number; // 秒
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  theme: "light" | "dark" | "system";
  language: "zh" | "en";
}

// 错误类型接口
export interface EditorError {
  id: string;
  type: "validation" | "mapping" | "storage" | "network";
  message: string;
  details?: any;
  timestamp: string;
}

// 操作历史接口
export interface EditorAction {
  id: string;
  type: "add" | "update" | "delete" | "move";
  target: "component" | "connection" | "config";
  data: any;
  timestamp: string;
}

// 撤销重做状态接口
export interface UndoRedoState {
  history: EditorAction[];
  currentIndex: number;
  maxHistorySize: number;
}