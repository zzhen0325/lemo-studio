## 方案设计

### 1. 后端接口优化 (app/api/history/route.ts)

* 修改 `GET` 处理器，支持 `page`、`limit` 和 `projectId` 参数。

* 优先从 `history.json` 读取数据（单文件读取比扫描目录快得多），如果不存在则回退到扫描磁盘。

* 在服务器端完成过滤和切片，减少传输数据量。

### 2. 状态管理更新 (playground-store.ts)

* 在 `PlaygroundState` 中增加分页状态：`historyPage`、`hasMoreHistory` 和 `isFetchingHistory`。

* 重构 `fetchHistory` 方法，支持分页请求。如果是第一页则替换数据，否则追加数据。

### 3. 组件功能增强 (HistoryList.tsx)

* 使用 `IntersectionObserver` 在列表底部实现无限滚动。

* 当用户滚动到底部且还有更多数据时，自动触发加载下一页。

* 增加底部加载动画和“加载完成”的状态提示。

### 4. 页面逻辑调整 (playground.tsx)

* 更新 `useEffect`，在页面加载或项目切换时正确触发首屏历史记录加载。

## 实施计划

### 第一阶段：后端 API 升级

* 修改 `app/api/history/route.ts` 的 `GET` 方法。

### 第二阶段：Store 分页逻辑

* 修改 `lib/store/playground-store.ts` 增加分页状态和更新 `fetchHistory`。

### 第三阶段：UI 无限滚动实现

* 修改 `components/features/playground-v2/HistoryList.tsx` 实现滚动监听和加载触发。

### 第四阶段：整合与验证

* 在 `pages/playground.tsx` 中进行最后的对接。

