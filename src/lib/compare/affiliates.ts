/**
 * Enlaces de afiliado.
 *
 * LOCUS gana dinero cuando alguien reserva en un proveedor a través de un
 * enlace con el identificador de afiliado de LOCUS. El identificador NO es un
 * secreto (viaja en la URL, visible para el usuario), por eso puede vivir en
 * variables VITE_* del frontend. Cada programa de afiliados define sus propios
 * parámetros, así que NO los inventamos: en `.env.local` (o en las variables de
 * GitHub) se pone el fragmento de consulta EXACTO que entrega el programa:
 *
 *   VITE_AFF_BOOKING="aid=1234567&label=locus"
 *   VITE_AFF_VIATOR="pid=P00012345&mcid=42383&medium=link"
 *
 * Si la variable no existe, el enlace sale limpio (sin afiliado) y no se marca
 * como patrocinado. Los enlaces con afiliado llevan rel="sponsored" y la
 * interfaz avisa al usuario (transparencia: /como-ganamos-dinero).
 */

/** Variables de afiliado por proveedor (id del proveedor → fragmento de consulta). */
export type AffiliateEnv = Partial<Record<string, string | undefined>>

const ENV = import.meta.env as Record<string, string | undefined>

/** Lee las variables VITE_AFF_<ID> del entorno (el id en mayúsculas, con guion bajo). */
export function affiliateEnvFromImportMeta(): AffiliateEnv {
  const result: AffiliateEnv = {}
  for (const [key, value] of Object.entries(ENV)) {
    if (key.startsWith('VITE_AFF_') && value) result[key.slice('VITE_AFF_'.length).toLowerCase()] = value
  }
  return result
}

/**
 * Agrega el fragmento de afiliado a la URL. Si el fragmento es inválido, no se
 * toca la URL. Devuelve también si el enlace quedó patrocinado.
 */
export function withAffiliate(
  providerId: string,
  url: string,
  env: AffiliateEnv = affiliateEnvFromImportMeta(),
): { url: string; sponsored: boolean } {
  const fragment = env[providerId.replace(/-/g, '_').toLowerCase()]?.trim().replace(/^[?&]/, '')
  if (!fragment) return { url, sponsored: false }
  try {
    const out = new URL(url)
    for (const [key, value] of new URLSearchParams(fragment)) out.searchParams.set(key, value)
    return { url: out.toString(), sponsored: true }
  } catch {
    return { url, sponsored: false }
  }
}
