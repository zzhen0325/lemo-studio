import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AuthDialog = ({ open, onOpenChange }: AuthDialogProps) => {
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const authError = useAuthStore((state) => state.error);
    const [activeTab, setActiveTab] = useState("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let success = false;
            if (activeTab === "login") {
                success = await login(username, password);
            } else {
                success = await register(username, password);
            }

            if (success) {
                onOpenChange(false);
                // Reset form
                setUsername("");
                setPassword("");
            } else {
                setError(authError || "Operation failed");
            }
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-bold bg-clip-text text-transparent bg-white">
                        LEMO STUDIO
                    </DialogTitle>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-neutral-800">
                        <TabsTrigger value="login" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white">Login</TabsTrigger>
                        <TabsTrigger value="register" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white">Register</TabsTrigger>
                    </TabsList>
                    
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="bg-neutral-800 border-neutral-700 focus:border-indigo-500 text-white"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-neutral-800 border-neutral-700 focus:border-indigo-500 text-white"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded">
                                {error}
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            className="w-full bg-white text-black hover:bg-primary font-medium py-2 rounded-md transition-all duration-200"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            {activeTab === "login" ? "Sign In" : "Create Account"}
                        </Button>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
