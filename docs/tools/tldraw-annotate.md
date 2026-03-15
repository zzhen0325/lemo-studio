# lemo AI studio tldraw 标注生图工具开发文档
## 1. 需求概述
在基于 React 开发的 lemo AI studio 中，为集成的 tldraw 无限画布模块定制标注生图工具：
- 在图片上方工具栏新增标注工具，支持在图片上框选区域（默认命名“标注1/2/…”，不可自定义），删除标注后剩余标注自动重新编号；
- 图片下方浮动工具栏平铺所有标注的输入框，支持编辑标注说明，标注跟随图片平移/缩放；
- 左侧列表展示所有标注信息，点击生成后，将标注信息与预设 prompt 合并为 finalprompt，原图+标注合成参考图；
- 调用项目内已开发的生图 API，在原图右侧横向展示结果图，生成过程显示扫光 loading，原图与结果图间用实线箭头连接。

## 2. 技术栈
- 核心框架：React（推荐 TypeScript）
- 画布依赖：tldraw（npm 集成）
- 辅助工具：axios（API 调用）、CSS3（样式/动画）、SVG（箭头绘制）

## 3. 核心功能与业务逻辑
### 3.1 标注工具核心逻辑
| 模块          | 详细逻辑                                                                 |
|---------------|--------------------------------------------------------------------------|
| 标注工具激活  | 点击图片上方 toolbar 「标注工具」按钮，按钮高亮，鼠标变为十字光标，仅允许在图片区域框选；再次点击退出标注模式 |
| 区域框选      | 鼠标按下记为选框左上角起点，拖动实时绘制选框，松开完成框选；选框默认命名（标注1→标注2→…），不可自定义 |
| 标注编辑      | 选中选框后可拖拽调整大小/位置，按 Delete 键删除；删除后剩余标注自动重新编号（如删除标注2，标注3→标注2） |
| 浮动输入框    | 图片下方浮动 toolbar 平铺所有标注的输入框，输入框关联对应标注，失焦/回车自动保存标注说明 |
| 标注跟随      | 图片平移/缩放时，标注选框、名称同步平移/缩放（基于画布缩放比例换算坐标）；图片不支持旋转 |
| 左侧标注列表  | 列表项展示“标注名称+标注说明”，点击列表项定位到对应选框（高亮闪烁）；删除列表项同步删除选框和标注数据 |
| 标注数据存储  | 数组格式存储，单条数据：`{ id: string, name: string, content: string, x1: number, y1: number, x2: number, y2: number }` |

### 3.2 生图流程核心逻辑
| 模块          | 详细逻辑                                                                 |
|---------------|--------------------------------------------------------------------------|
| 生成前置校验  | 点击生成前检查所有标注是否填写说明，未填写则弹窗提示补全                  |
| finalprompt 合成 | 按项目预设格式，将标注信息与基础 prompt 合并为 finalprompt（格式由项目内定义） |
| 参考图生成    | 导出 tldraw 画布（包含原图+标注），选框样式：#ff0000 2px 实线，标注文字9px白色+black/40背景 |
| API 调用      | 调用项目内已开发的生图 API，传入参考图、finalprompt 等参数；异步调用避免页面卡顿 |
| 加载状态      | 生成过程中显示扫光 loading，禁用生成按钮；API 返回结果后关闭 loading      |
| 结果展示      | 原图居左，结果图在右侧横向排列；原图与结果组间绘制实线箭头，箭头自适应位置 |

## 4. 详细技术实现
### 4.1 项目依赖安装
```bash
# 安装tldraw核心依赖
npm install @tldraw/tldraw
# 安装axios（API调用）
npm install axios
```

### 4.2 自定义标注形状扩展（核心）
```tsx
import React, { useRef, useEffect, useState } from 'react';
import { Tldraw, TLCanvas, createShapeUtil, TLCustomShape } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';

// 1. 定义标注形状类型
interface AnnotationShape extends TLCustomShape {
  type: 'annotation';
  props: {
    name: string; // 标注名称（如标注1）
    content: string; // 标注说明
    x1: number; y1: number; // 选框左上角坐标
    x2: number; y2: number; // 选框右下角坐标
  };
}

// 2. 创建标注形状工具（适配tldraw规范）
const AnnotationUtil = createShapeUtil<AnnotationShape>({
  type: 'annotation',
  // 初始化形状
  getInitialShape: (props) => ({
    id: `anno-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'annotation',
    x: 0,
    y: 0,
    rotation: 0,
    isLocked: false,
    isHidden: false,
    props: {
      name: '',
      content: '',
      x1: 0, y1: 0, x2: 0, y2: 0,
    },
  }),
  // 鼠标按下：记录选框起点
  onPointerDown: (info) => {
    const { point } = info;
    const shape = info.shape as AnnotationShape;
    shape.props.x1 = point.x;
    shape.props.y1 = point.y;
    shape.props.x2 = point.x;
    shape.props.y2 = point.y;
    return shape;
  },
  // 鼠标拖动：实时更新选框终点
  onPointerMove: (info) => {
    const { point } = info;
    const shape = info.shape as AnnotationShape;
    shape.props.x2 = point.x;
    shape.props.y2 = point.y;
    return shape;
  },
  // 鼠标松开：完成选框，自动命名
  onPointerUp: (info) => {
    const shape = info.shape as AnnotationShape;
    // 获取当前所有标注，自动编号
    const annotations = info.store.getAllShapes().filter(s => s.type === 'annotation') as AnnotationShape[];
    shape.props.name = `标注${annotations.length}`;
    return shape;
  },
  // 渲染标注（满足样式要求：选框#ff0000 2px，文字9px白色+black/40背景）
  render: (props) => {
    const { x1, y1, x2, y2, name } = props;
    const width = x2 - x1;
    const height = y2 - y1;
    return (
      <g>
        {/* 标注选框：#ff0000 2px实线 */}
        <rect
          x={x1}
          y={y1}
          width={width}
          height={height}
          stroke="#ff0000"
          strokeWidth={2}
          fill="transparent"
        />
        {/* 标注名称：9px白色文字，black/40背景 */}
        <rect
          x={x1}
          y={y1 - 12}
          width={name.length * 8 + 6}
          height={12}
          fill="rgba(0,0,0,0.4)"
          rx={2}
        />
        <text
          x={x1 + 3}
          y={y1 - 2}
          fontSize={9}
          fill="#ffffff"
          dominantBaseline="middle"
        >
          {name}
        </text>
      </g>
    );
  },
});

// 3. 注册标注工具到tldraw画布
const AnnotationTool = () => {
  const canvasRef = useRef<TLCanvas>(null);
  const [annotations, setAnnotations] = useState<AnnotationShape[]>([]);

  // 初始化：注册自定义标注工具
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.registerShapeUtil(AnnotationUtil);
    }
  }, []);

  // 监听标注变化，同步到本地状态
  useEffect(() => {
    if (!canvasRef.current) return;
    const unsubscribe = canvasRef.current.store.listen(
      (state) => state.shapes,
      (shapes) => {
        const annoList = Object.values(shapes).filter(s => s.type === 'annotation') as AnnotationShape[];
        setAnnotations(annoList);
      }
    );
    return unsubscribe;
  }, []);

  return (
    <div style={{ width: '100%', height: '800px' }}>
      <Tldraw
        ref={canvasRef}
        tools={{
          // 注册标注工具到tldraw工具栏
          annotation: AnnotationUtil,
        }}
        defaultTool="annotation"
      />
      {/* 后续添加浮动toolbar、左侧列表、生图按钮等 */}
    </div>
  );
};

export default AnnotationTool;
```

### 4.3 标注数据管理（删除后重新编号）
```tsx
// 删除标注并重新编号
const deleteAnnotation = (id: string) => {
  if (!canvasRef.current) return;
  // 删除指定标注
  canvasRef.current.store.deleteShape(id);
  // 获取剩余标注，按创建顺序排序
  const remainAnnos = canvasRef.current.store.getAllShapes()
    .filter(s => s.type === 'annotation')
    .sort((a, b) => (a as AnnotationShape).props.name.localeCompare((b as AnnotationShape).props.name)) as AnnotationShape[];
  // 重新编号
  remainAnnos.forEach((anno, index) => {
    canvasRef.current?.store.updateShape<AnnotationShape>(anno.id, {
      props: {
        ...anno.props,
        name: `标注${index + 1}`,
      },
    });
  });
};
```

### 4.4 浮动Toolbar与左侧列表实现
```tsx
// 浮动Toolbar（平铺所有标注输入框）
const FloatingToolbar = () => {
  return (
    <div style={{ 
      position: 'absolute', 
      bottom: '20px', 
      left: '50%', 
      transform: 'translateX(-50%)',
      padding: '10px',
      background: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    }}>
      {annotations.map((anno) => (
        <div key={anno.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>{anno.props.name}：</span>
          <input
            type="text"
            value={anno.props.content}
            onChange={(e) => {
              // 更新标注说明
              canvasRef.current?.store.updateShape<AnnotationShape>(anno.id, {
                props: { ...anno.props, content: e.target.value },
              });
            }}
            placeholder="请输入标注说明"
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px'
            }}
          />
        </div>
      ))}
    </div>
  );
};

// 左侧标注列表
const LeftAnnotationList = () => {
  return (
    <div style={{
      width: '240px',
      padding: '10px',
      borderRight: '1px solid #e5e7eb',
      height: '800px',
      overflowY: 'auto'
    }}>
      <h3 style={{ fontSize: '14px', margin: '0 0 10px 0' }}>标注列表</h3>
      {annotations.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '12px' }}>暂无标注</div>
      ) : (
        annotations.map((anno) => (
          <div 
            key={anno.id}
            style={{
              padding: '8px',
              marginBottom: '8px',
              background: '#f9fafb',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              // 定位到对应标注（高亮闪烁）
              canvasRef.current?.store.selectShape(anno.id);
              canvasRef.current?.zoomToShapes([anno.id]);
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: '600' }}>{anno.props.name}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              {anno.props.content || '未填写说明'}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteAnnotation(anno.id);
              }}
              style={{
                marginTop: '4px',
                fontSize: '11px',
                color: '#ef4444',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              删除
            </button>
          </div>
        ))
      )}
    </div>
  );
};
```

### 4.5 参考图生成
```tsx
// 导出画布为参考图（包含原图+标注）
const exportReferenceImage = async (): Promise<string | null> => {
  if (!canvasRef.current) return null;
  try {
    // 导出tldraw画布为Blob
    const blob = await canvasRef.current.exportAsImage({
      format: 'png',
      quality: 0.8,
      // 导出画布可视区域
      width: canvasRef.current.store.getState().pageBounds.width,
      height: canvasRef.current.store.getState().pageBounds.height,
    });
    // 转换为Base64（适配API格式）
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('参考图生成失败：', err);
    return null;
  }
};
```

### 4.6 生图API调用与状态管理
```tsx
import axios from 'axios';

const [loading, setLoading] = useState(false); // 生成loading状态
const [resultImages, setResultImages] = useState<string[]>([]); // 生成结果图

// 调用生图API
const generateImage = async () => {
  // 1. 前置校验：检查是否有未填写的标注
  const emptyAnno = annotations.find(anno => !anno.props.content.trim());
  if (emptyAnno) {
    alert(`请填写「${emptyAnno.props.name}」的标注说明`);
    return;
  }

  // 2. 生成参考图
  const referenceImage = await exportReferenceImage();
  if (!referenceImage) {
    alert('参考图生成失败，请重试');
    return;
  }

  // 3. 合成finalprompt（按项目预设格式）
  // 注：此处仅为示例，实际格式替换为项目内定义的逻辑
  const basePrompt = projectConfig.basePrompt; // 项目预设基础prompt
  const annoContent = annotations.map(anno => `${anno.props.name}：${anno.props.content}`).join('；');
  const finalprompt = `${basePrompt} ${annoContent}`;

  // 4. 调用生图API（项目内已开发，直接调用）
  setLoading(true);
  try {
    // 替换为项目实际API地址
    const res = await axios.post('/api/image/generate', {
      finalprompt,
      referenceImage, // Base64格式
      imageCount: 3, // 生成图片数量
    });

    // 假设API返回图片URL列表
    if (res.data.code === 200) {
      setResultImages(res.data.data.images);
    } else {
      alert('生图失败：' + res.data.msg);
    }
  } catch (err) {
    console.error('生图API调用失败：', err);
    alert('生图请求失败，请重试');
  } finally {
    setLoading(false);
  }
};

// 生成按钮
const GenerateButton = () => {
  return (
    <button
      onClick={generateImage}
      disabled={loading || annotations.length === 0}
      style={{
        padding: '8px 16px',
        margin: '10px',
        background: loading ? '#9ca3af' : '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer'
      }}
    >
      {loading ? '生成中...' : '生成图片'}
    </button>
  );
};
```

### 4.7 结果展示（Loading/箭头/多图横向排列）
```tsx
// 扫光Loading组件
const SweepLoading = () => {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '400px',
      background: 'rgba(255,255,255,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div className="loading-mask" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
      <span>生成中，请稍候...</span>
    </div>
  );
};

// 箭头组件（实线）
const Arrow = ({ startX, startY, endX, endY }: { startX: number, startY: number, endX: number, endY: number }) => {
  return (
    <svg style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 10
    }}>
      {/* 实线箭头 */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="#666666"
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#666666" />
        </marker>
      </defs>
    </svg>
  );
};

// 结果展示容器（横向排列）
const ResultContainer = () => {
  const originImgRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [arrowPos, setArrowPos] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });

  // 计算箭头位置
  useEffect(() => {
    if (originImgRef.current && resultRef.current) {
      const originRect = originImgRef.current.getBoundingClientRect();
      const resultRect = resultRef.current.getBoundingClientRect();
      setArrowPos({
        startX: originRect.right,
        startY: originRect.top + originRect.height / 2,
        endX: resultRect.left,
        endY: resultRect.top + resultRect.height / 2
      });
    }
  }, [resultImages]);

  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      position: 'relative',
      padding: '20px'
    }}>
      {/* 原图容器 */}
      <div ref={originImgRef} style={{ width: '400px', height: '400px', border: '1px solid #e5e7eb' }}>
        {/* 此处展示原图 */}
        <p style={{ textAlign: 'center', lineHeight: '400px' }}>原图区域</p>
      </div>

      {/* 箭头 */}
      {resultImages.length > 0 && (
        <Arrow
          startX={arrowPos.startX}
          startY={arrowPos.startY}
          endX={arrowPos.endX}
          endY={arrowPos.endY}
        />
      )}

      {/* 结果图容器（横向排列） */}
      <div
        ref={resultRef}
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          padding: '10px 0',
          width: 'calc(100% - 420px)',
          height: '400px'
        }}
      >
        {loading ? (
          <SweepLoading />
        ) : resultImages.length === 0 ? (
          <div style={{ color: '#9ca3af', lineHeight: '400px' }}>暂无生成结果</div>
        ) : (
          resultImages.map((imgUrl, index) => (
            <img
              key={index}
              src={imgUrl}
              alt={`生成结果${index + 1}`}
              style={{
                width: '300px',
                height: '380px',
                objectFit: 'cover',
                border: '1px solid #e5e7eb',
                borderRadius: '4px'
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};
```

## 5. 关键样式定义
```css
/* 扫光Loading动画 */
.loading-mask {
  overflow: hidden;
}
.loading-mask::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent);
  animation: sweep 1.5s infinite linear;
}
@keyframes sweep {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* 结果图横向滚动条样式优化 */
::-webkit-scrollbar {
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}
```

## 6. 核心注意事项
1. 标注数据同步：tldraw 内置 store 是唯一数据源，本地状态仅做展示，所有修改需通过 `store.updateShape` 操作；
2. 坐标换算：图片缩放/平移时，标注坐标需基于画布 `camera.zoom` 和 `camera.pan` 换算，确保跟随准确；
3. API 兼容性：参考图格式（Base64/二进制）需适配项目内不同生图 API 的要求，可封装转换函数；
4. 性能优化：标注数量较多时，浮动 toolbar 输入框可做虚拟列表优化，避免渲染卡顿；
5. 异常处理：API 调用失败时需保留标注数据，支持重新生成，避免用户重复操作。

## 7. 总结
1. 核心实现基于 tldraw 自定义形状扩展，完成标注框选、编辑、样式渲染的核心能力；
2. 标注数据管理需保证删除后自动重新编号，浮动 toolbar 平铺所有输入框，满足交互要求；
3. 生图流程需先校验标注、生成参考图，再调用 API，结果展示需实现扫光 loading、实线箭头、横向排列的交互效果；
4. 所有样式和交互逻辑严格匹配需求，API 调用部分预留扩展接口，适配项目内不同生图 API 的格式要求。