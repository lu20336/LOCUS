// Tipos del dominio de Locus: lo que entra al motor de itinerarios y lo que sale.

/** Categorías de actividades que el usuario puede elegir en el paso 2. */
export type CategoryId =
  | 'playa'
  | 'cultura'
  | 'gastronomia'
  | 'aventura'
  | 'vidaNocturna'
  | 'compras'

/** Un punto en el mapa (grados decimales, WGS84). */
export interface GeoPoint {
  lat: number
  lon: number
}

/** Destino ya geocodificado por Nominatim. */
export interface Destination extends GeoPoint {
  /** Lo que escribió el usuario. */
  query: string
  /** Nombre completo devuelto por Nominatim, ej. "Cartagena de Indias, Bolívar, Colombia". */
  displayName: string
  /** Radio de búsqueda de lugares, derivado del tamaño de la ciudad. */
  radiusMeters: number
}

/** Un punto de interés real obtenido de OpenStreetMap. */
export interface Place extends GeoPoint {
  /** Identificador de OSM, ej. "node/123456". */
  id: string
  name: string
  category: CategoryId
  /** Tipo legible en español, ej. "Museo", "Restaurante". */
  kind: string
  /** Relevancia estimada a partir de las etiquetas de OSM (mayor = mejor). */
  score: number
}

/** Datos que el usuario llena en los pasos 1 y 2. */
export interface TripInput {
  destination: string
  /** Fechas en formato ISO "AAAA-MM-DD". */
  startDate: string
  endDate: string
  budgetCOP: number
  categories: CategoryId[]
}

/** Un día del itinerario, con sus lugares ya en orden optimizado. */
export interface DayPlan {
  /** Número de día empezando en 1. */
  day: number
  /** Fecha ISO "AAAA-MM-DD". */
  date: string
  places: Place[]
  /** Distancia en línea recta del recorrido del día, saliendo del centro del destino. */
  distanceKm: number
}

export interface ItineraryStats {
  /** Km totales recorridos con el orden optimizado. */
  optimizedKm: number
  /** Km totales si visitáramos los lugares en el orden en que llegaron (sin optimizar). */
  unoptimizedKm: number
  /** Porcentaje de distancia ahorrada gracias a la optimización. */
  savingPercent: number
}

/** Resultado completo del motor. */
export interface Itinerary {
  input: TripInput
  destination: Destination
  days: DayPlan[]
  /** Categorías elegidas para las que OSM no devolvió ningún lugar. */
  missingCategories: CategoryId[]
  stats: ItineraryStats
  /** Fecha ISO de generación. */
  generatedAt: string
}
