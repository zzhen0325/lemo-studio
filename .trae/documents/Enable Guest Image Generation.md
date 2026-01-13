# Enable Guest Image Generation

## Objective
Allow non-logged-in users (guests) to generate images by handling the missing `currentUser` gracefully.

## Implementation Steps

### 1. Update `useGenerationService.ts`
Modify `hooks/features/PlaygroundV2/useGenerationService.ts` to use a fallback user ID (`'anonymous'`) when no user is logged in.

- **In `handleGenerate`**:
  - Replace `userId: userStore.currentUser.id` with `userId: userStore.currentUser?.id || 'anonymous'`.
  
- **In `handleUnifiedImageGen`**:
  - Fix the hardcoded `userId: 'anonymous'` to use `userStore.currentUser?.id || 'anonymous'` so logged-in users are correctly identified.

- **In `handleWorkflow`**:
  - Replace `userId: userStore.currentUser.id` with `userId: userStore.currentUser?.id || 'anonymous'`.

## Verification
- Verify that generation starts without error when logged out.
- Verify that generation is attributed to the correct user when logged in.
