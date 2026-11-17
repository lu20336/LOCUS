/**
 * Mapa de un día del itinerario: el punto de partida (centro del destino),
 * los lugares numerados en el orden de visita y la ruta entre ellos.
 *
 * Usa MapLibre GL JS con teselas de OpenFreeMap (datos de OpenStreetMap): es el
 * mismo mapa de toda la app, cambia con el tema claro/oscuro y no usa los
 * servidores de teselas de openstreetmap.org (cuya política limita el uso
 * intensivo). Se carga con React.lazy solo al llegar al Paso 3.
 *
 * La línea une los lugares en línea recta (es el orden de visita, no el
 * trazado por calles). La misma información está en la lista del día, que es
 * la que leen los lectores de pantalla.
 *
 * Los marcadores usan las clases .locus-marker / .locus-start de index.css.
 */
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { currentTheme, mapStyleFor } from '../lib/maps/MapView'
import type { GeoPoint, Place } from '../types/itinerary'

interface DayMapProps {
  start: GeoPoint
  places: readonly Place[]
  /** Nombre accesible del mapa, ej. "Mapa del día 1". */
  label: string
  /** Lugar resaltado (al pasar sobre él en la lista). */
  activeId?: string | null
}

const ROUTE_SOURCE = 'day-route'
const ROUTE_LAYER = 'day-route-line'

function numberedElement(text: string, className: string): HTMLElement {
  const el = document.createElement('div')
  el.className = className
  const span = document.createElement('span')
  span.textContent = text
  el.appendChild(span)
  return el
}

export default function DayMap({ start, places, label, activeId = null }: DayMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markers = useRef<Marker[]>([])
  const elements = useRef(new globalThis.Map<string, HTMLElement>())
  const routeCoords = useRef<[number, number][]>([])

  /** (Re)dibuja la línea de ruta: hay que repetirlo cuando el mapa cambia de estilo (tema). */
  function drawRoute() {
    const instance = map.current
    if (!instance || !instance.isStyleLoaded()) return
    const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: routeCoords.current } }
    const source = instance.getSource(ROUTE_SOURCE)
    if (source && 'setData' in source) {
      ;(source as { setData: (d: typeof data) => void }).setData(data)
    } else {
      instance.addSource(ROUTE_SOURCE, { type: 'geojson', data })
      instance.addLayer({
        id: ROUTE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#00A699', 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [2, 2] },
      })
    }
  }

  // Crear el mapa una vez.
  useEffect(() => {
    if (!container.current) return
    const instance = new MapLibreMap({
      container: container.current,
      style: mapStyleFor(currentTheme()),
      center: [start.lon, start.lat],
      zoom: 12,
      scrollZoom: false, // la rueda del ratón sigue bajando la página
      attributionControl: { compact: true },
    })
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instance.on('style.load', drawRoute)
    map.current = instance
    const observer = new MutationObserver(() => instance.setStyle(mapStyleFor(currentTheme())))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      observer.disconnect()
      markers.current = []
      instance.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dibujar el día (cada vez que cambian los lugares).
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    for (const marker of markers.current) marker.remove()
    markers.current = []
    elements.current.clear()

    const startEl = numberedElement('', 'locus-start')
    startEl.title = 'Punto de partida (centro)'
    markers.current.push(new Marker({ element: startEl }).setLngLat([start.lon, start.lat]).addTo(instance))

    places.forEach((place, i) => {
      const el = numberedElement(String(i + 1), 'locus-marker')
      el.title = `${i + 1}. ${place.name}`
      const popup = new Popup({ offset: 18, closeButton: false })
      const strong = document.createElement('strong')
      strong.textContent = `${i + 1}. ${place.name}`
      const detail = document.createElement('div')
      detail.textContent = place.kind
      const content = document.createElement('div')
      content.append(strong, detail)
      popup.setDOMContent(content)
      markers.current.push(new Marker({ element: el }).setLngLat([place.lon, place.lat]).setPopup(popup).addTo(instance))
      elements.current.set(place.id, el)
    })

    routeCoords.current = [[start.lon, start.lat], ...places.map((p): [number, number] => [p.lon, p.lat])]
    const bounds = routeCoords.current.reduce((b, c) => b.extend(c), new LngLatBounds(routeCoords.current[0], routeCoords.current[0]))
    instance.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 })
    drawRoute()
    // Si el estilo aún no cargó, 'style.load' dibujará la ruta.
    instance.once('load', drawRoute)
    // Si el contenedor cambió de tamaño (pestañas, giro del celular), recalcular.
    setTimeout(() => instance.resize(), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.lat, start.lon, places])

  // Resaltar el lugar activo.
  useEffect(() => {
    for (const [id, el] of elements.current) {
      el.classList.toggle('is-active', id === activeId)
      el.style.zIndex = id === activeId ? '5' : ''
    }
  }, [activeId, places])

  return <div ref={container} role="region" aria-label={label} className="locus-map h-72 w-full sm:h-96" />
}
