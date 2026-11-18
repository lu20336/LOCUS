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
  label: string
  description?: string
  icon: LucideIcon
}

export const EXPLORE_ITEMS: NavItem[] = [
  { to: '/explorar', label: 'Hospedajes', description: 'Cabañas, fincas y apartamentos', icon: Hotel },
  { to: '/experiencias', label: 'Experiencias', description: 'Tours y actividades locales', icon: Ticket },
  { to: '/comparar', label: 'Comparar precios', description: 'Booking, Airbnb, vuelos y más', icon: Scale },
  { to: '/', label: 'Planear mi viaje', description: 'Tu itinerario día a día', icon: MapPinned },
]

/** Lo personal del usuario con sesión. */
export const SPACE_ITEMS: NavItem[] = [
  { to: '/mis-viajes', label: 'Mis viajes', description: 'Itinerarios y planes', icon: Luggage },
  { to: '/favoritos', label: 'Favoritos', description: 'Lo que guardaste', icon: Heart },
  { to: '/reservas', label: 'Mis reservas', description: 'Hospedajes y experiencias', icon: Wallet },
]

export const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/perfil', label: 'Perfil y preferencias', description: 'Tus datos y gustos de viaje', icon: User },
  { to: '/planes', label: 'Planes y suscripción', description: 'Free, Plus y Premium (demo)', icon: Sparkles },
]

export const HOME_ITEM: NavItem = { to: '/', label: 'Inicio', icon: House }
export const EXPLORE_ITEM: NavItem = { to: '/explorar', label: 'Explorar', icon: Compass }
