import React, { useEffect, useRef, useState } from 'react';
import { AssetRecordType, Editor, exportAs, TLShapeId } from 'tldraw';
import { Crop, Download, Image as ImageIcon, MessageSquarePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiBase } from '@/lib/api-base';

export interface TldrawAnnotationItem {
  id: string;
  type: 'text' | 'note' | 'geo';
  text: string;
  description: string;
  referenceImageUrl: string;
  color: string;
  label: string;
  displayName?: string;
}

interface ToolbarComponentProps {
  editor: Editor | null;
  imageScreenBounds: { left: number; top: number; width: number; height: number; bottom: number; centerX: number } | null;
  annotations: TldrawAnnotationItem[];
  imageId: TLShapeId;
  isVisible: boolean;
}

export const ToolbarComponent = ({
  editor,
  imageScreenBounds,
  annotations,
  imageId,
  isVisible,
}: ToolbarComponentProps) => {
  const [currentToolId, setCurrentToolId] = useState(editor?.getCurrentToolId() || 'select');

  useEffect(() => {
    if (!editor) return;
    const unsubscribe = editor.store.listen(() => {
      setCurrentToolId(editor.getCurrentToolId());
    }, { scope: 'session', source: 'user' });
    return () => {
      unsubscribe();
    };
  }, [editor]);

  if (!imageScreenBounds || !editor || !isVisible) return null;

  const handleUploadMedia = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;

        const assetId = AssetRecordType.createId();
        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        fetch(`${getApiBase()}/save-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl, ext: 'png', subdir: 'uploads' }),
        }).then(resp => resp.json()).then((json: { path?: string }) => {
          if (json?.path) {
            editor.updateAssets([{
              id: assetId,
              typeName: 'asset',
              type: 'image',
              props: { src: json.path },
            } as unknown as import('tldraw').TLAsset]);
          }
        }).catch(err => console.error('[handleUploadMedia] Instant upload failed:', err));

        editor.createAssets([{
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: file.name,
            src: dataUrl,
            w: img.width,
            h: img.height,
            mimeType: file.type,
            isAnimated: false,
          },
          meta: {},
        }]);
        editor.createShapes([{
          type: 'image',
          x: 0,
          y: 0,
          props: { assetId, w: img.width, h: img.height },
        }]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleCrop = () => {
    editor.select(imageId);
    editor.setCurrentTool('crop');
  };

  const handleDownload = async () => {
    await exportAs(editor, [imageId], { format: 'png', name: 'tldraw-export' } as Parameters<typeof exportAs>[2]);
  };

  return (
    <div className="absolute z-[100] pointer-events-none" style={{ left: imageScreenBounds.centerX, top: imageScreenBounds.top - 64, transform: 'translateX(-50%)' }}>
      <div className="flex items-center gap-1.5 bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 p-1.5 pointer-events-auto">
        <div className="flex items-center gap-0.5 px-1 border-r border-gray-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUploadMedia}
            className="h-9 w-9 rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCrop}
            className="h-9 w-9 rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
          >
            <Crop className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-9 w-9 rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 pl-1">
          <Button
            size="sm"
            variant={currentToolId === 'annotation' ? 'default' : 'ghost'}
            onClick={() => {
              editor.select(imageId);
              editor.setCurrentTool('annotation');
            }}
            className={`h-9 px-3 rounded-xl font-medium transition-all ${currentToolId === 'annotation' && editor.getSelectedShapeIds().includes(imageId)
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-200'
              : 'text-gray-600 hover:text-black hover:bg-gray-50'
              }`}
          >
            <MessageSquarePlus className="w-4 h-4 mr-1.5" />
            标注
          </Button>
          {annotations.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{annotations.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AnnotationRowProps {
  ann: TldrawAnnotationItem;
  editor: Editor | null;
  deleteAnnotation: (id: string) => void;
}

export const AnnotationRow = ({ ann, editor, deleteAnnotation }: AnnotationRowProps) => {
  const [localValue, setLocalValue] = useState(ann.description);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(ann.displayName || '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(ann.description);
  }, [ann.description]);

  useEffect(() => {
    setLocalDisplayName(ann.displayName || '');
  }, [ann.displayName]);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        editor.updateShape({
          id: ann.id as TLShapeId,
          type: 'annotation',
          props: { referenceImageUrl: dataUrl },
        } as unknown as import('tldraw').TLShape);

        try {
          const resp = await fetch(`${getApiBase()}/save-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: dataUrl, ext: 'png', subdir: 'uploads' }),
          });
          const json = await resp.json() as { path?: string };
          if (json?.path) {
            editor.updateShape({
              id: ann.id as TLShapeId,
              type: 'annotation',
              props: { referenceImageUrl: json.path },
            } as unknown as import('tldraw').TLShape);
          }
        } catch (err) {
          console.error('[AnnotationRow] Instant upload failed:', err);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (editor && localDisplayName !== ann.displayName) {
      editor.updateShape({
        id: ann.id as TLShapeId,
        type: 'annotation',
        props: { displayName: localDisplayName },
      } as unknown as import('tldraw').TLShape);
    }
  };

  return (
    <div key={ann.id} className="group flex flex-col gap-1.5 bg-gray-50/80 hover:bg-white transition-all rounded-xl p-1.5 border border-gray-100 hover:border-red-200 w-full relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0 pr-6" onDoubleClick={() => setIsEditingName(true)}>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              autoFocus
              className="text-[10px] font-bold text-gray-900 bg-white border border-red-200 rounded px-1 w-full outline-none ring-2 ring-red-100/50"
              value={localDisplayName}
              onChange={(e) => setLocalDisplayName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
            />
          ) : (
            <>
              <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight truncate max-w-[80px]">
                {ann.displayName || ann.label}
              </span>
              {ann.displayName && (
                <span className="text-[9px] text-gray-400 font-medium truncate shrink ml-1 opacity-70">
                  ({ann.label})
                </span>
              )}
              <span className="text-[9px] text-gray-300 font-medium truncate shrink ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                (双击重命名)
              </span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-300 transition-colors"
          onClick={() => deleteAnnotation(ann.id)}
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      </div>

      <div className="flex gap-1.5 w-full">
        <div
          className="relative w-6 h-6 rounded-md overflow-hidden bg-white border border-gray-200 group/img cursor-pointer flex items-center justify-center shadow-sm shrink-0"
          onClick={handleUpload}
        >
          {ann.referenceImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ann.referenceImageUrl} alt="Reference" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-2.5 h-2.5 text-white" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
              <ImageIcon className="w-2.5 h-2.5" />
            </div>
          )}
        </div>

        <input
          className="bg-transparent border-none p-0 text-[10px] text-gray-900 focus:outline-none placeholder:text-gray-400 flex-1 min-w-0"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => {
            if (editor && localValue !== ann.description) {
              editor.updateShape({
                id: ann.id as TLShapeId,
                type: 'annotation',
                props: { content: localValue },
              } as unknown as import('tldraw').TLShape);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && editor) {
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="说明..."
        />
      </div>
    </div>
  );
};
