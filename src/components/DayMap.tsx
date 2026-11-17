/**
 * Mapa de un día del itinerario: el punto de partida (centro del destino),
 * los lugares numerados en el orden de visita y la ruta entre ellos.
 *
 * Usa Leaflet con los mapas libres de OpenStreetMap. Se carga con React.lazy
 * solo al llegar al Paso 3, así no pesa en la portada.
 *
 * La línea une los lugares en línea recta (es el orden de visita, no el
 * trazado por calles). La misma información está en la lista del día, que es
 * la que leen los lectores de pantalla.
 */
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { GeoPoint, Place } from '../types/itinerary'

interface DayMapProps {
  start: GeoPoint
  places: readonly Place[]
  /** Nombre accesible del mapa, ej. "Mapa del día 1". */
  label: string
  /** Lugar resaltado (al pasar sobre él en la lista). */
  activeId?: string | null
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export default function DayMap({ start, places, label, activeId = null }: DayMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())

  // Crear el mapa una vez.
  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current, {
      scrollWheelZoom: false, // la rueda del ratón sigue bajando la página
      zoomControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance)
    layer.current = L.layerGroup().addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      layer.current = null
    }
  }, [])

  // Dibujar el día (cada vez que cambian los lugares).
  useEffect(() => {
    const instance = map.current
    const group = layer.current
    if (!instance || !group) return
    group.clearLayers()
    markers.current.clear()

    const startLatLng = L.latLng(start.lat, start.lon)
    L.marker(startLatLng, {
      icon: L.divIcon({ className: 'locus-start', html: '<span></span>', iconSize: [18, 18] }),
      title: 'Punto de partida (centro)',
      keyboard: false,
    }).addTo(group)

    const route = [startLatLng, ...places.map((p) => L.latLng(p.lat, p.lon))]
    // Color con CSS (.locus-route): un atributo SVG no entiende var(--primary).
    L.polyline(route, { className: 'locus-route', weight: 3, opacity: 0.85, dashArray: '6 8' }).addTo(group)

    places.forEach((place, i) => {
      const marker = L.marker([place.lat, place.lon], {
        icon: L.divIcon({
          className: 'locus-marker',
          html: `<span>${i + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: `${i + 1}. ${place.name}`,
        riseOnHover: true,
      })
        .bindPopup(`<strong>${i + 1}. ${escapeHtml(place.name)}</strong><br>${escapeHtml(place.kind)}`)
        .addTo(group)
      markers.current.set(place.id, marker)
    })

    instance.fitBounds(L.latLngBounds(route), { padding: [28, 28], maxZoom: 16 })
    // Si el contenedor cambió de tamaño (pestañas, giro del celular), recalcular.
    setTimeout(() => instance.invalidateSize(), 0)
  }, [start.lat, start.lon, places])

  // Resaltar el lugar activo.
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement()?.classList.toggle('is-active', id === activeId)
      if (id === activeId) marker.setZIndexOffset(1000)
      else marker.setZIndexOffset(0)
    }
  }, [activeId, places])

  return <div ref={container} role="region" aria-label={label} className="locus-map h-72 w-full sm:h-96" />
}
