---
name: tldraw-annotate
description: Guide for developing custom annotation tools and UI on Tldraw v4.3.0. Use when building image labeling features, custom shapes (ShapeUtil), custom interaction tools (StateNode), or bespoke canvas toolbars in React. Targeted at LLM image generation workflows.
---

# Tldraw Annotate Skill

Specialized guidance for extending Tldraw with annotation and image modification capabilities.

## Core Concepts

In Tldraw v4.3.0+, extension is handled via two primary primitives:
1. **ShapeUtil**: Defines how a shape looks and provides its UI.
2. **StateNode (Tools)**: Defines how the user interacts with the canvas to create or modify shapes.

## Workflows

### 1. Creating a Custom "Drag-to-Create" Tool
To implement a box-selection style annotation tool:
1. Define a custom `StateNode` (inherit from `StateNode`).
2. Override `onPointerDown` to create the initial shape.
3. Override `onPointerMove` to update dimensions while dragging.
4. Override `onPointerUp` to finalize and switch back to 'select'.
5. Register the tool in the `<Tldraw tools={[MyTool]} />` prop.

Detailed pattern: See [development.md](references/development.md)

### 2. Business Logic: Automatic Renumbering
When users delete regions, the remaining regions should often re-sequence (e.g., Label 3 becomes Label 2). 
- **Implementation**: Listen to store changes using `editor.store.listen` or handle explicitly in the delete action.
- Iterate through all shapes of type 'annotation', sort them by creation or position, and updated their labels.

### 3. Custom UI Placement
Standard Tldraw UI (menus, toolbars) can be hidden with `hideUi={true}`.
- To place your own buttons *over* the canvas that don't move with the camera, use:
  ```tsx
  <Tldraw components={{ InFrontOfTheCanvas: MyToolbar }} />
  ```
- **Important**: Use the `useEditor()` hook *inside* `MyToolbar` to stay in sync with the canvas state.

## Resource Reference
- **Development Specs**: Read [development.md](references/development.md) for TypeScript interfaces and class implementations.
- **Project Context**: Based on the specific image studio requirements in `docs/tools/tldraw-annotate.md`.

## Quality Standards
- **Strictly No `any`**: Use `unknown` or type parameters like `Parameters<typeof editor.updateShapes>[0][number]` to satisfy Tldraw's complex union types.
- **Native Constants**: Always prefer `as const` for type IDs.
- **Stable References**: Use `useRef` for values needed inside non-React event handlers to avoid closure staleness.
