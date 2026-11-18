/**
 * "Completa tu viaje" (Paso 4): todo lo que falta después del itinerario, cada
 * cosa a un clic y con destino, fechas y viajeros ya puestos en el comparador.
 * Incluye compartir el plan (WhatsApp / compartir del sistema): crece LOCUS de
 * boca en boca sin pedir datos de nadie.
 */
import { Hotel, Plane, Share2, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { formatDateRange } from '../lib/format'
import { Button, Card } from './ui'

export function CompleteTrip({ place, startDate, endDate, travelers, days }: { place: string; startDate: string; endDate: string; travelers: number; days: number }) {
  const base = new URLSearchParams({ destino: place, llegada: startDate, salida: endDate, huespedes: String(travelers) })
  const to = (tipo: string) => `/comparar?${new URLSearchParams({ tipo, ...Object.fromEntries(base) }).toString()}`
  const tiles: { tipo: string; icon: LucideIcon; title: string; text: string }[] = [
    { tipo: 'alojamiento', icon: Hotel, title: 'Hospedaje', text: 'Compara y reserva dónde dormir.' },
    { tipo: 'vuelos', icon: Plane, title: 'Vuelos', text: `Cómo llegar a ${place}.` },
    { tipo: 'experiencias', icon: Ticket, title: 'Experiencias', text: 'Tours y actividades locales.' },
    { tipo: 'transporte', icon: ShieldCheck, title: 'Transporte y seguro', text: 'Bus, carro y asistencia.' },
  ]

  const [shared, setShared] = useState<string | null>(null)
  async function share() {
    const text = `Mi viaje a ${place}: ${formatDateRange(startDate, endDate)} · ${days} ${days === 1 ? 'día' : 'días'}. Lo planeé con LOCUS.`
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: `Viaje a ${place}`, text, url })
        return
      }
    } catch {
      return // el usuario canceló
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer')
    setShared('Abrimos WhatsApp con el mensaje listo.')
  }

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-navy">Completa tu viaje a {place}</h2>
      <p className="mt-1 text-muted">Todo en un solo lugar: elegimos las plataformas, tú eliges cuál conviene.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.tipo}>
            <Link
              to={to(t.tipo)}
              className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface-2 p-4 transition hover:border-teal hover:bg-teal/10"
            >
              <t.icon aria-hidden="true" className="size-6 text-teal-soft" />
              <span className="font-semibold text-ink">{t.title}</span>
              <span className="text-sm text-muted">{t.text}</span>
              <span className="mt-auto pt-2 text-sm font-bold text-teal-soft">Comparar →</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button variant="secondary" onClick={share}>
          <Share2 aria-hidden="true" className="size-4" />
          Compartir mi plan
        </Button>
        <span aria-live="polite" className="text-sm text-muted">
          {shared}
        </span>
      </div>
    </Card>
  )
}
