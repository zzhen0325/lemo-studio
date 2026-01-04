I will optimize the `ControlToolbar` component to simplify the button layout and model selection logic as requested.

1. **Refactor Top Toolbar Buttons**:

   * **Main Model Button**: Update label logic (`triggerLabel`) to display `selectedBaseModelName` when in 'Workflow' (Base Model) mode.

   * **Preset Button**: Retain as is.

   * **Remove**: The standalone "Base Model" button (`Button` with `selectedBaseModelName`).

   * **LoRA Button**: Retain but ensure it is **only visible** when `selectedModel === 'Workflow'` (i.e., Base Model mode).

   * **Mock & Aspect Ratio**: Retain as is.

2. **Refactor Dropdown Content (Model Tab)**:

   * **Simplify Options**: Replace the existing "Online Models" and "Workflow Gallery" sections with a single unified grid/list containing exactly 4 options:

     1. **Nano banana**
     2. **Seed 3**
     3. **Seed 4**
     4. **Base Model**

   * **Base Model Option Logic**:

     * Visual: Similar style to other model buttons.

     * Action:

       * Set `selectedModel` to `'Workflow'`.

       * Trigger `onOpenBaseModelSelector()` to allow the user to choose the specific checkpoint.

       * Close the dropdown.

3. **Interaction Flow**:

   * User clicks "Main Model Button" -> Dropdown opens.

   * User selects "Nano" -> Main Button shows "Nano", LoRA button hidden.

   * User selects "Base Model" -> Base Model Selector opens -> User picks model -> Main Button shows Model Name, LoRA button appears.

   * User selects "Preset" -> (Existing logic) -> Model switches automatically.

4. **Cleanup**:

   * Remove unused `Workflow Gallery` rendering logic in the dropdown.

   * Ensure styling is consistent.

