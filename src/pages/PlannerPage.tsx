/**
 * Planificador de viajes: Pasos 2, 3 y 4 (el Paso 1 es la portada).
 *   2 · Actividades  → eliges qué te gusta hacer.
 *   3 · Itinerario   → el motor arma un plan día a día con lugares reales (OSM).
 *   4 · Confirmación → guardas el plan en tu cuenta y sigues con hospedaje.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { CompleteTrip } from '../components/CompleteTrip'
import { PlanSummary } from '../components/PlanSummary'
import { useToast } from '../components/Toast'
import { StaysSection } from '../components/StaysSection'
import { Stepper } from '../components/Stepper'
import { ActivitiesStep } from './ActivitiesStep'
import { ItineraryStep } from './ItineraryStep'
import { Alert, Button, Card } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { db } from '../lib/firebase/client'
import { formatCOP, formatDate } from '../lib/format'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { estimateTripBudget } from '../lib/flow/tripBudget'
import { saveNewItinerary, toPayload } from '../lib/itinerary/itineraryStore'

function ConfirmStep() {
  const { trip, itinerary, goToStep } = useTripFlow()
  const { user } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!trip || !itinerary) return <Navigate to="/planear" replace />

  async function save() {
    if (!user || !trip || !itinerary) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveNewItinerary(db, user.uid, toPayload(itinerary, trip.travelers, 'planner'))
      setSavedId(id)
      toast('Guardado en Mis viajes', { action: { label: 'Ver viaje', to: `/mis-viajes/${id}` } })
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
              ¡Listo! Guardamos tu itinerario. Puedes <Link className="font-semibold underline" to={`/mis-viajes/${savedId}`}>verlo y editarlo</Link> cuando quieras, o encontrarlo siempre en <Link className="font-semibold underline" to="/mis-viajes">Mis viajes</Link>.
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

      <PlanSummary itinerary={itinerary} trip={trip} />

      <StaysSection
        lat={itinerary.destination.lat}
        lon={itinerary.destination.lon}
        placeName={name}
        checkIn={trip.startDate}
        checkOut={trip.endDate}
        guests={trip.travelers}
        lodgingAllowance={estimateTripBudget(itinerary, trip).lodgingAllowance}
      />

      <CompleteTrip
        place={name}
        startDate={trip.startDate}
        endDate={trip.endDate}
        travelers={trip.travelers}
        days={itinerary.days.length}
      />
    </div>
  )
}

export function PlannerPage() {
  const { step, trip } = useTripFlow()
  // Los Pasos 2, 3 y 4 comparten la ruta /planear, así que el efecto general
  // de cambio de página (App.tsx) no se dispara: al cambiar de paso se sube al
  // inicio y el foco va al título (teclado y lectores de pantalla).
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.getElementById('step-title')?.focus({ preventScroll: true })
  }, [step])
  if (!trip || step === 1) return <Navigate to="/" replace />
  return (
    <div className={`mx-auto px-4 py-8 sm:py-12 ${step === 4 ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <Stepper current={step} />
      <div className="mt-6">
        {step === 2 && <ActivitiesStep />}
        {step === 3 && <ItineraryStep />}
        {step === 4 && <ConfirmStep />}
      </div>
    </div>
  )
}
