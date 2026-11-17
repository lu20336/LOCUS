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

/** Pueblo cercano que el usuario eligió visitar en una excursión de un día (Paso 2). */
export interface Excursion extends GeoPoint {
  id: string
  name: string
  /** Departamento, ej. "Antioquia". */
  region: string
  /** Qué tiene de especial, ej. "El pueblo de piedra". */
  tagline: string
  /** Distancia en línea recta desde el destino principal. */
  distanceKm: number
  /** Minutos en carro desde el destino (sin tráfico), si se pudieron calcular. */
  driveMinutes?: number
  /** Lo imperdible del pueblo (ej. la Piedra del Peñol en Guatapé): siempre entra en su día. */
  highlight?: { name: string; category: CategoryId; lat: number; lon: number }
}

/** Un día del itinerario, con sus lugares ya en orden optimizado. */
export interface DayPlan {
  /** Número de día empezando en 1. */
  day: number
  /** Fecha ISO "AAAA-MM-DD". */
  date: string
  places: Place[]
  /** Distancia en línea recta del recorrido del día, saliendo del centro del destino (o del pueblo). */
  distanceKm: number
  /** Si es un día de excursión: el pueblo que se visita (el recorrido sale de su centro). */
  excursion?: Excursion
  /** Lugares que no entraron en el plan, para cambiar una parada por otra (Paso 3). */
  alternatives?: Place[]
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
  /** true si el usuario quitó o cambió paradas: el "ahorro de ruta" ya no aplica. */
  edited?: boolean
}
