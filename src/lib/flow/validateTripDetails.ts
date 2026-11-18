/**
 * Validación del formulario del Paso 1 ("Cuéntanos tu viaje").
 * Función pura: recibe lo que hay escrito en el formulario y devuelve un
 * mensaje de error por campo (vacío = todo correcto).
 */
import { MAX_TRIP_DAYS } from '../itinerary/generateItinerary'
import { countTripDays, parseBudget } from '../format'
import { getT } from '../i18n/store'

/** Valores tal como están en el formulario (texto). */
export interface TripDetailsDraft {
  destination: string
  startDate: string
  endDate: string
  budget: string
}

export type TripDetailsErrors = Partial<Record<keyof TripDetailsDraft, string>>

/** Tope de presupuesto para descartar errores de tipeo (1.000 millones COP). */
export const MAX_BUDGET_COP = 1_000_000_000

export function validateTripDetails(draft: TripDetailsDraft, today: string): TripDetailsErrors {
  const errors: TripDetailsErrors = {}

  if (draft.destination.trim().length < 2) {
    errors.destination = getT()('vt.needDestination')
  }

  // Las fechas ISO "AAAA-MM-DD" se pueden comparar como texto.
  if (!draft.startDate) {
    errors.startDate = getT()('vt.needStart')
  } else if (draft.startDate < today) {
    errors.startDate = getT()('vt.startPast')
  }

  if (!draft.endDate) {
    errors.endDate = getT()('vt.needEnd')
  } else if (draft.startDate && draft.endDate < draft.startDate) {
    errors.endDate = getT()('vt.endBeforeStart')
  } else if (draft.startDate && countTripDays(draft.startDate, draft.endDate) > MAX_TRIP_DAYS) {
    errors.endDate = getT()('vt.maxDays', { max: MAX_TRIP_DAYS })
  }

  const budget = parseBudget(draft.budget)
  if (budget === null) {
    errors.budget = getT()('vt.needBudget')
  } else if (budget <= 0) {
    errors.budget = getT()('vt.budgetPositive')
  } else if (budget > MAX_BUDGET_COP) {
    errors.budget = getT()('vt.budgetHigh')
  }

  return errors
}

export const hasErrors = (errors: TripDetailsErrors) => Object.keys(errors).length > 0
