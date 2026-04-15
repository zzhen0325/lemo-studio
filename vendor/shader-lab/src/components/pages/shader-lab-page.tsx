import { EditorCanvasViewport } from "@shaderlab/components/editor/editor-canvas-viewport"
import { MobileEditorDock } from "@shaderlab/components/editor/mobile-editor-dock"
import { EditorShortcuts } from "@shaderlab/components/editor/editor-shortcuts"
import { EditorTimelineOverlay } from "@shaderlab/components/editor/editor-timeline-overlay"
import { EditorTopBar } from "@shaderlab/components/editor/editor-topbar"
import { LayerSidebar } from "@shaderlab/components/editor/layer-sidebar"
import { PropertiesSidebar } from "@shaderlab/components/editor/properties-sidebar"

export function ShaderLabPage() {
  return (
    <main
      id="main-content"
      className="relative h-screen w-screen overflow-hidden bg-[var(--ds-color-canvas)]"
    >
      <EditorShortcuts />
      <EditorCanvasViewport />
      <EditorTimelineOverlay />
      <EditorTopBar />
      <LayerSidebar />
      <PropertiesSidebar />
      <MobileEditorDock />
    </main>
  )
}
