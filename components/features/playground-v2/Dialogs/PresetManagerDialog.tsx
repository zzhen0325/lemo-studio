import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Preset, PRESET_CATEGORIES } from '../types';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Plus, Trash2, Save, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

import { IViewComfy } from '@/lib/providers/view-comfy-provider';

interface PresetManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflows: IViewComfy[];
}

const NATIVE_MODELS = ['Nano banana', 'Seed 4.0', '3D Lemo seed3'];

const BASE_MODEL_LIST = [
    { name: 'FLUX_fill', cover: '/basemodels/FLUX_fill.jpg' },
    { name: 'flux1-dev-fp8.safetensors', cover: '/basemodels/flux1-dev-fp8.safetensors.jpg' },
    { name: 'Zimage', cover: '/basemodels/Zimage.jpg' },
    { name: 'qwen', cover: '/basemodels/qwen.jpg' },
];

export const PresetManagerDialog: React.FC<PresetManagerDialogProps> = ({ open, onOpenChange, workflows }) => {
    const presets = usePlaygroundStore(s => s.presets);
    const addPreset = usePlaygroundStore(s => s.addPreset);
    const removePreset = usePlaygroundStore(s => s.removePreset);
    const updatePreset = usePlaygroundStore(s => s.updatePreset);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Preset>>({
        title: '',
        prompt: '',
        base_model: 'Nano banana',
        cover: '',
        width: 1024,
        height: 1024,
        image_size: '1K',
        workflow_id: undefined,
        category: 'General'
    });
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    const resetForm = () => {
        setFormData({
            title: '',
            prompt: '',
            base_model: 'Nano banana',
            cover: '',
            width: 1024,
            height: 1024,
            image_size: '1K',
            workflow_id: undefined,
            category: 'General'
        });
        setCoverFile(null);
        setPreviewUrl('');
        setEditingId(null);
        setIsCreating(false);
    };

    const handleEdit = (preset: Preset) => {
        setFormData(preset);
        setPreviewUrl(preset.cover);
        setEditingId(preset.id);
        setIsCreating(false);
        setCoverFile(null);
    };

    const handleCreate = () => {
        resetForm();
        setIsCreating(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!formData.title || !formData.prompt) return;

        const presetToSave = {
            ...formData,
            id: editingId || '', // backend or store will handle ID if empty/new, but better to let backend handle it or store
            // We keep cover as is if not updating, or it will be updated by backend return
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[600px] flex flex-row p-0 gap-0 bg-zinc-900 border-zinc-800 text-white overflow-hidden rounded-2xl">

                {/* Left: Preset List */}
                <div className="w-1/3 border-r border-white/10 flex flex-col bg-black/20">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-medium">My Presets</h3>
                        <Button size="sm" variant="outline" className="h-8 bg-white/5 border-white/10 hover:bg-white/10" onClick={handleCreate}>
                            <Plus className="w-4 h-4 mr-1" /> New
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {presets.map(preset => (
                            <div
                                key={preset.id}
                                className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-colors ${editingId === preset.id ? 'bg-white/10 border-emerald-500/50 border' : 'hover:bg-white/5 border border-transparent'}`}
                                onClick={() => handleEdit(preset)}
                            >
                                <div className="w-10 h-10 rounded-lg bg-zinc-800 relative overflow-hidden flex-shrink-0">
                                    {preset.cover ? (
                                        <Image src={preset.cover} alt={preset.title} fill className="object-cover" />
                                    ) : (
                                        <ImageIcon className="w-4 h-4 m-auto text-white/20" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium truncate">{preset.title}</h4>
                                    <p className="text-xs text-white/40 truncate">
                                        <span className="text-emerald-500/70 mr-1">{preset.category || 'General'}</span>
                                        {preset.base_model}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-white/20 hover:text-red-400 hover:bg-white/5"
                                    onClick={(e) => handleDelete(preset.id, e)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}

                        {presets.length === 0 && (
                            <div className="text-center py-10 text-white/20 text-sm">
                                No presets found. Create one!
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Edit Form */}
                <div className="flex-1 flex flex-col bg-zinc-900/50">
                    {(editingId || isCreating) ? (
                        <>
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                                <DialogTitle>{editingId ? 'Edit Preset' : 'Create New Preset'}</DialogTitle>
                                <DialogDescription className="hidden">Edit your preset details</DialogDescription>
                                <Button size="sm" variant="ghost" onClick={resetForm}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-1">
                                        <Label>Preset Title</Label>
                                        <Input
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="bg-black/20 border-white/10 focus-visible:ring-emerald-500/50"
                                            placeholder="e.g. Dreamy Landscape"
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-1">
                                        <Label>Category</Label>
                                        <Select value={formData.category || 'General'} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                                            <SelectTrigger className="bg-black/20 border-white/10">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PRESET_CATEGORIES.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label>Cover Image</Label>
                                        <div className="flex gap-4 items-start">
                                            <div className="flex-1">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="bg-black/20 border-white/10 file:bg-white/10 file:text-white file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-4 hover:file:bg-white/20"
                                                />
                                                <p className="text-xs text-white/40 mt-1">Upload an image or paste a URL below</p>
                                                <Input
                                                    value={formData.cover}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, cover: e.target.value });
                                                        setPreviewUrl(e.target.value);
                                                    }}
                                                    className="bg-black/20 border-white/10 mt-2 text-xs"
                                                    placeholder="Or enter image URL..."
                                                />
                                            </div>
                                            {(previewUrl) && (
                                                <div className="w-24 h-24 rounded-lg overflow-hidden relative border border-white/10 bg-black/40 flex-shrink-0">
                                                    <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Base Model</Label>
                                        <Select value={formData.base_model} onValueChange={(val) => setFormData({ ...formData, base_model: val })}>
                                            <SelectTrigger className="bg-black/20 border-white/10">
                                                <SelectValue placeholder="Select model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Nano banana">Nano banana</SelectItem>
                                                <SelectItem value="Seed 4.0">Seed 4.0</SelectItem>
                                                <SelectItem value="3D Lemo seed3">3D Lemo seed3</SelectItem>
                                                <SelectItem value="Workflow">Workflow</SelectItem>
                                                {BASE_MODEL_LIST.map(model => (
                                                    <SelectItem key={model.name} value={model.name}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Image Size</Label>
                                        <Select value={formData.image_size || '1K'} onValueChange={(val: '1K' | '2K' | '4K') => setFormData({ ...formData, image_size: val })}>
                                            <SelectTrigger className="bg-black/20 border-white/10">
                                                <SelectValue placeholder="Select size" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1K">1K</SelectItem>
                                                <SelectItem value="2K">2K</SelectItem>
                                                <SelectItem value="4K">4K</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {!NATIVE_MODELS.includes(formData.base_model || '') && (
                                        <div className="space-y-2">
                                            <Label>Workflow</Label>
                                            <Select
                                                value={formData.workflow_id || 'default'}
                                                onValueChange={(val) => setFormData({ ...formData, workflow_id: val === 'default' ? undefined : val })}
                                            >
                                                <SelectTrigger className="bg-black/20 border-white/10">
                                                    <SelectValue placeholder="Select workflow (optional)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="default">Default Workflow</SelectItem>
                                                    {workflows.map(workflow => (
                                                        <SelectItem key={workflow.viewComfyJSON.id} value={workflow.viewComfyJSON.id}>
                                                            {workflow.viewComfyJSON.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2 col-span-2">
                                        <Label>Prompt (User Input)</Label>
                                        <Textarea
                                            value={formData.prompt}
                                            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                                            className="bg-black/20 border-white/10 focus-visible:ring-emerald-500/50 min-h-[120px]"
                                            placeholder="Enter the prompt text..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-white/10 flex justify-end gap-2 bg-black/20">
                                <Button variant="ghost" onClick={resetForm}>Cancel</Button>
                                <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
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

            </DialogContent>
        </Dialog>
    );
};
