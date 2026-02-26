import type { Editor, TLEditorSnapshot, TLRecord } from 'tldraw';

export function stripRegionInstructions(prompt: string): string {
  if (!prompt) return "";
  return prompt.replace(/\n*Region Instructions:[\s\S]*/g, "").trim();
}

export async function uploadImageBase64ToServer(
  apiBase: string,
  imageBase64: string,
  ext = 'png',
  subdir = 'uploads'
): Promise<string | null> {
  try {
    const resp = await fetch(`${apiBase}/save-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, ext, subdir })
    });
    const json = await resp.json() as { path?: string };
    return json?.path || null;
  } catch (error) {
    console.error('[TldrawEditor] Upload failed:', error);
    return null;
  }
}

export async function localizeImageUrl(imageUrl: string): Promise<string> {
  try {
    const resp = await fetch(imageUrl);
    const blob = await resp.blob();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } catch (error) {
    console.error('[TldrawEditor] Failed to localize image:', error);
    return imageUrl;
  }
}

export function zoomToFitWithUiAvoidance(editor: Editor, animationDuration = 0): void {
  editor.zoomToFit();
  const baseZoom = editor.getZoomLevel();
  const bounds = editor.getSelectionPageBounds() || editor.getCurrentPageBounds();
  if (!bounds) return;

  const targetZoom = baseZoom * 0.8;
  const leftOffset = 116 / 2;
  const topOffset = 64 / 2;

  const xOffsetInPage = leftOffset / targetZoom;
  const yOffsetInPage = -topOffset / targetZoom;

  editor.zoomToBounds(bounds, {
    targetZoom,
    animation: { duration: animationDuration }
  });

  const camera = editor.getCamera();
  editor.setCamera({
    x: camera.x - xOffsetInPage,
    y: camera.y + yOffsetInPage,
    z: targetZoom
  }, { animation: { duration: animationDuration } });
}

export async function prepareSnapshotForSave(snapshot: TLEditorSnapshot, apiBase: string): Promise<TLEditorSnapshot> {
  if (!snapshot) return snapshot;

  const snapshotWithStore = snapshot as { store?: Record<string, TLRecord> };
  const store = snapshotWithStore.store || (snapshot as unknown as Record<string, TLRecord>);

  if (!store || typeof store !== 'object') return snapshot;

  const assetIds = Object.keys(store).filter(id => {
    const record = store[id] as { typeName?: string; type?: string; props?: { src?: string } } | undefined;
    return record?.typeName === 'asset' && record.type === 'image' && typeof record.props?.src === 'string' && record.props.src.startsWith('data:');
  });

  const annotationIds = Object.keys(store).filter(id => {
    const record = store[id] as { typeName?: string; type?: string; props?: { referenceImageUrl?: string } } | undefined;
    return record?.typeName === 'shape' && record.type === 'annotation' && typeof record.props?.referenceImageUrl === 'string' && record.props.referenceImageUrl.startsWith('data:');
  });

  if (assetIds.length === 0 && annotationIds.length === 0) return snapshot;

  const assetUploadPromises = assetIds.map(async (id) => {
    const asset = store[id] as { props: { src: string } };
    const path = await uploadImageBase64ToServer(apiBase, asset.props.src);
    if (path) {
      store[id] = { ...asset, props: { ...asset.props, src: path } } as unknown as TLRecord;
    }
  });

  const annotationUploadPromises = annotationIds.map(async (id) => {
    const shape = store[id] as unknown as { props: { referenceImageUrl: string } };
    const path = await uploadImageBase64ToServer(apiBase, shape.props.referenceImageUrl);
    if (path) {
      store[id] = { ...shape, props: { ...shape.props, referenceImageUrl: path } } as unknown as TLRecord;
    }
  });

  await Promise.all([...assetUploadPromises, ...annotationUploadPromises]);
  return snapshot;
}

export const TLDRAW_CUSTOM_STYLE_CSS = `
.tldraw-custom-container .tlui-layout__top__right {
    margin-top: 64px !important;
    pointer-events: none;
}
.tldraw-custom-container .tlui-layout__top__right > * {
    pointer-events: all;
}
.tldraw-custom-container .tl-grid {
    background-color: #f5f5f5 !important;
}
.tldraw-custom-container .tl-grid svg circle,
.tldraw-custom-container .tl-grid svg ellipse,
.tldraw-custom-container svg circle[fill],
.tldraw-custom-container svg ellipse[fill] {
    fill: #d3d3d3 !important;
}
.tldraw-custom-container .tl-grid pattern circle,
.tldraw-custom-container .tl-grid pattern ellipse,
.tldraw-custom-container pattern circle,
.tldraw-custom-container pattern ellipse {
    fill: #d3d3d3 !important;
}
.tldraw-custom-container canvas.tl-grid,
.tldraw-custom-container canvas[class*="grid"] {
    filter: brightness(1.5) contrast(0.8) !important;
}
.tldraw-custom-container [class*="tl-grid"] circle,
.tldraw-custom-container [class*="tl-grid"] ellipse,
.tldraw-custom-container [class*="grid"] circle,
.tldraw-custom-container [class*="grid"] ellipse {
    fill: #d3d3d3 !important;
}
.tldraw-custom-container .tl-background,
.tldraw-custom-container :not(button)[class*="background"] {
    background-color: #f5f5f5 !important;
}
.tlui-license__link,
.tl-watermark,
.tlui-watermark {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
    opacity: 0 !important;
}
`;
