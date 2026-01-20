用户的反馈表明第一次打开预览时存在“错位抖动”，而后续正常。这通常是由于资源加载延迟或 DOM 渲染时序导致的布局计算偏差。

我们将采取以下措施进行修复：

1. **优化滚动条锁定机制 (SimpleImagePreview\.tsx)**：

   * 将锁定滚动条的逻辑从 `useEffect` 改为 `useLayoutEffect`。`useEffect` 是在浏览器绘制后执行的，可能会导致一瞬间的布局跳变（滚动条消失导致页面宽度变化）。`useLayoutEffect` 会在 DOM 变更后、浏览器绘制前同步执行，能有效避免这种闪烁。

2. **增强动画布局稳定性 (SimpleImagePreview\.tsx)**：

   * 给预览容器的 `motion.div` 添加 `layout` 属性。这告诉 Framer Motion 在内容尺寸发生变化（例如图片加载完成撑开容器）时，自动平滑地处理布局过渡，而不是瞬间跳变。

   * 添加 `className="origin-center"` 确保变换原点正确。

3. **微调 StyleDetailView\.tsx**：

   * 确保缩略图的 `motion.div` 布局属性配置正确，移除可能干扰布局计算的多余属性。

通过这些修改，我们可以确保在预览打开的瞬间，页面布局已经锁定，且 Framer Motion 能正确处理图片加载带来的尺寸变化，从而消除首次打开时的抖动。

**具体步骤：**

1. 修改 `SimpleImagePreview.tsx`，引入 `useLayoutEffect` 并替换 `useEffect` 用于处理 body 样式。
2. 在 `SimpleImagePreview.tsx` 的 `motion.div` 上添加 `layout` 属性。

