import { getT } from '../i18n/store'
/**
 * Guardar el viaje en el calendario del CELULAR, sin archivos de por medio:
 *
 *   - Android (Samsung, Xiaomi, Motorola…): un enlace "intent" de Android que
 *     abre la pantalla "Nuevo evento" de la app de calendario del teléfono
 *     (Samsung Calendar, Google Calendar…) con el viaje ya escrito; el usuario
 *     solo toca Guardar. Si el navegador no puede abrir apps, va a Google
 *     Calendar en la web (S.browser_fallback_url).
 *   - iPhone/iPad con Safari: iOS no deja que una página agregue eventos sola.
 *     Se abre el evento como invitación de calendario (un enlace a un blob de
 *     tipo text/calendar, SIN el atributo "download"): Safari pregunta si
 *     permite mostrar la invitación y abre la hoja nativa del Calendario con
 *     "Agregar todos". (Una dirección "data:" no sirve: Safari la bloquea sin
 *     avisar.)
 *   - iPhone con Chrome, Firefox u otro navegador: no saben abrir invitaciones
 *     de calendario, así que se usa Google Calendar.
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
  return getT()(platform === 'ios' ? 'it.calendarIphone' : 'it.calendarPhone')
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

/** Safari de verdad (en iOS, Chrome dice "CriOS", Firefox "FxiOS", Edge "EdgiOS"…). */
export function isIosSafari(userAgent: string = navigator.userAgent): boolean {
  return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/i.test(userAgent)
}

/** Abre la invitación de calendario en Safari (iOS): un enlace al evento, sin "download". */
function openCalendarInvite(ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, rel: 'noopener' })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Qué hace el botón en este celular. */
export type PhoneCalendarAction = 'android-intent' | 'ios-invite' | 'google'

export function phoneCalendarAction(platform: Platform, userAgent: string = navigator.userAgent): PhoneCalendarAction {
  if (platform === 'android') return 'android-intent'
  return isIosSafari(userAgent) ? 'ios-invite' : 'google'
}

/** Abre el calendario del celular con el viaje. */
export function addToPhoneCalendar(
  platform: Platform,
  { event, ics, fallbackUrl }: { event: PhoneEvent; ics: string; fallbackUrl: string },
): PhoneCalendarAction {
  const action = phoneCalendarAction(platform)
  if (action === 'android-intent') window.location.href = androidCalendarIntent(event, fallbackUrl)
  else if (action === 'ios-invite') openCalendarInvite(ics)
  else window.open(fallbackUrl, '_blank', 'noopener')
  return action
}
