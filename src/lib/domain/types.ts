import { getT } from '../i18n/store'
import { localizedRecord } from '../i18n/localized'
/**
 * Tipos del dominio de LOCUS (marketplace + perfil del viajero).
 * Los documentos de Firestore se leen y escriben con estas formas; las
 * fechas del calendario son texto ISO "AAAA-MM-DD" (sin zona horaria).
 */

export type ListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'suspended'
export type ListingType = 'casa' | 'apartamento' | 'habitacion' | 'hotel' | 'hostal' | 'cabana' | 'finca' | 'glamping'
export type CancellationPolicy = 'flexible' | 'moderada' | 'estricta'
export type BookingMode = 'instant' | 'request'

export const LISTING_TYPES: Record<ListingType, string> = localizedRecord('lt', ['casa', 'apartamento', 'habitacion', 'hotel', 'hostal', 'cabana', 'finca', 'glamping'])

export const AMENITIES: Record<string, string> = localizedRecord('am', ['wifi', 'cocina', 'piscina', 'estacionamiento', 'aire', 'mascotas', 'lavadora', 'tv', 'desayuno', 'terraza', 'accesible', 'vistas'])

export const CANCELLATION_POLICIES = Object.fromEntries(
  (['flexible', 'moderada', 'estricta'] as const).map((id) => [
    id,
    {
      get label() {
        return getT()(`cp.${id}`)
      },
      get description() {
        return getT()(`cp.${id}.desc`)
      },
    },
  ]),
) as Record<CancellationPolicy, { label: string; description: string }>

export interface Listing {
  id: string
  hostId: string
  status: ListingStatus
  title: string
  description: string
  type: ListingType
  capacity: number
  bedrooms: number
  beds: number
  bathrooms: number
  department: string
  municipality: string
  addressReference: string
  lat: number
  lon: number
  amenities: string[]
  /** Precio por noche en COP (entero). */
  pricePerNight: number
  cleaningFee: number
  includedGuests: number
  extraGuestFee: number
  minNights: number
  maxNights: number
  bookingMode: BookingMode
  cancellationPolicy: CancellationPolicy
  checkInTime: string
  checkOutTime: string
  rules: string
  /** Miniatura (data URL WebP/JPEG) para tarjetas y marcadores. */
  cover: string
  photoCount: number
  rejectionReason?: string
  /** true = dato de prueba creado por el script de desarrollo en el emulador. */
  isTestData?: boolean
  createdAt: number | null
  updatedAt: number | null
}

export interface ListingPhoto {
  id: string
  order: number
  dataUrl: string
  alt: string
}

export interface ListingCalendar {
  /** Noches reservadas por huéspedes (solo las escriben las reservas). */
  booked: Record<string, 'booking'>
  /** Noches bloqueadas por el anfitrión. */
  hostBlocked: Record<string, 'host'>
}

export type ExperienceCategory =
  | 'caminata'
  | 'tour'
  | 'gastronomia'
  | 'acuatica'
  | 'cultural'
  | 'aves'
  | 'aventura'
  | 'rural'
  | 'bienestar'

export const EXPERIENCE_CATEGORIES: Record<ExperienceCategory, string> = localizedRecord('ec', ['caminata', 'tour', 'gastronomia', 'acuatica', 'cultural', 'aves', 'aventura', 'rural', 'bienestar'])

export interface Experience {
  id: string
  hostId: string
  status: ListingStatus
  title: string
  description: string
  category: ExperienceCategory
  department: string
  municipality: string
  addressReference: string
  lat: number
  lon: number
  durationMinutes: number
  pricePerPerson: number
  capacity: number
  minAge: number
  languages: string[]
  /** Días de la semana en que se ofrece (0 = domingo … 6 = sábado). */
  weekdays: number[]
  /** Horas de inicio "HH:MM". */
  startTimes: string[]
  requirements: string
  cancellationPolicy: CancellationPolicy
  providerName: string
  cover: string
  photoCount: number
  rejectionReason?: string
  isTestData?: boolean
  createdAt: number | null
  updatedAt: number | null
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled_by_guest'
  | 'cancelled_by_host'
  | 'completed'

export interface StayPricing {
  nightly: number
  nights: number
  subtotal: number
  cleaningFee: number
  extraGuestsFee: number
  /** Comisión de LOCUS: aún no definida, siempre 0. */
  serviceFee: number
  total: number
  currency: 'COP'
}

export interface ExperiencePricing {
  perPerson: number
  people: number
  serviceFee: number
  total: number
  currency: 'COP'
}

export interface BookingPayment {
  /**
   * 'simulado' = no se cobró nada (flujo de prueba); 'sandbox' = pasarela en
   * modo de pruebas. LOCUS todavía NO cobra pagos reales.
   */
  mode: 'simulado' | 'sandbox'
  status: 'simulated_paid'
}

export interface Booking {
  id: string
  kind: 'listing' | 'experience'
  itemId: string
  itemTitle: string
  hostId: string
  guestId: string
  guestName: string
  status: BookingStatus
  /** Alojamientos: llegada, salida y noches ocupadas. */
  checkIn?: string
  checkOut?: string
  dates?: string[]
  guests?: number
  /** Experiencias: fecha, hora y personas. */
  date?: string
  startTime?: string
  people?: number
  pricing: StayPricing | ExperiencePricing
  cancellationPolicy: CancellationPolicy
  payment: BookingPayment
  refundAmount?: number
  createdAt: number | null
  updatedAt: number | null
}

/** Dato proveniente de una fuente externa abierta (no reservable en LOCUS). */
export interface ExternalPlace {
  source: 'osm'
  id: string
  name: string
  kind: string
  lat: number
  lon: number
  website?: string
  phone?: string
  address?: string
}
