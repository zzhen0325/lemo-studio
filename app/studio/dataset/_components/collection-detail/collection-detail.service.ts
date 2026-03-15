import { getApiBase } from '@/lib/api-base';
import type { TranslateLang } from './types';

function datasetEndpoint() {
  return `${getApiBase()}/dataset`;
}

function translateEndpoint() {
  return `${getApiBase()}/translate`;
}

export async function fetchCollectionImages(collectionName: string) {
  return fetch(`${datasetEndpoint()}?collection=${encodeURIComponent(collectionName)}`);
}

export async function saveCollectionOrder(collectionName: string, order: string[]) {
  return fetch(datasetEndpoint(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: collectionName,
      order,
    }),
  });
}

export async function deleteCollectionImage(collectionName: string, filename: string) {
  return fetch(`${datasetEndpoint()}?collection=${encodeURIComponent(collectionName)}&filename=${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

export async function deleteCollectionImages(collectionName: string, filenames: string[]) {
  return fetch(`${datasetEndpoint()}?collection=${encodeURIComponent(collectionName)}&filenames=${encodeURIComponent(filenames.join(','))}`, {
    method: 'DELETE',
  });
}

export async function updateCollectionData(payload: Record<string, unknown>, signal?: AbortSignal) {
  return fetch(datasetEndpoint(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

export async function uploadCollectionFile(collectionName: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('collection', collectionName);

  return fetch(datasetEndpoint(), {
    method: 'POST',
    body: formData,
  });
}

export async function uploadCollectionFilesBatch(
  collectionName: string,
  files: File[],
  promptMap: Record<string, string>,
) {
  const formData = new FormData();
  formData.append('collection', collectionName);
  formData.append('mode', 'batchUpload');
  formData.append('promptMap', JSON.stringify(promptMap));
  files.forEach((file) => {
    formData.append('files', file);
  });

  return fetch(datasetEndpoint(), {
    method: 'POST',
    body: formData,
  });
}

export async function renameCollectionBatch(collectionName: string, prefix: string) {
  return updateCollectionData({
    collection: collectionName,
    mode: 'batchRename',
    prefix,
  });
}

export async function renameCollection(collectionName: string, newCollectionName: string) {
  return updateCollectionData({
    collection: collectionName,
    newCollectionName,
  });
}

export async function translatePrompt(text: string, target: TranslateLang, signal?: AbortSignal) {
  return fetch(translateEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target }),
    signal,
  });
}

export async function translatePromptsBatch(texts: string[], target: TranslateLang, signal?: AbortSignal) {
  return fetch(translateEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target }),
    signal,
  });
}
