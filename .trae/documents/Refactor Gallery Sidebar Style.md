**Implementation Plan: Refactor Gallery Sidebar to Match ProjectSidebar Style**

The goal is to update the `GalleryView` sidebar to use the styling and interaction patterns from `ProjectSidebar`, replacing the current checkbox-based design.

### 1. Analyze Design Patterns
- **Container**: `ProjectSidebar` uses a `bg-white/5 border border-white/10 rounded-3xl` container.
- **Header**: Flex layout with a title (custom font) and action buttons.
- **Items**: `ProjectItem` component uses:
  - `group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm`
  - Active state: `bg-white/5 text-white border border-white/10`
  - Inactive state: `text-white/60 hover:bg-black/10 hover:text-white`
  - Icons: Uses `Folder` or `LayoutGrid` icons for items.
- **Scrolling**: `GradualBlur` component is used for scroll visual effects.

### 2. UI Refactoring in `GalleryView.tsx`

I will create reusable sub-components within `GalleryView.tsx` (or inline if simple enough) to mimic `ProjectItem` for "Models" and "Presets".

#### **Structure Changes:**
- **Container**:
  - Replace the direct `Sidebar` usage or wrap it to match the rounded/glass look: `bg-white/5 border border-white/10 rounded-3xl`.
  - Add `GradualBlur` (import from `@/components/GradualBlur`) for the top fade effect.

- **Header**:
  - Use the serif font style for the "Filters" title: `fontFamily: "'InstrumentSerif', serif"`.
  - Add a "Clear" button styled like the `ProjectSidebar` action buttons (icon-only or minimal text).

- **Filter Items (Replacing Checkboxes)**:
  - Create a `FilterItem` component/render function.
  - **Interaction**: instead of a checkbox, the entire row is clickable.
  - **Selection**:
    - Clicking an unselected item adds it to the filter.
    - Clicking a selected item removes it.
    - (Optional) Single-select vs Multi-select? The previous implementation was multi-select (checkboxes). I will maintain multi-select behavior but using the "active state" styling from `ProjectSidebar`.
  - **Visuals**:
    - Selected: `bg-white/5 text-white border border-white/10`
    - Unselected: `text-white/60 hover:bg-black/10 hover:text-white`
    - Icon: Add a relevant icon for Models (e.g., `Box` or `Component`) and Presets (e.g., `Sliders` or `Bookmark`).

### 3. Implementation Steps
1.  **Imports**: Add `GradualBlur` and necessary icons (`Box`, `SlidersHorizontal`, etc.).
2.  **Refactor Sidebar Wrapper**: Update the outer container of the sidebar to match `ProjectSidebar`'s rounded, bordered, glass-morphic look.
3.  **Implement `FilterItem`**: Create a helper component for rendering filter options that looks like `ProjectItem`.
4.  **Update Content**:
    - Remove `Checkbox` and `Label`.
    - Render "Models" list using `FilterItem`.
    - Render "Presets" list using `FilterItem`.
5.  **Clean up**: Remove unused imports.

### 4. Verification
- Verify that the new sidebar looks consistent with the Project sidebar (rounded corners, colors, blur effect).
- Ensure multi-select filtering still works by clicking items.
- Check "Clear" functionality.

**Note**: I will modify `GalleryView.tsx` directly.
