import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Ejecuta una carga asíncrona al montar o cuando cambian `deps`, ignorando respuestas viejas. */
export function useAsync<T>(task: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  })
  const [tick, setTick] = useState(0)
  const taskRef = useRef(task)
  useEffect(() => {
    taskRef.current = task
  })

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    taskRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error && error.message ? error.message : 'No pudimos cargar la información.'
        setState({ data: null, loading: false, error: message })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { ...state, reload }
}
