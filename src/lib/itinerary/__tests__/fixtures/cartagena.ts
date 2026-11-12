/**
 * Datos de ejemplo para las pruebas: respuestas con la MISMA FORMA que
 * devuelven Nominatim y Overpass para Cartagena. Los lugares son reales, pero
 * las coordenadas son aproximadas y los IDs inventados: sirven solo para
 * probar el motor sin conexión. Para probar con datos en vivo usa
 * `npm run demo:engine`.
 */
import type { NominatimResult, OverpassResponse } from '../../osm'

export const nominatimCartagena: NominatimResult[] = [
  {
    lat: '10.4265566',
    lon: '-75.5441671',
    display_name: 'Cartagena de Indias, Bolívar, Colombia',
    boundingbox: ['10.2665566', '10.5865566', '-75.7041671', '-75.3841671'],
  },
]

export const overpassCartagena: OverpassResponse = {
  elements: [
    // --- Cultura ---
    { type: 'node', id: 1001, lat: 10.4232, lon: -75.5508, tags: { name: 'Museo del Oro Zenú', tourism: 'museum', wikidata: 'Q1' } },
    // Mismo museo mapeado también como edificio: debe eliminarse por duplicado.
    { type: 'way', id: 1002, center: { lat: 10.4233, lon: -75.5507 }, tags: { name: 'Museo del Oro Zenú', tourism: 'museum' } },
    { type: 'way', id: 1003, center: { lat: 10.4229, lon: -75.5513 }, tags: { name: 'Palacio de la Inquisición', tourism: 'museum', wikidata: 'Q2', website: 'https://example.org' } },
    { type: 'way', id: 1004, center: { lat: 10.4227, lon: -75.539 }, tags: { name: 'Castillo San Felipe de Barajas', historic: 'castle', wikidata: 'Q3' } },
    { type: 'node', id: 1005, lat: 10.4206, lon: -75.5489, tags: { name: 'Museo Naval del Caribe', tourism: 'museum', website: 'https://example.org' } },
    { type: 'node', id: 1006, lat: 10.4251, lon: -75.547, tags: { name: 'Teatro Adolfo Mejía', amenity: 'theatre' } },

    // --- Gastronomía ---
    { type: 'node', id: 2001, lat: 10.4268, lon: -75.5496, tags: { name: 'La Cevichería', amenity: 'restaurant', website: 'https://example.org', opening_hours: 'Mo-Su 12:00-23:00' } },
    { type: 'node', id: 2002, lat: 10.4243, lon: -75.5507, tags: { name: 'Café San Alberto', amenity: 'cafe' } },
    { type: 'node', id: 2003, lat: 10.4153, lon: -75.542, tags: { name: 'Club de Pesca', amenity: 'restaurant', website: 'https://example.org' } },
    { type: 'node', id: 2004, lat: 10.399, lon: -75.556, tags: { name: 'Crepes & Waffles Bocagrande', amenity: 'restaurant' } },
    // Restaurante sin nombre: debe descartarse.
    { type: 'node', id: 2005, lat: 10.42, lon: -75.55, tags: { amenity: 'restaurant' } },

    // --- Playa ---
    { type: 'way', id: 3001, center: { lat: 10.3985, lon: -75.558 }, tags: { name: 'Playa de Bocagrande', natural: 'beach', wikidata: 'Q4' } },
    { type: 'way', id: 3002, center: { lat: 10.394, lon: -75.562 }, tags: { name: 'Playa del Laguito', natural: 'beach' } },

    // --- Vida nocturna ---
    { type: 'node', id: 4001, lat: 10.4245, lon: -75.553, tags: { name: 'Café del Mar', amenity: 'bar', website: 'https://example.org' } },
    { type: 'node', id: 4002, lat: 10.4262, lon: -75.547, tags: { name: 'Alquímico', amenity: 'bar' } },

    // Elemento sin coordenadas: debe descartarse.
    { type: 'relation', id: 9001, tags: { name: 'Relación sin centro', tourism: 'museum' } },
  ],
}
