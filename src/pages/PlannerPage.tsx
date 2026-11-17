/**
 * Planificador de viajes: Pasos 2, 3 y 4 (el Paso 1 es la portada).
 *   2 · Actividades  → eliges qué te gusta hacer.
 *   3 · Itinerario   → el motor arma un plan día a día con lugares reales (OSM).
 *   4 · Confirmación → guardas el plan en tu cuenta y sigues con hospedaje.
 */
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ChipGroup } from '../components/ChipGroup'
import { CATEGORY_OPTIONS } from '../components/choiceOptions'
import { ItineraryView } from '../components/ItineraryView'
import { StaysSection } from '../components/StaysSection'
import { Stepper } from '../components/Stepper'
import { Alert, Button, ButtonLink, Card } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { db } from '../lib/firebase/client'
import { countTripDays, formatCOP, formatDate } from '../lib/format'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { placesClient, placesSource } from '../lib/itinerary/fallbackClient'
import { ItineraryError } from '../lib/itinerary/errors'
import { buildItinerary } from '../lib/itinerary/generateItinerary'
import { saveNewItinerary, toPayload } from '../lib/itinerary/itineraryStore'
import type { CategoryId } from '../types/itinerary'

function ActivitiesStep() {
  const { trip, categories, setCategories, setItinerary, goToStep } = useTripFlow()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (!trip) return null

  async function generate(selected: CategoryId[]) {
    if (!trip) return
    if (selected.length === 0) {
      setError('Elige al menos una actividad.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const itinerary = await buildItinerary(
        trip.destination,
        { destination: trip.destination.displayName, startDate: trip.startDate, endDate: trip.endDate, budgetCOP: trip.budgetCOP, categories: selected },
        placesClient,
      )
      setItinerary(itinerary)
      goToStep(3)
    } catch (e) {
      setError(e instanceof ItineraryError ? e.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const days = countTripDays(trip.startDate, trip.endDate)
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Paso 2 de 4</p>
      <h1 id="step-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
        ¿Qué te gustaría hacer?
      </h1>
      <p className="mt-2 text-muted">
        {trip.destination.displayName.split(',')[0]} · {days} {days === 1 ? 'día' : 'días'} · {formatCOP(trip.budgetCOP)}. Con esto buscamos lugares reales cerca y armamos tu plan en el orden que menos te hace recorrer.
      </p>

      <form
        className="mt-6 flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void generate(categories)
        }}
      >
        <ChipGroup
          name="categories"
          legend="Actividades"
          type="checkbox"
          options={CATEGORY_OPTIONS}
          value={categories}
          onChange={(next) => {
            setError(null)
            setCategories(next)
          }}
          disabled={loading}
        />
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="border border-line" onClick={() => goToStep(1)} disabled={loading}>← Editar mi viaje</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Buscando lugares reales…' : 'Armar mi itinerario →'}
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">{loading ? 'Armando tu itinerario' : ''}</p>
      </form>
    </Card>
  )
}

function ItineraryStep() {
  const { trip, itinerary, goToStep } = useTripFlow()
  if (!trip || !itinerary) return <Navigate to="/planear" replace />
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Paso 3 de 4</p>
        <h1 id="step-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
          Tu itinerario por {itinerary.destination.displayName.split(',')[0]}
        </h1>
        <p className="mt-2 text-muted">
          Recorrido optimizado: {itinerary.stats.optimizedKm} km
          {itinerary.stats.savingPercent > 0 && <> (un {itinerary.stats.savingPercent} % menos que sin ordenar)</>}.
        </p>
        {placesSource.last !== 'live' && (
          <div className="mt-3"><Alert tone="info">El servicio principal de mapas está ocupado: armamos el plan con {placesSource.last === 'static' ? 'lugares guardados' : 'una fuente alternativa'} de OpenStreetMap (menos lugares y pueden no estar actualizados).</Alert></div>
        )}
        {itinerary.missingCategories.length > 0 && (
          <div className="mt-3"><Alert tone="info">No encontramos lugares para alguna de las actividades elegidas en esta zona.</Alert></div>
        )}
      </div>
      <ItineraryView itinerary={itinerary} />
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="ghost" className="border border-line" onClick={() => goToStep(2)}>← Cambiar actividades</Button>
        <Button onClick={() => goToStep(4)}>Continuar →</Button>
      </div>
    </div>
  )
}

function ConfirmStep() {
  const { trip, itinerary, goToStep } = useTripFlow()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!trip || !itinerary) return <Navigate to="/planear" replace />

  async function save() {
    if (!user || !trip || !itinerary) return
    setSaving(true)
    setError(null)
    try {
      setSavedId(await saveNewItinerary(db, user.uid, toPayload(itinerary, trip.travelers, 'planner')))
    } catch {
      setError('No pudimos guardar tu itinerario. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const name = itinerary.destination.displayName.split(',')[0]
  return (
    <div className="flex flex-col gap-8">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Paso 4 de 4</p>
        <h1 id="step-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
          Confirma tu plan
        </h1>
        <dl className="mt-5 grid gap-4 rounded-2xl bg-surface-2 p-5 sm:grid-cols-3">
          <div><dt className="text-sm text-muted">Destino</dt><dd className="font-semibold text-ink">{name}</dd></div>
          <div><dt className="text-sm text-muted">Fechas</dt><dd className="font-semibold text-ink">{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</dd></div>
          <div><dt className="text-sm text-muted">Viajeros</dt><dd className="font-semibold text-ink">{trip.travelers} · presupuesto {formatCOP(trip.budgetCOP)}</dd></div>
        </dl>

        <div className="mt-6 flex flex-col gap-3">
          {savedId ? (
            <Alert tone="success">
              ¡Listo! Guardamos tu itinerario. Puedes <Link className="font-semibold underline" to={`/itinerarios/${savedId}`}>verlo y editarlo</Link> cuando quieras.
            </Alert>
          ) : user ? (
            <Button onClick={save} disabled={saving} className="self-start">{saving ? 'Guardando…' : 'Guardar en mi cuenta'}</Button>
          ) : (
            <Alert tone="info">
              Para guardar tu itinerario necesitas una cuenta (gratis).{' '}
              <Link className="font-semibold underline" to="/ingresar?next=/planear">Ingresa o regístrate</Link>; tu plan se conserva mientras no cierres la pestaña.
            </Alert>
          )}
          {error && <Alert>{error}</Alert>}
          <Button variant="ghost" className="self-start border border-line" onClick={() => goToStep(3)}>← Volver al itinerario</Button>
        </div>
      </Card>

      <StaysSection lat={itinerary.destination.lat} lon={itinerary.destination.lon} placeName={name} checkIn={trip.startDate} checkOut={trip.endDate} guests={trip.travelers} />

      <Card>
        <h2 className="text-xl font-semibold text-navy">¿Cómo llegar?</h2>
        <p className="mt-1 text-muted">Consulta vuelos hacia {name} desde tu ciudad.</p>
        <div className="mt-4">
          <ButtonLink to={`/vuelos?destino=${encodeURIComponent(name)}&fecha=${trip.startDate}`} variant="secondary">Buscar vuelos</ButtonLink>
        </div>
      </Card>
    </div>
  )
}

export function PlannerPage() {
  const { step, trip } = useTripFlow()
  if (!trip || step === 1) return <Navigate to="/" replace />
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Stepper current={step} />
      <div className="mt-6">
        {step === 2 && <ActivitiesStep />}
        {step === 3 && <ItineraryStep />}
        {step === 4 && <ConfirmStep />}
      </div>
    </div>
  )
}
