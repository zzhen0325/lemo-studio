## 方案设计

为了实现 Gallery 页面显示所有用户的生成历史，我们需要分离“个人历史”和“公共画廊”的数据获取逻辑。

### 1. Store 扩展 (lib/store/playground-store.ts)

*   **新增状态**:
    *   `galleryItems`: 存储画廊页面显示的公共数据。
    *   `galleryPage`: 画廊当前页码。
    *   `hasMoreGallery`: 画廊是否有更多数据。
    *   `isFetchingGallery`: 画廊加载状态。
*   **新增方法**:
    *   `fetchGallery(page?: number)`: 类似于 `fetchHistory`，但调用 API 时**不传递 `userId`**，从而获取所有公共数据。

### 2. 组件更新 (components/features/playground-v2/GalleryView.tsx)

*   **替换数据源**: 将原本使用的 `generationHistory` 和 `fetchHistory` 替换为新增加的 `galleryItems` 和 `fetchGallery`。
*   **无限滚动**: 确保无限滚动逻辑调用的是 `fetchGallery`。

### 3. API 确认 (app/api/history/route.ts)

*   确认现有的 API 逻辑：当 `userId` 参数缺失时，默认不过滤用户，返回所有历史记录。这符合我们的需求，无需修改。

## 实施计划

1.  **修改 Store**: 更新 `lib/store/playground-store.ts`，添加 Gallery 相关的状态和方法。
2.  **修改 GalleryView**: 更新 `components/features/playground-v2/GalleryView.tsx`，对接新的 Store 方法。
3.  **验证**: 确认 Gallery 页面显示所有图片，而 Playground 的 History 侧边栏仅显示当前用户的图片。

