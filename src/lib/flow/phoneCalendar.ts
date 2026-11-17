/**
 * Guardar el viaje en el calendario del CELULAR, sin que el usuario tenga que
 * buscar un archivo descargado:
 *   - iPhone/iPad: se abre el evento (.ics) directamente; Safari muestra la
 *     hoja "Agregar al calendario" del Calendario de iOS.
 *   - Android (Samsung, Xiaomi…): el menú de compartir del sistema con el
 *     evento, y ahí se elige la app de calendario (Samsung Calendar, Google
 *     Calendar…). Si el navegador no puede compartir archivos, se abre el
 *     evento y Android ofrece las apps de calendario.
 *   - Computador: no aplica (se usa Google Calendar).
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

function openEvent(file: File) {
  const url = URL.createObjectURL(file)
  window.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Devuelve false si el usuario cerró el menú de compartir sin elegir nada. */
export async function addToPhoneCalendar(ics: string, fileName: string, title: string, platform: Platform): Promise<boolean> {
  const file = new File([ics], fileName, { type: 'text/calendar' })
  if (platform === 'android' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return true
    } catch (error) {
      if ((error as Error).name === 'AbortError') return false
      // Si compartir falla por otra razón, se abre el evento.
    }
  }
  openEvent(file)
  return true
}
