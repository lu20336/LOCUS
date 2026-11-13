import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { Header } from './components/Header'
import { Spinner } from './components/ui'
import { AuthProvider } from './lib/auth/AuthProvider'
import { useAuth } from './lib/auth/authContext'
import { TripFlowProvider } from './lib/flow/TripFlowProvider'
import { FavoritesProvider } from './lib/profile/favorites'
import { HomePage } from './pages/HomePage'
import { PlannerPage } from './pages/PlannerPage'

// Cada pantalla se descarga solo cuando se visita (la portada carga de inmediato).
const AgentWidget = lazy(() => import('./components/agent/AgentWidget'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const ListingPage = lazy(() => import('./pages/ListingPage'))
const ExperiencesPage = lazy(() => import('./pages/ExperiencesPage'))
const ExperiencePage = lazy(() => import('./pages/ExperiencePage'))
const DestinationPage = lazy(() => import('./pages/DestinationPage'))
const FlightsPage = lazy(() => import('./pages/FlightsPage'))
const ItinerariesPage = lazy(() => import('./pages/ItinerariesPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const TripsPage = lazy(() => import('./pages/TripsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const HostDashboard = lazy(() => import('./pages/host/HostDashboard'))
const ListingForm = lazy(() => import('./pages/host/ListingForm'))
const ExperienceForm = lazy(() => import('./pages/host/ExperienceForm'))
const HostBookings = lazy(() => import('./pages/host/HostBookings'))
const HostCalendar = lazy(() => import('./pages/host/HostCalendar'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** Al cambiar de pantalla: subir al inicio y llevar el foco al título (teclado y lectores de pantalla). */
function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const title = document.getElementById('page-title') ?? document.getElementById('step-title')
    title?.focus({ preventScroll: true })
  }, [pathname])
  return null
}

/** Exige sesión: si no la hay, manda a /ingresar y vuelve después. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Revisando tu sesión…" />
  if (!user) return <Navigate to={`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

/** Primera vez: la encuesta de bienvenida (una sola vez por sesión; se puede omitir). */
function OnboardingGate() {
  const { user, profile, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading || !user || !profile) return null
  const pending = !profile.onboardingCompleted && !profile.onboardingSkipped
  if (pending && pathname !== '/bienvenida' && pathname !== '/ingresar') return <Navigate to="/bienvenida" replace />
  return null
}

function Footer() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl px-4 pb-24 text-xs text-muted">
      <p>
        Datos de mapas © {' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          OpenStreetMap contributors
        </a>
        {' · '}Teselas por{' '}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          OpenFreeMap
        </a>
        {' · '}Clima por{' '}
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          Open-Meteo
        </a>
        .
      </p>
      <p className="mt-1">
        LOCUS es un proyecto académico en desarrollo: por ahora los pagos son simulados y no se cobra ningún dinero.
      </p>
    </footer>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
        <TripFlowProvider>
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow"
          >
            Saltar al contenido
          </a>
          <RouteEffects />
          <OnboardingGate />
          <Header />
          <main id="contenido">
            <Suspense fallback={<div className="mx-auto max-w-6xl px-4"><Spinner /></div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/planear" element={<PlannerPage />} />
                <Route path="/ingresar" element={<LoginPage />} />
                <Route path="/bienvenida" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
                <Route path="/explorar" element={<ExplorePage />} />
                <Route path="/hospedajes/:id" element={<ListingPage />} />
                <Route path="/experiencias" element={<ExperiencesPage />} />
                <Route path="/experiencias/:id" element={<ExperiencePage />} />
                <Route path="/destinos/:id" element={<DestinationPage />} />
                <Route path="/vuelos" element={<FlightsPage />} />
                <Route path="/itinerarios" element={<ItinerariesPage />} />
                <Route path="/itinerarios/:id" element={<RequireAuth><ItinerariesPage /></RequireAuth>} />
                <Route path="/favoritos" element={<RequireAuth><FavoritesPage /></RequireAuth>} />
                <Route path="/reservas" element={<RequireAuth><TripsPage /></RequireAuth>} />
                <Route path="/perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                <Route path="/anfitrion" element={<RequireAuth><HostDashboard /></RequireAuth>} />
                <Route path="/anfitrion/alojamientos/nuevo" element={<RequireAuth><ListingForm /></RequireAuth>} />
                <Route path="/anfitrion/alojamientos/:id" element={<RequireAuth><ListingForm /></RequireAuth>} />
                <Route path="/anfitrion/alojamientos/:id/calendario" element={<RequireAuth><HostCalendar /></RequireAuth>} />
                <Route path="/anfitrion/experiencias/nueva" element={<RequireAuth><ExperienceForm /></RequireAuth>} />
                <Route path="/anfitrion/experiencias/:id" element={<RequireAuth><ExperienceForm /></RequireAuth>} />
                <Route path="/anfitrion/reservas" element={<RequireAuth><HostBookings /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <Suspense fallback={null}>
            <AgentWidget />
          </Suspense>
        </TripFlowProvider>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
