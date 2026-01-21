import { useState, useRef } from "react";
import { observer } from "mobx-react-lite";
import { userStore } from "@/lib/store/user-store";
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
import Image from "next/image";
import { useImageUpload } from "@/hooks/common/use-image-upload";
import { useImageSource } from "@/hooks/common/use-image-source";

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PRESET_AVATARS = [
    '/avatars/1.png',
    '/avatars/2.png',
    '/avatars/3.png',
    '/avatars/4.png',
    '/avatars/5.png',
];

const AvatarImage = ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) => {
    const source = useImageSource(src);
    return <Image src={source} alt={alt} width={width} height={height} className={className} />;
};

export const UserProfileDialog = observer(({ open, onOpenChange }: UserProfileDialogProps) => {
    const user = userStore.currentUser;
    const [name, setName] = useState(user?.name || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile } = useImageUpload();

    const handleSave = async () => {
        setLoading(true);
        const success = await userStore.updateProfile({ name, avatar });
        setLoading(false);
        if (success) {
            onOpenChange(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const uploaded = await uploadFile(file, {
            onSuccess: (url) => {
                setAvatar(url);
                setIsUploading(false);
            },
            onError: () => {
                setIsUploading(false);
            }
        });

        if (uploaded) {
            setAvatar(uploaded.path);
        }
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
                        
                        <div className="flex gap-2 justify-center flex-wrap">
                            {PRESET_AVATARS.map((src, i) => (
                                <button
                                    key={i}
                                    onClick={() => setAvatar(src)}
                                    className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-colors ${avatar === src ? 'border-indigo-500' : 'border-transparent hover:border-neutral-600'}`}
                                >
                                    <AvatarImage src={src} alt={`Preset ${i}`} width={32} height={32} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
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
});
