/**
 * Limitador de tasa sencillo: garantiza que entre el inicio de una tarea y la
 * siguiente pasen al menos `minIntervalMs` milisegundos. Las tareas se
 * ejecutan en fila, una detrás de otra.
 *
 * Nominatim exige máximo 1 petición por segundo; por eso osmClient.ts pasa
 * todas sus llamadas por aquí.
 */
export function createThrottle(
  minIntervalMs: number,
  now: () => number = () => Date.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  let lastStart = Number.NEGATIVE_INFINITY
  let queue: Promise<unknown> = Promise.resolve()

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const wait = lastStart + minIntervalMs - now()
      if (wait > 0) await sleep(wait)
      lastStart = now()
      return task()
    })
    // Si una tarea falla, la fila sigue funcionando para las siguientes.
    queue = run.catch(() => undefined)
    return run
  }
}
