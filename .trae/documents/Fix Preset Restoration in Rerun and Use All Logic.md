I will fix the issue where the preset selection is not correctly restored (or cleared) when using "Rerun" or "Use All" on a history item. This happens because the current logic might preserve the existing preset selection if the history item doesn't explicitly override it, or fails to update the store state explicitly.

I will make the following changes:

1.  **Modify `components/features/playground-v2/GalleryView.tsx`**:
    *   Update the `usePlaygroundStore` hook to include `setSelectedPresetName`.
    *   In the "Rerun" button's click handler, explicitly call `setSelectedPresetName(item.config?.presetName)` to enforce the history item's preset state (whether it's a specific preset or `undefined`).

2.  **Modify `components/features/playground-v2/HistoryList.tsx`**:
    *   Update the `usePlaygroundStore` hook to include `setSelectedPresetName`.
    *   In the "Use All" button's click handler, explicitly call `setSelectedPresetName(config.presetName)` to ensure the preset is correctly applied or cleared.

This ensures that the UI state for the selected preset perfectly matches the history item being reused.