/**
 * Preparación de fotos en el navegador. Sin Cloud Storage (requiere plan Blaze),
 * las fotos se guardan como data URL WebP dentro de Firestore, así que se
 * redimensionan y comprimen ANTES de subir:
 *   - Foto de galería: lado máx. 1280 px, ≤ ~330 kB (la regla permite 450.000 caracteres).
 *   - Miniatura (portada): lado máx. 480 px, ≤ ~60 kB (la regla permite 70.000 caracteres).
 * Las reglas de Firestore vuelven a validar formato y tamaño en el servidor.
 */

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_INPUT_BYTES = 12 * 1024 * 1024
export const PHOTO_MAX_CHARS = 440_000
export const COVER_MAX_CHARS = 68_000

export class ImageError extends Error {}

/** Escala (width, height) para que el lado mayor no pase de `maxSide`, sin agrandar. */
export function fitDimensions(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Primer problema del archivo elegido (texto para el usuario) o null. */
export function validateImageFile(file: { type: string; size: number; name?: string }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Solo se aceptan fotos JPG, PNG o WebP.'
  if (file.size > MAX_INPUT_BYTES) return 'La foto pesa más de 12 MB. Elige una más liviana.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new ImageError('No pudimos leer esa imagen. Prueba con otra foto.')
  }
}

function encode(bitmap: ImageBitmap, maxSide: number, maxChars: number): string {
  const { width, height } = fitDimensions(bitmap.width, bitmap.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('Tu navegador no puede procesar imágenes.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  // Se baja la calidad hasta que quepa en el límite.
  for (let quality = 0.82; quality >= 0.3; quality -= 0.1) {
    const url = canvas.toDataURL('image/webp', quality)
    if (url.startsWith('data:image/webp') && url.length <= maxChars) return url
  }
  // Último recurso: reducir dimensiones a la mitad.
  const smaller = fitDimensions(width, height, Math.round(Math.max(width, height) / 2))
  canvas.width = smaller.width
  canvas.height = smaller.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, smaller.width, smaller.height)
  const url = canvas.toDataURL('image/webp', 0.5)
  if (url.length > maxChars) throw new ImageError('No logramos reducir esa foto lo suficiente. Prueba con otra.')
  return url
}

export interface PreparedPhoto {
  dataUrl: string
  /** Miniatura para tarjetas. */
  thumb: string
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const problem = validateImageFile(file)
  if (problem) throw new ImageError(problem)
  const bitmap = await loadBitmap(file)
  try {
    return { dataUrl: encode(bitmap, 1280, PHOTO_MAX_CHARS), thumb: encode(bitmap, 480, COVER_MAX_CHARS) }
  } finally {
    bitmap.close()
  }
}

/** Regenera la miniatura a partir de una foto ya guardada (data URL). */
export async function thumbFromDataUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const bitmap = await createImageBitmap(blob)
  try {
    return encode(bitmap, 480, COVER_MAX_CHARS)
  } finally {
    bitmap.close()
  }
}

/** Portada neutra para publicaciones que todavía no tienen fotos (las reglas exigen una imagen). */
export function placeholderCover(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 120
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#EDF1F5'
    ctx.fillRect(0, 0, 160, 120)
  }
  return canvas.toDataURL('image/webp', 0.6)
}
