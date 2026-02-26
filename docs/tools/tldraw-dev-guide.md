Tldraw 开发指南 (For AI Assistants)
版本上下文: 本文档基于 tldraw v2/v3 SDK (SDK架构)。 核心概念: Tldraw 是一个基于 React 的无限画布 SDK。它的核心架构分为三层：

Store (数据层): 存放所有形状(Shapes)、资源(Assets)和页面状态的原子化数据库。

Editor (逻辑层): 一个非 React 的类实例，负责处理状态机(State Charts)、副作用(Side Effects)和直接的数据操作。

UI (视图层): 基于 React 的组件集合，消费 Store 并渲染画布。

1. 快速启动 (Boilerplate)
这是最基础的集成代码。注意: 所有的自定义配置（形状、工具、UI覆盖）通常作为 props 传递给 <Tldraw /> 组件。

TypeScript

import { Tldraw, TldrawFile } from 'tldraw'
import 'tldraw/tldraw.css'

export default function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw 
				onMount={(editor) => {
					// editor 是操作画布的上帝对象
					editor.createShape({ type: 'text', x: 100, y: 100, props: { text: 'Hello AI' } })
				}}
			/>
		</div>
	)
}
2. 自定义工具与形状 (Custom Tools & Shapes)
Tldraw 的扩展性通过 ShapeUtil (定义形状外观/行为) 和 StateNode (定义工具交互逻辑) 实现。

2.1 定义自定义形状 (ShapeUtil)
你需要继承 BaseBoxShapeUtil 或 ShapeUtil。

TypeScript

import { BaseBoxShapeUtil, HTMLContainer, TLBaseShape } from 'tldraw'

// 1. 定义形状的类型接口
type ICustomCardShape = TLBaseShape<
  'card', 
  { w: number; h: number; title: string } // Props
>

// 2. 实现 ShapeUtil
export class CardShapeUtil extends BaseBoxShapeUtil<ICustomCardShape> {
	static override type = 'card'
	static override props = {
		w: { type: 'number', default: 200 },
		h: { type: 'number', default: 120 },
		title: { type: 'string', default: 'New Card' },
	}

	override getDefaultProps(): ICustomCardShape['props'] {
		return { w: 200, h: 120, title: 'New Card' }
	}

	// 渲染逻辑 (React 组件)
	component(shape: ICustomCardShape) {
		return (
			<HTMLContainer style={{ border: '1px solid black', background: 'white', padding: 10 }}>
				{shape.props.title}
			</HTMLContainer>
		)
	}
    
    // 指示器 (选中时的蓝框)
	indicator(shape: ICustomCardShape) {
		return <rect width={shape.props.w} height={shape.props.h} />
	}
}
2.2 定义自定义工具 (StateNode)
工具是一个状态机。你需要继承 StateNode。

TypeScript

import { StateNode } from 'tldraw'

export class CardTool extends StateNode {
	static override id = 'card'

	override onEnter() {
		this.editor.setCursor({ type: 'cross', rotation: 0 })
	}

	override onPointerDown() {
		const { currentPagePoint } = this.editor.inputs
		this.editor.createShape({
			type: 'card',
			x: currentPagePoint.x,
			y: currentPagePoint.y,
		})
        // 创建完后切回选择工具
		this.editor.setCurrentTool('select')
	}
}
2.3 注册
将它们传递给 Tldraw 组件：

TypeScript

const customShapeUtils = [CardShapeUtil]
const customTools = [CardTool]

// 在组件中:
<Tldraw shapeUtils={customShapeUtils} tools={customTools} />
3. 自定义 UI 界面 (Custom UI)
Tldraw 提供了两种 UI 定制方式：Overrides (修改现有数据/行为) 和 Components (替换 React 组件)。

3.1 Overrides (注入按钮、修改快捷键)
使用 overrides prop 可以修改工具栏配置 (Tools) 和 动作行为 (Actions)。

TypeScript

const uiOverrides = {
    // 修改工具栏：添加我们的 Card Tool
	tools(editor, tools) {
		tools.card = {
			id: 'card',
			icon: 'geo-rectangle', // 使用内置图标或自定义
			label: 'Card',
			kbd: 'c',
			onSelect: () => editor.setCurrentTool('card'),
		}
		return tools
	},
}
3.2 Components (完全替换组件)
如果你想彻底替换工具栏或菜单，使用 components prop。设置为 null 可隐藏组件。

TypeScript

const components = {
	Toolbar: (props) => {
        // 自定义工具栏
		return (
			<div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translate(-50%)', display: 'flex', gap: 8, background: 'white', padding: 10, borderRadius: 8 }}>
				<button onClick={() => editor.setCurrentTool('select')}>Select</button>
				<button onClick={() => editor.setCurrentTool('card')}>Card</button>
			</div>
		)
	},
    MainMenu: null, // 隐藏主菜单
    PageMenu: null, // 隐藏页面菜单
}

// 使用: <Tldraw overrides={uiOverrides} components={components} />
4. 本地化调用 Workflow 功能 (Programmatic Workflow)
对于 AI 编程助手来说，"Workflow" 通常意味着程序化地控制画布（如：响应外部 AI 事件、自动布局、数据清洗）。这一切的核心是 editor 实例。

4.1 监听与响应 (Listeners)
你可以监听 Store 的变化来触发副作用。

TypeScript

// 在 onMount 或 useEffect 中使用
editor.store.listen((history) => {
    // history.changes 包含了增加、删除、修改的记录
    const changes = history.changes
    
    // 示例：如果添加了新形状，自动发送到后台分析
    if (changes.added) {
        Object.values(changes.added).forEach(record => {
            if (record.typeName === 'shape' && record.type === 'card') {
                console.log('新卡片被创建，ID:', record.id)
                // 触发你的本地 Workflow 函数
                runMyLocalWorkflow(record)
            }
        })
    }
})
4.2 拦截修改 (Side Effects)
你可以拦截用户的操作并在其生效前修改或拒绝（例如：强制某些形状不能被删除）。

TypeScript

editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next) => {
    // 示例：禁止移动被标记为 'locked-by-ai' 的形状
    if (prev.meta?.isAiLocked && prev.x !== next.x) {
        return prev // 返回 prev 表示拒绝修改
    }
    return next // 允许修改
})
4.3 外部控制 (External Control)
如果你在 Tldraw 组件外部需要控制它（例如从侧边栏点击按钮生成图表），你需要提升 editor 实例。

TypeScript

function MyEditorWrapper() {
    const [editor, setEditor] = useState<Editor | null>(null)

    const handleAiGenerate = () => {
        if (!editor) return
        
        // 批量操作以保证 Undo/Redo 的原子性
        editor.batch(() => {
            const id = createShapeId()
            editor.createShape({ type: 'text', x: 0, y: 0, props: { text: 'AI Generated' } })
            editor.select(id)
            editor.zoomToFit()
        })
    }

    return (
        <div className="flex">
            <Sidebar onGenerate={handleAiGenerate} />
            <div className="flex-1 relative">
                <Tldraw onMount={setEditor} />
            </div>
        </div>
    )
}
5. AI 编程助手专属：数据序列化与回填
当 AI 需要"看"画布或"写"画布时，使用以下模式：

5.1 获取上下文 (Read)
AI 通常不需要看像素，而是看 JSON 数据。

TypeScript

// 获取当前页面所有形状的 JSON 快照
const snapshot = editor.getCurrentPageShapes()
// 或者获取选中的形状
const selectedShapes = editor.getSelectedShapes()

// 转换为精简字符串传给 LLM
const contextForLlm = JSON.stringify(selectedShapes.map(s => ({
    type: s.type,
    text: s.props.text, // 假设是文本类形状
    x: s.x,
    y: s.y
})))
5.2 写入结果 (Write)
LLM 生成 JSON 后，使用 createShape 或 updateShape。

TypeScript

// 假设 LLM 返回: { action: "create", type: "note", content: "Refactor this code", x: 200, y: 300 }
const applyLlmAction = (action) => {
    editor.batch(() => {
        if (action.action === 'create') {
            editor.createShape({
                type: 'note',
                x: action.x,
                y: action.y,
                props: { text: action.content }
            })
        }
    })
}
总结关键 API 对象
editor: 核心控制器。所有操作（createShape, deleteShape, updateShape, select, zoomToFit）都通过它。

editor.store: 数据库。用于监听 (listen) 数据变化。

ShapeUtil: 只有定义新类型形状时需要。

overrides: 轻量级 UI 修改。

components: 重量级 UI 替换。