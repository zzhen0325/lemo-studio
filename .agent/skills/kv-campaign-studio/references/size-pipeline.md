# Size Pipeline

## Required Output Sizes

- `1125x600`
- `1125x672`
- `1054x720`
- `1125x450`
- `1080x1080`
- `1080x1440`

## Mixed Strategy

Use regenerate-first with fallback adaptation:

1. Generate one master candidate from optimized prompt.
2. For each required size:
   - Attempt direct regenerate at target dimensions.
   - On regenerate failure, adapt from master image.
3. Return all successful size outputs and keep per-size method metadata.

## Pseudocode

```ts
for (const size of requiredSizes) {
  try {
    const regenerated = await imageGen.generate({
      modelId,
      prompt,
      width: size.width,
      height: size.height,
    });
    outputs.push({ ...size, imageUrl: regenerated.imageUrl, method: "regenerated" });
    continue;
  } catch (error) {
    // continue to fallback
  }

  try {
    const adapted = await sizeAdapter.adapt({
      masterImageUrl,
      targetWidth: size.width,
      targetHeight: size.height,
      policy: "subject-first",
    });
    outputs.push({ ...size, imageUrl: adapted.imageUrl, method: "fallback_adapted" });
  } catch (error) {
    failures.push({ size, reason: String(error) });
  }
}
```

## Policy Notes

- Default adaptation policy: `subject-first`.
- If subject location is unknown, center-weight crop before pad.
- Never fail the whole run because one size fails.
- Preserve master image for retries and refinement sessions.
