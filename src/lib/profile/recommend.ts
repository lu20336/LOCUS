/**
 * Recomendación de destinos basada en reglas sobre el perfil DECLARADO y los
 * destinos destacados reales de LOCUS (con altitud, clima y fotos). Es
 * determinista y explica cada sugerencia ("porque te gusta la playa…"): sirve
 * sin IA, y el agente la usa como una de sus herramientas.
 */
import { FEATURED_DESTINATIONS, climateOf, type FeaturedDestination } from '../featuredDestinations'
import type { ClimateId } from '../itinerary/suggestDestination'
import { getT } from '../i18n/store'
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

/** Cómo se muestran las etiquetas internas en las razones de la recomendación (idioma activo). */
const tagLabel = (tag: string) => getT()(`tg.${tag}`)

export interface Recommendation {
  destination: FeaturedDestination
  score: number
  reasons: string[]
}

const climateWord = (id: ClimateId) => getT()(`climate.${id}`).toLowerCase()

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
      reasons.push(getT()('rec.fits', { tags: [...new Set(matches.map(tagLabel))].slice(0, 3).join(', ') }))
    }
    const climate = climateOf(destination)
    if (a.climate && a.climate !== 'indiferente') {
      if (a.climate === climate) {
        score += 4
        reasons.push(getT()('rec.climateMatch', { climate: climateWord(climate) }))
      } else score -= 2
    }
    if (a.regions?.includes(meta.region)) {
      score += 3
      reasons.push(getT()('rec.region'))
    }
    if (a.popularity === 'populares' && meta.popular) score += 1
    if (a.popularity === 'poco_conocidos' && !meta.popular) {
      score += 2
      reasons.push(getT()('rec.lessCrowded'))
    }
    if (a.budgetPerPerson) {
      const max = BUDGET_MAX[a.budgetPerPerson]
      if (max <= 300_000 && meta.tier === 'alto') score -= 3
      if (max <= 300_000 && meta.tier === 'economico') {
        score += 2
        reasons.push(getT()('rec.cheaper'))
      }
      if (max >= 2_000_000 && meta.tier === 'alto') score += 1
    }
    if (a.companions === 'familia_ninos' && meta.tags.includes('familiares')) {
      score += 2
      reasons.push(getT()('rec.kids'))
    }
    if (pending && (pending.includes(destination.name.toLowerCase()) || pending.includes(destination.id.replaceAll('-', ' ')))) {
      score += 5
      reasons.push(getT()('rec.pending'))
    }
    return { destination, score, reasons }
  })

  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, limit)
}
