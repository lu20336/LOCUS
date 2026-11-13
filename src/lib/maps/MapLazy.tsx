import { lazy, Suspense } from 'react'
import type { MapViewProps } from './MapView'

export type { MapMarker, MapViewProps } from './MapView'

// MapLibre pesa ~200 kB: solo se descarga en las pantallas que muestran un mapa.
const MapView = lazy(() => import('./MapView'))

export function LocusMap(props: MapViewProps) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Cargando el mapa"
          className={`grid w-full place-items-center rounded-2xl border border-line bg-surface-2 text-sm text-muted ${props.className ?? 'h-[28rem]'}`}
        >
          Cargando el mapa…
        </div>
      }
    >
      <MapView {...props} />
    </Suspense>
  )
}
