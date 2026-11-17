/**
 * Genera src/data/touristTowns.json: pueblos turísticos de Colombia para la
 * opción "Conocer pueblos cercanos" del Paso 2 (excursiones de un día).
 *
 *   npm run data:tourist-towns
 *
 * La lista de pueblos y su descripción corta está escrita a mano (abajo). Las
 * coordenadas NO: se piden a Nominatim (1 petición por segundo) y solo se
 * aceptan si el resultado está en Colombia y en el departamento indicado.
 * Si alguno no se encuentra, el script lo avisa y no lo incluye.
 */
import { writeFileSync } from 'node:fs'
import { haversineKm } from '../src/lib/itinerary/geo'
import { createOsmClient } from '../src/lib/itinerary/osmClient'

interface Entry {
  name: string
  region: string
  /** Qué tiene de especial (se muestra en el Paso 2). */
  tagline: string
  /** Texto de búsqueda si el nombre solo no basta. */
  query?: string
  /**
   * Ubicación aproximada para comprobar el resultado cuando Nominatim no
   * devuelve el departamento: se acepta si queda a menos de 30 km.
   */
  near?: [number, number]
}

const TOWNS: Entry[] = [
  // Antioquia
  { name: 'Guatapé', region: 'Antioquia', tagline: 'Piedra del Peñol y zócalos de colores' },
  { name: 'Santa Fe de Antioquia', region: 'Antioquia', tagline: 'Centro colonial y Puente de Occidente' },
  { name: 'Jardín', region: 'Antioquia', tagline: 'Calles empedradas, balcones y cafetales' },
  { name: 'Jericó', region: 'Antioquia', tagline: 'Pueblo patrimonio entre montañas' },
  { name: 'El Retiro', region: 'Antioquia', tagline: 'Pueblo de montaña cerca de Medellín' },
  { name: 'San Rafael', region: 'Antioquia', tagline: 'Ríos de aguas cristalinas' },
  // Cundinamarca
  { name: 'Zipaquirá', region: 'Cundinamarca', tagline: 'Catedral de Sal' },
  { name: 'Guatavita', region: 'Cundinamarca', tagline: 'Laguna de Guatavita y la leyenda de El Dorado' },
  { name: 'Suesca', region: 'Cundinamarca', tagline: 'Escalada en roca junto al río Bogotá' },
  { name: 'Nemocón', region: 'Cundinamarca', tagline: 'Mina de sal' },
  { name: 'Choachí', region: 'Cundinamarca', tagline: 'Aguas termales' },
  { name: 'Tabio', region: 'Cundinamarca', tagline: 'Pueblo de la Sabana con termales' },
  { name: 'La Vega', region: 'Cundinamarca', tagline: 'Clima cálido cerca de Bogotá' },
  { name: 'Sopó', region: 'Cundinamarca', tagline: 'Pueblo tradicional de la Sabana' },
  // Boyacá
  { name: 'Villa de Leyva', region: 'Boyacá', tagline: 'Plaza mayor empedrada y casas coloniales' },
  { name: 'Ráquira', region: 'Boyacá', tagline: 'Artesanías en barro' },
  { name: 'Monguí', region: 'Boyacá', tagline: 'Pueblo patrimonio y páramo de Ocetá' },
  { name: 'Paipa', region: 'Boyacá', tagline: 'Aguas termales y lago Sochagota' },
  { name: 'Nobsa', region: 'Boyacá', tagline: 'Ruanas y tejidos de lana' },
  { name: 'Aquitania', region: 'Boyacá', tagline: 'Lago de Tota' },
  { name: 'Iza', region: 'Boyacá', tagline: 'Postres típicos y aguas termales' },
  { name: 'Sutamarchán', region: 'Boyacá', tagline: 'Tierra de la longaniza' },
  { name: 'Tunja', region: 'Boyacá', tagline: 'Ciudad colonial, capital de Boyacá' },
  // Santander y Norte de Santander
  { name: 'Barichara', region: 'Santander', tagline: 'El pueblo de piedra' },
  { name: 'San Gil', region: 'Santander', tagline: 'Turismo de aventura: rafting y parapente' },
  { name: 'Girón', region: 'Santander', tagline: 'Pueblo colonial junto a Bucaramanga' },
  { name: 'Socorro', region: 'Santander', tagline: 'Historia comunera y arquitectura colonial' },
  { name: 'Zapatoca', region: 'Santander', tagline: 'Pueblo de clima fresco y tradición' },
  { name: 'Pamplona', region: 'Norte de Santander', tagline: 'Ciudad colonial y Semana Santa' },
  // Eje cafetero
  { name: 'Salento', region: 'Quindío', tagline: 'Valle de Cocora y palmas de cera' },
  { name: 'Filandia', region: 'Quindío', tagline: 'Mirador y artesanías en bejuco' },
  { name: 'Pijao', region: 'Quindío', tagline: 'Pueblo cafetero tranquilo' },
  { name: 'Montenegro', region: 'Quindío', tagline: 'Parque del Café' },
  { name: 'Quimbaya', region: 'Quindío', tagline: 'Pueblo cafetero de las velas y faroles' },
  { name: 'Santa Rosa de Cabal', region: 'Risaralda', tagline: 'Termales y chorizo santarrosano' },
  { name: 'Salamina', region: 'Caldas', tagline: 'Pueblo patrimonio de balcones tallados' },
  { name: 'Aguadas', region: 'Caldas', tagline: 'Sombrero aguadeño y arquitectura colonial' },
  // Valle del Cauca, Cauca, Huila, Tolima
  { name: 'Guadalajara de Buga', region: 'Valle del Cauca', tagline: 'Basílica del Señor de los Milagros' },
  { name: 'Ginebra', region: 'Valle del Cauca', tagline: 'Música andina y comida típica vallecaucana' },
  { name: 'Calima', region: 'Valle del Cauca', tagline: 'Lago Calima y deportes de viento', query: 'Calima El Darién' },
  { name: 'Roldanillo', region: 'Valle del Cauca', tagline: 'Museo Rayo y parapente' },
  { name: 'El Cerrito', region: 'Valle del Cauca', tagline: 'Hacienda El Paraíso, escenario de María' },
  { name: 'Cartago', region: 'Valle del Cauca', tagline: 'Capital de los bordados' },
  { name: 'Popayán', region: 'Cauca', tagline: 'La Ciudad Blanca' },
  { name: 'Silvia', region: 'Cauca', tagline: 'Mercado del pueblo misak' },
  { name: 'San Agustín', region: 'Huila', tagline: 'Parque Arqueológico' },
  { name: 'Villavieja', region: 'Huila', tagline: 'Desierto de la Tatacoa' },
  { name: 'Honda', region: 'Tolima', tagline: 'La ciudad de los puentes' },
  { name: 'Ambalema', region: 'Tolima', tagline: 'Arquitectura colonial junto al río Magdalena' },
  // Caribe
  { name: 'Mompox', region: 'Bolívar', tagline: 'Centro histórico patrimonio de la humanidad', query: 'Santa Cruz de Mompox', near: [9.24, -74.43] },
  { name: 'Turbaco', region: 'Bolívar', tagline: 'Jardín Botánico cerca de Cartagena' },
  { name: 'Santiago de Tolú', region: 'Sucre', tagline: 'Playas del golfo de Morrosquillo' },
  { name: 'Coveñas', region: 'Sucre', tagline: 'Playas del golfo de Morrosquillo' },
  { name: 'Lorica', region: 'Córdoba', tagline: 'Mercado y arquitectura junto al río Sinú', near: [9.24, -75.81] },
  { name: 'Puerto Colombia', region: 'Atlántico', tagline: 'Muelle y playas cerca de Barranquilla' },
  { name: 'Usiacurí', region: 'Atlántico', tagline: 'Artesanías en palma de iraca' },
  { name: 'Aracataca', region: 'Magdalena', tagline: 'Casa natal de Gabriel García Márquez' },
  { name: 'Ciénaga', region: 'Magdalena', tagline: 'Arquitectura republicana junto a la ciénaga' },
  { name: 'Minca', region: 'Magdalena', tagline: 'Cascadas y fincas cafeteras en la Sierra Nevada' },
  { name: 'Taganga', region: 'Magdalena', tagline: 'Bahía de pescadores y buceo' },
  { name: 'Palomino', region: 'La Guajira', tagline: 'Playa y río al pie de la Sierra Nevada' },
  { name: 'Cabo de la Vela', region: 'La Guajira', tagline: 'Desierto y mar en La Guajira' },
  { name: 'Valledupar', region: 'Cesar', tagline: 'Cuna del vallenato' },
  // Sur
  { name: 'Ipiales', region: 'Nariño', tagline: 'Santuario de Las Lajas' },
  { name: 'El Encano', region: 'Nariño', tagline: 'Laguna de La Cocha' },
]

const osm = createOsmClient({
  userAgent: 'Locus/0.1 (prototipo academico, curso Ingenieria Aplicada)',
  email: process.env.NOMINATIM_EMAIL || undefined,
})

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const slug = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const towns = []
const missing: string[] = []
for (const entry of TOWNS) {
  const query = `${entry.query ?? entry.name}, ${entry.region}, Colombia`
  const result = await osm.geocode(query)
  // Solo se acepta si Nominatim lo ubica en el departamento indicado.
  const inRegion = result !== null && normalize(result.displayName).includes(normalize(entry.region))
  const nearExpected =
    result !== null && entry.near !== undefined && haversineKm(result, { lat: entry.near[0], lon: entry.near[1] }) < 30
  if (!result || !(inRegion || nearExpected)) {
    missing.push(`${entry.name} (${result?.displayName ?? 'sin resultado'})`)
    continue
  }
  towns.push({
    id: slug(entry.name),
    name: entry.name,
    region: entry.region,
    tagline: entry.tagline,
    lat: Math.round(result.lat * 1e5) / 1e5,
    lon: Math.round(result.lon * 1e5) / 1e5,
  })
  console.log(`✓ ${entry.name}: ${result.displayName} (${result.lat.toFixed(4)}, ${result.lon.toFixed(4)})`)
}

writeFileSync(
  new URL('../src/data/touristTowns.json', import.meta.url),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Coordenadas: Nominatim / OpenStreetMap', towns }, null, 2)}\n`,
)
console.log(`\n${towns.length} pueblos guardados en src/data/touristTowns.json`)
if (missing.length) console.log(`No encontrados (revisar): ${missing.join('; ')}`)
