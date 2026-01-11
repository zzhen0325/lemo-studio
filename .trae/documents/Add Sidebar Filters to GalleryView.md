**Implementation Plan: Add Sidebar Filters to Gallery View**

This plan outlines the steps to add a sidebar with "Model" and "Preset" filters to the `GalleryView` component when in full tab mode.

### 1. Component & Hook Imports
- Import necessary UI components from `@/components/ui`:
  - `Checkbox` for selecting filters.
  - `Label` for filter labels.
  - `ScrollArea` for handling long lists of filters.
  - `Button` (optional, for clearing filters).
- Import `Filter` icon from `lucide-react` for UI enhancement.

### 2. State Management
- Add state variables to track selected filters:
  ```typescript
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  ```

### 3. Data Processing (Memoization)
- **Extract Available Options**: Use `useMemo` to derive unique lists of models and presets from `generationHistory`.
  - `availableModels`: `string[]`
  - `availablePresets`: `string[]`
- **Update Filtering Logic**: Modify the `sortedHistory` `useMemo` hook to include logic for filtering by `selectedModels` and `selectedPresets` alongside the existing text search.

### 4. UI Structure Refactoring
- Modify the main container's layout structure to support a sidebar.
- Current:
  ```jsx
  <div className="flex flex-col ...">
      <Header />
      <Content />
  </div>
  ```
- Proposed:
  ```jsx
  <div className="flex flex-col ...">
      <Header />
      <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Area */}
          {(variant === 'full' && activeView === 'gallery') && (
              <aside className="w-64 flex-none ...">
                  {/* Filter Sections */}
              </aside>
          )}
          {/* Main Content Area */}
          <main className="flex-1 ...">
             <Content />
          </main>
      </div>
  </div>
  ```

### 5. Sidebar Component Implementation
- Create the sidebar section within `GalleryView.tsx`.
- **Header**: "Filters" title with an option to clear all filters if any are selected.
- **Model Section**: List available models with checkboxes.
- **Preset Section**: List available presets with checkboxes.
- Style using Tailwind CSS to match the existing dark/glassmorphism theme (`bg-black/20`, `border-white/10`, etc.).

### 6. Verification
- Verify that the sidebar only appears in 'full' variant and 'gallery' tab.
- Test filtering by selecting one or multiple models.
- Test filtering by selecting one or multiple presets.
- Test combined filtering (Model + Preset + Search).
- Ensure "Clear Filters" functionality works (if implemented).
- Check responsiveness (hide or adapt sidebar on smaller screens if necessary, though requirement implies desktop tab mode).

**Note**: No new files will be created. All changes will be within `GalleryView.tsx`.
