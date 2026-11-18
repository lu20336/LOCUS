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
import { useI18n } from '../lib/i18n/I18nProvider'
import { Button, Card } from './ui'

export function CompleteTrip({ place, startDate, endDate, travelers, days }: { place: string; startDate: string; endDate: string; travelers: number; days: number }) {
  const { t } = useI18n()
  const base = new URLSearchParams({ destino: place, llegada: startDate, salida: endDate, huespedes: String(travelers) })
  const to = (tipo: string) => `/comparar?${new URLSearchParams({ tipo, ...Object.fromEntries(base) }).toString()}`
  const tiles: { tipo: string; icon: LucideIcon; title: string; text: string }[] = [
    { tipo: 'alojamiento', icon: Hotel, title: t('complete.stay'), text: t('complete.stayText') },
    { tipo: 'vuelos', icon: Plane, title: t('complete.flights'), text: t('complete.flightsText', { place }) },
    { tipo: 'experiencias', icon: Ticket, title: t('complete.experiences'), text: t('complete.experiencesText') },
    { tipo: 'transporte', icon: ShieldCheck, title: t('complete.transport'), text: t('complete.transportText') },
  ]

  const [shared, setShared] = useState<string | null>(null)
  async function share() {
    const text = t('complete.shareText', { place, dates: formatDateRange(startDate, endDate), days: t('common.days', { count: days }) })
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: t('complete.shareTitle', { place }), text, url })
        return
      }
    } catch {
      return // el usuario canceló
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer')
    setShared(t('complete.whatsappOpened'))
  }

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-navy">{t('complete.title', { place })}</h2>
      <p className="mt-1 text-muted">{t('complete.subtitle')}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.tipo}>
            <Link
              to={to(tile.tipo)}
              className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface-2 p-4 transition hover:border-teal hover:bg-teal/10"
            >
              <tile.icon aria-hidden="true" className="size-6 text-teal-soft" />
              <span className="font-semibold text-ink">{tile.title}</span>
              <span className="text-sm text-muted">{tile.text}</span>
              <span className="mt-auto pt-2 text-sm font-bold text-teal-soft">{t('complete.compare')}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button variant="secondary" onClick={share}>
          <Share2 aria-hidden="true" className="size-4" />
          {t('complete.sharePlan')}
        </Button>
        <span aria-live="polite" className="text-sm text-muted">
          {shared}
        </span>
      </div>
    </Card>
  )
}
