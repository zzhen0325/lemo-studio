"use client";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = void 0;
exports.ViewComfyProvider = ViewComfyProvider;
exports.useViewComfy = useViewComfy;
const react_1 = __importStar(require("react"));
// Define action types as an enum
var ActionType;
(function (ActionType) {
    ActionType["ADD_VIEW_COMFY"] = "ADD_VIEW_COMFY";
    ActionType["UPDATE_VIEW_COMFY"] = "UPDATE_VIEW_COMFY";
    ActionType["REMOVE_VIEW_COMFY"] = "REMOVE_VIEW_COMFY";
    ActionType["SET_VIEW_COMFY_DRAFT"] = "SET_VIEW_COMFY_DRAFT";
    ActionType["UPDATE_CURRENT_VIEW_COMFY"] = "UPDATE_CURRENT_VIEW_COMFY";
    ActionType["RESET_CURRENT_AND_DRAFT_VIEW_COMFY"] = "RESET_CURRENT_AND_DRAFT_VIEW_COMFY";
    ActionType["INIT_VIEW_COMFY"] = "INIT_VIEW_COMFY";
    ActionType["SET_APP_TITLE"] = "SET_APP_TITLE";
    ActionType["SET_APP_IMG"] = "SET_APP_IMG";
})(ActionType || (exports.ActionType = ActionType = {}));
function viewComfyReducer(state, action) {
    console.log({ action });
    switch (action.type) {
        case ActionType.ADD_VIEW_COMFY: {
            const data = {
                ...state,
                viewComfys: [...state.viewComfys, { ...action.payload }],
                currentViewComfy: {
                    viewComfyJSON: action.payload.viewComfyJSON,
                    workflowApiJSON: action.payload.workflowApiJSON,
                    file: action.payload.file
                },
                viewComfyDraft: {
                    viewComfyJSON: action.payload.viewComfyJSON,
                    workflowApiJSON: action.payload.workflowApiJSON,
                    file: action.payload.file
                }
            };
            return data;
        }
        case ActionType.SET_VIEW_COMFY_DRAFT:
            if (action.payload) {
                action.payload.viewComfyJSON.viewcomfyEndpoint = "";
            }
            return {
                ...state,
                viewComfyDraft: action.payload ? { ...action.payload } : undefined
            };
        case ActionType.UPDATE_VIEW_COMFY:
            return {
                ...state,
                viewComfys: state.viewComfys.map((item) => item.viewComfyJSON.id === action.payload.id
                    ? { ...action.payload.viewComfy }
                    : item),
                currentViewComfy: {
                    viewComfyJSON: action.payload.viewComfy.viewComfyJSON,
                    workflowApiJSON: action.payload.viewComfy.workflowApiJSON,
                    file: action.payload.viewComfy.file
                },
                viewComfyDraft: {
                    viewComfyJSON: action.payload.viewComfy.viewComfyJSON,
                    workflowApiJSON: action.payload.viewComfy.workflowApiJSON,
                    file: action.payload.viewComfy.file
                }
            };
        case ActionType.REMOVE_VIEW_COMFY: {
            const data = {
                ...state,
                viewComfys: state.viewComfys.filter((item) => item.viewComfyJSON.id !== action.payload.viewComfyJSON.id)
            };
            if (data.viewComfys.length > 0) {
                data.currentViewComfy = data.viewComfys[0];
                data.viewComfyDraft = {
                    viewComfyJSON: data.viewComfys[0].viewComfyJSON,
                    workflowApiJSON: data.viewComfys[0].workflowApiJSON,
                    file: data.viewComfys[0].file
                };
            }
            else {
                data.currentViewComfy = undefined;
                data.viewComfyDraft = undefined;
            }
            return data;
        }
        case ActionType.UPDATE_CURRENT_VIEW_COMFY:
            return {
                ...state,
                currentViewComfy: action.payload,
                viewComfyDraft: action.payload
            };
        case ActionType.RESET_CURRENT_AND_DRAFT_VIEW_COMFY:
            return {
                ...state,
                currentViewComfy: undefined,
                viewComfyDraft: undefined
            };
        case ActionType.INIT_VIEW_COMFY: {
            if (action.payload.viewComfys.length === 0) {
                return state;
            }
            return {
                appTitle: action.payload.appTitle ?? "ViewComfy",
                appImg: action.payload.appImg ?? "",
                viewComfys: [...action.payload.viewComfys.map((workflow) => ({
                        viewComfyJSON: workflow.viewComfyJSON,
                        workflowApiJSON: workflow.workflowApiJSON,
                    }))],
                currentViewComfy: { viewComfyJSON: action.payload.viewComfys[0].viewComfyJSON, workflowApiJSON: action.payload.viewComfys[0].workflowApiJSON },
                viewComfyDraft: { viewComfyJSON: action.payload.viewComfys[0].viewComfyJSON, workflowApiJSON: action.payload.viewComfys[0].workflowApiJSON },
            };
        }
        case ActionType.SET_APP_TITLE:
            return {
                ...state,
                appTitle: action.payload || "ViewComfy"
            };
        case ActionType.SET_APP_IMG:
            return {
                ...state,
                appImg: action.payload
            };
        default:
            return state;
    }
}
const ViewComfyContext = (0, react_1.createContext)(undefined);
function ViewComfyProvider({ children }) {
    const [viewComfyState, dispatch] = (0, react_1.useReducer)(viewComfyReducer, { viewComfys: [], viewComfyDraft: undefined, currentViewComfy: undefined });
    return (react_1.default.createElement(ViewComfyContext.Provider, { value: { viewComfyState, viewComfyStateDispatcher: dispatch } }, children));
}
function useViewComfy() {
    const context = (0, react_1.useContext)(ViewComfyContext);
    if (context === undefined) {
        throw new Error('useViewComfy must be used within a ViewComfyProvider');
    }
    return context;
}
