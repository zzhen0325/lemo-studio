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

  const openImageModal = useCallback((result: Generation) => {
    const cached = modalDetailCacheRef.current.get(getResultCacheKey(result));
    setSelectedResult(cached || result);
    setIsImageModalOpen(true);
    if (viewMode !== 'dock') {
      ensureDockMode();
    }
  }, [ensureDockMode, getResultCacheKey, viewMode]);

  const currentIndex = useMemo(
    () => (selectedResult ? filteredHistory.findIndex(h => h.id === selectedResult.id) : -1),
    [filteredHistory, selectedResult]
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < filteredHistory.length - 1 && currentIndex !== -1;

  const handleNextImage = useCallback(() => {
    if (hasNext) {
      setSelectedResult(filteredHistory[currentIndex + 1]);
    }
  }, [currentIndex, filteredHistory, hasNext]);

  const handlePrevImage = useCallback(() => {
    if (hasPrev) {
      setSelectedResult(filteredHistory[currentIndex - 1]);
    }
  }, [currentIndex, filteredHistory, hasPrev]);

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
    setIsHydratingSelectedResult(false);
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
    handleNextImage,
    handlePrevImage,
    hasPrev,
    hasNext,
  };
}
