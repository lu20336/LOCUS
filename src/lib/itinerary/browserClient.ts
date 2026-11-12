/**
 * Clientes que usa la app en el navegador.
 * El correo de contacto para Nominatim se configura en `.env.local`
 * (ver `.env.example`): VITE_NOMINATIM_EMAIL=correo@ejemplo.com
 */
import { createElevationClient } from './elevationClient'
import { createOsmClient } from './osmClient'
import type { SuggestionDeps, TownCandidate } from './suggestDestination'

export const osmClient = createOsmClient({
  email: import.meta.env.VITE_NOMINATIM_EMAIL || undefined,
})

/** Dependencias de la sugerencia de destino (Modo B), sobre el mismo cliente OSM. */
export const suggestionDeps: SuggestionDeps = {
  // Lista precalculada (npm run data:towns). Se descarga solo al usar el Modo B.
  loadTowns: async () => (await import('../../data/colombiaTowns.json')).default.towns as TownCandidate[],
  checkActivities: (centers, radius, categories) => osmClient.checkActivities(centers, radius, categories),
  elevation: createElevationClient(),
}
