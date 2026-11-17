/**
 * Validación de los formularios del anfitrión (funciones puras). Los límites
 * son los mismos de firestore.rules: si cambias uno, cámbialo en los dos sitios.
 */
import type { CancellationPolicy, ExperienceCategory, ListingType } from './types'

export const DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
  'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
]

/** Colombia continental e insular (incluye San Andrés y Providencia). */
export function inColombia(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -5 && lat <= 14 && lon >= -82.5 && lon <= -66
}

export type FormErrors<T> = Partial<Record<keyof T, string>>

export interface ListingDraft {
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
  lat: number | null
  lon: number | null
  amenities: string[]
  pricePerNight: number
  cleaningFee: number
  includedGuests: number
  extraGuestFee: number
  minNights: number
  maxNights: number
  bookingMode: 'instant' | 'request'
  cancellationPolicy: CancellationPolicy
  checkInTime: string
  checkOutTime: string
  rules: string
  photoCount: number
}

const int = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max

export function validateListingDraft(d: ListingDraft, forReview: boolean): FormErrors<ListingDraft> {
  const e: FormErrors<ListingDraft> = {}
  if (d.title.trim().length < 3 || d.title.trim().length > 100) e.title = 'El nombre debe tener entre 3 y 100 caracteres.'
  if (d.description.length > 4000) e.description = 'La descripción es muy larga (máx. 4.000 caracteres).'
  if (!int(d.capacity, 1, 50)) e.capacity = 'La capacidad debe ser de 1 a 50 huéspedes.'
  if (!int(d.bedrooms, 0, 30)) e.bedrooms = 'Revisa el número de habitaciones.'
  if (!int(d.beds, 1, 60)) e.beds = 'Indica al menos 1 cama.'
  if (!int(d.bathrooms, 0, 30)) e.bathrooms = 'Revisa el número de baños.'
  if (!d.department) e.department = 'Elige el departamento.'
  if (d.municipality.trim().length < 2) e.municipality = 'Escribe el municipio.'
  if (d.lat === null || d.lon === null || !inColombia(d.lat, d.lon)) e.lat = 'Marca la ubicación en el mapa (debe estar en Colombia).'
  if (!int(d.pricePerNight, 10_000, 20_000_000)) e.pricePerNight = 'El precio por noche debe estar entre $10.000 y $20.000.000.'
  if (!int(d.cleaningFee, 0, 5_000_000)) e.cleaningFee = 'La tarifa de limpieza debe ser de $0 a $5.000.000.'
  if (!int(d.includedGuests, 1, 50) || d.includedGuests > d.capacity) e.includedGuests = 'Los huéspedes incluidos no pueden superar la capacidad.'
  if (!int(d.extraGuestFee, 0, 2_000_000)) e.extraGuestFee = 'Revisa el cobro por huésped extra.'
  if (!int(d.minNights, 1, 30)) e.minNights = 'La estadía mínima es de 1 a 30 noches.'
  if (!int(d.maxNights, 1, 365) || d.maxNights < d.minNights) e.maxNights = 'La estadía máxima debe ser mayor o igual a la mínima.'
  if (forReview) {
    if (d.description.trim().length < 40) e.description = 'Para enviarlo a revisión, describe tu alojamiento (mín. 40 caracteres).'
    if (d.photoCount < 3) e.photoCount = 'Sube al menos 3 fotos para enviarlo a revisión.'
  }
  return e
}

export interface ExperienceDraft {
  title: string
  description: string
  category: ExperienceCategory
  department: string
  municipality: string
  addressReference: string
  lat: number | null
  lon: number | null
  durationMinutes: number
  pricePerPerson: number
  capacity: number
  minAge: number
  languages: string[]
  weekdays: number[]
  startTimes: string[]
  requirements: string
  cancellationPolicy: CancellationPolicy
  providerName: string
  photoCount: number
}

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export function validateExperienceDraft(d: ExperienceDraft, forReview: boolean): FormErrors<ExperienceDraft> {
  const e: FormErrors<ExperienceDraft> = {}
  if (d.title.trim().length < 3 || d.title.trim().length > 100) e.title = 'El nombre debe tener entre 3 y 100 caracteres.'
  if (d.description.length > 4000) e.description = 'La descripción es muy larga (máx. 4.000 caracteres).'
  if (!d.department) e.department = 'Elige el departamento.'
  if (d.municipality.trim().length < 2) e.municipality = 'Escribe el municipio.'
  if (d.lat === null || d.lon === null || !inColombia(d.lat, d.lon)) e.lat = 'Marca el punto de encuentro en el mapa (debe estar en Colombia).'
  if (!int(d.durationMinutes, 15, 1440)) e.durationMinutes = 'La duración debe ser de 15 minutos a 24 horas.'
  if (!int(d.pricePerPerson, 5_000, 20_000_000)) e.pricePerPerson = 'El precio por persona debe estar entre $5.000 y $20.000.000.'
  if (!int(d.capacity, 1, 200)) e.capacity = 'El cupo debe ser de 1 a 200 personas.'
  if (!int(d.minAge, 0, 99)) e.minAge = 'Revisa la edad mínima.'
  if (d.weekdays.length < 1) e.weekdays = 'Elige al menos un día de la semana.'
  if (d.startTimes.length < 1 || d.startTimes.some((t) => !TIME.test(t))) e.startTimes = 'Agrega al menos un horario válido (HH:MM).'
  if (d.providerName.trim().length < 2) e.providerName = 'Indica el nombre del proveedor u operador.'
  if (forReview) {
    if (d.description.trim().length < 40) e.description = 'Para enviarla a revisión, descríbela mejor (mín. 40 caracteres).'
    if (d.photoCount < 1) e.photoCount = 'Sube al menos 1 foto para enviarla a revisión.'
  }
  return e
}

export const hasFormErrors = (errors: object) => Object.keys(errors).length > 0
