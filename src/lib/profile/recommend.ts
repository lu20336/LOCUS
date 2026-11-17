/**
 * Recomendación de destinos basada en reglas sobre el perfil DECLARADO y los
 * destinos destacados reales de LOCUS (con altitud, clima y fotos). Es
 * determinista y explica cada sugerencia ("porque te gusta la playa…"): sirve
 * sin IA, y el agente la usa como una de sus herramientas.
 */
import { FEATURED_DESTINATIONS, climateOf, type FeaturedDestination } from '../featuredDestinations'
import type { ClimateId } from '../itinerary/suggestDestination'
import { BUDGET_MAX, type Answers } from './survey'

interface DestinationMeta {
  region: 'caribe' | 'andina' | 'pacifica' | 'orinoquia' | 'amazonia' | 'insular'
  /** Etiquetas que se cruzan con respuestas de la encuesta. */
  tags: string[]
  popular: boolean
  /** Presupuesto típico por persona de un viaje corto (referencia editorial, no un precio). */
  tier: 'economico' | 'medio' | 'alto'
}

/** Contenido editorial de LOCUS sobre los destinos destacados (no son datos transaccionales). */
export const DESTINATION_META: Record<string, DestinationMeta> = {
  cartagena: { region: 'caribe', popular: true, tier: 'alto', tags: ['playa', 'cultura', 'gastronomia', 'vidaNocturna', 'ciudad', 'acuaticas', 'cultural', 'vida_nocturna', 'descanso'] },
  medellin: { region: 'andina', popular: true, tier: 'medio', tags: ['ciudad', 'cultura', 'gastronomia', 'vidaNocturna', 'cultural', 'vida_nocturna', 'locales', 'familiares', 'bienestar'] },
  bogota: { region: 'andina', popular: true, tier: 'medio', tags: ['ciudad', 'cultura', 'gastronomia', 'cultural', 'vida_nocturna', 'vidaNocturna', 'locales'] },
  'villa-de-leyva': { region: 'andina', popular: false, tier: 'medio', tags: ['pueblo', 'cultura', 'gastronomia', 'cultural', 'descanso', 'locales', 'rural', 'bienestar'] },
  'san-andres': { region: 'insular', popular: true, tier: 'alto', tags: ['playa', 'descanso', 'acuaticas', 'buceo', 'naturaleza', 'familiares'] },
  salento: { region: 'andina', popular: false, tier: 'medio', tags: ['pueblo', 'montana', 'rural', 'naturaleza', 'aventura', 'senderismo', 'ecoturismo', 'fauna', 'gastronomia', 'locales'] },
  'santa-marta': { region: 'caribe', popular: true, tier: 'medio', tags: ['playa', 'selva', 'montana', 'naturaleza', 'aventura', 'senderismo', 'ecoturismo', 'acuaticas', 'fauna', 'descanso'] },
  guatape: { region: 'andina', popular: false, tier: 'economico', tags: ['pueblo', 'rural', 'naturaleza', 'aventura', 'acuaticas', 'familiares', 'escalada', 'descanso'] },
}

/** Cómo se muestran las etiquetas internas en las razones de la recomendación. */
const TAG_LABELS: Record<string, string> = {
  montana: 'montaña', vidaNocturna: 'vida nocturna', vida_nocturna: 'vida nocturna', acuaticas: 'actividades acuáticas', cultural: 'turismo cultural',
  gastronomia: 'gastronomía', ecoturismo: 'ecoturismo', senderismo: 'senderismo', locales: 'experiencias locales', familiares: 'planes familiares',
}
const tagLabel = (tag: string) => TAG_LABELS[tag] ?? tag.replaceAll('_', ' ')

export interface Recommendation {
  destination: FeaturedDestination
  score: number
  reasons: string[]
}

const CLIMATE_LABEL: Record<ClimateId, string> = { calido: 'cálido', templado: 'templado', frio: 'frío' }

/** Valores de la encuesta que se cruzan con las etiquetas del destino. */
function interests(a: Answers): string[] {
  return [...(a.travelerTypes ?? []), ...(a.environments ?? []), ...(a.activities ?? []), ...(a.extremeSports ?? [])]
}

export function recommendDestinations(a: Answers, limit = 3, catalog: readonly FeaturedDestination[] = FEATURED_DESTINATIONS): Recommendation[] {
  const wanted = new Set(interests(a))
  const pending = (a.pendingDestinations ?? '').toLowerCase()

  const scored = catalog.map((destination) => {
    const meta = DESTINATION_META[destination.id]
    const reasons: string[] = []
    let score = 0
    if (!meta) return { destination, score, reasons }

    const matches = meta.tags.filter((t) => wanted.has(t))
    if (matches.length > 0) {
      score += matches.length * 2
      reasons.push(`encaja con lo que buscas (${[...new Set(matches.map(tagLabel))].slice(0, 3).join(', ')})`)
    }
    const climate = climateOf(destination)
    if (a.climate && a.climate !== 'indiferente') {
      if (a.climate === climate) {
        score += 4
        reasons.push(`tiene el clima ${CLIMATE_LABEL[climate]} que prefieres`)
      } else score -= 2
    }
    if (a.regions?.includes(meta.region)) {
      score += 3
      reasons.push('está en una región que quieres conocer')
    }
    if (a.popularity === 'populares' && meta.popular) score += 1
    if (a.popularity === 'poco_conocidos' && !meta.popular) {
      score += 2
      reasons.push('es menos masivo que otros destinos')
    }
    if (a.budgetPerPerson) {
      const max = BUDGET_MAX[a.budgetPerPerson]
      if (max <= 300_000 && meta.tier === 'alto') score -= 3
      if (max <= 300_000 && meta.tier === 'economico') {
        score += 2
        reasons.push('suele ser más económico')
      }
      if (max >= 2_000_000 && meta.tier === 'alto') score += 1
    }
    if (a.companions === 'familia_ninos' && meta.tags.includes('familiares')) {
      score += 2
      reasons.push('tiene planes aptos para niños')
    }
    if (pending && (pending.includes(destination.name.toLowerCase()) || pending.includes(destination.id.replaceAll('-', ' ')))) {
      score += 5
      reasons.push('lo tenías en tu lista de pendientes')
    }
    return { destination, score, reasons }
  })

  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, limit)
}
