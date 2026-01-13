I found that `components/features/playground-v2/PlaygroundInputSection.tsx` already exists and closely matches the required structure. I will update it to match the current logic in `playground.tsx` and then refactor `playground.tsx` to use this component.

**Plan:**

1. **Update** **`components/features/playground-v2/PlaygroundInputSection.tsx`**:

   * Update `PlaygroundInputSectionProps` to match `playground.tsx` state types (e.g., `selectedPresetName: string | undefined`).

   * Add `onClearPreset` to props and pass it to `ControlToolbar`.

   * Verify and sync any minor logic differences (e.g., `onAspectRatioChange`).
2. **Refactor** **`pages/playground.tsx`**:

   * Import `PlaygroundInputSection`.

   * Remove the local `renderInputUI` function.

   * Replace `{renderInputUI()}` with `<PlaygroundInputSection ... />` passing all required props.

