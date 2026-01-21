import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Preset, GenerationConfig, EditPresetConfig } from '../types';
import { AspectRatio } from '@/types/database';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Plus, Trash2, Save, X, Image as ImageIcon, LayoutTemplate, GripVertical } from 'lucide-react';
import NextImage from 'next/image';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { AVAILABLE_MODELS } from '@/hooks/features/PlaygroundV2/useGenerationService';
import { useImageUpload } from "@/hooks/common/use-image-upload";
import { useImageSource } from "@/hooks/common/use-image-source";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PresetManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflows: IViewComfy[];
    currentConfig?: GenerationConfig;
    currentEditConfig?: EditPresetConfig;
}

const DEFAULT_CONFIG: GenerationConfig = {
    prompt: '',
    model: 'gemini-3-pro-image-preview',
    width: 1024,
    height: 1024,
    imageSize: '1K',
    aspectRatio: '1:1'
};

// Sortable Category Item Component
interface SortableCategoryItemProps {
    id: string;
    cat: string;
    isActive: boolean;
    isRenaming: boolean;
    renamingValue: string;
    onSelect: () => void;
    onDoubleClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onRenameChange: (value: string) => void;
    onRenameSubmit: () => void;
    onRenameCancel: () => void;
}

const SortableCategoryItem: React.FC<SortableCategoryItemProps> = ({
    id, cat, isActive, isRenaming, renamingValue,
    onSelect, onDoubleClick, onDelete, onRenameChange, onRenameSubmit, onRenameCancel
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    if (isRenaming) {
        return (
            <div ref={setNodeRef} style={style} className="shrink-0">
                <Input
                    autoFocus
                    value={renamingValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onBlur={onRenameSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onRenameSubmit();
                        if (e.key === 'Escape') onRenameCancel();
                    }}
                    className="h-7 px-2 bg-white/10 border-emerald-500/50 min-w-[80px] text-xs"
                />
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="relative group/cat shrink-0 flex items-center">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/50">
                <GripVertical className="w-3 h-3" />
            </div>
            <button
                onClick={onSelect}
                onDoubleClick={onDoubleClick}
                className={cn(
                    "px-2 py-1.5 rounded-lg text-xs font-medium transition-all pr-6 relative",
                    isActive
                        ? "bg-white/20 text-white"
                        : "text-white/40 hover:text-white hover:bg-white/10"
                )}
            >
                {cat}
                <X
                    className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cat:opacity-40 hover:!opacity-100 hover:text-red-400 transition-all cursor-pointer"
                    onClick={onDelete}
                />
            </button>
        </div>
    );
};

const PresetImage = ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => {
    const source = useImageSource(src);
    return <NextImage src={source} alt={alt} fill={fill} className={className} />;
};

export const PresetManagerDialog: React.FC<PresetManagerDialogProps> = ({ open, onOpenChange, workflows, currentConfig, currentEditConfig }) => {
    const presets = usePlaygroundStore(s => s.presets);
    const presetCategories = usePlaygroundStore(s => s.presetCategories);
    const renameCategory = usePlaygroundStore(s => s.renameCategory);
    const saveCategories = usePlaygroundStore(s => s.saveCategories);
    const addPreset = usePlaygroundStore(s => s.addPreset);
    const removePreset = usePlaygroundStore(s => s.removePreset);
    const updatePreset = usePlaygroundStore(s => s.updatePreset);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [activeManagerCategory, setActiveManagerCategory] = useState('All');

    // Category editing state
    const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryValue, setNewCategoryValue] = useState('');

    const filteredPresets = presets.filter(p => {
        const matchesCategory = activeManagerCategory === 'All' || (p.category || 'General') === activeManagerCategory;
        return matchesCategory;
    });

    // Unified Preset state
    const [formData, setFormData] = useState<Partial<Preset>>({
        name: '',
        coverUrl: '',
        category: 'General',
        config: DEFAULT_CONFIG
    });
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const { uploadFile } = useImageUpload();

    const resetForm = () => {
        // Use current category if not "All", otherwise default to "General"
        const categoryToUse = activeManagerCategory !== 'All' ? activeManagerCategory : 'General';
        setFormData({
            name: '',
            coverUrl: '',
            category: categoryToUse,
            config: DEFAULT_CONFIG
        });
        setCoverFile(null);
        setPreviewUrl('');
        setEditingId(null);
        setIsCreating(false);
    };

    const handleEdit = (preset: Preset) => {
        setFormData(preset);
        setPreviewUrl(preset.coverUrl);
        setEditingId(preset.id);
        setIsCreating(false);
        setCoverFile(null);
    };

    const handleCreate = React.useCallback(() => {
        // Use current category if not "All", otherwise default to "General"
        const categoryToUse = activeManagerCategory !== 'All' ? activeManagerCategory : 'General';
        const initialCoverUrl = currentEditConfig?.originalImageUrl || '';

        setFormData({
            name: '',
            coverUrl: initialCoverUrl,
            category: categoryToUse,
            config: currentConfig || DEFAULT_CONFIG,
            editConfig: currentEditConfig
        });
        setCoverFile(null);
        setPreviewUrl(initialCoverUrl);
        setEditingId(null);
        setIsCreating(true);
    }, [activeManagerCategory, currentConfig, currentEditConfig]);

    // Auto-open create mode if currentEditConfig is provided
    React.useEffect(() => {
        if (open && currentEditConfig) {
            handleCreate();
        }
    }, [open, currentEditConfig, handleCreate]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCoverFile(file); // Keep file for fallback upload if backend needs it

        const uploaded = await uploadFile(file, {
            onSuccess: (url) => {
                setFormData(prev => ({ ...prev, coverUrl: url }));
                setPreviewUrl(url);
            }
        });

        if (uploaded) {
            setFormData(prev => ({ ...prev, coverUrl: uploaded.path }));
            setPreviewUrl(uploaded.path);
        }
    };

    const isEditPreset = !!(formData.editConfig || currentEditConfig && isCreating);

    const handleSave = async () => {
        const isActuallyEdit = !!formData.editConfig && Object.keys(formData.editConfig).length > 0;
        if (!formData.name) return;
        if (!isActuallyEdit && !formData.config?.prompt) return;

        const presetToSave = {
            ...formData,
            type: isActuallyEdit ? 'edit' : 'generation',
            editConfig: isActuallyEdit ? formData.editConfig : undefined,
            id: editingId || `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
        } as Preset;

        if (editingId) {
            await updatePreset(presetToSave, coverFile || undefined);
        } else {
            await addPreset(presetToSave, coverFile || undefined);
        }
        resetForm();
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this preset?')) {
            removePreset(id);
            if (editingId === id) resetForm();
        }
    };

    // --- Category CRUD Handlers ---
    const handleCategoryRenameSubmit = () => {
        if (renamingValue && renamingCategory && renamingValue !== renamingCategory) {
            renameCategory(renamingCategory, renamingValue);
            if (activeManagerCategory === renamingCategory) setActiveManagerCategory(renamingValue);
        }
        setRenamingCategory(null);
        setRenamingValue('');
    };

    const handleAddCategorySubmit = () => {
        const trimmed = newCategoryValue.trim();
        if (trimmed && !presetCategories.includes(trimmed)) {
            saveCategories([...presetCategories, trimmed]);
        }
        setIsAddingCategory(false);
        setNewCategoryValue('');
    };

    const handleDeleteCategory = (cat: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete category "${cat}"? Presets in this category will be moved to "General".`)) {
            const newCats = presetCategories.filter(c => c !== cat);
            saveCategories(newCats);
            if (activeManagerCategory === cat) setActiveManagerCategory('All');
            presets.filter(p => p.category === cat).forEach(p => {
                updatePreset({ ...p, category: 'General' });
            });
        }
    };

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = presetCategories.indexOf(active.id as string);
            const newIndex = presetCategories.indexOf(over.id as string);
            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(presetCategories, oldIndex, newIndex);
                saveCategories(newOrder);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange} >
            <DialogContent className="max-w-6xl h-[800px] flex flex-col p-0 gap-0 bg-zinc-950/95 backdrop-blur-2xl border-white/5 text-white overflow-hidden rounded-3xl z-[10000]">
                <DialogDescription className="hidden">
                    Manage your presets, including creating, editing, and organizing them into categories.
                </DialogDescription>
                {/* Top: Categories Navigation */}
                <div className="flex flex-col border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
                    <div className="px-6 py-4 flex items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                                <LayoutTemplate className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Preset Manager</h3>
                        </div>
                    </div>

                    <ScrollArea className="w-full">
                        <div className="flex gap-1 px-6 pb-4 pt-1 items-center">
                            {/* Fixed "All" tab */}
                            <button
                                onClick={() => setActiveManagerCategory('All')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                                    activeManagerCategory === 'All'
                                        ? "bg-white/20 text-white"
                                        : "text-white/40 hover:text-white hover:bg-white/10"
                                )}
                            >
                                All
                            </button>

                            <div className="w-px h-4 bg-white/10 mx-1" />

                            {/* Sortable categories */}
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={presetCategories} strategy={horizontalListSortingStrategy}>
                                    {presetCategories.map(cat => (
                                        <SortableCategoryItem
                                            key={cat}
                                            id={cat}
                                            cat={cat}
                                            isActive={activeManagerCategory === cat}
                                            isRenaming={renamingCategory === cat}
                                            renamingValue={renamingValue}
                                            onSelect={() => setActiveManagerCategory(cat)}
                                            onDoubleClick={() => {
                                                setRenamingCategory(cat);
                                                setRenamingValue(cat);
                                            }}
                                            onDelete={(e) => handleDeleteCategory(cat, e)}
                                            onRenameChange={setRenamingValue}
                                            onRenameSubmit={handleCategoryRenameSubmit}
                                            onRenameCancel={() => { setRenamingCategory(null); setRenamingValue(''); }}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>

                            {isAddingCategory ? (
                                <Input
                                    autoFocus
                                    value={newCategoryValue}
                                    onChange={(e) => setNewCategoryValue(e.target.value)}
                                    onBlur={handleAddCategorySubmit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddCategorySubmit();
                                        if (e.key === 'Escape') { setIsAddingCategory(false); setNewCategoryValue(''); }
                                    }}
                                    className="h-7 px-2 bg-white/10 border-emerald-500/50 min-w-[80px] text-xs shrink-0"
                                    placeholder="New..."
                                />
                            ) : (
                                <button
                                    onClick={() => setIsAddingCategory(true)}
                                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-white/30 hover:text-white hover:bg-white/10 shrink-0 border border-dashed border-white/10"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Bottom: Sidebar + Content */}
                <div className="flex-1 flex flex-row overflow-hidden">
                    {/* Left: Preset List */}
                    <div className="w-[380px] border-r border-white/10 flex flex-col bg-black/40">
                        <div className="p-4 border-b border-white/5">
                            <p className="text-xs text-white/40">
                                {activeManagerCategory === 'All' ? 'All Presets' : `Category: ${activeManagerCategory}`}
                                <span className="ml-2 text-white/20">({filteredPresets.length})</span>
                            </p>
                        </div>

                        <ScrollArea className="flex-1 px-3 pb-4">
                            <div className="space-y-2">
                                {filteredPresets.map((preset, index) => (
                                    <div
                                        key={`${preset.id}-${index}`}
                                        className={cn(
                                            "group p-3 rounded-2xl cursor-pointer flex items-center gap-3 transition-all border",
                                            editingId === preset.id
                                                ? 'bg-emerald-500/10 border-emerald-500/50'
                                                : 'hover:bg-white/5 border-transparent'
                                        )}
                                        onClick={() => handleEdit(preset)}
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-white/5 relative overflow-hidden flex-shrink-0 border border-white/10">
                                            {preset.coverUrl ? (
                                                <PresetImage src={preset.coverUrl} alt={preset.name} fill className="object-cover" />
                                            ) : (
                                                <ImageIcon className="w-5 h-5 m-auto text-white/20" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-semibold truncate text-white/90">{preset.name}</h4>
                                                {preset.editConfig && (
                                                    <Badge className="h-4 px-1 text-[9px] bg-blue-500/20 text-blue-400 border-blue-500/20">
                                                        Edit
                                                    </Badge>
                                                )}
                                                {preset.category && (
                                                    <Badge variant="outline" className="h-4 px-1 text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                        {preset.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-white/40 truncate mt-0.5">
                                                {preset.config?.model}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                            onClick={(e) => handleDelete(preset.id, e)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}

                                {filteredPresets.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-white/20 space-y-2">
                                        <LayoutTemplate className="w-8 h-8 opacity-20" />
                                        <p className="text-sm">No presets in this category</p>
                                        <Button variant="outline" size="sm" className="mt-2 text-xs bg-white/5 border-white/10" onClick={handleCreate}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Preset
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Edit Form */}
                    <div className="flex-1 flex flex-col bg-zinc-900/50">
                        {(editingId || isCreating) ? (
                            <>
                                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-sm">
                                    <DialogTitle className="text-base font-bold">
                                        {editingId ? 'Edit Preset' : 'Create New Preset'}
                                    </DialogTitle>
                                    <Button size="sm" variant="ghost" onClick={resetForm} className="h-8 w-8 p-0 hover:bg-white/10 rounded-lg">
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                                            <div className="space-y-2.5 col-span-2">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-white/50 ml-1">Preset Details</Label>
                                                <div className="space-y-2">
                                                    <Label className="text-sm">Name</Label>
                                                    <Input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="bg-white/5 border-white/10 focus-visible:ring-emerald-500/50 h-10 rounded-xl"
                                                        placeholder="Enter preset name..."
                                                    />
                                                </div>
                                            </div>

                                            {!isEditPreset && (
                                                <div className="space-y-4 col-span-2">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-sm">Category</Label>
                                                            <Select
                                                                value={formData.category || 'General'}
                                                                onValueChange={(val) => setFormData({ ...formData, category: val })}
                                                            >
                                                                <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl">
                                                                    <SelectValue placeholder="Select category" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl z-[10010]">
                                                                    {presetCategories.map(cat => (
                                                                        <SelectItem key={cat} value={cat} className="hover:bg-emerald-500/20 focus:bg-emerald-500/20">{cat}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-sm">Base Model</Label>
                                                            <Select
                                                                value={formData.config?.model}
                                                                onValueChange={(val) => setFormData({
                                                                    ...formData,
                                                                    config: { ...(formData.config || DEFAULT_CONFIG), model: val }
                                                                })}
                                                            >
                                                                <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl">
                                                                    <SelectValue placeholder="Select model" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl z-[10010]">
                                                                    {AVAILABLE_MODELS.map(m => (
                                                                        <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                                                                    ))}
                                                                    <SelectItem value="Workflow">Workflow</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {isEditPreset && (
                                                <div className="space-y-4 col-span-2">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">Category</Label>
                                                        <Select
                                                            value={formData.category || 'General'}
                                                            onValueChange={(val) => setFormData({ ...formData, category: val })}
                                                        >
                                                            <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl">
                                                                <SelectValue placeholder="Select category" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl z-[10010]">
                                                                {presetCategories.map(cat => (
                                                                    <SelectItem key={cat} value={cat} className="hover:bg-emerald-500/20 focus:bg-emerald-500/20">{cat}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2 col-span-2 border-t border-white/5 pt-6 mt-2">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-white/50 ml-1">Visual Branding</Label>
                                                <div className="flex gap-6 items-center mt-2">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="space-y-2 text-sm">
                                                            <Label>Upload Cover</Label>
                                                            <Input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handleFileChange}
                                                                className="bg-white/5 border-white/10 file:bg-white/10 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:mr-4 hover:file:bg-white/20 h-10 cursor-pointer rounded-xl"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-sm">Or use Image URL</Label>
                                                            <Input
                                                                value={formData.coverUrl}
                                                                onChange={(e) => {
                                                                    setFormData({ ...formData, coverUrl: e.target.value });
                                                                    setPreviewUrl(e.target.value);
                                                                }}
                                                                className="bg-white/5 border-white/10 text-xs h-10 rounded-xl"
                                                                placeholder="Paste image URL here..."
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="w-32 h-32 rounded-2xl overflow-hidden relative border border-white/10 bg-white/5 flex-shrink-0 shadow-2xl">
                                                        {previewUrl ? (
                                                            <NextImage src={previewUrl} alt="Preview" fill className="object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <ImageIcon className="w-8 h-8 text-white/10" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {!isEditPreset && (
                                                <>
                                                    <div className="space-y-2 col-span-2 border-t border-white/5 pt-6">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-white/50 ml-1">Generation Config</Label>
                                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                                            <div className="space-y-2">
                                                                <Label className="text-sm">Target Image Size</Label>
                                                                <Select
                                                                    value={formData.config?.imageSize || '1K'}
                                                                    onValueChange={(val: '1K' | '2K' | '4K') => setFormData({
                                                                        ...formData,
                                                                        config: { ...(formData.config || DEFAULT_CONFIG), imageSize: val }
                                                                    })}
                                                                >
                                                                    <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl">
                                                                        <SelectValue placeholder="Select size" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl z-[10010]">
                                                                        <SelectItem value="1K">1K (Standard)</SelectItem>
                                                                        <SelectItem value="2K">2K (High Def)</SelectItem>
                                                                        <SelectItem value="4K">4K (Ultra High)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label className="text-sm">Aspect Ratio</Label>
                                                                <Select
                                                                    value={formData.config?.aspectRatio || '1:1'}
                                                                    onValueChange={(val: string) => setFormData({
                                                                        ...formData,
                                                                        config: { ...(formData.config || DEFAULT_CONFIG), aspectRatio: val as AspectRatio }
                                                                    })}
                                                                >
                                                                    <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl">
                                                                        <SelectValue placeholder="Select ratio" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl z-[10010]">
                                                                        {['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'].map(ratio => (
                                                                            <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            {!AVAILABLE_MODELS.some(m => m.id === (formData.config?.model || '')) && (
                                                                <div className="space-y-2">
                                                                    <Label className="text-sm">Linked Workflow</Label>
                                                                    <Select
                                                                        value={formData.config?.workflowName || 'default'}
                                                                        onValueChange={(val) => setFormData({
                                                                            ...formData,
                                                                            config: { ...(formData.config || DEFAULT_CONFIG), workflowName: val === 'default' ? undefined : val }
                                                                        })}
                                                                    >
                                                                        <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl">
                                                                            <SelectValue placeholder="Select workflow" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl z-[10010]">
                                                                            <SelectItem value="default">System Default</SelectItem>
                                                                            {workflows.map(workflow => (
                                                                                <SelectItem key={workflow.viewComfyJSON.id} value={workflow.viewComfyJSON.id}>
                                                                                    {workflow.viewComfyJSON.title}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-8 mt-4">
                                                            <div className="flex items-center space-x-2">
                                                                <Switch
                                                                    id="disable-model"
                                                                    checked={formData.disableModelSelection || false}
                                                                    onCheckedChange={(checked) => setFormData({ ...formData, disableModelSelection: checked })}
                                                                />
                                                                <Label htmlFor="disable-model" className="text-sm font-normal text-white/70">Disable Model Selection</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <Switch
                                                                    id="disable-upload"
                                                                    checked={formData.disableImageUpload || false}
                                                                    onCheckedChange={(checked) => setFormData({ ...formData, disableImageUpload: checked })}
                                                                />
                                                                <Label htmlFor="disable-upload" className="text-sm font-normal text-white/70">Disable Image Upload</Label>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 col-span-2">
                                                        <Label className="text-sm">Base Prompt</Label>
                                                        <Textarea
                                                            value={formData.config?.prompt}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                config: { ...(formData.config || DEFAULT_CONFIG), prompt: e.target.value }
                                                            })}
                                                            className="bg-white/5 border-white/10 focus-visible:ring-emerald-500/50 min-h-[140px] rounded-2xl p-4 resize-none leading-relaxed"
                                                            placeholder="Craft the magic here..."
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {isEditPreset && (
                                                <div className="space-y-4 col-span-2 border-t border-white/5 pt-6">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-white/50 ml-1">Editor State Summary</Label>
                                                    <div className="grid grid-cols-1 gap-4 mt-2">
                                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                                            <div className="flex gap-4">
                                                                <div className="space-y-2 flex-1">
                                                                    <span className="text-xs text-white/40">Original Image</span>
                                                                    <div className="aspect-video rounded-xl border border-white/10 overflow-hidden relative bg-black/40">
                                                                        <PresetImage
                                                                            src={(formData.editConfig || currentEditConfig)?.originalImageUrl || ''}
                                                                            alt="Original"
                                                                            fill
                                                                            className="object-contain"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="w-1/3 space-y-4">
                                                                    <div className="flex justify-between items-center text-sm">
                                                                        <span className="text-white/40">Annotations</span>
                                                                        <span className="font-mono text-emerald-400">{(formData.editConfig || currentEditConfig)?.annotations.length || 0} items</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-sm">
                                                                        <span className="text-white/40">Canvas Size</span>
                                                                        <span className="font-mono text-white/60">
                                                                            {(formData.editConfig || currentEditConfig)?.canvasSize.width}x{(formData.editConfig || currentEditConfig)?.canvasSize.height}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <span className="text-xs text-white/40">Reference Images</span>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {(formData.editConfig || currentEditConfig)?.referenceImages.map((img) => (
                                                                        <div key={img.id} className="w-12 h-12 rounded-lg border border-white/10 overflow-hidden relative group/img">
                                                                            <PresetImage src={img.dataUrl} alt={img.label} fill className="object-cover" />
                                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                                                <span className="text-[8px] text-white truncate px-1">{img.label}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {!(formData.editConfig || currentEditConfig)?.referenceImages.length && (
                                                                        <span className="text-xs text-white/20 italic">No reference images</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5 backdrop-blur-sm">
                                    <Button variant="ghost" onClick={resetForm} className="rounded-xl px-6 hover:bg-white/10">Cancel</Button>
                                    <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl px-8 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Preset
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                                <p className="mb-4">Select a preset to edit or create a new one</p>
                                <Button variant="outline" className="bg-white/5 border-white/10" onClick={handleCreate}>
                                    Create New Preset
                                </Button>
                            </div>
                        )}
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};
