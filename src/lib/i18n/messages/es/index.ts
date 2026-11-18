import { agent } from './agent'
import { app } from './app'
import { auth } from './auth'
import { common } from './common'
import { home } from './home'
import { nav } from './nav'
import { planner } from './planner'
import { plans } from './plans'
import { trips } from './trips'
import { weather } from './weather'

/** Diccionario base. El resto de idiomas deben tener EXACTAMENTE estas claves (lo verifica el compilador y una prueba). */
export const es = { ...agent, ...app, ...auth, ...common, ...home, ...nav, ...planner, ...plans, ...trips, ...weather }
export type MessageKey = keyof typeof es
