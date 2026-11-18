/**
 * Abre el compañero LOCUS desde cualquier parte de la app (tarjetas del inicio,
 * barra lateral, Mis viajes…) sin acoplar esos componentes al widget.
 */
export const AGENT_OPEN_EVENT = 'locus:open-agent'

export function openAgent(prompt?: string): void {
  window.dispatchEvent(new CustomEvent(AGENT_OPEN_EVENT, { detail: { prompt } }))
}
