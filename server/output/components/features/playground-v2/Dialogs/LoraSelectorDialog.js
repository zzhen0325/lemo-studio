"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoraSelectorDialog;
const react_1 = __importStar(require("react"));
const button_1 = require("@/components/ui/button");
const dialog_1 = require("@/components/ui/dialog");
const scroll_area_1 = require("@/components/ui/scroll-area");
const slider_1 = require("@/components/ui/slider");
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
const input_1 = require("@/components/ui/input");
const image_1 = __importDefault(require("next/image"));
const api_base_1 = require("@/lib/api-base");
function LoraSelectorDialog({ open, onOpenChange, value, onConfirm }) {
    const [list, setList] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [selected, setSelected] = (0, react_1.useState)({});
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        const map = {};
        value.forEach(v => { map[v.model_name] = v.strength; });
        setSelected(map);
    }, [value]);
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        const fetchList = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${(0, api_base_1.getApiBase)()}/loras`);
                if (!res.ok)
                    throw new Error('获取模型失败');
                const data = (await res.json());
                setList(data);
            }
            catch (error) {
                console.error("Failed to fetch loras", error);
            }
            finally {
                setLoading(false);
            }
        };
        fetchList();
    }, [open]);
    const toggle = (name) => {
        setSelected(prev => {
            const next = { ...prev };
            if (name in next)
                delete next[name];
            else
                next[name] = 1.0;
            return next;
        });
    };
    const setStrength = (name, v) => { setSelected(prev => ({ ...prev, [name]: v })); };
    const confirm = () => {
        const result = Object.entries(selected).map(([k, v]) => {
            const meta = list.find(item => item.model_name === k);
            return { model_name: k, strength: v, preview_url: meta?.preview_url };
        });
        onConfirm(result);
    };
    const filteredList = list.filter(item => item.model_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return (react_1.default.createElement(dialog_1.Dialog, { open: open, onOpenChange: onOpenChange },
        react_1.default.createElement(dialog_1.DialogContent, { className: "max-w-6xl z-[10001] h-[80vh] flex flex-col rounded-3xl bg-zinc-950/90 backdrop-blur-xl border-white/10 p-0 overflow-hidden" },
            react_1.default.createElement(dialog_1.DialogHeader, { className: "px-6 py-4 border-b border-white/10 flex-shrink-0" },
                react_1.default.createElement("div", { className: "flex items-center justify-between" },
                    react_1.default.createElement(dialog_1.DialogTitle, { className: "text-xl font-light text-white" }, "Select LoRA Model"),
                    react_1.default.createElement("div", { className: "relative w-64" },
                        react_1.default.createElement(lucide_react_1.Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" }),
                        react_1.default.createElement(input_1.Input, { placeholder: "Search models...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "h-9 pl-9 bg-white/5 border-white/10 rounded-full text-sm text-white focus-visible:ring-indigo-500/50 placeholder:text-white/30" })))),
            react_1.default.createElement(scroll_area_1.ScrollArea, { className: "flex-1 px-6 py-6" },
                react_1.default.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" }, filteredList.map(item => {
                    const isSelected = item.model_name in selected;
                    return (react_1.default.createElement("div", { key: item.model_name, className: (0, utils_1.cn)("group relative flex flex-col rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden", isSelected
                            ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"), onClick: () => toggle(item.model_name) },
                        react_1.default.createElement("div", { className: "aspect-[2/3] w-full relative overflow-hidden bg-black/20" },
                            item.preview_url ? (react_1.default.createElement(image_1.default, { src: encodeURI(item.preview_url), alt: item.model_name, fill: true, sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw", className: (0, utils_1.cn)("object-cover transition-transform duration-500", isSelected ? "scale-105" : "group-hover:scale-105"), unoptimized: true })) : (react_1.default.createElement("div", { className: "w-full h-full flex items-center justify-center text-white/20" },
                                react_1.default.createElement(lucide_react_1.ServerCrash, { className: "w-8 h-8" }))),
                            react_1.default.createElement("div", { className: (0, utils_1.cn)("absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-md", isSelected
                                    ? "bg-indigo-500 text-white scale-100 opacity-100"
                                    : "bg-black/40 text-white/50 scale-90 opacity-0 group-hover:opacity-100 border border-white/20") },
                                react_1.default.createElement(lucide_react_1.Check, { className: "w-3.5 h-3.5" }))),
                        react_1.default.createElement("div", { className: "p-3 flex flex-col gap-2 flex-1" },
                            react_1.default.createElement("div", { className: "flex items-center justify-between gap-2" },
                                react_1.default.createElement("span", { className: "text-xs font-medium text-white/90 truncate", title: item.model_name }, item.model_name)),
                            react_1.default.createElement("div", { className: (0, utils_1.cn)("grid transition-all duration-300 ease-out", isSelected ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0") },
                                react_1.default.createElement("div", { className: "overflow-hidden space-y-1.5" },
                                    react_1.default.createElement("div", { className: "flex items-center justify-between text-[10px] text-indigo-200/80 px-0.5" },
                                        react_1.default.createElement("span", null, "Strength"),
                                        react_1.default.createElement("span", null, selected[item.model_name]?.toFixed(2))),
                                    react_1.default.createElement("div", { onClick: (e) => e.stopPropagation() },
                                        react_1.default.createElement(slider_1.Slider, { value: [selected[item.model_name] || 1.0], min: 0, max: 2, step: 0.05, onValueChange: (vals) => setStrength(item.model_name, vals[0] ?? 0), className: "py-1" })))))));
                })),
                filteredList.length === 0 && !loading && (react_1.default.createElement("div", { className: "flex flex-col items-center justify-center h-64 text-white/30 gap-2" },
                    react_1.default.createElement(lucide_react_1.Search, { className: "w-8 h-8 opacity-50" }),
                    react_1.default.createElement("p", null,
                        "No LoRA models found matching \"",
                        searchQuery,
                        "\"")))),
            react_1.default.createElement("div", { className: "px-6 py-4 border-t border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-xl" },
                react_1.default.createElement("span", { className: "text-sm text-white/40" },
                    Object.keys(selected).length,
                    " selected"),
                react_1.default.createElement("div", { className: "flex gap-3" },
                    react_1.default.createElement(button_1.Button, { variant: "ghost", onClick: () => onOpenChange(false), disabled: loading, className: "text-white/60 hover:text-white hover:bg-white/10" }, "Cancel"),
                    react_1.default.createElement(button_1.Button, { onClick: () => { confirm(); onOpenChange(false); }, disabled: loading, className: "bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]" }, "Confirm Selection"))))));
}
