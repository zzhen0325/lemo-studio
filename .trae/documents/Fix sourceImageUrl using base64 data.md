I will implement the feature to embed the `PlaygroundInputSection` into the `ImageEditorModal` to allow real-time prompt editing and direct generation.

### Plan

1. **Update** **`PlaygroundInputSection`** **Component**

   * File: `components/features/playground-v2/PlaygroundInputSection.tsx`

   * Add an optional `hideTitle` prop to `PlaygroundInputSectionProps`.

   * Use this prop to conditionally hide the "Turn any idea into a stunning image" header text. This is necessary to save vertical space inside the modal.

2. **Update** **`ImageEditorModal`** **Component**

   * File: `components/features/playground-v2/Dialogs/ImageEditorModal.tsx`

   * Import `PlaygroundInputSection` and its props type.

   * Add optional `inputSectionProps` to `ImageEditorModalProps`.

   * Modify the component layout: Change the central canvas container to a flex column.

   * Render `PlaygroundInputSection` at the bottom of the central area if `inputSectionProps` is provided.

   * Implement a wrapper function `handleModalGenerate` that:

     1. Calls `exportImage()` to get the current edited image and prompt.
     2. Calls `onSave()` to save the changes to the parent state (which also updates `uploadedImages` in the store and closes the modal).
     3. Calls `inputSectionProps.handleGenerate()` to trigger the generation process (which will pick up the saved image from the store and switch to history view).

   * Pass this wrapped `handleModalGenerate` and `hideTitle={true}` to the embedded `PlaygroundInputSection`.

3. **Update** **`Playground`** **Page**

   * File: `pages/playground.tsx`

   * Refactor the props passed to the main `PlaygroundInputSection` into a reusable object `inputSectionProps`.

   * Pass this `inputSectionProps` object to the `ImageEditorModal` instance.

### Verification

* Open the Image Editor.

* Verify that the input section appears below the canvas.

* Verify that editing the prompt in the modal works.

* Click "Generate" in the modal:

  * Ensure the modal closes.

  * Ensure the generated image uses the edited content from the canvas.

  * Ensure the view switches to the History panel.

