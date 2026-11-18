import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router'
import { AccountShell } from './components/account/AccountShell'
import { Header } from './components/Header'
import { BottomNav } from './components/nav/BottomNav'
import { ToastProvider } from './components/Toast'
import { Spinner } from './components/ui'
import { AuthProvider } from './lib/auth/AuthProvider'
import { useAuth } from './lib/auth/authContext'
import { I18nProvider, useI18n } from './lib/i18n/I18nProvider'
import { TripFlowProvider } from './lib/flow/TripFlowProvider'
import { usesGeoapify } from './lib/itinerary/browserClient'
import { PlanProvider } from './lib/plans/planContext'
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
const ComparePage = lazy(() => import('./pages/ComparePage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const MyTripsPage = lazy(() => import('./pages/MyTripsPage'))
const TripDetailPage = lazy(() => import('./pages/TripDetailPage'))
const PlansPage = lazy(() => import('./pages/PlansPage'))
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
const TITLES: Record<string, string> = {
  '/planear': 'title.plan',
  '/comparar': 'title.compare',
  '/explorar': 'title.explore',
  '/experiencias': 'title.experiences',
  '/mis-viajes': 'title.myTrips',
  '/favoritos': 'title.favorites',
  '/reservas': 'title.bookings',
  '/perfil': 'title.profile',
  '/planes': 'title.plans',
  '/como-ganamos-dinero': 'title.howWeEarn',
  '/privacidad': 'title.privacy',
  '/terminos': 'title.terms',
  '/anfitrion': 'title.host',
}

/** /itinerarios/:id (enlace anterior) → /mis-viajes/:id */
function LegacyTripRedirect() {
  const { id } = useParams()
  return <Navigate to={`/mis-viajes/${id ?? ''}`} replace />
}

/** Funde la pantalla nueva al cambiar de ruta (los pasos del planificador comparten ruta y no se reinician). */
function PageTransition() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="anim-page">
      <Outlet />
    </div>
  )
}

function RouteEffects() {
  const { pathname } = useLocation()
  const { t, locale } = useI18n()
  useEffect(() => {
    const key = TITLES[pathname]
    document.title = key ? t('title.suffix', { page: t(key) }) : t('title.default')
    window.scrollTo({ top: 0 })
    const title = document.getElementById('page-title') ?? document.getElementById('step-title')
    title?.focus({ preventScroll: true })
    // El título depende del idioma: se actualiza también al cambiarlo (sin volver a mover el foco).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, locale])
  return null
}

/** El comparador reemplaza a la antigua pantalla de vuelos: se conservan los enlaces viejos (?destino, ?fecha). */
function FlightsRedirect() {
  const [params] = useSearchParams()
  const next = new URLSearchParams({ tipo: 'vuelos' })
  const destino = params.get('destino')
  const fecha = params.get('fecha')
  if (destino) next.set('destino', destino)
  if (fecha) next.set('llegada', fecha)
  return <Navigate to={`/comparar?${next.toString()}`} replace />
}

/** Exige sesión: si no la hay, manda a /ingresar y vuelve después. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  if (loading) return <Spinner label={t('app.checkingSession')} />
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
  const { t } = useI18n()
  return (
    <footer className="mx-auto mt-16 max-w-6xl px-4 pb-24 text-xs text-muted">
      <p>
        {t('footer.mapsCredit')} {' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          OpenStreetMap contributors
        </a>
        {' · '}{t('footer.tilesBy')}{' '}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          OpenFreeMap
        </a>
        {/* El plan gratuito de Geoapify exige su atribución cuando se usa como respaldo. */}
        {usesGeoapify && (
          <>
            {' · '}
            <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              {t('app.poweredBy')}
            </a>
          </>
        )}
        {' · '}{t('footer.weatherBy')}{' '}
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          Open-Meteo
        </a>
        .
      </p>
      <nav aria-label={t('footer.info')} className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
        <Link to="/comparar" className="underline-offset-2 hover:text-ink hover:underline">{t('footer.compare')}</Link>
        <Link to="/planes" className="underline-offset-2 hover:text-ink hover:underline">{t('footer.plans')}</Link>
        <Link to="/como-ganamos-dinero" className="underline-offset-2 hover:text-ink hover:underline">{t('footer.howWeEarn')}</Link>
        <Link to="/privacidad" className="underline-offset-2 hover:text-ink hover:underline">{t('footer.privacy')}</Link>
        <Link to="/terminos" className="underline-offset-2 hover:text-ink hover:underline">{t('footer.terms')}</Link>
        <Link to="/anfitrion" className="underline-offset-2 hover:text-ink hover:underline">{t('footer.publish')}</Link>
      </nav>
      <p className="mt-3">
        {t('footer.academic')}
      </p>
    </footer>
  )
}

function SkipLink() {
  const { t } = useI18n()
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow"
    >
      {t('common.skipToContent')}
    </a>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
        <FavoritesProvider>
        <PlanProvider>
        <ToastProvider>
        <TripFlowProvider>
          <SkipLink />
          <RouteEffects />
          <OnboardingGate />
          <Header />
          <main id="contenido">
            <Suspense fallback={<div className="mx-auto max-w-6xl px-4"><Spinner /></div>}>
              <Routes>
               <Route element={<PageTransition />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/planear" element={<PlannerPage />} />
                <Route path="/ingresar" element={<LoginPage />} />
                <Route path="/bienvenida" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
                <Route path="/explorar" element={<ExplorePage />} />
                <Route path="/hospedajes/:id" element={<ListingPage />} />
                <Route path="/experiencias" element={<ExperiencesPage />} />
                <Route path="/experiencias/:id" element={<ExperiencePage />} />
                <Route path="/destinos/:id" element={<DestinationPage />} />
                <Route path="/comparar" element={<ComparePage />} />
                <Route path="/vuelos" element={<FlightsRedirect />} />
                <Route path="/como-ganamos-dinero" element={<LegalPage />} />
                <Route path="/privacidad" element={<LegalPage />} />
                <Route path="/terminos" element={<LegalPage />} />
                {/* Espacio del viajero: barra lateral en escritorio, navegación inferior en el celular. */}
                <Route element={<RequireAuth><AccountShell /></RequireAuth>}>
                  <Route path="/mis-viajes" element={<MyTripsPage />} />
                  <Route path="/favoritos" element={<FavoritesPage />} />
                  <Route path="/reservas" element={<TripsPage />} />
                  <Route path="/perfil" element={<ProfilePage />} />
                </Route>
                <Route path="/mis-viajes/:id" element={<RequireAuth><TripDetailPage /></RequireAuth>} />
                <Route path="/planes" element={<PlansPage />} />
                {/* Rutas anteriores: se conservan para enlaces guardados. */}
                <Route path="/itinerarios" element={<Navigate to="/mis-viajes" replace />} />
                <Route path="/itinerarios/:id" element={<LegacyTripRedirect />} />
                <Route path="/anfitrion" element={<RequireAuth><HostDashboard /></RequireAuth>} />
                <Route path="/anfitrion/alojamientos/nuevo" element={<RequireAuth><ListingForm /></RequireAuth>} />
                <Route path="/anfitrion/alojamientos/:id" element={<RequireAuth><ListingForm /></RequireAuth>} />
                <Route path="/anfitrion/alojamientos/:id/calendario" element={<RequireAuth><HostCalendar /></RequireAuth>} />
                <Route path="/anfitrion/experiencias/nueva" element={<RequireAuth><ExperienceForm /></RequireAuth>} />
                <Route path="/anfitrion/experiencias/:id" element={<RequireAuth><ExperienceForm /></RequireAuth>} />
                <Route path="/anfitrion/reservas" element={<RequireAuth><HostBookings /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
                <Route path="*" element={<NotFoundPage />} />
               </Route>
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <BottomNav />
          <Suspense fallback={null}>
            <AgentWidget />
          </Suspense>
        </TripFlowProvider>
        </ToastProvider>
        </PlanProvider>
        </FavoritesProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
