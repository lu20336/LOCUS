/**
 * Arquitectura de información de LOCUS (un solo lugar para escritorio y celular).
 *
 *  - EXPLORAR: descubrir (hospedajes, experiencias, comparador, planear).
 *  - MI ESPACIO (con sesión): Mis viajes, Favoritos, Mis reservas: lo que el
 *    usuario crea o guarda, siempre a un clic, sin esconderlo en el perfil.
 *  - CUENTA: perfil y preferencias, planes, modo anfitrión, cerrar sesión.
 */
import { Compass, Heart, Hotel, House, Luggage, MapPinned, Scale, Sparkles, Ticket, User, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  /** Clave de traducción del nombre. */
  labelKey: string
  /** Clave de traducción de la descripción (opcional). */
  descKey?: string
  icon: LucideIcon
}

export const EXPLORE_ITEMS: NavItem[] = [
  { to: '/explorar', labelKey: 'nav.stays', descKey: 'nav.staysDesc', icon: Hotel },
  { to: '/experiencias', labelKey: 'nav.experiences', descKey: 'nav.experiencesDesc', icon: Ticket },
  { to: '/comparar', labelKey: 'nav.comparePrices', descKey: 'nav.comparePricesDesc', icon: Scale },
  { to: '/', labelKey: 'nav.planTrip', descKey: 'nav.planTripDesc', icon: MapPinned },
]

/** Lo personal del usuario con sesión. */
export const SPACE_ITEMS: NavItem[] = [
  { to: '/mis-viajes', labelKey: 'nav.myTrips', descKey: 'nav.myTripsDesc', icon: Luggage },
  { to: '/favoritos', labelKey: 'nav.favorites', descKey: 'nav.favoritesDesc', icon: Heart },
  { to: '/reservas', labelKey: 'nav.myBookings', descKey: 'nav.myBookingsDesc', icon: Wallet },
]

export const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/perfil', labelKey: 'nav.profile', descKey: 'nav.profileDesc', icon: User },
  { to: '/planes', labelKey: 'nav.plansSub', descKey: 'nav.plansDesc', icon: Sparkles },
]

export const HOME_ITEM: NavItem = { to: '/', labelKey: 'nav.home', icon: House }
export const EXPLORE_ITEM: NavItem = { to: '/explorar', labelKey: 'nav.explore', icon: Compass }
