/**
 * Mapa de LOCUS: MapLibre GL JS + teselas vectoriales de OpenFreeMap (datos de
 * OpenStreetMap). OpenFreeMap es gratuito, sin API key ni límite de vistas, y
 * permite uso comercial (atribución obligatoria: MapLibre la muestra sola).
 * Se carga de forma perezosa (React.lazy en MapLazy.tsx) porque pesa ~200 kB.
 *
 * Modos:
 *  - Marcadores con etiqueta (precio) y selección sincronizada con las tarjetas.
 *  - Selector de ubicación (`onPick`): clic en el mapa o arrastrar el pin.
 */
import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)

export interface MapMarker {
  id: string
  lat: number
  lon: number
  /** Texto del marcador (ej. "$ 200.000"). Sin texto, se muestra un pin. */
  label?: string
  kind?: 'listing' | 'experience' | 'place' | 'lodging-osm'
}

export interface MapViewProps {
  markers?: MapMarker[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Centro inicial [lat, lon]; por defecto, el centro de Colombia. */
  center?: [number, number]
  zoom?: number
  /** Ajusta la vista para que se vean todos los marcadores. */
  fitMarkers?: boolean
  /** Modo selector: devuelve la posición elegida. */
  onPick?: (lat: number, lon: number) => void
  pickedPoint?: { lat: number; lon: number } | null
  className?: string
  ariaLabel?: string
}

const COLOMBIA_CENTER: [number, number] = [4.57, -74.3]
/** Estilo de OpenFreeMap según el tema (claro/oscuro). */
export const mapStyleFor = (theme: string) =>
  theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron'
export const currentTheme = () => document.documentElement.getAttribute('data-theme') ?? 'light'
const styleFor = mapStyleFor

function markerElement(marker: MapMarker, selected: boolean, onClick: () => void): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.setAttribute('aria-label', marker.label ? `${marker.label}` : 'Ver detalles')
  el.dataset.markerId = marker.id
  const base =
    'font-weight:700;font-size:13px;line-height:1;border-radius:999px;cursor:pointer;white-space:nowrap;border:2px solid;transition:transform .15s;'
  if (marker.label) {
    el.textContent = marker.label
    el.style.cssText = `${base}padding:7px 10px;`
  } else {
    el.style.cssText = `${base}width:18px;height:18px;padding:0;`
  }
  applySelected(el, selected, marker.kind)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

function applySelected(el: HTMLElement, selected: boolean, kind: MapMarker['kind']) {
  const osm = kind === 'lodging-osm' || kind === 'place'
  const bg = selected ? '#003366' : osm ? '#EDF1F5' : '#FFFFFF'
  const fg = selected ? '#FFFFFF' : '#003366'
  el.style.background = bg
  el.style.color = fg
  el.style.borderColor = selected ? '#00A699' : osm ? '#5C7A99' : '#003366'
  el.style.boxShadow = selected ? '0 4px 14px rgba(0,51,102,.45)' : '0 2px 6px rgba(0,0,0,.25)'
  el.style.transform = selected ? 'scale(1.15)' : 'scale(1)'
  el.style.zIndex = selected ? '5' : '1'
}

export default function MapView({
  markers = [],
  selectedId = null,
  onSelect,
  center = COLOMBIA_CENTER,
  zoom = 5,
  fitMarkers = true,
  onPick,
  pickedPoint = null,
  className = 'h-[28rem]',
  ariaLabel = 'Mapa interactivo',
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRefs = useRef<globalThis.Map<string, { marker: Marker; el: HTMLElement; kind: MapMarker['kind'] }>>(new globalThis.Map())
  const pickRef = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  const onPickRef = useRef(onPick)
  const initial = useRef({ center, zoom })

  useEffect(() => {
    onSelectRef.current = onSelect
    onPickRef.current = onPick
  })

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleFor(currentTheme()),
      center: [initial.current.center[1], initial.current.center[0]],
      zoom: initial.current.zoom,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (e) => onPickRef.current?.(e.lngLat.lat, e.lngLat.lng))
    mapRef.current = map
    const markersMap = markerRefs.current

    // Cambiar de tema claro/oscuro cambia el estilo del mapa.
    const observer = new MutationObserver(() => map.setStyle(styleFor(currentTheme())))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
      markersMap.clear()
      pickRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sincronizar marcadores.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const refs = markerRefs.current
    for (const { marker } of refs.values()) marker.remove()
    refs.clear()
    for (const m of markers) {
      const el = markerElement(m, m.id === selectedId, () => onSelectRef.current?.(m.id))
      const marker = new Marker({ element: el }).setLngLat([m.lon, m.lat]).addTo(map)
      refs.set(m.id, { marker, el, kind: m.kind })
    }
    if (fitMarkers && markers.length > 0) {
      if (markers.length === 1) {
        map.easeTo({ center: [markers[0].lon, markers[0].lat], zoom: Math.max(map.getZoom(), 13), duration: 400 })
      } else {
        const lons = markers.map((m) => m.lon)
        const lats = markers.map((m) => m.lat)
        const bounds: LngLatBoundsLike = [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ]
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 400 })
      }
    }
    // selectedId se trata aparte para no re-encuadrar al seleccionar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, fitMarkers])

  // Resaltar el marcador seleccionado.
  useEffect(() => {
    for (const [id, ref] of markerRefs.current) applySelected(ref.el, id === selectedId, ref.kind)
    const map = mapRef.current
    const selected = markers.find((m) => m.id === selectedId)
    if (map && selected) map.easeTo({ center: [selected.lon, selected.lat], duration: 350 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Pin del modo selector (arrastrable).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!pickedPoint) {
      pickRef.current?.remove()
      pickRef.current = null
      return
    }
    if (!pickRef.current) {
      const marker = new Marker({ color: '#FF5A5F', draggable: true }).setLngLat([pickedPoint.lon, pickedPoint.lat]).addTo(map)
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat()
        onPickRef.current?.(lat, lng)
      })
      pickRef.current = marker
    } else {
      pickRef.current.setLngLat([pickedPoint.lon, pickedPoint.lat])
    }
    map.easeTo({ center: [pickedPoint.lon, pickedPoint.lat], zoom: Math.max(map.getZoom(), 14), duration: 400 })
  }, [pickedPoint])

  return <div ref={containerRef} role="region" aria-label={ariaLabel} className={`w-full overflow-hidden rounded-2xl border border-line ${className}`} />
}
