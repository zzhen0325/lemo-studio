export function isImageFile(file: File | null | undefined): file is File {
  return Boolean(file && file.type.startsWith('image/'));
}

export function getFirstImageFile(
  files: FileList | File[] | null | undefined,
): File | null {
  if (!files) {
    return null;
  }

  return Array.from(files).find((file) => isImageFile(file)) || null;
}

export function getClipboardImageFile(
  items: DataTransferItemList | DataTransferItem[] | null | undefined,
): File | null {
  if (!items) {
    return null;
  }

  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue;
    }

    const file = item.getAsFile();
    if (isImageFile(file)) {
      return file;
    }
  }

  return null;
}
