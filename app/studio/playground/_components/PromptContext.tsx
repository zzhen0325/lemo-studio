"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AIModel } from "@studio/playground/_components/hooks/usePromptOptimization";
import { UploadedImage } from "@/lib/playground/types";

interface PromptContextType {
    prompt: string;
    setPrompt: (value: string) => void;
    uploadedImages: UploadedImage[];
    setUploadedImages: (images: UploadedImage[]) => void;
    selectedAIModel: AIModel;
    setSelectedAIModel: (model: AIModel) => void;
}

const PromptContext = createContext<PromptContextType | undefined>(undefined);

export function PromptProvider({ children }: { children: ReactNode }) {
    const [prompt, setPrompt] = useState("");
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    const [selectedAIModel, setSelectedAIModel] = useState<AIModel>("gemini");

    return (
        <PromptContext.Provider
            value={{
                prompt,
                setPrompt,
                uploadedImages,
                setUploadedImages,
                selectedAIModel,
                setSelectedAIModel,
            }}
        >
            {children}
        </PromptContext.Provider>
    );
}

export function usePrompt() {
    const context = useContext(PromptContext);
    if (context === undefined) {
        throw new Error("usePrompt must be used within a PromptProvider");
    }
    return context;
}
