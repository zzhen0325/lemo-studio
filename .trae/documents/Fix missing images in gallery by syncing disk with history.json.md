The file `img_1768359515622_614vyp.png` is not present in `history.json`, which is why it's not showing up in the gallery. The current backend logic only rescans the disk if `history.json` is missing or empty. I need to update the backend logic to force a sync between disk files and `history.json` to ensure all files are indexed.

### Plan

1.  **Modify** **`app/api/history/route.ts`**
    *   Update the `GET` handler.
    *   Instead of only scanning disk when `history` is empty, perform a lightweight check:
        *   Read `history.json` to get the current list of known files (create a Set of filenames/IDs).
        *   Scan the `public/outputs` directory for image files.
        *   Identify any files on disk that are *missing* from the `history.json` set.
        *   If missing files are found, process their metadata (load from corresponding `.json` or infer from filename) and append them to the history array.
        *   Sort the merged history by date (descending).
        *   Save the updated history back to `history.json` so the next request is fast.
    *   This "incremental sync" approach ensures that manually added files or files missed due to save errors will automatically appear in the gallery without needing to delete `history.json`.

### Verification

1.  After applying the fix, I will trigger a request to the history API (or ask the user to refresh the gallery).
2.  The missing image `img_1768359515622_614vyp.png` should now be detected, added to `history.json`, and returned in the API response.
