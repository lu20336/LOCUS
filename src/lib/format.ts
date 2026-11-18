// Utilidades de formato para mostrar datos al usuario. Usan el idioma activo de la
// interfaz (src/lib/i18n/store.ts) con la API estándar Intl: fechas, números,
// monedas, porcentajes y distancias cambian de formato según el idioma.
//
// IMPORTANTE: cambiar de idioma solo cambia la PRESENTACIÓN. La moneda de los
// precios de LOCUS es siempre COP y no se convierte: ver docs/I18N.md.
import { getBcp47, getLocale } from './i18n/store'

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: () => T): T {
  let value = cache.get(key) as T | undefined
  if (!value) {
    value = make()
    cache.set(key, value)
  }
  return value
}

const number = (opts: Intl.NumberFormatOptions) => cached(`n|${getBcp47()}|${JSON.stringify(opts)}`, () => new Intl.NumberFormat(getBcp47(), opts))

/** 2500000 → "$ 2.500.000" (es) · "COP 2,500,000" (en) · "2.500.000 COP" (de). Siempre pesos colombianos. */
export function formatCOP(value: number): string {
  return number({ style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

/** 2500000 → "2.500.000" (para mostrar dentro del campo mientras se escribe). */
export function formatThousands(value: number): string {
  return number({ maximumFractionDigits: 0 }).format(value)
}

/** 0.17 → "17 %" según el idioma. */
export function formatPercent(fraction: number): string {
  return number({ style: 'percent', maximumFractionDigits: 0 }).format(fraction)
}

/** Número con el separador decimal del idioma (1234.5 → "1.234,5" / "1,234.5"). */
export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return number({ maximumFractionDigits }).format(value)
}

/** 12.3 → "12,3 km" (es) · "12.3 km (7.6 mi)" (en: kilómetros y millas, porque en inglés se piensa en millas). */
export function formatDistanceKm(km: number): string {
  const base = `${formatNumber(km, km < 10 ? 1 : 0)} km`
  if (getLocale() !== 'en') return base
  return `${base} (${formatNumber(km * 0.621371, km < 10 ? 1 : 0)} mi)`
}

/**
 * Lee un presupuesto escrito por el usuario ignorando puntos, comas, espacios
 * y el signo $. "2.500.000" → 2500000. Devuelve null si no hay dígitos.
 */
export function parseBudget(input: string): number | null {
  const digits = input.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/** Fecha de hoy en la zona horaria del usuario, formato "AAAA-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const dateFormat = (opts: Intl.DateTimeFormatOptions) => cached(`d|${getBcp47()}|${JSON.stringify(opts)}`, () => new Intl.DateTimeFormat(getBcp47(), { ...opts, timeZone: 'UTC' }))
const utc = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** "2026-12-01" → "1 dic 2026" (es) · "Dec 1, 2026" (en) · "1. Dez. 2026" (de), sin desfases de zona horaria. */
export function formatDate(iso: string): string {
  return dateFormat({ day: 'numeric', month: 'short', year: 'numeric' }).format(utc(iso))
}

/** "2026-12-01" → "martes, 1 de diciembre de 2026" (versión larga). */
export function formatDateLong(iso: string): string {
  return dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(utc(iso))
}

/** "2026-12-05" → "sáb 5 dic" (pestañas de días). */
export function formatDayTabLabel(iso: string): string {
  return dateFormat({ weekday: 'short', day: 'numeric', month: 'short' }).format(utc(iso)).replace(/\./g, '')
}

/** Hora "HH:MM" (24 h en la mayoría de idiomas, 12 h en inglés) a partir de "15:00". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return cached(`t|${getBcp47()}`, () => new Intl.DateTimeFormat(getBcp47(), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })).format(new Date(Date.UTC(2000, 0, 1, h, m)))
}

/**
 * Rango de fechas compacto:
 *   mismo día          → "10 dic 2026"
 *   mismo mes y año    → "10–12 dic 2026"
 *   distinto mes/año   → "30 dic 2026 – 2 ene 2027"
 */
export function formatDateRange(startISO: string, endISO: string): string {
  if (startISO === endISO) return formatDate(startISO)
  const [startYear, startMonth, startDay] = startISO.split('-').map(Number)
  const [endYear, endMonth] = endISO.split('-').map(Number)
  if (startYear === endYear && startMonth === endMonth) {
    // En español queda "10–12 dic 2026"; en otros idiomas el orden día/mes cambia: Intl arma el rango correcto.
    if (getBcp47().startsWith('es')) return `${startDay}–${formatDate(endISO)}`
    return dateFormat({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(utc(startISO), utc(endISO))
  }
  return `${formatDate(startISO)} – ${formatDate(endISO)}`
}

/** 40 → "40 min"; 95 → "1 h 35 min"; 120 → "2 h". (Las abreviaturas h/min son internacionales.) */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Número de días del viaje, contando ambos extremos. ("2026-12-01", "2026-12-03") → 3 */
export function countTripDays(startISO: string, endISO: string): number {
  return Math.round((Date.parse(`${endISO}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`)) / 86_400_000) + 1
}
