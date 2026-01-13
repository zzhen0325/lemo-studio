## 方案设计

本方案旨在为项目添加完整的用户注册、登录及个人信息设置功能。我们将从简单的文件存储后端开始，配合前端 UI 组件实现完整的用户流程。

### 1. 后端 API 开发 (app/api/users/route.ts)

*   **功能**: 处理用户的增删改查。
*   **存储**: 使用 `public/outputs/users.json` 存储用户数据。
*   **接口**:
    *   `GET`: 获取所有用户列表（用于登录选择或调试，实际生产应受限）。
    *   `POST`: 注册新用户或登录验证（简单验证）。
    *   `PUT`: 更新用户信息（昵称、头像）。

### 2. 状态管理升级 (lib/store/user-store.ts)

*   移除 Mock 数据，改为从 API 获取。
*   新增 `isLoading` 状态。
*   新增 `login(username, password)` 方法。
*   新增 `register(username, password)` 方法。
*   新增 `updateProfile({ name, avatar })` 方法。
*   新增 `logout()` 方法。

### 3. UI 组件开发

我们将新增两个主要弹窗组件：

#### A. 认证弹窗 (components/features/auth/AuthDialog.tsx)
*   **Tabs**: 登录 / 注册。
*   **表单**: 用户名、密码（简单文本框）。
*   **交互**: 提交后调用 Store 方法，成功则关闭弹窗并自动登录。

#### B. 个人设置弹窗 (components/features/auth/UserProfileDialog.tsx)
*   **表单**:
    *   昵称修改。
    *   头像选择：提供几个预设头像（Emoji 或内置图片），并支持简单的 URL 输入或本地上传（复用现有的上传 API）。
*   **交互**: 保存后更新 Store 和后端。

### 4. 侧边栏集成 (components/layout/NewSidebar.tsx)

*   修改用户头像区域的点击逻辑。
*   **未登录状态**: 显示“登录/注册”按钮，点击弹出 `AuthDialog`。
*   **已登录状态**: 显示用户头像，点击弹出下拉菜单。
    *   菜单项：
        *   显示当前用户名。
        *   **设置**: 弹出 `UserProfileDialog`。
        *   **退出登录**: 调用 `logout` 并刷新状态。

## 实施计划

### 第一阶段：后端与 Store

1.  创建 `app/api/users/route.ts`。
2.  更新 `lib/store/user-store.ts` 对接 API。

### 第二阶段：UI 组件

1.  创建 `components/features/auth` 目录。
2.  实现 `AuthDialog.tsx`。
3.  实现 `UserProfileDialog.tsx`。

### 第三阶段：集成与验证

1.  修改 `components/layout/NewSidebar.tsx` 集成新组件。
2.  验证注册、登录、修改资料、退出登录的全流程。
3.  验证多用户切换后数据（历史记录、项目）的隔离性（基于之前的改动）。

