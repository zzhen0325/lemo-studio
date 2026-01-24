# Tldraw Annotation Tool Technical Implementation

## Custom Shapes (ShapeUtil)

When defining custom shapes in Tldraw 4.x+, inherit from `BaseBoxShapeUtil`.

### Schema Definition
Use `interface` for clarity and `TLShapeId` for IDs. Use `props` to store business data.

```typescript
export interface AnnotationShape {
    id: TLShapeId
    type: string // 'annotation'
    x: number
    y: number
    props: {
        name: string
        content: string
        w: number
        h: number
    }
}
```

### ShapeUtil Class
Use `@ts-expect-error` if the SDK's internal `TLShape` union doesn't include your custom type yet.

```typescript
export class AnnotationShapeUtil extends BaseBoxShapeUtil<AnnotationShape> {
    static override type = 'annotation' as const;
    
    override component(shape: AnnotationShape) {
        return (
            <HTMLContainer style={{ border: '2px solid red', pointerEvents: 'none' as const }}>
                <div>{shape.props.name}</div>
            </HTMLContainer>
        );
    }
}
```

## Custom Tools (StateNode)

Tools handle the interaction logic (e.g., drag to create).

### Tool Implementation
Inherit from `StateNode`. Use `this.editor` to interact with the canvas.

```typescript
export class AnnotationTool extends StateNode {
    static override id = 'annotation';

    override onPointerDown() {
        const { currentPagePoint } = this.editor.inputs;
        this.editor.createShape({
            type: 'annotation',
            x: currentPagePoint.x,
            y: currentPagePoint.y,
            props: { w: 1, h: 1, name: '', content: '' },
        } as any);
    }

    override onPointerMove() {
        if (this.editor.inputs.isDragging) {
            const { originPagePoint, currentPagePoint } = this.editor.inputs;
            const id = this.editor.getSelectedShapeIds()[0];
            // Update logic...
            this.editor.updateShapes([{
                id,
                x: Math.min(originPagePoint.x, currentPagePoint.x),
                y: Math.min(originPagePoint.y, currentPagePoint.y),
                props: { w: ..., h: ... }
            } as unknown as AnnotationShape]);
        }
    }
}
```

## Business Workflows

### Automatic Renumbering
When working with "Annotation 1, 2...", use `editor.getCurrentPageShapeIds()` to find all existing annotations and determine the next number in `onPointerUp`.

### Syncing with UI
To build a custom toolbar *outside* the default Tldraw UI but *inside* the canvas area, use the `components.InFrontOfTheCanvas` prop. Use `useEditor()` inside that component for stable access.
