/**
 * Registros de etiquetas que se leen en el idioma activo en cada acceso (getters),
 * para tablas como tipos de alojamiento o comodidades sin cambiar los sitios donde se usan.
 */
import { getT } from './store'

export function localizedRecord<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>
  for (const key of keys) Object.defineProperty(out, key, { enumerable: true, get: () => getT()(`${prefix}.${key}`) })
  return out
}
