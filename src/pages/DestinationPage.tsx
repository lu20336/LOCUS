/**
 * Ficha de un destino destacado: foto, clima, mapa, descripción (Wikipedia),
 * lugares conocidos, experiencias y alojamientos cercanos. Cada bloque indica
 * su fuente (editorial de LOCUS, OpenStreetMap, Wikipedia, anfitriones).
 */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { FavoriteButton } from '../components/FavoriteButton'
import { ExperienceCard } from '../components/ListingCard'
import { StaysSection } from '../components/StaysSection'
import { StreetPhotos } from '../components/StreetPhotos'
import { WeatherPanel } from '../components/WeatherPanel'
import { Alert, Badge, Button, ButtonLink, Container, EmptyState, Spinner } from '../components/ui'
import { fetchPublished } from '../lib/catalog/repo'
import type { Experience } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { FEATURED_DESTINATIONS, climateOf } from '../lib/featuredDestinations'
import { placesClient } from '../lib/itinerary/fallbackClient'
import { haversineKm } from '../lib/itinerary/geo'
import { CATEGORIES } from '../lib/itinerary/categories'
import { osmPlaceUrl } from '../lib/flow/itineraryView'
import { CLIMATES } from '../lib/itinerary/suggestDestination'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { fetchWikiSummary, wikiTitleFor } from '../lib/places/wikipedia'
import { DESTINATION_META } from '../lib/profile/recommend'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useAsync } from '../lib/useAsync'
import type { Place } from '../types/itinerary'

export default function DestinationPage() {
  const { t, meta: localeMeta } = useI18n()
  const { id = '' } = useParams()
  const d = FEATURED_DESTINATIONS.find((x) => x.id === id)
  const wiki = useAsync(() => (wikiTitleFor(id) ? fetchWikiSummary(wikiTitleFor(id)!) : Promise.resolve(null)), [id])
  const exps = useAsync(() => fetchPublished<Experience>(db, 'experiences'), [])
  const [places, setPlaces] = useState<{ loading: boolean; error: string | null; list: Place[] } | null>(null)

  const nearExps = useMemo(() => (d ? (exps.data ?? []).filter((e) => haversineKm(d.destination, e) <= 40).slice(0, 3) : []), [exps.data, d])

  if (!d) return <Container className="py-12"><EmptyState title={t('dest.notFound')} action={<ButtonLink to="/">{t('dest.backHome')}</ButtonLink>} /></Container>

  async function loadPlaces() {
    if (!d) return
    setPlaces({ loading: true, error: null, list: [] })
    try {
      const found = await placesClient.findPlaces(d.destination, d.destination.radiusMeters, ['cultura', 'aventura', 'gastronomia', 'playa'])
      const best = (['cultura', 'aventura', 'gastronomia', 'playa'] as const).flatMap((c) => found.filter((p) => p.category === c).sort((a, b) => b.score - a.score).slice(0, 4))
      setPlaces({ loading: false, error: null, list: best })
    } catch {
      setPlaces({ loading: false, error: t('dest.overpassBusy'), list: [] })
    }
  }

  const climate = climateOf(d)
  const meta = DESTINATION_META[d.id]
  const placeMarkers: MapMarker[] = (places?.list ?? []).map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, kind: 'place' }))

  return (
    <div>
      <section className="relative isolate">
        <img src={d.image} alt="" style={{ objectPosition: d.imagePosition }} className="absolute inset-0 -z-10 size-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgb(0_25_50/0.4)] to-[rgb(0_25_50/0.85)]" />
        <Container className="flex min-h-[22rem] flex-col justify-end pb-8 pt-20 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/85">{t('dest.eyebrow', { region: meta ? t(`rg.${meta.region}`) : 'Colombia' })}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-2 text-5xl font-semibold focus:outline-none sm:text-6xl">{d.name}</h1>
          <p className="mt-2 text-lg text-white/90">{t('dest.climateLine', { tagline: d.tagline, climate: CLIMATES[climate].label.toLowerCase(), temperature: CLIMATES[climate].temperature, elevation: d.elevation.toLocaleString(localeMeta.bcp47) })}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ButtonLink to={`/?destino=${d.id}`}>{t('dest.planTrip', { name: d.name })}</ButtonLink>
            <FavoriteButton className="!size-11 border border-white/40" item={{ kind: 'destination', refId: d.id, title: d.name, subtitle: d.tagline }} />
          </div>
        </Container>
      </section>

      <Container className="flex flex-col gap-10 py-10">
        {wiki.data && (
          <section aria-labelledby="about">
            <h2 id="about" className="text-2xl font-semibold text-navy">{t('dest.about', { name: d.name })}</h2>
            <p className="mt-2 max-w-3xl text-ink">{wiki.data.extract}</p>
            <p className="mt-2 text-xs text-muted">{t('dest.textFrom')} <a className="underline" href={wiki.data.url} target="_blank" rel="noreferrer">Wikipedia</a> (CC BY-SA 4.0).</p>
          </section>
        )}

        <section aria-labelledby="visit">
          <h2 id="visit" className="text-2xl font-semibold text-navy">{t('dest.visit')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dest.editorial')}<a href="/images/CREDITOS.md" target="_blank" rel="noreferrer" className="underline">{t('dest.credits')}</a>).</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {d.places.map((p) => (
              <li key={p.name} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <img src={p.image} alt={p.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <p className="p-3 text-sm font-semibold text-ink">{p.name}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="map">
          <h2 id="map" className="text-2xl font-semibold text-navy">{t('dest.onMap')}</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_22rem]">
            <LocusMap markers={placeMarkers} center={[d.destination.lat, d.destination.lon]} zoom={12} fitMarkers={placeMarkers.length > 0} className="h-96" ariaLabel={t('dest.mapOf', { name: d.name })} />
            <div className="flex flex-col gap-3">
              {!places ? (
                <Button variant="secondary" onClick={loadPlaces}>{t('dest.viewPlaces')}</Button>
              ) : places.loading ? <Spinner label={t('dest.consulting')} /> : places.error ? (
                <><Alert>{places.error}</Alert><Button variant="secondary" onClick={loadPlaces}>{t('common.retry')}</Button></>
              ) : (
                <ul className="max-h-96 overflow-y-auto rounded-2xl border border-line bg-surface p-3 text-sm">
                  {places.list.map((p) => <li key={p.id} className="border-b border-line py-1.5 last:border-0"><a href={osmPlaceUrl(p)} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{p.name}</a> <span className="text-muted">· {p.kind} · {CATEGORIES[p.category].label}</span></li>)}
                  {places.list.length === 0 && <li className="text-muted">{t('dest.noPlaces')}</li>}
                </ul>
              )}
              <p className="text-xs text-muted">{t('dest.placesNote')}</p>
            </div>
          </div>
        </section>

        <WeatherPanel lat={d.destination.lat} lon={d.destination.lon} title={t('dest.weatherIn', { name: d.name })} />
        <StreetPhotos lat={d.destination.lat} lon={d.destination.lon} />

        {nearExps.length > 0 && (
          <section aria-labelledby="exps">
            <h2 id="exps" className="text-2xl font-semibold text-navy">{t('dest.nearExperiences')}</h2>
            <ul className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{nearExps.map((e) => <li key={e.id}><ExperienceCard experience={e} /></li>)}</ul>
          </section>
        )}

        <StaysSection lat={d.destination.lat} lon={d.destination.lon} placeName={d.name} />

        <section aria-labelledby="fly" className="rounded-3xl border border-line bg-surface p-5">
          <h2 id="fly" className="text-xl font-semibold text-navy">{t('dest.howToGet')}</h2>
          <p className="mt-1 text-muted">{t('dest.searchFlightsTo', { name: d.name })} <Badge>{t('dest.externalLinks')}</Badge></p>
          <div className="mt-3"><ButtonLink to={`/comparar?tipo=vuelos&destino=${encodeURIComponent(d.name)}`} variant="secondary">{t('dest.findFlights', { name: d.name })}</ButtonLink></div>
        </section>
      </Container>
    </div>
  )
}
