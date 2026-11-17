/**
 * Guardar el viaje en el calendario del CELULAR, sin archivos de por medio:
 *
 *   - Android (Samsung, Xiaomi, Motorola…): un enlace "intent" de Android que
 *     abre la pantalla "Nuevo evento" de la app de calendario del teléfono
 *     (Samsung Calendar, Google Calendar…) con el viaje ya escrito; el usuario
 *     solo toca Guardar. Si el navegador no puede abrir apps, va a Google
 *     Calendar en la web (S.browser_fallback_url).
 *   - iPhone/iPad: iOS no deja que una página agregue eventos directamente.
 *     Lo más cercano es abrir el evento como "text/calendar": Safari muestra
 *     la hoja nativa "Agregar al calendario" (no un archivo en Descargas).
 *   - Computador: no aplica (se usa el botón de Google Calendar).
 */
export type Platform = 'ios' | 'android' | 'desktop'

export function detectPlatform(
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints,
): Platform {
  // El iPad con iPadOS se presenta como "Macintosh", pero tiene pantalla táctil.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'desktop'
}

/** Nombre del botón según el celular. */
export function phoneCalendarLabel(platform: Platform): string {
  return platform === 'ios' ? 'Calendario del iPhone' : 'Calendario del celular'
}

export interface PhoneEvent {
  title: string
  location: string
  details: string
  /** ISO "AAAA-MM-DD": primer día y el día siguiente al último. */
  startDate: string
  endDateExclusive: string
}

/** Medianoche UTC de una fecha ISO, en milisegundos (así los guarda Android para eventos de día completo). */
const utcMidnight = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/**
 * Enlace intent de Android: acción INSERT sobre un evento (CalendarContract).
 * Formato: intent:#Intent;action=…;type=…;S.title=…;l.beginTime=…;end
 */
export function androidCalendarIntent(event: PhoneEvent, fallbackUrl: string): string {
  const extras = [
    `S.title=${encodeURIComponent(event.title)}`,
    `S.eventLocation=${encodeURIComponent(event.location)}`,
    `S.description=${encodeURIComponent(event.details)}`,
    `l.beginTime=${utcMidnight(event.startDate)}`,
    `l.endTime=${utcMidnight(event.endDateExclusive)}`,
    'B.allDay=true',
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`,
  ]
  return `intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.item/event;${extras.join(';')};end`
}

/** El evento (.ics) como dirección "data:" de tipo text/calendar, para que iOS lo abra en el Calendario. */
export const iosCalendarUrl = (ics: string) => `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`

/** Abre el calendario del celular con el viaje. */
export function addToPhoneCalendar(
  platform: Platform,
  { event, ics, fallbackUrl }: { event: PhoneEvent; ics: string; fallbackUrl: string },
): void {
  window.location.href = platform === 'android' ? androidCalendarIntent(event, fallbackUrl) : iosCalendarUrl(ics)
}
