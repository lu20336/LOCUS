import { agent } from './agent'
import { app } from './app'
import { auth } from './auth'
import { bookings } from './bookings'
import { catalog } from './catalog'
import { common } from './common'
import { flow } from './flow'
import { compare } from './compare'
import { compareProviders } from './compareProviders'
import { home } from './home'
import { itinerary } from './itinerary'
import { host } from './host'
import { nav } from './nav'
import { planner } from './planner'
import { plans } from './plans'
import { trips } from './trips'
import { weather } from './weather'

/** Diccionario base. El resto de idiomas deben tener EXACTAMENTE estas claves (lo verifica el compilador y una prueba). */
export const es = { ...agent, ...app, ...auth, ...bookings, ...catalog, ...common, ...compare, ...compareProviders, ...flow, ...home, ...itinerary, ...host, ...nav, ...planner, ...plans, ...trips, ...weather }
export type MessageKey = keyof typeof es
