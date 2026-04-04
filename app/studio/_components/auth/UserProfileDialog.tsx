import { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, User as UserIcon } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import { useImageUpload } from "@/hooks/common/use-image-upload";
import { formatImageUrl } from "@/lib/api-base";
import { useAuthStore } from "@/lib/store/auth-store";

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

const AvatarImage = ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) => {
    const source = formatImageUrl(src);
    if (!source) return null;
    return <Image loader={passthroughImageLoader} unoptimized src={source} alt={alt} width={width} height={height} className={className} />;
};

export const UserProfileDialog = ({ open, onOpenChange }: UserProfileDialogProps) => {
    const user = useAuthStore((state) => state.currentUser);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const [name, setName] = useState(user?.name || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile } = useImageUpload();

    useEffect(() => {
        if (!open) {
            return;
        }

        setName(user?.name || "");
        setAvatar(user?.avatar || "");
    }, [open, user?.avatar, user?.id, user?.name]);

    const handleSave = async () => {
        const trimmedName = name.trim();
        const updates: { name?: string; avatar?: string } = {};

        if (trimmedName && trimmedName !== (user?.name || "")) {
            updates.name = trimmedName;
        }
        if (avatar && avatar !== (user?.avatar || "")) {
            updates.avatar = avatar;
        }

        if (Object.keys(updates).length === 0) {
            onOpenChange(false);
            return;
        }

        setLoading(true);
        const success = await updateProfile(updates);
        setLoading(false);
        if (success) {
            onOpenChange(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        await uploadFile(file, {
            onSuccess: (id, path) => {
                setAvatar(path);
                setIsUploading(false);
            },
            onError: () => {
                setIsUploading(false);
            }
        });
    };

    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-neutral-800 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-neutral-700 group-hover:border-indigo-500 transition-colors">
                                {avatar ? (
                                    <AvatarImage src={avatar} alt="Avatar" width={96} height={96} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                                        <UserIcon className="w-10 h-10 text-neutral-500" />
                                    </div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Upload className="w-6 h-6 text-white" />
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFileChange}
                            />
                        </div>
                        <p className="text-xs text-neutral-400">Click to upload custom avatar</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nickname">Nickname</Label>
                        <Input
                            id="nickname"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-neutral-800 border-neutral-700 focus:border-indigo-500 text-white"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-neutral-800 text-neutral-300">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={loading || isUploading}
                        className="bg-white hover:bg-primary text-black"
                    >
                        {(loading || isUploading) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {isUploading ? 'Uploading...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
