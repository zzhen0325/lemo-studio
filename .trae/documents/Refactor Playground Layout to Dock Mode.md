I will refactor `pages/playground.tsx` to implement the requested "Dock Mode" structure and clean up the layout.

**Plan:**

1. **State Management Refactor:**

   * Introduce a unified `viewMode` state (`'home' | 'dock'`) and `activeTab` state (`'history' | 'gallery' | 'describe'`).

   * Replace the scattered boolean states (`isGalleryOpen`, `isDescribeMode`, and local usage of `showHistory`) with these unified states to ensure mutually exclusive views.

   * *Note:* I will maintain `setShowHistory(true)` when entering Dock mode to preserve existing side effects (like Project Sidebar visibility), but the UI rendering will be driven by the new `viewMode`.

2. **Home Page & Triggers:**

   * The "Capsule Buttons" (Describe, Edit, History, Gallery) will only be visible in `home` mode.

   * Clicking any of these (except Edit) will switch `viewMode` to `'dock'` and set the corresponding `activeTab`.

   * Clicking "Generate" will automatically switch `viewMode` to `'dock'` and `activeTab` to `'history'`.

3. **Dock Implementation (Secondary Page):**

   * The Dock sidebar (left edge) will be persistent whenever `viewMode === 'dock'`.

   * Dock buttons will reflect the `activeTab` with a single selection state.

   * "Edit" will remain an action that opens the modal but doesn't change the persistent tab.

4. **Content Area & Layout Cleanup:**

   * Remove the "old deprecated layout" (specifically the `GalleryView` overlay wrapper).

   * Unify the content area to render `HistoryList`, `GalleryView`, or `DescribePanel` (if applicable) based on `activeTab`.

   * Ensure the structure follows: `Home -> Dock Mode (with persistent Dock + Content)`.

5. **Verification:**

   * Verify that "Generate" enters Dock mode.

   * Verify that switching tabs works and updates the content.

   * Verify that the Dock remains visible in the secondary page.

