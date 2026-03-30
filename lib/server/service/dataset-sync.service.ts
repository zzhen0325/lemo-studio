import { datasetEvents, DATASET_SYNC_EVENT } from '../dataset-events';
export class DatasetSyncService {
  public createSyncStream(): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let cleanup: () => void;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let isClosed = false;

        const sendEvent = (data: string) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`event: sync\ndata: ${data}\n\n`));
          } catch (e) {
            console.error('SSE enqueue error:', e);
          }
        };

        sendEvent('connected');

        const onSync = () => {
          sendEvent('refresh');
        };

        datasetEvents.on(DATASET_SYNC_EVENT, onSync);

        cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          datasetEvents.off(DATASET_SYNC_EVENT, onSync);
          try {
            controller.close();
          } catch {
            // ignore
          }
        };
      },
      cancel() {
        if (cleanup) cleanup();
      },
    });

    return stream;
  }
}
