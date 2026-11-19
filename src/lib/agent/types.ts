import type { Itinerary } from '../../types/itinerary'
import type { Locale } from '../i18n/locales'
import type { FlightLink } from '../flights/airports'

/**
 * Tarjetas que acompañan la respuesta del agente. Las construyen las
 * HERRAMIENTAS a partir de datos reales (Firestore, OpenStreetMap, Open-Meteo):
 * nunca las inventa el modelo, así que lo que se ve en una tarjeta es verificable.
 */
export type AgentCard =
  | { kind: 'listing'; id: string; title: string; subtitle: string; price: string; cover?: string; href: string }
  | { kind: 'experience'; id: string; title: string; subtitle: string; price: string; cover?: string; href: string }
  | { kind: 'destination'; id: string; title: string; subtitle: string; image: string; href: string }
  | { kind: 'itinerary'; title: string; days: number; places: number; itinerary: Itinerary }
  | { kind: 'flights'; origin: string; destination: string; links: FlightLink[] }
  | { kind: 'weather'; title: string; lines: string[] }
  | { kind: 'places'; title: string; items: { name: string; kind: string; href: string }[] }
  | { kind: 'note'; text: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  text: string
  cards?: AgentCard[]
  error?: boolean
  /** Respuesta del modo guiado (sin IA). */
  guided?: boolean
  /** En un mensaje de error: el texto del usuario que se puede reenviar con "Reintentar". */
  retryText?: string
  /** El error permite reintentar. */
  retryable?: boolean
  /** El error se arregla recargando la página (App Check bloquea el navegador hasta recargar). */
  reload?: boolean
}

export interface ToolContext {
  /** Usuario con sesión (o null). */
  uid: string | null
  /** El usuario autorizó usar su perfil para personalizar. */
  aiConsent: boolean
  today: string
  /** Idioma de la interfaz (las tarjetas y avisos se generan en él). */
  locale: Locale
}

export interface ToolOutcome {
  /** Lo que ve el modelo. */
  result: Record<string, unknown>
  cards?: AgentCard[]
}
