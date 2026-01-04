I will refactor the ControlToolbar and PlaygroundV2 page to implement the new preset grid layout and interaction flow.

1. **State Management Updates**:

   * In `ControlToolbar.tsx`, remove the inline expanded preset grid (`AnimatePresence` block).

   * In `PlaygroundV2Page.tsx` (or pass down from it), add state to track if the **new** preset grid overlay is open (`isPresetGridOpen`).

   * Connect the "Presets" button in `ControlToolbar` to toggle this `isPresetGridOpen` state instead of the internal `isSelectorExpanded`.

2. **New Preset Grid Component**:

   * Create a new component `PresetGridOverlay.tsx` (or inline in `PlaygroundV2Page` if simple enough, but a separate component is cleaner).

   * **Location**: It will be rendered in `PlaygroundV2Page` at the location where the History button currently is (Line 997-1007).

   * **UI Structure**:

     * **Header**:

       * **Left**: Tabs for categories: "All", "Lemo", "Banner", "Illustrator". (Note: Since `Preset` type doesn't have categories yet, I will mock this or add a temporary filter logic based on title keywords or just dummy tabs for now as per instructions).

       * **Right**: A button/icon to open the `PresetManagerDialog`.

     * **Grid**: The grid of preset cards (reuse the existing card design from `ControlToolbar`).

   * **Data**: It will consume `presets` from `usePlaygroundStore`.

3. **PlaygroundV2Page Integration**:

   * Add the `isPresetGridOpen` state.

   * Pass `onTogglePresetGrid` to `ControlToolbar`.

   * **Conditional Rendering**:

     * If `isPresetGridOpen` is TRUE: Render the `PresetGridOverlay` component.

     * If `isPresetGridOpen` is FALSE AND `!isDashboardActive`: Render the existing "History" button.

   * Ensure the `PresetGridOverlay` has a way to close itself (e.g., clicking outside or toggling the toolbar button).

4. **Preset Manager Integration**:

   * Ensure the "Manage Presets" button in the new overlay correctly opens `isPresetManagerOpen`.

5. **Type Updates (Optional but recommended)**:

   * Update `Preset` type to include `category` if we want real filtering, otherwise, I will just implement the UI tabs as requested without backend filtering for this iteration.

**Step-by-step Implementation Plan**:

1. **Modify ControlToolbar**:

   * Accept a new prop `onTogglePresetGrid`.

   * Update the "Presets" button `onClick` handler to call this prop.

   * Remove the internal preset grid rendering logic.

2. **Create** **`PresetGridOverlay`** **Component**:

   * Implement the tabs, grid layout, and manager entry button.

3. **Update** **`PlaygroundV2Page`**:

   * Add state `showPresetGrid`.

   * Pass setter to `ControlToolbar`.

   * Implement the conditional rendering logic: `History Button` vs `PresetGridOverlay`.

4. **Verify**:

   * Clicking "Presets" toggles the grid in the main area.

   * History button disappears when grid is shown.

   * Tabs and Manager button are present.

