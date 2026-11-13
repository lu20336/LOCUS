/**
 * Clima con Open-Meteo (https://open-meteo.com): sin API key, con CORS.
 * IMPORTANTE (condiciones del proveedor): la API gratuita es solo para uso NO
 * COMERCIAL (≤ 10.000 llamadas/día, 600/min) y exige atribución (CC BY 4.0).
 * Si LOCUS empieza a cobrar o a monetizar, hay que pasar al plan comercial de
 * Open-Meteo o cambiar de proveedor. Ver docs/PROVEEDORES.md.
 *
 * Diferenciamos SIEMPRE el pronóstico (incierto) de las condiciones actuales
 * (estimación del modelo para este momento, no una medición de estación).
 */

export interface DailyForecast {
  date: string
  tMax: number
  tMin: number
  apparentMax: number
  precipitationMm: number
  /** Probabilidad máxima de precipitación del día, 0–100. */
  precipitationProbability: number
  code: number
  description: string
}

export interface CurrentWeather {
  temperature: number
  apparentTemperature: number
  humidity: number
  precipitationMm: number
  code: number
  description: string
}

export interface Forecast {
  lat: number
  lon: number
  elevation: number | null
  current: CurrentWeather | null
  daily: DailyForecast[]
  /** ISO de cuando se consultó. */
  fetchedAt: string
}

/** Códigos WMO de Open-Meteo → texto en español. */
export function describeWeatherCode(code: number): string {
  if (code === 0) return 'Despejado'
  if (code === 1) return 'Mayormente despejado'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code === 45 || code === 48) return 'Niebla'
  if (code >= 51 && code <= 57) return 'Llovizna'
  if (code >= 61 && code <= 67) return 'Lluvia'
  if (code >= 71 && code <= 77) return 'Nieve'
  if (code >= 80 && code <= 82) return 'Aguaceros'
  if (code === 85 || code === 86) return 'Aguaceros de nieve'
  if (code === 95) return 'Tormenta eléctrica'
  if (code === 96 || code === 99) return 'Tormenta con granizo'
  return 'Sin dato'
}

interface OpenMeteoResponse {
  elevation?: number
  current?: {
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    precipitation: number
    weather_code: number
  }
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    apparent_temperature_max: number[]
    precipitation_sum: number[]
    precipitation_probability_max: (number | null)[]
  }
}

export function parseForecast(lat: number, lon: number, json: OpenMeteoResponse, now = new Date()): Forecast {
  const d = json.daily
  const daily: DailyForecast[] = d
    ? d.time.map((date, i) => ({
        date,
        tMax: d.temperature_2m_max[i],
        tMin: d.temperature_2m_min[i],
        apparentMax: d.apparent_temperature_max[i],
        precipitationMm: d.precipitation_sum[i] ?? 0,
        precipitationProbability: d.precipitation_probability_max[i] ?? 0,
        code: d.weather_code[i],
        description: describeWeatherCode(d.weather_code[i]),
      }))
    : []
  const c = json.current
  return {
    lat,
    lon,
    elevation: json.elevation ?? null,
    current: c
      ? {
          temperature: c.temperature_2m,
          apparentTemperature: c.apparent_temperature,
          humidity: c.relative_humidity_2m,
          precipitationMm: c.precipitation,
          code: c.weather_code,
          description: describeWeatherCode(c.weather_code),
        }
      : null,
    daily,
    fetchedAt: now.toISOString(),
  }
}

/** Nivel de riesgo de lluvia de un día, para recomendaciones. */
export function rainRisk(day: Pick<DailyForecast, 'precipitationMm' | 'precipitationProbability'>): 'bajo' | 'medio' | 'alto' {
  if (day.precipitationProbability >= 70 || day.precipitationMm >= 10) return 'alto'
  if (day.precipitationProbability >= 40 || day.precipitationMm >= 3) return 'medio'
  return 'bajo'
}

export const FORECAST_MAX_DAYS = 16
const CACHE_MS = 30 * 60 * 1000

export function forecastUrl(lat: number, lon: number, days: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max',
    timezone: 'America/Bogota',
    forecast_days: String(Math.min(Math.max(days, 1), FORECAST_MAX_DAYS)),
  })
  return `https://api.open-meteo.com/v1/forecast?${params}`
}

/** Pronóstico de hasta 16 días con caché de 30 min en sessionStorage (ahorra cuota). */
export async function fetchForecast(lat: number, lon: number, days = 7, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<Forecast> {
  const key = `locus:weather:v1:${lat.toFixed(2)},${lon.toFixed(2)}:${days}`
  try {
    const cached = sessionStorage.getItem(key)
    if (cached) {
      const parsed = JSON.parse(cached) as Forecast
      if (Date.now() - Date.parse(parsed.fetchedAt) < CACHE_MS) return parsed
    }
  } catch {
    // sin sessionStorage: seguimos sin caché
  }
  const response = await fetchFn(forecastUrl(lat, lon, days), { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('No pudimos consultar el clima en este momento.')
  const forecast = parseForecast(lat, lon, (await response.json()) as OpenMeteoResponse)
  try {
    sessionStorage.setItem(key, JSON.stringify(forecast))
  } catch {
    // cuota llena o bloqueado
  }
  return forecast
}
