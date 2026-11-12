/**
 * Errores del motor de itinerarios. Cada uno trae un código (para que la UI
 * decida qué hacer) y un mensaje en español listo para mostrar al usuario.
 */
export type ItineraryErrorCode =
  | 'INVALID_INPUT' // datos del formulario incompletos o incoherentes
  | 'DESTINATION_NOT_FOUND' // Nominatim no reconoce el destino
  | 'NO_PLACES' // Overpass no encontró ningún lugar para las categorías elegidas
  | 'RATE_LIMITED' // superamos el límite de peticiones de OSM
  | 'SERVICE_UNAVAILABLE' // Nominatim/Overpass caído, lento o sin red

export class ItineraryError extends Error {
  readonly code: ItineraryErrorCode

  constructor(code: ItineraryErrorCode, message: string) {
    super(message)
    this.name = 'ItineraryError'
    this.code = code
  }
}

/** Error HTTP de un servicio externo (Nominatim u Overpass). */
export class OsmHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'OsmHttpError'
    this.status = status
  }
}

/** Traduce cualquier fallo de red/HTTP en un ItineraryError con mensaje amigable. */
export function toItineraryError(error: unknown, service: string): ItineraryError {
  if (error instanceof ItineraryError) return error
  if (error instanceof OsmHttpError && error.status === 429) {
    return new ItineraryError(
      'RATE_LIMITED',
      `Hay muchas consultas a ${service} en este momento. Espera unos segundos e inténtalo de nuevo.`,
    )
  }
  return new ItineraryError(
    'SERVICE_UNAVAILABLE',
    `No pudimos conectarnos con ${service}. Revisa tu conexión e inténtalo de nuevo.`,
  )
}
