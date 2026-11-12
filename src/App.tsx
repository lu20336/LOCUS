import { useEffect, useRef } from 'react'
import { Header } from './components/Header'
import { Stepper } from './components/Stepper'
import { TripFlowProvider } from './lib/flow/TripFlowProvider'
import { useTripFlow } from './lib/flow/tripFlowContext'
import { ActivitiesStepPlaceholder } from './pages/ActivitiesStepPlaceholder'
import { HomePage } from './pages/HomePage'

/** Muestra la pantalla del paso actual. El Paso 1 es la pantalla de inicio. */
function CurrentStep() {
  const { step } = useTripFlow()
  const isFirstRender = useRef(true)

  // Al cambiar de paso, subimos al inicio y llevamos el foco al título de la
  // nueva pantalla, para que teclado y lectores de pantalla no queden "perdidos".
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    window.scrollTo({ top: 0 })
    document.getElementById('step-title')?.focus()
  }, [step])

  if (step === 1) return <HomePage />

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Stepper current={step} />
      <div className="mt-6">{step === 2 && <ActivitiesStepPlaceholder />}</div>
    </div>
  )
}

export default function App() {
  return (
    <TripFlowProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow"
      >
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido">
        <CurrentStep />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
        Datos de mapas ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-ink"
        >
          OpenStreetMap contributors
        </a>
      </footer>
    </TripFlowProvider>
  )
}
