import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Undo2,
    Redo2,
    Type,
    Move,
    Pencil,
    Square,
    Circle as CircleIcon,
    ArrowRight,
    RotateCcw,
    RotateCw,
    Check,
    Palette,
    Layers,
    SlidersHorizontal,
    LucideIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useImageEditor } from '@/hooks/features/PlaygroundV2/useImageEditor';
import { cn } from '@/lib/utils';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    onSave: (editedImageUrl: string) => void;
}

const COLORS = [
    '#40cf8f', // Theme Emerald
    '#ffffff',
    '#000000',
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316'  // Orange
];

export default function ImageEditorModal({ isOpen, onClose, imageUrl, onSave }: ImageEditorModalProps) {
    const {
        canvasRef,
        editorState,
        setTool,
        addText,
        addShape,
        undo,
        redo,
        rotateCanvas,
        applyFilter,
        exportImage,
        updateBrushColor,
        updateBrushWidth,
    } = useImageEditor(imageUrl);

    const handleSave = () => {
        const dataUrl = exportImage();
        if (dataUrl) {
            onSave(dataUrl);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/40 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <h2 className="text-white font-bold text-lg tracking-tight">Image Editor</h2>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white/60 hover:text-white"
                                onClick={undo}
                                disabled={!editorState.canUndo}
                            >
                                <Undo2 className="w-5 h-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white/60 hover:text-white"
                                onClick={redo}
                                disabled={!editorState.canRedo}
                            >
                                <Redo2 className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            className="text-white/60 hover:text-white hover:bg-white/5"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 gap-2"
                            onClick={handleSave}
                        >
                            <Check className="w-4 h-4" />
                            Apply Changes
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="relative flex-1 flex overflow-hidden">
                    {/* Left Toolbar */}
                    <div className="w-16 border-r border-white/10 flex flex-col items-center py-4 gap-4 bg-black/20">
                        <ToolButton
                            icon={Move}
                            active={editorState.activeTool === 'select'}
                            onClick={() => setTool('select')}
                            label="Select"
                        />
                        <ToolButton
                            icon={Pencil}
                            active={editorState.activeTool === 'brush'}
                            onClick={() => setTool('brush')}
                            label="Brush"
                        />
                        <ToolButton
                            icon={Type}
                            active={editorState.activeTool === 'text'}
                            onClick={() => addText()}
                            label="Text"
                        />

                        <div className="w-8 h-px bg-white/10 my-1" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                                    <Square className="w-6 h-6" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" className="bg-zinc-900 border-white/10 text-white p-2 min-w-[120px] rounded-2xl">
                                <DropdownMenuItem onClick={() => addShape('rect')} className="gap-2 rounded-xl focus:bg-white/10">
                                    <Square className="w-4 h-4" /> Rectangle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addShape('circle')} className="gap-2 rounded-xl focus:bg-white/10">
                                    <CircleIcon className="w-4 h-4" /> Circle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addShape('arrow')} className="gap-2 rounded-xl focus:bg-white/10">
                                    <ArrowRight className="w-4 h-4" /> Arrow
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-8 h-px bg-white/10 my-1" />

                        <ToolButton
                            icon={RotateCcw}
                            onClick={() => rotateCanvas(-90)}
                            label="Rotate Left"
                        />
                        <ToolButton
                            icon={RotateCw}
                            onClick={() => rotateCanvas(90)}
                            label="Rotate Right"
                        />

                        <div className="w-8 h-px bg-white/10 my-1" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                                    <SlidersHorizontal className="w-6 h-6" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" className="bg-zinc-900 border-white/10 text-white p-2 min-w-[150px] rounded-2xl">
                                <DropdownMenuItem onClick={() => applyFilter('grayscale')} className="rounded-xl focus:bg-white/10">Grayscale</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => applyFilter('sepia')} className="rounded-xl focus:bg-white/10">Sepia</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => applyFilter('invert')} className="rounded-xl focus:bg-white/10">Invert</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 bg-black flex items-center justify-center p-8 overflow-auto">
                        <div className="relative shadow-2xl rounded-sm border border-white/5 bg-zinc-900">
                            <canvas ref={canvasRef} />
                        </div>
                    </div>

                    {/* Right Properties Panel (Conditional) */}
                    {(editorState.activeTool === 'brush' || editorState.activeTool === 'text' || editorState.activeTool === 'rect' || editorState.activeTool === 'circle' || editorState.activeTool === 'arrow') && (
                        <motion.div
                            initial={{ x: 200, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="w-64 border-l border-white/10 bg-black/20 p-6 flex flex-col gap-8"
                        >
                            {/* Color Picker */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-white/40 font-bold text-[10px] uppercase tracking-widest">
                                    <Palette className="w-3 h-3" /> Color
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {COLORS.map(color => (
                                        <button
                                            key={color}
                                            className={cn(
                                                "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110",
                                                editorState.brushColor === color ? "border-white" : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                            onClick={() => updateBrushColor(color)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Brush Settings */}
                            {editorState.activeTool === 'brush' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-white/40 font-bold text-[10px] uppercase tracking-widest">
                                        <SlidersHorizontal className="w-3 h-3" /> Size
                                    </div>
                                    <Slider
                                        value={[editorState.brushWidth]}
                                        min={1}
                                        max={50}
                                        step={1}
                                        onValueChange={(val) => updateBrushWidth(val[0])}
                                        className="py-4"
                                    />
                                    <div className="text-white/60 text-xs text-right">{editorState.brushWidth}px</div>
                                </div>
                            )}

                            {/* History Info */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-white/40 font-bold text-[10px] uppercase tracking-widest">
                                    <Layers className="w-3 h-3" /> History
                                </div>
                                <div className="text-white/40 text-[10px] italic">
                                    Canvas history enabled. Use undo/redo to navigate changes.
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

interface ToolButtonProps {
    icon: LucideIcon;
    active?: boolean;
    onClick: () => void;
    label: string;
}

function ToolButton({ icon: Icon, active, onClick, label }: ToolButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "p-2 rounded-xl transition-all duration-200 group relative",
                active
                    ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    : "text-white/60 hover:text-white hover:bg-white/5"
            )}
            title={label}
        >
            <Icon className="w-6 h-6" />
            {!active && (
                <span className="absolute left-14 bg-zinc-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity">
                    {label}
                </span>
            )}
        </button>
    );
}
