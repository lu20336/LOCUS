/**
 * Lógica del formulario del Paso 1 ("Cuéntanos tu viaje"), separada de la
 * vista. La usan dos piezas de la pantalla de inicio que comparten estado:
 * la barra de búsqueda (destino en Modo A) y el panel desplegable (fechas,
 * presupuesto y, en Modo B, la sugerencia de destino).
 *
 * Dos formas de elegir el destino:
 *   - Modo A "Ya sé a dónde ir": se escribe y se geocodifica con Nominatim
 *     (o se usan las coordenadas de una tarjeta de "Viaja por Colombia").
 *   - Modo B "Sugiéreme un destino": clima + actividades → suggestDestination().
 *
 * Al enviar:
 *   1. Valida los campos (validateTripDetails).
 *   2. Obtiene el destino con coordenadas (según el modo).
 *   3. Lo guarda en el estado del flujo (useTripFlow) → pasa al Paso 2.
 *      En Modo B también guarda las actividades (el Paso 2 ya las tendrá).
 */
import { useCallback, useRef, useState } from 'react'
import type { DestinationMode, SuggestionSearch } from '../../types/flow'
import type { Destination } from '../../types/itinerary'
import { countTripDays, formatCOP, formatThousands, parseBudget, todayISO } from '../format'
import { osmClient, suggestionDeps } from '../itinerary/browserClient'
import { ItineraryError } from '../itinerary/errors'
import { geocodeDestination } from '../itinerary/generateItinerary'
import { resolveDestination } from './resolveDestination'
import { useTripFlow } from './tripFlowContext'
import { hasErrors, validateTripDetails, type TripDetailsDraft, type TripDetailsErrors } from './validateTripDetails'

const EMPTY_SEARCH: SuggestionSearch = { climate: null, categories: [], result: null, selectedId: null }

/** Orden de los campos, para enfocar el primero que tenga error. */
const FIELD_ORDER: (keyof TripDetailsDraft)[] = ['destination', 'startDate', 'endDate', 'budget']

/**
 * Elementos enfocables del formulario. El destino tiene dos: la barra de
 * búsqueda (Modo A) y el panel de sugerencias (Modo B).
 */
export type FocusableField = 'destinationBar' | 'destinationSuggester' | 'startDate' | 'endDate' | 'budget'

/** Tope de viajeros por plan (grupos más grandes suelen ir con agencia). */
export const MAX_TRAVELERS = 20

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function useTripDetailsForm() {
  const { trip, suggestionSearch, completeTripDetails } = useTripFlow()
  const today = todayISO()

  // Si el usuario vuelve a este paso, el formulario aparece con lo que ya llenó.
  const [mode, setModeState] = useState<DestinationMode>(trip?.mode ?? 'known')
  const [search, setSearch] = useState<SuggestionSearch>(suggestionSearch ?? EMPTY_SEARCH)
  const [draft, setDraft] = useState<TripDetailsDraft>(() => ({
    destination: trip?.mode === 'known' ? trip.destination.query : '',
    startDate: trip?.startDate ?? '',
    endDate: trip?.endDate ?? '',
    budget: trip ? formatThousands(trip.budgetCOP) : '',
  }))
  // Viajeros y habitaciones: contadores con mínimo 1. No puede haber más
  // habitaciones que viajeros, así que bajar viajeros puede bajar habitaciones.
  const [travelers, setTravelersState] = useState(trip?.travelers ?? 1)
  const [rooms, setRoomsState] = useState(trip?.rooms ?? 1)

  function setTravelers(value: number) {
    const next = clamp(value, 1, MAX_TRAVELERS)
    setTravelersState(next)
    setRoomsState((current) => Math.min(current, next))
  }

  function setRooms(value: number) {
    setRoomsState(clamp(value, 1, travelers))
  }

  /**
   * Destino con coordenadas ya conocidas (tarjeta elegida o viaje anterior).
   * Solo se usa si el texto del campo sigue siendo exactamente su `query`.
   */
  const [knownDestination, setKnownDestination] = useState<Destination | null>(
    trip?.mode === 'known' ? trip.destination : null,
  )
  // Los errores se muestran solo después del primer intento de continuar.
  const [submitted, setSubmitted] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [destinationNotFound, setDestinationNotFound] = useState<string | null>(null)
  const [serviceError, setServiceError] = useState<string | null>(null)

  const fieldElements = useRef<Partial<Record<FocusableField, HTMLElement | null>>>({})

  /** ref={form.registerField('startDate')} conecta un elemento con el formulario. */
  const registerField = useCallback(
    (field: FocusableField) => (element: HTMLElement | null) => {
      fieldElements.current[field] = element
    },
    [],
  )

  /** Enfoca un campo. En el panel de sugerencias, el primer control (los chips de clima). */
  const focusField = useCallback((field: FocusableField) => {
    const element = fieldElements.current[field]
    const target = field === 'destinationSuggester' ? (element?.querySelector<HTMLElement>('input') ?? element) : element
    target?.focus({ preventScroll: true })
  }, [])

  // En Modo B, el "destino" es la sugerencia elegida.
  const selectedSuggestion = search.result?.suggestions.find((s) => s.candidate.id === search.selectedId) ?? null
  const validation = validateTripDetails(
    { ...draft, destination: mode === 'known' ? draft.destination : (selectedSuggestion?.candidate.name ?? '') },
    today,
  )
  if (mode === 'suggested' && validation.destination) {
    validation.destination = search.result
      ? 'Elige uno de los destinos sugeridos.'
      : 'Elige clima y actividades, y pulsa "Buscar destinos".'
  }
  const errors: TripDetailsErrors = submitted
    ? { ...validation, destination: validation.destination ?? (mode === 'known' ? destinationNotFound : null) ?? undefined }
    : {}

  function setMode(next: DestinationMode) {
    setModeState(next)
    setServiceError(null)
  }

  function update(field: keyof TripDetailsDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    if (field === 'destination') setDestinationNotFound(null)
    setServiceError(null)
  }

  /** Elegir una tarjeta de "Viaja por Colombia": Modo A con el destino ya puesto. */
  function chooseDestination(destination: Destination) {
    setMode('known')
    update('destination', destination.query)
    setKnownDestination(destination)
  }

  // Resumen del presupuesto por día (solo si fechas y presupuesto son válidos).
  const budget = parseBudget(draft.budget)
  const days = !validation.startDate && !validation.endDate ? countTripDays(draft.startDate, draft.endDate) : null
  const perDay = budget && days && !validation.budget ? Math.round(budget / days) : null
  const budgetHint = perDay
    ? `≈ ${formatCOP(perDay)} por día${travelers > 1 ? ` (${formatCOP(Math.round(perDay / travelers))} por persona)` : ''} · ${days} ${days === 1 ? 'día' : 'días'} de viaje`
    : 'Incluye alojamiento, comida y actividades.'

  async function submit() {
    if (isGeocoding) return
    setSubmitted(true)
    setServiceError(null)

    // 1. Validación local: si algo falla, llevamos el foco al primer error.
    if (hasErrors(validation)) {
      const firstInvalid = FIELD_ORDER.find((field) => validation[field])
      if (firstInvalid === 'destination') focusField(mode === 'known' ? 'destinationBar' : 'destinationSuggester')
      else if (firstInvalid) focusField(firstInvalid)
      return
    }

    // 2b. Modo B: el destino ya viene con coordenadas de la sugerencia elegida.
    if (mode === 'suggested' && selectedSuggestion && search.result) {
      completeTripDetails(
        {
          mode,
          destination: selectedSuggestion.destination,
          startDate: draft.startDate,
          endDate: draft.endDate,
          budgetCOP: budget!,
          travelers,
          rooms,
        },
        { categories: search.result.categories, suggestionSearch: search },
      )
      return
    }

    // 2a. Modo A: si el texto coincide con un destino conocido, usamos sus
    // coordenadas; si no, resolveDestination (destacados → Nominatim → lista
    // local de pueblos si Nominatim no responde).
    const query = draft.destination.trim()
    let destination = knownDestination?.query === query ? knownDestination : null
    if (!destination) {
      setIsGeocoding(true)
      try {
        destination = await resolveDestination(query, {
          geocode: (q) => geocodeDestination(q, osmClient),
          loadTowns: suggestionDeps.loadTowns,
        })
      } catch (error) {
        const message =
          error instanceof ItineraryError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.'
        if (error instanceof ItineraryError && error.code === 'DESTINATION_NOT_FOUND') {
          setDestinationNotFound(message)
          focusField('destinationBar')
        } else {
          setServiceError(message)
        }
        return
      } finally {
        setIsGeocoding(false)
      }
    }

    // 3. Guardar en el estado del flujo y avanzar al Paso 2.
    completeTripDetails(
      { mode, destination, startDate: draft.startDate, endDate: draft.endDate, budgetCOP: budget!, travelers, rooms },
      { suggestionSearch: search },
    )
  }

  return {
    mode,
    setMode,
    draft,
    update,
    search,
    setSearch,
    travelers,
    setTravelers,
    rooms,
    setRooms,
    chooseDestination,
    errors,
    budgetHint,
    today,
    isGeocoding,
    serviceError,
    registerField,
    focusField,
    submit,
  }
}

export type TripDetailsForm = ReturnType<typeof useTripDetailsForm>
