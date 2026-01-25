"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetSyncService = void 0;
const dataset_events_1 = require("../../lib/server/dataset-events");
const gulux_1 = require("@gulux/gulux");
let DatasetSyncService = class DatasetSyncService {
    createSyncStream() {
        const encoder = new TextEncoder();
        let cleanup;
        const stream = new ReadableStream({
            start(controller) {
                let isClosed = false;
                const sendEvent = (data) => {
                    if (isClosed)
                        return;
                    try {
                        controller.enqueue(encoder.encode(`event: sync\ndata: ${data}\n\n`));
                    }
                    catch (e) {
                        console.error('SSE enqueue error:', e);
                    }
                };
                sendEvent('connected');
                const onSync = () => {
                    sendEvent('refresh');
                };
                dataset_events_1.datasetEvents.on(dataset_events_1.DATASET_SYNC_EVENT, onSync);
                cleanup = () => {
                    if (isClosed)
                        return;
                    isClosed = true;
                    dataset_events_1.datasetEvents.off(dataset_events_1.DATASET_SYNC_EVENT, onSync);
                    try {
                        controller.close();
                    }
                    catch {
                        // ignore
                    }
                };
            },
            cancel() {
                if (cleanup)
                    cleanup();
            },
        });
        return stream;
    }
};
exports.DatasetSyncService = DatasetSyncService;
exports.DatasetSyncService = DatasetSyncService = __decorate([
    (0, gulux_1.Injectable)()
], DatasetSyncService);
