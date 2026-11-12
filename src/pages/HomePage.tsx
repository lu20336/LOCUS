/**
 * PANTALLA DE INICIO = PASO 1.
 *
 * - Barra de búsqueda: escribir despliega el formulario en Modo A (el texto
 *   de la barra es el destino) y muestra sugerencias de lugares debajo;
 *   "Sugiéreme un lugar" lo despliega en Modo B.
 * - Panel desplegable (TripDetailsPanel): fechas, presupuesto y, en Modo B,
 *   la sugerencia de destino. Se abre con una transición suave bajo la barra.
 * - "Viaja por Colombia": tarjetas que abren el Modo A con el destino puesto.
 * - "¿Qué te gustaría hacer?": tarjetas que abren el Modo B con esa actividad
 *   ya marcada (solo falta elegir el clima).
 *
 * La lógica del formulario vive en useTripDetailsForm (compartida por la
 * barra y el panel).
 */
import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { ActivityCards } from '../components/ActivityCards'
import { DestinationCards } from '../components/DestinationCards'
import { SearchBar } from '../components/SearchBar'
import { TripDetailsPanel } from '../components/TripDetailsPanel'
import type { FeaturedDestination } from '../lib/featuredDestinations'
import { useDestinationOptions, type DestinationOption } from '../lib/flow/destinationOptions'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { useTripDetailsForm, type FocusableField } from '../lib/flow/useTripDetailsForm'
import type { CategoryId } from '../types/itinerary'

const PANEL_ID = 'trip-panel'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function HomePage() {
  const { trip } = useTripFlow()
  const form = useTripDetailsForm()
  const { mode, setMode } = form

  // Si el usuario vuelve desde el Paso 2, el panel aparece abierto con sus datos.
  const [expanded, setExpanded] = useState(Boolean(trip))
  const barRef = useRef<HTMLInputElement | null>(null)
  const searchAreaRef = useRef<HTMLDivElement | null>(null)
  // Al elegir una actividad se reinicia el panel del Modo B (cancela una búsqueda en curso).
  const [suggesterKey, setSuggesterKey] = useState(0)
  // Sugerencias de la barra mientras se escribe ("med" → Medellín).
  const destinationOptions = useDestinationOptions(form.draft.destination)

  /**
   * Despliega el panel y, opcionalmente, lleva el foco a un campo.
   * flushSync aplica el cambio al DOM de inmediato (quita `inert` y monta el
   * panel del modo elegido) para poder enfocar justo después.
   */
  function expand(changes: () => void, focus?: FocusableField) {
    flushSync(() => {
      changes()
      setExpanded(true)
    })
    if (focus) {
      form.focusField(focus)
      searchAreaRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }
  }

  /** Escribir en la barra = "ya sé a dónde ir" → Modo A, sin mover el foco. */
  function handleBarChange(value: string) {
    form.update('destination', value)
    if (mode !== 'known') setMode('known')
    if (!expanded) setExpanded(true)
  }

  function handleSuggest() {
    expand(() => setMode('suggested'), 'destinationSuggester')
  }

  function handleUseSearchBar() {
    expand(() => setMode('known'), 'destinationBar')
  }

  function handleChooseCard(item: FeaturedDestination) {
    expand(() => form.chooseDestination(item.destination), 'startDate')
  }

  /** Elegir una sugerencia de la barra: Modo A con coordenadas conocidas (sin Nominatim). */
  function handleChooseOption(option: DestinationOption) {
    expand(() => form.chooseDestination(option.destination), 'startDate')
  }

  function handleChooseActivity(category: CategoryId) {
    expand(() => {
      setMode('suggested')
      form.setSearch({ ...form.search, categories: [category], result: null, selectedId: null })
      setSuggesterKey((key) => key + 1)
    }, 'destinationSuggester')
  }

  function handleClose() {
    setExpanded(false)
    barRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Enter en la barra con el panel cerrado: solo desplegamos.
    if (!expanded) {
      expand(() => {}, mode === 'suggested' ? 'destinationSuggester' : 'startDate')
      return
    }
    void form.submit()
  }

  return (
    <>
      {/* HERO: foto a pantalla completa con degradado oscuro para el contraste del texto. */}
      <section className="relative isolate">
        <img
          src="/images/hero.jpg"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-10 size-full object-cover object-[center_40%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgb(0_25_50/0.72)] via-[rgb(0_25_50/0.5)] to-[rgb(0_25_50/0.78)]"
        />

        <div className="mx-auto flex min-h-[80svh] max-w-6xl flex-col px-4 pt-[10vh] pb-16 sm:min-h-[calc(100svh-4rem)] sm:pt-[16vh]">
          <div ref={searchAreaRef} className="mx-auto max-w-3xl scroll-mt-20 text-center [text-shadow:0_2px_16px_rgb(0_0_0/0.35)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/85">Itinerarios con lugares reales</p>
            <h1 id="step-title" tabIndex={-1} className="mt-3 text-5xl leading-tight font-semibold text-white focus:outline-none sm:text-6xl lg:text-7xl">
              Planea tu viaje por <em className="text-teal-light">Colombia</em>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/90 sm:text-xl">
              Te armamos un plan día a día, en el orden que menos te hace recorrer.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mx-auto mt-10 w-full max-w-3xl">
            <SearchBar
              value={form.draft.destination}
              onChange={handleBarChange}
              options={destinationOptions}
              onSelectOption={handleChooseOption}
              onSuggest={handleSuggest}
              inputRef={(el) => {
                barRef.current = el
                form.registerField('destinationBar')(el)
              }}
              panelId={PANEL_ID}
              suggestActive={expanded && mode === 'suggested'}
              error={mode === 'known' ? form.errors.destination : undefined}
              disabled={form.isGeocoding}
            />

            {/* Despliegue suave: la fila del grid pasa de 0fr a 1fr (altura automática). */}
            <div
              id={PANEL_ID}
              inert={!expanded}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleClose()
              }}
              className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                expanded ? 'mt-6 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0 overflow-hidden p-1">
                <TripDetailsPanel
                  form={form}
                  onClose={handleClose}
                  onUseSearchBar={handleUseSearchBar}
                  onSuggest={handleSuggest}
                  suggesterKey={suggesterKey}
                />
              </div>
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-16 sm:gap-24 sm:py-24">
        <DestinationCards onChoose={handleChooseCard} />
        <ActivityCards onChoose={handleChooseActivity} />
        <p className="-mt-12 text-xs text-muted sm:-mt-16">
          Fotos: Unsplash y Wikimedia Commons (licencias libres) ·{' '}
          <a href="/images/CREDITOS.md" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            ver créditos y autores
          </a>
        </p>
      </div>
    </>
  )
}
