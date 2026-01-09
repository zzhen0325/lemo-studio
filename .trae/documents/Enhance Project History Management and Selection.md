# Project & History Management Enhancements (UI-Preserving)

## 1. Store Updates (`lib/store/project-store.ts`)
- Add `addGenerationsToProject` and `createProjectWithHistory` methods.
- These are logic-only changes and have no UI impact.

## 2. New Component: `AddToProjectDialog`
- Create a standalone `AddToProjectDialog` component.
- It renders as a modal overlay, ensuring no impact on the underlying page layout.

## 3. `HistoryList` Component Updates (`components/features/playground-v2/HistoryList.tsx`)
- **Selection Mode Toggle**:
  - Add a "Select" (CheckSquare icon) button to the **existing** top-right action group.
  - This simply adds one icon to the row; existing spacing and positioning remain identical.
- **Selection Visuals**:
  - **No Layout Shift**: Use CSS `ring` or `border-color` changes to indicate selection. Do not insert checkboxes that would push content.
  - **Group Selection**: In selection mode, make the entire group container clickable.
  - **Highlighting**: Selected items will have a distinct border color (e.g., primary color) and slight opacity change, without affecting dimensions.
- **Action Bar**:
  - Render a **floating** action bar at the bottom-center of the list container.
  - It overlays the content (z-index) with a glassmorphism effect, ensuring the underlying list layout is untouched.

## 4. `PlaygroundV2Page` & `ProjectSidebar` Logic
- Implement the "All Projects" logic (fetching global history) in `PlaygroundV2Page`.
- Ensure `ProjectSidebar` correctly resets the project ID to `null` when "All Projects" is clicked.
- These are functional changes to data flow.
