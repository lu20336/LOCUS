/**
 * Vuelos: descubrimiento, NO venta. LOCUS no emite tiquetes ni muestra precios:
 * no hay una API gratuita de vuelos con cobertura nacional en Colombia (ver
 * docs/PROVEEDORES.md). Se sugieren aeropuertos y se abre la búsqueda en el
 * proveedor elegido, donde el usuario ve las tarifas reales y compra.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Counter } from '../components/Counter'
import { inputClassName } from '../components/FormField'
import { Alert, Badge, Card, Container, PageHeader, selectClassName } from '../components/ui'
import { AIRLINE_SITES, AIRPORTS, findAirport, flightLinks } from '../lib/flights/airports'
import { todayISO } from '../lib/format'

export default function FlightsPage() {
  const [params] = useSearchParams()
  const today = todayISO()
  const [origin, setOrigin] = useState('BOG')
  const [dest, setDest] = useState(findAirport(params.get('destino') ?? '')?.iata ?? 'CTG')
  const [date, setDate] = useState(params.get('fecha') ?? '')
  const [returnDate, setReturnDate] = useState('')
  const [passengers, setPassengers] = useState(1)

  const problem = useMemo(() => {
    if (origin === dest) return 'El origen y el destino son el mismo aeropuerto.'
    if (!date) return 'Elige la fecha de ida.'
    if (date < today) return 'La fecha de ida no puede estar en el pasado.'
    if (returnDate && returnDate < date) return 'El regreso debe ser posterior a la ida.'
    return null
  }, [origin, dest, date, returnDate, today])
  const links = problem ? [] : flightLinks(origin, dest, date, returnDate || undefined, passengers)

  const airportOptions = AIRPORTS.map((a) => <option key={a.iata} value={a.iata}>{a.city} · {a.name} ({a.iata})</option>)

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow="Vuelos" title="Encuentra cómo llegar">Elige tu ruta y abre la búsqueda en el proveedor para ver precios y comprar.</PageHeader>

      <Alert tone="info">
        <strong>LOCUS no vende tiquetes ni muestra tarifas.</strong> No existe todavía una conexión gratuita con aerolíneas colombianas para consultar precios dentro de la plataforma; por eso te llevamos a buscadores externos con tu ruta ya llena.
      </Alert>

      <Card className="mt-6">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <div><label htmlFor="f-o" className="text-sm font-semibold text-ink">Origen</label><select id="f-o" value={origin} onChange={(e) => setOrigin(e.target.value)} className={`${selectClassName} mt-1`}>{airportOptions}</select></div>
          <div><label htmlFor="f-d" className="text-sm font-semibold text-ink">Destino</label><select id="f-d" value={dest} onChange={(e) => setDest(e.target.value)} className={`${selectClassName} mt-1`}>{airportOptions}</select></div>
          <div><label htmlFor="f-date" className="text-sm font-semibold text-ink">Ida</label><input id="f-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClassName} mt-1`} /></div>
          <div><label htmlFor="f-ret" className="text-sm font-semibold text-ink">Regreso (opcional)</label><input id="f-ret" type="date" min={date || today} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={`${inputClassName} mt-1`} /></div>
          <div className="sm:col-span-2"><Counter label="Pasajeros" icon="🧑" unit="un pasajero" value={passengers} min={1} max={9} onChange={setPassengers} /></div>
        </form>
        {problem && <p className="mt-3 text-sm text-muted" aria-live="polite">{problem}</p>}
      </Card>

      {links.length > 0 && (
        <section aria-labelledby="res" className="mt-6">
          <h2 id="res" className="text-2xl font-semibold text-navy">Buscar en…</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {links.map((l) => (
              <li key={l.provider} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                <div><p className="font-semibold text-ink">{l.provider} <Badge>Sitio externo</Badge></p><p className="text-sm text-muted">{l.note}</p></div>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center rounded-xl bg-coral px-4 py-2 font-bold text-on-coral hover:brightness-105">Ver vuelos ↗</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="air" className="mt-8">
        <h2 id="air" className="text-xl font-semibold text-navy">Aerolíneas que vuelan en Colombia</h2>
        <p className="mt-1 text-sm text-muted">Sitios oficiales (no verificamos sus tarifas).</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {AIRLINE_SITES.map((a) => <li key={a.provider}><a href={a.url} target="_blank" rel="noreferrer noopener" className="inline-block rounded-xl border border-line px-4 py-2 font-semibold text-teal-soft hover:bg-surface-2">{a.provider} ↗</a></li>)}
        </ul>
      </section>
    </Container>
  )
}
