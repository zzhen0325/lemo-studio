import { create } from 'zustand';
import {
    APIConfigSettings,
    APIProviderConfig,
    ModelContext,
    ModelTask,
    ServiceConfig,
    ServiceType
} from '../api-config/types';
import { getApiBase } from "../api-base";
import { mergeBuiltinProviders } from '@/lib/api-config/builtins';
import { getModelById, normalizeProviderConfigs, selectModelsForContext } from '@/lib/model-center';
import {
    buildDefaultsFromServices,
    DEFAULT_API_CONFIG_SETTINGS,
    EMPTY_SERVICE_BINDING,
    migrateProviderModelIds,
    normalizeApiConfigSettings,
} from '@/lib/api-config/core';

interface APIConfigState {
    providers: APIProviderConfig[];
    settings: APIConfigSettings;
    isLoading: boolean;
    error: string | null;
    fetchConfig: (force?: boolean) => Promise<void>;
    addProvider: (provider: Partial<APIProviderConfig>) => Promise<void>;
    updateProvider: (id: string, updates: Partial<APIProviderConfig>) => Promise<void>;
    removeProvider: (id: string) => Promise<void>;
    updateSettings: (settings: Partial<APIConfigSettings>) => Promise<void>;
    updateServiceConfig: (service: ServiceType, config: Partial<ServiceConfig>) => Promise<void>;
    importProvidersFromFile: () => Promise<void>;
    ensureBuiltinProviders: () => void;
    getEnabledProviders: () => APIProviderConfig[];
    getProviderById: (id: string) => APIProviderConfig | undefined;
    getModelsForTask: (task: 'text' | 'vision' | 'image') => { providerId: string; providerName: string; modelId: string; displayName: string }[];
    getModelsForContext: (context: ModelContext, requiredTask?: ModelTask) => { providerId: string; providerName: string; modelId: string; displayName: string }[];
    getModelEntryById: (modelId: string) => ReturnType<typeof getModelById> | undefined;
    getServiceConfig: (service: ServiceType) => ServiceConfig | undefined;
    _configLoading: boolean;
    _configLoaded: boolean;
}

function normalizeProvidersWithBuiltins(providers: APIProviderConfig[]): APIProviderConfig[] {
    return normalizeProviderConfigs(migrateProviderModelIds(mergeBuiltinProviders(providers)));
}

export const useAPIConfigStore = create<APIConfigState>((set, get) => ({
    providers: normalizeProvidersWithBuiltins([]),
    settings: DEFAULT_API_CONFIG_SETTINGS,
    isLoading: false,
    error: null,
    _configLoading: false,
    _configLoaded: false,

    fetchConfig: async (force = false) => {
        const state = get();
        if (state._configLoading || (state._configLoaded && !force)) return;
        set({ isLoading: true, error: null, _configLoading: true });
        try {
            const response = await fetch(`${getApiBase()}/api-config`);
            if (!response.ok) throw new Error('Failed to fetch config');
            const data = await response.json();
            const mergedSettings = normalizeApiConfigSettings((data.settings || {}) as Record<string, unknown>);

            set({
                providers: normalizeProvidersWithBuiltins(data.providers || []),
                settings: mergedSettings,
                isLoading: false,
                _configLoaded: true,
                _configLoading: false
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false, _configLoading: false });
        }
    },

    addProvider: async (provider) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(provider)
            });
            if (!response.ok) throw new Error('Failed to add provider');
            const data = await response.json();
            set({ providers: normalizeProvidersWithBuiltins(data.providers || []), isLoading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    updateProvider: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates })
            });
            if (!response.ok) throw new Error('Failed to update provider');
            const data = await response.json();
            set({ providers: normalizeProvidersWithBuiltins(data.providers || []), isLoading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    removeProvider: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config?id=${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete provider');
            set(state => ({
                providers: state.providers.filter(p => p.id !== id),
                isLoading: false
            }));
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    updateSettings: async (settingsUpdates) => {
        const currentSettings = get().settings;
        const newSettings = normalizeApiConfigSettings({ ...currentSettings, ...settingsUpdates } as Record<string, unknown>);
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSettings', settings: newSettings })
            });
            if (!response.ok) throw new Error('Failed to update settings');
            set({ settings: newSettings, isLoading: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    updateServiceConfig: async (service, configUpdates) => {
        const currentSettings = get().settings;
        const currentServiceConfig = currentSettings.services[service] || { binding: EMPTY_SERVICE_BINDING };
        const newServiceConfig = { ...currentServiceConfig, ...configUpdates };
        const currentDefaults = currentSettings.defaults || buildDefaultsFromServices(currentSettings.services);
        const nextDefaults = {
            ...currentDefaults,
            text: { ...currentDefaults.text },
            image: { ...currentDefaults.image },
        };

        if (configUpdates.binding) {
            if (service === 'optimize') {
                nextDefaults.text.textToText = { ...nextDefaults.text.textToText, binding: configUpdates.binding };
            }
            if (service === 'describe') {
                nextDefaults.text.imageToText = { ...nextDefaults.text.imageToText, binding: configUpdates.binding };
                nextDefaults.text.videoToText = { ...nextDefaults.text.videoToText, binding: configUpdates.binding };
            }
            if (service === 'imageGeneration') {
                nextDefaults.image.textToImage = { ...nextDefaults.image.textToImage, binding: configUpdates.binding };
            }
        }

        const newSettings = {
            ...currentSettings,
            services: {
                ...currentSettings.services,
                [service]: newServiceConfig
            },
            defaults: nextDefaults,
        };
        await get().updateSettings(newSettings);
    },

    importProvidersFromFile: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getApiBase()}/api-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'importProvidersFromFile' })
            });
            if (!response.ok) throw new Error('Failed to import providers from file');
            const data = await response.json();
            set({
                providers: normalizeProvidersWithBuiltins(data.providers || []),
                isLoading: false,
                _configLoaded: true,
                _configLoading: false,
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
            throw error;
        }
    },

    ensureBuiltinProviders: () => {
        set((state) => ({
            providers: normalizeProvidersWithBuiltins(state.providers),
        }));
    },

    getEnabledProviders: () => {
        return get().providers.filter(p => p.isEnabled);
    },

    getProviderById: (id) => {
        return get().providers.find(p => p.id === id);
    },

    getModelsForTask: (task) => {
        return selectModelsForContext(get().providers, 'playground', { requiredTask: task })
            .map((item) => ({
                providerId: item.providerId,
                providerName: item.providerName,
                modelId: item.modelId,
                displayName: item.displayName || item.modelId,
            }));
    },

    getModelsForContext: (context, requiredTask) => {
        return selectModelsForContext(get().providers, context, { requiredTask })
            .map((item) => ({
                providerId: item.providerId,
                providerName: item.providerName,
                modelId: item.modelId,
                displayName: item.displayName || item.modelId,
            }));
    },

    getModelEntryById: (modelId) => {
        return getModelById(get().providers, modelId);
    },

    getServiceConfig: (service) => {
        return get().settings.services[service] as ServiceConfig;
    }
}));
