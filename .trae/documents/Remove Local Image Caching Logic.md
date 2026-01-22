# Remove Local Caching for Uploaded Images

The goal is to remove the local caching logic (IndexedDB) for uploaded images in the playground, specifically within the `uploadedImages` flow. This involves removing the `localImageStorage` usage and `localId` references in the relevant hooks and store.

## Technical Implementation

### 1. Update `useImageUpload` Hook
- Remove `localImageStorage` import and usage.
- Remove `localId` generation (or keep it as a temp ID but not for storage).
- Simplify the upload flow:
  - Generate base64/preview directly from the file.
  - Upload to server.
  - No longer store in IndexedDB.

### 2. Update `useImageSource` Hook
- Remove logic that attempts to load images from `localImageStorage` using `localId` or `local:` prefix.
- The hook should primarily rely on the provided URL (blob/data/server path).

### 3. Update `PlaygroundState` & Store
- In `applyImage` and `applyImages`, remove logic that fetches blobs from `localImageStorage`.
- Remove `syncLocalImageToHistory` if it's solely for syncing local DB images to server paths (or adapt it if it's still needed for other syncs, but likely can be removed or simplified).
- Remove `localId` from `UploadedImage` type definition if it's no longer used for retrieval.

### 4. Cleanup `local-image-storage.ts` Usages
- Check other components like `StyleDetailView.tsx` where `local:` prefix might be used and refactor to use standard preview URLs or server paths.
- If `local-image-storage.ts` becomes unused, it can be deleted (or kept if needed for other features not mentioned, but the request implies removing this logic).

### 5. Verify & Test
- Verify that uploading images still works: shows preview, uploads to server, and updates state.
- Verify that applying images from history or other sources works without relying on local DB.

## Plan Steps

1.  **Modify `hooks/common/use-image-upload.ts`**: Remove `localImageStorage.storeImage` call. Remove `localId` from the returned object or the upload options if it was only for storage retrieval.
2.  **Modify `hooks/common/use-image-source.ts`**: Remove the `localImageStorage.getImage` calls. Simplify to just handle URL formatting.
3.  **Modify `lib/store/playground-store.ts`**:
    - Update `applyImage` and `applyImages` to remove `localImageStorage` dependency.
    - Remove or refactor `syncLocalImageToHistory` to remove local storage sync logic.
4.  **Modify `components/features/playground-v2/StyleDetailView.tsx`**: Remove `local:` prefix logic and `localImageStorage` usage if present.
5.  **Modify `components/features/playground-v2/types.ts`**: Remove `localId` from `UploadedImage` interface (optional, but good for cleanup).
6.  **Verify**: Ensure image upload and display functions correctly without local caching.
