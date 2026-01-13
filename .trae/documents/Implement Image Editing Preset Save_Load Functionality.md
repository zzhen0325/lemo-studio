I will implement the "Save as Preset" functionality for image editing, allowing users to save their current editing state (including reference images, original image, annotations, and canvas drawings) and restore it later.

### 1. Data Structure Definitions
- **Update `types/database.ts`**:
    - Define `EditPresetConfig` interface to store:
        - `canvasJson`: The serialized Fabric.js canvas state.
        - `referenceImages`: List of reference images with their positions/IDs.
        - `originalImageUrl`: The source image being edited.
        - `annotations`: Text annotations.
        - `backgroundColor`: Canvas background color.
    - Extend `Preset` interface to include an optional `editConfig: EditPresetConfig` field.

### 2. Logic Implementation (`useImageEditor` Hook)
- **Update `hooks/features/PlaygroundV2/useImageEditor.ts`**:
    - Add `getCanvasState()` method to export the Fabric.js canvas to JSON.
    - Add `loadCanvasState(json: object)` method to restore the canvas from JSON.
    - Expose these methods in the hook's return object.

### 3. UI Implementation
- **Update `components/features/playground-v2/Dialogs/ImageEditorModal.tsx`**:
    - Add a "Save as Preset" button to the top-right header.
    - Implement `handleSavePreset` to:
        - Capture current canvas state using `getCanvasState()`.
        - Gather reference images and annotations.
        - Open the `PresetManagerDialog` with this data.
    - Add logic to initialize the editor with `initialState` if provided (for loading presets).

- **Update `components/features/playground-v2/Dialogs/PresetManagerDialog.tsx`**:
    - Update to accept an optional `editConfig` prop.
    - When saving, include the `editConfig` in the preset data sent to the backend.

- **Update `pages/playground.tsx`**:
    - In `handleSelectPreset`, check if the selected preset has `editConfig`.
    - If it does:
        - Set the original image as the editing target.
        - Open the `ImageEditorModal`.
        - Pass the saved `editConfig` to the modal to restore the state.

### 4. Verification
- **Save Flow**: Verify that clicking "Save as Preset" in the editor opens the dialog and successfully saves the preset to the list.
- **Load Flow**: Verify that clicking the saved preset in the list opens the editor and correctly restores the original image, reference images, and all annotations/drawings.
