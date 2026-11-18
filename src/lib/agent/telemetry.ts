/**
 * Observabilidad del agente: bitácora técnica de cada llamada (modelo o
 * herramienta) para saber CUÁNDO y POR QUÉ falla algo.
 *
 * Qué se guarda: hora, proveedor, modelo, tipo, duración, estado, código de error,
 * número de reintentos y causa clasificada.
 * Qué NO se guarda jamás: texto de la conversación, claves, tokens, correos, nombres
 * ni identificadores de usuario. Vive solo en memoria y en sessionStorage (se borra
 * al cerrar la pestaña); no se envía a ningún servidor. El usuario puede copiarla
 * para soporte con el botón "Copiar detalles técnicos".
 */
import type { FailureKind } from './resilience'

export interface AgentLogEntry {
  /** ISO 8601 */
  at: string
  provider: 'gemini' | 'locus-tool' | 'speech'
  model?: string
  /** 'model' = llamada a Gemini; 'tool' = herramienta (OSM, clima…); 'voice' = reconocimiento/síntesis. */
  kind: 'model' | 'tool' | 'voice'
  /** Nombre de la herramienta o de la operación (sin parámetros). */
  name?: string
  durationMs: number
  status: 'ok' | 'error' | 'timeout' | 'cancelled'
  /** Código HTTP o del SDK. */
  errorCode?: string | number
  retries: number
  cause?: FailureKind | 'empty-response' | 'unsupported'
}

const KEY = 'locus:agent:log:v1'
const MAX = 100
let buffer: AgentLogEntry[] = []
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) buffer = parsed.slice(-MAX) as AgentLogEntry[]
  } catch {
    buffer = []
  }
}

export function logAgentEvent(entry: Omit<AgentLogEntry, 'at'>): void {
  load()
  const full: AgentLogEntry = { at: new Date().toISOString(), ...entry }
  buffer.push(full)
  if (buffer.length > MAX) buffer = buffer.slice(-MAX)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(buffer))
  } catch {
    // Sin almacenamiento: queda solo en memoria.
  }
  if (import.meta.env?.DEV) console.debug('[agente]', full)
}

export function getAgentLog(): readonly AgentLogEntry[] {
  load()
  return buffer
}

export function clearAgentLog(): void {
  buffer = []
  loaded = true
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nada
  }
}

/** Resumen listo para pegar en un reporte de soporte (sin contenido de conversaciones). */
export function diagnosticReport(limit = 20): string {
  load()
  const recent = buffer.slice(-limit)
  const failures = recent.filter((e) => e.status !== 'ok')
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      total: recent.length,
      failures: failures.length,
      entries: recent,
    },
    null,
    2,
  )
}

/** Estadísticas rápidas para pruebas y paneles internos. */
export function summarizeLog(entries: readonly AgentLogEntry[]): { total: number; errors: number; retries: number; avgMs: number } {
  const total = entries.length
  return {
    total,
    errors: entries.filter((e) => e.status !== 'ok').length,
    retries: entries.reduce((s, e) => s + e.retries, 0),
    avgMs: total ? Math.round(entries.reduce((s, e) => s + e.durationMs, 0) / total) : 0,
  }
}
