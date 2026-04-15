"use client"

import { useCallback, useLayoutEffect, useRef } from "react"

type AnyFunction = (...args: any[]) => any

// React 18-compatible replacement for React 19's useEffectEvent.
export function useStableEvent<T extends AnyFunction>(callback: T): T {
  const callbackRef = useRef(callback)

  useLayoutEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, [])
}
