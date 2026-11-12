/**
 * Validación del formulario del Paso 1 ("Cuéntanos tu viaje").
 * Función pura: recibe lo que hay escrito en el formulario y devuelve un
 * mensaje de error por campo (vacío = todo correcto).
 */
import { MAX_TRIP_DAYS } from '../itinerary/generateItinerary'
import { countTripDays, parseBudget } from '../format'

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
    errors.destination = 'Escribe a dónde quieres viajar.'
  }

  // Las fechas ISO "AAAA-MM-DD" se pueden comparar como texto.
  if (!draft.startDate) {
    errors.startDate = 'Elige la fecha de salida.'
  } else if (draft.startDate < today) {
    errors.startDate = 'La fecha de salida no puede estar en el pasado.'
  }

  if (!draft.endDate) {
    errors.endDate = 'Elige la fecha de regreso.'
  } else if (draft.startDate && draft.endDate < draft.startDate) {
    errors.endDate = 'La fecha de regreso debe ser igual o posterior a la de salida.'
  } else if (draft.startDate && countTripDays(draft.startDate, draft.endDate) > MAX_TRIP_DAYS) {
    errors.endDate = `Por ahora planificamos viajes de hasta ${MAX_TRIP_DAYS} días.`
  }

  const budget = parseBudget(draft.budget)
  if (budget === null) {
    errors.budget = 'Indica tu presupuesto en pesos.'
  } else if (budget <= 0) {
    errors.budget = 'El presupuesto debe ser mayor que cero.'
  } else if (budget > MAX_BUDGET_COP) {
    errors.budget = 'Revisa el presupuesto: parece demasiado alto.'
  }

  return errors
}

export const hasErrors = (errors: TripDetailsErrors) => Object.keys(errors).length > 0
