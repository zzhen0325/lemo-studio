I will refactor the `ControlToolbar` component to split the model selection and preset selection functionalities.

1. **Component State & Store Integration**:

   * Import `usePlaygroundStore` to access `presets`.

   * Add a local state `activeTab` (`'model' | 'preset'`) to track which panel content to display when expanded.

2. **UI Updates - Buttons**:

   * Modify the toolbar buttons area (Lines 175-194).

   * Keep the existing "Model" button but bind its click to `setActiveTab('model')` and expand.

   * Add a new "Preset" button next to it.

     * Style: Similar to the Model button (`Inputbutton2`).

     * Icon: `LayoutTemplate` or similar.

     * Click behavior: `setActiveTab('preset')` and expand.

3. **UI Updates - Expanded Panel**:

   * Inside the `AnimatePresence` block (Lines 318+), render content conditionally based on `activeTab`.

   * **Case** **`'model'`**:

     * Render the existing "Online Models" and "Workflow Gallery" sections (Lines 329-373).

   * **Case** **`'preset'`**:

     * Render a new grid of presets.

     * Grid Layout: `grid-cols-2` or `grid-cols-3` depending on space.

     * Card Content: Cover image (via `NextImage`), Title.

     * Empty State: "No presets found".

4. **Interaction Logic**:

   * **Model Selection**: Keep existing `handleUnifiedSelectChange`.

   * **Preset Selection**:

     * On click: Update configuration (`prompt`, `width`, `height`, `base_model`) using `onConfigChange` and `onModelChange`.

     * Handle workflow mapping if the preset uses a workflow ID.

     * Close the panel (`onSelectorExpandedChange(false)`).

5. **Refactoring**:

   * Ensure the expanded panel height adapts or is fixed to a reasonable size (e.g., `h-[400px]` as present).

   * Ensure clicking outside closes the panel (existing logic covers this).

