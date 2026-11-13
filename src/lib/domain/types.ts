/**
 * Tipos del dominio de LOCUS (marketplace + perfil del viajero).
 * Los documentos de Firestore se leen y escriben con estas formas; las
 * fechas del calendario son texto ISO "AAAA-MM-DD" (sin zona horaria).
 */

export type ListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'suspended'
export type ListingType = 'casa' | 'apartamento' | 'habitacion' | 'hotel' | 'hostal' | 'cabana' | 'finca' | 'glamping'
export type CancellationPolicy = 'flexible' | 'moderada' | 'estricta'
export type BookingMode = 'instant' | 'request'

export const LISTING_TYPES: Record<ListingType, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  habitacion: 'Habitación',
  hotel: 'Hotel',
  hostal: 'Hostal',
  cabana: 'Cabaña',
  finca: 'Finca',
  glamping: 'Glamping',
}

export const AMENITIES: Record<string, string> = {
  wifi: 'Wi-Fi',
  cocina: 'Cocina',
  piscina: 'Piscina',
  estacionamiento: 'Estacionamiento',
  aire: 'Aire acondicionado',
  mascotas: 'Admite mascotas',
  lavadora: 'Lavadora',
  tv: 'Televisión',
  desayuno: 'Desayuno incluido',
  terraza: 'Terraza o balcón',
  accesible: 'Accesible (movilidad reducida)',
  vistas: 'Vistas panorámicas',
}

export const CANCELLATION_POLICIES: Record<CancellationPolicy, { label: string; description: string }> = {
  flexible: {
    label: 'Flexible',
    description: 'Reembolso total si cancelas hasta 1 día antes de la llegada. Después, se cobra la primera noche.',
  },
  moderada: {
    label: 'Moderada',
    description: 'Reembolso total si cancelas hasta 5 días antes de la llegada. Después, se reembolsa el 50 %.',
  },
  estricta: {
    label: 'Estricta',
    description: 'Reembolso del 50 % si cancelas hasta 14 días antes de la llegada. Después, no hay reembolso.',
  },
}

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

export const EXPERIENCE_CATEGORIES: Record<ExperienceCategory, string> = {
  caminata: 'Caminata ecológica',
  tour: 'Tour turístico',
  gastronomia: 'Experiencia gastronómica',
  acuatica: 'Actividad acuática',
  cultural: 'Recorrido cultural',
  aves: 'Avistamiento de aves',
  aventura: 'Aventura',
  rural: 'Experiencia rural',
  bienestar: 'Bienestar',
}

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
