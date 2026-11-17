/**
 * Fechas de calendario "AAAA-MM-DD" sin zona horaria: todo se calcula en UTC
 * para que la zona del navegador no corra un día.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

export const isIsoDate = (value: string) => ISO.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Noches entre llegada y salida (salida excluida). Negativo si salida < llegada. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / DAY_MS)
}

/** Las noches ocupadas: llegada incluida, salida excluida. ("12-10","12-13") → 10, 11, 12. */
export function eachNight(checkIn: string, checkOut: string): string[] {
  const count = nightsBetween(checkIn, checkOut)
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(checkIn, i))
}

/** Días completos entre dos fechas ISO (útil para políticas de cancelación). */
export const daysUntil = (from: string, to: string) => nightsBetween(from, to)
