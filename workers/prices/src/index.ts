/** Punto de entrada del Worker: conecta la caché de Cloudflare con la lógica de handler.ts. */
import { handle, type CacheLike, type Env } from './handler'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cache = (globalThis as unknown as { caches?: { default?: CacheLike } }).caches?.default ?? null
    return handle(request, env, { cache })
  },
}
