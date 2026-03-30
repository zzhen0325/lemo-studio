import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiBase } from '@/lib/api-base';
import { Generation, GenerationConfig } from '@/types/database';

interface UseResultModalStateArgs {
  filteredHistory: Generation[];
  viewMode: 'home' | 'dock';
  ensureDockMode: () => void;
}

export function useResultModalState({ filteredHistory, viewMode, ensureDockMode }: UseResultModalStateArgs) {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Generation | undefined>(undefined);
  const [isHydratingSelectedResult, setIsHydratingSelectedResult] = useState(false);
  const [previewResultsOverride, setPreviewResultsOverride] = useState<Generation[] | null>(null);
  const modalDetailCacheRef = useRef<Map<string, Generation>>(new Map());
  const modalDetailInFlightRef = useRef<Map<string, Promise<Generation | null>>>(new Map());

  const getResultCacheKey = useCallback((result?: Pick<Generation, 'id' | 'outputUrl'>) => {
    if (!result) return '';
    const normalizedId = (result.id || '').trim();
    if (normalizedId) return normalizedId;
    return (result.outputUrl || '').trim();
  }, []);

  const isMinimalResult = useCallback((result?: Generation) => {
    if (!result?.config) return false;
    return Boolean((result.config as GenerationConfig & { __minimal?: boolean }).__minimal);
  }, []);

  const fetchModalResultDetail = useCallback(async (baseResult: Generation): Promise<Generation | null> => {
    const cacheKey = getResultCacheKey(baseResult);
    if (!cacheKey) return null;

    const cached = modalDetailCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const inFlight = modalDetailInFlightRef.current.get(cacheKey);
    if (inFlight) return inFlight;

    const request = (async () => {
      try {
        const url = new URL(`${getApiBase()}/history`, window.location.origin);
        if (baseResult.id) {
          url.searchParams.set('id', baseResult.id);
        }
        if (baseResult.outputUrl) {
          url.searchParams.set('outputUrl', baseResult.outputUrl);
        }

        const res = await fetch(url.toString());
        if (!res.ok) return null;

        const data = await res.json();
        const item = data?.item as Generation | undefined;
        return item || null;
      } catch (error) {
        console.error('Failed to fetch modal history detail:', error);
        return null;
      }
    })();

    modalDetailInFlightRef.current.set(cacheKey, request);
    try {
      const fullItem = await request;
      if (fullItem) {
        modalDetailCacheRef.current.set(cacheKey, fullItem);
        const fullKey = getResultCacheKey(fullItem);
        if (fullKey) {
          modalDetailCacheRef.current.set(fullKey, fullItem);
        }
      }
      return fullItem;
    } finally {
      modalDetailInFlightRef.current.delete(cacheKey);
    }
  }, [getResultCacheKey]);

  const openImageModal = useCallback((result: Generation, context?: Generation[] | DOMRect) => {
    setPreviewResultsOverride(Array.isArray(context) ? context : null);
    const cached = modalDetailCacheRef.current.get(getResultCacheKey(result));
    setSelectedResult(cached || result);
    setIsImageModalOpen(true);
    if (viewMode !== 'dock') {
      ensureDockMode();
    }
  }, [ensureDockMode, getResultCacheKey, viewMode]);

  const previewableHistory = useMemo(() => (
    (previewResultsOverride || filteredHistory).filter((result) => {
      const outputUrl = result.outputUrl?.trim();
      if (!outputUrl) return false;

      const sourceUrls = result.config?.sourceImageUrls
        || result.config?.editConfig?.referenceImages?.map((image) => image.dataUrl)
        || [];
      const firstSourceUrl = sourceUrls[0];
      return !(firstSourceUrl && outputUrl === firstSourceUrl);
    })
  ), [filteredHistory, previewResultsOverride]);

  const selectedResultKey = useMemo(() => getResultCacheKey(selectedResult), [getResultCacheKey, selectedResult]);
  const currentIndex = useMemo(
    () => (selectedResultKey ? previewableHistory.findIndex((result) => getResultCacheKey(result) === selectedResultKey) : -1),
    [getResultCacheKey, previewableHistory, selectedResultKey]
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < previewableHistory.length - 1 && currentIndex !== -1;

  const handleNextImage = useCallback(() => {
    if (hasNext) {
      setSelectedResult(previewableHistory[currentIndex + 1]);
    }
  }, [currentIndex, hasNext, previewableHistory]);

  const handlePrevImage = useCallback(() => {
    if (hasPrev) {
      setSelectedResult(previewableHistory[currentIndex - 1]);
    }
  }, [currentIndex, hasPrev, previewableHistory]);

  const jumpToResult = useCallback((result: Generation) => {
    setSelectedResult(result);
  }, []);

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
    setIsHydratingSelectedResult(false);
    setPreviewResultsOverride(null);
  }, []);

  useEffect(() => {
    if (!isImageModalOpen || !selectedResult) return;
    if (!isMinimalResult(selectedResult)) return;

    const cacheKey = getResultCacheKey(selectedResult);
    if (!cacheKey) return;

    const cached = modalDetailCacheRef.current.get(cacheKey);
    if (cached) {
      if (cached !== selectedResult) {
        setSelectedResult(cached);
      }
      return;
    }

    let cancelled = false;
    setIsHydratingSelectedResult(true);

    fetchModalResultDetail(selectedResult)
      .then((fullItem) => {
        if (cancelled || !fullItem) return;
        setSelectedResult((prev) => {
          if (!prev) return prev;
          if (getResultCacheKey(prev) !== cacheKey) return prev;
          return fullItem;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingSelectedResult(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchModalResultDetail, getResultCacheKey, isImageModalOpen, isMinimalResult, selectedResult]);

  return {
    isImageModalOpen,
    selectedResult,
    setSelectedResult,
    isHydratingSelectedResult,
    openImageModal,
    closeImageModal,
    previewableHistory,
    currentIndex,
    jumpToResult,
    handleNextImage,
    handlePrevImage,
    hasPrev,
    hasNext,
  };
}
