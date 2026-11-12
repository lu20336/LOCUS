// Utilidades de formato para mostrar datos al usuario (es-CO).

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const thousandsFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** 2500000 → "$ 2.500.000" */
export function formatCOP(value: number): string {
  return copFormatter.format(value)
}

/** 2500000 → "2.500.000" (para mostrar dentro del campo mientras se escribe). */
export function formatThousands(value: number): string {
  return thousandsFormatter.format(value)
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

/** "2026-12-01" → "1 dic 2026" (sin desfases de zona horaria). */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

/** Número de días del viaje, contando ambos extremos. ("2026-12-01", "2026-12-03") → 3 */
export function countTripDays(startISO: string, endISO: string): number {
  return Math.round((Date.parse(`${endISO}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`)) / 86_400_000) + 1
}
