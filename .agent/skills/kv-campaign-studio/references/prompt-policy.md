# Prompt Policy

## Goal

Produce campaign KV prompts that are structured, editable, and robust for multi-size generation.

## Field Completion Rules

When user input is sparse, auto-complete these fields with plausible campaign defaults:

- `mainTitle`: concise benefit-led headline
- `subTitle`: supporting value proposition
- `eventTime`: explicit date range or campaign period text
- `heroSubject`: single dominant visual subject
- `style`: production style descriptor
- `primaryColor`: hex color aligned with style and market

All auto-completed fields must remain user-editable.

## Prompt Composition Rules

- Keep one dominant hero subject.
- Keep hierarchy explicit: title > subtitle > timing.
- Keep layout instructions concise and executable.
- Avoid contradictory camera, lighting, or style directives.
- Prefer concrete visual nouns over abstract adjectives.

## Optimizer Output Parsing Rules

- Optimizer output is natural language with fixed sections, not JSON.
- Required sections: `方向名称`, `Canvas`, `Subject`, `Background`, `Layout`, `Typography`, `可编辑 Tokens`.
- Parse section blocks into internal fields for downstream generation.
- If required sections are missing, treat output as unusable and request retry.

## Model Routing Guardrails

- Default to Seedream generation.
- Use Lemo only when user explicitly requests Lemo.
- If chosen model rejects target size, route that size to fallback adaptation.

## Refinement Rules

For follow-up edits:

1. Apply minimal delta to requested part.
2. Preserve unchanged fields and structure.
3. Re-run only impacted sizes unless user asks for full rerun.

## Safety and Quality

- Reject empty or non-usable optimized variants.
- Remove ambiguous instructions that can break text layout.
- Keep output deterministic enough for iterative production use.
